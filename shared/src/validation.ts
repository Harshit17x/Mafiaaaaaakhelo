import {
  AVATAR_PRESETS,
  MAX_AVATAR_CAPTION_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CUSTOM_AVATAR_DATA_URL_LENGTH,
  MAX_PLAYERS,
  MAX_PLAYER_NAME_LENGTH,
  MIN_PLAYERS,
} from './constants.js';
import type {
  AvatarFilter,
  AvatarFrameTint,
  AvatarPinColor,
  AvatarPresetId,
  PlayerAvatarConfig,
  RoleBreakdown,
  RoomSettings,
  SettingsValidationResult,
} from './types.js';

export function getSuggestedMafiaCount(playingPlayerCount: number): number {
  if (playingPlayerCount <= 6) {
    return 1;
  }
  if (playingPlayerCount <= 9) {
    return 2;
  }
  if (playingPlayerCount <= 12) {
    return 3;
  }
  return 4;
}

export function calculateRoleBreakdown(
  playingPlayerCount: number,
  settings: RoomSettings
): RoleBreakdown {
  const mafia = Math.max(0, settings.mafiaCount);
  const healer = settings.healerEnabled ? 1 : 0;
  const detective = settings.detectiveEnabled ? 1 : 0;
  const joker = settings.jokerEnabled ? 1 : 0;
  const villager = Math.max(0, playingPlayerCount - mafia - healer - detective - joker);
  return {
    mafia,
    healer,
    detective,
    joker,
    villager,
    total: playingPlayerCount,
  };
}

export function validateSettings(
  playingPlayerCount: number,
  settings: RoomSettings
): SettingsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestedMafiaCount = getSuggestedMafiaCount(Math.max(MIN_PLAYERS, playingPlayerCount));
  const breakdown = calculateRoleBreakdown(playingPlayerCount, settings);

  if (playingPlayerCount < MIN_PLAYERS) {
    errors.push(`Need at least ${MIN_PLAYERS} playing players to start (currently ${playingPlayerCount}).`);
  }
  if (playingPlayerCount > MAX_PLAYERS) {
    errors.push(`Maximum ${MAX_PLAYERS} playing players allowed (currently ${playingPlayerCount}).`);
  }

  if (!Number.isInteger(settings.mafiaCount) || settings.mafiaCount < 1) {
    errors.push('At least 1 Mafia is required.');
  }

  const nonMafiaCount = playingPlayerCount - settings.mafiaCount;
  if (playingPlayerCount >= MIN_PLAYERS && settings.mafiaCount >= nonMafiaCount) {
    errors.push('Mafia count must be strictly fewer than non-Mafia players.');
  }

  if (
    playingPlayerCount >= MIN_PLAYERS &&
    !settings.skipFirstNightKill &&
    nonMafiaCount - settings.mafiaCount < 2
  ) {
    errors.push(
      'Require at least 2 more non-Mafia players than Mafia when first-night kill is enabled.'
    );
  }

  const specialNonMafiaRoles =
    (settings.healerEnabled ? 1 : 0) +
    (settings.detectiveEnabled ? 1 : 0) +
    (settings.jokerEnabled ? 1 : 0);

  if (playingPlayerCount >= 1 && specialNonMafiaRoles > nonMafiaCount) {
    errors.push('Not enough non-Mafia slots for all enabled special roles.');
  }

  const maxRecommendedMafia = Math.ceil(playingPlayerCount / 3) - 1;
  if (
    playingPlayerCount >= MIN_PLAYERS &&
    settings.mafiaCount >= Math.ceil(playingPlayerCount / 3)
  ) {
    warnings.push(
      `Recommended Mafia count is fewer than 1/3 of players (max ${Math.max(1, maxRecommendedMafia)} for ${playingPlayerCount} players).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestedMafiaCount,
    breakdown,
  };
}

export function sanitizePlayerName(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function sanitizeChatMessage(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return cleaned.slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
}

const VALID_AVATAR_PRESET_IDS = new Set<AvatarPresetId>([
  'spiky-kid',
  'bandana-kid',
  'fighter-sense',
  'suit-cat',
  'cartoon-dad',
  'sleepy-cat',
  'ushanka-shiba',
  'custom',
]);
const VALID_AVATAR_FILTERS = new Set<AvatarFilter>(['color', 'noir', 'sepia', 'vivid']);
const VALID_AVATAR_PINS = new Set<AvatarPinColor>(['green', 'white', 'red', 'teal', 'gold']);
const VALID_AVATAR_TINTS = new Set<AvatarFrameTint>(['cream', 'aged', 'charcoal', 'gold']);
const SAFE_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function clampRounded(value: unknown, min: number, max: number, fallback: number, step = 10): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped * step) / step;
}

export function sanitizeAvatarCaption(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_AVATAR_CAPTION_LENGTH);
}

export function createDefaultAvatarConfig(seed?: string): PlayerAvatarConfig {
  let idx = 0;
  if (seed && AVATAR_PRESETS.length > 0) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    idx = hash % AVATAR_PRESETS.length;
  }
  const preset = AVATAR_PRESETS[idx] ?? AVATAR_PRESETS[0]!;
  return {
    presetId: preset.id,
    filter: preset.defaultFilter,
    pinColor: preset.defaultPin,
    frameTint: 'cream',
    tilt: preset.defaultTilt,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    caption: '',
    customDataUrl: null,
  };
}

export function sanitizeAvatarConfig(raw: unknown, seed?: string): PlayerAvatarConfig {
  const defaults = createDefaultAvatarConfig(seed);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const input = raw as Record<string, unknown>;

  let presetId: AvatarPresetId = VALID_AVATAR_PRESET_IDS.has(input.presetId as AvatarPresetId)
    ? (input.presetId as AvatarPresetId)
    : defaults.presetId;

  let customDataUrl: string | null = null;
  if (
    presetId === 'custom' &&
    typeof input.customDataUrl === 'string' &&
    input.customDataUrl.length <= MAX_CUSTOM_AVATAR_DATA_URL_LENGTH &&
    SAFE_DATA_URL_RE.test(input.customDataUrl)
  ) {
    customDataUrl = input.customDataUrl;
  } else if (presetId === 'custom') {
    presetId = defaults.presetId;
  }

  const presetMeta = AVATAR_PRESETS.find((p) => p.id === presetId);
  const filter = VALID_AVATAR_FILTERS.has(input.filter as AvatarFilter)
    ? (input.filter as AvatarFilter)
    : (presetMeta?.defaultFilter ?? defaults.filter);
  const pinColor = VALID_AVATAR_PINS.has(input.pinColor as AvatarPinColor)
    ? (input.pinColor as AvatarPinColor)
    : (presetMeta?.defaultPin ?? defaults.pinColor);
  const frameTint = VALID_AVATAR_TINTS.has(input.frameTint as AvatarFrameTint)
    ? (input.frameTint as AvatarFrameTint)
    : 'cream';

  return {
    presetId,
    filter,
    pinColor,
    frameTint,
    tilt: clampRounded(input.tilt, -6, 6, presetMeta?.defaultTilt ?? defaults.tilt, 10),
    zoom: clampRounded(input.zoom, 1, 1.5, 1, 100),
    offsetX: clampRounded(input.offsetX, -25, 25, 0, 1),
    offsetY: clampRounded(input.offsetY, -25, 25, 0, 1),
    caption: sanitizeAvatarCaption(input.caption),
    customDataUrl,
  };
}

