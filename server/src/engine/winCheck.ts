import type { ServerPlayer, Winner } from '@midnight-city/shared';

export interface WinCheckOptions {
  votedOutPlayerId?: string | null;
  jokerWinEndsGame: boolean;
  previousJokerWinnerId?: string | null;
}

export interface WinCheckResult {
  gameOver: boolean;
  winners: Winner[];
  jokerWinnerPlayerId: string | null;
}

export function checkWinCondition(
  players: readonly ServerPlayer[],
  options: WinCheckOptions
): WinCheckResult {
  let jokerWinnerPlayerId = options.previousJokerWinnerId ?? null;

  if (options.votedOutPlayerId) {
    const votedOutPlayer = players.find((p) => p.id === options.votedOutPlayerId);
    if (votedOutPlayer && votedOutPlayer.role === 'JOKER') {
      jokerWinnerPlayerId = votedOutPlayer.id;
      if (options.jokerWinEndsGame) {
        return {
          gameOver: true,
          winners: ['JOKER'],
          jokerWinnerPlayerId,
        };
      }
    }
  }

  const alivePlaying = players.filter((p) => p.isPlaying && p.isAlive);
  const aliveMafiaCount = alivePlaying.filter((p) => p.role === 'MAFIA').length;
  const aliveNonMafiaCount = alivePlaying.filter((p) => p.role !== 'MAFIA').length;

  if (aliveMafiaCount === 0) {
    const winners: Winner[] = jokerWinnerPlayerId ? ['CITY', 'JOKER'] : ['CITY'];
    return {
      gameOver: true,
      winners,
      jokerWinnerPlayerId,
    };
  }

  if (aliveMafiaCount >= aliveNonMafiaCount) {
    const winners: Winner[] = jokerWinnerPlayerId ? ['MAFIA', 'JOKER'] : ['MAFIA'];
    return {
      gameOver: true,
      winners,
      jokerWinnerPlayerId,
    };
  }

  return {
    gameOver: false,
    winners: [],
    jokerWinnerPlayerId,
  };
}

