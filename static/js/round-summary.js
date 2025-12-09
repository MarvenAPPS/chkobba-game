/**
 * Round Summary Display Component
 */

function showRoundSummary(roundScores, scoringDetails, playerNames, totalScores, targetScore, roundNumber) {
  console.log('Showing round summary:', { roundScores, scoringDetails, playerNames, totalScores, targetScore });
  
  // PAUSE GAME - stop timer and disable play button
  if (typeof timerManager !== 'undefined') {
    timerManager.stop();
  }
  
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.disabled = true;
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'round-summary-overlay';
  overlay.className = 'modal-overlay';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'round-summary-modal';
  
  // Check if anyone reached target score
  const maxScore = Math.max(...Object.values(totalScores));
  const gameEnded = maxScore >= targetScore;
  const winners = gameEnded ? Object.keys(totalScores).filter(idx => totalScores[idx] === maxScore) : [];
  
  // Build table HTML
  let tableHTML = `
    <div class="modal-header">
      <h2>${gameEnded ? '🎉 Game Over!' : `🏆 Round ${roundNumber} Complete!`}</h2>
      <button class="close-btn" onclick="closeRoundSummary()">&times;</button>
    </div>
    <div class="modal-body">
      <table class="scoring-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Cards</th>
            <th>Diamonds</th>
            <th>Haya (7♦)</th>
            <th>Dinari (7♣)</th>
            <th>Chkobba</th>
            <th>Round Pts</th>
            <th>Total Score</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Get number of players from scoring details
  const numPlayers = Object.keys(scoringDetails || {}).length;
  
  for (let idx = 0; idx < numPlayers; idx++) {
    const playerName = playerNames && playerNames[idx] ? playerNames[idx] : `Player ${idx + 1}`;
    const details = scoringDetails[idx] || {};
    const roundScore = roundScores[idx] || 0;
    const totalScore = totalScores[idx] || 0;
    
    // Highlight winner(s)
    const isWinner = gameEnded && winners.includes(String(idx));
    const rowClass = isWinner ? 'winner-row' : '';
    
    // Build cells with checkmarks or dashes
    const cardsCell = details.most_cards ? `<span class="check">✅</span> 1pt` : `<span class="info">${details.total_cards || 0} cards</span>`;
    const diamondsCell = details.most_diamonds ? `<span class="check">✅</span> 1pt` : `<span class="info">${details.diamond_count || 0}♦</span>`;
    const hayaCell = details.haya ? `<span class="check">✅</span> 1pt` : '-';
    const dinariCell = details.dinari ? `<span class="check">✅</span> 1pt` : '-';
    const chkobbaCell = details.chkobba_count > 0 ? `<span class="check">✅</span> ${details.chkobba_count}pt` : '-';
    
    tableHTML += `
      <tr class="${rowClass}">
        <td><strong>${playerName}${isWinner ? ' 👑' : ''}</strong></td>
        <td>${cardsCell}</td>
        <td>${diamondsCell}</td>
        <td>${hayaCell}</td>
        <td>${dinariCell}</td>
        <td>${chkobbaCell}</td>
        <td><strong>+${roundScore}</strong></td>
        <td class="total-score"><strong>${totalScore}</strong></td>
      </tr>
    `;
  }
  
  tableHTML += `
        </tbody>
      </table>
      <div class="modal-footer">
  `;
  
  if (gameEnded) {
    // Game ended - show winner message and options
    const winnerNames = winners.map(idx => playerNames[idx] || `Player ${parseInt(idx) + 1}`).join(' & ');
    tableHTML += `
        <p class="winner-message">🎊 ${winnerNames} reached ${targetScore} points and won the game! 🎊</p>
        <div class="button-group">
          <button class="btn-secondary" onclick="closeRoom()">Close Room</button>
          <button class="btn-primary" onclick="restartGame()">Play Again</button>
        </div>
    `;
  } else {
    // Game continues - show target score and continue button
    tableHTML += `
        <p class="continue-message">Target Score: <strong>${targetScore} points</strong> • Highest: <strong>${maxScore} points</strong></p>
        <p class="auto-close-msg">Continuing in <span id="countdown">8</span> seconds...</p>
        <button class="btn-primary" onclick="closeRoundSummary()">Continue Next Round</button>
    `;
  }
  
  tableHTML += `
      </div>
    </div>
  `;
  
  modal.innerHTML = tableHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Only auto-close if game is not ended
  if (!gameEnded) {
    let countdown = 8;
    const countdownEl = document.getElementById('countdown');
    
    const timer = setInterval(() => {
      countdown--;
      if (countdownEl) {
        countdownEl.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(timer);
        closeRoundSummary();
      }
    }, 1000);
    
    // Store timer so we can cancel if manually closed
    window.roundSummaryTimer = timer;
  }
}

function closeRoundSummary() {
  // Clear auto-close timer
  if (window.roundSummaryTimer) {
    clearInterval(window.roundSummaryTimer);
    window.roundSummaryTimer = null;
  }
  
  // Remove overlay
  const overlay = document.getElementById('round-summary-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  // Emit continue signal to server to start next round
  if (typeof socket !== 'undefined' && typeof sessionToken !== 'undefined') {
    socket.emit('continue_game', {
      session_token: sessionToken
    });
  }
}

function closeRoom() {
  // Close the room and redirect to home
  if (typeof socket !== 'undefined' && typeof sessionToken !== 'undefined') {
    socket.emit('close_room', {
      session_token: sessionToken
    });
  }
  
  // Redirect to home page after short delay
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}

function restartGame() {
  // Restart the game with same settings
  if (typeof socket !== 'undefined' && typeof sessionToken !== 'undefined') {
    socket.emit('restart_game', {
      session_token: sessionToken
    });
  }
  
  // Close the summary modal
  const overlay = document.getElementById('round-summary-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Add CSS styles dynamically
if (!document.getElementById('round-summary-styles')) {
  const style = document.createElement('style');
  style.id = 'round-summary-styles';
  style.textContent = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    }
    
    .round-summary-modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      max-width: 900px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }
    
    .modal-header {
      padding: 20px;
      border-bottom: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px 12px 0 0;
    }
    
    .modal-header h2 {
      margin: 0;
      font-size: 24px;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
      line-height: 1;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    .close-btn:hover {
      opacity: 1;
    }
    
    .modal-body {
      padding: 20px;
    }
    
    .scoring-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .scoring-table th,
    .scoring-table td {
      padding: 12px;
      text-align: center;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .scoring-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
      font-size: 13px;
    }
    
    .scoring-table tbody tr:hover {
      background: #f9f9f9;
    }
    
    .scoring-table .winner-row {
      background: #fff9e6 !important;
      border-left: 4px solid #ffd700;
    }
    
    .scoring-table .winner-row:hover {
      background: #fff5cc !important;
    }
    
    .scoring-table .total-score {
      font-size: 18px;
      color: #667eea;
      font-weight: bold;
    }
    
    .scoring-table .check {
      font-size: 18px;
    }
    
    .scoring-table .info {
      color: #999;
      font-size: 12px;
    }
    
    .modal-footer {
      text-align: center;
      padding: 15px 0 0 0;
      border-top: 1px solid #e0e0e0;
    }
    
    .winner-message {
      color: #ffa500;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
      padding: 15px;
      background: #fff9e6;
      border-radius: 8px;
      border: 2px solid #ffd700;
    }
    
    .continue-message {
      color: #666;
      font-size: 16px;
      margin-bottom: 10px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 6px;
    }
    
    .continue-message strong {
      color: #667eea;
    }
    
    .auto-close-msg {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
    }
    
    .auto-close-msg #countdown {
      font-weight: bold;
      color: #667eea;
    }
    
    .button-group {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .btn-primary, .btn-secondary {
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      font-weight: 600;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #5a6268;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(108, 117, 125, 0.4);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from {
        transform: translateY(50px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
