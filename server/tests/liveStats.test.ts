import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  AckResponse,
  ClientToServerEvents,
  JoinSuccessPayload,
  LiveServerStats,
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

async function waitForCondition(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('Live server stats counter', () => {
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

  async function startTestServer() {
    const srv = createMidnightCityServer({
      tickIntervalMs: 50,
      disconnectGraceMs: 400,
    });
    servers.push(srv);
    await new Promise<void>((resolve) => {
      srv.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = srv.httpServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to get server port');
    }
    return { srv, url: `http://127.0.0.1:${addr.port}` };
  }

  async function connectObserver(url: string) {
    const socket: TestClient = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
    });
    clients.push(socket);
    const statsHistory: LiveServerStats[] = [];
    socket.on('server:stats', (stats) => {
      statsHistory.push(stats);
    });
    socket.connect();
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    await waitForCondition(() => statsHistory.length >= 1);
    return {
      socket,
      statsHistory,
      latest: () => statsHistory[statsHistory.length - 1]!,
    };
  }

  it('pushes real-time player counts on connect, room join, game start, leave, and disconnect', async () => {
    const { url } = await startTestServer();

    // Observer sitting on the title screen receives live stats immediately
    const observer = await connectObserver(url);
    expect(observer.latest()).toEqual({
      playersInRooms: 0,
      playersInGame: 0,
      activeRooms: 0,
      onlineCount: 1,
    });

    // Connect 5 players and seat them in a room
    const players = await Promise.all(
      Array.from({ length: 5 }, () => connectObserver(url))
    );
    await waitForCondition(() => observer.latest().onlineCount === 6);

    const createRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
      players[0]!.socket,
      'room:create',
      { playerName: 'Host' }
    );
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    await waitForCondition(
      () =>
        observer.latest().playersInRooms === 1 &&
        observer.latest().activeRooms === 1
    );

    for (let i = 1; i < players.length; i += 1) {
      const joinRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
        players[i]!.socket,
        'room:join',
        { roomCode: createRes.roomCode, playerName: `Player${i}` }
      );
      expect(joinRes.ok).toBe(true);
    }

    await waitForCondition(() => observer.latest().playersInRooms === 5);
    expect(observer.latest()).toEqual({
      playersInRooms: 5,
      playersInGame: 0,
      activeRooms: 1,
      onlineCount: 6,
    });

    // Ready up and start the match -> playersInGame becomes 5
    for (const p of players) {
      await emitAsync<AckResponse>(p.socket, 'room:set_ready', { ready: true });
    }
    const startRes = await emitAsync<AckResponse>(players[0]!.socket, 'game:start');
    expect(startRes.ok).toBe(true);

    await waitForCondition(() => observer.latest().playersInGame === 5);
    expect(observer.latest()).toEqual({
      playersInRooms: 5,
      playersInGame: 5,
      activeRooms: 1,
      onlineCount: 6,
    });

    // Verify HTTP /api/stats endpoint matches live socket state
    const statsRes = await fetch(`${url}/api/stats`);
    expect(statsRes.status).toBe(200);
    expect(await statsRes.json()).toEqual({
      playersInRooms: 5,
      playersInGame: 5,
      activeRooms: 1,
      onlineCount: 6,
    });

    // Disconnect one player -> connected playersInRooms, playersInGame, and onlineCount drop
    players[4]!.socket.disconnect();
    await waitForCondition(
      () =>
        observer.latest().playersInRooms === 4 &&
        observer.latest().onlineCount === 5
    );
    expect(observer.latest().playersInGame).toBe(4);
  });
});

