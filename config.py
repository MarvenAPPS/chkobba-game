import os
from datetime import timedelta

class Config:
    """Base configuration for Chkobba application"""
    
    # Flask Configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'chkobba-dev-secret-key-change-in-production'
    DEBUG = os.environ.get('FLASK_ENV') == 'development'
    HOST = '0.0.0.0'
    PORT = int(os.environ.get('PORT', 9988))
    
    # SocketIO Configuration
    SOCKETIO_CORS_ALLOWED_ORIGINS = '*'
    SOCKETIO_ASYNC_MODE = 'threading'
    SOCKETIO_PING_TIMEOUT = 60
    SOCKETIO_PING_INTERVAL = 25
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/chkobba.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'chkobba.db')
    
    # Game Settings
    DEFAULT_TIMEOUT_SECONDS = 10
    WINNING_SCORE = 21
    MAX_PLAYERS_PER_ROOM = 4
    MIN_PLAYERS_PER_ROOM = 2
    SESSION_TOKEN_EXPIRY = timedelta(hours=24)
    
    # Asset Configuration
    MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
    ALLOWED_IMAGE_FORMATS = {'png', 'jpg', 'jpeg', 'gif'}
    ALLOWED_AUDIO_FORMATS = {'mp3', 'wav', 'ogg'}
    
    # AI Configuration
    AI_LEVELS = ['easy', 'medium', 'hard']
    DEFAULT_AI_LEVEL = 'medium'
    AI_THINK_TIME_MS = 500  # Milliseconds
    
    # Game Rules
    CARDS_PER_SUIT = 10
    NUM_SUITS = 4
    INITIAL_HAND_SIZE = 3
    CARDS_ON_TABLE = 4
    
    # Deck definition (40-card Italian deck)
    CARD_VALUES = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'Q': 8, 'J': 9, 'K': 10}
    CARD_SUITS = {'H': 'Hearts', 'D': 'Diamonds', 'C': 'Clubs', 'S': 'Spades'}
    CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K']
    
    # Score categories
    SCORE_CATEGORIES = {
        'carta': 'Most cards',
        'denari': 'Most diamonds', 
        'barmila': 'Most sevens',
        'haya': '7 of diamonds',
        'chkobba': 'Chkobba captures'
    }

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DATABASE_PATH = ':memory:'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
