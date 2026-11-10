import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientRoomView,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@midnight-city/shared';
import { createMidnightCityServer } from '../src/app.js';
import type { MidnightCityServer } from '../src/app.js';

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>;

function emitAsync<T = { ok: boolean; error?: string }>(
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

describe('Phase 4: Human Host mode and God View', () => {
  const servers: MidnightCityServer[] = [];
  const clients: TestClient[] = [];

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.length = 0;
    for (const s of servers) await s.stop();
    servers.length = 0;
  });

  it('walks through Human Host manual night steps, God View live updates, and vote controls', async () => {
    const srv = createMidnightCityServer({ tickIntervalMs: 100 });
    servers.push(srv);
    await new Promise<void>((resolve) =>
      srv.httpServer.listen(0, '127.0.0.1', () => resolve())
    );
    const addr = srv.httpServer.address();
    if (!addr || typeof addr === 'string') throw new Error('bad address');
    const url = `http://127.0.0.1:${addr.port}`;

    const connect = async () => {
      const socket: TestClient = ioClient(url, {
        transports: ['websocket'],
        forceNew: true,
      });
      clients.push(socket);
      let latest: ClientRoomView | null = null;
      socket.on('room:state', (s) => {
        latest = s;
      });
      await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
      return { socket, getState: () => latest! };
    };

    const host = await connect();
    const createRes = await emitAsync<{ ok: boolean; roomCode: string }>(
      host.socket,
      'room:create',
      { playerName: 'Director' }
    );
    expect(createRes.ok).toBe(true);
    const roomCode = createRes.roomCode;

    const players: Awaited<ReturnType<typeof connect>>[] = [];
    for (let i = 0; i < 5; i += 1) {
      const p = await connect();
      await emitAsync(p.socket, 'room:join', { roomCode, playerName: `Actor${i + 1}` });
      players.push(p);
    }

    await emitAsync(host.socket, 'room:update_settings', {
      settings: {
        narratorMode: 'HUMAN_HOST',
        healerEnabled: true,
        detectiveEnabled: true,
      },
    });
    for (const p of players) {
      await emitAsync(p.socket, 'room:set_ready', { ready: true });
    }
    await emitAsync(host.socket, 'game:start');
    await new Promise((r) => setTimeout(r, 60));

    expect(host.getState().game.phase).toBe('ROLE_REVEAL');
    expect(host.getState().game.godView).not.toBeNull();
    expect(host.getState().players.every((pl) => !pl.isPlaying || pl.role !== null)).toBe(true);

    for (const p of players) {
      expect(p.getState().game.godView).toBeNull();
      await emitAsync(p.socket, 'game:acknowledge_role');
    }
    await new Promise((r) => setTimeout(r, 60));

    expect(host.getState().game.phase).toBe('NIGHT');
    expect(host.getState().game.godView?.actualNightSubPhase).toBe('SLEEPING');

    await emitAsync(host.socket, 'host:advance_night_step', {});
    await new Promise((r) => setTimeout(r, 60));
    expect(host.getState().game.godView?.actualNightSubPhase).toBe('MAFIA_TURN');

    const mafia = players.find((p) => p.getState().game.myRole === 'MAFIA')!;
    const healer = players.find((p) => p.getState().game.myRole === 'HEALER')!;
    const detective = players.find((p) => p.getState().game.myRole === 'DETECTIVE')!;
    const villager = players.find((p) => p.getState().game.myRole === 'VILLAGER')!;
    const villagerId = villager.getState().myPlayerId;

    await emitAsync(mafia.socket, 'game:night_mafia_select', {
      targetPlayerId: villagerId,
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.godView?.nightOutcome.pendingMafiaTargetId).toBe(villagerId);

    await emitAsync(host.socket, 'host:advance_night_step', {});
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.godView?.actualNightSubPhase).toBe('HEALER_TURN');

    await emitAsync(healer.socket, 'game:night_healer_select', {
      targetPlayerId: villagerId,
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.godView?.nightOutcome.projectedSavedByHealer).toBe(true);

    await emitAsync(host.socket, 'host:advance_night_step', {});
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.godView?.actualNightSubPhase).toBe('DETECTIVE_TURN');

    await emitAsync(detective.socket, 'game:night_detective_select', {
      targetPlayerId: mafia.getState().myPlayerId,
    });
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.godView?.detectiveResult?.isMafia).toBe(true);

    await emitAsync(host.socket, 'host:advance_night_step', {});
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.phase).toBe('DAWN');
    expect(host.getState().game.dawn?.killedPlayerId).toBeNull();

    await emitAsync(host.socket, 'host:start_discussion');
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.phase).toBe('DAY_DISCUSSION');

    await emitAsync(host.socket, 'host:start_vote');
    await new Promise((r) => setTimeout(r, 40));
    expect(host.getState().game.phase).toBe('DAY_VOTE');

    for (const p of players) {
      const targetId =
        p.getState().myPlayerId === mafia.getState().myPlayerId
          ? villagerId
          : mafia.getState().myPlayerId;
      await emitAsync(p.socket, 'game:cast_vote', { targetId });
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(host.getState().game.phase).toBe('VOTE_RESULT');

    await emitAsync(host.socket, 'host:advance_from_vote_result');
    await new Promise((r) => setTimeout(r, 50));
    expect(host.getState().game.phase).toBe('GAME_OVER');
    expect(host.getState().game.winners).toEqual(['CITY']);
  });
});

