import random
from itertools import combinations
from typing import List, Tuple, Dict, Set
from config import Config
import logging

logger = logging.getLogger(__name__)

class Card:
    """Represents a playing card"""
    
    SUITS = {'H': 'Hearts', 'D': 'Diamonds', 'C': 'Clubs', 'S': 'Spades'}
    RANKS = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K']
    VALUES = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'Q': 8, 'J': 9, 'K': 10}
    
    def __init__(self, rank: str, suit: str):
        self.rank = rank
        self.suit = suit
        if rank not in self.VALUES or suit not in self.SUITS:
            raise ValueError(f"Invalid card: {rank}{suit}")
    
    @property
    def code(self) -> str:
        """Return card code like '2H' (2 of Hearts)"""
        return f"{self.rank}{self.suit}"
    
    @property
    def value(self) -> int:
        """Return numeric value of card"""
        return self.VALUES[self.rank]
    
    @classmethod
    def from_code(cls, code: str):
        """Create Card from code like '2H'"""
        if len(code) != 2:
            raise ValueError(f"Invalid card code: {code}")
        return cls(code[0], code[1])
    
    def __repr__(self):
        return self.code
    
    def __eq__(self, other):
        if not isinstance(other, Card):
            return False
        return self.code == other.code
    
    def __hash__(self):
        return hash(self.code)


class Deck:
    """Represents a 40-card Italian playing deck"""
    
    def __init__(self):
        self.cards = self._create_deck()
        random.shuffle(self.cards)
    
    def _create_deck(self) -> List[Card]:
        """Create standard 40-card Italian deck (no 8, 9, 10)"""
        deck = []
        for suit in Card.SUITS:
            for rank in Card.RANKS:
                deck.append(Card(rank, suit))
        return deck
    
    def draw(self, count: int = 1) -> List[Card]:
        """Draw cards from deck"""
        drawn = []
        for _ in range(count):
            if self.cards:
                drawn.append(self.cards.pop())
        return drawn
    
    def remaining(self) -> int:
        """Return number of remaining cards"""
        return len(self.cards)
    
    def shuffle(self):
        """Shuffle remaining cards"""
        random.shuffle(self.cards)


class GameState:
    """Manages the state of a Chkobba game"""
    
    def __init__(self, num_players: int = 2):
        if num_players < 2 or num_players > 4:
            raise ValueError("Game must have 2-4 players")
        
        self.num_players = num_players
        self.deck = Deck()
        self.players = [{'hand': [], 'score': 0, 'chkobba_count': 0} for _ in range(num_players)]
        self.table = []
        self.current_player = 0
        self.round_number = 1
        self.move_history = []
        self.is_finished = False
        self.winner = None
        
        self._setup_game()
    
    def _setup_game(self):
        """Initial game setup"""
        # Deal 3 cards to each player
        for player_idx in range(self.num_players):
            self.players[player_idx]['hand'] = self.deck.draw(3)
        
        # Deal 4 cards to table
        self.table = self.deck.draw(4)
        logger.info(f"Game setup complete. Table: {[c.code for c in self.table]}")
    
    def _deal_new_hands(self):
        """Deal new hands to all players (3 cards each)"""
        if self.deck.remaining() >= self.num_players * 3:
            for player_idx in range(self.num_players):
                self.players[player_idx]['hand'] = self.deck.draw(3)
            logger.info(f"Dealt new hands. Deck has {self.deck.remaining()} cards remaining")
            return True
        return False
    
    def _check_and_deal_cards(self):
        """Check if all players have empty hands and deal new cards"""
        all_empty = all(len(player['hand']) == 0 for player in self.players)
        
        if all_empty and self.deck.remaining() > 0:
            self._deal_new_hands()
            return True
        return False
    
    def get_legal_moves(self, player_idx: int) -> List[Tuple[Card, List[Card]]]:
        """Get all legal moves for a player
        Returns list of (card_to_play, cards_to_capture) tuples
        """
        hand = self.players[player_idx]['hand']
        legal_moves = []
        
        for card in hand:
            captures = self._find_captures(card)
            for capture_set in captures:
                legal_moves.append((card, capture_set))
        
        # If no captures possible, can play any card
        if not legal_moves:
            legal_moves = [(card, []) for card in hand]
        
        return legal_moves
    
    def _find_captures(self, card: Card) -> List[List[Card]]:
        """Find all possible capture combinations for a card"""
        captures = []
        card_value = card.value
        
        # Single card capture
        for table_card in self.table:
            if table_card.value == card_value:
                captures.append([table_card])
        
        # Sum captures (2 or more cards)
        for r in range(2, len(self.table) + 1):
            for combo in combinations(self.table, r):
                if sum(c.value for c in combo) == card_value:
                    captures.append(list(combo))
        
        return captures
    
    def play_card(self, player_idx: int, card: Card, captured_cards: List[Card]) -> Dict:
        """Play a card and capture specified cards
        
        Returns:
            Dict with 'success', 'is_chkobba', 'is_haya', 'message', 'new_cards_dealt'
        """
        logger.info(f"Player {player_idx} attempting to play {card.code} and capture {[c.code for c in captured_cards]}")
        logger.info(f"Current table: {[c.code for c in self.table]}")
        logger.info(f"Player hand: {[c.code for c in self.players[player_idx]['hand']]}")
        
        if self.current_player != player_idx:
            return {'success': False, 'message': 'Not your turn'}
        
        hand = self.players[player_idx]['hand']
        if card not in hand:
            logger.error(f"Card {card.code} not in hand: {[c.code for c in hand]}")
            return {'success': False, 'message': 'Card not in hand'}
        
        # Validate capture
        is_valid, msg = self._validate_capture(card, captured_cards)
        if not is_valid:
            logger.error(f"Capture validation failed: {msg}")
            return {'success': False, 'message': msg}
        
        # Execute play
        hand.remove(card)
        for captured_card in captured_cards:
            self.table.remove(captured_card)
        
        is_chkobba = len(self.table) == 0 and len(captured_cards) > 0
        is_haya = any(c.rank == '7' and c.suit == 'D' for c in captured_cards)
        
        if is_chkobba:
            self.players[player_idx]['chkobba_count'] += 1
            logger.info(f"CHKOBBA! Player {player_idx} now has {self.players[player_idx]['chkobba_count']} chkobbas")
        
        # If no cards captured, add to table
        if not captured_cards:
            self.table.append(card)
            logger.info(f"No capture. Card {card.code} added to table")
        else:
            logger.info(f"Captured {len(captured_cards)} cards: {[c.code for c in captured_cards]}")
        
        # Record move
        self.move_history.append({
            'player': player_idx,
            'card': card.code,
            'captured': [c.code for c in captured_cards],
            'is_chkobba': is_chkobba,
            'is_haya': is_haya
        })
        
        # Check if we need to deal new cards
        new_cards_dealt = self._check_and_deal_cards()
        
        logger.info(f"Table after play: {[c.code for c in self.table]}")
        
        return {
            'success': True,
            'is_chkobba': is_chkobba,
            'is_haya': is_haya,
            'new_cards_dealt': new_cards_dealt,
            'message': 'Card played successfully'
        }
    
    def _validate_capture(self, card: Card, captured_cards: List[Card]) -> Tuple[bool, str]:
        """Validate card capture according to rules"""
        card_value = card.value
        
        logger.info(f"Validating capture: card={card.code} (value={card_value}), captured={[c.code for c in captured_cards]}")
        
        # No captures is valid
        if not captured_cards:
            logger.info("No captures - valid")
            return True, ''
        
        # Convert table to codes for comparison
        table_codes = [c.code for c in self.table]
        
        # All captured cards must be on table
        for cap_card in captured_cards:
            if cap_card.code not in table_codes:
                logger.error(f"Card {cap_card.code} not on table. Table: {table_codes}")
                return False, f'{cap_card.code} is not on table'
        
        # Sum must match card value
        total_value = sum(c.value for c in captured_cards)
        logger.info(f"Capture sum: {total_value}, card value: {card_value}")
        
        if total_value != card_value:
            return False, f'Captured cards sum ({total_value}) does not match card value ({card_value})'
        
        logger.info("Capture validation successful")
        return True, ''
    
    def end_round(self) -> Dict:
        """Calculate scores for current round"""
        scores = self._calculate_round_scores()
        
        # Check if any player won
        for idx, score in enumerate(scores.items()):
            self.players[idx]['score'] += score[1]
            if self.players[idx]['score'] >= Config.WINNING_SCORE:
                self.is_finished = True
                self.winner = idx
        
        # Reset for next round if not finished
        if not self.is_finished:
            self.round_number += 1
            self.table = []
            for player in self.players:
                player['hand'] = []
            self._setup_game()
        
        return scores
    
    def _calculate_round_scores(self) -> Dict[int, int]:
        """Calculate scores for current round based on Chkobba rules"""
        round_scores = {i: 0 for i in range(self.num_players)}
        
        # TODO: Implement full scoring based on specification
        # For MVP, just award points for chkobba
        for idx, player in enumerate(self.players):
            round_scores[idx] = player['chkobba_count']
        
        return round_scores
    
    def next_turn(self):
        """Move to next player's turn"""
        if not self.is_finished:
            self.current_player = (self.current_player + 1) % self.num_players
            logger.info(f"Turn changed to player {self.current_player}")
    
    def to_dict(self) -> Dict:
        """Convert game state to dictionary for serialization"""
        return {
            'num_players': self.num_players,
            'round': self.round_number,
            'current_player': self.current_player,
            'players': [
                {
                    'hand': [c.code for c in p['hand']],
                    'score': p['score'],
                    'chkobba_count': p['chkobba_count']
                }
                for p in self.players
            ],
            'table': [c.code for c in self.table],
            'deck_remaining': self.deck.remaining(),
            'is_finished': self.is_finished,
            'winner': self.winner
        }
    
    @staticmethod
    def from_dict(data: Dict) -> 'GameState':
        """Restore game state from dictionary"""
        # TODO: Implement full restoration
        pass
