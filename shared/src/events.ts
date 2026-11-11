import type {
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
} from './types.js';

export interface AckError {
  ok: false;
  error: string;
}

export type AckResponse<T = undefined> =
  | (T extends object ? { ok: true } & T : { ok: true })
  | AckError;

export interface JoinSuccessPayload {
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: {
      playerName: string;
      avatar?: PlayerAvatarConfig;
      settings?: Partial<RoomSettings>;
    },
    callback: (res: AckResponse<JoinSuccessPayload>) => void
  ) => void;
  'room:join': (
    payload: {
      roomCode: string;
      playerName: string;
      sessionToken?: string;
      avatar?: PlayerAvatarConfig;
    },
    callback: (res: AckResponse<JoinSuccessPayload>) => void
  ) => void;
  'room:update_avatar': (
    payload: { avatar: PlayerAvatarConfig },
    callback: (res: AckResponse) => void
  ) => void;
  'room:reconnect': (
    payload: { roomCode: string; sessionToken: string },
    callback: (res: AckResponse<JoinSuccessPayload>) => void
  ) => void;
  'room:leave': (callback: (res: AckResponse) => void) => void;
  'room:set_ready': (
    payload: { ready: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'room:update_settings': (
    payload: { settings: Partial<RoomSettings> },
    callback: (res: AckResponse) => void
  ) => void;
  'room:kick_player': (
    payload: { targetPlayerId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'room:transfer_host': (
    payload: { targetPlayerId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'room:toggle_lock': (
    payload: { locked: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'game:start': (callback: (res: AckResponse) => void) => void;
  'game:acknowledge_role': (callback: (res: AckResponse) => void) => void;
  'game:night_mafia_select': (
    payload: { targetPlayerId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'game:night_mafia_confirm_truce': (callback: (res: AckResponse) => void) => void;
  'game:night_healer_select': (
    payload: { targetPlayerId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'game:night_detective_select': (
    payload: { targetPlayerId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'game:toggle_accuse': (
    payload: { targetPlayerId: string | null },
    callback: (res: AckResponse) => void
  ) => void;
  'game:toggle_ready_to_vote': (
    payload: { ready: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'game:cast_vote': (
    payload: { targetId: string },
    callback: (res: AckResponse) => void
  ) => void;
  'game:play_again': (callback: (res: AckResponse) => void) => void;
  'host:advance_night_step': (
    payload: { targetStep?: NightSubPhase | 'DAWN' },
    callback: (res: AckResponse) => void
  ) => void;
  'host:start_discussion': (callback: (res: AckResponse) => void) => void;
  'host:start_vote': (callback: (res: AckResponse) => void) => void;
  'host:end_vote_early': (callback: (res: AckResponse) => void) => void;
  'host:advance_from_vote_result': (callback: (res: AckResponse) => void) => void;
  'host:toggle_pause': (
    payload: { paused: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'host:extend_timer': (
    payload: { seconds: number },
    callback: (res: AckResponse) => void
  ) => void;
  'host:force_disconnected_actions': (callback: (res: AckResponse) => void) => void;
  'chat:send': (
    payload: { channel: ChatChannel; content: string },
    callback: (res: AckResponse) => void
  ) => void;
  'voice:join': (
    payload: { joined: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'voice:mic_status': (
    payload: { enabled: boolean },
    callback: (res: AckResponse) => void
  ) => void;
  'voice:signal': (payload: { toPlayerId: string; signal: VoiceSignalPayload }) => void;
  'lobby:move': (payload: {
    x: number;
    y: number;
    facing: 'left' | 'right';
    moving: boolean;
  }) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: ClientRoomView) => void;
  'room:kicked': (payload: { reason: string }) => void;
  'room:error': (payload: { message: string }) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'voice:state': (state: VoiceState) => void;
  'voice:signal': (payload: { fromPlayerId: string; signal: VoiceSignalPayload }) => void;
  'narration:cue': (payload: { key: string; text: string }) => void;
  'server:stats': (stats: LiveServerStats) => void;
  'lobby:positions': (positions: Record<string, LobbyCharacterPosition>) => void;
}
