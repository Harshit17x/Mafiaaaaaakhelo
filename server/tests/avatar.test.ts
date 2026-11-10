import { afterEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import {
  createDefaultAvatarConfig,
  sanitizeAvatarConfig,
} from '@midnight-city/shared';
import type {
  AckResponse,
  ClientRoomView,
  ClientToServerEvents,
  JoinSuccessPayload,
  PlayerAvatarConfig,
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

describe('Avatar config validation and live room sync', () => {
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
    return `http://127.0.0.1:${addr.port}`;
  }

  async function connectClient(url: string) {
    const socket: TestClient = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
    });
    clients.push(socket);
    const states: ClientRoomView[] = [];
    socket.on('room:state', (view) => {
      states.push(view);
    });
    socket.connect();
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    return {
      socket,
      latestState: () => states[states.length - 1],
    };
  }

  it('sanitizes avatar fields, clamps bounds, and rejects unsafe custom URLs', () => {
    const seeded = createDefaultAvatarConfig('Vance');
    expect(seeded.presetId).toBeTruthy();

    const validCustom = sanitizeAvatarConfig({
      presetId: 'custom',
      filter: 'sepia',
      pinColor: 'gold',
      frameTint: 'aged',
      tilt: 12,
      zoom: 2.5,
      offsetX: -60,
      offsetY: 44,
      caption: ' <The> Boss\n  Supreme ',
      customDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    });

    expect(validCustom.presetId).toBe('custom');
    expect(validCustom.filter).toBe('sepia');
    expect(validCustom.pinColor).toBe('gold');
    expect(validCustom.frameTint).toBe('aged');
    expect(validCustom.tilt).toBe(6);
    expect(validCustom.zoom).toBe(1.5);
    expect(validCustom.offsetX).toBe(-25);
    expect(validCustom.offsetY).toBe(25);
    expect(validCustom.caption).toBe('The Boss Supreme');
    expect(validCustom.customDataUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');

    const unsafeSvg = sanitizeAvatarConfig(
      {
        presetId: 'custom',
        customDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      },
      'Host'
    );
    expect(unsafeSvg.presetId).not.toBe('custom');
    expect(unsafeSvg.customDataUrl).toBeNull();
  });

  it('persists avatars across room create/join and broadcasts live room:update_avatar changes', async () => {
    const url = await startTestServer();
    const host = await connectClient(url);
    const guest = await connectClient(url);

    const outOfRoomRes = await emitAsync<AckResponse>(host.socket, 'room:update_avatar', {
      avatar: createDefaultAvatarConfig('Nope'),
    });
    expect(outOfRoomRes.ok).toBe(false);

    const hostAvatar: PlayerAvatarConfig = {
      presetId: 'suit-cat',
      filter: 'noir',
      pinColor: 'red',
      frameTint: 'gold',
      tilt: 2.5,
      zoom: 1.15,
      offsetX: 4,
      offsetY: -3,
      caption: 'Consigliere',
      customDataUrl: null,
    };

    const createRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
      host.socket,
      'room:create',
      { playerName: 'Alice', avatar: hostAvatar }
    );
    expect(createRes.ok).toBe(true);
    if (!createRes.ok) return;

    const guestAvatar: PlayerAvatarConfig = {
      presetId: 'ushanka-shiba',
      filter: 'sepia',
      pinColor: 'gold',
      frameTint: 'aged',
      tilt: -3,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      caption: 'Comrade',
      customDataUrl: null,
    };

    const joinRes = await emitAsync<AckResponse<JoinSuccessPayload>>(
      guest.socket,
      'room:join',
      { roomCode: createRes.roomCode, playerName: 'Bob', avatar: guestAvatar }
    );
    expect(joinRes.ok).toBe(true);

    await waitForCondition(() => (host.latestState()?.players.length ?? 0) === 2);

    const hostViewAlice = host.latestState()!.players.find((p) => p.name === 'Alice');
    const hostViewBob = host.latestState()!.players.find((p) => p.name === 'Bob');
    expect(hostViewAlice?.avatar.presetId).toBe('suit-cat');
    expect(hostViewAlice?.avatar.caption).toBe('Consigliere');
    expect(hostViewBob?.avatar.presetId).toBe('ushanka-shiba');
    expect(hostViewBob?.avatar.filter).toBe('sepia');

    const updatedGuestAvatar: PlayerAvatarConfig = {
      presetId: 'bandana-kid',
      filter: 'vivid',
      pinColor: 'teal',
      frameTint: 'charcoal',
      tilt: 1.5,
      zoom: 1.3,
      offsetX: -5,
      offsetY: 2,
      caption: 'Rebel #1',
      customDataUrl: null,
    };

    const updateRes = await emitAsync<AckResponse>(guest.socket, 'room:update_avatar', {
      avatar: updatedGuestAvatar,
    });
    expect(updateRes.ok).toBe(true);

    await waitForCondition(
      () =>
        host.latestState()?.players.find((p) => p.name === 'Bob')?.avatar.presetId ===
        'bandana-kid'
    );

    const liveBob = host.latestState()!.players.find((p) => p.name === 'Bob')!;
    expect(liveBob.avatar.filter).toBe('vivid');
    expect(liveBob.avatar.pinColor).toBe('teal');
    expect(liveBob.avatar.frameTint).toBe('charcoal');
    expect(liveBob.avatar.zoom).toBe(1.3);
    expect(liveBob.avatar.caption).toBe('Rebel #1');
  });
});

