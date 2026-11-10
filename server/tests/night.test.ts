import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type { ServerPlayer } from '@midnight-city/shared';
import { canHealerProtect, resolveMafiaTarget, resolveNight } from '../src/engine/night.js';
import { createInitialGameState } from '../src/engine/stateMachine.js';

function makePlayer(id: string, role: ServerPlayer['role'], isAlive = true): ServerPlayer {
  return {
    id,
    name: id,
    sessionToken: id,
    isHost: false,
    isPlaying: true,
    isReady: true,
    isAlive,
    role,
    roleAcknowledged: true,
    connected: true,
    disconnectedAt: null,
    disconnectDeadline: null,
    micEnabled: false,
    voiceJoined: false,
    joinedAt: 1,
  };
}

describe('night resolution & healer rules', () => {
  it('enforces all healer self-save rules and allows repeating non-self targets', () => {
    const healer = makePlayer('h1', 'HEALER');
    const villager = makePlayer('v1', 'VILLAGER');
    const baseGame = createInitialGameState(1000);

    expect(
      canHealerProtect(healer, healer, { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'never' }, baseGame).ok
    ).toBe(false);

    expect(
      canHealerProtect(
        healer,
        healer,
        { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'not_consecutive' },
        { ...baseGame, healerSavedSelfLastNight: true }
      ).ok
    ).toBe(false);

    expect(
      canHealerProtect(
        healer,
        healer,
        { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'not_consecutive' },
        { ...baseGame, healerSavedSelfLastNight: false }
      ).ok
    ).toBe(true);

    expect(
      canHealerProtect(
        healer,
        healer,
        { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'once_per_game' },
        { ...baseGame, healerSelfSaveCount: 1 }
      ).ok
    ).toBe(false);

    expect(
      canHealerProtect(
        healer,
        healer,
        { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'unlimited' },
        { ...baseGame, healerSavedSelfLastNight: true, healerSelfSaveCount: 3 }
      ).ok
    ).toBe(true);

    expect(
      canHealerProtect(
        healer,
        villager,
        { ...DEFAULT_ROOM_SETTINGS, healerSelfSaveRule: 'never' },
        baseGame
      ).ok
    ).toBe(true);
  });

  it('resolves mafia votes with plurality or deterministic tie break', () => {
    const fixedZero = () => 0;
    const res1 = resolveMafiaTarget(
      ['m1', 'm2', 'm3'],
      { m1: 'v1', m2: 'v1', m3: 'v2' },
      ['v1', 'v2', 'v3'],
      false,
      fixedZero
    );
    expect(res1.targetId).toBe('v1');
    expect(res1.consensus).toBe(false);

    const res2 = resolveMafiaTarget(
      ['m1', 'm2'],
      { m1: 'v1', m2: 'v2' },
      ['v1', 'v2', 'v3'],
      false,
      () => 1
    );
    expect(res2.targetId).toBe('v2');
  });

  it('blocks mafia kill when healer protects same target and handles joker night immunity', () => {
    const players = [
      makePlayer('m1', 'MAFIA'),
      makePlayer('h1', 'HEALER'),
      makePlayer('j1', 'JOKER'),
      makePlayer('v1', 'VILLAGER'),
      makePlayer('v2', 'VILLAGER'),
    ];
    const baseGame = {
      ...createInitialGameState(1000),
      phase: 'NIGHT' as const,
      roundNumber: 1,
    };

    const saved = resolveNight(
      players,
      {
        ...baseGame,
        night: {
          ...baseGame.night,
          mafiaLockedTargetId: 'v1',
          healerTargetId: 'v1',
          healerSubmitted: true,
        },
      },
      DEFAULT_ROOM_SETTINGS
    );
    expect(saved.dawnResult.killedPlayerId).toBeNull();
    expect(saved.dawnResult.savedByHealer).toBe(true);

    const jokerImmune = resolveNight(
      players,
      {
        ...baseGame,
        night: {
          ...baseGame.night,
          mafiaLockedTargetId: 'j1',
          healerTargetId: 'v2',
          healerSubmitted: true,
        },
      },
      { ...DEFAULT_ROOM_SETTINGS, jokerEnabled: true, jokerNightImmunity: true }
    );
    expect(jokerImmune.dawnResult.killedPlayerId).toBeNull();
    expect(jokerImmune.dawnResult.blockedByJokerImmunity).toBe(true);

    const jokerVulnerable = resolveNight(
      players,
      {
        ...baseGame,
        night: {
          ...baseGame.night,
          mafiaLockedTargetId: 'j1',
          healerTargetId: 'v2',
          healerSubmitted: true,
        },
      },
      { ...DEFAULT_ROOM_SETTINGS, jokerEnabled: true, jokerNightImmunity: false }
    );
    expect(jokerVulnerable.dawnResult.killedPlayerId).toBe('j1');
  });
});

