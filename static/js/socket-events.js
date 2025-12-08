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

// ========== Game Events ==========

socket.on('game_started', (data) => {
  console.log('Game started:', data);
  gameState.game_status = 'active';
  
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
  console.log('Round ended:', data);
  
  // PAUSE GAME - stop timer and disable interactions
  timerManager.stop();
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.disabled = true;
  
  // Update scores
  gameState.scores = data.scores;
  gameState.chkobba_count = data.chkobba_count;
  updateScoreboard();
  
  // Show round summary with detailed scoring
  if (data.round_scores) {
    showRoundSummary(data.round_scores, data.scoring_details);
  } else {
    showInfo('🏁 Round ended!');
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

// ========== Round Summary Display ==========

function showRoundSummary(roundScores, scoringDetails) {
  let summaryHtml = '<div class="round-summary"><h3>🏆 Round Complete!</h3>';
  
  // Show each player's round performance
  gameState.players.forEach((player, idx) => {
    const score = roundScores[idx] || 0;
    const details = scoringDetails?.[idx] || {};
    
    summaryHtml += `
      <div class="player-round-score">
        <strong>${player.name}:</strong> ${score} points
        <ul class="scoring-breakdown">
    `;
    
    if (details.most_cards) summaryHtml += '<li>✅ Most Cards (1pt)</li>';
    if (details.most_diamonds) summaryHtml += '<li>✅ Most Diamonds (1pt)</li>';
    if (details.haya) summaryHtml += '<li>✅ 7 of Diamonds - Haya (1pt)</li>';
    if (details.dinari) summaryHtml += '<li>✅ 7 of Clubs - Dinari (1pt)</li>';
    if (details.chkobba_count > 0) {
      summaryHtml += `<li>✅ ${details.chkobba_count} Chkobba (${details.chkobba_count}pt)</li>`;
    }
    
    summaryHtml += '</ul></div>';
  });
  
  summaryHtml += '</div>';
  
  showInfo(summaryHtml, 5000); // Show for 5 seconds
}
