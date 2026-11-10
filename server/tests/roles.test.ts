import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type { ServerPlayer } from '@midnight-city/shared';
import { assignRolesToPlayers } from '../src/engine/roles.js';

function makePlayers(count: number, humanHost: boolean = false): ServerPlayer[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `Player ${idx + 1}`,
    sessionToken: `tok${idx + 1}`,
    isHost: idx === 0,
    isPlaying: !(humanHost && idx === 0),
    isReady: true,
    isAlive: true,
    role: null,
    roleAcknowledged: false,
    connected: true,
    disconnectedAt: null,
    disconnectDeadline: null,
    micEnabled: false,
    voiceJoined: false,
    joinedAt: idx + 1,
  }));
}

describe('role assignment', () => {
  it('assigns exact configured role counts and excludes human host', () => {
    const players = makePlayers(8, true);
    const settings = {
      ...DEFAULT_ROOM_SETTINGS,
      narratorMode: 'HUMAN_HOST' as const,
      mafiaCount: 2,
      healerEnabled: true,
      detectiveEnabled: true,
      jokerEnabled: true,
    };

    const assigned = assignRolesToPlayers(players, settings);
    expect(assigned[0]!.role).toBeNull();
    expect(assigned[0]!.isAlive).toBe(false);

    const playing = assigned.filter((p) => p.isPlaying);
    expect(playing.length).toBe(7);
    expect(playing.filter((p) => p.role === 'MAFIA').length).toBe(2);
    expect(playing.filter((p) => p.role === 'HEALER').length).toBe(1);
    expect(playing.filter((p) => p.role === 'DETECTIVE').length).toBe(1);
    expect(playing.filter((p) => p.role === 'JOKER').length).toBe(1);
    expect(playing.filter((p) => p.role === 'VILLAGER').length).toBe(2);
  });
});

