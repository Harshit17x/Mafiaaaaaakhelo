import {
  AVATAR_PRESETS,
  DEFAULT_ROOM_SETTINGS,
  LOBBY_COUNTDOWN_MS,
  SKIP_VOTE_TARGET,
  createDefaultAvatarConfig,
  validateSettings,
} from '@midnight-city/shared';
import type {
  ChatMessage,
  ClientGameState,
  ClientPlayerView,
  ClientRoomView,
  GameTimelineEntry,
  GodViewState,
  LobbyCharacterPosition,
  PlayerAvatarConfig,
  Role,
  VoiceState,
  Winner,
} from '@midnight-city/shared';

export type DevPageKey =
  | 'HOME'
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAWN'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTE'
  | 'VOTE_RESULT'
  | 'GAME_OVER';

export type DevNightViewMode = 'MAFIA_TURN' | 'HEALER_TURN' | 'DETECTIVE_TURN' | 'SLEEPING';

export interface DevGodModeConfig {
  page: DevPageKey;
  playerCount: number;
  myRole: Role;
  myAlive: boolean;
  myIsHost: boolean;
  humanHostSpectator: boolean;
  lobbyAllReadyCountdown: boolean;
  nightSubPhase: DevNightViewMode;
  dawnOutcome: 'KILLED' | 'SAVED';
  voteRevote: boolean;
  winner: Winner;
  simulateSpeaking: boolean;
}

export const DEFAULT_DEV_CONFIG: DevGodModeConfig = {
  page: 'LOBBY',
  playerCount: 8,
  myRole: 'DETECTIVE',
  myAlive: true,
  myIsHost: true,
  humanHostSpectator: false,
  lobbyAllReadyCountdown: false,
  nightSubPhase: 'DETECTIVE_TURN',
  dawnOutcome: 'KILLED',
  voteRevote: false,
  winner: 'CITY',
  simulateSpeaking: true,
};

export interface DevPageDescriptor {
  key: DevPageKey;
  shortLabel: string;
  title: string;
  description: string;
  sections: string[];
  files: string[];
}

export const DEV_PAGES_CATALOG: readonly DevPageDescriptor[] = [
  {
    key: 'HOME',
    shortLabel: 'Home',
    title: 'Title & Room Entry',
    description: 'Mobster title diorama, Create/Join room setup, House Rules editor, and avatar flow.',
    sections: ['Title Logo & Paper Scene', 'Create / Join Panels', 'House Rules Editor', 'Live Players Badge'],
    files: [
      'client/src/pages/HomePage.tsx',
      'client/src/components/MobsterPaperScene.tsx',
      'client/src/components/HouseRulesEditor.tsx',
    ],
  },
  {
    key: 'LOBBY',
    shortLabel: 'Lobby',
    title: 'Waiting Area Lounge',
    description: 'Among-Us-style movable SVG characters, Customization Area booth, City Chat sidebar, and Ready countdown.',
    sections: ['Room Code & Ready Bar', 'Waiting Lounge & SVG Characters', 'Customization Area', 'City Chat Sidebar', 'Table Rules Bar'],
    files: [
      'client/src/pages/LobbyPage.tsx',
      'client/src/components/LobbyWaitingLounge.tsx',
      'client/src/components/LobbyCharacterSvg.tsx',
      'client/src/components/ChatPanel.tsx',
      'client/src/components/AvatarPanelModal.tsx',
    ],
  },
  {
    key: 'ROLE_REVEAL',
    shortLabel: 'Role',
    title: 'Confidential Role Reveal',
    description: 'Hold-to-reveal dossier card, fellow Syndicate preview, and acknowledgment counter.',
    sections: ['Hold-to-Reveal Card', 'Acknowledge Button', 'Human Host Wait Screen'],
    files: [
      'client/src/pages/RoleRevealPage.tsx',
      'client/src/components/RoleCard.tsx',
    ],
  },
  {
    key: 'NIGHT',
    shortLabel: 'Night',
    title: 'Night Phase Turns',
    description: 'Sleeping silence view, Syndicate target strike, Healer protection, Detective investigation, and Mafia night chat.',
    sections: ['Night Header & Turn Timer', 'Role Action Grid', 'Case File Result', 'Syndicate Night Chat'],
    files: [
      'client/src/pages/NightPage.tsx',
      'client/src/components/GodViewPanel.tsx',
      'client/src/components/ChatPanel.tsx',
    ],
  },
  {
    key: 'DAWN',
    shortLabel: 'Dawn',
    title: 'Midnight Gazette (Dawn)',
    description: 'Morning newspaper headline revealing overnight victim or miraculous survival before discussion.',
    sections: ['Gazette Header', 'Headline & Victim Role Badge', 'Discussion Countdown'],
    files: [
      'client/src/pages/DawnPage.tsx',
      'client/src/components/CountdownBadge.tsx',
    ],
  },
  {
    key: 'DAY_DISCUSSION',
    shortLabel: 'Discuss',
    title: 'Day Round Table Council',
    description: 'Full-viewport 3D mahogany casino table with projected Polaroid cards, accusations, Call Vote, and Chat drawer.',
    sections: ['3D Round Table Stage', 'Projected Player Cards', 'Top/Bottom HUD', 'Slide-Over Chat Drawer'],
    files: [
      'client/src/pages/DayTablePage.tsx',
      'client/src/components/MidnightLoungeTable3D.tsx',
      'client/src/components/PlayerTradingCard.tsx',
    ],
  },
  {
    key: 'DAY_VOTE',
    shortLabel: 'Vote',
    title: 'Gallows Ballot & Revote',
    description: '3D table candidate selection, Spare All (Skip) ballot, Tie-Breaker Revote, and confirmation dock.',
    sections: ['3D Candidate Selection', 'Skip Vote & Target Lock HUD', 'Confirm Ballot Button'],
    files: [
      'client/src/pages/DayTablePage.tsx',
      'client/src/components/MidnightLoungeTable3D.tsx',
      'client/src/components/PlayerTradingCard.tsx',
    ],
  },
  {
    key: 'VOTE_RESULT',
    shortLabel: 'Verdict',
    title: 'Verdict Delivered Sheet',
    description: 'Floating foil Verdict Sheet modal with animated ballot bars over the 3D round table.',
    sections: ['Floating Verdict Modal', 'Role Unsealed Card', 'Animated Ballot Tally Bars'],
    files: [
      'client/src/pages/DayTablePage.tsx',
      'client/src/components/MidnightLoungeTable3D.tsx',
    ],
  },
  {
    key: 'GAME_OVER',
    shortLabel: 'Over',
    title: 'Game Over & Case Timeline',
    description: 'Victory banner (City / Mafia / Joker), confetti rain, all revealed player dossiers, and night/vote timeline.',
    sections: ['Winner Banner & Confetti', 'Final Dossiers Grid', 'Case Timeline', 'Post-Game Chat'],
    files: [
      'client/src/pages/GameOverPage.tsx',
      'client/src/components/ChatPanel.tsx',
    ],
  },
];

const MOCK_NAMES = [
  'You (Vance)',
  'Elena',
  'Marco',
  'Silas',
  'Nora',
  'Dante',
  'Vera',
  'Kieran',
  'Lucia',
  'Rocco',
  'Iris',
  'Bruno',
  'Clara',
  'Vito',
  'Tess',
  'Julian',
];

export function isGodModeAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return new URLSearchParams(window.location.search).has('god');
}

function buildMockAvatar(index: number): PlayerAvatarConfig {
  const preset = AVATAR_PRESETS[index % AVATAR_PRESETS.length] ?? AVATAR_PRESETS[0]!;
  return {
    ...createDefaultAvatarConfig(),
    presetId: preset.id,
    filter: preset.defaultFilter,
    pinColor: preset.defaultPin,
    frameTint: index % 4 === 0 ? 'gold' : index % 2 === 0 ? 'cream' : 'aged',
    tilt: preset.defaultTilt,
  };
}

function buildMockSpawn(index: number, now: number): LobbyCharacterPosition {
  const angle = ((index % 16) / 8) * Math.PI - Math.PI / 2;
  const radius = index >= 8 ? 165 : 115;
  const x = Math.round(480 + Math.cos(angle) * radius);
  const y = Math.round(335 + Math.sin(angle) * (radius * 0.65));
  return {
    x,
    y,
    facing: x > 480 ? 'left' : 'right',
    moving: false,
    updatedAt: now,
  };
}

function assignMockRoles(count: number, myRole: Role, humanHostSpectator: boolean): Role[] {
  const pool: Role[] = [];
  const playingCount = humanHostSpectator ? count - 1 : count;
  const mafiaSlots = playingCount >= 10 ? 3 : playingCount >= 7 ? 2 : 1;

  if (!humanHostSpectator) {
    pool.push(myRole);
  }

  let remainingMafia = !humanHostSpectator && myRole === 'MAFIA' ? mafiaSlots - 1 : mafiaSlots;
  let needHealer = humanHostSpectator || myRole !== 'HEALER';
  let needDetective = humanHostSpectator || myRole !== 'DETECTIVE';
  let needJoker = humanHostSpectator || myRole !== 'JOKER';

  while (pool.length < playingCount) {
    if (remainingMafia > 0) {
      pool.push('MAFIA');
      remainingMafia -= 1;
    } else if (needHealer) {
      pool.push('HEALER');
      needHealer = false;
    } else if (needDetective) {
      pool.push('DETECTIVE');
      needDetective = false;
    } else if (needJoker) {
      pool.push('JOKER');
      needJoker = false;
    } else {
      pool.push('VILLAGER');
    }
  }
  return pool;
}

export function buildDevMockState(
  config: DevGodModeConfig,
  myAvatar: PlayerAvatarConfig
): {
  room: ClientRoomView | null;
  lobbyPositions: Record<string, LobbyCharacterPosition>;
  chatMessages: ChatMessage[];
  voiceState: VoiceState | null;
  speakingPeerIds: string[];
} {
  if (config.page === 'HOME') {
    return {
      room: null,
      lobbyPositions: {},
      chatMessages: [],
      voiceState: null,
      speakingPeerIds: [],
    };
  }

  const now = Date.now();
  const count = Math.max(5, Math.min(16, config.playerCount));
  const roles = assignMockRoles(count, config.myRole, config.humanHostSpectator);
  const isLobby = config.page === 'LOBBY';
  const isGameOver = config.page === 'GAME_OVER';
  const showAllRoles = isGameOver || config.humanHostSpectator;

  let roleCursor = 0;
  const players: ClientPlayerView[] = Array.from({ length: count }, (_, idx) => {
    const id = `dev-p-${idx + 1}`;
    const isMe = idx === 0;
    const isHost = isMe ? config.myIsHost || config.humanHostSpectator : !config.myIsHost && idx === 1;
    const isPlaying = !(isMe && config.humanHostSpectator);
    const assignedRole = isPlaying ? (roles[roleCursor++] ?? 'VILLAGER') : null;

    const isDead =
      !isLobby &&
      isPlaying &&
      ((isMe && !config.myAlive) ||
        (!isMe && idx === count - 1 && config.page !== 'ROLE_REVEAL') ||
        (!isMe && idx === count - 2 && isGameOver));

    const isReady =
      isLobby && isPlaying
        ? config.lobbyAllReadyCountdown
          ? true
          : isMe
            ? false
            : idx % 3 !== 2
        : false;

    const revealRole =
      assignedRole &&
      (showAllRoles ||
        isMe ||
        (!isDead ? false : true) ||
        (!config.humanHostSpectator && config.myRole === 'MAFIA' && assignedRole === 'MAFIA'));

    return {
      id,
      name: MOCK_NAMES[idx] ?? `Citizen ${idx + 1}`,
      isHost,
      isPlaying,
      isReady,
      isAlive: isLobby ? false : isPlaying ? !isDead : false,
      role: revealRole ? assignedRole : null,
      roleAcknowledged: config.page === 'ROLE_REVEAL' ? idx > 0 && idx < count - 1 : true,
      connected: idx !== count - 1 || config.page === 'LOBBY',
      disconnectDeadline: null,
      micEnabled: idx === 1,
      voiceJoined: true,
      accuseTargetId:
        config.page === 'DAY_DISCUSSION' && idx > 0 && idx < 4 && !isDead
          ? 'dev-p-2'
          : null,
      hasVoted:
        (config.page === 'DAY_VOTE' || config.page === 'VOTE_RESULT') && idx > 0 && !isDead,
      readyToVote: config.page === 'DAY_DISCUSSION' && (idx === 1 || idx === 2),
      avatar: isMe ? myAvatar : buildMockAvatar(idx),
    };
  });

  const me = players[0]!;
  const playingPlayers = players.filter((p) => p.isPlaying);
  const alivePlayers = playingPlayers.filter((p) => p.isAlive);

  const settings = {
    ...DEFAULT_ROOM_SETTINGS,
    narratorMode: config.humanHostSpectator ? ('HUMAN_HOST' as const) : ('AUTO_NARRATOR' as const),
    mafiaCount: playingPlayers.length >= 10 ? 3 : playingPlayers.length >= 7 ? 2 : 1,
    healerEnabled: true,
    detectiveEnabled: true,
    jokerEnabled: true,
  };

  const validation = validateSettings(playingPlayers.length, settings);
  const lobbyPositions: Record<string, LobbyCharacterPosition> = Object.fromEntries(
    players.map((p, idx) => [p.id, buildMockSpawn(idx, now)])
  );

  const fellowMafiaIds =
    config.myRole === 'MAFIA' || showAllRoles
      ? playingPlayers
          .filter((_, idx) => roles[idx] === 'MAFIA')
          .map((p) => p.id)
      : [];

  const targetA = alivePlayers[1] ?? alivePlayers[0] ?? playingPlayers[1] ?? playingPlayers[0]!;
  const targetB = alivePlayers[2] ?? alivePlayers[0] ?? playingPlayers[2] ?? playingPlayers[0]!;
  const victim = playingPlayers[playingPlayers.length - 1] ?? targetA;

  const godView: GodViewState | null = config.humanHostSpectator
    ? {
        actualNightSubPhase: config.nightSubPhase === 'SLEEPING' ? 'MAFIA_TURN' : config.nightSubPhase,
        awakeRole:
          config.nightSubPhase === 'HEALER_TURN'
            ? 'HEALER'
            : config.nightSubPhase === 'DETECTIVE_TURN'
              ? 'DETECTIVE'
              : 'MAFIA',
        mafiaVotes: { [targetA.id]: targetB.id },
        mafiaLockedTargetId: targetB.id,
        healerTargetId: targetB.id,
        healerSubmitted: true,
        detectiveTargetId: targetA.id,
        detectiveSubmitted: true,
        detectiveResult: {
          nightNumber: 1,
          targetId: targetA.id,
          targetName: targetA.name,
          isMafia: false,
        },
        nightOutcome: {
          pendingMafiaTargetId: targetB.id,
          pendingMafiaTargetName: targetB.name,
          pendingHealerTargetId: targetB.id,
          pendingHealerTargetName: targetB.name,
          pendingDetectiveTargetId: targetA.id,
          pendingDetectiveTargetName: targetA.name,
          projectedKilledPlayerId: null,
          projectedKilledPlayerName: null,
          projectedSavedByHealer: true,
          projectedBlockedByJoker: false,
        },
        liveVotes: { [targetA.id]: targetB.id, [targetB.id]: targetA.id },
        nextSubPhase: 'DAWN',
      }
    : null;

  const timeline: GameTimelineEntry[] = [
    {
      kind: 'NIGHT',
      nightNumber: 1,
      mafiaTargetId: victim.id,
      mafiaTargetName: victim.name,
      healerTargetId: targetA.id,
      healerTargetName: targetA.name,
      detectiveTargetId: targetB.id,
      detectiveTargetName: targetB.name,
      detectiveFoundMafia: true,
      killedPlayerId: victim.id,
      killedPlayerName: victim.name,
      killedPlayerRole: 'VILLAGER',
      savedByHealer: false,
      blockedByJokerImmunity: false,
    },
    {
      kind: 'VOTE',
      dayNumber: 1,
      voteAttempt: 1,
      eliminatedPlayerId: targetB.id,
      eliminatedPlayerName: targetB.name,
      eliminatedRole: 'MAFIA',
      wasTie: false,
      wasSkip: false,
      tally: [
        {
          targetId: targetB.id,
          targetName: targetB.name,
          voterIds: [me.id, targetA.id],
          count: 2,
        },
      ],
    },
  ];

  const canActInNight =
    !config.humanHostSpectator &&
    config.myAlive &&
    ((config.nightSubPhase === 'MAFIA_TURN' && config.myRole === 'MAFIA') ||
      (config.nightSubPhase === 'HEALER_TURN' && config.myRole === 'HEALER') ||
      (config.nightSubPhase === 'DETECTIVE_TURN' && config.myRole === 'DETECTIVE'));

  const game: ClientGameState = {
    phase: config.page,
    roundNumber: config.page === 'LOBBY' || config.page === 'ROLE_REVEAL' ? 0 : 1,
    paused: false,
    pauseReason: null,
    phaseEndsAt:
      config.page === 'DAWN' ||
      config.page === 'DAY_DISCUSSION' ||
      config.page === 'DAY_VOTE' ||
      config.page === 'VOTE_RESULT'
        ? now + 45_000
        : null,
    lobbyCountdownEndsAt:
      config.page === 'LOBBY' && config.lobbyAllReadyCountdown
        ? now + LOBBY_COUNTDOWN_MS
        : null,
    myRole: config.humanHostSpectator ? null : config.myRole,
    myRoleAcknowledged: false,
    fellowMafiaIds,
    detectiveHistory:
      config.myRole === 'DETECTIVE'
        ? [
            {
              nightNumber: 1,
              targetId: targetA.id,
              targetName: targetA.name,
              isMafia: true,
            },
          ]
        : [],
    night:
      config.page === 'NIGHT'
        ? {
            subPhase: canActInNight ? config.nightSubPhase : 'SLEEPING',
            subPhaseEndsAt: now + 25_000,
            canAct: canActInNight,
            skipKillTonight: false,
            mafiaVotes: config.myRole === 'MAFIA' ? { [me.id]: targetA.id } : null,
            mafiaLockedTargetId: null,
            mySelection: canActInNight ? targetA.id : null,
            hasSubmitted: false,
            healerCanSelfSave: true,
            detectiveResult:
              config.nightSubPhase === 'DETECTIVE_TURN' && config.myRole === 'DETECTIVE'
                ? {
                    nightNumber: 1,
                    targetId: targetA.id,
                    targetName: targetA.name,
                    isMafia: true,
                  }
                : null,
            narrationText:
              config.nightSubPhase === 'MAFIA_TURN'
                ? 'The Syndicate awakens in the shadows.'
                : config.nightSubPhase === 'HEALER_TURN'
                  ? 'The Healer steps quietly through the mist.'
                  : config.nightSubPhase === 'DETECTIVE_TURN'
                    ? 'The Detective shines a lamp on a suspect file.'
                    : 'The city sleeps. Keep your eyes closed.',
          }
        : null,
    dawn:
      config.page === 'DAWN'
        ? config.dawnOutcome === 'KILLED'
          ? {
              nightNumber: 1,
              killedPlayerId: victim.id,
              killedPlayerName: victim.name,
              killedPlayerRole: 'VILLAGER',
            }
          : {
              nightNumber: 1,
              killedPlayerId: null,
              killedPlayerName: null,
              killedPlayerRole: null,
            }
        : null,
    vote:
      config.page === 'DAY_VOTE'
        ? {
            voteAttempt: config.voteRevote ? 2 : 1,
            revoteCandidateIds: config.voteRevote ? [targetA.id, targetB.id] : [],
            myVote: null,
            votedPlayerIds: alivePlayers.slice(1, 4).map((p) => p.id),
          }
        : null,
    voteResult:
      config.page === 'VOTE_RESULT'
        ? {
            eliminatedPlayerId: targetB.id,
            eliminatedPlayerName: targetB.name,
            eliminatedRole: 'MAFIA',
            wasSkip: false,
            wasTie: false,
            needsRevote: false,
            tiedCandidateIds: [],
            voteDetails: {},
            tally: [
              {
                targetId: targetB.id,
                targetName: targetB.name,
                voterIds: alivePlayers.slice(0, 4).map((p) => p.id),
                count: 4,
              },
              {
                targetId: targetA.id,
                targetName: targetA.name,
                voterIds: alivePlayers.slice(4, 6).map((p) => p.id),
                count: 2,
              },
              {
                targetId: SKIP_VOTE_TARGET,
                targetName: 'Spare All (Skip)',
                voterIds: alivePlayers.slice(6, 7).map((p) => p.id),
                count: 1,
              },
            ],
          }
        : null,
    winners: isGameOver ? [config.winner] : [],
    jokerWinnerPlayerId: isGameOver && config.winner === 'JOKER' ? targetA.id : null,
    timeline: isGameOver || config.humanHostSpectator ? timeline : null,
    godView,
  };

  const room: ClientRoomView = {
    roomCode: 'DEVGOD',
    locked: false,
    myPlayerId: me.id,
    settings,
    validation,
    players,
    lobbyPositions,
    game,
    serverTime: now,
  };

  const chatMessages: ChatMessage[] = [
    {
      id: 'dev-msg-1',
      channel: 'PUBLIC',
      senderId: targetA.id,
      senderName: targetA.name,
      content: 'Testing layout & chat scroll in God Mode preview.',
      timestamp: now - 45_000,
    },
    {
      id: 'dev-msg-2',
      channel: 'PUBLIC',
      senderId: targetB.id,
      senderName: targetB.name,
      content: 'Did anyone else hear footsteps by the docks last night?',
      timestamp: now - 20_000,
    },
    {
      id: 'dev-msg-3',
      channel: 'MAFIA',
      senderId: targetB.id,
      senderName: targetB.name,
      content: 'Syndicate channel preview: coordinate strike quietly.',
      timestamp: now - 12_000,
    },
    {
      id: 'dev-msg-4',
      channel: 'GHOST',
      senderId: victim.id,
      senderName: victim.name,
      content: 'Ghost channel preview: spirits watching the table.',
      timestamp: now - 5_000,
    },
  ];

  const voiceState: VoiceState = {
    channel:
      config.page === 'NIGHT'
        ? config.nightSubPhase === 'MAFIA_TURN' && config.myRole === 'MAFIA'
          ? 'MAFIA'
          : 'MUTED'
        : 'PUBLIC',
    canSpeak: config.page !== 'NIGHT' || (config.nightSubPhase === 'MAFIA_TURN' && config.myRole === 'MAFIA'),
    audiblePeerIds: players.slice(1).map((p) => p.id),
    speakablePeerIds: players.slice(1).map((p) => p.id),
    humanHostId: config.humanHostSpectator ? me.id : null,
  };

  return {
    room,
    lobbyPositions,
    chatMessages,
    voiceState,
    speakingPeerIds: config.simulateSpeaking && players[1] ? [players[1].id] : [],
  };
}

