import {
  DEFAULT_TIMINGS,
  SKIP_VOTE_TARGET,
  validateSettings,
} from '@midnight-city/shared';
import type {
  GameState,
  NightSubPhase,
  RoomSettings,
  ServerPlayer,
} from '@midnight-city/shared';
import { canHealerProtect, resolveMafiaTarget, resolveNight } from './night.js';
import { assignRolesToPlayers } from './roles.js';
import { cryptoRandomInt } from './rng.js';
import type { RandomIntFn } from './rng.js';
import { isValidVoteTarget, tallyVotes } from './vote.js';
import { checkWinCondition } from './winCheck.js';

export interface EngineTimings {
  SLEEP_TRANSITION_MS: number;
  DAWN_TRANSITION_MS: number;
  DAWN_DISPLAY_MS: number;
  VOTE_RESULT_DISPLAY_MS: number;
  REVOTE_ANNOUNCE_MS: number;
  MIN_NIGHT_STEP_MS: number;
  MAX_NIGHT_STEP_RANDOM_MS: number;
}

export interface NarrationEvent {
  type: 'NARRATION';
  key: string;
  text: string;
}

export type EngineEvent = NarrationEvent;

export type EngineResult =
  | {
      ok: true;
      players: ServerPlayer[];
      game: GameState;
      events: EngineEvent[];
    }
  | {
      ok: false;
      error: string;
    };

function createEmptyNightState(now: number): GameState['night'] {
  return {
    subPhase: 'SLEEPING',
    subPhaseStartedAt: now,
    subPhaseEndsAt: null,
    minStepEndsAt: null,
    mafiaVotes: {},
    mafiaLockedTargetId: null,
    mafiaTruceConfirmedIds: [],
    healerTargetId: null,
    healerSubmitted: false,
    detectiveTargetId: null,
    detectiveSubmitted: false,
    detectiveResult: null,
  };
}

function createEmptyDayState(): GameState['day'] {
  return {
    accuseTargets: {},
    readyToVotePlayerIds: [],
    votes: {},
    voteAttempt: 1,
    revoteCandidateIds: [],
    lastVoteResolution: null,
  };
}

export function createInitialGameState(now: number = Date.now()): GameState {
  return {
    phase: 'LOBBY',
    roundNumber: 0,
    paused: false,
    pauseReason: null,
    phaseStartedAt: now,
    phaseEndsAt: null,
    pausedRemainingMs: null,
    healerSelfSaveCount: 0,
    healerSavedSelfLastNight: false,
    night: createEmptyNightState(now),
    dawn: null,
    day: createEmptyDayState(),
    winners: [],
    jokerWinnerPlayerId: null,
    timeline: [],
    detectiveHistory: {},
  };
}

export function getNarrationForNightSubPhase(
  subPhase: NightSubPhase,
  roundNumber: number,
  skipFirstNightKill: boolean
): { key: string; text: string } {
  switch (subPhase) {
    case 'SLEEPING':
      return {
        key: 'night_sleep',
        text: 'Night falls over Midnight City. Everyone, close your eyes.',
      };
    case 'MAFIA_TURN':
      if (skipFirstNightKill && roundNumber === 1) {
        return {
          key: 'mafia_wake_truce',
          text: 'Mafia, wake up. Meet your allies. First-night kill is off tonight.',
        };
      }
      return {
        key: 'mafia_wake',
        text: 'Mafia, wake up. Choose your target in the shadows.',
      };
    case 'HEALER_TURN':
      return {
        key: 'healer_wake',
        text: 'Mafia, close your eyes. Healer, wake up and choose someone to protect.',
      };
    case 'DETECTIVE_TURN':
      return {
        key: 'detective_wake',
        text: 'Detective, wake up and choose someone to investigate.',
      };
    case 'DAWN_TRANSITION':
      return {
        key: 'dawn_approaching',
        text: 'Everyone, close your eyes. Dawn is breaking over the skyline.',
      };
  }
}

function computeStealthDelayMs(
  settings: RoomSettings,
  randInt: RandomIntFn,
  timings: EngineTimings
): number {
  const minMs = Math.max(0, timings.MIN_NIGHT_STEP_MS);
  const maxRandomMs = Math.max(minMs + 1, timings.MAX_NIGHT_STEP_RANDOM_MS + 1);
  const raw = Math.max(minMs, randInt(minMs, maxRandomMs));
  if (settings.nightActionTimeSec !== null) {
    return Math.min(raw, settings.nightActionTimeSec * 1000);
  }
  return raw;
}

function isRoleAliveForSubPhase(
  subPhase: NightSubPhase,
  players: readonly ServerPlayer[]
): boolean {
  switch (subPhase) {
    case 'MAFIA_TURN':
      return players.some((p) => p.isPlaying && p.isAlive && p.role === 'MAFIA');
    case 'HEALER_TURN':
      return players.some((p) => p.isPlaying && p.isAlive && p.role === 'HEALER');
    case 'DETECTIVE_TURN':
      return players.some((p) => p.isPlaying && p.isAlive && p.role === 'DETECTIVE');
    default:
      return true;
  }
}

function buildNightSubPhaseTiming(
  subPhase: NightSubPhase,
  players: readonly ServerPlayer[],
  settings: RoomSettings,
  now: number,
  randInt: RandomIntFn,
  timings: EngineTimings
): { subPhaseEndsAt: number | null; minStepEndsAt: number | null } {
  if (settings.narratorMode === 'HUMAN_HOST') {
    return { subPhaseEndsAt: null, minStepEndsAt: null };
  }
  if (subPhase === 'SLEEPING') {
    const end = now + timings.SLEEP_TRANSITION_MS;
    return { subPhaseEndsAt: end, minStepEndsAt: end };
  }
  if (subPhase === 'DAWN_TRANSITION') {
    const end = now + timings.DAWN_TRANSITION_MS;
    return { subPhaseEndsAt: end, minStepEndsAt: end };
  }

  const stealthDelay = computeStealthDelayMs(settings, randInt, timings);
  const roleAlive = isRoleAliveForSubPhase(subPhase, players);
  if (!roleAlive) {
    const deadSlotEnd = now + stealthDelay;
    return { subPhaseEndsAt: deadSlotEnd, minStepEndsAt: deadSlotEnd };
  }

  const maxEnd =
    settings.nightActionTimeSec !== null
      ? now + settings.nightActionTimeSec * 1000
      : null;
  const minEnd = now + stealthDelay;
  return {
    subPhaseEndsAt: maxEnd,
    minStepEndsAt: minEnd,
  };
}

export function getNextNightSubPhase(
  current: NightSubPhase,
  settings: RoomSettings
): NightSubPhase | 'DAWN' {
  switch (current) {
    case 'SLEEPING':
      return 'MAFIA_TURN';
    case 'MAFIA_TURN':
      if (settings.healerEnabled) {
        return 'HEALER_TURN';
      }
      if (settings.detectiveEnabled) {
        return 'DETECTIVE_TURN';
      }
      return settings.narratorMode === 'HUMAN_HOST' ? 'DAWN' : 'DAWN_TRANSITION';
    case 'HEALER_TURN':
      if (settings.detectiveEnabled) {
        return 'DETECTIVE_TURN';
      }
      return settings.narratorMode === 'HUMAN_HOST' ? 'DAWN' : 'DAWN_TRANSITION';
    case 'DETECTIVE_TURN':
      return settings.narratorMode === 'HUMAN_HOST' ? 'DAWN' : 'DAWN_TRANSITION';
    case 'DAWN_TRANSITION':
      return 'DAWN';
  }
}

export function enterNight(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  roundNumber: number,
  now: number,
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS
): { players: ServerPlayer[]; game: GameState; events: EngineEvent[] } {
  const timing = buildNightSubPhaseTiming(
    'SLEEPING',
    players,
    settings,
    now,
    randInt,
    timings
  );
  const narration = getNarrationForNightSubPhase(
    'SLEEPING',
    roundNumber,
    settings.skipFirstNightKill
  );
  const nextGame: GameState = {
    ...game,
    phase: 'NIGHT',
    roundNumber,
    phaseStartedAt: now,
    phaseEndsAt: null,
    paused: false,
    pauseReason: null,
    pausedRemainingMs: null,
    dawn: null,
    day: createEmptyDayState(),
    night: {
      ...createEmptyNightState(now),
      subPhase: 'SLEEPING',
      subPhaseStartedAt: now,
      subPhaseEndsAt: timing.subPhaseEndsAt,
      minStepEndsAt: timing.minStepEndsAt,
    },
  };
  return {
    players: [...players],
    game: nextGame,
    events: [{ type: 'NARRATION', key: narration.key, text: narration.text }],
  };
}

export function startGame(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt
): EngineResult {
  if (game.phase !== 'LOBBY') {
    return { ok: false, error: 'Game has already started.' };
  }
  const playingPlayers = players.filter((p) => p.isPlaying);
  const validation = validateSettings(playingPlayers.length, settings);
  if (!validation.valid) {
    return { ok: false, error: validation.errors[0] ?? 'Invalid settings.' };
  }
  const unready = playingPlayers.filter((p) => !p.isReady);
  if (unready.length > 0) {
    return { ok: false, error: 'All playing players must be ready before starting.' };
  }
  if (settings.narratorMode === 'HUMAN_HOST') {
    const host = players.find((p) => p.isHost);
    if (!host || !host.connected) {
      return { ok: false, error: 'Human Host must be connected to start.' };
    }
  }

  const assignedPlayers = assignRolesToPlayers(players, settings, randInt);
  const initial = createInitialGameState(now);
  const nextGame: GameState = {
    ...initial,
    phase: 'ROLE_REVEAL',
    roundNumber: 1,
    phaseStartedAt: now,
  };

  return {
    ok: true,
    players: assignedPlayers,
    game: nextGame,
    events: [
      {
        type: 'NARRATION',
        key: 'role_reveal',
        text: 'Dossiers dealt. Inspect your secret role in private.',
      },
    ],
  };
}

export function acknowledgeRole(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  playerId: string,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase !== 'ROLE_REVEAL') {
    return { ok: false, error: 'Not in role reveal phase.' };
  }
  const player = players.find((p) => p.id === playerId);
  if (!player || !player.isPlaying) {
    return { ok: false, error: 'Only playing players acknowledge roles.' };
  }

  const updatedPlayers = players.map((p) =>
    p.id === playerId ? { ...p, roleAcknowledged: true } : p
  );

  const allAcknowledged = updatedPlayers
    .filter((p) => p.isPlaying)
    .every((p) => p.roleAcknowledged);

  if (allAcknowledged) {
    const nightTransition = enterNight(
      updatedPlayers,
      game,
      settings,
      1,
      now,
      randInt,
      timings
    );
    return {
      ok: true,
      players: nightTransition.players,
      game: nightTransition.game,
      events: nightTransition.events,
    };
  }

  return {
    ok: true,
    players: updatedPlayers,
    game,
    events: [],
  };
}

export function isCurrentNightTurnReadyToAdvance(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number
): boolean {
  if (game.phase !== 'NIGHT' || game.paused) {
    return false;
  }
  const { subPhase, minStepEndsAt, subPhaseEndsAt } = game.night;
  if (subPhaseEndsAt !== null && now >= subPhaseEndsAt) {
    return true;
  }
  if (minStepEndsAt !== null && now < minStepEndsAt) {
    return false;
  }
  const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;
  switch (subPhase) {
    case 'SLEEPING':
    case 'DAWN_TRANSITION':
      return subPhaseEndsAt !== null && now >= subPhaseEndsAt;
    case 'MAFIA_TURN': {
      const aliveMafia = players.filter(
        (p) => p.isPlaying && p.isAlive && p.role === 'MAFIA'
      );
      if (aliveMafia.length === 0) {
        return true;
      }
      if (skipKillTonight) {
        return aliveMafia.every((m) =>
          game.night.mafiaTruceConfirmedIds.includes(m.id)
        );
      }
      return game.night.mafiaLockedTargetId !== null;
    }
    case 'HEALER_TURN': {
      const hasAliveHealer = players.some(
        (p) => p.isPlaying && p.isAlive && p.role === 'HEALER'
      );
      return !hasAliveHealer || game.night.healerSubmitted;
    }
    case 'DETECTIVE_TURN': {
      const hasAliveDetective = players.some(
        (p) => p.isPlaying && p.isAlive && p.role === 'DETECTIVE'
      );
      return !hasAliveDetective || game.night.detectiveSubmitted;
    }
  }
}

export function advanceNightStep(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS,
  targetStep?: NightSubPhase | 'DAWN'
): EngineResult {
  if (game.phase !== 'NIGHT') {
    return { ok: false, error: 'Game is not in Night phase.' };
  }

  let updatedNight = { ...game.night };
  if (
    updatedNight.subPhase === 'MAFIA_TURN' &&
    updatedNight.mafiaLockedTargetId === null
  ) {
    const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;
    const aliveMafiaIds = players
      .filter((p) => p.isPlaying && p.isAlive && p.role === 'MAFIA')
      .map((p) => p.id);
    const validTargets = players
      .filter((p) => p.isPlaying && p.isAlive && p.role !== 'MAFIA')
      .map((p) => p.id);
    const resolved = resolveMafiaTarget(
      aliveMafiaIds,
      updatedNight.mafiaVotes,
      validTargets,
      skipKillTonight,
      randInt
    );
    updatedNight.mafiaLockedTargetId = resolved.targetId;
  }

  const nextStep = targetStep ?? getNextNightSubPhase(updatedNight.subPhase, settings);
  if (nextStep === 'DAWN') {
    return resolveDawnPhase(
      players,
      { ...game, night: updatedNight },
      settings,
      now,
      randInt,
      timings
    );
  }

  const timing = buildNightSubPhaseTiming(
    nextStep,
    players,
    settings,
    now,
    randInt,
    timings
  );
  const narration = getNarrationForNightSubPhase(
    nextStep,
    game.roundNumber,
    settings.skipFirstNightKill
  );

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      night: {
        ...updatedNight,
        subPhase: nextStep,
        subPhaseStartedAt: now,
        subPhaseEndsAt: timing.subPhaseEndsAt,
        minStepEndsAt: timing.minStepEndsAt,
      },
    },
    events: [{ type: 'NARRATION', key: narration.key, text: narration.text }],
  };
}

export function submitMafiaTarget(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  actorId: string,
  targetPlayerId: string
): EngineResult {
  if (game.phase !== 'NIGHT' || game.night.subPhase !== 'MAFIA_TURN') {
    return { ok: false, error: 'Mafia cannot select a target right now.' };
  }
  if (settings.skipFirstNightKill && game.roundNumber === 1) {
    return { ok: false, error: 'First-night kill is disabled.' };
  }

  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.isPlaying || !actor.isAlive || actor.role !== 'MAFIA') {
    return { ok: false, error: 'Only an alive Mafia member can perform this action.' };
  }

  const target = players.find((p) => p.id === targetPlayerId);
  if (!target || !target.isPlaying || !target.isAlive) {
    return { ok: false, error: 'Target must be an alive player.' };
  }
  if (target.role === 'MAFIA') {
    return { ok: false, error: 'Mafia cannot target themselves or fellow Mafia.' };
  }

  const nextVotes = {
    ...game.night.mafiaVotes,
    [actorId]: targetPlayerId,
  };

  const aliveMafia = players.filter(
    (p) => p.isPlaying && p.isAlive && p.role === 'MAFIA'
  );
  const allVoted = aliveMafia.every((m) => typeof nextVotes[m.id] === 'string');
  const firstChoice = aliveMafia[0] ? nextVotes[aliveMafia[0].id] : undefined;
  const unanimous =
    allVoted &&
    firstChoice !== undefined &&
    aliveMafia.every((m) => nextVotes[m.id] === firstChoice);

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      night: {
        ...game.night,
        mafiaVotes: nextVotes,
        mafiaLockedTargetId: unanimous ? firstChoice! : null,
      },
    },
    events: [],
  };
}

export function submitMafiaTruceConfirm(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  actorId: string
): EngineResult {
  if (game.phase !== 'NIGHT' || game.night.subPhase !== 'MAFIA_TURN') {
    return { ok: false, error: 'Not in Mafia turn.' };
  }
  if (!(settings.skipFirstNightKill && game.roundNumber === 1)) {
    return { ok: false, error: 'First-night kill is enabled.' };
  }
  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.isPlaying || !actor.isAlive || actor.role !== 'MAFIA') {
    return { ok: false, error: 'Only an alive Mafia member can confirm.' };
  }
  if (game.night.mafiaTruceConfirmedIds.includes(actorId)) {
    return { ok: true, players: [...players], game, events: [] };
  }
  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      night: {
        ...game.night,
        mafiaTruceConfirmedIds: [...game.night.mafiaTruceConfirmedIds, actorId],
      },
    },
    events: [],
  };
}

export function submitHealerTarget(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  actorId: string,
  targetPlayerId: string
): EngineResult {
  if (game.phase !== 'NIGHT' || game.night.subPhase !== 'HEALER_TURN') {
    return { ok: false, error: 'Healer cannot act right now.' };
  }
  if (game.night.healerSubmitted) {
    return { ok: false, error: 'Healer has already chosen tonight.' };
  }
  const actor = players.find((p) => p.id === actorId);
  const target = players.find((p) => p.id === targetPlayerId);
  if (!actor || !target) {
    return { ok: false, error: 'Invalid player or target.' };
  }
  const check = canHealerProtect(actor, target, settings, game);
  if (!check.ok) {
    return { ok: false, error: check.reason ?? 'Invalid protection target.' };
  }
  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      night: {
        ...game.night,
        healerTargetId: targetPlayerId,
        healerSubmitted: true,
      },
    },
    events: [],
  };
}

export function submitDetectiveTarget(
  players: readonly ServerPlayer[],
  game: GameState,
  actorId: string,
  targetPlayerId: string
): EngineResult {
  if (game.phase !== 'NIGHT' || game.night.subPhase !== 'DETECTIVE_TURN') {
    return { ok: false, error: 'Detective cannot act right now.' };
  }
  if (game.night.detectiveSubmitted) {
    return { ok: false, error: 'Detective has already investigated tonight.' };
  }
  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.isPlaying || !actor.isAlive || actor.role !== 'DETECTIVE') {
    return { ok: false, error: 'Only an alive Detective can investigate.' };
  }
  const target = players.find((p) => p.id === targetPlayerId);
  if (!target || !target.isPlaying || !target.isAlive) {
    return { ok: false, error: 'Target must be an alive player.' };
  }
  if (target.id === actor.id) {
    return { ok: false, error: 'Detective cannot investigate themselves.' };
  }

  const result = {
    nightNumber: game.roundNumber,
    targetId: target.id,
    targetName: target.name,
    isMafia: target.role === 'MAFIA',
  };
  const existingHistory = game.detectiveHistory[actorId] ?? [];

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      night: {
        ...game.night,
        detectiveTargetId: target.id,
        detectiveSubmitted: true,
        detectiveResult: result,
      },
      detectiveHistory: {
        ...game.detectiveHistory,
        [actorId]: [...existingHistory, result],
      },
    },
    events: [],
  };
}

export function resolveDawnPhase(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase !== 'NIGHT') {
    return { ok: false, error: 'Dawn can only resolve from Night.' };
  }

  const resolution = resolveNight(players, game, settings, randInt);
  const phaseEndsAt =
    settings.narratorMode === 'AUTO_NARRATOR' ? now + timings.DAWN_DISPLAY_MS : null;

  const headline = resolution.dawnResult.killedPlayerName
    ? `The city wakes. ${resolution.dawnResult.killedPlayerName} was found dead.`
    : 'The city wakes. Nobody died tonight.';

  return {
    ok: true,
    players: resolution.updatedPlayers,
    game: {
      ...game,
      phase: 'DAWN',
      phaseStartedAt: now,
      phaseEndsAt,
      paused: false,
      pauseReason: null,
      pausedRemainingMs: null,
      healerSelfSaveCount: resolution.nextHealerSelfSaveCount,
      healerSavedSelfLastNight: resolution.nextHealerSavedSelfLastNight,
      dawn: resolution.dawnResult,
      timeline: [...game.timeline, resolution.timelineEntry],
    },
    events: [{ type: 'NARRATION', key: 'dawn_news', text: headline }],
  };
}

export function advanceFromDawn(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now()
): EngineResult {
  if (game.phase !== 'DAWN') {
    return { ok: false, error: 'Game is not in Dawn phase.' };
  }

  const win = checkWinCondition(players, {
    jokerWinEndsGame: settings.jokerWinEndsGame,
    previousJokerWinnerId: game.jokerWinnerPlayerId,
  });

  if (win.gameOver) {
    return {
      ok: true,
      players: [...players],
      game: {
        ...game,
        phase: 'GAME_OVER',
        phaseStartedAt: now,
        phaseEndsAt: null,
        paused: false,
        pauseReason: null,
        pausedRemainingMs: null,
        winners: win.winners,
        jokerWinnerPlayerId: win.jokerWinnerPlayerId,
      },
      events: [
        {
          type: 'NARRATION',
          key: 'game_over',
          text: `Game over. Victory belongs to ${win.winners.join(' & ')}.`,
        },
      ],
    };
  }

  const discussionEndsAt =
    settings.narratorMode === 'AUTO_NARRATOR' && settings.discussionTimeSec !== null
      ? now + settings.discussionTimeSec * 1000
      : null;

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      phase: 'DAY_DISCUSSION',
      phaseStartedAt: now,
      phaseEndsAt: discussionEndsAt,
      paused: false,
      pauseReason: null,
      pausedRemainingMs: null,
      day: createEmptyDayState(),
    },
    events: [
      {
        type: 'NARRATION',
        key: 'day_discussion',
        text: 'Day discussion begins. Debrief and find the Mafia.',
      },
    ],
  };
}

export function toggleAccuse(
  players: readonly ServerPlayer[],
  game: GameState,
  actorId: string,
  targetPlayerId: string | null
): EngineResult {
  if (game.phase !== 'DAY_DISCUSSION') {
    return { ok: false, error: 'Accusations are only allowed during Day Discussion.' };
  }
  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.isPlaying || !actor.isAlive) {
    return { ok: false, error: 'Only alive playing players can accuse.' };
  }
  if (targetPlayerId !== null) {
    if (targetPlayerId === actorId) {
      return { ok: false, error: 'You cannot accuse yourself.' };
    }
    const target = players.find((p) => p.id === targetPlayerId);
    if (!target || !target.isPlaying || !target.isAlive) {
      return { ok: false, error: 'Accuse target must be an alive player.' };
    }
  }

  const current = game.day.accuseTargets[actorId] ?? null;
  const nextTarget =
    targetPlayerId !== null && current === targetPlayerId ? null : targetPlayerId;

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      day: {
        ...game.day,
        accuseTargets: {
          ...game.day.accuseTargets,
          [actorId]: nextTarget,
        },
      },
    },
    events: [],
  };
}

export function startDayVote(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  voteAttempt: 1 | 2 = 1,
  revoteCandidateIds: readonly string[] = []
): EngineResult {
  if (game.phase !== 'DAY_DISCUSSION' && game.phase !== 'VOTE_RESULT') {
    return { ok: false, error: 'Cannot start Day Vote from this phase.' };
  }

  const votingEndsAt =
    settings.narratorMode === 'AUTO_NARRATOR' && settings.votingTimeSec !== null
      ? now + settings.votingTimeSec * 1000
      : null;

  return {
    ok: true,
    players: [...players],
    game: {
      ...game,
      phase: 'DAY_VOTE',
      phaseStartedAt: now,
      phaseEndsAt: votingEndsAt,
      paused: false,
      pauseReason: null,
      pausedRemainingMs: null,
      day: {
        ...game.day,
        votes: {},
        voteAttempt,
        revoteCandidateIds: [...revoteCandidateIds],
      },
    },
    events: [
      {
        type: 'NARRATION',
        key: voteAttempt === 2 ? 'day_revote' : 'day_vote',
        text:
          voteAttempt === 2
            ? 'Tie revote begins. Cast your decisive ballot.'
            : 'Time to vote. Choose who faces the gallows.',
      },
    ],
  };
}

export function toggleReadyToVote(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  actorId: string,
  ready: boolean,
  now: number = Date.now()
): EngineResult {
  if (game.phase !== 'DAY_DISCUSSION') {
    return { ok: false, error: 'Ready to vote is only valid during Day Discussion.' };
  }
  const actor = players.find((p) => p.id === actorId);
  if (!actor || !actor.isPlaying || !actor.isAlive) {
    return { ok: false, error: 'Only alive playing players can mark ready to vote.' };
  }

  const set = new Set(game.day.readyToVotePlayerIds);
  if (ready) {
    set.add(actorId);
  } else {
    set.delete(actorId);
  }
  const nextReadyList = Array.from(set);
  const updatedGame: GameState = {
    ...game,
    day: {
      ...game.day,
      readyToVotePlayerIds: nextReadyList,
    },
  };

  if (settings.narratorMode === 'AUTO_NARRATOR') {
    const aliveCount = players.filter((p) => p.isPlaying && p.isAlive).length;
    const majorityNeeded = Math.floor(aliveCount / 2) + 1;
    if (nextReadyList.length >= majorityNeeded) {
      return startDayVote(players, updatedGame, settings, now, 1, []);
    }
  }

  return {
    ok: true,
    players: [...players],
    game: updatedGame,
    events: [],
  };
}

export function resolveDayVote(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase !== 'DAY_VOTE') {
    return { ok: false, error: 'Not in Day Vote phase.' };
  }

  const resolution = tallyVotes(
    players,
    game.day.votes,
    settings,
    game.day.voteAttempt,
    game.day.revoteCandidateIds
  );

  const updatedPlayers = players.map((p) => {
    if (resolution.eliminatedPlayerId && p.id === resolution.eliminatedPlayerId) {
      return { ...p, isAlive: false };
    }
    return p;
  });

  const timelineEntry = {
    kind: 'VOTE' as const,
    dayNumber: game.roundNumber,
    voteAttempt: game.day.voteAttempt,
    eliminatedPlayerId: resolution.eliminatedPlayerId,
    eliminatedPlayerName: resolution.eliminatedPlayerName,
    eliminatedRole: resolution.eliminatedRole,
    wasTie: resolution.wasTie,
    wasSkip: resolution.wasSkip,
    tally: resolution.tally,
  };

  const phaseEndsAt =
    settings.narratorMode === 'AUTO_NARRATOR'
      ? now +
        (resolution.needsRevote
          ? timings.REVOTE_ANNOUNCE_MS
          : timings.VOTE_RESULT_DISPLAY_MS)
      : null;

  let narrationText = 'No one was eliminated.';
  if (resolution.needsRevote) {
    narrationText = 'The vote ended in a tie. A revote will take place.';
  } else if (resolution.eliminatedPlayerName) {
    narrationText = `${resolution.eliminatedPlayerName} has been voted out by the city.`;
  }

  return {
    ok: true,
    players: updatedPlayers,
    game: {
      ...game,
      phase: 'VOTE_RESULT',
      phaseStartedAt: now,
      phaseEndsAt,
      paused: false,
      pauseReason: null,
      pausedRemainingMs: null,
      day: {
        ...game.day,
        lastVoteResolution: resolution,
      },
      timeline: [...game.timeline, timelineEntry],
    },
    events: [{ type: 'NARRATION', key: 'vote_result', text: narrationText }],
  };
}

export function castVote(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  actorId: string,
  targetId: string,
  now: number = Date.now(),
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase !== 'DAY_VOTE') {
    return { ok: false, error: 'Voting is only allowed during Day Vote.' };
  }
  if (typeof game.day.votes[actorId] === 'string') {
    return { ok: false, error: 'You have already cast your vote.' };
  }
  const actor = players.find((p) => p.id === actorId);
  if (!actor) {
    return { ok: false, error: 'Player not found.' };
  }

  const check = isValidVoteTarget(
    actor,
    targetId,
    players,
    settings,
    game.day.voteAttempt,
    game.day.revoteCandidateIds
  );
  if (!check.ok) {
    return { ok: false, error: check.reason ?? 'Invalid vote target.' };
  }

  const nextVotes = {
    ...game.day.votes,
    [actorId]: targetId,
  };
  const updatedGame: GameState = {
    ...game,
    day: {
      ...game.day,
      votes: nextVotes,
    },
  };

  const aliveCount = players.filter((p) => p.isPlaying && p.isAlive).length;
  if (Object.keys(nextVotes).length >= aliveCount) {
    return resolveDayVote(players, updatedGame, settings, now, timings);
  }

  return {
    ok: true,
    players: [...players],
    game: updatedGame,
    events: [],
  };
}

export function advanceFromVoteResult(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase !== 'VOTE_RESULT') {
    return { ok: false, error: 'Not in Vote Result phase.' };
  }

  const lastRes = game.day.lastVoteResolution;
  if (lastRes?.needsRevote) {
    return startDayVote(
      players,
      game,
      settings,
      now,
      2,
      lastRes.tiedCandidateIds
    );
  }

  const win = checkWinCondition(players, {
    votedOutPlayerId: lastRes?.eliminatedPlayerId ?? null,
    jokerWinEndsGame: settings.jokerWinEndsGame,
    previousJokerWinnerId: game.jokerWinnerPlayerId,
  });

  if (win.gameOver) {
    return {
      ok: true,
      players: [...players],
      game: {
        ...game,
        phase: 'GAME_OVER',
        phaseStartedAt: now,
        phaseEndsAt: null,
        paused: false,
        pauseReason: null,
        pausedRemainingMs: null,
        winners: win.winners,
        jokerWinnerPlayerId: win.jokerWinnerPlayerId,
      },
      events: [
        {
          type: 'NARRATION',
          key: 'game_over',
          text: `Game over. Victory belongs to ${win.winners.join(' & ')}.`,
        },
      ],
    };
  }

  const updatedGameWithJoker = {
    ...game,
    jokerWinnerPlayerId: win.jokerWinnerPlayerId,
  };

  const nextNight = enterNight(
    players,
    updatedGameWithJoker,
    settings,
    game.roundNumber + 1,
    now,
    randInt,
    timings
  );

  return {
    ok: true,
    players: nextNight.players,
    game: nextNight.game,
    events: nextNight.events,
  };
}

export function applyAutoActionsForDisconnected(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS,
  forceAllUnactedDisconnected: boolean = false
): EngineResult {
  const isExpired = (p: ServerPlayer) =>
    !p.connected &&
    (forceAllUnactedDisconnected ||
      (p.disconnectDeadline !== null && now >= p.disconnectDeadline));

  if (game.phase === 'ROLE_REVEAL') {
    let changed = false;
    const nextPlayers = players.map((p) => {
      if (p.isPlaying && !p.roleAcknowledged && isExpired(p)) {
        changed = true;
        return { ...p, roleAcknowledged: true };
      }
      return p;
    });
    if (!changed) {
      return { ok: true, players: [...players], game, events: [] };
    }
    const allAck = nextPlayers.filter((p) => p.isPlaying).every((p) => p.roleAcknowledged);
    if (allAck) {
      const nextNight = enterNight(nextPlayers, game, settings, 1, now, randInt, timings);
      return {
        ok: true,
        players: nextNight.players,
        game: nextNight.game,
        events: nextNight.events,
      };
    }
    return { ok: true, players: nextPlayers, game, events: [] };
  }

  if (game.phase === 'NIGHT') {
    const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;
    if (game.night.subPhase === 'MAFIA_TURN') {
      const aliveMafia = players.filter(
        (p) => p.isPlaying && p.isAlive && p.role === 'MAFIA'
      );
      if (skipKillTonight) {
        const nextConfirmed = [...game.night.mafiaTruceConfirmedIds];
        let changed = false;
        for (const m of aliveMafia) {
          if (isExpired(m) && !nextConfirmed.includes(m.id)) {
            nextConfirmed.push(m.id);
            changed = true;
          }
        }
        if (changed) {
          return {
            ok: true,
            players: [...players],
            game: {
              ...game,
              night: { ...game.night, mafiaTruceConfirmedIds: nextConfirmed },
            },
            events: [],
          };
        }
      } else {
        const validTargets = players
          .filter((p) => p.isPlaying && p.isAlive && p.role !== 'MAFIA')
          .map((p) => p.id);
        const nextVotes = { ...game.night.mafiaVotes };
        let changed = false;
        if (validTargets.length > 0) {
          const existingVotes = Object.values(nextVotes).filter((id) =>
            validTargets.includes(id)
          );
          const fallbackTarget =
            existingVotes[0] ?? validTargets[randInt(0, validTargets.length)]!;
          for (const m of aliveMafia) {
            if (isExpired(m) && !nextVotes[m.id]) {
              nextVotes[m.id] = fallbackTarget;
              changed = true;
            }
          }
        }
        if (changed) {
          const allVoted = aliveMafia.every((m) => typeof nextVotes[m.id] === 'string');
          const firstChoice = aliveMafia[0] ? nextVotes[aliveMafia[0].id] : undefined;
          const unanimous =
            allVoted &&
            firstChoice !== undefined &&
            aliveMafia.every((m) => nextVotes[m.id] === firstChoice);
          return {
            ok: true,
            players: [...players],
            game: {
              ...game,
              night: {
                ...game.night,
                mafiaVotes: nextVotes,
                mafiaLockedTargetId: unanimous ? firstChoice! : game.night.mafiaLockedTargetId,
              },
            },
            events: [],
          };
        }
      }
    } else if (game.night.subPhase === 'HEALER_TURN' && !game.night.healerSubmitted) {
      const healer = players.find(
        (p) => p.isPlaying && p.isAlive && p.role === 'HEALER'
      );
      if (healer && isExpired(healer)) {
        return {
          ok: true,
          players: [...players],
          game: {
            ...game,
            night: {
              ...game.night,
              healerTargetId: null,
              healerSubmitted: true,
            },
          },
          events: [],
        };
      }
    } else if (game.night.subPhase === 'DETECTIVE_TURN' && !game.night.detectiveSubmitted) {
      const detective = players.find(
        (p) => p.isPlaying && p.isAlive && p.role === 'DETECTIVE'
      );
      if (detective && isExpired(detective)) {
        return {
          ok: true,
          players: [...players],
          game: {
            ...game,
            night: {
              ...game.night,
              detectiveTargetId: null,
              detectiveSubmitted: true,
            },
          },
          events: [],
        };
      }
    }
    return { ok: true, players: [...players], game, events: [] };
  }

  if (game.phase === 'DAY_VOTE') {
    const alivePlayers = players.filter((p) => p.isPlaying && p.isAlive);
    const nextVotes = { ...game.day.votes };
    let changed = false;

    for (const p of alivePlayers) {
      if (typeof nextVotes[p.id] !== 'string' && isExpired(p)) {
        if (settings.allowSkipVote) {
          nextVotes[p.id] = SKIP_VOTE_TARGET;
          changed = true;
        } else {
          const validCandidates = alivePlayers
            .filter(
              (cand) =>
                cand.id !== p.id &&
                (game.day.voteAttempt === 1 ||
                  game.day.revoteCandidateIds.length === 0 ||
                  game.day.revoteCandidateIds.includes(cand.id))
            )
            .map((cand) => cand.id);
          if (validCandidates.length > 0) {
            nextVotes[p.id] = validCandidates[randInt(0, validCandidates.length)]!;
            changed = true;
          }
        }
      }
    }

    if (!changed) {
      return { ok: true, players: [...players], game, events: [] };
    }

    const updatedGame: GameState = {
      ...game,
      day: {
        ...game.day,
        votes: nextVotes,
      },
    };

    if (Object.keys(nextVotes).length >= alivePlayers.length) {
      return resolveDayVote(players, updatedGame, settings, now, timings);
    }

    return { ok: true, players: [...players], game: updatedGame, events: [] };
  }

  return { ok: true, players: [...players], game, events: [] };
}

export function handleMidGameLeaveOrKick(
  players: readonly ServerPlayer[],
  game: GameState,
  settings: RoomSettings,
  removedPlayerId: string,
  now: number = Date.now(),
  randInt: RandomIntFn = cryptoRandomInt,
  timings: EngineTimings = DEFAULT_TIMINGS
): EngineResult {
  if (game.phase === 'LOBBY' || game.phase === 'GAME_OVER') {
    return {
      ok: true,
      players: players.filter((p) => p.id !== removedPlayerId),
      game,
      events: [],
    };
  }

  const nextPlayers = players.map((p) =>
    p.id === removedPlayerId
      ? {
          ...p,
          isAlive: false,
          connected: false,
          roleAcknowledged: true,
        }
      : p
  );

  const win = checkWinCondition(nextPlayers, {
    votedOutPlayerId:
      game.phase === 'VOTE_RESULT'
        ? (game.day.lastVoteResolution?.eliminatedPlayerId ?? null)
        : null,
    jokerWinEndsGame: settings.jokerWinEndsGame,
    previousJokerWinnerId: game.jokerWinnerPlayerId,
  });

  if (win.gameOver) {
    return {
      ok: true,
      players: nextPlayers,
      game: {
        ...game,
        phase: 'GAME_OVER',
        phaseStartedAt: now,
        phaseEndsAt: null,
        paused: false,
        pauseReason: null,
        pausedRemainingMs: null,
        winners: win.winners,
        jokerWinnerPlayerId: win.jokerWinnerPlayerId,
      },
      events: [
        {
          type: 'NARRATION',
          key: 'game_over',
          text: `Game over. Victory belongs to ${win.winners.join(' & ')}.`,
        },
      ],
    };
  }

  if (game.phase === 'ROLE_REVEAL') {
    const allAck = nextPlayers.filter((p) => p.isPlaying).every((p) => p.roleAcknowledged);
    if (allAck) {
      const nextNight = enterNight(nextPlayers, game, settings, 1, now, randInt, timings);
      return {
        ok: true,
        players: nextNight.players,
        game: nextNight.game,
        events: nextNight.events,
      };
    }
  }

  if (game.phase === 'DAY_DISCUSSION') {
    const aliveIds = new Set(
      nextPlayers.filter((p) => p.isPlaying && p.isAlive).map((p) => p.id)
    );
    const cleanedReady = game.day.readyToVotePlayerIds.filter((id) =>
      aliveIds.has(id)
    );
    const updatedGame: GameState = {
      ...game,
      day: {
        ...game.day,
        readyToVotePlayerIds: cleanedReady,
      },
    };
    if (settings.narratorMode === 'AUTO_NARRATOR') {
      const majorityNeeded = Math.floor(aliveIds.size / 2) + 1;
      if (aliveIds.size > 0 && cleanedReady.length >= majorityNeeded) {
        return startDayVote(nextPlayers, updatedGame, settings, now, 1, []);
      }
    }
    return { ok: true, players: nextPlayers, game: updatedGame, events: [] };
  }

  if (game.phase === 'DAY_VOTE') {
    const aliveCount = nextPlayers.filter((p) => p.isPlaying && p.isAlive).length;
    const aliveIds = new Set(
      nextPlayers.filter((p) => p.isPlaying && p.isAlive).map((p) => p.id)
    );
    const validVotesCount = Object.keys(game.day.votes).filter((id) =>
      aliveIds.has(id)
    ).length;
    if (validVotesCount >= aliveCount) {
      return resolveDayVote(nextPlayers, game, settings, now, timings);
    }
  }

  return { ok: true, players: nextPlayers, game, events: [] };
}

export function resetToLobby(
  players: readonly ServerPlayer[],
  settings: RoomSettings,
  now: number = Date.now()
): { players: ServerPlayer[]; game: GameState } {
  const nextPlayers = players.map((p) => ({
    ...p,
    isPlaying: settings.narratorMode === 'HUMAN_HOST' ? !p.isHost : true,
    isReady: false,
    isAlive: false,
    role: null,
    roleAcknowledged: false,
  }));
  return {
    players: nextPlayers,
    game: createInitialGameState(now),
  };
}
