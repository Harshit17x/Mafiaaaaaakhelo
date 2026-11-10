import { randomBytes, randomUUID } from 'node:crypto';
import {
  DEFAULT_TIMINGS,
  DISCONNECT_GRACE_MS,
  HOST_AUTO_TRANSFER_GRACE_MS,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_INACTIVITY_TTL_MS,
  getSuggestedMafiaCount,
  normalizeRoomCode,
  sanitizeChatMessage,
  sanitizePlayerName,
} from '@midnight-city/shared';
import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  ClientRoomView,
  JoinSuccessPayload,
  NightSubPhase,
  RoomSettings,
  ServerPlayer,
  VoiceSignalPayload,
  VoiceState,
} from '@midnight-city/shared';
import {
  acknowledgeRole,
  advanceFromDawn,
  advanceFromVoteResult,
  advanceNightStep,
  applyAutoActionsForDisconnected,
  castVote,
  cryptoRandomInt,
  handleMidGameLeaveOrKick,
  isCurrentNightTurnReadyToAdvance,
  resetToLobby,
  resolveDayVote,
  startDayVote,
  startGame,
  submitDetectiveTarget,
  submitHealerTarget,
  submitMafiaTarget,
  submitMafiaTruceConfirm,
  toggleAccuse,
  toggleReadyToVote,
} from './engine/index.js';
import type { EngineEvent, EngineTimings, RandomIntFn } from './engine/index.js';
import { createRoomRecord } from './roomStore.js';
import type { RoomRepository, ServerRoom } from './roomStore.js';
import {
  buildClientRoomView,
  canViewerReadChatChannel,
  filterChatHistoryForPlayer,
} from './viewFilter.js';
import { computeVoiceStateForPlayer } from './voiceState.js';

export interface RoomEmitter {
  emitRoomState(socketId: string, state: ClientRoomView): void;
  emitVoiceState(socketId: string, state: VoiceState): void;
  emitChatMessage(socketId: string, message: ChatMessage): void;
  emitChatHistory(socketId: string, messages: ChatMessage[]): void;
  emitNarrationCue(socketId: string, cue: { key: string; text: string }): void;
  emitKicked(socketId: string, reason: string): void;
  emitVoiceSignal(
    socketId: string,
    payload: { fromPlayerId: string; signal: VoiceSignalPayload }
  ): void;
  joinSocketRoom(socketId: string, roomCode: string): void;
  leaveSocketRoom(socketId: string, roomCode: string): void;
}

export interface RoomManagerOptions {
  repository: RoomRepository;
  emitter: RoomEmitter;
  timings?: EngineTimings;
  disconnectGraceMs?: number;
  hostAutoTransferGraceMs?: number;
  roomInactivityTtlMs?: number;
  randInt?: RandomIntFn;
  now?: () => number;
}

interface MemberLink {
  roomCode: string;
  playerId: string;
}

export class RoomManager {
  private readonly repo: RoomRepository;
  private readonly emitter: RoomEmitter;
  private readonly timings: EngineTimings;
  private readonly disconnectGraceMs: number;
  private readonly hostAutoTransferGraceMs: number;
  private readonly roomInactivityTtlMs: number;
  private readonly randInt: RandomIntFn;
  private readonly now: () => number;

  private readonly socketToMember = new Map<string, MemberLink>();
  private readonly playerToSocket = new Map<string, string>();
  private readonly pausedAtByRoom = new Map<string, number>();

  constructor(options: RoomManagerOptions) {
    this.repo = options.repository;
    this.emitter = options.emitter;
    this.timings = options.timings ?? DEFAULT_TIMINGS;
    this.disconnectGraceMs = options.disconnectGraceMs ?? DISCONNECT_GRACE_MS;
    this.hostAutoTransferGraceMs =
      options.hostAutoTransferGraceMs ?? HOST_AUTO_TRANSFER_GRACE_MS;
    this.roomInactivityTtlMs = options.roomInactivityTtlMs ?? ROOM_INACTIVITY_TTL_MS;
    this.randInt = options.randInt ?? cryptoRandomInt;
    this.now = options.now ?? (() => Date.now());
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        const idx = this.randInt(0, ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[idx]!;
      }
      if (!this.repo.get(code)) {
        return code;
      }
    }
    return randomBytes(3).toString('hex').toUpperCase();
  }

  private generateSessionToken(): string {
    return randomBytes(24).toString('hex');
  }

  private getMemberContext(
    socketId: string
  ): { room: ServerRoom; player: ServerPlayer } | null {
    const link = this.socketToMember.get(socketId);
    if (!link) {
      return null;
    }
    const room = this.repo.get(link.roomCode);
    if (!room) {
      this.socketToMember.delete(socketId);
      return null;
    }
    const player = room.players.find((p) => p.id === link.playerId);
    if (!player) {
      this.socketToMember.delete(socketId);
      return null;
    }
    return { room, player };
  }

  private bindSocket(socketId: string, roomCode: string, playerId: string): void {
    const previousSocketId = this.playerToSocket.get(playerId);
    if (previousSocketId && previousSocketId !== socketId) {
      this.socketToMember.delete(previousSocketId);
      this.emitter.leaveSocketRoom(previousSocketId, roomCode);
    }
    this.socketToMember.set(socketId, { roomCode, playerId });
    this.playerToSocket.set(playerId, socketId);
    this.emitter.joinSocketRoom(socketId, roomCode);
  }

  private broadcastRoom(room: ServerRoom, events: readonly EngineEvent[] = []): void {
    const currentNow = this.now();
    for (const player of room.players) {
      if (!player.connected) {
        continue;
      }
      const sockId = this.playerToSocket.get(player.id);
      if (!sockId) {
        continue;
      }
      this.emitter.emitRoomState(sockId, buildClientRoomView(room, player.id, currentNow));
      this.emitter.emitVoiceState(sockId, computeVoiceStateForPlayer(room, player.id));
      for (const ev of events) {
        if (ev.type === 'NARRATION') {
          this.emitter.emitNarrationCue(sockId, { key: ev.key, text: ev.text });
        }
      }
    }
  }

  private syncMafiaSuggestedCountIfUnset(room: ServerRoom): void {
    if (room.mafiaCountManualOverride) {
      return;
    }
    const playingCount = room.players.filter((p) => p.isPlaying).length;
    if (playingCount >= 1) {
      room.settings = {
        ...room.settings,
        mafiaCount: getSuggestedMafiaCount(playingCount),
      };
    }
  }

  createRoom(socketId: string, rawName: string): AckResponse<JoinSuccessPayload> {
    const name = sanitizePlayerName(rawName);
    if (name.length < 1) {
      return { ok: false, error: 'Please enter a valid player name.' };
    }
    if (this.socketToMember.has(socketId)) {
      this.leaveRoom(socketId);
    }

    const currentNow = this.now();
    const roomCode = this.generateRoomCode();
    const playerId = randomUUID();
    const sessionToken = this.generateSessionToken();

    const hostPlayer: ServerPlayer = {
      id: playerId,
      name,
      sessionToken,
      isHost: true,
      isPlaying: true,
      isReady: false,
      isAlive: false,
      role: null,
      roleAcknowledged: false,
      connected: true,
      disconnectedAt: null,
      disconnectDeadline: null,
      micEnabled: false,
      voiceJoined: false,
      joinedAt: currentNow,
    };

    const room = createRoomRecord(roomCode, hostPlayer, currentNow);
    this.repo.set(room);
    this.bindSocket(socketId, roomCode, playerId);
    this.broadcastRoom(room);
    this.emitter.emitChatHistory(socketId, []);

    return { ok: true, roomCode, playerId, sessionToken };
  }

  joinRoom(
    socketId: string,
    rawCode: string,
    rawName: string,
    sessionToken?: string
  ): AckResponse<JoinSuccessPayload> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.repo.get(roomCode);
    if (!room) {
      return { ok: false, error: 'Room not found. Check the 6-character code.' };
    }

    if (sessionToken) {
      const existing = room.players.find((p) => p.sessionToken === sessionToken);
      if (existing) {
        return this.reconnectRoom(socketId, roomCode, sessionToken);
      }
    }

    const name = sanitizePlayerName(rawName);
    if (name.length < 1) {
      return { ok: false, error: 'Please enter a valid player name.' };
    }

    if (room.game.phase !== 'LOBBY') {
      return { ok: false, error: 'This game has already started.' };
    }
    if (room.locked) {
      return { ok: false, error: 'This room is locked by the host.' };
    }

    const playingCount = room.players.filter((p) => p.isPlaying).length;
    if (playingCount >= MAX_PLAYERS) {
      return { ok: false, error: `Room is full (maximum ${MAX_PLAYERS} players).` };
    }

    const lowerName = name.toLowerCase();
    if (room.players.some((p) => p.name.toLowerCase() === lowerName)) {
      return { ok: false, error: 'That name is already taken in this room.' };
    }

    if (this.socketToMember.has(socketId)) {
      this.leaveRoom(socketId);
    }

    const currentNow = this.now();
    const playerId = randomUUID();
    const newSessionToken = this.generateSessionToken();

    const newPlayer: ServerPlayer = {
      id: playerId,
      name,
      sessionToken: newSessionToken,
      isHost: false,
      isPlaying: true,
      isReady: false,
      isAlive: false,
      role: null,
      roleAcknowledged: false,
      connected: true,
      disconnectedAt: null,
      disconnectDeadline: null,
      micEnabled: false,
      voiceJoined: false,
      joinedAt: currentNow,
    };

    room.players = [...room.players, newPlayer];
    room.lastActivityAt = currentNow;
    this.syncMafiaSuggestedCountIfUnset(room);
    this.bindSocket(socketId, roomCode, playerId);
    this.broadcastRoom(room);
    this.emitter.emitChatHistory(socketId, filterChatHistoryForPlayer(room, playerId));

    return { ok: true, roomCode, playerId, sessionToken: newSessionToken };
  }

  reconnectRoom(
    socketId: string,
    rawCode: string,
    sessionToken: string
  ): AckResponse<JoinSuccessPayload> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.repo.get(roomCode);
    if (!room) {
      return { ok: false, error: 'Room expired or no longer exists.' };
    }
    const existing = room.players.find((p) => p.sessionToken === sessionToken);
    if (!existing) {
      return { ok: false, error: 'Session expired. Please rejoin the room.' };
    }

    const currentNow = this.now();
    room.players = room.players.map((p) =>
      p.id === existing.id
        ? {
            ...p,
            connected: true,
            disconnectedAt: null,
            disconnectDeadline: null,
          }
        : p
    );

    if (existing.isHost) {
      room.hostDisconnectedAt = null;
      if (
        room.settings.narratorMode === 'HUMAN_HOST' &&
        room.game.paused &&
        room.game.pauseReason === 'HOST_DISCONNECTED'
      ) {
        this.applyPauseState(room, false, null, currentNow);
      }
    }

    room.lastActivityAt = currentNow;
    this.bindSocket(socketId, roomCode, existing.id);
    this.broadcastRoom(room);
    this.emitter.emitChatHistory(socketId, filterChatHistoryForPlayer(room, existing.id));

    return {
      ok: true,
      roomCode,
      playerId: existing.id,
      sessionToken: existing.sessionToken,
    };
  }

  handleDisconnect(socketId: string): void {
    const link = this.socketToMember.get(socketId);
    if (!link) {
      return;
    }
    this.socketToMember.delete(socketId);
    const room = this.repo.get(link.roomCode);
    if (!room) {
      return;
    }

    const mappedSocket = this.playerToSocket.get(link.playerId);
    if (mappedSocket && mappedSocket !== socketId) {
      return;
    }
    this.playerToSocket.delete(link.playerId);

    const player = room.players.find((p) => p.id === link.playerId);
    if (!player) {
      return;
    }

    const currentNow = this.now();
    room.players = room.players.map((p) =>
      p.id === player.id
        ? {
            ...p,
            connected: false,
            disconnectedAt: currentNow,
            disconnectDeadline: currentNow + this.disconnectGraceMs,
            micEnabled: false,
          }
        : p
    );

    if (player.isHost) {
      room.hostDisconnectedAt = currentNow;
      if (
        room.settings.narratorMode === 'HUMAN_HOST' &&
        room.game.phase !== 'LOBBY' &&
        room.game.phase !== 'GAME_OVER' &&
        !room.game.paused
      ) {
        this.applyPauseState(room, true, 'HOST_DISCONNECTED', currentNow);
      }
    }

    room.lastActivityAt = currentNow;
    this.broadcastRoom(room);
  }

  leaveRoom(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: true };
    }
    const { room, player } = ctx;
    const currentNow = this.now();

    this.socketToMember.delete(socketId);
    this.playerToSocket.delete(player.id);
    this.emitter.leaveSocketRoom(socketId, room.roomCode);

    if (room.game.phase === 'LOBBY' || room.game.phase === 'GAME_OVER') {
      room.players = room.players.filter((p) => p.id !== player.id);
      if (room.players.length === 0) {
        this.repo.delete(room.roomCode);
        this.pausedAtByRoom.delete(room.roomCode);
        return { ok: true };
      }

      if (player.isHost) {
        const nextHost =
          room.players.find((p) => p.connected) ?? room.players[0]!;
        room.players = room.players.map((p) =>
          p.id === nextHost.id
            ? {
                ...p,
                isHost: true,
                isPlaying: room.settings.narratorMode === 'AUTO_NARRATOR',
              }
            : p
        );
        room.hostDisconnectedAt = nextHost.connected ? null : currentNow;
      }

      this.syncMafiaSuggestedCountIfUnset(room);
      room.lastActivityAt = currentNow;
      this.broadcastRoom(room);
      return { ok: true };
    }

    const res = handleMidGameLeaveOrKick(
      room.players,
      room.game,
      room.settings,
      player.id,
      currentNow,
      this.randInt,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    room.players = res.players;
    room.game = res.game;

    if (player.isHost) {
      const nextHost = room.players.find(
        (p) => p.connected && p.id !== player.id
      );
      if (nextHost && room.settings.narratorMode === 'AUTO_NARRATOR') {
        room.players = room.players.map((p) =>
          p.id === player.id
            ? { ...p, isHost: false }
            : p.id === nextHost.id
              ? { ...p, isHost: true }
              : p
        );
        room.hostDisconnectedAt = null;
      }
    }

    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  setReady(socketId: string, ready: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (room.game.phase !== 'LOBBY') {
      return { ok: false, error: 'Ready status can only be changed in the lobby.' };
    }
    if (!player.isPlaying) {
      return { ok: false, error: 'Narrator does not mark ready.' };
    }
    room.players = room.players.map((p) =>
      p.id === player.id ? { ...p, isReady: ready } : p
    );
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  updateSettings(socketId: string, partial: Partial<RoomSettings>): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can change room settings.' };
    }
    if (room.game.phase !== 'LOBBY') {
      return { ok: false, error: 'Settings can only be changed in the lobby.' };
    }

    const next: RoomSettings = { ...room.settings };

    if (partial.narratorMode === 'AUTO_NARRATOR' || partial.narratorMode === 'HUMAN_HOST') {
      next.narratorMode = partial.narratorMode;
    }
    if (typeof partial.mafiaCount === 'number' && Number.isInteger(partial.mafiaCount)) {
      next.mafiaCount = Math.max(1, Math.min(8, partial.mafiaCount));
      room.mafiaCountManualOverride = true;
    }
    if (typeof partial.healerEnabled === 'boolean') {
      next.healerEnabled = partial.healerEnabled;
    }
    if (typeof partial.jokerEnabled === 'boolean') {
      next.jokerEnabled = partial.jokerEnabled;
    }
    if (typeof partial.detectiveEnabled === 'boolean') {
      next.detectiveEnabled = partial.detectiveEnabled;
    }
    if (
      partial.healerSelfSaveRule === 'unlimited' ||
      partial.healerSelfSaveRule === 'not_consecutive' ||
      partial.healerSelfSaveRule === 'once_per_game' ||
      partial.healerSelfSaveRule === 'never'
    ) {
      next.healerSelfSaveRule = partial.healerSelfSaveRule;
    }
    if (typeof partial.jokerWinEndsGame === 'boolean') {
      next.jokerWinEndsGame = partial.jokerWinEndsGame;
    }
    if (typeof partial.jokerNightImmunity === 'boolean') {
      next.jokerNightImmunity = partial.jokerNightImmunity;
    }
    if (typeof partial.revealRoleOnDeath === 'boolean') {
      next.revealRoleOnDeath = partial.revealRoleOnDeath;
    }
    if (typeof partial.skipFirstNightKill === 'boolean') {
      next.skipFirstNightKill = partial.skipFirstNightKill;
    }
    if (typeof partial.allowDeadChat === 'boolean') {
      next.allowDeadChat = partial.allowDeadChat;
    }
    if (partial.discussionTimeSec === null || typeof partial.discussionTimeSec === 'number') {
      next.discussionTimeSec =
        partial.discussionTimeSec === null
          ? null
          : Math.max(15, Math.min(600, Math.round(partial.discussionTimeSec)));
    }
    if (partial.votingTimeSec === null || typeof partial.votingTimeSec === 'number') {
      next.votingTimeSec =
        partial.votingTimeSec === null
          ? null
          : Math.max(10, Math.min(300, Math.round(partial.votingTimeSec)));
    }
    if (partial.nightActionTimeSec === null || typeof partial.nightActionTimeSec === 'number') {
      next.nightActionTimeSec =
        partial.nightActionTimeSec === null
          ? null
          : Math.max(10, Math.min(180, Math.round(partial.nightActionTimeSec)));
    }
    if (typeof partial.allowSkipVote === 'boolean') {
      next.allowSkipVote = partial.allowSkipVote;
    }
    if (partial.tieRule === 'no_elimination' || partial.tieRule === 'revote_then_no_elimination') {
      next.tieRule = partial.tieRule;
    }

    room.settings = next;
    room.players = room.players.map((p) => {
      if (!p.isHost) {
        return { ...p, isPlaying: true };
      }
      const shouldPlay = next.narratorMode === 'AUTO_NARRATOR';
      return {
        ...p,
        isPlaying: shouldPlay,
        isReady: shouldPlay ? p.isReady : false,
      };
    });

    if (partial.narratorMode !== undefined) {
      this.syncMafiaSuggestedCountIfUnset(room);
    }

    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  kickPlayer(socketId: string, targetPlayerId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can kick players.' };
    }
    if (targetPlayerId === player.id) {
      return { ok: false, error: 'Host cannot kick themselves.' };
    }
    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) {
      return { ok: false, error: 'Player not found.' };
    }

    const targetSocket = this.playerToSocket.get(targetPlayerId);
    if (targetSocket) {
      this.emitter.emitKicked(targetSocket, 'You were removed from the room by the host.');
      this.socketToMember.delete(targetSocket);
      this.playerToSocket.delete(targetPlayerId);
      this.emitter.leaveSocketRoom(targetSocket, room.roomCode);
    }

    const currentNow = this.now();
    if (room.game.phase === 'LOBBY' || room.game.phase === 'GAME_OVER') {
      room.players = room.players.filter((p) => p.id !== targetPlayerId);
      this.syncMafiaSuggestedCountIfUnset(room);
      room.lastActivityAt = currentNow;
      this.broadcastRoom(room);
      return { ok: true };
    }

    const res = handleMidGameLeaveOrKick(
      room.players,
      room.game,
      room.settings,
      targetPlayerId,
      currentNow,
      this.randInt,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  transferHost(socketId: string, targetPlayerId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can transfer host.' };
    }
    if (targetPlayerId === player.id) {
      return { ok: false, error: 'You are already the host.' };
    }
    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target || !target.connected) {
      return { ok: false, error: 'Target player must be connected.' };
    }
    if (
      room.settings.narratorMode === 'HUMAN_HOST' &&
      room.game.phase !== 'LOBBY' &&
      room.game.phase !== 'GAME_OVER'
    ) {
      return {
        ok: false,
        error: 'Cannot transfer host mid-game while in Human Host mode.',
      };
    }

    room.players = room.players.map((p) => {
      if (p.id === player.id) {
        return {
          ...p,
          isHost: false,
          isPlaying: room.game.phase === 'LOBBY' ? true : p.isPlaying,
        };
      }
      if (p.id === targetPlayerId) {
        return {
          ...p,
          isHost: true,
          isPlaying:
            room.game.phase === 'LOBBY' && room.settings.narratorMode === 'HUMAN_HOST'
              ? false
              : p.isPlaying,
          isReady:
            room.game.phase === 'LOBBY' && room.settings.narratorMode === 'HUMAN_HOST'
              ? false
              : p.isReady,
        };
      }
      return p;
    });

    room.hostDisconnectedAt = null;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  toggleLock(socketId: string, locked: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can lock or unlock the room.' };
    }
    room.locked = locked;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  startGame(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can start the game.' };
    }
    const currentNow = this.now();
    const res = startGame(room.players, room.game, room.settings, currentNow, this.randInt);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  acknowledgeRole(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const currentNow = this.now();
    const res = acknowledgeRole(
      room.players,
      room.game,
      room.settings,
      player.id,
      currentNow,
      this.randInt,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  nightMafiaSelect(socketId: string, targetPlayerId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const res = submitMafiaTarget(
      room.players,
      room.game,
      room.settings,
      player.id,
      targetPlayerId
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  nightMafiaConfirmTruce(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const res = submitMafiaTruceConfirm(
      room.players,
      room.game,
      room.settings,
      player.id
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  nightHealerSelect(socketId: string, targetPlayerId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const res = submitHealerTarget(
      room.players,
      room.game,
      room.settings,
      player.id,
      targetPlayerId
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  nightDetectiveSelect(socketId: string, targetPlayerId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const res = submitDetectiveTarget(
      room.players,
      room.game,
      player.id,
      targetPlayerId
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  toggleAccuse(socketId: string, targetPlayerId: string | null): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const res = toggleAccuse(room.players, room.game, player.id, targetPlayerId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  toggleReadyToVote(socketId: string, ready: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const currentNow = this.now();
    const res = toggleReadyToVote(
      room.players,
      room.game,
      room.settings,
      player.id,
      ready,
      currentNow
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  castVote(socketId: string, targetId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const currentNow = this.now();
    const res = castVote(
      room.players,
      room.game,
      room.settings,
      player.id,
      targetId,
      currentNow,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  playAgain(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can start a new round in the lobby.' };
    }
    if (room.game.phase !== 'GAME_OVER') {
      return { ok: false, error: 'Game is still active.' };
    }
    const currentNow = this.now();
    const reset = resetToLobby(room.players, room.settings, currentNow);
    room.players = reset.players;
    room.game = reset.game;
    room.lastActivityAt = currentNow;
    this.pausedAtByRoom.delete(room.roomCode);
    this.broadcastRoom(room);
    return { ok: true };
  }

  hostAdvanceNightStep(
    socketId: string,
    targetStep?: NightSubPhase | 'DAWN'
  ): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can advance night steps.' };
    }
    if (room.settings.narratorMode !== 'HUMAN_HOST') {
      return { ok: false, error: 'Manual night step control requires Human Host mode.' };
    }
    const currentNow = this.now();
    const res = advanceNightStep(
      room.players,
      room.game,
      room.settings,
      currentNow,
      this.randInt,
      this.timings,
      targetStep
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  hostStartDiscussion(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can advance from Dawn.' };
    }
    const currentNow = this.now();
    const res = advanceFromDawn(room.players, room.game, room.settings, currentNow);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  hostStartVote(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can end discussion early.' };
    }
    const currentNow = this.now();
    const res = startDayVote(room.players, room.game, room.settings, currentNow, 1, []);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  hostEndVoteEarly(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can close the ballot early.' };
    }
    const currentNow = this.now();
    const res = resolveDayVote(
      room.players,
      room.game,
      room.settings,
      currentNow,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  hostAdvanceFromVoteResult(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can advance from vote results.' };
    }
    const currentNow = this.now();
    const res = advanceFromVoteResult(
      room.players,
      room.game,
      room.settings,
      currentNow,
      this.randInt,
      this.timings
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  private applyPauseState(
    room: ServerRoom,
    paused: boolean,
    reason: string | null,
    currentNow: number
  ): void {
    if (paused === room.game.paused) {
      return;
    }
    if (paused) {
      this.pausedAtByRoom.set(room.roomCode, currentNow);
      room.game = {
        ...room.game,
        paused: true,
        pauseReason: reason ?? 'HOST_PAUSED',
        pausedRemainingMs:
          room.game.phaseEndsAt !== null
            ? Math.max(0, room.game.phaseEndsAt - currentNow)
            : null,
      };
      return;
    }

    const pausedAt = this.pausedAtByRoom.get(room.roomCode) ?? currentNow;
    const elapsedPaused = Math.max(0, currentNow - pausedAt);
    this.pausedAtByRoom.delete(room.roomCode);

    room.game = {
      ...room.game,
      paused: false,
      pauseReason: null,
      pausedRemainingMs: null,
      phaseEndsAt:
        room.game.phaseEndsAt !== null ? room.game.phaseEndsAt + elapsedPaused : null,
      night: {
        ...room.game.night,
        subPhaseEndsAt:
          room.game.night.subPhaseEndsAt !== null
            ? room.game.night.subPhaseEndsAt + elapsedPaused
            : null,
        minStepEndsAt:
          room.game.night.minStepEndsAt !== null
            ? room.game.night.minStepEndsAt + elapsedPaused
            : null,
      },
    };
  }

  hostTogglePause(socketId: string, paused: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can pause or resume.' };
    }
    if (room.game.phase === 'LOBBY' || room.game.phase === 'GAME_OVER') {
      return { ok: false, error: 'Cannot pause outside an active game.' };
    }
    const currentNow = this.now();
    this.applyPauseState(room, paused, paused ? 'HOST_PAUSED' : null, currentNow);
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room);
    return { ok: true };
  }

  hostExtendTimer(socketId: string, seconds: number): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can extend timers.' };
    }
    const deltaMs = Math.max(-60, Math.min(300, Math.round(seconds))) * 1000;
    const currentNow = this.now();
    if (room.game.phase === 'NIGHT') {
      if (room.game.night.subPhaseEndsAt !== null) {
        room.game = {
          ...room.game,
          night: {
            ...room.game.night,
            subPhaseEndsAt: Math.max(
              currentNow + 5000,
              room.game.night.subPhaseEndsAt + deltaMs
            ),
          },
        };
      }
    } else if (room.game.phaseEndsAt !== null) {
      room.game = {
        ...room.game,
        phaseEndsAt: Math.max(currentNow + 5000, room.game.phaseEndsAt + deltaMs),
      };
    }
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room);
    return { ok: true };
  }

  hostForceDisconnectedActions(socketId: string): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can force disconnected actions.' };
    }
    const currentNow = this.now();
    const res = applyAutoActionsForDisconnected(
      room.players,
      room.game,
      room.settings,
      currentNow,
      this.randInt,
      this.timings,
      true
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    room.players = res.players;
    room.game = res.game;
    room.lastActivityAt = currentNow;
    this.broadcastRoom(room, res.events);
    return { ok: true };
  }

  sendChat(
    socketId: string,
    channel: ChatChannel,
    rawContent: string
  ): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    const content = sanitizeChatMessage(rawContent);
    if (content.length < 1) {
      return { ok: false, error: 'Message cannot be empty.' };
    }

    const phase = room.game.phase;
    if (channel === 'PUBLIC') {
      const allowedPhases =
        phase === 'LOBBY' || phase === 'ROLE_REVEAL' || phase === 'GAME_OVER';
      const dayPhases =
        phase === 'DAWN' ||
        phase === 'DAY_DISCUSSION' ||
        phase === 'DAY_VOTE' ||
        phase === 'VOTE_RESULT';
      if (!allowedPhases && !dayPhases) {
        return { ok: false, error: 'Public chat is silenced during the Night.' };
      }
      if (dayPhases && player.isPlaying && !player.isAlive) {
        return { ok: false, error: 'Dead players cannot speak in public chat.' };
      }
    } else if (channel === 'MAFIA') {
      if (
        phase !== 'NIGHT' ||
        room.game.night.subPhase !== 'MAFIA_TURN' ||
        !player.isPlaying ||
        !player.isAlive ||
        player.role !== 'MAFIA'
      ) {
        return {
          ok: false,
          error: 'Mafia chat is only open to alive Mafia during their Night turn.',
        };
      }
    } else if (channel === 'GHOST') {
      if (!room.settings.allowDeadChat) {
        return { ok: false, error: 'Dead player chat is disabled.' };
      }
      if (phase === 'LOBBY' || phase === 'ROLE_REVEAL') {
        return { ok: false, error: 'Ghost chat is not active yet.' };
      }
      if (!player.isPlaying || player.isAlive) {
        return { ok: false, error: 'Only dead players can use ghost chat.' };
      }
    } else {
      return { ok: false, error: 'Invalid chat channel.' };
    }

    const currentNow = this.now();
    const msg: ChatMessage = {
      id: randomUUID(),
      channel,
      senderId: player.id,
      senderName: player.name,
      content,
      timestamp: currentNow,
    };

    room.chatHistory = [...room.chatHistory.slice(-299), msg];
    room.lastActivityAt = currentNow;

    for (const recipient of room.players) {
      if (!recipient.connected) {
        continue;
      }
      if (!canViewerReadChatChannel(room, recipient, channel)) {
        continue;
      }
      const recipientSocket = this.playerToSocket.get(recipient.id);
      if (recipientSocket) {
        this.emitter.emitChatMessage(recipientSocket, msg);
      }
    }

    return { ok: true };
  }

  setVoiceJoined(socketId: string, joined: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    room.players = room.players.map((p) =>
      p.id === player.id
        ? { ...p, voiceJoined: joined, micEnabled: joined ? p.micEnabled : false }
        : p
    );
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  setMicStatus(socketId: string, enabled: boolean): AckResponse {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return { ok: false, error: 'You are not in a room.' };
    }
    const { room, player } = ctx;
    room.players = room.players.map((p) =>
      p.id === player.id ? { ...p, micEnabled: enabled } : p
    );
    room.lastActivityAt = this.now();
    this.broadcastRoom(room);
    return { ok: true };
  }

  relayVoiceSignal(
    socketId: string,
    toPlayerId: string,
    signal: VoiceSignalPayload
  ): void {
    const ctx = this.getMemberContext(socketId);
    if (!ctx) {
      return;
    }
    const { room, player } = ctx;
    const target = room.players.find((p) => p.id === toPlayerId && p.connected);
    if (!target) {
      return;
    }
    const targetSocket = this.playerToSocket.get(target.id);
    if (!targetSocket) {
      return;
    }
    this.emitter.emitVoiceSignal(targetSocket, {
      fromPlayerId: player.id,
      signal,
    });
  }

  tick(nowOverride?: number): void {
    const currentNow = nowOverride ?? this.now();
    for (const room of this.repo.list()) {
      if (currentNow - room.lastActivityAt >= this.roomInactivityTtlMs) {
        this.repo.delete(room.roomCode);
        this.pausedAtByRoom.delete(room.roomCode);
        continue;
      }

      let changed = false;
      let events: EngineEvent[] = [];

      if (
        room.hostDisconnectedAt !== null &&
        room.settings.narratorMode === 'AUTO_NARRATOR' &&
        currentNow - room.hostDisconnectedAt >= this.hostAutoTransferGraceMs
      ) {
        const currentHost = room.players.find((p) => p.isHost);
        const nextHost = room.players.find((p) => p.connected && !p.isHost);
        if (currentHost && !currentHost.connected && nextHost) {
          room.players = room.players.map((p) =>
            p.id === currentHost.id
              ? { ...p, isHost: false }
              : p.id === nextHost.id
                ? { ...p, isHost: true }
                : p
          );
          room.hostDisconnectedAt = null;
          changed = true;
        }
      }

      if (
        room.game.phase !== 'LOBBY' &&
        room.game.phase !== 'GAME_OVER' &&
        !room.game.paused
      ) {
        const prevPlayers = room.players;
        const prevGame = room.game;
        const autoRes = applyAutoActionsForDisconnected(
          room.players,
          room.game,
          room.settings,
          currentNow,
          this.randInt,
          this.timings,
          false
        );
        if (autoRes.ok && (autoRes.players !== prevPlayers || autoRes.game !== prevGame)) {
          room.players = autoRes.players;
          room.game = autoRes.game;
          events = events.concat(autoRes.events);
          changed = true;
        }

        if (room.settings.narratorMode === 'AUTO_NARRATOR') {
          if (
            room.game.phase === 'NIGHT' &&
            isCurrentNightTurnReadyToAdvance(
              room.players,
              room.game,
              room.settings,
              currentNow
            )
          ) {
            const stepRes = advanceNightStep(
              room.players,
              room.game,
              room.settings,
              currentNow,
              this.randInt,
              this.timings
            );
            if (stepRes.ok) {
              room.players = stepRes.players;
              room.game = stepRes.game;
              events = events.concat(stepRes.events);
              changed = true;
            }
          } else if (
            room.game.phase === 'DAWN' &&
            room.game.phaseEndsAt !== null &&
            currentNow >= room.game.phaseEndsAt
          ) {
            const dawnRes = advanceFromDawn(
              room.players,
              room.game,
              room.settings,
              currentNow
            );
            if (dawnRes.ok) {
              room.players = dawnRes.players;
              room.game = dawnRes.game;
              events = events.concat(dawnRes.events);
              changed = true;
            }
          } else if (
            room.game.phase === 'DAY_DISCUSSION' &&
            room.game.phaseEndsAt !== null &&
            currentNow >= room.game.phaseEndsAt
          ) {
            const discRes = startDayVote(
              room.players,
              room.game,
              room.settings,
              currentNow,
              1,
              []
            );
            if (discRes.ok) {
              room.players = discRes.players;
              room.game = discRes.game;
              events = events.concat(discRes.events);
              changed = true;
            }
          } else if (
            room.game.phase === 'DAY_VOTE' &&
            room.game.phaseEndsAt !== null &&
            currentNow >= room.game.phaseEndsAt
          ) {
            const voteRes = resolveDayVote(
              room.players,
              room.game,
              room.settings,
              currentNow,
              this.timings
            );
            if (voteRes.ok) {
              room.players = voteRes.players;
              room.game = voteRes.game;
              events = events.concat(voteRes.events);
              changed = true;
            }
          } else if (
            room.game.phase === 'VOTE_RESULT' &&
            room.game.phaseEndsAt !== null &&
            currentNow >= room.game.phaseEndsAt
          ) {
            const nextRes = advanceFromVoteResult(
              room.players,
              room.game,
              room.settings,
              currentNow,
              this.randInt,
              this.timings
            );
            if (nextRes.ok) {
              room.players = nextRes.players;
              room.game = nextRes.game;
              events = events.concat(nextRes.events);
              changed = true;
            }
          }
        }
      }

      if (changed) {
        room.lastActivityAt = currentNow;
        this.broadcastRoom(room, events);
      }
    }
  }
}

