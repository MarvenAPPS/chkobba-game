/**
 * Timer and timeout management for Chkobba game
 */

const timerManager = {
  duration: 5,
  remaining: 5,
  timerInterval: null,
  isRunning: false,
  
  start(duration = 5) {
    this.duration = duration;
    this.remaining = duration;
    
    if (this.isRunning) {
      this.stop();
    }
    
    this.isRunning = true;
    this.update();
    
    this.timerInterval = setInterval(() => {
      this.remaining--;
      this.update();
      
      if (this.remaining <= 0) {
        this.onTimeout();
        this.stop();
      } else if (this.remaining === 3) {
        audioManager.play('timeout');
      }
    }, 1000);
  },
  
  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
  },
  
  pause() {
    this.stop();
  },
  
  resume() {
    if (this.remaining > 0) {
      this.start(this.remaining);
    }
  },
  
  update() {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.textContent = this.remaining;
      
      // Change color based on time remaining
      if (this.remaining <= 2) {
        timerEl.classList.add('warning');
      } else {
        timerEl.classList.remove('warning');
      }
    }
  },
  
  onTimeout() {
    console.log('Timer expired - auto-play triggered');
    
    // Get current player
    if (gameState.current_player === gameState.player_id) {
      // Auto-play for human player
      autoPlay();
    }
  },
  
  reset() {
    this.stop();
    this.remaining = this.duration;
    this.update();
  }
};

function startTimer(duration = 5) {
  timerManager.start(duration);
}

function stopTimer() {
  timerManager.stop();
}

function resetTimer() {
  timerManager.reset();
}

function autoPlay() {
  console.log('Auto-play triggered');
  
  // Play first legal card with highest value capture
  if (gameState.player_hand.length === 0) {
    showError('No cards in hand');
    return;
  }
  
  // Simple auto-play: play first card with no captures
  const card = gameState.player_hand[0];
  emitPlayCard(card, []);
}
