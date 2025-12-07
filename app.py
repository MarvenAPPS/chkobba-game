import os
import uuid
import json
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
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory game sessions
active_games = {}  # room_id -> GameState
active_sessions = {}  # session_token -> {room_id, player_id, socket_id, game_index}
room_players = {}  # room_id -> [player_ids] (ordered by join)
player_id_to_index = {}  # room_id -> {player_id: game_index}


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


# ========== HTTP Routes ==========

@app.route('/')
def index():
    """Main game page"""
    return render_template('index.html')


@app.route('/admin')
def admin():
    """Admin panel for theme/sound management"""
    return render_template('admin.html')


@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})


# ========== Room Management Endpoints ==========

@app.route('/api/room/create', methods=['POST'])
def create_room():
    """Create new game room"""
    data = request.json
    player_name = data.get('player_name', '').strip()
    num_players = data.get('num_players', 2)
    game_mode = data.get('game_mode', '1v1_ai')
    
    if not player_name or len(player_name) > 20:
        return jsonify({'error': 'Invalid player name'}), 400
    
    if num_players < 2 or num_players > 4:
        return jsonify({'error': 'Game must have 2-4 players'}), 400
    
    # Generate unique room code
    room_code = generate_room_code()
    while db.get_room_by_code(room_code):
        room_code = generate_room_code()
    
    # Create room in database
    room_id = db.create_room(room_code, player_name, game_mode, num_players)
    
    # Create session token
    session_token = generate_session_token()
    
    # Add player to room
    player_id = db.add_player(room_id, player_name, is_ai=False, session_token=session_token)
    
    # Initialize game state
    active_games[room_id] = GameState(num_players)
    room_players[room_id] = [player_id]
    player_id_to_index[room_id] = {player_id: 0}  # First player is index 0
    
    # Auto-add AI players if it's an AI game mode
    if 'ai' in game_mode.lower():
        ai_difficulty = 'medium'  # Default AI difficulty
        ai_count = num_players - 1  # All other players are AI
        
        for i in range(ai_count):
            ai_name = f"AI-Bot-{i+1}"
            ai_player_id = db.add_player(room_id, ai_name, is_ai=True, 
                                         ai_difficulty=ai_difficulty, session_token=None)
            room_players[room_id].append(ai_player_id)
            player_id_to_index[room_id][ai_player_id] = i + 1  # Subsequent indices
        
        logger.info(f"Created AI game room {room_code} with {ai_count} AI players")
    
    logger.info(f"Created room {room_code} (ID: {room_id}) with player {player_name}")
    
    return jsonify({
        'room_code': room_code,
        'room_id': room_id,
        'player_id': player_id,
        'player_index': 0,  # Return game index
        'session_token': session_token,
        'status': 'ready' if 'ai' in game_mode.lower() else 'waiting'
    })


@app.route('/api/room/join', methods=['POST'])
def join_room_endpoint():
    """Join existing game room"""
    data = request.json
    room_code = data.get('room_code', '').upper().strip()
    player_name = data.get('player_name', '').strip()
    ai_difficulty = data.get('ai_difficulty')
    
    if not room_code or not player_name:
        return jsonify({'error': 'Missing room code or player name'}), 400
    
    # Find room
    room = db.get_room_by_code(room_code)
    if not room:
        return jsonify({'error': 'Room not found'}), 404
    
    room_id = room['id']
    player_count = db.get_player_count(room_id)
    
    if player_count >= room['num_players']:
        return jsonify({'error': 'Room is full'}), 400
    
    if room['status'] != 'waiting':
        return jsonify({'error': 'Game already started'}), 400
    
    # Add player
    is_ai = ai_difficulty is not None
    session_token = generate_session_token()
    player_id = db.add_player(room_id, player_name, is_ai=is_ai, 
                             ai_difficulty=ai_difficulty, session_token=session_token)
    
    if room_id not in room_players:
        room_players[room_id] = []
    if room_id not in player_id_to_index:
        player_id_to_index[room_id] = {}
    
    game_index = len(room_players[room_id])
    room_players[room_id].append(player_id)
    player_id_to_index[room_id][player_id] = game_index
    
    # Get all players in room
    players = db.get_players_by_room(room_id)
    
    # Broadcast player joined to all in room via WebSocket
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
    """Get room status and players"""
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
    """Reconnect player to game using session token"""
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
        'game_state': active_games.get(room_id).to_dict() if room_id in active_games else None,
        'status': 'reconnected'
    })


# ========== Settings & Admin Endpoints ==========

@app.route('/api/settings/theme', methods=['GET'])
def get_theme():
    """Get current theme settings"""
    settings = db.get_settings()
    return jsonify({
        'card_theme': settings['card_theme'],
        'board_theme': settings['board_theme']
    })


@app.route('/api/admin/theme/set', methods=['POST'])
def set_theme():
    """Set theme"""
    data = request.json
    card_theme = data.get('card_theme')
    board_theme = data.get('board_theme')
    
    db.update_settings(card_theme=card_theme, board_theme=board_theme)
    return jsonify({'status': 'ok'})


@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings"""
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
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connection_response', {'data': 'Connected to server'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")


@socketio.on('join_game')
def handle_join_game(data):
    """Join game room via WebSocket"""
    room_code = data.get('room_code')
    session_token = data.get('session_token')
    
    player = db.get_player_by_token(session_token)
    if not player:
        emit('error', {'message': 'Invalid session token'})
        return
    
    room_id = player['room_id']
    player_index = get_player_game_index(room_id, player['id'])
    
    join_room(f'room_{room_id}')
    
    active_sessions[session_token] = {
        'room_id': room_id,
        'player_id': player['id'],
        'game_index': player_index,
        'socket_id': request.sid
    }
    
    # Get all players in room
    players = db.get_players_by_room(room_id)
    room = db.get_room_by_id(room_id)
    
    # Send current game state if game started
    game_state = active_games.get(room_id)
    if game_state:
        emit('game_state_update', {
            'game_state': game_state.to_dict(),
            'your_index': player_index
        })
    
    # Send current player list to the joining player
    emit('player_list', {
        'players': [
            {'id': p['id'], 'name': p['player_name'], 'is_ai': bool(p['is_ai'])}
            for p in players
        ],
        'total_players': len(players),
        'required_players': room['num_players']
    })
    
    # Notify others in room about new player
    emit('player_update', {
        'action': 'connected',
        'player': {
            'id': player['id'],
            'name': player['player_name'],
            'is_ai': bool(player['is_ai'])
        },
        'players': [
            {'id': p['id'], 'name': p['player_name'], 'is_ai': bool(p['is_ai'])}
            for p in players
        ],
        'total_players': len(players),
        'required_players': room['num_players']
    }, room=f'room_{room_id}', include_self=False)


@socketio.on('play_card')
def handle_play_card(data):
    """Handle card play"""
    session_token = data.get('session_token')
    card_code = data.get('card')
    captured_codes = data.get('captured_cards', [])
    
    session_info = active_sessions.get(session_token)
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    player_index = session_info['game_index']  # Use game index, not DB player_id
    
    game_state = active_games.get(room_id)
    if not game_state:
        emit('error', {'message': 'Game not found'})
        return
    
    # Parse card and captured cards
    try:
        card = Card.from_code(card_code)
        captured = [Card.from_code(c) for c in captured_codes]
    except ValueError as e:
        emit('error', {'message': f'Invalid card: {str(e)}'})
        return
    
    # Play card using game index
    result = game_state.play_card(player_index, card, captured)
    
    if result['success']:
        # Update database
        db.record_move(room_id, game_state.round_number, session_info['player_id'], 
                      card_code, captured_codes, result['is_chkobba'], result['is_haya'])
        
        # Move to next turn
        game_state.next_turn()
        
        # Broadcast to room with full game state
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
        
        logger.info(f"Card played by player_index {player_index}, new cards dealt: {result.get('new_cards_dealt', False)}")
    else:
        emit('error', {'message': result['message']})


@socketio.on('start_game')
def handle_start_game(data):
    """Start game"""
    session_token = data.get('session_token')
    session_info = active_sessions.get(session_token)
    
    if not session_info:
        emit('error', {'message': 'Invalid session'})
        return
    
    room_id = session_info['room_id']
    room = db.get_room_by_id(room_id)
    
    # Check if all players present
    player_count = db.get_player_count(room_id)
    if player_count < room['num_players']:
        emit('error', {'message': f'Waiting for players ({player_count}/{room["num_players"]})'}) 
        return
    
    # Get or create game state
    if room_id not in active_games:
        active_games[room_id] = GameState(room['num_players'])
    
    current_game_state = active_games[room_id]
    
    # Create game session in database
    db.create_game_session(room_id, current_game_state.to_dict())
    db.update_room_status(room_id, 'started')
    
    # Broadcast game start with player indices
    socketio.emit('game_started', {
        'game_state': current_game_state.to_dict(),
        'first_player': current_game_state.current_player,
        'player_mapping': player_id_to_index.get(room_id, {})
    }, room=f'room_{room_id}')
    
    logger.info(f"Game started in room {room_id} with {player_count} players")


# ========== Error Handlers ==========

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500


# ========== Application Startup ==========

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
