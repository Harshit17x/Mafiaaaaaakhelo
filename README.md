# MAFIA — Midnight City

A real-time multiplayer social deduction party game for 5–16 players, set in a 1940s film noir city with built-in WebRTC voice chat, Web Audio API synthesized soundscapes, and server-authoritative game state.

## Architecture

- **`/shared`**: Shared TypeScript domain types, validation helpers, constants, and typed Socket.IO events (`@midnight-city/shared`).
- **`/server`**: Node.js + Express + Socket.IO authoritative backend (`@midnight-city/server`), including a pure deterministic game engine (`/server/src/engine`), per-viewer state & chat filtering (`/server/src/viewFilter.ts`), per-phase voice channel permissions (`/server/src/voiceState.ts`), and an `InMemoryRoomRepository` behind a `RoomRepository` interface so a persistent database can be plugged in later.
- **`/client`**: React + Vite + TypeScript + TailwindCSS + Framer Motion + Zustand frontend (`@midnight-city/client`), including a `VoiceProvider` interface and `MeshVoiceProvider` implementation (`/client/src/voice`), and synthesized Web Audio sound effects & ambient loops (`/client/src/audio/SoundEngine.ts`).

## Local Setup

1. Install dependencies from the workspace root:
   ```bash
   npm install
   ```
2. Optional environment configuration:
   - Copy `/server/.env.example` to `/server/.env`
   - Copy `/client/.env.example` to `/client/.env` (only needed if running client against a remote server; Vite proxies `/socket.io` and `/api` to `localhost:3001` in development).
3. Start development servers (shared watcher + Express/Socket.IO server on `:3001` + Vite client on `:5173`):
   ```bash
   npm run dev
   ```
4. Build all packages:
   ```bash
   npm run build
   ```
5. Run unit and integration tests:
   ```bash
   npm test
   ```
6. Run the automated 6-bot end-to-end simulation:
   ```bash
   npm run simulate:bots --workspace=@midnight-city/server
   ```
   (Set `SERVER_URL=http://localhost:3001` to target an already-running dev server, or omit it to spin up an ephemeral server automatically.)

## Environment Variables

### Server (`/server/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP & Socket.IO listening port |
| `CLIENT_ORIGIN` | `*` | Allowed CORS origin(s) for Express & Socket.IO (set to your Vercel/Netlify URL in production) |
| `STUN_URLS` | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` | Comma-separated STUN server URLs served via `/api/ice-servers` |
| `TURN_URL` | *(empty)* | Optional TURN server URL (e.g. `turn:turn.example.com:3478` or `turns:turn.example.com:5349`) |
| `TURN_USERNAME` | *(empty)* | Username for the TURN server |
| `TURN_CREDENTIAL` | *(empty)* | Password/credential for the TURN server |

### Client (`/client/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_SERVER_URL` | *(empty — same origin / Vite proxy)* | Public URL of the deployed server (e.g. `https://midnight-city-server.onrender.com`) |
| `VITE_TURN_URL` | *(empty)* | Optional client-side fallback TURN URL if `/api/ice-servers` is not configured |
| `VITE_TURN_USERNAME` | *(empty)* | Optional client-side fallback TURN username |
| `VITE_TURN_CREDENTIAL` | *(empty)* | Optional client-side fallback TURN credential |

## Voice Chat Architecture, Mesh Limits & TURN Requirement

- **Provider Abstraction**: Voice runs behind `VoiceProvider` (`/client/src/voice/VoiceProvider.ts`) and defaults to `MeshVoiceProvider` (audio-only WebRTC peer-to-peer mesh signaled over Socket.IO). A `LiveKitVoiceProvider` (SFU) can be dropped in later by implementing `VoiceProvider` without changing any game logic.
- **Mesh Size Guidance**: Because peer-to-peer mesh creates $N-1$ upstream/downstream audio connections per player, `MeshVoiceProvider` is recommended for **up to ~8 players**. Larger lobbies (9–16 players) should migrate to an SFU provider such as LiveKit.
- **Why a TURN Server Is Needed**: STUN alone cannot traverse symmetric NATs, cellular carrier CGNATs, or strict corporate/university firewalls. For reliable voice across all players in production, configure a TURN relay (such as Metered, Twilio NTS, Cloudflare Calls TURN, or self-hosted `coturn`) via `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` on the server.

## Deployment

### 1. Deploy Server (Render or Railway)

1. Point the service to the repository root.
2. **Build Command**:
   ```bash
   npm install && npm run build:shared && npm run build:server
   ```
3. **Start Command**:
   ```bash
   npm run start --workspace=@midnight-city/server
   ```
4. Set environment variables:
   - `CLIENT_ORIGIN=https://your-client-domain.vercel.app`
   - `STUN_URLS`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`
5. Verify health check at `GET /health`.

### 2. Deploy Client (Vercel or Netlify)

1. Connect the repository.
2. **Build Command**:
   ```bash
   npm install && npm run build:shared && npm run build:client
   ```
3. **Output Directory**: `client/dist`
4. Set environment variable:
   - `VITE_SERVER_URL=https://your-server-domain.onrender.com`
5. SPA routing is pre-configured via `/client/vercel.json` and `/client/public/_redirects`.


# Mafiaaaaaakhelo
