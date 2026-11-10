import type { RoomSettings } from './types.js';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16;
export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const SKIP_VOTE_TARGET = '__SKIP__';

export const DISCONNECT_GRACE_MS = 60_000;
export const HOST_AUTO_TRANSFER_GRACE_MS = 15_000;
export const ROOM_INACTIVITY_TTL_MS = 2 * 60 * 60 * 1000;

export const DEFAULT_TIMINGS = {
  SLEEP_TRANSITION_MS: 3000,
  DAWN_TRANSITION_MS: 2000,
  DAWN_DISPLAY_MS: 6000,
  VOTE_RESULT_DISPLAY_MS: 6000,
  REVOTE_ANNOUNCE_MS: 4500,
  MIN_NIGHT_STEP_MS: 6000,
  MAX_NIGHT_STEP_RANDOM_MS: 12000,
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  narratorMode: 'AUTO_NARRATOR',
  mafiaCount: 1,
  healerEnabled: true,
  jokerEnabled: false,
  detectiveEnabled: false,
  healerSelfSaveRule: 'not_consecutive',
  jokerWinEndsGame: true,
  jokerNightImmunity: false,
  revealRoleOnDeath: true,
  skipFirstNightKill: false,
  allowDeadChat: true,
  discussionTimeSec: 180,
  votingTimeSec: 45,
  nightActionTimeSec: 30,
  allowSkipVote: true,
  tieRule: 'no_elimination',
};

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

