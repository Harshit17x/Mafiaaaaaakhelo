import { describe, expect, it } from 'vitest';
import type { ServerPlayer } from '@midnight-city/shared';
import { checkWinCondition } from '../src/engine/winCheck.js';

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

describe('win conditions', () => {
  it('prioritizes joker voted out when jokerWinEndsGame is true even if mafia is simultaneously dead or at parity', () => {
    const players = [
      makePlayer('m1', 'MAFIA', false),
      makePlayer('j1', 'JOKER', false),
      makePlayer('v1', 'VILLAGER', true),
    ];
    const jokerSoleWin = checkWinCondition(players, {
      votedOutPlayerId: 'j1',
      jokerWinEndsGame: true,
    });
    expect(jokerSoleWin.gameOver).toBe(true);
    expect(jokerSoleWin.winners).toEqual(['JOKER']);

    const continueToCityWin = checkWinCondition(players, {
      votedOutPlayerId: 'j1',
      jokerWinEndsGame: false,
    });
    expect(continueToCityWin.gameOver).toBe(true);
    expect(continueToCityWin.winners).toEqual(['CITY', 'JOKER']);
  });

  it('counts joker as non-mafia for mafia parity check', () => {
    const aliveWithJoker = [
      makePlayer('m1', 'MAFIA', true),
      makePlayer('j1', 'JOKER', true),
      makePlayer('v1', 'VILLAGER', true),
    ];
    expect(
      checkWinCondition(aliveWithJoker, { jokerWinEndsGame: true }).gameOver
    ).toBe(false);

    const jokerAtParity = [
      makePlayer('m1', 'MAFIA', true),
      makePlayer('j1', 'JOKER', true),
      makePlayer('v1', 'VILLAGER', false),
    ];
    const res = checkWinCondition(jokerAtParity, { jokerWinEndsGame: true });
    expect(res.gameOver).toBe(true);
    expect(res.winners).toEqual(['MAFIA']);
  });

  it('does not let joker win when killed at night', () => {
    const players = [
      makePlayer('m1', 'MAFIA', true),
      makePlayer('j1', 'JOKER', false),
      makePlayer('v1', 'VILLAGER', true),
      makePlayer('v2', 'VILLAGER', true),
    ];
    const res = checkWinCondition(players, {
      votedOutPlayerId: null,
      jokerWinEndsGame: true,
    });
    expect(res.gameOver).toBe(false);
    expect(res.jokerWinnerPlayerId).toBeNull();
  });
});

