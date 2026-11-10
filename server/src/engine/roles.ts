import { validateSettings } from '@midnight-city/shared';
import type { Role, RoleBreakdown, RoomSettings, ServerPlayer } from '@midnight-city/shared';
import { cryptoRandomInt, shuffleWithRng } from './rng.js';
import type { RandomIntFn } from './rng.js';

export function buildRolePool(
  playingPlayerCount: number,
  settings: RoomSettings
): Role[] {
  const pool: Role[] = [];
  for (let i = 0; i < settings.mafiaCount; i += 1) {
    pool.push('MAFIA');
  }
  if (settings.healerEnabled) {
    pool.push('HEALER');
  }
  if (settings.detectiveEnabled) {
    pool.push('DETECTIVE');
  }
  if (settings.jokerEnabled) {
    pool.push('JOKER');
  }
  while (pool.length < playingPlayerCount) {
    pool.push('VILLAGER');
  }
  return pool;
}

export function getRoleBreakdown(
  playingPlayerCount: number,
  settings: RoomSettings
): RoleBreakdown {
  return validateSettings(playingPlayerCount, settings).breakdown;
}

export function assignRolesToPlayers(
  players: readonly ServerPlayer[],
  settings: RoomSettings,
  randInt: RandomIntFn = cryptoRandomInt
): ServerPlayer[] {
  const playingPlayers = players.filter((p) => p.isPlaying);
  const validation = validateSettings(playingPlayers.length, settings);
  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? 'Invalid room settings');
  }

  const pool = shuffleWithRng(buildRolePool(playingPlayers.length, settings), randInt);
  let roleIndex = 0;

  return players.map((player) => {
    if (!player.isPlaying) {
      return {
        ...player,
        role: null,
        isAlive: false,
        roleAcknowledged: true,
      };
    }
    const assignedRole = pool[roleIndex] ?? 'VILLAGER';
    roleIndex += 1;
    return {
      ...player,
      role: assignedRole,
      isAlive: true,
      roleAcknowledged: false,
    };
  });
}

