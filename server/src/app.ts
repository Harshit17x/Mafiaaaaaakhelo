import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server as SocketIoServer } from 'socket.io';
import type {
  ClientToServerEvents,
  IceServerConfig,
  ServerToClientEvents,
} from '@midnight-city/shared';
import type { EngineTimings } from './engine/index.js';
import { SocketRateLimiter } from './rateLimiter.js';
import { RoomManager } from './roomManager.js';
import { InMemoryRoomRepository } from './roomStore.js';
import type { RoomRepository } from './roomStore.js';
import {
  createSocketIoEmitter,
  createStatsBroadcaster,
  registerSocketHandlers,
} from './socketHandlers.js';

export interface CreateServerOptions {
  clientOrigin?: string | string[];
  timings?: EngineTimings;
  disconnectGraceMs?: number;
  hostAutoTransferGraceMs?: number;
  tickIntervalMs?: number;
  repository?: RoomRepository;
}

export interface MidnightCityServer {
  app: express.Express;
  httpServer: HttpServer;
  io: SocketIoServer<ClientToServerEvents, ServerToClientEvents>;
  manager: RoomManager;
  repository: RoomRepository;
  stop: () => Promise<void>;
}

export function getIceServersFromEnv(): IceServerConfig[] {
  const stunRaw =
    process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
  const stunUrls = stunRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const iceServers: IceServerConfig[] = [];
  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  const turnUrl = process.env.TURN_URL?.trim();
  if (turnUrl) {
    const turnConfig: IceServerConfig = { urls: turnUrl };
    if (process.env.TURN_USERNAME) {
      turnConfig.username = process.env.TURN_USERNAME;
    }
    if (process.env.TURN_CREDENTIAL) {
      turnConfig.credential = process.env.TURN_CREDENTIAL;
    }
    iceServers.push(turnConfig);
  }

  return iceServers;
}

export function createMidnightCityServer(
  options: CreateServerOptions = {}
): MidnightCityServer {
  const origin = options.clientOrigin ?? process.env.CLIENT_ORIGIN ?? '*';
  const app = express();
  app.use(cors({ origin }));
  app.use(express.json());

  const repository = options.repository ?? new InMemoryRoomRepository();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: repository.list().length });
  });

  app.get('/api/ice-servers', (_req, res) => {
    res.json({ iceServers: getIceServersFromEnv() });
  });

  const httpServer = createServer(app);
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin,
      methods: ['GET', 'POST'],
    },
  });

  const statsBroadcaster = createStatsBroadcaster(io, repository);

  app.get('/api/stats', (_req, res) => {
    res.json(statsBroadcaster.getStats());
  });

  const emitter = createSocketIoEmitter(io, () => {
    statsBroadcaster.broadcastIfChanged();
  });
  const manager = new RoomManager({
    repository,
    emitter,
    timings: options.timings,
    disconnectGraceMs: options.disconnectGraceMs,
    hostAutoTransferGraceMs: options.hostAutoTransferGraceMs,
  });

  const rateLimiter = new SocketRateLimiter();
  registerSocketHandlers(io, manager, rateLimiter, statsBroadcaster);

  const tickIntervalMs = options.tickIntervalMs ?? 250;
  const interval = setInterval(() => {
    manager.tick();
    statsBroadcaster.broadcastIfChanged();
  }, tickIntervalMs);

  return {
    app,
    httpServer,
    io,
    manager,
    repository,
    async stop() {
      clearInterval(interval);
      await new Promise<void>((resolve) => {
        io.close(() => {
          resolve();
        });
      });
    },
  };
}

