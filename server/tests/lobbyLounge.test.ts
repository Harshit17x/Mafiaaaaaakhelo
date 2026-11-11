import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  AckResponse,
  ClientRoomView,
  ClientToServerEvents,
  JoinSuccessPayload,
  LobbyCharacterPosition,
  ServerToClientEvents,
} from '@midnight-city/shared';
import { createMidnightCityServer } from '../src/app.js';
import type { MidnightCityServer } from '../src/app.js';

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

async function waitForCondition(predicate: () => boolean, timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((r) => setTimeout(r, 15));
  }
}

describe('Lobby waiting lounge: character movement & all-ready countdown', () => {
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

  async function startTestServer(lobbyCountdownMs = 150) {
    const srv = createMidnightCityServer({
      tickIntervalMs: 30,
      disconnectGraceMs: 400,
      lobbyCountdownMs,
    });
    servers.push(srv);
    await new Promise<void>((resolve) => {
      srv.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = srv.httpServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to get server port');
    }
    return `http://127.0.0.1:${addr.port}`;
  }

  async function connectClient(url: string) {
    const socket: TestClient = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
    });
    clients.push(socket);
    const states: ClientRoomView[] = [];
    const positionUpdates: Record<string, LobbyCharacterPosition>[] = [];
    socket.on('room:state', (state) => states.push(state));
    socket.on('lobby:positions', (positions) => positionUpdates.push(positions));
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    return {
      socket,
      latestState: () => states[states.length - 1],
      latestPositions: () => positionUpdates[positionUpdates.length - 1],
    };
  }

  it('syncs bounded character movement and runs automatic countdown when everyone is ready', async () => {
    const url = await startTestServer(180);
    const host = await connectClient(url);
    const createRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
      host.socket,
      'room:create',
      { playerName: 'Host' }
    );
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const guests = await Promise.all([
      connectClient(url),
      connectClient(url),
      connectClient(url),
      connectClient(url),
    ]);

    const guestIds: string[] = [];
    for (let i = 0; i < guests.length; i += 1) {
      const joinRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
        guests[i]!.socket,
        'room:join',
        { roomCode: createRes.roomCode, playerName: `Guest${i + 1}` }
      );
      expect(joinRes.ok).toBe(true);
      if (joinRes.ok) {
        guestIds.push(joinRes.playerId);
      }
    }

    const all = [host, ...guests];
    await waitForCondition(() => (host.latestState()?.players.length ?? 0) === 5);

    // Every player spawns in lobbyPositions
    for (const id of [createRes.playerId, ...guestIds]) {
      expect(host.latestState()?.lobbyPositions[id]).toBeDefined();
    }

    // Character movement updates broadcast & clamp coordinates safely
    guests[0]!.socket.emit('lobby:move', {
      x: 1500,
      y: 20,
      facing: 'left',
      moving: true,
    });
    await waitForCondition(() => Boolean(host.latestPositions()?.[guestIds[0]!]));
    const movedPos = host.latestPositions()![guestIds[0]!]!;
    expect(movedPos.x).toBe(945);
    expect(movedPos.y).toBe(115);
    expect(movedPos.facing).toBe('left');
    expect(movedPos.moving).toBe(true);

    // Countdown does not start until ALL 5 players are ready
    for (let i = 0; i < 4; i += 1) {
      await emitAsync(all[i]!.socket, 'room:set_ready', { ready: true });
    }
    expect(host.latestState()?.game.lobbyCountdownEndsAt).toBeNull();

    // Final player marks ready -> countdown starts automatically
    await emitAsync(all[4]!.socket, 'room:set_ready', { ready: true });
    await waitForCondition(() => host.latestState()?.game.lobbyCountdownEndsAt !== null);
    expect(host.latestState()?.game.phase).toBe('LOBBY');

    // Unreadying cancels the countdown
    await emitAsync(all[2]!.socket, 'room:set_ready', { ready: false });
    await waitForCondition(() => host.latestState()?.game.lobbyCountdownEndsAt === null);
    expect(host.latestState()?.game.phase).toBe('LOBBY');

    // Re-readying starts countdown again and transitions to ROLE_REVEAL automatically
    await emitAsync(all[2]!.socket, 'room:set_ready', { ready: true });
    await waitForCondition(() => host.latestState()?.game.phase === 'ROLE_REVEAL');
    expect(host.latestState()?.game.lobbyCountdownEndsAt).toBeNull();
  });
});

