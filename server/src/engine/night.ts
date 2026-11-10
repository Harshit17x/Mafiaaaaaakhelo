import type {
  DawnResult,
  GameState,
  RoomSettings,
  ServerPlayer,
  TimelineNightEntry,
} from '@midnight-city/shared';
import { cryptoRandomInt } from './rng.js';
import type { RandomIntFn } from './rng.js';

export function canHealerProtect(
  healer: ServerPlayer,
  target: ServerPlayer,
  settings: RoomSettings,
  game: GameState
): { ok: boolean; reason?: string } {
  if (!healer.isPlaying || !healer.isAlive || healer.role !== 'HEALER') {
    return { ok: false, reason: 'Only an alive Healer can protect a player.' };
  }
  if (!target.isPlaying || !target.isAlive) {
    return { ok: false, reason: 'Target must be an alive playing player.' };
  }
  if (target.id !== healer.id) {
    return { ok: true };
  }
  switch (settings.healerSelfSaveRule) {
    case 'unlimited':
      return { ok: true };
    case 'never':
      return { ok: false, reason: 'Self-protection is disabled by room settings.' };
    case 'once_per_game':
      if (game.healerSelfSaveCount >= 1) {
        return { ok: false, reason: 'Healer can only self-save once per game.' };
      }
      return { ok: true };
    case 'not_consecutive':
      if (game.healerSavedSelfLastNight) {
        return { ok: false, reason: 'Healer cannot self-save on consecutive nights.' };
      }
      return { ok: true };
  }
}

export function resolveMafiaTarget(
  aliveMafiaIds: readonly string[],
  mafiaVotes: Record<string, string>,
  validTargetIds: readonly string[],
  skipKillTonight: boolean,
  randInt: RandomIntFn = cryptoRandomInt
): { targetId: string | null; consensus: boolean } {
  if (skipKillTonight) {
    return { targetId: null, consensus: true };
  }
  if (validTargetIds.length === 0) {
    return { targetId: null, consensus: false };
  }

  const validSet = new Set(validTargetIds);
  const aliveMafiaSet = new Set(aliveMafiaIds);
  const counts = new Map<string, number>();

  for (const [voterId, targetId] of Object.entries(mafiaVotes)) {
    if (aliveMafiaSet.has(voterId) && validSet.has(targetId)) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
  }

  if (counts.size === 0) {
    const randomIdx = randInt(0, validTargetIds.length);
    return { targetId: validTargetIds[randomIdx] ?? null, consensus: false };
  }

  let maxVotes = 0;
  for (const count of counts.values()) {
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  const leaders: string[] = [];
  for (const [targetId, count] of counts.entries()) {
    if (count === maxVotes) {
      leaders.push(targetId);
    }
  }

  if (leaders.length === 1) {
    const chosen = leaders[0]!;
    return {
      targetId: chosen,
      consensus: maxVotes === aliveMafiaIds.length,
    };
  }

  const randomLeaderIdx = randInt(0, leaders.length);
  return {
    targetId: leaders[randomLeaderIdx] ?? null,
    consensus: false,
  };
}

export interface NightResolutionOutput {
  updatedPlayers: ServerPlayer[];
  dawnResult: DawnResult;
  timelineEntry: TimelineNightEntry;
  nextHealerSelfSaveCount: number;
  nextHealerSavedSelfLastNight: boolean;
}

export function resolveNight(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  randInt: RandomIntFn = cryptoRandomInt
): NightResolutionOutput {
  const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;
  const aliveMafiaIds = players
    .filter((p) => p.isPlaying && p.isAlive && p.role === 'MAFIA')
    .map((p) => p.id);
  const validMafiaTargets = players
    .filter((p) => p.isPlaying && p.isAlive && p.role !== 'MAFIA')
    .map((p) => p.id);

  let mafiaTargetId = game.night.mafiaLockedTargetId;
  if (!skipKillTonight && (!mafiaTargetId || !validMafiaTargets.includes(mafiaTargetId))) {
    mafiaTargetId = resolveMafiaTarget(
      aliveMafiaIds,
      game.night.mafiaVotes,
      validMafiaTargets,
      false,
      randInt
    ).targetId;
  }
  if (skipKillTonight) {
    mafiaTargetId = null;
  }

  const aliveHealer = players.find(
    (p) => p.isPlaying && p.isAlive && p.role === 'HEALER'
  );
  const healerTargetId =
    aliveHealer && game.night.healerSubmitted ? game.night.healerTargetId : null;

  let nextHealerSelfSaveCount = game.healerSelfSaveCount;
  let nextHealerSavedSelfLastNight = false;
  if (aliveHealer && healerTargetId === aliveHealer.id) {
    nextHealerSelfSaveCount += 1;
    nextHealerSavedSelfLastNight = true;
  }

  const mafiaTargetPlayer = mafiaTargetId
    ? players.find((p) => p.id === mafiaTargetId) ?? null
    : null;
  const healerTargetPlayer = healerTargetId
    ? players.find((p) => p.id === healerTargetId) ?? null
    : null;
  const detectiveTargetPlayer = game.night.detectiveTargetId
    ? players.find((p) => p.id === game.night.detectiveTargetId) ?? null
    : null;

  let savedByHealer = false;
  let blockedByJokerImmunity = false;
  let killedPlayer: ServerPlayer | null = null;

  if (mafiaTargetPlayer && mafiaTargetPlayer.isAlive) {
    if (healerTargetId && healerTargetId === mafiaTargetPlayer.id) {
      savedByHealer = true;
    } else if (mafiaTargetPlayer.role === 'JOKER' && settings.jokerNightImmunity) {
      blockedByJokerImmunity = true;
    } else {
      killedPlayer = mafiaTargetPlayer;
    }
  }

  const updatedPlayers = players.map((p) => {
    if (killedPlayer && p.id === killedPlayer.id) {
      return {
        ...p,
        isAlive: false,
      };
    }
    return p;
  });

  const dawnResult: DawnResult = {
    nightNumber: game.roundNumber,
    killedPlayerId: killedPlayer ? killedPlayer.id : null,
    killedPlayerName: killedPlayer ? killedPlayer.name : null,
    killedPlayerRole: killedPlayer ? killedPlayer.role : null,
    savedByHealer,
    blockedByJokerImmunity,
  };

  const timelineEntry: TimelineNightEntry = {
    kind: 'NIGHT',
    nightNumber: game.roundNumber,
    mafiaTargetId: mafiaTargetPlayer ? mafiaTargetPlayer.id : null,
    mafiaTargetName: mafiaTargetPlayer ? mafiaTargetPlayer.name : null,
    healerTargetId: healerTargetPlayer ? healerTargetPlayer.id : null,
    healerTargetName: healerTargetPlayer ? healerTargetPlayer.name : null,
    detectiveTargetId: detectiveTargetPlayer ? detectiveTargetPlayer.id : null,
    detectiveTargetName: detectiveTargetPlayer ? detectiveTargetPlayer.name : null,
    detectiveFoundMafia: game.night.detectiveResult
      ? game.night.detectiveResult.isMafia
      : null,
    killedPlayerId: killedPlayer ? killedPlayer.id : null,
    killedPlayerName: killedPlayer ? killedPlayer.name : null,
    killedPlayerRole: killedPlayer ? killedPlayer.role : null,
    savedByHealer,
    blockedByJokerImmunity,
  };

  return {
    updatedPlayers,
    dawnResult,
    timelineEntry,
    nextHealerSelfSaveCount,
    nextHealerSavedSelfLastNight,
  };
}

