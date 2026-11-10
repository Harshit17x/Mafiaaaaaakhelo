import { sanitizeAvatarConfig, validateSettings } from '@midnight-city/shared';
import type {
  ChatChannel,
  ChatMessage,
  ClientDawnView,
  ClientGameState,
  ClientNightView,
  ClientPlayerView,
  ClientRoomView,
  ClientVoteView,
  GodViewNightOutcome,
  GodViewState,
  NightSubPhase,
  Role,
  ServerPlayer,
  VoteResolution,
} from '@midnight-city/shared';
import {
  canHealerProtect,
  getNarrationForNightSubPhase,
  getNextNightSubPhase,
  resolveMafiaTarget,
} from './engine/index.js';
import type { ServerRoom } from './roomStore.js';

function isViewerGodHost(room: ServerRoom, viewer: ServerPlayer | undefined): boolean {
  return Boolean(
    viewer &&
      room.settings.narratorMode === 'HUMAN_HOST' &&
      viewer.isHost &&
      !viewer.isPlaying &&
      room.game.phase !== 'LOBBY'
  );
}

function getAwakeRoleForSubPhase(subPhase: NightSubPhase): Role | null {
  switch (subPhase) {
    case 'MAFIA_TURN':
      return 'MAFIA';
    case 'HEALER_TURN':
      return 'HEALER';
    case 'DETECTIVE_TURN':
      return 'DETECTIVE';
    default:
      return null;
  }
}

function isViewerAwakeDuringNight(
  room: ServerRoom,
  viewer: ServerPlayer | undefined
): boolean {
  if (!viewer || !viewer.isPlaying || !viewer.isAlive || room.game.phase !== 'NIGHT') {
    return false;
  }
  const awakeRole = getAwakeRoleForSubPhase(room.game.night.subPhase);
  return awakeRole !== null && viewer.role === awakeRole;
}

function buildGodView(room: ServerRoom): GodViewState {
  const { game, players, settings } = room;
  const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;
  const aliveMafiaIds = players
    .filter((p) => p.isPlaying && p.isAlive && p.role === 'MAFIA')
    .map((p) => p.id);
  const validMafiaTargets = players
    .filter((p) => p.isPlaying && p.isAlive && p.role !== 'MAFIA')
    .map((p) => p.id);

  let pendingMafiaTargetId = game.night.mafiaLockedTargetId;
  if (!skipKillTonight && !pendingMafiaTargetId && Object.keys(game.night.mafiaVotes).length > 0) {
    pendingMafiaTargetId = resolveMafiaTarget(
      aliveMafiaIds,
      game.night.mafiaVotes,
      validMafiaTargets,
      false,
      () => 0
    ).targetId;
  }
  if (skipKillTonight) {
    pendingMafiaTargetId = null;
  }

  const pendingHealerTargetId = game.night.healerSubmitted ? game.night.healerTargetId : null;
  const pendingDetectiveTargetId = game.night.detectiveSubmitted
    ? game.night.detectiveTargetId
    : null;

  const mafiaTarget = pendingMafiaTargetId
    ? players.find((p) => p.id === pendingMafiaTargetId) ?? null
    : null;
  const healerTarget = pendingHealerTargetId
    ? players.find((p) => p.id === pendingHealerTargetId) ?? null
    : null;
  const detectiveTarget = pendingDetectiveTargetId
    ? players.find((p) => p.id === pendingDetectiveTargetId) ?? null
    : null;

  let projectedSavedByHealer = false;
  let projectedBlockedByJoker = false;
  let projectedKilled: ServerPlayer | null = null;

  if (mafiaTarget) {
    if (pendingHealerTargetId && pendingHealerTargetId === mafiaTarget.id) {
      projectedSavedByHealer = true;
    } else if (mafiaTarget.role === 'JOKER' && settings.jokerNightImmunity) {
      projectedBlockedByJoker = true;
    } else {
      projectedKilled = mafiaTarget;
    }
  }

  const nightOutcome: GodViewNightOutcome = {
    pendingMafiaTargetId: mafiaTarget?.id ?? null,
    pendingMafiaTargetName: mafiaTarget?.name ?? null,
    pendingHealerTargetId: healerTarget?.id ?? null,
    pendingHealerTargetName: healerTarget?.name ?? null,
    pendingDetectiveTargetId: detectiveTarget?.id ?? null,
    pendingDetectiveTargetName: detectiveTarget?.name ?? null,
    projectedKilledPlayerId: projectedKilled?.id ?? null,
    projectedKilledPlayerName: projectedKilled?.name ?? null,
    projectedSavedByHealer,
    projectedBlockedByJoker,
  };

  return {
    actualNightSubPhase: game.night.subPhase,
    awakeRole: getAwakeRoleForSubPhase(game.night.subPhase),
    mafiaVotes: { ...game.night.mafiaVotes },
    mafiaLockedTargetId: game.night.mafiaLockedTargetId,
    healerTargetId: game.night.healerTargetId,
    healerSubmitted: game.night.healerSubmitted,
    detectiveTargetId: game.night.detectiveTargetId,
    detectiveSubmitted: game.night.detectiveSubmitted,
    detectiveResult: game.night.detectiveResult,
    nightOutcome,
    liveVotes: game.phase === 'DAY_VOTE' ? { ...game.day.votes } : {},
    nextSubPhase:
      game.phase === 'NIGHT'
        ? getNextNightSubPhase(game.night.subPhase, settings)
        : null,
  };
}

function buildNightView(
  room: ServerRoom,
  viewer: ServerPlayer | undefined,
  isGod: boolean
): ClientNightView | null {
  if (room.game.phase !== 'NIGHT') {
    return null;
  }

  const { game, settings } = room;
  const awake = isViewerAwakeDuringNight(room, viewer);
  const skipKillTonight = settings.skipFirstNightKill && game.roundNumber === 1;

  if (!awake && !isGod) {
    return {
      subPhase: 'SLEEPING',
      subPhaseEndsAt: null,
      canAct: false,
      skipKillTonight: false,
      mafiaVotes: null,
      mafiaLockedTargetId: null,
      mySelection: null,
      hasSubmitted: false,
      healerCanSelfSave: false,
      detectiveResult: null,
      narrationText: 'The city sleeps. Keep your eyes closed.',
    };
  }

  const actualSubPhase = game.night.subPhase;
  const narration = getNarrationForNightSubPhase(
    actualSubPhase,
    game.roundNumber,
    settings.skipFirstNightKill
  );

  let mySelection: string | null = null;
  let hasSubmitted = false;
  let healerCanSelfSave = false;

  if (viewer && awake) {
    if (actualSubPhase === 'MAFIA_TURN') {
      mySelection = game.night.mafiaVotes[viewer.id] ?? null;
      hasSubmitted = skipKillTonight
        ? game.night.mafiaTruceConfirmedIds.includes(viewer.id)
        : game.night.mafiaLockedTargetId !== null;
    } else if (actualSubPhase === 'HEALER_TURN') {
      mySelection = game.night.healerTargetId;
      hasSubmitted = game.night.healerSubmitted;
      healerCanSelfSave = canHealerProtect(viewer, viewer, settings, game).ok;
    } else if (actualSubPhase === 'DETECTIVE_TURN') {
      mySelection = game.night.detectiveTargetId;
      hasSubmitted = game.night.detectiveSubmitted;
    }
  }

  const showMafiaData =
    actualSubPhase === 'MAFIA_TURN' &&
    Boolean(viewer && viewer.isAlive && viewer.role === 'MAFIA');

  return {
    subPhase: actualSubPhase,
    subPhaseEndsAt: game.night.subPhaseEndsAt,
    canAct: awake,
    skipKillTonight,
    mafiaVotes: showMafiaData ? { ...game.night.mafiaVotes } : null,
    mafiaLockedTargetId: showMafiaData ? game.night.mafiaLockedTargetId : null,
    mySelection,
    hasSubmitted,
    healerCanSelfSave,
    detectiveResult:
      actualSubPhase === 'DETECTIVE_TURN' &&
      viewer?.role === 'DETECTIVE' &&
      viewer.isAlive
        ? game.night.detectiveResult
        : null,
    narrationText: narration.text,
  };
}

function buildDawnView(room: ServerRoom): ClientDawnView | null {
  if (room.game.phase !== 'DAWN' || !room.game.dawn) {
    return null;
  }
  const { dawn } = room.game;
  return {
    nightNumber: dawn.nightNumber,
    killedPlayerId: dawn.killedPlayerId,
    killedPlayerName: dawn.killedPlayerName,
    killedPlayerRole: room.settings.revealRoleOnDeath ? dawn.killedPlayerRole : null,
  };
}

function buildVoteView(
  room: ServerRoom,
  viewer: ServerPlayer | undefined
): ClientVoteView | null {
  if (room.game.phase !== 'DAY_VOTE') {
    return null;
  }
  return {
    voteAttempt: room.game.day.voteAttempt,
    revoteCandidateIds: [...room.game.day.revoteCandidateIds],
    myVote: viewer ? (room.game.day.votes[viewer.id] ?? null) : null,
    votedPlayerIds: Object.keys(room.game.day.votes),
  };
}

function buildVoteResultView(room: ServerRoom): VoteResolution | null {
  if (room.game.phase !== 'VOTE_RESULT' || !room.game.day.lastVoteResolution) {
    return null;
  }
  const res = room.game.day.lastVoteResolution;
  return {
    ...res,
    eliminatedRole: room.settings.revealRoleOnDeath ? res.eliminatedRole : null,
  };
}

export function buildClientRoomView(
  room: ServerRoom,
  viewerPlayerId: string,
  now: number = Date.now()
): ClientRoomView {
  const viewer = room.players.find((p) => p.id === viewerPlayerId);
  const isGod = isViewerGodHost(room, viewer);
  const isGameOver = room.game.phase === 'GAME_OVER';
  const playingCount = room.players.filter((p) => p.isPlaying).length;
  const validation = validateSettings(playingCount, room.settings);

  const players: ClientPlayerView[] = room.players.map((p) => {
    let visibleRole: Role | null = null;
    if (isGameOver || isGod || p.id === viewerPlayerId) {
      visibleRole = p.role;
    } else if (viewer?.role === 'MAFIA' && p.role === 'MAFIA') {
      visibleRole = p.role;
    } else if (p.isPlaying && !p.isAlive && room.settings.revealRoleOnDeath) {
      visibleRole = p.role;
    }

    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isPlaying: p.isPlaying,
      isReady: p.isReady,
      isAlive: p.isAlive,
      role: visibleRole,
      roleAcknowledged: p.roleAcknowledged,
      connected: p.connected,
      disconnectDeadline: p.disconnectDeadline,
      micEnabled: p.micEnabled,
      voiceJoined: p.voiceJoined,
      accuseTargetId:
        room.game.phase === 'DAY_DISCUSSION'
          ? (room.game.day.accuseTargets[p.id] ?? null)
          : null,
      hasVoted:
        room.game.phase === 'DAY_VOTE' || room.game.phase === 'VOTE_RESULT'
          ? typeof room.game.day.votes[p.id] === 'string'
          : false,
      readyToVote:
        room.game.phase === 'DAY_DISCUSSION'
          ? room.game.day.readyToVotePlayerIds.includes(p.id)
          : false,
      avatar: sanitizeAvatarConfig(p.avatar, p.name),
    };
  });

  const fellowMafiaIds =
    viewer?.role === 'MAFIA' || isGameOver || isGod
      ? room.players
          .filter((p) => p.isPlaying && p.role === 'MAFIA')
          .map((p) => p.id)
      : [];

  const game: ClientGameState = {
    phase: room.game.phase,
    roundNumber: room.game.roundNumber,
    paused: room.game.paused,
    pauseReason: room.game.pauseReason,
    phaseEndsAt: room.game.phaseEndsAt,
    myRole: viewer?.role ?? null,
    myRoleAcknowledged: viewer?.roleAcknowledged ?? false,
    fellowMafiaIds,
    detectiveHistory: viewer ? [...(room.game.detectiveHistory[viewer.id] ?? [])] : [],
    night: buildNightView(room, viewer, isGod),
    dawn: buildDawnView(room),
    vote: buildVoteView(room, viewer),
    voteResult: buildVoteResultView(room),
    winners: [...room.game.winners],
    jokerWinnerPlayerId: room.game.jokerWinnerPlayerId,
    timeline: isGameOver || isGod ? [...room.game.timeline] : null,
    godView: isGod ? buildGodView(room) : null,
  };

  return {
    roomCode: room.roomCode,
    locked: room.locked,
    myPlayerId: viewerPlayerId,
    settings: { ...room.settings },
    validation,
    players,
    game,
    serverTime: now,
  };
}

export function canViewerReadChatChannel(
  room: ServerRoom,
  viewer: ServerPlayer | undefined,
  channel: ChatChannel
): boolean {
  if (!viewer) {
    return false;
  }
  if (channel === 'PUBLIC') {
    return true;
  }
  if (isViewerGodHost(room, viewer) || room.game.phase === 'GAME_OVER') {
    return true;
  }
  if (channel === 'MAFIA') {
    return viewer.isPlaying && viewer.role === 'MAFIA';
  }
  if (channel === 'GHOST') {
    return room.settings.allowDeadChat && viewer.isPlaying && !viewer.isAlive;
  }
  return false;
}

export function filterChatHistoryForPlayer(
  room: ServerRoom,
  viewerPlayerId: string
): ChatMessage[] {
  const viewer = room.players.find((p) => p.id === viewerPlayerId);
  return room.chatHistory.filter((msg) =>
    canViewerReadChatChannel(room, viewer, msg.channel)
  );
}

