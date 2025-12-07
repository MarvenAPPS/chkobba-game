/**
 * UI rendering and interaction handlers
 */

function renderCard(card, clickable = false, selected = false) {
  const div = document.createElement('div');
  div.className = `card ${selected ? 'selected' : ''}`;
  div.dataset.card = card;
  
  const [rank, suit] = [card.charAt(0), card.charAt(1)];
  div.innerHTML = `${rank}<span>${getCardSuitSymbol(suit)}</span>`;
  
  if (clickable) {
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => selectCard(card));
  }
  
  return div;
}

function renderTableCards() {
  const container = document.getElementById('table-cards');
  if (!container) return;
  
  container.innerHTML = '';
  gameState.table_cards.forEach(card => {
    container.appendChild(renderCard(card, false, false));
  });
}

function renderPlayerHand() {
  const container = document.getElementById('player-hand');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!gameState.player_hand || gameState.player_hand.length === 0) {
    container.innerHTML = '<p class="no-cards">No cards in hand</p>';
    return;
  }
  
  gameState.player_hand.forEach(card => {
    const isSelected = gameState.selected_card === card || gameState.captured_cards.includes(card);
    container.appendChild(renderCard(card, true, isSelected));
  });
}

function updatePlayersList() {
  const container = document.getElementById('players-list');
  if (!container) return;
  
  container.innerHTML = '';
  gameState.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <span class="player-name">${player.name} ${player.is_ai ? '(AI)' : ''}</span>
      <span class="player-status">${player.status || 'waiting'}</span>
    `;
    container.appendChild(div);
  });
}

function updateScoreboard() {
  const container = document.getElementById('scores-display');
  if (!container) return;
  
  container.innerHTML = '';
  gameState.players.forEach((player, idx) => {
    const score = gameState.scores[idx] || 0;
    const chkobba = gameState.chkobba_count[idx] || 0;
    const isCurrent = gameState.current_player === idx;
    
    const div = document.createElement('div');
    div.className = `score-item ${isCurrent ? 'current' : ''}`;
    div.innerHTML = `
      <div class="score-name">${player.name}</div>
      <div class="score-value">${score}</div>
    `;
    container.appendChild(div);
  });
}

function updateGameBoard(state) {
  console.log('Updating game board with state:', state);
  console.log('Player index:', gameState.player_index);
  
  // Update table cards
  gameState.table_cards = state.table || [];
  
  // Update scores
  gameState.scores = {};
  gameState.chkobba_count = {};
  
  if (state.players && Array.isArray(state.players)) {
    state.players.forEach((player, idx) => {
      gameState.scores[idx] = player.score || 0;
      gameState.chkobba_count[idx] = player.chkobba_count || 0;
      
      // Update player hand if this is the current player (use player_index not player_id)
      if (idx === gameState.player_index || idx === gameState.player_id) {
        gameState.player_hand = player.hand || [];
        console.log(`Updated hand for player index ${idx}:`, gameState.player_hand);
      }
    });
  }
  
  // Update current player
  if (state.current_player !== undefined) {
    gameState.current_player = state.current_player;
  }
  
  // Re-render all UI components
  renderTableCards();
  renderPlayerHand();
  updateScoreboard();
  updateCurrentTurn();
  
  console.log('Game board updated:', {
    table: gameState.table_cards.length,
    hand: gameState.player_hand.length,
    deck_remaining: state.deck_remaining,
    current_player: gameState.current_player
  });
}

function updateCurrentTurn() {
  const currentPlayerName = gameState.players[gameState.current_player]?.name || 'Unknown';
  const el = document.getElementById('current-player-name');
  if (el) {
    el.textContent = `Current: ${currentPlayerName}`;
  }
  
  // Check if it's our turn (use player_index)
  const isMyTurn = (gameState.current_player === gameState.player_index) || 
                   (gameState.current_player === gameState.player_id);
  
  // Disable play button if not our turn
  const playBtn = document.getElementById('play-btn');
  if (playBtn) {
    playBtn.disabled = !isMyTurn || !gameState.selected_card;
  }
}

function selectCard(card) {
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
                   
  if (!isMyTurn) {
    showError('Not your turn');
    return;
  }
  
  // Toggle selection
  if (gameState.selected_card === card) {
    gameState.selected_card = null;
  } else {
    gameState.selected_card = card;
  }
  
  renderPlayerHand();
  updatePlayButton();
}

function selectCapturedCard(card) {
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
                   
  if (!isMyTurn) {
    return;
  }
  
  const idx = gameState.captured_cards.indexOf(card);
  if (idx >= 0) {
    gameState.captured_cards.splice(idx, 1);
  } else {
    gameState.captured_cards.push(card);
  }
  
  renderTableCards();
  updatePlayButton();
}

function clearSelection() {
  gameState.selected_card = null;
  gameState.captured_cards = [];
  renderPlayerHand();
  renderTableCards();
  updatePlayButton();
}

function updatePlayButton() {
  const btn = document.getElementById('play-btn');
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  
  if (btn) {
    btn.disabled = !gameState.selected_card || !isMyTurn;
  }
}

function playCard() {
  if (!gameState.selected_card) {
    showError('Select a card to play');
    return;
  }
  
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  
  if (!isMyTurn) {
    showError('Not your turn');
    return;
  }
  
  emitPlayCard(gameState.selected_card, gameState.captured_cards);
  clearSelection();
}

function showGameOver(data) {
  showScreen('game-over');
  
  const winnerEl = document.getElementById('winner-info');
  if (winnerEl) {
    const winner = gameState.players[data.winner_id];
    winnerEl.innerHTML = `
      <h2>${winner?.name || 'Unknown'} Won!</h2>
      <p>Final Score: ${data.final_scores[data.winner_id]} points</p>
    `;
  }
  
  const scoresEl = document.getElementById('final-scores');
  if (scoresEl) {
    scoresEl.innerHTML = '';
    Object.entries(data.final_scores || {}).forEach(([playerId, score]) => {
      const player = gameState.players[parseInt(playerId)];
      if (player) {
        const div = document.createElement('div');
        div.className = 'final-score-item';
        div.innerHTML = `
          <span>${player.name}</span>
          <span>${score} points</span>
        `;
        scoresEl.appendChild(div);
      }
    });
  }
}

function loadSettings() {
  fetch('/api/settings')
    .then(r => r.json())
    .then(data => {
      document.getElementById('card-theme').value = data.card_theme || 'classic';
      document.getElementById('board-theme').value = data.board_theme || 'classic';
      document.getElementById('bg-music').checked = data.bg_music_enabled;
      document.getElementById('sound-effects').checked = data.sound_effects_enabled;
    })
    .catch(err => console.error('Error loading settings:', err));
}

// Event Listeners
document.getElementById('create-room-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await createRoom();
});

document.getElementById('join-room-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await joinRoom();
});

// Settings form
document.getElementById('card-theme')?.addEventListener('change', (e) => {
  settings.cardTheme = e.target.value;
  saveSettings();
});

document.getElementById('board-theme')?.addEventListener('change', (e) => {
  settings.boardTheme = e.target.value;
  saveSettings();
});

document.getElementById('bg-music')?.addEventListener('change', (e) => {
  settings.bgMusicEnabled = e.target.checked;
  saveSettings();
});

document.getElementById('sound-effects')?.addEventListener('change', (e) => {
  settings.soundEffectsEnabled = e.target.checked;
  saveSettings();
});

function saveSettings() {
  settings.save();
}
