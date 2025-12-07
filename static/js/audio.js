/**
 * Audio effects manager for Chkobba game
 */

const audioManager = {
  sounds: {
    card_play: new Audio('/static/sounds/card_play.mp3'),
    timeout: new Audio('/static/sounds/timeout.mp3'),
    chkobba: new Audio('/static/sounds/chkobba.mp3'),
    haya: new Audio('/static/sounds/haya.mp3'),
    bg_music: new Audio('/static/sounds/bg_music.mp3')
  },
  
  // Create dummy audio for fallback
  createDummyAudio() {
    return {
      play() { },
      pause() { },
      currentTime: 0,
      volume: 1
    };
  },
  
  init() {
    // Set up audio elements
    Object.values(this.sounds).forEach(audio => {
      audio.volume = 0.7;
    });
    
    // Background music loop
    this.sounds.bg_music.loop = true;
  },
  
  play(soundName) {
    if (!settings.soundEffectsEnabled) return;
    
    const audio = this.sounds[soundName];
    if (!audio) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }
    
    try {
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn(`Could not play audio: ${soundName}`, err);
      });
    } catch (err) {
      console.warn(`Audio error: ${soundName}`, err);
    }
  },
  
  playBgMusic() {
    if (!settings.bgMusicEnabled) return;
    
    this.play('bg_music');
  },
  
  stopBgMusic() {
    this.sounds.bg_music.pause();
  },
  
  setVolume(level) {
    level = Math.max(0, Math.min(1, level));
    Object.values(this.sounds).forEach(audio => {
      audio.volume = level;
    });
    settings.bgMusicEnabled = level > 0;
    settings.save();
  },
  
  toggleMute() {
    const isMuted = Object.values(this.sounds)[0].volume === 0;
    this.setVolume(isMuted ? 0.7 : 0);
    return !isMuted;
  }
};

// Initialize audio on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    audioManager.init();
  });
} else {
  audioManager.init();
}
