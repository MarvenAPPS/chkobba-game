import random
from typing import List, Tuple, Dict
from game_logic import Card, GameState
from config import Config
import logging

logger = logging.getLogger(__name__)

class AIPlayer:
    """AI player for Chkobba game with multiple difficulty levels"""
    
    def __init__(self, difficulty: str = 'medium'):
        if difficulty not in Config.AI_LEVELS:
            raise ValueError(f"Invalid difficulty: {difficulty}")
        self.difficulty = difficulty
    
    def choose_move(self, game_state: GameState, player_idx: int) -> Tuple[Card, List[Card]]:
        """Choose best move based on difficulty level"""
        legal_moves = game_state.get_legal_moves(player_idx)
        
        if not legal_moves:
            return None, []
        
        if self.difficulty == 'easy':
            return self._easy_move(legal_moves)
        elif self.difficulty == 'medium':
            return self._medium_move(legal_moves, game_state, player_idx)
        elif self.difficulty == 'hard':
            return self._hard_move(legal_moves, game_state, player_idx)
    
    def _easy_move(self, legal_moves: List[Tuple[Card, List[Card]]]) -> Tuple[Card, List[Card]]:
        """Easy: Random legal move"""
        return random.choice(legal_moves)
    
    def _medium_move(self, legal_moves: List[Tuple[Card, List[Card]]], 
                    game_state: GameState, player_idx: int) -> Tuple[Card, List[Card]]:
        """Medium: Heuristic-based strategy
        Priority:
        1. Capture 7 of Diamonds (Haya)
        2. Complete Chkobba (capture all table cards)
        3. Maximize card value capture
        4. Random fallback
        """
        
        haya_card = Card('7', 'D')
        best_move = None
        best_score = -1
        
        for card, captured in legal_moves:
            move_score = 0
            
            # Bonus for capturing Haya
            if haya_card in captured:
                move_score += 100
            
            # Bonus for Chkobba
            if len(captured) == len(game_state.table):
                move_score += 50
            
            # Score based on total captured value
            move_score += sum(c.value for c in captured)
            
            if move_score > best_score:
                best_score = move_score
                best_move = (card, captured)
        
        return best_move if best_move else random.choice(legal_moves)
    
    def _hard_move(self, legal_moves: List[Tuple[Card, List[Card]]], 
                  game_state: GameState, player_idx: int) -> Tuple[Card, List[Card]]:
        """Hard: Advanced strategy with board evaluation
        Considers:
        1. Immediate scoring opportunities
        2. Board state and remaining cards
        3. Opponent protection
        4. Long-term card management
        """
        
        best_move = None
        best_score = float('-inf')
        
        for card, captured in legal_moves:
            move_score = self._evaluate_move(card, captured, game_state, player_idx)
            
            if move_score > best_score:
                best_score = move_score
                best_move = (card, captured)
        
        return best_move if best_move else random.choice(legal_moves)
    
    def _evaluate_move(self, card: Card, captured: List[Card], 
                      game_state: GameState, player_idx: int) -> float:
        """Evaluate move quality for hard difficulty"""
        score = 0.0
        
        # Haya priority (7 of Diamonds)
        haya = Card('7', 'D')
        if haya in captured:
            score += 100
        
        # Chkobba bonus
        if len(captured) == len(game_state.table):
            score += 75
        
        # Card value captured
        captured_value = sum(c.value for c in captured)
        score += captured_value * 2
        
        # Hand management: prefer playing low cards when table has high cards
        high_table_value = max((c.value for c in game_state.table), default=0)
        if card.value < high_table_value and not captured:
            score -= 10  # Slight penalty for leaving high cards on table
        
        # Diversity: avoid playing same value cards repeatedly
        # This encourages varied play
        if captured:
            score += len(captured) * 1.5
        
        # Random factor for unpredictability
        score += random.uniform(-5, 5)
        
        return score
    
    def __repr__(self):
        return f"AIPlayer({self.difficulty})"
