import { create } from 'zustand';
import { createDefaultAvatarConfig, sanitizeAvatarConfig } from '@midnight-city/shared';
import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  ClientRoomView,
  LiveServerStats,
  NightSubPhase,
  PlayerAvatarConfig,
  RoomSettings,
  VoiceSignalPayload,
  VoiceState,
} from '@midnight-city/shared';
import {
  clearStoredSession,
  createGameSocket,
  loadStoredSession,
  saveStoredSession,
} from '../services/socket';
import type { TypedGameSocket } from '../services/socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface GameStoreState {
  socket: TypedGameSocket | null;
  connectionStatus: ConnectionStatus;
  isRestoringSession: boolean;
  liveStats: LiveServerStats | null;
  room: ClientRoomView | null;
  voiceState: VoiceState | null;
  chatMessages: ChatMessage[];
  errorBanner: string | null;
  kickedReason: string | null;
  lastNarration: { key: string; text: string; seq: number } | null;
  rulesOpen: boolean;
  avatarOpen: boolean;
  myAvatar: PlayerAvatarConfig;
  mutedAudio: boolean;
  volume: number;
  voiceSignalListeners: Set<(fromPlayerId: string, signal: VoiceSignalPayload) => void>;

  initConnection: () => void;
  clearError: () => void;
  setRulesOpen: (open: boolean) => void;
  setAvatarOpen: (open: boolean) => void;
  updateAvatar: (avatar: PlayerAvatarConfig) => Promise<boolean>;
  setMutedAudio: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  registerVoiceSignalListener: (
    fn: (fromPlayerId: string, signal: VoiceSignalPayload) => void
  ) => () => void;
  sendVoiceSignal: (toPlayerId: string, signal: VoiceSignalPayload) => void;

  createRoom: (playerName: string) => Promise<boolean>;
  joinRoom: (roomCode: string, playerName: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  updateSettings: (settings: Partial<RoomSettings>) => Promise<void>;
  kickPlayer: (targetPlayerId: string) => Promise<void>;
  transferHost: (targetPlayerId: string) => Promise<void>;
  toggleLock: (locked: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  acknowledgeRole: () => Promise<void>;
  nightMafiaSelect: (targetPlayerId: string) => Promise<void>;
  nightMafiaConfirmTruce: () => Promise<void>;
  nightHealerSelect: (targetPlayerId: string) => Promise<void>;
  nightDetectiveSelect: (targetPlayerId: string) => Promise<void>;
  toggleAccuse: (targetPlayerId: string | null) => Promise<void>;
  toggleReadyToVote: (ready: boolean) => Promise<void>;
  castVote: (targetId: string) => Promise<void>;
  playAgain: () => Promise<void>;
  hostAdvanceNightStep: (targetStep?: NightSubPhase | 'DAWN') => Promise<void>;
  hostStartDiscussion: () => Promise<void>;
  hostStartVote: () => Promise<void>;
  hostEndVoteEarly: () => Promise<void>;
  hostAdvanceFromVoteResult: () => Promise<void>;
  hostTogglePause: (paused: boolean) => Promise<void>;
  hostExtendTimer: (seconds: number) => Promise<void>;
  hostForceDisconnectedActions: () => Promise<void>;
  sendChat: (channel: ChatChannel, content: string) => Promise<boolean>;
  setVoiceJoined: (joined: boolean) => Promise<void>;
  setMicStatus: (enabled: boolean) => Promise<void>;
}

function loadAudioPrefs(): { muted: boolean; volume: number } {
  try {
    const raw = localStorage.getItem('midnight_city_audio_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as { muted?: boolean; volume?: number };
      return {
        muted: Boolean(parsed.muted),
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.7,
      };
    }
  } catch {
  }
  return { muted: false, volume: 0.7 };
}

function saveAudioPrefs(muted: boolean, volume: number): void {
  try {
    localStorage.setItem('midnight_city_audio_v1', JSON.stringify({ muted, volume }));
  } catch {
  }
}

const AVATAR_STORAGE_KEY = 'midnight_city_avatar_v1';

function loadAvatarPrefs(): PlayerAvatarConfig {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (raw) {
      return sanitizeAvatarConfig(JSON.parse(raw));
    }
  } catch {
  }
  return createDefaultAvatarConfig();
}

function saveAvatarPrefs(avatar: PlayerAvatarConfig): void {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(avatar));
  } catch {
  }
}

const initialAudio = loadAudioPrefs();
const initialAvatar = loadAvatarPrefs();

export const useGameStore = create<GameStoreState>((set, get) => {
  async function invokeAck<T = undefined>(
    fn: (socket: TypedGameSocket, done: (res: AckResponse<T>) => void) => void
  ): Promise<AckResponse<T>> {
    const sock = get().socket;
    if (!sock || !sock.connected) {
      const err: AckResponse<T> = { ok: false, error: 'Not connected to server.' };
      set({ errorBanner: err.error });
      return err;
    }
    return new Promise((resolve) => {
      fn(sock, (res) => {
        if (!res.ok) {
          set({ errorBanner: res.error });
        }
        resolve(res);
      });
    });
  }

  return {
    socket: null,
    connectionStatus: 'connecting',
    isRestoringSession: Boolean(loadStoredSession()),
    liveStats: null,
    room: null,
    voiceState: null,
    chatMessages: [],
    errorBanner: null,
    kickedReason: null,
    lastNarration: null,
    rulesOpen: false,
    avatarOpen: false,
    myAvatar: initialAvatar,
    mutedAudio: initialAudio.muted,
    volume: initialAudio.volume,
    voiceSignalListeners: new Set(),

    initConnection() {
      if (get().socket) {
        return;
      }
      const socket = createGameSocket();
      set({ socket, connectionStatus: 'connecting' });

      socket.on('connect', () => {
        set({ connectionStatus: 'connected', kickedReason: null });
        const stored = loadStoredSession();
        if (stored) {
          set({ isRestoringSession: true });
          socket.emit(
            'room:reconnect',
            { roomCode: stored.roomCode, sessionToken: stored.sessionToken },
            (res) => {
              set({ isRestoringSession: false });
              if (!res.ok) {
                clearStoredSession();
                set({ room: null, errorBanner: res.error });
              }
            }
          );
        } else {
          set({ isRestoringSession: false });
        }
      });

      socket.on('disconnect', () => {
        set({ connectionStatus: 'reconnecting', liveStats: null });
      });

      socket.io.on('reconnect_attempt', () => {
        set({ connectionStatus: 'reconnecting' });
      });

      socket.io.on('reconnect_failed', () => {
        set({ connectionStatus: 'disconnected', liveStats: null });
      });

      socket.on('server:stats', (liveStats) => {
        set({ liveStats });
      });

      socket.on('room:state', (room) => {
        set({ room });
      });

      socket.on('voice:state', (voiceState) => {
        set({ voiceState });
      });

      socket.on('chat:history', (messages) => {
        set({ chatMessages: messages });
      });

      socket.on('chat:message', (message) => {
        set((state) => ({
          chatMessages: [...state.chatMessages.slice(-299), message],
        }));
      });

      socket.on('narration:cue', (cue) => {
        set((state) => ({
          lastNarration: {
            key: cue.key,
            text: cue.text,
            seq: (state.lastNarration?.seq ?? 0) + 1,
          },
        }));
      });

      socket.on('room:kicked', ({ reason }) => {
        clearStoredSession();
        set({
          room: null,
          voiceState: null,
          chatMessages: [],
          kickedReason: reason,
        });
      });

      socket.on('room:error', ({ message }) => {
        set({ errorBanner: message });
      });

      socket.on('voice:signal', ({ fromPlayerId, signal }) => {
        for (const listener of get().voiceSignalListeners) {
          listener(fromPlayerId, signal);
        }
      });

      socket.connect();
    },

    clearError() {
      set({ errorBanner: null, kickedReason: null });
    },

    setRulesOpen(open) {
      set({ rulesOpen: open });
    },

    setAvatarOpen(open) {
      set({ avatarOpen: open });
    },

    async updateAvatar(rawAvatar) {
      const clean = sanitizeAvatarConfig(rawAvatar);
      saveAvatarPrefs(clean);
      set({ myAvatar: clean });
      const { room, socket } = get();
      if (room && socket && socket.connected) {
        const res = await invokeAck((sock, done) =>
          sock.emit('room:update_avatar', { avatar: clean }, done)
        );
        return res.ok;
      }
      return true;
    },

    setMutedAudio(muted) {
      saveAudioPrefs(muted, get().volume);
      set({ mutedAudio: muted });
    },

    setVolume(volume) {
      const clamped = Math.max(0, Math.min(1, volume));
      saveAudioPrefs(get().mutedAudio, clamped);
      set({ volume: clamped });
    },

    registerVoiceSignalListener(fn) {
      get().voiceSignalListeners.add(fn);
      return () => {
        get().voiceSignalListeners.delete(fn);
      };
    },

    sendVoiceSignal(toPlayerId, signal) {
      const sock = get().socket;
      if (sock && sock.connected) {
        sock.emit('voice:signal', { toPlayerId, signal });
      }
    },

    async createRoom(playerName) {
      const avatar = get().myAvatar;
      const res = await invokeAck<{
        roomCode: string;
        playerId: string;
        sessionToken: string;
      }>((sock, done) => sock.emit('room:create', { playerName, avatar }, done));
      if (res.ok) {
        saveStoredSession({
          roomCode: res.roomCode,
          sessionToken: res.sessionToken,
          playerName: playerName.trim(),
        });
        set({ errorBanner: null, kickedReason: null });
        return true;
      }
      return false;
    },

    async joinRoom(roomCode, playerName) {
      const stored = loadStoredSession();
      const sessionToken =
        stored && stored.roomCode === roomCode.trim().toUpperCase()
          ? stored.sessionToken
          : undefined;
      const avatar = get().myAvatar;
      const res = await invokeAck<{
        roomCode: string;
        playerId: string;
        sessionToken: string;
      }>((sock, done) =>
        sock.emit('room:join', { roomCode, playerName, sessionToken, avatar }, done)
      );
      if (res.ok) {
        saveStoredSession({
          roomCode: res.roomCode,
          sessionToken: res.sessionToken,
          playerName: playerName.trim(),
        });
        set({ errorBanner: null, kickedReason: null });
        return true;
      }
      return false;
    },

    async leaveRoom() {
      await invokeAck((sock, done) => sock.emit('room:leave', done));
      clearStoredSession();
      try {
        localStorage.removeItem('midnight_city_voice_wanted_v1');
      } catch {
      }
      set({
        room: null,
        voiceState: null,
        chatMessages: [],
        errorBanner: null,
      });
    },

    async setReady(ready) {
      await invokeAck((sock, done) => sock.emit('room:set_ready', { ready }, done));
    },

    async updateSettings(settings) {
      await invokeAck((sock, done) =>
        sock.emit('room:update_settings', { settings }, done)
      );
    },

    async kickPlayer(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('room:kick_player', { targetPlayerId }, done)
      );
    },

    async transferHost(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('room:transfer_host', { targetPlayerId }, done)
      );
    },

    async toggleLock(locked) {
      await invokeAck((sock, done) =>
        sock.emit('room:toggle_lock', { locked }, done)
      );
    },

    async startGame() {
      await invokeAck((sock, done) => sock.emit('game:start', done));
    },

    async acknowledgeRole() {
      await invokeAck((sock, done) => sock.emit('game:acknowledge_role', done));
    },

    async nightMafiaSelect(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('game:night_mafia_select', { targetPlayerId }, done)
      );
    },

    async nightMafiaConfirmTruce() {
      await invokeAck((sock, done) =>
        sock.emit('game:night_mafia_confirm_truce', done)
      );
    },

    async nightHealerSelect(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('game:night_healer_select', { targetPlayerId }, done)
      );
    },

    async nightDetectiveSelect(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('game:night_detective_select', { targetPlayerId }, done)
      );
    },

    async toggleAccuse(targetPlayerId) {
      await invokeAck((sock, done) =>
        sock.emit('game:toggle_accuse', { targetPlayerId }, done)
      );
    },

    async toggleReadyToVote(ready) {
      await invokeAck((sock, done) =>
        sock.emit('game:toggle_ready_to_vote', { ready }, done)
      );
    },

    async castVote(targetId) {
      await invokeAck((sock, done) =>
        sock.emit('game:cast_vote', { targetId }, done)
      );
    },

    async playAgain() {
      await invokeAck((sock, done) => sock.emit('game:play_again', done));
    },

    async hostAdvanceNightStep(targetStep) {
      await invokeAck((sock, done) =>
        sock.emit('host:advance_night_step', { targetStep }, done)
      );
    },

    async hostStartDiscussion() {
      await invokeAck((sock, done) => sock.emit('host:start_discussion', done));
    },

    async hostStartVote() {
      await invokeAck((sock, done) => sock.emit('host:start_vote', done));
    },

    async hostEndVoteEarly() {
      await invokeAck((sock, done) => sock.emit('host:end_vote_early', done));
    },

    async hostAdvanceFromVoteResult() {
      await invokeAck((sock, done) =>
        sock.emit('host:advance_from_vote_result', done)
      );
    },

    async hostTogglePause(paused) {
      await invokeAck((sock, done) =>
        sock.emit('host:toggle_pause', { paused }, done)
      );
    },

    async hostExtendTimer(seconds) {
      await invokeAck((sock, done) =>
        sock.emit('host:extend_timer', { seconds }, done)
      );
    },

    async hostForceDisconnectedActions() {
      await invokeAck((sock, done) =>
        sock.emit('host:force_disconnected_actions', done)
      );
    },

    async sendChat(channel, content) {
      const res = await invokeAck((sock, done) =>
        sock.emit('chat:send', { channel, content }, done)
      );
      return res.ok;
    },

    async setVoiceJoined(joined) {
      await invokeAck((sock, done) => sock.emit('voice:join', { joined }, done));
    },

    async setMicStatus(enabled) {
      await invokeAck((sock, done) =>
        sock.emit('voice:mic_status', { enabled }, done)
      );
    },
  };
});
