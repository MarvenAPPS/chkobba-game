/**
 * Round Summary and Deck Display Management
 */

// Update deck display
function updateDeckDisplay(deckRemaining) {
  const deckCountEl = document.getElementById('deck-count');
  const deckDisplayEl = document.getElementById('deck-display');
  
  if (deckCountEl) {
    deckCountEl.textContent = deckRemaining;
  }
  
  if (deckDisplayEl) {
    // Add empty state if deck is empty
    if (deckRemaining === 0) {
      deckDisplayEl.classList.add('empty');
    } else {
      deckDisplayEl.classList.remove('empty');
    }
    
    // Add dealing animation
    deckDisplayEl.classList.add('dealing');
    setTimeout(() => {
      deckDisplayEl.classList.remove('dealing');
    }, 400);
  }
}

// Update turns remaining
function updateTurnsRemaining(deckRemaining, numPlayers) {
  const turnsEl = document.getElementById('turns-remaining');
  if (!turnsEl) return;
  
  // Calculate turns remaining (each player gets cards until deck is empty)
  // Each round deals 3 cards per player
  const cardsPerRound = numPlayers * 3;
  const turnsRemaining = Math.ceil(deckRemaining / cardsPerRound);
  
  turnsEl.textContent = `Turns: ${turnsRemaining}`;
  
  // Add warning/critical states
  turnsEl.classList.remove('warning', 'critical');
  if (turnsRemaining <= 1) {
    turnsEl.classList.add('critical');
  } else if (turnsRemaining <= 2) {
    turnsEl.classList.add('warning');
  }
}

// Show round summary modal
function showRoundSummary(roundData) {
  const modal = document.getElementById('round-summary-modal');
  const content = document.getElementById('round-summary-content');
  
  if (!modal || !content) return;
  
  // Build summary HTML
  let html = `
    <div class="summary-header">
      <h3>Round ${roundData.round_number || '?'} Complete</h3>
      <p>Deck is now empty - calculating scores...</p>
    </div>
  `;
  
  // Get players sorted by round score (highest first)
  const playerScores = roundData.players.map((player, idx) => ({
    ...player,
    index: idx,
    roundScore: roundData.round_scores ? roundData.round_scores[idx] || 0 : 0
  })).sort((a, b) => b.roundScore - a.roundScore);
  
  // Render each player's summary
  playerScores.forEach((player, position) => {
    const isWinner = position === 0 && player.roundScore > 0;
    
    html += `
      <div class="player-summary ${isWinner ? 'winner' : ''}">
        <div class="player-summary-header">
          <div class="player-name">
            ${player.name || `Player ${player.index + 1}`}
            ${isWinner ? '<span class="trophy">🏆</span>' : ''}
          </div>
          <div class="player-round-score">+${player.roundScore} pts</div>
        </div>
        <div class="score-details">
          <div class="score-item ${player.chkobba_count > 0 ? 'highlight' : ''}">
            <span class="score-item-label">Chkobbas</span>
            <span class="score-item-value">${player.chkobba_count || 0}</span>
          </div>
          <div class="score-item">
            <span class="score-item-label">Total Score</span>
            <span class="score-item-value">${player.score || 0}</span>
          </div>
          <div class="score-item">
            <span class="score-item-label">Cards Won</span>
            <span class="score-item-value">--</span>
          </div>
          <div class="score-item">
            <span class="score-item-label">Diamonds</span>
            <span class="score-item-value">--</span>
          </div>
        </div>
      </div>
    `;
  });
  
  content.innerHTML = html;
  modal.style.display = 'flex';
  
  // Play sound effect
  if (typeof audioManager !== 'undefined') {
    audioManager.play('round_end');
  }
}

// Close round summary modal
function closeRoundSummary() {
  const modal = document.getElementById('round-summary-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Handle deck empty event
function handleDeckEmpty(gameState) {
  console.log('Deck is empty! Showing round summary...');
  
  // Show round summary after a short delay
  setTimeout(() => {
    showRoundSummary({
      round_number: gameState.round || 1,
      players: gameState.players || [],
      round_scores: gameState.round_scores || {},
      deck_remaining: 0
    });
  }, 1000);
}

// Listen for deck empty event
if (typeof socket !== 'undefined') {
  socket.on('deck_empty', (data) => {
    console.log('Deck empty event received:', data);
    handleDeckEmpty(data);
  });
  
  socket.on('round_ended', (data) => {
    console.log('Round ended event received:', data);
    showRoundSummary(data);
  });
}
