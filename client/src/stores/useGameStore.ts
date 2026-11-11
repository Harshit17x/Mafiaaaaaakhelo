import { create } from 'zustand';
import {
  DEFAULT_ROOM_SETTINGS,
  LOBBY_COUNTDOWN_MS,
  createDefaultAvatarConfig,
  sanitizeAvatarConfig,
  sanitizeRoomSettingsPatch,
} from '@midnight-city/shared';
import type {
  AckResponse,
  ChatChannel,
  ChatMessage,
  ClientRoomView,
  LiveServerStats,
  LobbyCharacterPosition,
  NightSubPhase,
  PlayerAvatarConfig,
  RoomSettings,
  VoiceSignalPayload,
  VoiceState,
} from '@midnight-city/shared';
import {
  DEFAULT_DEV_CONFIG,
  buildDevMockState,
  isGodModeAvailable,
} from '../dev/devGodMode';
import type { DevGodModeConfig } from '../dev/devGodMode';
import {
  clearStoredSession,
  createGameSocket,
  loadStoredSession,
  saveStoredSession,
} from '../services/socket';
import type { TypedGameSocket } from '../services/socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type AvatarFlowTarget = 'create' | 'join' | null;

export interface CustomAvatarEntry {
  id: string;
  label: string;
  dataUrl: string;
}

interface GameStoreState {
  socket: TypedGameSocket | null;
  connectionStatus: ConnectionStatus;
  isRestoringSession: boolean;
  liveStats: LiveServerStats | null;
  room: ClientRoomView | null;
  lobbyPositions: Record<string, LobbyCharacterPosition>;
  voiceState: VoiceState | null;
  chatMessages: ChatMessage[];
  liveRoom: ClientRoomView | null;
  liveLobbyPositions: Record<string, LobbyCharacterPosition>;
  liveVoiceState: VoiceState | null;
  liveChatMessages: ChatMessage[];
  devGodConfig: DevGodModeConfig | null;
  devSpeakingPeerIds: string[];
  errorBanner: string | null;
  kickedReason: string | null;
  lastNarration: { key: string; text: string; seq: number } | null;
  rulesOpen: boolean;
  avatarOpen: boolean;
  avatarFlowTarget: AvatarFlowTarget;
  avatarCompletedTarget: AvatarFlowTarget;
  myAvatar: PlayerAvatarConfig;
  savedCustomAvatars: CustomAvatarEntry[];
  pendingRoomSettings: RoomSettings;
  mutedAudio: boolean;
  volume: number;
  voiceSignalListeners: Set<(fromPlayerId: string, signal: VoiceSignalPayload) => void>;

  initConnection: () => void;
  clearError: () => void;
  setRulesOpen: (open: boolean) => void;
  setAvatarOpen: (open: boolean, flowTarget?: AvatarFlowTarget) => void;
  completeAvatarFlow: () => void;
  clearCompletedAvatarFlow: () => void;
  updateAvatar: (avatar: PlayerAvatarConfig) => Promise<boolean>;
  addCustomAvatar: (dataUrl: string, label?: string) => CustomAvatarEntry;
  deleteCustomAvatar: (id: string) => Promise<void>;
  sendLobbyMove: (pos: {
    x: number;
    y: number;
    facing: 'left' | 'right';
    moving: boolean;
  }) => void;
  setDevGodConfig: (partial: Partial<DevGodModeConfig>) => void;
  resetDevGodScene: () => void;
  exitDevGodMode: () => void;
  stepDevLobbyBots: () => void;
  pushDevChatMessage: (channel: ChatChannel, senderName: string, content: string) => void;
  setPendingRoomSettings: (partial: Partial<RoomSettings>) => void;
  resetPendingRoomSettings: () => void;
  setMutedAudio: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  registerVoiceSignalListener: (
    fn: (fromPlayerId: string, signal: VoiceSignalPayload) => void
  ) => () => void;
  sendVoiceSignal: (toPlayerId: string, signal: VoiceSignalPayload) => void;

  createRoom: (playerName: string, settings?: Partial<RoomSettings>) => Promise<boolean>;
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
const CUSTOM_AVATARS_STORAGE_KEY = 'midnight_city_custom_avatars_v1';

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

function loadSavedCustomAvatars(activeAvatar: PlayerAvatarConfig): CustomAvatarEntry[] {
  let list: CustomAvatarEntry[] = [];
  try {
    const raw = localStorage.getItem(CUSTOM_AVATARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed
          .filter(
            (item): item is CustomAvatarEntry =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof (item as CustomAvatarEntry).id === 'string' &&
              typeof (item as CustomAvatarEntry).dataUrl === 'string' &&
              (item as CustomAvatarEntry).dataUrl.startsWith('data:image/')
          )
          .slice(0, 8);
      }
    }
  } catch {
  }
  if (
    activeAvatar.presetId === 'custom' &&
    activeAvatar.customDataUrl &&
    !list.some((item) => item.dataUrl === activeAvatar.customDataUrl)
  ) {
    list = [
      {
        id: 'custom-active',
        label: activeAvatar.caption || 'Custom Photo',
        dataUrl: activeAvatar.customDataUrl,
      },
      ...list,
    ].slice(0, 8);
  }
  return list;
}

function saveCustomAvatars(list: CustomAvatarEntry[]): void {
  try {
    localStorage.setItem(CUSTOM_AVATARS_STORAGE_KEY, JSON.stringify(list));
  } catch {
  }
}

const initialAudio = loadAudioPrefs();
const initialAvatar = loadAvatarPrefs();
const initialSavedCustomAvatars = loadSavedCustomAvatars(initialAvatar);

const DEV_GOD_STORAGE_KEY = 'midnight_city_dev_god_v1';

function loadDevGodConfig(): DevGodModeConfig | null {
  if (!isGodModeAvailable()) return null;
  try {
    const raw = sessionStorage.getItem(DEV_GOD_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_DEV_CONFIG, ...(JSON.parse(raw) as Partial<DevGodModeConfig>) };
    }
  } catch {
  }
  return null;
}

function saveDevGodConfig(config: DevGodModeConfig | null): void {
  try {
    if (config) {
      sessionStorage.setItem(DEV_GOD_STORAGE_KEY, JSON.stringify(config));
    } else {
      sessionStorage.removeItem(DEV_GOD_STORAGE_KEY);
    }
  } catch {
  }
}

const initialDevConfig = loadDevGodConfig();
const initialDevMock = initialDevConfig
  ? buildDevMockState(initialDevConfig, initialAvatar)
  : null;

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
    room: initialDevMock?.room ?? null,
    lobbyPositions: initialDevMock?.lobbyPositions ?? {},
    voiceState: initialDevMock?.voiceState ?? null,
    chatMessages: initialDevMock?.chatMessages ?? [],
    liveRoom: null,
    liveLobbyPositions: {},
    liveVoiceState: null,
    liveChatMessages: [],
    devGodConfig: initialDevConfig,
    devSpeakingPeerIds: initialDevMock?.speakingPeerIds ?? [],
    errorBanner: null,
    kickedReason: null,
    lastNarration: null,
    rulesOpen: false,
    avatarOpen: false,
    avatarFlowTarget: null,
    avatarCompletedTarget: null,
    myAvatar: initialAvatar,
    savedCustomAvatars: initialSavedCustomAvatars,
    pendingRoomSettings: { ...DEFAULT_ROOM_SETTINGS },
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
        if (get().devGodConfig) {
          set({ liveRoom: room, liveLobbyPositions: room.lobbyPositions ?? {} });
          return;
        }
        set({
          room,
          lobbyPositions: room.lobbyPositions ?? {},
          liveRoom: room,
          liveLobbyPositions: room.lobbyPositions ?? {},
        });
      });

      socket.on('lobby:positions', (lobbyPositions) => {
        if (get().devGodConfig) {
          set({ liveLobbyPositions: lobbyPositions });
          return;
        }
        set({ lobbyPositions, liveLobbyPositions: lobbyPositions });
      });

      socket.on('voice:state', (voiceState) => {
        if (get().devGodConfig) {
          set({ liveVoiceState: voiceState });
          return;
        }
        set({ voiceState, liveVoiceState: voiceState });
      });

      socket.on('chat:history', (messages) => {
        if (get().devGodConfig) {
          set({ liveChatMessages: messages });
          return;
        }
        set({ chatMessages: messages, liveChatMessages: messages });
      });

      socket.on('chat:message', (message) => {
        if (get().devGodConfig) {
          set((state) => ({
            liveChatMessages: [...state.liveChatMessages.slice(-299), message],
          }));
          return;
        }
        set((state) => ({
          chatMessages: [...state.chatMessages.slice(-299), message],
          liveChatMessages: [...state.liveChatMessages.slice(-299), message],
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
        if (get().devGodConfig) {
          set({
            liveRoom: null,
            liveLobbyPositions: {},
            liveVoiceState: null,
            liveChatMessages: [],
            kickedReason: reason,
          });
          return;
        }
        set({
          room: null,
          lobbyPositions: {},
          voiceState: null,
          chatMessages: [],
          liveRoom: null,
          liveLobbyPositions: {},
          liveVoiceState: null,
          liveChatMessages: [],
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

    setAvatarOpen(open, flowTarget = null) {
      if (open) {
        set({
          avatarOpen: true,
          avatarFlowTarget: flowTarget,
          avatarCompletedTarget: null,
        });
      } else {
        set({
          avatarOpen: false,
          avatarFlowTarget: null,
          avatarCompletedTarget: null,
        });
      }
    },

    completeAvatarFlow() {
      const target = get().avatarFlowTarget;
      set({
        avatarOpen: false,
        avatarFlowTarget: null,
        avatarCompletedTarget: target,
      });
    },

    clearCompletedAvatarFlow() {
      set({ avatarCompletedTarget: null });
    },

    async updateAvatar(rawAvatar) {
      const clean = sanitizeAvatarConfig(rawAvatar);
      saveAvatarPrefs(clean);
      set({ myAvatar: clean });
      const { devGodConfig, room, socket } = get();
      if (devGodConfig && room) {
        set({
          room: {
            ...room,
            players: room.players.map((p) =>
              p.id === room.myPlayerId ? { ...p, avatar: clean } : p
            ),
          },
        });
        return true;
      }
      if (room && socket && socket.connected) {
        const res = await invokeAck((sock, done) =>
          sock.emit('room:update_avatar', { avatar: clean }, done)
        );
        return res.ok;
      }
      return true;
    },

    addCustomAvatar(dataUrl, label) {
      const current = get().savedCustomAvatars;
      const existing = current.find((item) => item.dataUrl === dataUrl);
      if (existing) {
        return existing;
      }
      const entry: CustomAvatarEntry = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: label?.trim() || `Photo ${current.length + 1}`,
        dataUrl,
      };
      const next = [entry, ...current].slice(0, 8);
      saveCustomAvatars(next);
      set({ savedCustomAvatars: next });
      return entry;
    },

    async deleteCustomAvatar(id) {
      const current = get().savedCustomAvatars;
      const target = current.find((item) => item.id === id);
      const next = current.filter((item) => item.id !== id);
      saveCustomAvatars(next);
      set({ savedCustomAvatars: next });

      const active = get().myAvatar;
      if (target && active.presetId === 'custom' && active.customDataUrl === target.dataUrl) {
        const fallback = createDefaultAvatarConfig();
        await get().updateAvatar(fallback);
      }
    },

    sendLobbyMove(pos) {
      const { devGodConfig, socket, room, lobbyPositions } = get();
      if (devGodConfig && room?.game.phase === 'LOBBY') {
        set({
          lobbyPositions: {
            ...lobbyPositions,
            [room.myPlayerId]: {
              ...pos,
              updatedAt: Date.now(),
            },
          },
        });
        return;
      }
      if (socket && socket.connected && room?.game.phase === 'LOBBY') {
        socket.emit('lobby:move', pos);
      }
    },

    setDevGodConfig(partial) {
      if (!isGodModeAvailable()) return;
      const next: DevGodModeConfig = {
        ...(get().devGodConfig ?? DEFAULT_DEV_CONFIG),
        ...partial,
      };
      saveDevGodConfig(next);
      const mock = buildDevMockState(next, get().myAvatar);
      set({
        devGodConfig: next,
        room: mock.room,
        lobbyPositions: mock.lobbyPositions,
        chatMessages: mock.chatMessages,
        voiceState: mock.voiceState,
        devSpeakingPeerIds: mock.speakingPeerIds,
        errorBanner: null,
      });
    },

    resetDevGodScene() {
      const cfg = get().devGodConfig;
      if (!cfg) return;
      const mock = buildDevMockState(cfg, get().myAvatar);
      set({
        room: mock.room,
        lobbyPositions: mock.lobbyPositions,
        chatMessages: mock.chatMessages,
        voiceState: mock.voiceState,
        devSpeakingPeerIds: mock.speakingPeerIds,
      });
    },

    exitDevGodMode() {
      saveDevGodConfig(null);
      const { liveRoom, liveLobbyPositions, liveChatMessages, liveVoiceState } = get();
      set({
        devGodConfig: null,
        room: liveRoom,
        lobbyPositions: liveLobbyPositions,
        chatMessages: liveChatMessages,
        voiceState: liveVoiceState,
        devSpeakingPeerIds: [],
      });
    },

    stepDevLobbyBots() {
      const { devGodConfig, room, lobbyPositions } = get();
      if (!devGodConfig || !room || room.game.phase !== 'LOBBY') return;
      const nextPositions: Record<string, LobbyCharacterPosition> = { ...lobbyPositions };
      const now = Date.now();
      for (const p of room.players) {
        if (p.id === room.myPlayerId) continue;
        const cur = nextPositions[p.id] ?? {
          x: 480,
          y: 335,
          facing: 'right' as const,
          moving: false,
          updatedAt: now,
        };
        const dx = Math.round((Math.random() - 0.5) * 90);
        const dy = Math.round((Math.random() - 0.5) * 60);
        const nx = Math.max(90, Math.min(900, cur.x + dx));
        const ny = Math.max(150, Math.min(520, cur.y + dy));
        nextPositions[p.id] = {
          x: nx,
          y: ny,
          facing: dx < 0 ? 'left' : dx > 0 ? 'right' : cur.facing,
          moving: Math.hypot(nx - cur.x, ny - cur.y) > 4,
          updatedAt: now,
        };
      }
      set({ lobbyPositions: nextPositions });
    },

    pushDevChatMessage(channel, senderName, content) {
      const trimmed = content.trim();
      if (!trimmed) return;
      const msg: ChatMessage = {
        id: `dev-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel,
        senderId: 'dev-sim',
        senderName,
        content: trimmed,
        timestamp: Date.now(),
      };
      set((state) => ({
        chatMessages: [...state.chatMessages.slice(-299), msg],
      }));
    },

    setPendingRoomSettings(partial) {
      const { settings } = sanitizeRoomSettingsPatch(get().pendingRoomSettings, partial);
      set({ pendingRoomSettings: settings });
    },

    resetPendingRoomSettings() {
      set({ pendingRoomSettings: { ...DEFAULT_ROOM_SETTINGS } });
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

    async createRoom(playerName, settingsOverride) {
      const avatar = get().myAvatar;
      const settings = settingsOverride ?? get().pendingRoomSettings;
      const res = await invokeAck<{
        roomCode: string;
        playerId: string;
        sessionToken: string;
      }>((sock, done) => sock.emit('room:create', { playerName, avatar, settings }, done));
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
      if (get().devGodConfig) {
        get().exitDevGodMode();
        return;
      }
      await invokeAck((sock, done) => sock.emit('room:leave', done));
      clearStoredSession();
      try {
        localStorage.removeItem('midnight_city_voice_wanted_v1');
      } catch {
      }
      set({
        room: null,
        lobbyPositions: {},
        voiceState: null,
        chatMessages: [],
        liveRoom: null,
        liveLobbyPositions: {},
        liveVoiceState: null,
        liveChatMessages: [],
        errorBanner: null,
      });
    },

    async setReady(ready) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        const nextPlayers = room.players.map((p) =>
          p.id === room.myPlayerId ? { ...p, isReady: ready } : p
        );
        const playing = nextPlayers.filter((p) => p.isPlaying);
        const allReady = playing.length > 0 && playing.every((p) => p.isReady);
        set({
          room: {
            ...room,
            players: nextPlayers,
            game: {
              ...room.game,
              lobbyCountdownEndsAt:
                room.game.phase === 'LOBBY' && allReady && room.validation.valid
                  ? Date.now() + LOBBY_COUNTDOWN_MS
                  : null,
            },
          },
        });
        return;
      }
      await invokeAck((sock, done) => sock.emit('room:set_ready', { ready }, done));
    },

    async updateSettings(settings) {
      await invokeAck((sock, done) =>
        sock.emit('room:update_settings', { settings }, done)
      );
    },

    async kickPlayer(targetPlayerId) {
      const { devGodConfig, room, lobbyPositions } = get();
      if (devGodConfig && room) {
        const nextPositions = { ...lobbyPositions };
        delete nextPositions[targetPlayerId];
        set({
          room: {
            ...room,
            players: room.players.filter((p) => p.id !== targetPlayerId),
          },
          lobbyPositions: nextPositions,
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('room:kick_player', { targetPlayerId }, done)
      );
    },

    async transferHost(targetPlayerId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        set({
          room: {
            ...room,
            players: room.players.map((p) => ({
              ...p,
              isHost: p.id === targetPlayerId,
            })),
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('room:transfer_host', { targetPlayerId }, done)
      );
    },

    async toggleLock(locked) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        set({ room: { ...room, locked } });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('room:toggle_lock', { locked }, done)
      );
    },

    async startGame() {
      if (get().devGodConfig) {
        get().setDevGodConfig({ page: 'ROLE_REVEAL' });
        return;
      }
      await invokeAck((sock, done) => sock.emit('game:start', done));
    },

    async acknowledgeRole() {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        set({
          room: {
            ...room,
            game: { ...room.game, myRoleAcknowledged: true },
          },
        });
        return;
      }
      await invokeAck((sock, done) => sock.emit('game:acknowledge_role', done));
    },

    async nightMafiaSelect(targetPlayerId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room && room.game.night) {
        set({
          room: {
            ...room,
            game: {
              ...room.game,
              night: {
                ...room.game.night,
                mySelection: targetPlayerId,
                mafiaVotes: { ...(room.game.night.mafiaVotes ?? {}), [room.myPlayerId]: targetPlayerId },
              },
            },
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:night_mafia_select', { targetPlayerId }, done)
      );
    },

    async nightMafiaConfirmTruce() {
      const { devGodConfig, room } = get();
      if (devGodConfig && room && room.game.night) {
        set({
          room: {
            ...room,
            game: { ...room.game, night: { ...room.game.night, hasSubmitted: true } },
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:night_mafia_confirm_truce', done)
      );
    },

    async nightHealerSelect(targetPlayerId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room && room.game.night) {
        set({
          room: {
            ...room,
            game: {
              ...room.game,
              night: { ...room.game.night, mySelection: targetPlayerId, hasSubmitted: true },
            },
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:night_healer_select', { targetPlayerId }, done)
      );
    },

    async nightDetectiveSelect(targetPlayerId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room && room.game.night) {
        const target = room.players.find((p) => p.id === targetPlayerId);
        set({
          room: {
            ...room,
            game: {
              ...room.game,
              night: {
                ...room.game.night,
                mySelection: targetPlayerId,
                hasSubmitted: true,
                detectiveResult: {
                  nightNumber: room.game.roundNumber,
                  targetId: targetPlayerId,
                  targetName: target?.name ?? 'Suspect',
                  isMafia: target?.role === 'MAFIA',
                },
              },
            },
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:night_detective_select', { targetPlayerId }, done)
      );
    },

    async toggleAccuse(targetPlayerId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        set({
          room: {
            ...room,
            players: room.players.map((p) =>
              p.id === room.myPlayerId
                ? {
                    ...p,
                    accuseTargetId: p.accuseTargetId === targetPlayerId ? null : targetPlayerId,
                  }
                : p
            ),
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:toggle_accuse', { targetPlayerId }, done)
      );
    },

    async toggleReadyToVote(ready) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        set({
          room: {
            ...room,
            players: room.players.map((p) =>
              p.id === room.myPlayerId ? { ...p, readyToVote: ready } : p
            ),
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:toggle_ready_to_vote', { ready }, done)
      );
    },

    async castVote(targetId) {
      const { devGodConfig, room } = get();
      if (devGodConfig && room && room.game.vote) {
        set({
          room: {
            ...room,
            players: room.players.map((p) =>
              p.id === room.myPlayerId ? { ...p, hasVoted: true } : p
            ),
            game: {
              ...room.game,
              vote: {
                ...room.game.vote,
                myVote: targetId,
                votedPlayerIds: Array.from(
                  new Set([...room.game.vote.votedPlayerIds, room.myPlayerId])
                ),
              },
            },
          },
        });
        return;
      }
      await invokeAck((sock, done) =>
        sock.emit('game:cast_vote', { targetId }, done)
      );
    },

    async playAgain() {
      if (get().devGodConfig) {
        get().setDevGodConfig({ page: 'LOBBY', lobbyAllReadyCountdown: false });
        return;
      }
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
      const { devGodConfig, room } = get();
      if (devGodConfig && room) {
        const me = room.players.find((p) => p.id === room.myPlayerId);
        get().pushDevChatMessage(channel, me?.name ?? 'You', content);
        return true;
      }
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
