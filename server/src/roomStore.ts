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

export const LOUNGE_SPAWN_SPOTS: readonly { x: number; y: number; facing: 'left' | 'right' }[] = [
  { x: 440, y: 340, facing: 'right' },
  { x: 260, y: 235, facing: 'right' },
  { x: 715, y: 460, facing: 'left' },
  { x: 490, y: 275, facing: 'left' },
  { x: 265, y: 345, facing: 'right' },
  { x: 805, y: 390, facing: 'left' },
  { x: 245, y: 470, facing: 'right' },
  { x: 575, y: 345, facing: 'left' },
  { x: 410, y: 155, facing: 'right' },
  { x: 490, y: 410, facing: 'right' },
  { x: 710, y: 235, facing: 'right' },
  { x: 340, y: 460, facing: 'right' },
  { x: 620, y: 155, facing: 'left' },
  { x: 635, y: 300, facing: 'left' },
  { x: 885, y: 390, facing: 'left' },
  { x: 670, y: 450, facing: 'left' },
];

export function getInitialLobbySpawn(
  slotIndex: number,
  now: number = Date.now()
): LobbyCharacterPosition {
  const spot = LOUNGE_SPAWN_SPOTS[slotIndex % LOUNGE_SPAWN_SPOTS.length]!;
  return {
    x: spot.x,
    y: spot.y,
    facing: spot.facing,
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

