import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS } from '@midnight-city/shared';
import type { GameState, ServerPlayer } from '@midnight-city/shared';
import {
  acknowledgeRole,
  advanceFromDawn,
  advanceFromVoteResult,
  advanceNightStep,
  applyAutoActionsForDisconnected,
  castVote,
  createInitialGameState,
  isCurrentNightTurnReadyToAdvance,
  resolveDawnPhase,
  startDayVote,
  startGame,
  submitDetectiveTarget,
  submitHealerTarget,
  submitMafiaTarget,
  toggleAccuse,
  toggleReadyToVote,
} from '../src/engine/stateMachine.js';

const FAST_TIMINGS = {
  SLEEP_TRANSITION_MS: 100,
  DAWN_TRANSITION_MS: 100,
  DAWN_DISPLAY_MS: 100,
  VOTE_RESULT_DISPLAY_MS: 100,
  REVOTE_ANNOUNCE_MS: 100,
  MIN_NIGHT_STEP_MS: 500,
  MAX_NIGHT_STEP_RANDOM_MS: 500,
};

function makeLobbyPlayers(count: number): ServerPlayer[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `Player ${idx + 1}`,
    sessionToken: `tok${idx + 1}`,
    isHost: idx === 0,
    isPlaying: true,
    isReady: true,
    isAlive: false,
    role: null,
    roleAcknowledged: false,
    connected: true,
    disconnectedAt: null,
    disconnectDeadline: null,
    micEnabled: false,
    voiceJoined: false,
    joinedAt: idx + 1,
  }));
}

describe('full state machine lifecycle & guards', () => {
  it('runs a full game with healer save, detective check, stealth timing, and city victory', () => {
    const settings = {
      ...DEFAULT_ROOM_SETTINGS,
      healerEnabled: true,
      detectiveEnabled: true,
    };
    let players = makeLobbyPlayers(5);
    let game: GameState = createInitialGameState(0);

    const started = startGame(players, game, settings, 100, (min) => min);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    players = started.players;
    game = started.game;
    expect(game.phase).toBe('ROLE_REVEAL');

    for (const p of players) {
      const ack = acknowledgeRole(players, game, settings, p.id, 200, (min) => min, FAST_TIMINGS);
      expect(ack.ok).toBe(true);
      if (!ack.ok) return;
      players = ack.players;
      game = ack.game;
    }

    expect(game.phase).toBe('NIGHT');
    expect(game.night.subPhase).toBe('SLEEPING');

    const mafia = players.find((p) => p.role === 'MAFIA')!;
    const healer = players.find((p) => p.role === 'HEALER')!;
    const detective = players.find((p) => p.role === 'DETECTIVE')!;
    const villager = players.find((p) => p.role === 'VILLAGER')!;

    expect(submitMafiaTarget(players, game, settings, mafia.id, villager.id).ok).toBe(false);

    let step = advanceNightStep(players, game, settings, 300, (min) => min, FAST_TIMINGS);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    players = step.players;
    game = step.game;
    expect(game.night.subPhase).toBe('MAFIA_TURN');

    expect(submitMafiaTarget(players, game, settings, mafia.id, mafia.id).ok).toBe(false);
    expect(submitMafiaTarget(players, game, settings, villager.id, villager.id).ok).toBe(false);

    const mafiaAct = submitMafiaTarget(players, game, settings, mafia.id, villager.id);
    expect(mafiaAct.ok).toBe(true);
    if (!mafiaAct.ok) return;
    game = mafiaAct.game;

    expect(isCurrentNightTurnReadyToAdvance(players, game, settings, 400)).toBe(false);
    expect(isCurrentNightTurnReadyToAdvance(players, game, settings, 850)).toBe(true);

    step = advanceNightStep(players, game, settings, 850, () => 0, FAST_TIMINGS);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    game = step.game;
    expect(game.night.subPhase).toBe('HEALER_TURN');

    const healerAct = submitHealerTarget(players, game, settings, healer.id, villager.id);
    expect(healerAct.ok).toBe(true);
    if (!healerAct.ok) return;
    game = healerAct.game;

    step = advanceNightStep(players, game, settings, 1400, () => 0, FAST_TIMINGS);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    game = step.game;
    expect(game.night.subPhase).toBe('DETECTIVE_TURN');

    const detAct = submitDetectiveTarget(players, game, detective.id, mafia.id);
    expect(detAct.ok).toBe(true);
    if (!detAct.ok) return;
    game = detAct.game;
    expect(game.night.detectiveResult?.isMafia).toBe(true);

    const dawn = resolveDawnPhase(players, game, settings, 2000, () => 0, FAST_TIMINGS);
    expect(dawn.ok).toBe(true);
    if (!dawn.ok) return;
    players = dawn.players;
    game = dawn.game;
    expect(game.phase).toBe('DAWN');
    expect(game.dawn?.killedPlayerId).toBeNull();
    expect(game.dawn?.savedByHealer).toBe(true);

    const disc = advanceFromDawn(players, game, settings, 2200);
    expect(disc.ok).toBe(true);
    if (!disc.ok) return;
    game = disc.game;
    expect(game.phase).toBe('DAY_DISCUSSION');

    const accuse = toggleAccuse(players, game, detective.id, mafia.id);
    expect(accuse.ok).toBe(true);
    if (!accuse.ok) return;
    game = accuse.game;

    let rtv = toggleReadyToVote(players, game, settings, detective.id, true, 2300);
    expect(rtv.ok).toBe(true);
    if (!rtv.ok) return;
    game = rtv.game;
    rtv = toggleReadyToVote(players, game, settings, healer.id, true, 2310);
    expect(rtv.ok).toBe(true);
    if (!rtv.ok) return;
    game = rtv.game;
    rtv = toggleReadyToVote(players, game, settings, villager.id, true, 2320);
    expect(rtv.ok).toBe(true);
    if (!rtv.ok) return;
    game = rtv.game;
    expect(game.phase).toBe('DAY_VOTE');

    expect(castVote(players, game, settings, detective.id, detective.id).ok).toBe(false);
    const v1 = castVote(players, game, settings, detective.id, mafia.id, 2400, FAST_TIMINGS);
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;
    game = v1.game;

    expect(castVote(players, game, settings, detective.id, villager.id).ok).toBe(false);

    for (const voter of players.filter((p) => p.id !== detective.id)) {
      const target = voter.id === mafia.id ? villager.id : mafia.id;
      const res = castVote(players, game, settings, voter.id, target, 2500, FAST_TIMINGS);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      players = res.players;
      game = res.game;
    }

    expect(game.phase).toBe('VOTE_RESULT');
    expect(game.day.lastVoteResolution?.eliminatedPlayerId).toBe(mafia.id);

    const end = advanceFromVoteResult(players, game, settings, 3000, () => 0, FAST_TIMINGS);
    expect(end.ok).toBe(true);
    if (!end.ok) return;
    game = end.game;
    expect(game.phase).toBe('GAME_OVER');
    expect(game.winners).toEqual(['CITY']);
    expect(game.timeline.length).toBe(2);
  });

  it('rejects dead players acting and handles disconnected vote auto-action', () => {
    const players = makeLobbyPlayers(5).map((p, idx) => ({
      ...p,
      isAlive: idx !== 4,
      role: idx === 0 ? ('MAFIA' as const) : ('VILLAGER' as const),
      connected: idx !== 3,
      disconnectDeadline: idx === 3 ? 1000 : null,
    }));
    let game = createInitialGameState(0);
    game = { ...game, phase: 'DAY_DISCUSSION', roundNumber: 1 };
    const startedVote = startDayVote(players, game, DEFAULT_ROOM_SETTINGS, 100);
    expect(startedVote.ok).toBe(true);
    if (!startedVote.ok) return;
    game = startedVote.game;

    expect(castVote(players, game, DEFAULT_ROOM_SETTINGS, 'p5', 'p1').ok).toBe(false);

    const afterDisconnectAuto = applyAutoActionsForDisconnected(
      players,
      game,
      DEFAULT_ROOM_SETTINGS,
      1500,
      (min) => min,
      FAST_TIMINGS
    );
    expect(afterDisconnectAuto.ok).toBe(true);
    if (!afterDisconnectAuto.ok) return;
    expect(afterDisconnectAuto.game.day.votes['p4']).toBeDefined();
  });

  it('aligns disconnected mafia auto-action with connected mafia vote', () => {
    const players = makeLobbyPlayers(6).map((p, idx) => ({
      ...p,
      isAlive: true,
      role: idx < 2 ? ('MAFIA' as const) : ('VILLAGER' as const),
      connected: idx !== 1,
      disconnectDeadline: idx === 1 ? 1000 : null,
    }));
    const base = createInitialGameState(0);
    const nightGame: GameState = {
      ...base,
      phase: 'NIGHT',
      roundNumber: 1,
      night: {
        ...base.night,
        subPhase: 'MAFIA_TURN',
        mafiaVotes: { p1: 'p5' },
      },
    };

    const res = applyAutoActionsForDisconnected(
      players,
      nightGame,
      DEFAULT_ROOM_SETTINGS,
      1500,
      (min) => min,
      FAST_TIMINGS
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.game.night.mafiaLockedTargetId).toBe('p5');
  });
});
