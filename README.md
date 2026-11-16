# Midnight City: Mafia

A real-time multiplayer social deduction party game for 5–16 players set in a gritty 1940s film noir metropolis. Features WebRTC peer-to-peer voice chat, a 2D interactive speakeasy lounge with walking chibi mobsters, a 3D Three.js roundtable council, ElevenLabs-engineered audio cues, and a server-authoritative game engine.

---

## Highlights & Features

### 🕵️ 2D Interactive Speakeasy Lounge
- **Freely Walkable Lounge**: Move your mobster around the hardwood floor and plush velvet carpet using `W`, `A`, `S`, `D`, arrow keys, or point-and-click waypoints.
- **Natural Spawn Distribution**: 16 non-overlapping spawn anchors across booths, bar stools, and jazz crates ensure characters never spawn in an awkward cluster.
- **Chibi Noir Characters**: Dynamic SVG characters featuring fedoras, trench coats, customizable color palettes, and circular Polaroid portrait heads.

### 🎙️ Avatar-Anchored Head Voice
- **Head-Mounted Mic Controls**: No intrusive top banners. Voice connection controls are attached directly above your character's avatar head in the lobby:
  - `🎙️ Mic Off`: 1-click connect to voice.
  - `🎙️ Mic Live` (emerald glow): Click to mute.
  - `🔇 Muted` (crimson badge): Click to unmute.
  - `✕` Disconnect: Instantly leave voice channel.
- **Reactive Speaking Auras**: Pulsing green audio rings highlight the speaker in real-time.
- **Zero Screen Clutter**: The game header and lounge floor remain clean, open, and distraction-free.

### 📸 Polaroid Avatar Studio & Dossier Vanity
- **Custom Photo Uploads**: Upload your own image or choose from character presets (*Consigliere Cat*, *The Enforcer*, *Young Rebel*, *Wise Guy*, *Night Owl*, *Comrade Shiba*, etc.).
- **Authentic Film Looks**: Real-time filters including *Original*, *Noir B&W*, *Sepia*, and *Vivid*.
- **Card Styling**: Choose card stock tint (*Gold*, *Cream*, *Aged Noir*) and customize colored pushpins (*Red*, *Green*, *Amber*, *Pearl*).

### 🎲 Streamlined Room Setup & House Rules
- **2-Step Fast Flow**: Step 1 Avatar Studio &rarr; Step 2 Table & House Rules.
- **1-Click Presets**:
  - **Classic**: Balanced 1 Mafia, Healer, Detective, standard timers.
  - **Chaos Joker**: Adds the neutral Joker win condition.
  - **Speed**: Snappy timers (60s discussion, 20s voting, 15s night).
- **Visual Special Role Cards**: Clear, visual toggle cards for Healer, Detective, and Joker with live player count previews.
- **Dynamic Role Bar**: Real-time visual breakdown showing exact distribution of Mafia, Healer, Detective, Joker, and Villagers before opening the table.

### 🏛️ 3D Midnight Roundtable Council
- **Interactive Three.js Table**: Seamless 3D scene with velvet seats, dramatic spotlight beams, and cinematic camera controls (*Table View* or *My Seat*).
- **Holographic Trading Cards**: Flip and inspect player dossier cards, live accusation badges, and vote counters during Day Discussion and Gallows Ballots.

### 🎭 Full Game Loop & Roles
- **Syndicate (Mafia)**: Wake under cover of darkness to coordinate and strike down citizens.
- **Healer**: Guard one soul each night. If the Mafia strikes your patient, they survive until dawn.
- **Detective**: Tail one suspect per night to uncover whether they belong to the Syndicate.
- **Joker**: Chaos incarnate. Trick the city into voting you out at the daytime gallows to claim solo victory.
- **Villager**: Read the room, sniff out deception by day, and vote the Syndicate out of Midnight City.
- **Narrator Options**: Choose between **Auto-Narrator** (automated timers and narration) or **Human Host** (manual night progression with real-time God View).

### 🔊 ElevenLabs & Web Audio Sound Design
- **Tactile UI Cues**: Low, heavy card flips, poker chip clinks, and toggle chimes.
- **Atmospheric Feedback**: Rhythmic footsteps while walking, gavel strikes during verdicts, and tension-building timer ticks.

### 🛠️ Developer God Mode Studio
- Built-in testing harness accessible via `?god=1` or `Shift+Alt+G`.
- Instant page switcher (Lobby, Role Reveal, Night, Dawn, Day Discussion, Day Vote, Vote Result, Game Over).
- Test with simulated bot lobbies (5–16 players) without needing multiple physical devices or browser windows.

---

## Architecture & Project Structure

This project is organized as an npm workspace monorepo:

```
├── shared/             # Domain models, game types, validation & socket protocol
│   ├── src/
│   │   ├── types.ts    # Game state, player views, roles, settings
│   │   ├── events.ts   # Typed client <-> server socket contracts
│   │   └── validation.ts
│   └── package.json
├── server/             # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── engine/     # Pure deterministic state machine (roles, votes, nights)
│   │   ├── roomStore.ts# In-memory room manager (swappable for Redis/SQL)
│   │   ├── viewFilter.ts# Server-authoritative state masking per player
│   │   ├── voiceState.ts# Dynamic permissions for WebRTC channels
│   │   └── server.ts   # HTTP & WebSocket initialization
│   └── tests/          # Vitest integration & unit test suite
├── client/             # React + Vite + TailwindCSS frontend
│   ├── src/
│   │   ├── audio/      # ElevenLabs SFX & Web Audio SoundEngine
│   │   ├── components/ # 2D Lounge, 3D Table, Avatar Studio, Dossier Rules
│   │   ├── dev/        # Dev God Mode mock scene & inspector
│   │   ├── pages/      # Home, Lobby, Role Reveal, Night, Dawn, Day Table, Game Over
│   │   ├── services/   # Socket.IO client connection & session persistence
│   │   ├── stores/     # Zustand state stores (useGameStore, useVoiceStore)
│   │   └── voice/      # WebRTC MeshVoiceProvider & ICE configuration
│   └── package.json
└── package.json        # Monorepo root scripts
```

### Security & State Masking
- **Server-Authoritative**: Clients never see private roles or night targets. The server filters state through `viewFilter.ts` before emitting updates.
- **Stealth Night Timing**: Eliminates timing leaks; simulated randomized delays ensure asleep players cannot infer role activity based on packet timing.
- **Channel Isolation**: Mafia members communicate over private channels during Night phases; dead players transition to ghost chat and ghost audio.

---

## Local Setup & Development

### Prerequisites
- **Node.js**: `>= 20.19.0`
- **npm**: `>= 10.0.0`

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/your-username/midnight-city-mafia.git
cd midnight-city-mafia
npm install
```

### 2. Environment Configuration
Copy the example environment files:
```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration (optional in local dev; Vite proxies /api and /socket.io)
cp client/.env.example client/.env
```

### 3. Run Development Server
Start the shared watcher, Express backend (`:3001`), and Vite client (`:5173`) concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Build & Test

### Build All Workspaces
Compiles TypeScript across `shared`, `server`, and generates the optimized production bundle in `client/dist`:
```bash
npm run build
```

### Run Automated Tests
Executes the comprehensive Vitest suite covering room lifecycles, state machine transitions, night actions, voting, and lobby lounge mechanics:
```bash
npm test
```

### Automated Bot Simulation
Run a full headless 6-player end-to-end game simulation through the server:
```bash
npm run simulate:bots --workspace=@midnight-city/server
```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Server listening port |
| `CLIENT_ORIGIN` | `*` | Allowed CORS origin (set to your frontend domain in production) |
| `STUN_URLS` | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` | STUN servers for WebRTC NAT traversal |
| `TURN_URL` | *(empty)* | Optional TURN server URL (e.g. `turn:turn.example.com:3478`) |
| `TURN_USERNAME`| *(empty)* | TURN server username |
| `TURN_CREDENTIAL`| *(empty)* | TURN server password / secret |

### Client (`client/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | *(empty — same origin)* | Full backend URL (e.g. `https://midnight-city-server.onrender.com`) |
| `VITE_TURN_URL` | *(empty)* | Fallback client TURN URL if `/api/ice-servers` is not configured |
| `VITE_TURN_USERNAME`| *(empty)* | Fallback client TURN username |
| `VITE_TURN_CREDENTIAL`| *(empty)* | Fallback client TURN credential |

---

## Voice Chat & WebRTC Guidance

- **Peer-to-Peer Mesh**: Audio is transmitted directly between peers via WebRTC. This provides low-latency voice without requiring expensive media servers.
- **Recommended Group Size**: Mesh connections scale at $N-1$ connections per peer. `MeshVoiceProvider` is optimized for **up to 8 active voice participants**.
- **TURN Relay Requirement**: In real-world networks with symmetric NATs, cellular data, or corporate firewalls, direct P2P connections may fail. For production reliability, provide TURN credentials (via Twilio, Metered, Cloudflare Calls, or self-hosted coturn) in `server/.env`.

---

## Production Deployment

### 1. Deploy Server (Render / Railway / Fly.io)
1. Set the root directory to repository root.
2. **Build Command**:
   ```bash
   npm install && npm run build:shared && npm run build:server
   ```
3. **Start Command**:
   ```bash
   npm run start --workspace=@midnight-city/server
   ```
4. Set environment variables:
   - `CLIENT_ORIGIN=https://your-app.vercel.app`
   - `PORT=3001`
   - Optional: `STUN_URLS`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`
5. Verify server health at `https://your-server.onrender.com/health`.

### 2. Deploy Client (Vercel / Netlify)
1. Connect your GitHub repository.
2. **Build Command**:
   ```bash
   npm install && npm run build:shared && npm run build:client
   ```
3. **Output Directory**: `client/dist`
4. Set environment variables:
   - `VITE_SERVER_URL=https://your-server.onrender.com`
5. Single-page application rewrites are pre-configured in `client/vercel.json` and `client/public/_redirects`.

---

## License

MIT © [Harshit Bisht](https://github.com/harshitbisht)
