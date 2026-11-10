export type Role = 'MAFIA' | 'HEALER' | 'VILLAGER' | 'JOKER' | 'DETECTIVE';

export type Alignment = 'MAFIA' | 'CITY' | 'NEUTRAL';

export type Winner = 'MAFIA' | 'CITY' | 'JOKER';

export type NarratorMode = 'AUTO_NARRATOR' | 'HUMAN_HOST';

export type HealerSelfSaveRule = 'unlimited' | 'not_consecutive' | 'once_per_game' | 'never';

export type TieRule = 'no_elimination' | 'revote_then_no_elimination';

export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'DAWN'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTE'
  | 'VOTE_RESULT'
  | 'GAME_OVER';

export type NightSubPhase =
  | 'SLEEPING'
  | 'MAFIA_TURN'
  | 'HEALER_TURN'
  | 'DETECTIVE_TURN'
  | 'DAWN_TRANSITION';

export type ChatChannel = 'PUBLIC' | 'MAFIA' | 'GHOST';

export type VoiceChannel = 'PUBLIC' | 'MAFIA' | 'GHOST' | 'MUTED';

export interface RoomSettings {
  narratorMode: NarratorMode;
  mafiaCount: number;
  healerEnabled: boolean;
  jokerEnabled: boolean;
  detectiveEnabled: boolean;
  healerSelfSaveRule: HealerSelfSaveRule;
  jokerWinEndsGame: boolean;
  jokerNightImmunity: boolean;
  revealRoleOnDeath: boolean;
  skipFirstNightKill: boolean;
  allowDeadChat: boolean;
  discussionTimeSec: number | null;
  votingTimeSec: number | null;
  nightActionTimeSec: number | null;
  allowSkipVote: boolean;
  tieRule: TieRule;
}

export interface ServerPlayer {
  id: string;
  name: string;
  sessionToken: string;
  isHost: boolean;
  isPlaying: boolean;
  isReady: boolean;
  isAlive: boolean;
  role: Role | null;
  roleAcknowledged: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  disconnectDeadline: number | null;
  micEnabled: boolean;
  voiceJoined: boolean;
  joinedAt: number;
}

export interface InvestigationResult {
  nightNumber: number;
  targetId: string;
  targetName: string;
  isMafia: boolean;
}

export interface NightState {
  subPhase: NightSubPhase;
  subPhaseStartedAt: number;
  subPhaseEndsAt: number | null;
  minStepEndsAt: number | null;
  mafiaVotes: Record<string, string>;
  mafiaLockedTargetId: string | null;
  mafiaTruceConfirmedIds: string[];
  healerTargetId: string | null;
  healerSubmitted: boolean;
  detectiveTargetId: string | null;
  detectiveSubmitted: boolean;
  detectiveResult: InvestigationResult | null;
}

export interface DawnResult {
  nightNumber: number;
  killedPlayerId: string | null;
  killedPlayerName: string | null;
  killedPlayerRole: Role | null;
  savedByHealer: boolean;
  blockedByJokerImmunity: boolean;
}

export interface VoteTallyEntry {
  targetId: string;
  targetName: string;
  voterIds: string[];
  count: number;
}

export interface VoteResolution {
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  eliminatedRole: Role | null;
  wasSkip: boolean;
  wasTie: boolean;
  needsRevote: boolean;
  tiedCandidateIds: string[];
  tally: VoteTallyEntry[];
  voteDetails: Record<string, string>;
}

export interface DayState {
  accuseTargets: Record<string, string | null>;
  readyToVotePlayerIds: string[];
  votes: Record<string, string>;
  voteAttempt: 1 | 2;
  revoteCandidateIds: string[];
  lastVoteResolution: VoteResolution | null;
}

export interface TimelineNightEntry {
  kind: 'NIGHT';
  nightNumber: number;
  mafiaTargetId: string | null;
  mafiaTargetName: string | null;
  healerTargetId: string | null;
  healerTargetName: string | null;
  detectiveTargetId: string | null;
  detectiveTargetName: string | null;
  detectiveFoundMafia: boolean | null;
  killedPlayerId: string | null;
  killedPlayerName: string | null;
  killedPlayerRole: Role | null;
  savedByHealer: boolean;
  blockedByJokerImmunity: boolean;
}

export interface TimelineVoteEntry {
  kind: 'VOTE';
  dayNumber: number;
  voteAttempt: 1 | 2;
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  eliminatedRole: Role | null;
  wasTie: boolean;
  wasSkip: boolean;
  tally: VoteTallyEntry[];
}

export type GameTimelineEntry = TimelineNightEntry | TimelineVoteEntry;

export interface GameState {
  phase: GamePhase;
  roundNumber: number;
  paused: boolean;
  pauseReason: string | null;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  healerSelfSaveCount: number;
  healerSavedSelfLastNight: boolean;
  night: NightState;
  dawn: DawnResult | null;
  day: DayState;
  winners: Winner[];
  jokerWinnerPlayerId: string | null;
  timeline: GameTimelineEntry[];
  detectiveHistory: Record<string, InvestigationResult[]>;
}

export interface RoleBreakdown {
  mafia: number;
  healer: number;
  detective: number;
  joker: number;
  villager: number;
  total: number;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestedMafiaCount: number;
  breakdown: RoleBreakdown;
}

export interface GodViewNightOutcome {
  pendingMafiaTargetId: string | null;
  pendingMafiaTargetName: string | null;
  pendingHealerTargetId: string | null;
  pendingHealerTargetName: string | null;
  pendingDetectiveTargetId: string | null;
  pendingDetectiveTargetName: string | null;
  projectedKilledPlayerId: string | null;
  projectedKilledPlayerName: string | null;
  projectedSavedByHealer: boolean;
  projectedBlockedByJoker: boolean;
}

export interface GodViewState {
  actualNightSubPhase: NightSubPhase;
  awakeRole: Role | null;
  mafiaVotes: Record<string, string>;
  mafiaLockedTargetId: string | null;
  healerTargetId: string | null;
  healerSubmitted: boolean;
  detectiveTargetId: string | null;
  detectiveSubmitted: boolean;
  detectiveResult: InvestigationResult | null;
  nightOutcome: GodViewNightOutcome;
  liveVotes: Record<string, string>;
  nextSubPhase: NightSubPhase | 'DAWN' | null;
}

export interface ClientPlayerView {
  id: string;
  name: string;
  isHost: boolean;
  isPlaying: boolean;
  isReady: boolean;
  isAlive: boolean;
  role: Role | null;
  roleAcknowledged: boolean;
  connected: boolean;
  disconnectDeadline: number | null;
  micEnabled: boolean;
  voiceJoined: boolean;
  accuseTargetId: string | null;
  hasVoted: boolean;
  readyToVote: boolean;
}

export interface ClientNightView {
  subPhase: NightSubPhase;
  subPhaseEndsAt: number | null;
  canAct: boolean;
  skipKillTonight: boolean;
  mafiaVotes: Record<string, string> | null;
  mafiaLockedTargetId: string | null;
  mySelection: string | null;
  hasSubmitted: boolean;
  healerCanSelfSave: boolean;
  detectiveResult: InvestigationResult | null;
  narrationText: string;
}

export interface ClientDawnView {
  nightNumber: number;
  killedPlayerId: string | null;
  killedPlayerName: string | null;
  killedPlayerRole: Role | null;
}

export interface ClientVoteView {
  voteAttempt: 1 | 2;
  revoteCandidateIds: string[];
  myVote: string | null;
  votedPlayerIds: string[];
}

export interface ClientGameState {
  phase: GamePhase;
  roundNumber: number;
  paused: boolean;
  pauseReason: string | null;
  phaseEndsAt: number | null;
  myRole: Role | null;
  myRoleAcknowledged: boolean;
  fellowMafiaIds: string[];
  detectiveHistory: InvestigationResult[];
  night: ClientNightView | null;
  dawn: ClientDawnView | null;
  vote: ClientVoteView | null;
  voteResult: VoteResolution | null;
  winners: Winner[];
  jokerWinnerPlayerId: string | null;
  timeline: GameTimelineEntry[] | null;
  godView: GodViewState | null;
}

export interface ClientRoomView {
  roomCode: string;
  locked: boolean;
  myPlayerId: string;
  settings: RoomSettings;
  validation: SettingsValidationResult;
  players: ClientPlayerView[];
  game: ClientGameState;
  serverTime: number;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  system?: boolean;
}

export interface VoiceState {
  channel: VoiceChannel;
  canSpeak: boolean;
  audiblePeerIds: string[];
  speakablePeerIds: string[];
  humanHostId: string | null;
}

export interface IceCandidateInitPayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment?: string | null;
}

export type VoiceSignalPayload =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice-candidate'; candidate: IceCandidateInitPayload };

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface LiveServerStats {
  playersInRooms: number;
  playersInGame: number;
  activeRooms: number;
  onlineCount: number;
}

