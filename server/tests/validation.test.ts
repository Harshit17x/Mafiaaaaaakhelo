import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROOM_SETTINGS,
  getSuggestedMafiaCount,
  sanitizeChatMessage,
  sanitizePlayerName,
  validateSettings,
} from '@midnight-city/shared';

describe('validation & suggested mafia counts', () => {
  it('computes suggested mafia counts by player count', () => {
    expect(getSuggestedMafiaCount(5)).toBe(1);
    expect(getSuggestedMafiaCount(6)).toBe(1);
    expect(getSuggestedMafiaCount(7)).toBe(2);
    expect(getSuggestedMafiaCount(9)).toBe(2);
    expect(getSuggestedMafiaCount(10)).toBe(3);
    expect(getSuggestedMafiaCount(12)).toBe(3);
    expect(getSuggestedMafiaCount(13)).toBe(4);
    expect(getSuggestedMafiaCount(16)).toBe(4);
  });

  it('rejects fewer than 5 or more than 16 players', () => {
    expect(validateSettings(4, DEFAULT_ROOM_SETTINGS).valid).toBe(false);
    expect(validateSettings(17, DEFAULT_ROOM_SETTINGS).valid).toBe(false);
    expect(validateSettings(5, DEFAULT_ROOM_SETTINGS).valid).toBe(true);
  });

  it('blocks mafia >= non-mafia and requires 2 more non-mafia when first-night kill is on', () => {
    const twoMafia = { ...DEFAULT_ROOM_SETTINGS, mafiaCount: 2, skipFirstNightKill: false };
    const fivePlayers = validateSettings(5, twoMafia);
    expect(fivePlayers.valid).toBe(false);

    const fiveWithSkip = validateSettings(5, { ...twoMafia, skipFirstNightKill: true });
    expect(fiveWithSkip.valid).toBe(true);
    expect(fiveWithSkip.warnings.length).toBeGreaterThan(0);

    const sixPlayersTwoMafia = validateSettings(6, twoMafia);
    expect(sixPlayersTwoMafia.valid).toBe(true);
    expect(sixPlayersTwoMafia.warnings.length).toBeGreaterThan(0);

    const sixPlayersThreeMafia = validateSettings(6, { ...twoMafia, mafiaCount: 3 });
    expect(sixPlayersThreeMafia.valid).toBe(false);
  });

  it('sanitizes names and chat messages', () => {
    expect(sanitizePlayerName('  <Alice>   Smith  ')).toBe('Alice Smith');
    expect(sanitizePlayerName('A'.repeat(40)).length).toBe(20);
    expect(sanitizeChatMessage('  hello\x00world  ')).toBe('helloworld');
  });
});

