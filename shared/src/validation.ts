import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_PLAYERS,
  MAX_PLAYER_NAME_LENGTH,
  MIN_PLAYERS,
} from './constants.js';
import type { RoleBreakdown, RoomSettings, SettingsValidationResult } from './types.js';

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

