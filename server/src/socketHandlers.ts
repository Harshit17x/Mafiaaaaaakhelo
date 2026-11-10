import type {
  AckResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@midnight-city/shared';
import type { Server, Socket } from 'socket.io';
import { SocketRateLimiter } from './rateLimiter.js';
import type { RoomEmitter, RoomManager } from './roomManager.js';

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type GameIoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function createSocketIoEmitter(io: GameIoServer): RoomEmitter {
  return {
    emitRoomState(socketId, state) {
      io.to(socketId).emit('room:state', state);
    },
    emitVoiceState(socketId, state) {
      io.to(socketId).emit('voice:state', state);
    },
    emitChatMessage(socketId, message) {
      io.to(socketId).emit('chat:message', message);
    },
    emitChatHistory(socketId, messages) {
      io.to(socketId).emit('chat:history', messages);
    },
    emitNarrationCue(socketId, cue) {
      io.to(socketId).emit('narration:cue', cue);
    },
    emitKicked(socketId, reason) {
      io.to(socketId).emit('room:kicked', { reason });
    },
    emitVoiceSignal(socketId, payload) {
      io.to(socketId).emit('voice:signal', payload);
    },
    joinSocketRoom(socketId, roomCode) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        void sock.join(roomCode);
      }
    },
    leaveSocketRoom(socketId, roomCode) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        void sock.leave(roomCode);
      }
    },
  };
}

export function registerSocketHandlers(
  io: GameIoServer,
  manager: RoomManager,
  rateLimiter: SocketRateLimiter
): void {
  io.on('connection', (socket: GameSocket) => {
    const checkGeneralRate = (
      callback?: (res: AckResponse<never>) => void
    ): boolean => {
      if (rateLimiter.allow(`gen:${socket.id}`, 45, 5000)) {
        return true;
      }
      if (callback) {
        callback({ ok: false, error: 'Rate limit exceeded. Slow down slightly.' });
      }
      return false;
    };

    socket.on('room:create', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.createRoom(socket.id, payload?.playerName ?? ''));
    });

    socket.on('room:join', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(
        manager.joinRoom(
          socket.id,
          payload?.roomCode ?? '',
          payload?.playerName ?? '',
          payload?.sessionToken
        )
      );
    });

    socket.on('room:reconnect', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(
        manager.reconnectRoom(
          socket.id,
          payload?.roomCode ?? '',
          payload?.sessionToken ?? ''
        )
      );
    });

    socket.on('room:leave', (callback) => {
      callback(manager.leaveRoom(socket.id));
    });

    socket.on('room:set_ready', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.setReady(socket.id, Boolean(payload?.ready)));
    });

    socket.on('room:update_settings', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.updateSettings(socket.id, payload?.settings ?? {}));
    });

    socket.on('room:kick_player', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.kickPlayer(socket.id, payload?.targetPlayerId ?? ''));
    });

    socket.on('room:transfer_host', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.transferHost(socket.id, payload?.targetPlayerId ?? ''));
    });

    socket.on('room:toggle_lock', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.toggleLock(socket.id, Boolean(payload?.locked)));
    });

    socket.on('game:start', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.startGame(socket.id));
    });

    socket.on('game:acknowledge_role', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.acknowledgeRole(socket.id));
    });

    socket.on('game:night_mafia_select', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.nightMafiaSelect(socket.id, payload?.targetPlayerId ?? ''));
    });

    socket.on('game:night_mafia_confirm_truce', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.nightMafiaConfirmTruce(socket.id));
    });

    socket.on('game:night_healer_select', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.nightHealerSelect(socket.id, payload?.targetPlayerId ?? ''));
    });

    socket.on('game:night_detective_select', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.nightDetectiveSelect(socket.id, payload?.targetPlayerId ?? ''));
    });

    socket.on('game:toggle_accuse', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.toggleAccuse(socket.id, payload?.targetPlayerId ?? null));
    });

    socket.on('game:toggle_ready_to_vote', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.toggleReadyToVote(socket.id, Boolean(payload?.ready)));
    });

    socket.on('game:cast_vote', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.castVote(socket.id, payload?.targetId ?? ''));
    });

    socket.on('game:play_again', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.playAgain(socket.id));
    });

    socket.on('host:advance_night_step', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostAdvanceNightStep(socket.id, payload?.targetStep));
    });

    socket.on('host:start_discussion', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostStartDiscussion(socket.id));
    });

    socket.on('host:start_vote', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostStartVote(socket.id));
    });

    socket.on('host:end_vote_early', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostEndVoteEarly(socket.id));
    });

    socket.on('host:advance_from_vote_result', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostAdvanceFromVoteResult(socket.id));
    });

    socket.on('host:toggle_pause', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostTogglePause(socket.id, Boolean(payload?.paused)));
    });

    socket.on('host:extend_timer', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostExtendTimer(socket.id, Number(payload?.seconds ?? 0)));
    });

    socket.on('host:force_disconnected_actions', (callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.hostForceDisconnectedActions(socket.id));
    });

    socket.on('chat:send', (payload, callback) => {
      if (!rateLimiter.allow(`chat:${socket.id}`, 8, 5000)) {
        callback({ ok: false, error: 'You are sending messages too quickly.' });
        return;
      }
      callback(
        manager.sendChat(
          socket.id,
          payload?.channel ?? 'PUBLIC',
          payload?.content ?? ''
        )
      );
    });

    socket.on('voice:join', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.setVoiceJoined(socket.id, Boolean(payload?.joined)));
    });

    socket.on('voice:mic_status', (payload, callback) => {
      if (!checkGeneralRate(callback)) return;
      callback(manager.setMicStatus(socket.id, Boolean(payload?.enabled)));
    });

    socket.on('voice:signal', (payload) => {
      if (!rateLimiter.allow(`sig:${socket.id}`, 120, 5000)) {
        return;
      }
      if (payload?.toPlayerId && payload?.signal) {
        manager.relayVoiceSignal(socket.id, payload.toPlayerId, payload.signal);
      }
    });

    socket.on('disconnect', () => {
      rateLimiter.clearPrefix(`gen:${socket.id}`);
      rateLimiter.clearPrefix(`chat:${socket.id}`);
      rateLimiter.clearPrefix(`sig:${socket.id}`);
      manager.handleDisconnect(socket.id);
    });
  });
}

