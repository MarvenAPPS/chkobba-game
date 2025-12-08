/**
 * Utility functions for Chkobba game
 */

// Screen Navigation
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('screen-active');
  });
  
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('screen-active');
  }
}

function showMainMenu() {
  showScreen('main-menu');
}

function showCreateRoom() {
  showScreen('create-room');
}

function showJoinRoom() {
  showScreen('join-room');
}

function showSettings() {
  loadSettings();
  showScreen('settings');
}

function goBack() {
  showMainMenu();
}

function goToMainMenu() {
  showMainMenu();
}

// Local Storage
const storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  },
  
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Storage error:', e);
      return defaultValue;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage error:', e);
    }
  },
  
  clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Storage error:', e);
    }
  }
};

// Game State Manager
const gameState = {
  room_code: null,
  room_id: null,
  player_id: null,
  session_token: null,
  players: [],
  table_cards: [],
  player_hand: [],
  current_player: 0,
  scores: {},
  chkobba_count: {},
  game_status: 'waiting',
  selected_card: null,
  captured_cards: [],
  
  reset() {
    this.room_code = null;
    this.room_id = null;
    this.player_id = null;
    this.session_token = null;
    this.players = [];
    this.table_cards = [];
    this.player_hand = [];
    this.current_player = 0;
    this.scores = {};
    this.chkobba_count = {};
    this.game_status = 'waiting';
    this.selected_card = null;
    this.captured_cards = [];
  },
  
  save() {
    storage.set('gameState', this);
  },
  
  load() {
    const saved = storage.get('gameState', null);
    if (saved) {
      Object.assign(this, saved);
    }
  }
};

// Settings Manager
const settings = {
  cardTheme: 'classic',
  boardTheme: 'classic',
  bgMusicEnabled: true,
  soundEffectsEnabled: true,
  
  load() {
    const saved = storage.get('settings', null);
    if (saved) {
      Object.assign(this, saved);
    }
    this.applySettings();
  },
  
  save() {
    storage.set('settings', {
      cardTheme: this.cardTheme,
      boardTheme: this.boardTheme,
      bgMusicEnabled: this.bgMusicEnabled,
      soundEffectsEnabled: this.soundEffectsEnabled
    });
  },
  
  applySettings() {
    // Apply theme to UI
    document.documentElement.style.setProperty('--theme', this.cardTheme);
  }
};

// API Helper
const api = {
  async request(method, endpoint, data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(endpoint, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'API error');
      }
      
      return result;
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },
  
  async get(endpoint) {
    return this.request('GET', endpoint);
  },
  
  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }
};

// Message Display
function showMessage(message, type = 'info', duration = 3000) {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  messageEl.style.display = 'block';
  
  if (duration) {
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, duration);
  }
}

function showError(message) {
  showMessage(message, 'error');
  console.error(message);
}

function showSuccess(message) {
  showMessage(message, 'success');
}

function showInfo(message) {
  showMessage(message, 'info');
}

// Notification
function notify(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/static/icon.png',
      ...options
    });
  }
}

// Request Notification Permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Card Value Lookup
const CARD_VALUES = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'Q': 8, 'J': 9, 'K': 10
};

/**
 * Get numeric value of a card
 * @param {string} cardCode - Card code like '6D' or '7S'
 * @returns {number} Card value
 */
function getCardValue(cardCode) {
  if (!cardCode || cardCode.length < 2) {
    console.error('Invalid card code:', cardCode);
    return 0;
  }
  const rank = cardCode.charAt(0);
  return CARD_VALUES[rank] || 0;
}

/**
 * Generate all combinations of r elements from array
 * @param {Array} array - Input array
 * @param {number} r - Number of elements per combination
 * @returns {Array} Array of combinations
 */
function getCombinations(array, r) {
  const result = [];
  
  function combine(start, combo) {
    if (combo.length === r) {
      result.push([...combo]);
      return;
    }
    
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  
  combine(0, []);
  return result;
}

// Utility Functions
function formatTime(seconds) {
  return seconds.toString().padStart(2, '0');
}

function getCardColor(suit) {
  switch (suit) {
    case 'H': return 'red';
    case 'D': return 'red';
    case 'C': return 'black';
    case 'S': return 'black';
    default: return 'black';
  }
}

function getCardSuitSymbol(suit) {
  switch (suit) {
    case 'H': return '♥';
    case 'D': return '♦';
    case 'C': return '♣';
    case 'S': return '♠';
    default: return '';
  }
}

function getCardName(rank) {
  switch (rank) {
    case 'A': return 'Ace';
    case 'J': return 'Jack';
    case 'Q': return 'Queen';
    case 'K': return 'King';
    default: return rank;
  }
}

// Debounce
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Throttle
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Initialize
function initializeApp() {
  // Load settings
  settings.load();
  
  // Load game state
  gameState.load();
  
  // Hide loading screen
  setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.remove('screen-active');
    }
    showMainMenu();
  }, 500);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
