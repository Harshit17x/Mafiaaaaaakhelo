import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS, SKIP_VOTE_TARGET } from '@midnight-city/shared';
import type { ServerPlayer } from '@midnight-city/shared';
import { isValidVoteTarget, tallyVotes } from '../src/engine/vote.js';

function makePlayers(count: number): ServerPlayer[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `P${idx + 1}`,
    sessionToken: `t${idx + 1}`,
    isHost: idx === 0,
    isPlaying: true,
    isReady: true,
    isAlive: true,
    role: 'VILLAGER',
    roleAcknowledged: true,
    connected: true,
    disconnectedAt: null,
    disconnectDeadline: null,
    micEnabled: false,
    voiceJoined: false,
    joinedAt: idx + 1,
  }));
}

describe('day voting & tie resolution', () => {
  it('eliminates strict leader and handles skip win', () => {
    const players = makePlayers(5);
    const res = tallyVotes(
      players,
      { p1: 'p3', p2: 'p3', p3: 'p1', p4: SKIP_VOTE_TARGET, p5: 'p3' },
      DEFAULT_ROOM_SETTINGS,
      1,
      []
    );
    expect(res.eliminatedPlayerId).toBe('p3');
    expect(res.wasTie).toBe(false);

    const skipWin = tallyVotes(
      players,
      { p1: SKIP_VOTE_TARGET, p2: SKIP_VOTE_TARGET, p3: SKIP_VOTE_TARGET, p4: 'p1', p5: 'p2' },
      DEFAULT_ROOM_SETTINGS,
      1,
      []
    );
    expect(skipWin.eliminatedPlayerId).toBeNull();
    expect(skipWin.wasSkip).toBe(true);
  });

  it('supports no_elimination and revote_then_no_elimination on ties', () => {
    const players = makePlayers(5);
    const votes = { p1: 'p3', p2: 'p3', p3: 'p4', p4: SKIP_VOTE_TARGET, p5: 'p4' };

    const noElim = tallyVotes(players, votes, DEFAULT_ROOM_SETTINGS, 1, []);
    expect(noElim.wasTie).toBe(true);
    expect(noElim.needsRevote).toBe(false);
    expect(noElim.eliminatedPlayerId).toBeNull();

    const revoteSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      tieRule: 'revote_then_no_elimination' as const,
    };
    const attempt1 = tallyVotes(players, votes, revoteSettings, 1, []);
    expect(attempt1.wasTie).toBe(true);
    expect(attempt1.needsRevote).toBe(true);
    expect(attempt1.tiedCandidateIds).toEqual(['p3', 'p4']);

    expect(
      isValidVoteTarget(players[0]!, 'p2', players, revoteSettings, 2, ['p3', 'p4']).ok
    ).toBe(false);
    expect(
      isValidVoteTarget(players[0]!, 'p3', players, revoteSettings, 2, ['p3', 'p4']).ok
    ).toBe(true);

    const attempt2Tie = tallyVotes(
      players,
      { p1: 'p3', p2: 'p3', p3: 'p4', p5: 'p4' },
      revoteSettings,
      2,
      ['p3', 'p4']
    );
    expect(attempt2Tie.wasTie).toBe(true);
    expect(attempt2Tie.needsRevote).toBe(false);
    expect(attempt2Tie.eliminatedPlayerId).toBeNull();
  });
});
