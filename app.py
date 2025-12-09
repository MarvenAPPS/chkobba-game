import os
import uuid
import json
import time
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from config import Config, config
from db import db
from game_logic import GameState, Card
from ai import AIPlayer
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(config.get(os.environ.get('FLASK_ENV', 'development')))
app.config['SECRET_KEY'] = app.config['SECRET_KEY']

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# In-memory game sessions
active_games = {}  # room_id -> GameState
active_sessions = {}  # session_token -> {room_id, player_id, socket_id, game_index}
room_players = {}  # room_id -> [player_ids] (ordered by join)
player_id_to_index = {}  # room_id -> {player_id: game_index}
ai_players = {}  # room_id -> {player_index: AIPlayer}
turn_timers = {}  # room_id -> timer_thread
room_settings = {}  # room_id -> {target_score: 11 or 21}


def generate_room_code(length=6):
    """Generate random room code"""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def generate_session_token():
    """Generate secure session token"""
    return str(uuid.uuid4())


def get_player_game_index(room_id, player_id):
    """Get player's index in game state array"""
    if room_id not in player_id_to_index:
        return None
    return player_id_to_index[room_id].get(player_id)


def is_ai_player(room_id, player_index):
    """Check if player at index is AI"""
    if room_id not in room_players or player_index >= len(room_players[room_id]):
        return False
    
    player_id = room_players[room_id][player_index]
    player = db.get_player_by_id(player_id)
    return bool(player and player['is_ai'])


def get_scoring_details(game_state, player_idx):
    """Get detailed scoring breakdown for a player"""
    player = game_state.players[player_idx]
    round_captures = player.get('round_captures', [])
    
    # Count cards and diamonds
    total_cards = len(round_captures)
    diamond_count = sum(1 for c in round_captures if c.suit == 'D')
    
    # Check for special cards
    has_haya = any(c.rank == '7' and c.suit == 'D' for c in round_captures)
    has_dinari = any(c.rank == '7' and c.suit == 'C' for c in round_captures)
    
    # Determine if has most cards/diamonds
    all_card_counts = [len(p.get('round_captures', [])) for p in game_state.players]
    all_diamond_counts = [sum(1 for c in p.get('round_captures', []) if c.suit == 'D') for p in game_state.players]
    
    has_most_cards = total_cards == max(all_card_counts) and all_card_counts.count(total_cards) == 1 and total_cards >= 21
    has_most_diamonds = diamond_count == max(all_diamond_counts) and all_diamond_counts.count(diamond_count) == 1 and diamond_count > 0
    
    return {
        'most_cards': has_most_cards,
        'most_diamonds': has_most_diamonds,
        'haya': has_haya,
        'dinari': has_dinari,
        'chkobba_count': player.get('chkobba_count', 0),
        'total_cards': total_cards,
        'diamond_count': diamond_count
    }


def check_round_end(room_id):
    """Check if round has ended and emit round_ended event"""
    game_state = active_games.get(room_id)
    if not game_state:
        return
    
    # Check if round is over (deck empty and all hands empty)
    all_hands_empty = all(len(p['hand']) == 0 for p in game_state.players)
    deck_empty = game_state.deck.remaining() == 0
    
    if all_hands_empty and deck_empty:
        logger.info(f"Round {game_state.round_number} ended in room {room_id}")
        
        # Calculate round scores
        round_scores = game_state.end_round()
        
        # Get player names
        players_data = db.get_players_by_room(room_id)
        player_names = {}
        for p in players_data:
            player_idx = get_player_game_index(room_id, p['id'])
            if player_idx is not None:
                player_names[player_idx] = p['player_name']
        
        # Get detailed scoring breakdown
        scoring_details = {}
        for idx in range(game_state.num_players):
            scoring_details[idx] = get_scoring_details(game_state, idx)
        
        # Get total scores
        total_scores = {i: p['score'] for i, p in enumerate(game_state.players)}
        
        # Get target score
        target_score = room_settings.get(room_id, {}).get('target_score', 21)
        
        # Emit round ended event
        socketio.emit('round_ended', {
            'round_number': game_state.round_number - 1,  # Previous round number
            'round_scores': round_scores,
            'total_scores': total_scores,
            'scoring_details': scoring_details,
            'player_names': player_names,
            'target_score': target_score
        }, room=f'room_{room_id}')
        
        return True
    
    return False


def trigger_ai_turn(room_id):
    """Trigger AI player to make a move"""
    def ai_move():
        time.sleep(0.5)  # 500ms think time
        
        game_state = active_games.get(room_id)
        if not game_state:
            return
        
        current_player_idx = game_state.current_player
        
        # Check if current player is AI
        if not is_ai_player(room_id, current_player_idx):
            return
        
        # Get AI player instance
        if room_id not in ai_players or current_player_idx not in ai_players[room_id]:
            logger.error(f"AI player not found for room {room_id} index {current_player_idx}")
            return
        
        ai = ai_players[room_id][current_player_idx]
        
        # Choose move
        try:
            card, captured = ai.choose_move(game_state, current_player_idx)
            
            if card is None:
                logger.error(f"AI could not find valid move")
                return
            
            # Play the card
            result = game_state.play_card(current_player_idx, card, captured)
            
            if result['success']:
                # Get player_id for database
                player_id = room_players[room_id][current_player_idx]
                
                # Update database
                db.record_move(room_id, game_state.round_number, player_id,
                              card.code, [c.code for c in captured], 
                              result['is_chkobba'], result['is_haya'])
                
                # Check if round ended before moving to next turn
                round_ended = check_round_end(room_id)
                
                if not round_ended:
                    # Move to next turn
                    game_state.next_turn()
                    
                    # Broadcast to room
                    socketio.emit('card_played', {
                        'player_id': player_id,
                        'player_index': current_player_idx,
                        'card': card.code,
                        'captured': [c.code for c in captured],
                        'is_chkobba': result['is_chkobba'],
                        'is_haya': result['is_haya'],
                        'new_cards_dealt': result.get('new_cards_dealt', False),
                        'next_turn_player': game_state.current_player,
                        'game_state': game_state.to_dict()
                    }, room=f'room_{room_id}')
                    
                    logger.info(f"AI player {current_player_idx} played {card.code}")
                    
                    # Process next turn (might be another AI)
                    process_next_turn(room_id)
            else:
                logger.error(f"AI move failed: {result['message']}")
        
        except Exception as e:
            logger.error(f"AI move error: {str(e)}", exc_info=True)
    
    # Run AI move in background thread
    threading.Thread(target=ai_move, daemon=True).start()


def start_turn_timer(room_id):
    """Start timeout timer for current turn"""
    def timeout_handler():
        time.sleep(10)  # 10 second timeout
        
        game_state = active_games.get(room_id)
        if not game_state:
            return
        
        current_player_idx = game_state.current_player
        
        # Don't auto-play for AI (they have their own trigger)
        if is_ai_player(room_id, current_player_idx):
            return
        
        logger.info(f"Timeout for player {current_player_idx} in room {room_id} - auto-playing")
        
        # Auto-play: play first card with no captures
        hand = game_state.players[current_player_idx]['hand']
        if not hand:
            return
        
        card = hand[0]
        result = game_state.play_card(current_player_idx, card, [])
        
        if result['success']:
            player_id = room_players[room_id][current_player_idx]
            
            db.record_move(room_id, game_state.round_number, player_id,
                          card.code, [], result['is_chkobba'], result['is_haya'])
            
            # Check if round ended
            round_ended = check_round_end(room_id)
            
            if not round_ended:
                game_state.next_turn()
                
                socketio.emit('card_played', {
                    'player_id': player_id,
                    'player_index': current_player_idx,
                    'card': card.code,
                    'captured': [],
                    'is_chkobba': result['is_chkobba'],
                    'is_haya': result['is_haya'],
                    'new_cards_dealt': result.get('new_cards_dealt', False),
                    'next_turn_player': game_state.current_player,
                    'game_state': game_state.to_dict(),
                    'auto_played': True
                }, room=f'room_{room_id}')
                
                logger.info(f"Auto-played for player {current_player_idx}")
                
                # Process next turn
                process_next_turn(room_id)
    
    # Cancel existing timer if any
    if room_id in turn_timers:
        turn_timers[room_id].cancel()
    
    # Start new timer
    timer = threading.Timer(10.0, timeout_handler)
    timer.daemon = True
    timer.start()
    turn_timers[room_id] = timer


def process_next_turn(room_id):
    """Process turn change and trigger AI/timer as needed"""
    game_state = active_games.get(room_id)
    if not game_state:
        return
    
    current_player_idx = game_state.current_player
    
    # Check if game ended
    if game_state.is_finished:
        socketio.emit('game_ended', {
            'winner_id': game_state.winner,
            'final_scores': {i: p['score'] for i, p in enumerate(game_state.players)}
        }, room=f'room_{room_id}')
        return
    
    # If current player is AI, trigger AI move
    if is_ai_player(room_id, current_player_idx):
        trigger_ai_turn(room_id)
    else:
        # Start timeout timer for human player
        start_turn_timer(room_id)


# ========== HTTP Routes ========== 

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/room/create', methods=['POST'])
def create_room():
    data = request.json
    player_name = data.get('player_name', '').strip()
    num_players = data.get('num_players', 2)
    game_mode = data.get('game_mode', '1v1_ai')
    target_score = data.get('target_score', 21)  # Default to 21
    
    if not player_name or len(player_name) > 20:
        return jsonify({'error': 'Invalid player name'}), 400
    
    if num_players < 2 or num_players > 4:
        return jsonify({'error': 'Game must have 2-4 players'}), 400
    
    if target_score not in [11, 21]:
        return jsonify({'error': 'Target score must be 11 or 21'}), 400
    
    room_code = generate_room_code()
    while db.get_room_by_code(room_code):
        room_code = generate_room_code()
    
    room_id = db.create_room(room_code, player_name, game_mode, num_players)
    session_token = generate_session_token()
    player_id = db.add_player(room_id, player_name, is_ai=False, session_token=session_token)
    
    active_games[room_id] = GameState(num_players)
    room_players[room_id] = [player_id]
    player_id_to_index[room_id] = {player_id: 0}
    ai_players[room_id] = {}
    room_settings[room_id] = {'target_score': target_score}
    
    if 'ai' in game_mode.lower():
        ai_difficulty = 'medium'
        ai_count = num_players - 1
        
        for i in range(ai_count):
            ai_name = f"AI-Bot-{i+1}"
            ai_player_id = db.add_player(room_id, ai_name, is_ai=True, 
                                         ai_difficulty=ai_difficulty, session_token=None)
            room_players[room_id].append(ai_player_id)
            player_id_to_index[room_id][ai_player_id] = i + 1
            ai_players[room_id][i + 1] = AIPlayer(ai_difficulty)
        
        logger.info(f"Created AI game room {room_code} with {ai_count} AI players")
    
    logger.info(f"Created room {room_code} (ID: {room_id}) with player {player_name}, target score: {target_score}")
    
    return jsonify({
        'room_code': room_code,
        'room_id': room_id,
        'player_id': player_id,
        'player_index': 0,
        'session_token': session_token,
        'target_score': target_score,
        'status': 'ready' if 'ai' in game_mode.lower() else 'waiting'
    })

@app.route('/api/room/join', methods=['POST'])
def join_room_endpoint():
    data = request.json
    room_code = data.get('room_code', '').upper().strip()
    player_name = data.get('player_name', '').strip()
    ai_difficulty = data.get('ai_difficulty')
    
    if not room_code or not player_name:
        return jsonify({'error': 'Missing room code or player name'}), 400
    
    room = db.get_room_by_code(room_code)
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    room_id = room['id']
    player_count = db.get_player_count(room_id)
    
    if player_count >= room['num_players']:
        return jsonify({'error': 'Room is full'}), 400
    
    if room['status'] != 'waiting':
        return jsonify({'error': 'Game already started'}), 400
    
    is_ai = ai_difficulty is not None
    session_token = generate_session_token()
    player_id = db.add_player(room_id, player_name, is_ai=is_ai, 
                             ai_difficulty=ai_difficulty, session_token=session_token)
    
    if room_id not in room_players:
        room_players[room_id] = []
    if room_id not in player_id_to_index:
        player_id_to_index[room_id] = {}
    if room_id not in ai_players:
        ai_players[room_id] = {}
    
    game_index = len(room_players[room_id])
    room_players[room_id].append(player_id)
    player_id_to_index[room_id][player_id] = game_index
    
    if is_ai:
        ai_players[room_id][game_index] = AIPlayer(ai_difficulty)
    
    players = db.get_players_by_room(room_id)
    
    socketio.emit('player_update', {
        'action': 'joined',
        'player': {
            'id': player_id,
            'name': player_name,
            'is_ai': is_ai
        },
        'players': [
            {'id': p['id'], 'name': p['player_name'], 'is_ai': bool(p['is_ai'])}
            for p in players
        ],
        'total_players': len(players),
        'required_players': room['num_players']
    }, room=f'room_{room_id}')
    
    logger.info(f"Player {player_name} joined room {room_code} at index {game_index}")
    
    return jsonify({
        'room_id': room_id,
        'player_id': player_id,
        'player_index': game_index,
        'session_token': session_token,
        'players': [
            {'id': p['id'], 'name': p['player_name'], 'is_ai': bool(p['is_ai'])}
            for p in players
        ],
        'status': 'joined'
    })

@app.route('/api/room/<room_code>', methods=['GET'])
def get_room_status(room_code):
    room = db.get_room_by_code(room_code.upper())
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    room_id = room['id']
    players = db.get_players_by_room(room_id)
    game_session = db.get_game_session(room_id)
    
    return jsonify({
        'room_code': room_code.upper(),
        'status': room['status'],
        'game_mode': room['game_mode'],
        'num_players': room['num_players'],
        'target_score': room_settings.get(room_id, {}).get('target_score', 21),
        'players': [
            {
                'id': p['id'],
                'name': p['player_name'],
                'is_ai': bool(p['is_ai']),
                'status': p['status']
            }
            for p in players
        ],
        'game_state': json.loads(game_session['game_state']) if game_session else None
    })

@app.route('/api/room/reconnect', methods=['POST'])
def reconnect():
    data = request.json
    session_token = data.get('session_token')
    
    if not session_token:
        return jsonify({'error': 'Missing session token'}), 400
    
    player = db.get_player_by_token(session_token)
    if not player:
        return jsonify({'error': 'Invalid session token'}), 401
    
    room_id = player['room_id']
    room = db.get_room_by_id(room_id)
    player_index = get_player_game_index(room_id, player['id'])
    
    db.update_player_status(player['id'], 'connected')
    
    logger.info(f"Player {player['player_name']} reconnected to room {room['room_code']}")
    
    return jsonify({
        'room_code': room['room_code'],
        'room_id': room_id,
        'player_id': player['id'],
        'player_index': player_index,
        'target_score': room_settings.get(room_id, {}).get('target_score', 21),
        'game_state': active_games.get(room_id).to_dict() if room_id in active_games else None,
        'status': 'reconnected'
    })

@app.route('/api/settings/theme', methods=['GET'])
def get_theme():
    settings = db.get_settings()
    return jsonify({
        'card_theme': settings['card_theme'],
        'board_theme': settings['board_theme']
    })

@app.route('/api/admin/theme/set', methods=['POST'])
def set_theme():
    data = request.json
    card_theme = data.get('card_theme')
    board_theme = data.get('board_theme')
    
    db.update_settings(card_theme=card_theme, board_theme=board_theme)
    return jsonify({'status': 'ok'})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    settings = db.get_settings()
    return jsonify({
        'card_theme': settings['card_theme'],
        'board_theme': settings['board_theme'],
        'bg_music_enabled': bool(settings['bg_music_enabled']),
        'sound_effects_enabled': bool(settings['sound_effects_enabled'])
    })

# ========== WebSocket Events ==========

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connection_response', {'data': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('join_game')
def handle_join_game(data):
    room_code = data.get('room_code')
    session_token = data.get('session_token')
    
    player = db.get_player_by_token(session_token)
    if not player:
        emit('error', {'message': 'Invalid session token'})
        return
    
    room_id = player['room_id']
    player_id = player['id']
    player_index = get_player_game_index(room_id, player_id)
    
    join_room(f'room_{room_id}')
    
    active_sessions[session_token] = {
        'room_id': room_id,
        'player_id': player_id,
        'game_index': player_index,
        'socket_id': request.sid
    }
    
    players = db.get_players_by_room(room_id)
    room = db.get_room_by_id(room_id)
    
    game_state = active_games.get(room_id)
    if game_state:
        emit('game_state_update', {
            'game_state': game_state.to_dict(),
            'your_index': player_index
        })
    
    emit('player_list', {
        'players': [
            {'id': p['id'], 'name': p['player_name'], 'is_ai': bool(p['is_ai'])}
            for p in players
        ],
        'total_players': len(players),
        'required_players': room['num_players']
    })
    
    logger.info(f"Player {player['player_name']} joined WebSocket room {room_code}")

@socketio.on('play_card')
def handle_play_card(data):
    session_token = data.get('session_token')
    card_code = data.get('card')
    captured_codes = data.get('captured_cards', [])
    
    session_info = active_sessions.get(session_token)
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    player_index = session_info['game_index']
    
    if room_id in turn_timers:
        turn_timers[room_id].cancel()
    
    game_state = active_games.get(room_id)
    if not game_state:
        emit('error', {'message': 'Game not found'})
        return
    
    try:
        card = Card.from_code(card_code)
        captured = [Card.from_code(c) for c in captured_codes]
    except ValueError as e:
        emit('error', {'message': f'Invalid card: {str(e)}'})
        return
    
    result = game_state.play_card(player_index, card, captured)
    
    if result['success']:
        db.record_move(room_id, game_state.round_number, session_info['player_id'], 
                      card_code, captured_codes, result['is_chkobba'], result['is_haya'])
        
        # Check if round ended
        round_ended = check_round_end(room_id)
        
        if not round_ended:
            game_state.next_turn()
            
            socketio.emit('card_played', {
                'player_id': session_info['player_id'],
                'player_index': player_index,
                'card': card_code,
                'captured': captured_codes,
                'is_chkobba': result['is_chkobba'],
                'is_haya': result['is_haya'],
                'new_cards_dealt': result.get('new_cards_dealt', False),
                'next_turn_player': game_state.current_player,
                'game_state': game_state.to_dict()
            }, room=f'room_{room_id}')
            
            logger.info(f"Card played by player_index {player_index}")
            
            process_next_turn(room_id)
    else:
        emit('error', {'message': result['message']})

@socketio.on('start_game')
def handle_start_game(data):
    session_token = data.get('session_token')
    session_info = active_sessions.get(session_token)
    
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    room = db.get_room_by_id(room_id)
    
    player_count = db.get_player_count(room_id)
    if player_count < room['num_players']:
        emit('error', {'message': f'Waiting for players ({player_count}/{room["num_players"]})'})
        return
    
    if room_id not in active_games:
        active_games[room_id] = GameState(room['num_players'])
    
    current_game_state = active_games[room_id]
    
    db.create_game_session(room_id, current_game_state.to_dict())
    db.update_room_status(room_id, 'started')
    
    target_score = room_settings.get(room_id, {}).get('target_score', 21)
    
    socketio.emit('game_started', {
        'game_state': current_game_state.to_dict(),
        'first_player': current_game_state.current_player,
        'target_score': target_score,
        'player_mapping': player_id_to_index.get(room_id, {})
    }, room=f'room_{room_id}')
    
    logger.info(f"Game started in room {room_id} with {player_count} players, target score: {target_score}")
    
    process_next_turn(room_id)

@socketio.on('continue_game')
def handle_continue_game(data):
    """Handle continue to next round after round summary"""
    session_token = data.get('session_token')
    session_info = active_sessions.get(session_token)
    
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    game_state = active_games.get(room_id)
    
    if not game_state:
        emit('error', {'message': 'Game not found'})
        return
    
    logger.info(f"Continuing game in room {room_id}, round {game_state.round_number}")
    
    # Broadcast game state update and start next turn
    socketio.emit('game_state_update', {
        'game_state': game_state.to_dict()
    }, room=f'room_{room_id}')
    
    process_next_turn(room_id)

@socketio.on('restart_game')
def handle_restart_game(data):
    """Restart game with same settings"""
    session_token = data.get('session_token')
    session_info = active_sessions.get(session_token)
    
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    room = db.get_room_by_id(room_id)
    
    # Create new game state
    active_games[room_id] = GameState(room['num_players'])
    current_game_state = active_games[room_id]
    
    # Update database
    db.create_game_session(room_id, current_game_state.to_dict())
    
    target_score = room_settings.get(room_id, {}).get('target_score', 21)
    
    logger.info(f"Restarting game in room {room_id}")
    
    # Broadcast restart
    socketio.emit('game_restarted', {
        'game_state': current_game_state.to_dict(),
        'first_player': current_game_state.current_player,
        'target_score': target_score
    }, room=f'room_{room_id}')
    
    process_next_turn(room_id)

@socketio.on('close_room')
def handle_close_room(data):
    """Close the room"""
    session_token = data.get('session_token')
    session_info = active_sessions.get(session_token)
    
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    
    # Cancel any active timers
    if room_id in turn_timers:
        turn_timers[room_id].cancel()
        del turn_timers[room_id]
    
    # Update room status
    db.update_room_status(room_id, 'closed')
    
    # Clean up
    if room_id in active_games:
        del active_games[room_id]
    if room_id in room_players:
        del room_players[room_id]
    if room_id in player_id_to_index:
        del player_id_to_index[room_id]
    if room_id in ai_players:
        del ai_players[room_id]
    if room_id in room_settings:
        del room_settings[room_id]
    
    logger.info(f"Room {room_id} closed")
    
    # Notify all players
    socketio.emit('room_closed', {}, room=f'room_{room_id}')

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info(f"Starting Chkobba Game Server...")
    logger.info(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    logger.info(f"Host: {app.config['HOST']}")
    logger.info(f"Port: {app.config['PORT']}")
    
    socketio.run(
        app,
        host=app.config['HOST'],
        port=app.config['PORT'],
        debug=app.config['DEBUG']
    )
