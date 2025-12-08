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
    if (typeof showInfo === 'function') {
      showInfo(`⏱️ 5 seconds remaining!`);
    }
  }

  timeout() {
    console.log('Timer expired - auto-playing');
    this.stop();
    
    if (typeof showError === 'function') {
      showError('⏰ Time\'s up! Auto-playing...');
    }
    
    // Auto-play after short delay
    setTimeout(() => {
      if (typeof autoPlay === 'function') {
        autoPlay();
      }
    }, 500);
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

// Auto-play function
function autoPlay() {
  console.log('Auto-play triggered');
  
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
  
  // Simple strategy: play first card with no captures
  const card = gameState.player_hand[0];
  console.log('Auto-playing card:', card);
  
  if (typeof emitPlayCard === 'function') {
    emitPlayCard(card, []);
  }
}
