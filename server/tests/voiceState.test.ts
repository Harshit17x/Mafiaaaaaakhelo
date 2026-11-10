import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type { ServerPlayer } from '@midnight-city/shared';
import { createInitialGameState } from '../src/engine/index.js';
import { createRoomRecord } from '../src/roomStore.js';
import { computeVoiceStateForPlayer } from '../src/voiceState.js';

function makePlayer(
  id: string,
  role: ServerPlayer['role'],
  isAlive: boolean,
  isHost = false,
  isPlaying = true
): ServerPlayer {
  return {
    id,
    name: id,
    sessionToken: id,
    isHost,
    isPlaying,
    isReady: true,
    isAlive,
    role,
    roleAcknowledged: true,
    connected: true,
    disconnectedAt: null,
    disconnectDeadline: null,
    micEnabled: true,
    voiceJoined: true,
    joinedAt: 1,
  };
}

describe('Phase 5: per-phase voice channel permissions', () => {
  it('enforces Mafia private voice during MAFIA_TURN, silent Night for others, and Ghost channel during Day', () => {
    const players = [
      makePlayer('m1', 'MAFIA', true, true, true),
      makePlayer('m2', 'MAFIA', true),
      makePlayer('v1', 'VILLAGER', true),
      makePlayer('d1', 'VILLAGER', false),
      makePlayer('d2', 'HEALER', false),
    ];

    const room = createRoomRecord('VOICE1', players[0]!, 100);
    room.players = players;
    room.settings = { ...DEFAULT_ROOM_SETTINGS, allowDeadChat: true };

    room.game = {
      ...createInitialGameState(100),
      phase: 'NIGHT',
      roundNumber: 2,
      night: {
        ...createInitialGameState(100).night,
        subPhase: 'MAFIA_TURN',
      },
    };

    const m1Night = computeVoiceStateForPlayer(room, 'm1');
    expect(m1Night.channel).toBe('MAFIA');
    expect(m1Night.canSpeak).toBe(true);
    expect(m1Night.audiblePeerIds).toEqual(['m2']);

    const v1Night = computeVoiceStateForPlayer(room, 'v1');
    expect(v1Night.channel).toBe('MUTED');
    expect(v1Night.canSpeak).toBe(false);
    expect(v1Night.audiblePeerIds).toEqual([]);

    const d1Night = computeVoiceStateForPlayer(room, 'd1');
    expect(d1Night.channel).toBe('MUTED');
    expect(d1Night.canSpeak).toBe(false);
    expect(d1Night.audiblePeerIds).toEqual([]);

    room.game = { ...room.game, phase: 'DAY_DISCUSSION' };

    const v1Day = computeVoiceStateForPlayer(room, 'v1');
    expect(v1Day.channel).toBe('PUBLIC');
    expect(v1Day.canSpeak).toBe(true);
    expect(v1Day.audiblePeerIds).toEqual(['m1', 'm2']);

    const d1Day = computeVoiceStateForPlayer(room, 'd1');
    expect(d1Day.channel).toBe('GHOST');
    expect(d1Day.canSpeak).toBe(true);
    expect(d1Day.audiblePeerIds).toEqual(['m1', 'm2', 'v1', 'd2']);
    expect(d1Day.speakablePeerIds).toEqual(['d2']);

    room.settings = { ...room.settings, allowDeadChat: false };
    const d1DayMuted = computeVoiceStateForPlayer(room, 'd1');
    expect(d1DayMuted.channel).toBe('MUTED');
    expect(d1DayMuted.canSpeak).toBe(false);
    expect(d1DayMuted.audiblePeerIds).toEqual(['m1', 'm2', 'v1']);
  });

  it('allows Human Host to narrate to everyone even during Night silence', () => {
    const host = makePlayer('host', null, false, true, false);
    const players = [
      host,
      makePlayer('m1', 'MAFIA', true),
      makePlayer('v1', 'VILLAGER', true),
    ];
    const room = createRoomRecord('VOICE2', host, 100);
    room.players = players;
    room.settings = { ...DEFAULT_ROOM_SETTINGS, narratorMode: 'HUMAN_HOST' };
    room.game = {
      ...createInitialGameState(100),
      phase: 'NIGHT',
      roundNumber: 1,
      night: { ...createInitialGameState(100).night, subPhase: 'HEALER_TURN' },
    };

    const v1Voice = computeVoiceStateForPlayer(room, 'v1');
    expect(v1Voice.canSpeak).toBe(false);
    expect(v1Voice.audiblePeerIds).toEqual(['host']);

    const hostVoice = computeVoiceStateForPlayer(room, 'host');
    expect(hostVoice.canSpeak).toBe(true);
    expect(hostVoice.audiblePeerIds).toEqual(['m1', 'v1']);
  });
});

