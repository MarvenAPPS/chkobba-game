/**
 * Round Summary Display Component
 */

function showRoundSummary(roundScores, scoringDetails, playerNames) {
  console.log('Showing round summary:', { roundScores, scoringDetails, playerNames });
  
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
  
  // Build table HTML
  let tableHTML = `
    <div class="modal-header">
      <h2>🏆 Round Complete!</h2>
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
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Get number of players from scoring details
  const numPlayers = Object.keys(scoringDetails || {}).length;
  
  for (let idx = 0; idx < numPlayers; idx++) {
    const playerName = playerNames && playerNames[idx] ? playerNames[idx] : `Player ${idx + 1}`;
    const details = scoringDetails[idx] || {};
    const score = roundScores[idx] || 0;
    
    // Build cells with checkmarks or dashes
    const cardsCell = details.most_cards ? `<span class="check">✅</span> 1pt` : `<span class="info">${details.total_cards || 0} cards</span>`;
    const diamondsCell = details.most_diamonds ? `<span class="check">✅</span> 1pt` : `<span class="info">${details.diamond_count || 0}♦</span>`;
    const hayaCell = details.haya ? `<span class="check">✅</span> 1pt` : '-';
    const dinariCell = details.dinari ? `<span class="check">✅</span> 1pt` : '-';
    const chkobbaCell = details.chkobba_count > 0 ? `<span class="check">✅</span> ${details.chkobba_count}pt` : '-';
    
    tableHTML += `
      <tr>
        <td><strong>${playerName}</strong></td>
        <td>${cardsCell}</td>
        <td>${diamondsCell}</td>
        <td>${hayaCell}</td>
        <td>${dinariCell}</td>
        <td>${chkobbaCell}</td>
        <td><strong>${score} pts</strong></td>
      </tr>
    `;
  }
  
  tableHTML += `
        </tbody>
      </table>
      <div class="modal-footer">
        <p class="auto-close-msg">Starting next round in <span id="countdown">8</span> seconds...</p>
        <button class="btn-primary" onclick="closeRoundSummary()">Continue</button>
      </div>
    </div>
  `;
  
  modal.innerHTML = tableHTML;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Auto-dismiss after 8 seconds
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
  
  // Re-enable game (timer will start on next turn)
  const playBtn = document.getElementById('play-btn');
  if (playBtn) {
    // Don't re-enable yet - wait for next turn
    // playBtn.disabled = false;
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
      max-width: 800px;
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
    }
    
    .scoring-table tbody tr:hover {
      background: #f9f9f9;
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
    
    .auto-close-msg {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
    }
    
    .auto-close-msg #countdown {
      font-weight: bold;
      color: #667eea;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
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
