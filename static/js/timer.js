/**
 * Timer management for turn timeout
 */

class TimerManager {
  constructor() {
    this.duration = 10; // 10 seconds per turn
    this.remaining = this.duration;
    this.isRunning = false;
    this.isPaused = false;
    this.intervalId = null;
    this.progressBar = null;
    this.timeDisplay = null;
    this.warningShown = false;
  }

  init() {
    // Get DOM elements
    this.progressBar = document.getElementById('timer-progress');
    this.timeDisplay = document.getElementById('timer-display');
    this.timerContainer = document.getElementById('timer-container');
  }

  start() {
    if (!this.progressBar || !this.timeDisplay) {
      this.init();
    }

    this.stop(); // Clear any existing timer
    this.remaining = this.duration;
    this.isRunning = true;
    this.isPaused = false;
    this.warningShown = false;

    // Show timer
    if (this.timerContainer) {
      this.timerContainer.style.display = 'block';
    }

    this.updateDisplay();
    
    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.tick();
      }
    }, 1000);

    console.log('Timer started: 10 seconds');
  }

  tick() {
    this.remaining--;
    this.updateDisplay();

    // Warning at 5 seconds
    if (this.remaining === 5 && !this.warningShown) {
      this.showWarning();
      this.warningShown = true;
      if (typeof audioManager !== 'undefined') {
        audioManager.play('timeout');
      }
    }

    // Critical at 3 seconds
    if (this.remaining <= 3) {
      if (this.timerContainer) {
        this.timerContainer.classList.add('critical');
      }
    }

    // Timeout
    if (this.remaining <= 0) {
      this.timeout();
    }
  }

  updateDisplay() {
    // Update progress bar
    if (this.progressBar) {
      const percentage = (this.remaining / this.duration) * 100;
      this.progressBar.style.width = `${percentage}%`;

      // Color coding
      if (this.remaining <= 3) {
        this.progressBar.style.backgroundColor = '#e74c3c'; // Red
      } else if (this.remaining <= 5) {
        this.progressBar.style.backgroundColor = '#f39c12'; // Orange
      } else {
        this.progressBar.style.backgroundColor = '#3498db'; // Blue
      }
    }

    // Update time display
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.remaining}s`;
    }
  }

  showWarning() {
    if (typeof showWarning === 'function') {
      showWarning(`⏱️ 5 seconds remaining!`);
    }
  }

  timeout() {
    console.log('Timer expired - triggering auto-play');
    this.stop();
    
    if (typeof showWarning === 'function') {
      showWarning('⏰ Time\'s up! Auto-playing...');
    }
    
    // FIXED: Auto-play immediately, not after delay
    if (typeof autoPlay === 'function') {
      autoPlay();
    } else {
      console.error('autoPlay function not defined!');
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.isPaused = false;
    this.remaining = this.duration;

    // Hide timer
    if (this.timerContainer) {
      this.timerContainer.style.display = 'none';
      this.timerContainer.classList.remove('critical');
    }

    // Reset progress bar
    if (this.progressBar) {
      this.progressBar.style.width = '100%';
      this.progressBar.style.backgroundColor = '#3498db';
    }

    // Reset display
    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${this.duration}s`;
    }
  }

  pause() {
    if (this.isRunning) {
      this.isPaused = true;
      console.log('Timer paused');
    }
  }

  resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      console.log('Timer resumed');
    }
  }

  reset() {
    this.stop();
    this.start();
  }
}

// Global timer instance
const timerManager = new TimerManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  timerManager.init();
});

// FIXED Auto-play function - properly checks for captures
function autoPlay() {
  console.log('Auto-play triggered by timeout');
  
  const isMyTurn = (gameState.current_player === gameState.player_index) ||
                   (gameState.current_player === gameState.player_id);
  
  if (!isMyTurn) {
    console.log('Not my turn, skipping auto-play');
    return;
  }
  
  if (!gameState.player_hand || gameState.player_hand.length === 0) {
    console.log('No cards in hand');
    return;
  }
  
  // Find a card that can be played without capturing (if possible)
  let cardToPlay = null;
  let captureCards = [];
  
  // Try to find a card that CANNOT capture anything
  for (const card of gameState.player_hand) {
    const captureCombos = findAllCaptureCombinations(card, gameState.table_cards);
    if (captureCombos.length === 0) {
      // This card cannot capture - safe to play
      cardToPlay = card;
      captureCards = [];
      console.log('Auto-playing non-capturing card:', card);
      break;
    }
  }
  
  // If all cards can capture, play first card with its required capture
  if (!cardToPlay) {
    cardToPlay = gameState.player_hand[0];
    const captureCombos = findAllCaptureCombinations(cardToPlay, gameState.table_cards);
    
    if (captureCombos.length > 0) {
      // MUST capture with this card
      captureCards = captureCombos[0];
      console.log('Auto-playing with mandatory capture:', cardToPlay, 'capturing:', captureCards);
    } else {
      console.log('Auto-playing card without capture:', cardToPlay);
    }
  }
  
  if (cardToPlay && typeof emitPlayCard === 'function') {
    emitPlayCard(cardToPlay, captureCards);
  } else {
    console.error('Cannot auto-play: emitPlayCard not available');
  }
}
