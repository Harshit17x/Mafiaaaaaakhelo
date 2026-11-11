import type {
  AvatarFilter,
  AvatarPinColor,
  AvatarPresetId,
  RoomSettings,
} from './types.js';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16;
export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const SKIP_VOTE_TARGET = '__SKIP__';

export const DISCONNECT_GRACE_MS = 60_000;
export const HOST_AUTO_TRANSFER_GRACE_MS = 15_000;
export const ROOM_INACTIVITY_TTL_MS = 2 * 60 * 60 * 1000;
export const LOBBY_COUNTDOWN_MS = 5_000;
export const LOBBY_ARENA_WIDTH = 1000;
export const LOBBY_ARENA_HEIGHT = 600;

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

export const MAX_AVATAR_CAPTION_LENGTH = 16;
export const MAX_CUSTOM_AVATAR_DATA_URL_LENGTH = 48_000;

export interface AvatarPresetMeta {
  id: Exclude<AvatarPresetId, 'custom'>;
  name: string;
  tagline: string;
  imageUrl: string;
  defaultPin: AvatarPinColor;
  defaultTilt: number;
  defaultFilter: AvatarFilter;
}

export const AVATAR_PRESETS: readonly AvatarPresetMeta[] = [
  {
    id: 'spiky-kid',
    name: 'Spiky Hustler',
    tagline: 'Streetwise optimist',
    imageUrl: '/assets/avatars/spiky-kid.jpg',
    defaultPin: 'green',
    defaultTilt: -2.4,
    defaultFilter: 'color',
  },
  {
    id: 'bandana-kid',
    name: 'Young Rebel',
    tagline: 'Bold & fearless',
    imageUrl: '/assets/avatars/bandana-kid.jpg',
    defaultPin: 'white',
    defaultTilt: 1.9,
    defaultFilter: 'color',
  },
  {
    id: 'fighter-sense',
    name: 'The Enforcer',
    tagline: 'Reads the room fast',
    imageUrl: '/assets/avatars/fighter-sense.jpg',
    defaultPin: 'white',
    defaultTilt: -1.6,
    defaultFilter: 'noir',
  },
  {
    id: 'suit-cat',
    name: 'Consigliere Cat',
    tagline: 'Tailored & calculating',
    imageUrl: '/assets/avatars/suit-cat.jpg',
    defaultPin: 'red',
    defaultTilt: 2.3,
    defaultFilter: 'noir',
  },
  {
    id: 'cartoon-dad',
    name: 'Wise Guy',
    tagline: 'Alibi always ready',
    imageUrl: '/assets/avatars/cartoon-dad.jpg',
    defaultPin: 'teal',
    defaultTilt: -2.1,
    defaultFilter: 'noir',
  },
  {
    id: 'sleepy-cat',
    name: 'Night Owl',
    tagline: 'Quiet till dawn',
    imageUrl: '/assets/avatars/sleepy-cat.jpg',
    defaultPin: 'teal',
    defaultTilt: 1.7,
    defaultFilter: 'color',
  },
  {
    id: 'ushanka-shiba',
    name: 'Comrade Shiba',
    tagline: 'Cold-blooded bluffer',
    imageUrl: '/assets/avatars/ushanka-shiba.jpg',
    defaultPin: 'gold',
    defaultTilt: -1.8,
    defaultFilter: 'color',
  },
];

