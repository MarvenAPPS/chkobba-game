import sqlite3
import json
import os
from datetime import datetime
from config import Config
import logging

logger = logging.getLogger(__name__)

class Database:
    """SQLite database management for Chkobba game"""
    
    def __init__(self, db_path=None):
        self.db_path = db_path or Config.DATABASE_PATH
        self.conn = None
        self.ensure_db_exists()
    
    def get_connection(self):
        """Get database connection"""
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
        return self.conn
    
    def ensure_db_exists(self):
        """Create database and tables if they don't exist"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Create tables
        cursor.executescript("""
        CREATE TABLE IF NOT EXISTS game_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT UNIQUE NOT NULL,
            created_by TEXT NOT NULL,
            status TEXT DEFAULT 'waiting',
            game_mode TEXT NOT NULL,
            num_players INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            finished_at TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS game_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            player_name TEXT NOT NULL,
            is_ai BOOLEAN DEFAULT 0,
            ai_difficulty TEXT,
            session_token TEXT UNIQUE,
            status TEXT DEFAULT 'connected',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES game_rooms(id)
        );
        
        CREATE TABLE IF NOT EXISTS game_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL UNIQUE,
            current_round INTEGER DEFAULT 1,
            current_turn_player_id INTEGER,
            game_state TEXT,
            scores TEXT,
            chkobba_count TEXT,
            started_at TIMESTAMP,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (room_id) REFERENCES game_rooms(id),
            FOREIGN KEY (current_turn_player_id) REFERENCES game_players(id)
        );
        
        CREATE TABLE IF NOT EXISTS game_moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            round_number INTEGER,
            player_id INTEGER,
            card_played TEXT,
            cards_captured TEXT,
            is_chkobba BOOLEAN DEFAULT 0,
            is_haya BOOLEAN DEFAULT 0,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES game_rooms(id),
            FOREIGN KEY (player_id) REFERENCES game_players(id)
        );
        
        CREATE TABLE IF NOT EXISTS game_settings (
            id INTEGER PRIMARY KEY,
            card_theme TEXT DEFAULT 'classic',
            board_theme TEXT DEFAULT 'classic',
            bg_music_enabled BOOLEAN DEFAULT 1,
            sound_effects_enabled BOOLEAN DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS custom_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_type TEXT NOT NULL,
            theme_name TEXT,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            filesize INTEGER
        );
        """)
        
        # Initialize settings if not exists
        cursor.execute("SELECT * FROM game_settings WHERE id = 1")
        if cursor.fetchone() is None:
            cursor.execute("""
                INSERT INTO game_settings (id, card_theme, board_theme)
                VALUES (1, 'classic', 'classic')
            """)
        
        conn.commit()
        logger.info(f"Database initialized at {self.db_path}")
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    # ========== Room Operations ==========
    
    def create_room(self, room_code, created_by, game_mode, num_players):
        """Create a new game room"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO game_rooms (room_code, created_by, game_mode, num_players)
            VALUES (?, ?, ?, ?)
        """, (room_code, created_by, game_mode, num_players))
        conn.commit()
        return cursor.lastrowid
    
    def get_room_by_code(self, room_code):
        """Get room by room code"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_rooms WHERE room_code = ?", (room_code,))
        return cursor.fetchone()
    
    def get_room_by_id(self, room_id):
        """Get room by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_rooms WHERE id = ?", (room_id,))
        return cursor.fetchone()
    
    def update_room_status(self, room_id, status):
        """Update room status"""
        conn = self.get_connection()
        cursor = conn.cursor()
        timestamp = datetime.utcnow().isoformat() if status == 'started' else None
        column = 'started_at' if status == 'started' else 'finished_at' if status == 'finished' else None
        
        if column:
            cursor.execute(f"UPDATE game_rooms SET status = ?, {column} = ? WHERE id = ?",
                         (status, timestamp, room_id))
        else:
            cursor.execute("UPDATE game_rooms SET status = ? WHERE id = ?", (status, room_id))
        conn.commit()
    
    # ========== Player Operations ==========
    
    def add_player(self, room_id, player_name, is_ai=False, ai_difficulty=None, session_token=None):
        """Add player to room"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO game_players (room_id, player_name, is_ai, ai_difficulty, session_token)
            VALUES (?, ?, ?, ?, ?)
        """, (room_id, player_name, is_ai, ai_difficulty, session_token))
        conn.commit()
        return cursor.lastrowid
    
    def get_players_by_room(self, room_id):
        """Get all players in a room"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_players WHERE room_id = ?", (room_id,))
        return cursor.fetchall()
    
    def get_player_by_token(self, session_token):
        """Get player by session token"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_players WHERE session_token = ?", (session_token,))
        return cursor.fetchone()
    
    def get_player_count(self, room_id):
        """Get number of players in room"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM game_players WHERE room_id = ?", (room_id,))
        return cursor.fetchone()[0]
    
    def update_player_status(self, player_id, status):
        """Update player status"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE game_players SET status = ?, last_seen = ? WHERE id = ?",
                     (status, datetime.utcnow().isoformat(), player_id))
        conn.commit()
    
    # ========== Game Session Operations ==========
    
    def create_game_session(self, room_id, initial_state=None):
        """Create a new game session"""
        conn = self.get_connection()
        cursor = conn.cursor()
        initial_state = initial_state or {}
        cursor.execute("""
            INSERT INTO game_sessions (room_id, game_state, scores, chkobba_count, started_at)
            VALUES (?, ?, ?, ?, ?)
        """, (room_id, json.dumps(initial_state), '{}', '{}', datetime.utcnow().isoformat()))
        conn.commit()
        return cursor.lastrowid
    
    def get_game_session(self, room_id):
        """Get game session for room"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_sessions WHERE room_id = ?", (room_id,))
        return cursor.fetchone()
    
    def update_game_state(self, room_id, game_state, scores, chkobba_count, current_turn_player_id):
        """Update game state"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE game_sessions SET game_state = ?, scores = ?, chkobba_count = ?, current_turn_player_id = ?
            WHERE room_id = ?
        """, (json.dumps(game_state), json.dumps(scores), json.dumps(chkobba_count), current_turn_player_id, room_id))
        conn.commit()
    
    # ========== Move Recording ==========
    
    def record_move(self, room_id, round_num, player_id, card_played, cards_captured, is_chkobba=False, is_haya=False):
        """Record a player move"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO game_moves (room_id, round_number, player_id, card_played, cards_captured, is_chkobba, is_haya)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (room_id, round_num, player_id, card_played, json.dumps(cards_captured), is_chkobba, is_haya))
        conn.commit()
    
    # ========== Settings Operations ==========
    
    def get_settings(self):
        """Get game settings"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_settings WHERE id = 1")
        return cursor.fetchone()
    
    def update_settings(self, card_theme=None, board_theme=None, bg_music=None, sound_effects=None):
        """Update game settings"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if card_theme:
            cursor.execute("UPDATE game_settings SET card_theme = ? WHERE id = 1", (card_theme,))
        if board_theme:
            cursor.execute("UPDATE game_settings SET board_theme = ? WHERE id = 1", (board_theme,))
        if bg_music is not None:
            cursor.execute("UPDATE game_settings SET bg_music_enabled = ? WHERE id = 1", (bg_music,))
        if sound_effects is not None:
            cursor.execute("UPDATE game_settings SET sound_effects_enabled = ? WHERE id = 1", (sound_effects,))
        
        conn.commit()

# Global database instance
db = Database()
