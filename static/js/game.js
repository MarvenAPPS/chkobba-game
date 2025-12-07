/**
 * Main game flow and interaction logic
 */

// ========== Room Creation ==========

async function createRoom() {
  const playerName = document.getElementById('player-name-create').value.trim();
  const numPlayers = parseInt(document.getElementById('num-players').value);
  const gameMode = document.getElementById('game-mode').value;
  
  if (!playerName) {
    showError('Please enter your name');
    return;
  }
  
  try {
    showInfo('Creating room...');
    const response = await api.post('/api/room/create', {
      player_name: playerName,
      num_players: numPlayers,
      game_mode: gameMode
    });
    
    gameState.room_code = response.room_code;
    gameState.room_id = response.room_id;
    gameState.player_id = response.player_id;
    gameState.player_index = response.player_index || 0;  // Store player index
    gameState.session_token = response.session_token;
    gameState.save();
    
    console.log('Created room, player_index:', gameState.player_index);
    
    // Join room via WebSocket
    emitJoinGame();
    
    // Show room screen
    showScreen('game-room');
    document.getElementById('room-code-display').textContent = response.room_code;
    updatePlayersList();
    
    showSuccess(`Room created: ${response.room_code}`);
  } catch (error) {
    showError(`Failed to create room: ${error.message}`);
  }
}

// ========== Room Joining ==========

async function joinRoom() {
  const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
  const playerName = document.getElementById('player-name-join').value.trim();
  
  if (!roomCode || !playerName) {
    showError('Please enter room code and name');
    return;
  }
  
  try {
    showInfo('Joining room...');
    const response = await api.post('/api/room/join', {
      room_code: roomCode,
      player_name: playerName,
      ai_difficulty: null
    });
    
    gameState.room_code = roomCode;
    gameState.room_id = response.room_id;
    gameState.player_id = response.player_id;
    gameState.player_index = response.player_index;  // Store player index
    gameState.session_token = response.session_token;
    gameState.players = response.players.map(p => ({
      id: p.id,
      name: p.name,
      is_ai: p.is_ai
    }));
    gameState.save();
    
    console.log('Joined room, player_index:', gameState.player_index);
    
    // Join room via WebSocket
    emitJoinGame();
    
    // Show room screen
    showScreen('game-room');
    document.getElementById('room-code-display').textContent = roomCode;
    updatePlayersList();
    
    showSuccess(`Joined room: ${roomCode}`);
  } catch (error) {
    showError(`Failed to join room: ${error.message}`);
  }
}

// ========== Game Flow ==========

async function startGame() {
  if (!gameState.session_token) {
    showError('No active session');
    return;
  }
  
  try {
    showInfo('Starting game...');
    emitStartGame();
  } catch (error) {
    showError(`Failed to start game: ${error.message}`);
  }
}

function leaveRoom() {
  if (confirm('Are you sure you want to leave the room?')) {
    gameState.reset();
    gameState.save();
    showMainMenu();
  }
}

function leaveGame() {
  if (confirm('Are you sure you want to leave the game?')) {
    timerManager.stop();
    gameState.reset();
    gameState.save();
    showMainMenu();
  }
}

// ========== Form Interactions ==========

document.addEventListener('DOMContentLoaded', () => {
  // Create room form
  const createForm = document.getElementById('create-room-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createRoom();
    });
  }
  
  // Join room form
  const joinForm = document.getElementById('join-room-form');
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await joinRoom();
    });
  }
  
  // Enter to submit forms
  document.getElementById('player-name-create')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createForm?.dispatchEvent(new Event('submit'));
  });
  
  document.getElementById('player-name-join')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinForm?.dispatchEvent(new Event('submit'));
  });
  
  document.getElementById('room-code')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinForm?.dispatchEvent(new Event('submit'));
  });
});

// ========== Auto-play on Timeout ==========

function autoPlay() {
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  
  if (!isMyTurn) return;
  if (!gameState.player_hand.length) return;
  
  // Simple strategy: play first card
  const card = gameState.player_hand[0];
  emitPlayCard(card, []);
}

// ========== Reconnection ==========

async function reconnectSession() {
  const token = storage.get('session_token');
  if (!token) return;
  
  try {
    const response = await api.post('/api/room/reconnect', {
      session_token: token
    });
    
    gameState.room_code = response.room_code;
    gameState.room_id = response.room_id;
    gameState.player_id = response.player_id;
    gameState.player_index = response.player_index;  // Restore player index
    gameState.session_token = token;
    
    if (response.game_state) {
      showScreen('game-screen');
      updateGameBoard(response.game_state);
    }
    
    showSuccess('Reconnected to game');
  } catch (error) {
    console.log('Reconnection failed:', error);
    gameState.reset();
  }
}

// Try to reconnect on load
window.addEventListener('load', () => {
  reconnectSession();
});

// Handle window visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && gameState.room_code) {
    // Resume game when tab becomes visible
    if (timerManager.isRunning) {
      timerManager.resume();
    }
  } else {
    // Pause timer when tab hidden
    if (timerManager.isRunning) {
      timerManager.pause();
    }
  }
});

// Save game state periodically
setInterval(() => {
  gameState.save();
}, 5000);
