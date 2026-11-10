import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type { ChatMessage, GameState, RoomSettings, ServerPlayer } from '@midnight-city/shared';
import { createInitialGameState } from './engine/index.js';

export interface ServerRoom {
  roomCode: string;
  locked: boolean;
  mafiaCountManualOverride: boolean;
  settings: RoomSettings;
  players: ServerPlayer[];
  game: GameState;
  chatHistory: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  hostDisconnectedAt: number | null;
}

export interface RoomRepository {
  get(roomCode: string): ServerRoom | undefined;
  set(room: ServerRoom): void;
  delete(roomCode: string): boolean;
  list(): ServerRoom[];
}

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, ServerRoom>();

  get(roomCode: string): ServerRoom | undefined {
    return this.rooms.get(roomCode);
  }

  set(room: ServerRoom): void {
    this.rooms.set(room.roomCode, room);
  }

  delete(roomCode: string): boolean {
    return this.rooms.delete(roomCode);
  }

  list(): ServerRoom[] {
    return Array.from(this.rooms.values());
  }
}

export function createRoomRecord(
  roomCode: string,
  hostPlayer: ServerPlayer,
  now: number = Date.now()
): ServerRoom {
  return {
    roomCode,
    locked: false,
    mafiaCountManualOverride: false,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    players: [hostPlayer],
    game: createInitialGameState(now),
    chatHistory: [],
    createdAt: now,
    lastActivityAt: now,
    hostDisconnectedAt: null,
  };
}

