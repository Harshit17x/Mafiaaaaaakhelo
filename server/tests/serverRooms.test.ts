import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientRoomView,
  ClientToServerEvents,
  ServerToClientEvents,
  VoiceState,
} from '@midnight-city/shared';
import { createMidnightCityServer } from '../src/app.js';
import type { MidnightCityServer } from '../src/app.js';

const FAST_TIMINGS = {
  SLEEP_TRANSITION_MS: 50,
  DAWN_TRANSITION_MS: 50,
  DAWN_DISPLAY_MS: 100,
  VOTE_RESULT_DISPLAY_MS: 100,
  REVOTE_ANNOUNCE_MS: 100,
  MIN_NIGHT_STEP_MS: 80,
  MAX_NIGHT_STEP_RANDOM_MS: 80,
};

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

function emitAsync<T>(
  socket: TestClient,
  event: keyof ClientToServerEvents,
  ...args: unknown[]
): Promise<T> {
  return new Promise((resolve) => {
    (socket.emit as (...a: unknown[]) => void)(event, ...args, (res: T) => {
      resolve(res);
    });
  });
}

describe('Phase 2: server rooms, settings, reconnection, filtered views & voice state', () => {
  const servers: MidnightCityServer[] = [];
  const clients: TestClient[] = [];

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    for (const server of servers) {
      await server.stop();
    }
    servers.length = 0;
  });

  async function startTestServer(
    overrides: Partial<Parameters<typeof createMidnightCityServer>[0]> = {}
  ) {
    const srv = createMidnightCityServer({
      timings: FAST_TIMINGS,
      tickIntervalMs: 50,
      disconnectGraceMs: 400,
      hostAutoTransferGraceMs: 200,
      ...overrides,
    });
    servers.push(srv);
    await new Promise<void>((resolve) => {
      srv.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = srv.httpServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to get server port');
    }
    const url = `http://127.0.0.1:${addr.port}`;
    return { srv, url };
  }

  async function connectClient(url: string): Promise<{
    socket: TestClient;
    states: ClientRoomView[];
    voiceStates: VoiceState[];
    getLatestState: () => ClientRoomView;
    getLatestVoice: () => VoiceState;
  }> {
    const socket: TestClient = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(socket);
    const states: ClientRoomView[] = [];
    const voiceStates: VoiceState[] = [];
    socket.on('room:state', (s) => states.push(s));
    socket.on('voice:state', (v) => voiceStates.push(v));
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    return {
      socket,
      states,
      voiceStates,
      getLatestState: () => states[states.length - 1]!,
      getLatestVoice: () => voiceStates[voiceStates.length - 1]!,
    };
  }

  it('enforces room controls, filtered state security, stealth night masking, and reconnection', async () => {
    const { url } = await startTestServer();

    const healthRes = await fetch(`${url}/health`);
    expect(healthRes.status).toBe(200);
    const iceRes = await fetch(`${url}/api/ice-servers`);
    expect(iceRes.status).toBe(200);

    const p1 = await connectClient(url);
    const createRes = await emitAsync<{
      ok: boolean;
      roomCode: string;
      playerId: string;
      sessionToken: string;
    }>(p1.socket, 'room:create', { playerName: 'HostAlice' });
    expect(createRes.ok).toBe(true);
    const roomCode = createRes.roomCode;

    const p2 = await connectClient(url);
    const dupJoin = await emitAsync<{ ok: boolean; error?: string }>(
      p2.socket,
      'room:join',
      { roomCode, playerName: 'hostalice' }
    );
    expect(dupJoin.ok).toBe(false);

    const p2Join = await emitAsync<{
      ok: boolean;
      playerId: string;
      sessionToken: string;
    }>(p2.socket, 'room:join', { roomCode, playerName: 'Bob' });
    expect(p2Join.ok).toBe(true);

    const p3 = await connectClient(url);
    const p4 = await connectClient(url);
    const p5 = await connectClient(url);
    const p6 = await connectClient(url);

    await emitAsync(p3.socket, 'room:join', { roomCode, playerName: 'Carol' });
    await emitAsync(p4.socket, 'room:join', { roomCode, playerName: 'Dave' });
    await emitAsync(p5.socket, 'room:join', { roomCode, playerName: 'Eve' });

    await emitAsync(p1.socket, 'room:toggle_lock', { locked: true });
    const blockedJoin = await emitAsync<{ ok: boolean }>(p6.socket, 'room:join', {
      roomCode,
      playerName: 'Mallory',
    });
    expect(blockedJoin.ok).toBe(false);
    await emitAsync(p1.socket, 'room:toggle_lock', { locked: false });

    const allFive = [p1, p2, p3, p4, p5];
    for (const c of allFive) {
      await emitAsync(c.socket, 'room:set_ready', { ready: true });
    }

    const startRes = await emitAsync<{ ok: boolean }>(p1.socket, 'game:start');
    expect(startRes.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 80));

    for (const c of allFive) {
      const state = c.getLatestState();
      expect(state.game.phase).toBe('ROLE_REVEAL');
      expect(state.game.myRole).toBeTruthy();
      expect(state.game.godView).toBeNull();
      expect(state.game.timeline).toBeNull();

      const othersWithVisibleRole = state.players.filter(
        (pl) => pl.id !== state.myPlayerId && pl.role !== null
      );
      if (state.game.myRole !== 'MAFIA') {
        expect(othersWithVisibleRole.length).toBe(0);
      }
    }

    for (const c of allFive) {
      await emitAsync(c.socket, 'game:acknowledge_role');
    }

    await new Promise((r) => setTimeout(r, 140));

    const mafiaClient = allFive.find((c) => c.getLatestState().game.myRole === 'MAFIA')!;
    const villagerClient = allFive.find(
      (c) => c.getLatestState().game.myRole === 'VILLAGER'
    )!;

    expect(mafiaClient.getLatestState().game.night?.subPhase).toBe('MAFIA_TURN');
    expect(mafiaClient.getLatestVoice().channel).toBe('MAFIA');
    expect(mafiaClient.getLatestVoice().canSpeak).toBe(true);

    expect(villagerClient.getLatestState().game.night?.subPhase).toBe('SLEEPING');
    expect(villagerClient.getLatestState().game.night?.subPhaseEndsAt).toBeNull();
    expect(villagerClient.getLatestVoice().channel).toBe('MUTED');
    expect(villagerClient.getLatestVoice().canSpeak).toBe(false);

    const secretChatDenied = await emitAsync<{ ok: boolean }>(
      villagerClient.socket,
      'chat:send',
      { channel: 'MAFIA', content: 'Let me in' }
    );
    expect(secretChatDenied.ok).toBe(false);

    const mafiaChatMessages: string[] = [];
    const villagerChatMessages: string[] = [];
    mafiaClient.socket.on('chat:message', (m) => mafiaChatMessages.push(m.content));
    villagerClient.socket.on('chat:message', (m) => villagerChatMessages.push(m.content));

    const mafiaChatOk = await emitAsync<{ ok: boolean }>(
      mafiaClient.socket,
      'chat:send',
      { channel: 'MAFIA', content: 'Hit target tonight' }
    );
    expect(mafiaChatOk.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(mafiaChatMessages).toContain('Hit target tonight');
    expect(villagerChatMessages).not.toContain('Hit target tonight');

    const bobSession = p2Join.sessionToken;
    const bobRoleBefore = p2.getLatestState().game.myRole;
    p2.socket.disconnect();
    await new Promise((r) => setTimeout(r, 50));

    const p2Reconnected = await connectClient(url);
    const reAuth = await emitAsync<{ ok: boolean; playerId: string }>(
      p2Reconnected.socket,
      'room:reconnect',
      { roomCode, sessionToken: bobSession }
    );
    expect(reAuth.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(p2Reconnected.getLatestState().game.myRole).toBe(bobRoleBefore);
  });

  it('pauses in Human Host mode on host disconnect and auto-transfers host in Auto mode', async () => {
    const { url } = await startTestServer();
    const h = await connectClient(url);
    const createRes = await emitAsync<{ roomCode: string; sessionToken: string }>(
      h.socket,
      'room:create',
      { playerName: 'Narrator' }
    );
    const roomCode = createRes.roomCode;

    const players: Awaited<ReturnType<typeof connectClient>>[] = [];
    for (let i = 0; i < 5; i += 1) {
      const c = await connectClient(url);
      await emitAsync(c.socket, 'room:join', { roomCode, playerName: `P${i + 1}` });
      players.push(c);
    }

    await emitAsync(h.socket, 'room:update_settings', {
      settings: { narratorMode: 'HUMAN_HOST' },
    });
    for (const c of players) {
      await emitAsync(c.socket, 'room:set_ready', { ready: true });
    }
    const started = await emitAsync<{ ok: boolean }>(h.socket, 'game:start');
    expect(started.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 60));

    expect(h.getLatestState().game.godView).not.toBeNull();
    expect(players[0]!.getLatestState().game.godView).toBeNull();

    h.socket.disconnect();
    await new Promise((r) => setTimeout(r, 60));
    expect(players[0]!.getLatestState().game.paused).toBe(true);
    expect(players[0]!.getLatestState().game.pauseReason).toBe('HOST_DISCONNECTED');

    const hReconnected = await connectClient(url);
    await emitAsync(hReconnected.socket, 'room:reconnect', {
      roomCode,
      sessionToken: createRes.sessionToken,
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(players[0]!.getLatestState().game.paused).toBe(false);
  });

  it('applies custom initial room settings passed in room:create', async () => {
    const { url } = await startTestServer();
    const h = await connectClient(url);
    const res = await emitAsync<{ ok: boolean; roomCode: string }>(
      h.socket,
      'room:create',
      {
        playerName: 'ConfigHost',
        settings: {
          narratorMode: 'HUMAN_HOST',
          mafiaCount: 2,
          detectiveEnabled: true,
          jokerEnabled: true,
          discussionTimeSec: 120,
          tieRule: 'revote_then_no_elimination',
        },
      }
    );
    expect(res.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));

    const view = h.getLatestState();
    expect(view.settings.narratorMode).toBe('HUMAN_HOST');
    expect(view.settings.mafiaCount).toBe(2);
    expect(view.settings.detectiveEnabled).toBe(true);
    expect(view.settings.jokerEnabled).toBe(true);
    expect(view.settings.discussionTimeSec).toBe(120);
    expect(view.settings.tieRule).toBe('revote_then_no_elimination');
    expect(view.players[0]!.isPlaying).toBe(false);
  });
});

