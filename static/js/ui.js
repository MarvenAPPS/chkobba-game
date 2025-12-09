/**
 * UI rendering and interaction handlers
 */

function renderCard(card, clickable = false, selected = false, capturable = false) {
  const div = document.createElement('div');
  div.className = `card ${selected ? 'selected' : ''} ${capturable ? 'capturable' : ''}`;
  div.dataset.card = card;
  
  const [rank, suit] = [card.charAt(0), card.charAt(1)];
  div.innerHTML = `${rank}<span>${getCardSuitSymbol(suit)}</span>`;
  
  if (clickable) {
    div.style.cursor = 'pointer';
  }
  
  return div;
}

function renderTableCards() {
  const container = document.getElementById('table-cards');
  if (!container) return;
  
  container.innerHTML = '';
  
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  
  // Find capturable cards if a hand card is selected
  const capturableCards = isMyTurn && gameState.selected_card ? 
    findCapturableCards(gameState.selected_card, gameState.table_cards) : [];
  
  gameState.table_cards.forEach(card => {
    const isSelected = gameState.captured_cards.includes(card);
    const isCapturable = capturableCards.includes(card);
    const cardEl = renderCard(card, isMyTurn, isSelected, isCapturable);
    
    if (isMyTurn) {
      cardEl.addEventListener('click', () => toggleCapturedCard(card));
    }
    
    container.appendChild(cardEl);
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
    const isSelected = gameState.selected_card === card;
    const cardEl = renderCard(card, true, isSelected, false);
    
    // Single click to select
    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      selectCard(card);
    });
    
    // FIXED: Double click to auto-play with proper event parameter
    cardEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Double-click detected on card:', card);
      selectCard(card);
      setTimeout(() => {
        console.log('Auto-playing after double-click');
        playCard();
      }, 100);
    });
    
    container.appendChild(cardEl);
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
      <div class="score-value">${score} <small>(Chk: ${chkobba})</small></div>
    `;
    container.appendChild(div);
  });
}

function updateDeckDisplay(deckRemaining) {
  const deckCountEl = document.getElementById('deck-count');
  if (deckCountEl) {
    deckCountEl.textContent = deckRemaining;
  }
  
  // Update deck visual (hide cards as deck empties)
  const deckCards = document.querySelectorAll('.deck-card');
  if (deckRemaining === 0) {
    deckCards.forEach(card => card.style.opacity = '0');
  } else if (deckRemaining <= 10) {
    if (deckCards[2]) deckCards[2].style.opacity = '0';
  } else if (deckRemaining <= 20) {
    if (deckCards[1]) deckCards[1].style.opacity = '0.5';
  }
}

function updateTurnsRemaining(deckRemaining, numPlayers) {
  const turnsEl = document.getElementById('turns-remaining');
  if (!turnsEl) return;
  
  // Each player gets 3 cards per deal
  // Turns = (deck / (numPlayers * 3)) * numPlayers
  const dealsRemaining = Math.floor(deckRemaining / (numPlayers * 3));
  const turnsRemaining = dealsRemaining * numPlayers;
  
  turnsEl.textContent = `Turns: ${turnsRemaining}`;
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
  
  // Update deck display and turns counter
  if (state.deck_remaining !== undefined) {
    updateDeckDisplay(state.deck_remaining);
    updateTurnsRemaining(state.deck_remaining, gameState.players.length);
  }
  
  // Re-render all UI components
  renderTableCards();
  renderPlayerHand();
  updateScoreboard();
  updateCurrentTurn();
  
  // Start timer if it's our turn
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  if (isMyTurn && gameState.player_hand.length > 0) {
    timerManager.start();
  } else {
    timerManager.stop();
  }
  
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
  
  // Update UI based on turn
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    if (isMyTurn) {
      gameContainer.classList.add('my-turn');
      gameContainer.classList.remove('opponent-turn');
    } else {
      gameContainer.classList.add('opponent-turn');
      gameContainer.classList.remove('my-turn');
    }
  }
  
  // Disable play button if not our turn
  const playBtn = document.getElementById('play-btn');
  if (playBtn) {
    playBtn.disabled = !isMyTurn || !gameState.selected_card;
  }
}

/**
 * Find all cards on table that can be captured by the given card
 * Returns array of card codes that are part of valid capture combinations
 */
function findCapturableCards(handCard, tableCards) {
  const cardValue = getCardValue(handCard);
  const capturableSet = new Set();
  
  // Single card captures (1-to-1 match)
  let hasSingleMatch = false;
  tableCards.forEach(tableCard => {
    if (getCardValue(tableCard) === cardValue) {
      capturableSet.add(tableCard);
      hasSingleMatch = true;
    }
  });
  
  // Sum captures (2 or more cards) - only if no 1-to-1 match exists
  if (!hasSingleMatch) {
    for (let r = 2; r <= tableCards.length; r++) {
      const combos = getCombinations(tableCards, r);
      combos.forEach(combo => {
        const sum = combo.reduce((acc, card) => acc + getCardValue(card), 0);
        if (sum === cardValue) {
          combo.forEach(card => capturableSet.add(card));
        }
      });
    }
  }
  
  return Array.from(capturableSet);
}

/**
 * Find all valid capture combinations for a hand card
 * Returns array of arrays, each inner array is a valid combination
 */
function findAllCaptureCombinations(handCard, tableCards) {
  const cardValue = getCardValue(handCard);
  const validCombos = [];
  
  // Single card captures (1-to-1)
  let hasSingleMatch = false;
  tableCards.forEach(tableCard => {
    if (getCardValue(tableCard) === cardValue) {
      validCombos.push([tableCard]);
      hasSingleMatch = true;
    }
  });
  
  // Sum captures (2 or more cards) - only if no 1-to-1 match
  if (!hasSingleMatch) {
    for (let r = 2; r <= tableCards.length; r++) {
      const combos = getCombinations(tableCards, r);
      combos.forEach(combo => {
        const sum = combo.reduce((acc, card) => acc + getCardValue(card), 0);
        if (sum === cardValue) {
          validCombos.push(combo);
        }
      });
    }
  }
  
  return validCombos;
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
    gameState.captured_cards = [];
  } else {
    gameState.selected_card = card;
    
    // AUTO-CAPTURE: Always capture if possible
    const captureCombos = findAllCaptureCombinations(card, gameState.table_cards);
    
    if (captureCombos.length === 1) {
      // Only one way to capture - FORCE auto-select
      gameState.captured_cards = [...captureCombos[0]];
      console.log('Auto-captured (only option):', captureCombos[0]);
    } else if (captureCombos.length > 1) {
      // Multiple options - auto-select first option, but user can change
      gameState.captured_cards = [...captureCombos[0]];
      showInfo(`Multiple captures possible - click table cards to change selection`);
      console.log('Auto-selected first option:', captureCombos[0], 'from', captureCombos.length, 'options');
    } else {
      // No captures possible - clear selection
      gameState.captured_cards = [];
    }
  }
  
  renderPlayerHand();
  renderTableCards();
  updatePlayButton();
}

function toggleCapturedCard(card) {
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
                   
  if (!isMyTurn) {
    return;
  }
  
  if (!gameState.selected_card) {
    showError('Select a card from your hand first');
    return;
  }
  
  // Check if this card is capturable by the selected hand card
  const capturableCards = findCapturableCards(gameState.selected_card, gameState.table_cards);
  if (!capturableCards.includes(card)) {
    showError('This card cannot be captured by your selected card');
    return;
  }
  
  // Get all valid combinations
  const captureCombos = findAllCaptureCombinations(gameState.selected_card, gameState.table_cards);
  
  // If only one combo exists, don't allow deselection
  if (captureCombos.length === 1) {
    showInfo('This is the only valid capture - cannot deselect');
    return;
  }
  
  // Toggle card in selection
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
    if (gameState.selected_card) {
      btn.textContent = gameState.captured_cards.length > 0 ? 'Play & Capture' : 'Play Card';
    } else {
      btn.textContent = 'Select a Card';
    }
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
  
  // Validate capture if player is attempting to capture
  if (gameState.captured_cards.length > 0) {
    const selectedSum = gameState.captured_cards.reduce((acc, card) => acc + getCardValue(card), 0);
    const handCardValue = getCardValue(gameState.selected_card);
    
    if (selectedSum !== handCardValue) {
      showError(`Invalid capture: ${gameState.captured_cards.join('+')} (${selectedSum}) ≠ ${gameState.selected_card} (${handCardValue})`);
      return;
    }
    
    // Check for 1-to-1 match violation
    const captureCombos = findAllCaptureCombinations(gameState.selected_card, gameState.table_cards);
    const hasSingleMatch = captureCombos.some(combo => combo.length === 1);
    
    if (hasSingleMatch && gameState.captured_cards.length > 1) {
      showError('You must capture the single matching card (not a combination) when a 1-to-1 match exists');
      return;
    }
  }
  
  // Stop timer
  timerManager.stop();
  
  // Animate card play
  animateCardPlay(gameState.selected_card, gameState.captured_cards);
  
  // Send to server
  emitPlayCard(gameState.selected_card, gameState.captured_cards);
  
  // Clear selection after short delay
  setTimeout(() => {
    clearSelection();
  }, 300);
}

function animateCardPlay(playedCard, capturedCards) {
  // Add playing animation class
  const playedCardEl = document.querySelector(`[data-card="${playedCard}"]`);
  if (playedCardEl) {
    playedCardEl.classList.add('card-playing');
  }
  
  // Add captured animation to captured cards
  capturedCards.forEach(card => {
    const cardEl = document.querySelector(`#table-cards [data-card="${card}"]`);
    if (cardEl) {
      cardEl.classList.add('card-captured');
    }
  });
}

function showGameOver(data) {
  console.log('Game over data:', data);
  
  // PAUSE THE GAME - stop all timers and interactions
  timerManager.stop();
  
  // Disable all game interactions
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.disabled = true;
  
  // Show game over screen
  showScreen('game-over');
  
  // Get winner info using player index
  const winnerIndex = data.winner_id;
  const winner = gameState.players[winnerIndex];
  const winnerName = winner ? winner.name : `Player ${winnerIndex + 1}`;
  
  // Display winner info
  const winnerEl = document.getElementById('winner-info');
  if (winnerEl) {
    const winnerScore = data.final_scores ? data.final_scores[winnerIndex] : (gameState.scores[winnerIndex] || 0);
    winnerEl.innerHTML = `
      <h2>🏆 ${winnerName} Won!</h2>
      <p>Final Score: ${winnerScore} points</p>
    `;
  }
  
  // Display all final scores with correct player names
  const scoresEl = document.getElementById('final-scores');
  if (scoresEl) {
    scoresEl.innerHTML = '';
    
    // Use final_scores if available, otherwise use current gameState.scores
    const scores = data.final_scores || gameState.scores || {};
    
    gameState.players.forEach((player, idx) => {
      const score = scores[idx] || 0;
      const chkobba = gameState.chkobba_count[idx] || 0;
      const isWinner = idx === winnerIndex;
      
      const div = document.createElement('div');
      div.className = `final-score-item ${isWinner ? 'winner' : ''}`;
      div.innerHTML = `
        <span class="player-name">${player.name}${isWinner ? ' 🏆' : ''}</span>
        <span class="score-detail">
          <strong>${score}</strong> points
          <small>(${chkobba} Chkobba)</small>
        </span>
      `;
      scoresEl.appendChild(div);
    });
  }
  
  console.log('Game over screen displayed');
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
