import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type {
  ChatMessage,
  GameState,
  LobbyCharacterPosition,
  RoomSettings,
  ServerPlayer,
} from '@midnight-city/shared';
import { createInitialGameState } from './engine/index.js';

export interface ServerRoom {
  roomCode: string;
  locked: boolean;
  mafiaCountManualOverride: boolean;
  settings: RoomSettings;
  players: ServerPlayer[];
  lobbyPositions: Record<string, LobbyCharacterPosition>;
  game: GameState;
  chatHistory: ChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  hostDisconnectedAt: number | null;
}

export function getInitialLobbySpawn(
  slotIndex: number,
  now: number = Date.now()
): LobbyCharacterPosition {
  const angle = ((slotIndex % 16) / 8) * Math.PI - Math.PI / 2;
  const ringRadius = slotIndex >= 8 ? 165 : 115;
  const x = Math.round(480 + Math.cos(angle) * ringRadius);
  const y = Math.round(335 + Math.sin(angle) * (ringRadius * 0.65));
  return {
    x,
    y,
    facing: x > 480 ? 'left' : 'right',
    moving: false,
    updatedAt: now,
  };
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
    lobbyPositions: {
      [hostPlayer.id]: getInitialLobbySpawn(0, now),
    },
    game: createInitialGameState(now),
    chatHistory: [],
    createdAt: now,
    lastActivityAt: now,
    hostDisconnectedAt: null,
  };
}

