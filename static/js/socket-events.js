/**
 * WebSocket (Socket.IO) event handlers
 */

const socket = io();

// ========== Connection Events ==========

socket.on('connect', () => {
  console.log('Connected to server');
  showSuccess('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  showError('Disconnected from server');
});

socket.on('connection_response', (data) => {
  console.log('Connection response:', data);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  showError(error.message || 'Connection error');
});

// ========== Room Events ==========

socket.on('player_joined', (data) => {
  console.log('Player joined:', data);
  updatePlayersList();
  showInfo(`${data.player_name} joined the room`);
});

socket.on('player_update', (data) => {
  console.log('Player update:', data);
  if (data.players) {
    gameState.players = data.players;
  }
  updatePlayersList();
  
  if (data.action === 'joined') {
    showInfo(`${data.player.name} joined the room`);
  }
});

socket.on('player_list', (data) => {
  console.log('Player list received:', data);
  if (data.players) {
    gameState.players = data.players;
    updatePlayersList();
  }
});

socket.on('room_full', (data) => {
  showError('Room is full');
});

socket.on('room_closed', (data) => {
  showInfo('Room has been closed');
  setTimeout(() => {
    window.location.href = '/';
  }, 2000);
});

// ========== Game Events ==========

socket.on('game_started', (data) => {
  console.log('Game started:', data);
  gameState.game_status = 'active';
  
  // Store target score
  if (data.target_score) {
    gameState.target_score = data.target_score;
  }
  
  // Update player index from mapping if provided
  if (data.player_mapping && gameState.player_id) {
    gameState.player_index = data.player_mapping[gameState.player_id];
  }
  
  gameState.save();
  showScreen('game-screen');
  updateGameBoard(data.game_state);
  showInfo('Game started!');
  
  // Play turn sound if it's our turn
  const isMyTurn = data.game_state.current_player === gameState.player_index;
  if (isMyTurn) {
    audioManager.play('turn');
  }
});

socket.on('game_state_update', (data) => {
  console.log('Game state update:', data);
  if (data.your_index !== undefined) {
    gameState.player_index = data.your_index;
  }
  if (data.game_state) {
    updateGameBoard(data.game_state);
  }
});

socket.on('card_played', (data) => {
  console.log('Card played:', data);
  audioManager.play('card_play');
  
  // Update game board with new state
  updateGameBoard(data.game_state);
  
  if (data.new_cards_dealt) {
    showInfo('🎴 New cards dealt!');
  }
  
  if (data.is_chkobba) {
    audioManager.play('chkobba');
    showSuccess('🎉 Chkobba! All cards captured!');
  }
  
  if (data.is_haya) {
    audioManager.play('haya');
    showSuccess('🏆 Haya! 7 of Diamonds captured!');
  }
  
  // Store previous player to detect turn change
  const previousPlayer = gameState.current_player;
  gameState.current_player = data.next_turn_player;
  gameState.save();
  updateCurrentTurn();
  
  // Play turn sound if it's now our turn (and wasn't before)
  const isNowMyTurn = gameState.current_player === gameState.player_index;
  const wasMyTurn = previousPlayer === gameState.player_index;
  if (isNowMyTurn && !wasMyTurn) {
    audioManager.play('turn');
    showInfo('🔔 Your turn!');
  }
});

socket.on('hand_updated', (data) => {
  console.log('Hand updated:', data);
  gameState.player_hand = data.your_hand;
  renderPlayerHand();
});

socket.on('turn_changed', (data) => {
  console.log('Turn changed:', data);
  const previousPlayer = gameState.current_player;
  gameState.current_player = data.current_player_id;
  updateCurrentTurn();
  
  // Play turn sound if it's now our turn
  const isNowMyTurn = gameState.current_player === gameState.player_index;
  const wasMyTurn = previousPlayer === gameState.player_index;
  if (isNowMyTurn && !wasMyTurn) {
    audioManager.play('turn');
    showInfo('🔔 Your turn!');
  }
  
  if (data.timer_start) {
    startTimer(data.timer_start);
  }
});

socket.on('timeout_warning', (data) => {
  console.log('Timeout warning:', data.seconds);
  audioManager.play('timeout');
  showInfo(`⏱️ ${data.seconds} seconds remaining!`);
});

socket.on('auto_played', (data) => {
  console.log('Auto-played:', data);
  showInfo(`Player ${data.player_id} auto-played due to timeout`);
});

socket.on('round_ended', (data) => {
  console.log('=== ROUND ENDED EVENT RECEIVED ===');
  console.log('Full data:', JSON.stringify(data, null, 2));
  
  // PAUSE GAME - stop timer and disable interactions
  timerManager.stop();
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.disabled = true;
  
  // Update scores from backend
  if (data.total_scores) {
    gameState.scores = data.total_scores;
  }
  
  // Update scoreboard
  updateScoreboard();
  
  // Check if showRoundSummary exists
  console.log('Checking for showRoundSummary function...');
  console.log('typeof showRoundSummary:', typeof showRoundSummary);
  console.log('window.showRoundSummary:', typeof window.showRoundSummary);
  
  // Show round summary with all data from backend
  if (typeof showRoundSummary === 'function') {
    console.log('Calling showRoundSummary with parameters:');
    console.log('  round_scores:', data.round_scores);
    console.log('  scoring_details:', data.scoring_details);
    console.log('  player_names:', data.player_names);
    console.log('  total_scores:', data.total_scores);
    console.log('  target_score:', data.target_score || 21);
    console.log('  round_number:', data.round_number);
    
    try {
      showRoundSummary(
        data.round_scores,
        data.scoring_details,
        data.player_names,
        data.total_scores,
        data.target_score || 21,
        data.round_number
      );
      console.log('showRoundSummary called successfully');
    } catch (error) {
      console.error('Error calling showRoundSummary:', error);
      showError('Error displaying round summary: ' + error.message);
    }
  } else if (typeof window.showRoundSummary === 'function') {
    console.log('Using window.showRoundSummary');
    try {
      window.showRoundSummary(
        data.round_scores,
        data.scoring_details,
        data.player_names,
        data.total_scores,
        data.target_score || 21,
        data.round_number
      );
      console.log('window.showRoundSummary called successfully');
    } catch (error) {
      console.error('Error calling window.showRoundSummary:', error);
      showError('Error displaying round summary: ' + error.message);
    }
  } else {
    console.error('showRoundSummary function NOT FOUND!');
    console.error('Available global functions:', Object.keys(window).filter(k => typeof window[k] === 'function').slice(0, 20));
    showError('❌ Round summary function missing - check console');
    showInfo('🏁 Round ended!');
  }
});

socket.on('game_restarted', (data) => {
  console.log('Game restarted:', data);
  
  // Store target score
  if (data.target_score) {
    gameState.target_score = data.target_score;
  }
  
  // Reset game state
  gameState.game_status = 'active';
  gameState.current_player = data.first_player;
  gameState.scores = {};
  gameState.save();
  
  // Update game board
  updateGameBoard(data.game_state);
  updateScoreboard();
  
  showInfo('🔄 Game restarted!');
  
  // Play turn sound if it's our turn
  const isMyTurn = data.game_state.current_player === gameState.player_index;
  if (isMyTurn) {
    audioManager.play('turn');
  }
});

socket.on('game_ended', (data) => {
  console.log('Game ended:', data);
  
  // PAUSE GAME completely
  timerManager.stop();
  gameState.game_status = 'finished';
  
  showGameOver(data);
});

// ========== Player Status Events ==========

socket.on('player_disconnected', (data) => {
  console.log('Player disconnected:', data);
  showInfo(`${data.player_name} disconnected`);
  updatePlayersList();
});

socket.on('player_reconnected', (data) => {
  console.log('Player reconnected:', data);
  showInfo(`${data.player_name} reconnected`);
  updatePlayersList();
});

// ========== Helper Functions ==========

function emitJoinGame() {
  if (!gameState.session_token) return;
  
  socket.emit('join_game', {
    room_code: gameState.room_code,
    session_token: gameState.session_token
  });
}

function emitPlayCard(cardCode, capturedCards) {
  if (!gameState.session_token) return;
  
  socket.emit('play_card', {
    session_token: gameState.session_token,
    card: cardCode,
    captured_cards: capturedCards
  });
}

function emitStartGame() {
  if (!gameState.session_token) return;
  
  socket.emit('start_game', {
    session_token: gameState.session_token
  });
}
