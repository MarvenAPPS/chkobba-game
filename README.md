# Chkobba Online - Multiplayer Card Game

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.9+-green)
![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen)

A mobile-friendly, multiplayer online **Chkobba** card game built with Python Flask backend and vanilla HTML5/CSS3/JavaScript frontend. Supports 2-4 players with AI opponents, real-time WebSocket multiplayer, room-based gameplay with reconnection support, and customizable themes.

## Features

✅ **Multiplayer Gameplay**
- 2-4 players per game
- AI opponents with 3 difficulty levels (Easy, Medium, Hard)
- Real-time updates via WebSocket (Socket.IO)
- Room-based system with unique join codes

✅ **Game Mechanics**
- Full Chkobba rules engine implementation
- 40-card Italian deck (no 8s, 9s, 10s)
- Card capture validation and scoring
- 5-second per-move timeout with auto-play
- Chkobba and Haya (7♦) detection

✅ **User Experience**
- Mobile-responsive design (iPhone 15 Pro compatible)
- Touch-friendly interface (48px+ tap targets)
- Customizable card themes and board designs
- Sound effects for game events
- Reconnection/resume support
- Light/Dark mode support

✅ **Accessibility**
- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- High contrast support
- Reduced motion support

✅ **Backend Architecture**
- Pure Python 3.9+ (no external dependencies beyond Flask)
- SQLite3 database (local persistence)
- Stateless HTTP design
- In-memory WebSocket session tracking
- Production-ready logging

## Quick Start

### Requirements
- Python 3.9 or higher
- macOS, Linux, or Windows
- 512MB RAM minimum
- Modern web browser

### Installation

```bash
# 1. Clone repository
git clone https://github.com/MarvenAPPS/chkobba-game.git
cd chkobba-game

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run server
python app.py
```

**Server runs at:** `http://localhost:5000`

### LAN Access (Same Network)

Share your local IP:
```bash
ifconfig | grep "inet "  # macOS/Linux
ipconfig                 # Windows
```

Friends access: `http://<YOUR_LOCAL_IP>:5000`

## Project Structure

```
chkobba-game/
├── app.py                 # Main Flask application
├── game_logic.py          # Chkobba rules engine
├── ai.py                  # AI player (3 difficulty levels)
├── db.py                  # SQLite database layer
├── config.py              # Configuration
├── requirements.txt       # Python dependencies
├── README.md              # Documentation
│
├── templates/
│   └── index.html         # Main game UI
│
├── static/
│   ├── css/
│   │   ├── style.css      # Main stylesheet
│   │   └── responsive.css # Mobile responsive
│   ├── js/
│   │   ├── utils.js       # Utilities
│   │   ├── socket-events.js # WebSocket handlers
│   │   ├── audio.js       # Audio manager
│   │   ├── timer.js       # Timer logic
│   │   ├── ui.js          # UI rendering
│   │   └── game.js        # Game flow
│   ├── sounds/            # Audio files
│   └── cards/             # Card assets
│
└── instance/
    └── chkobba.db         # SQLite database
```

## API Endpoints

### REST API

```
POST   /api/room/create          # Create game room
POST   /api/room/join            # Join room
GET    /api/room/<code>          # Room status
POST   /api/room/reconnect       # Reconnect session
GET    /api/settings/theme       # Get theme
POST   /api/admin/theme/set      # Set theme
```

### WebSocket Events

**Client → Server:**
- `join_game`, `play_card`, `start_game`

**Server → Client:**
- `game_started`, `card_played`, `turn_changed`, `timeout_warning`, `game_ended`

## Chkobba Rules Summary

- **Deck**: 40 cards (no 8s, 9s, 10s)
- **Setup**: 3 cards per player, 4 on table
- **Play**: Match card value to sum of captured cards
- **Chkobba**: Capture all table cards (+1 point)
- **Win**: First to 21 points

## Configuration

Edit `config.py`:

```python
DEFAULT_TIMEOUT_SECONDS = 5
WINNING_SCORE = 21
MAX_PLAYERS_PER_ROOM = 4
AI_LEVELS = ['easy', 'medium', 'hard']
```

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 90+     | ✅ |
| Firefox | 88+     | ✅ |
| Safari  | 14+     | ✅ |
| Edge    | 90+     | ✅ |

## Troubleshooting

**Port Already in Use**
```bash
lsof -i :5000  # macOS/Linux
kill -9 <PID>
```

**Database Lock**
```bash
rm instance/chkobba.db
python app.py  # Recreates database
```

**WebSocket Issues**
- Check firewall
- Ensure port 5000 is open
- Check browser console (F12)

## Security (Production)

- [ ] Enable HTTPS/SSL
- [ ] Add authentication
- [ ] Implement rate limiting
- [ ] Add DDoS protection

## License

MIT License - Feel free to fork, modify, and distribute.

## Contributing

Fork → Feature Branch → Commit → Push → Pull Request

## Support

GitHub Issues: https://github.com/MarvenAPPS/chkobba-game/issues

Contact: choiyamarwen@gmail.com

---

**Made with ❤️ by Marven**

Last Updated: December 7, 2025
