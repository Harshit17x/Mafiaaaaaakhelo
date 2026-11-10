import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@midnight-city/shared';

export type TypedGameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface StoredSession {
  roomCode: string;
  sessionToken: string;
  playerName: string;
}

const SESSION_STORAGE_KEY = 'midnight_city_session_v1';

const SERVER_URL = import.meta.env.VITE_SERVER_URL?.trim() || undefined;

export function createGameSocket(): TypedGameSocket {
  return io(SERVER_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
}

export function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.roomCode === 'string' &&
      typeof parsed.sessionToken === 'string' &&
      typeof parsed.playerName === 'string'
    ) {
      return {
        roomCode: parsed.roomCode,
        sessionToken: parsed.sessionToken,
        playerName: parsed.playerName,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
  }
}

