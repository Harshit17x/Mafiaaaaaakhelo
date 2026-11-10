import { SKIP_VOTE_TARGET } from '@midnight-city/shared';
import type {
  RoomSettings,
  ServerPlayer,
  VoteResolution,
  VoteTallyEntry,
} from '@midnight-city/shared';

export function isValidVoteTarget(
  voter: ServerPlayer,
  targetId: string,
  players: readonly ServerPlayer[],
  settings: RoomSettings,
  voteAttempt: 1 | 2,
  revoteCandidateIds: readonly string[]
): { ok: boolean; reason?: string } {
  if (!voter.isPlaying || !voter.isAlive) {
    return { ok: false, reason: 'Only alive playing players can vote.' };
  }

  if (targetId === SKIP_VOTE_TARGET) {
    if (!settings.allowSkipVote) {
      return { ok: false, reason: 'Skip vote is disabled.' };
    }
    return { ok: true };
  }

  if (targetId === voter.id) {
    return { ok: false, reason: 'You cannot vote for yourself.' };
  }

  const target = players.find((p) => p.id === targetId);
  if (!target || !target.isPlaying || !target.isAlive) {
    return { ok: false, reason: 'Target must be an alive playing player.' };
  }

  if (voteAttempt === 2 && revoteCandidateIds.length > 0) {
    if (!revoteCandidateIds.includes(targetId)) {
      return { ok: false, reason: 'During a revote, you can only vote for tied candidates or skip.' };
    }
  }

  return { ok: true };
}

export function tallyVotes(
  players: readonly ServerPlayer[],
  votes: Record<string, string>,
  settings: RoomSettings,
  voteAttempt: 1 | 2,
  revoteCandidateIds: readonly string[]
): VoteResolution {
  const alivePlaying = players.filter((p) => p.isPlaying && p.isAlive);
  const aliveIds = new Set(alivePlaying.map((p) => p.id));
  const playerById = new Map(players.map((p) => [p.id, p]));

  const tallyMap = new Map<string, string[]>();
  const voteDetails: Record<string, string> = {};

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!aliveIds.has(voterId)) {
      continue;
    }
    const voter = playerById.get(voterId);
    if (!voter) {
      continue;
    }
    const validation = isValidVoteTarget(
      voter,
      targetId,
      players,
      settings,
      voteAttempt,
      revoteCandidateIds
    );
    if (!validation.ok) {
      continue;
    }
    voteDetails[voterId] = targetId;
    const existing = tallyMap.get(targetId) ?? [];
    existing.push(voterId);
    tallyMap.set(targetId, existing);
  }

  const tally: VoteTallyEntry[] = Array.from(tallyMap.entries())
    .map(([targetId, voterIds]) => ({
      targetId,
      targetName:
        targetId === SKIP_VOTE_TARGET
          ? 'Skip Vote'
          : (playerById.get(targetId)?.name ?? 'Unknown'),
      voterIds,
      count: voterIds.length,
    }))
    .sort((a, b) => b.count - a.count);

  if (tally.length === 0) {
    return {
      eliminatedPlayerId: null,
      eliminatedPlayerName: null,
      eliminatedRole: null,
      wasSkip: true,
      wasTie: false,
      needsRevote: false,
      tiedCandidateIds: [],
      tally: [],
      voteDetails,
    };
  }

  const topCount = tally[0]!.count;
  const topEntries = tally.filter((entry) => entry.count === topCount);

  if (topEntries.length === 1) {
    const winner = topEntries[0]!;
    if (winner.targetId === SKIP_VOTE_TARGET) {
      return {
        eliminatedPlayerId: null,
        eliminatedPlayerName: null,
        eliminatedRole: null,
        wasSkip: true,
        wasTie: false,
        needsRevote: false,
        tiedCandidateIds: [],
        tally,
        voteDetails,
      };
    }
    const eliminatedPlayer = playerById.get(winner.targetId);
    return {
      eliminatedPlayerId: winner.targetId,
      eliminatedPlayerName: eliminatedPlayer?.name ?? winner.targetName,
      eliminatedRole: eliminatedPlayer?.role ?? null,
      wasSkip: false,
      wasTie: false,
      needsRevote: false,
      tiedCandidateIds: [],
      tally,
      voteDetails,
    };
  }

  const tiedCandidateIds = topEntries
    .map((entry) => entry.targetId)
    .filter((id) => id !== SKIP_VOTE_TARGET);

  const needsRevote =
    settings.tieRule === 'revote_then_no_elimination' &&
    voteAttempt === 1 &&
    tiedCandidateIds.length >= 1;

  return {
    eliminatedPlayerId: null,
    eliminatedPlayerName: null,
    eliminatedRole: null,
    wasSkip: false,
    wasTie: true,
    needsRevote,
    tiedCandidateIds,
    tally,
    voteDetails,
  };
}

