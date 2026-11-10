import { io as ioClient } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { SKIP_VOTE_TARGET } from '@midnight-city/shared';
import type {
  AckResponse,
  ClientRoomView,
  ClientToServerEvents,
  JoinSuccessPayload,
  ServerToClientEvents,
} from '@midnight-city/shared';
import { createMidnightCityServer } from '../src/app.js';

type BotSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface BotClient {
  name: string;
  socket: BotSocket;
  state: ClientRoomView | null;
  actedSignature: string;
}

function emitAck<T = undefined>(
  socket: BotSocket,
  event: keyof ClientToServerEvents,
  ...args: unknown[]
): Promise<AckResponse<T>> {
  return new Promise((resolve) => {
    (socket.emit as (...a: unknown[]) => void)(
      event,
      ...args,
      (res: AckResponse<T>) => resolve(res)
    );
  });
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function runSimulation() {
  const externalUrl = process.env.SERVER_URL?.trim();
  const targetRoomCode = process.env.ROOM_CODE?.trim().toUpperCase();
  const botCount = Math.max(
    targetRoomCode ? 1 : 5,
    Number(process.env.BOT_COUNT ?? (targetRoomCode ? 5 : 6))
  );

  let embeddedServer: ReturnType<typeof createMidnightCityServer> | null = null;
  let serverUrl = externalUrl ?? (targetRoomCode ? 'http://localhost:3001' : '');

  if (!serverUrl) {
    embeddedServer = createMidnightCityServer({
      tickIntervalMs: 40,
      timings: {
        SLEEP_TRANSITION_MS: 80,
        DAWN_TRANSITION_MS: 80,
        DAWN_DISPLAY_MS: 120,
        VOTE_RESULT_DISPLAY_MS: 120,
        REVOTE_ANNOUNCE_MS: 120,
        MIN_NIGHT_STEP_MS: 100,
        MAX_NIGHT_STEP_RANDOM_MS: 150,
      },
    });
    await new Promise<void>((resolve) => {
      embeddedServer!.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = embeddedServer.httpServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind ephemeral server');
    }
    serverUrl = `http://127.0.0.1:${addr.port}`;
  }

  console.log(`Connecting ${botCount} simulated bots to ${serverUrl}...`);

  const bots: BotClient[] = [];
  for (let i = 0; i < botCount; i += 1) {
    const socket: BotSocket = ioClient(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    const bot: BotClient = {
      name: `NoirBot_${i + 1}`,
      socket,
      state: null,
      actedSignature: '',
    };
    socket.on('room:state', (state) => {
      bot.state = state;
    });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    bots.push(bot);
  }

  const hostBot = bots[0]!;
  let roomCode = targetRoomCode ?? '';

  if (targetRoomCode) {
    for (const bot of bots) {
      const joinRes = await emitAck<JoinSuccessPayload>(bot.socket, 'room:join', {
        roomCode,
        playerName: bot.name,
      });
      if (!joinRes.ok) {
        throw new Error(`Join failed for ${bot.name}: ${joinRes.error}`);
      }
    }
    console.log(`Bots joined room ${roomCode} and marked Ready. Waiting for Host to start...`);
    for (const bot of bots) {
      const r = await emitAck(bot.socket, 'room:set_ready', { ready: true });
      if (!r.ok) throw new Error(r.error);
    }
  } else {
    const createRes = await emitAck<JoinSuccessPayload>(hostBot.socket, 'room:create', {
      playerName: hostBot.name,
    });
    if (!createRes.ok) {
      throw new Error(`Create failed: ${createRes.error}`);
    }
    roomCode = createRes.roomCode;
    console.log(`Room created: ${roomCode}`);

    for (let i = 1; i < bots.length; i += 1) {
      const joinRes = await emitAck<JoinSuccessPayload>(bots[i]!.socket, 'room:join', {
        roomCode,
        playerName: bots[i]!.name,
      });
      if (!joinRes.ok) {
        throw new Error(`Join failed for ${bots[i]!.name}: ${joinRes.error}`);
      }
    }

    await emitAck(hostBot.socket, 'room:update_settings', {
      settings: {
        narratorMode: 'AUTO_NARRATOR',
        healerEnabled: true,
        detectiveEnabled: true,
        jokerEnabled: botCount >= 6,
        discussionTimeSec: 15,
        votingTimeSec: 15,
        nightActionTimeSec: 15,
      },
    });

    for (const bot of bots) {
      const r = await emitAck(bot.socket, 'room:set_ready', { ready: true });
      if (!r.ok) throw new Error(r.error);
    }

    const startRes = await emitAck(hostBot.socket, 'game:start');
    if (!startRes.ok) {
      throw new Error(`Start failed: ${startRes.error}`);
    }
    console.log('Game started. Playing rounds until GAME_OVER...');
  }

  let lastLoggedPhase = '';
  const deadline = Date.now() + (targetRoomCode ? 15 * 60_000 : 30_000);

  while (Date.now() < deadline) {
    const hostState = hostBot.state;
    if (hostState) {
      const phaseTag = `${hostState.game.phase}:${hostState.game.roundNumber}:${hostState.game.night?.subPhase ?? ''}:${hostState.game.vote?.voteAttempt ?? ''}`;
      if (phaseTag !== lastLoggedPhase) {
        lastLoggedPhase = phaseTag;
        if (hostState.game.phase === 'DAWN' && hostState.game.dawn) {
          console.log(
            `[Dawn ${hostState.game.roundNumber}] ${
              hostState.game.dawn.killedPlayerName
                ? `${hostState.game.dawn.killedPlayerName} died`
                : 'Nobody died tonight'
            }`
          );
        } else if (hostState.game.phase === 'VOTE_RESULT' && hostState.game.voteResult) {
          console.log(
            `[Vote Result ${hostState.game.roundNumber}] ${
              hostState.game.voteResult.eliminatedPlayerName
                ? `Eliminated: ${hostState.game.voteResult.eliminatedPlayerName}`
                : hostState.game.voteResult.needsRevote
                  ? 'Tie -> Revote'
                  : 'No elimination'
            }`
          );
        } else {
          console.log(`[Phase] ${phaseTag}`);
        }
      }

      if (hostState.game.phase === 'GAME_OVER') {
        console.log(
          `GAME OVER! Winners: ${hostState.game.winners.join(' & ')} | Timeline entries: ${
            hostState.game.timeline?.length ?? 0
          }`
        );
        break;
      }
    }

    for (const bot of bots) {
      const st = bot.state;
      if (!st) continue;
      const me = st.players.find((p) => p.id === st.myPlayerId);
      if (!me || !me.isPlaying) continue;

      const phase = st.game.phase;

      if (phase === 'ROLE_REVEAL' && !st.game.myRoleAcknowledged) {
        const sig = `ack:${st.game.roundNumber}`;
        if (bot.actedSignature !== sig) {
          bot.actedSignature = sig;
          const res = await emitAck(bot.socket, 'game:acknowledge_role');
          if (!res.ok) throw new Error(res.error);
        }
      } else if (phase === 'NIGHT' && me.isAlive && st.game.night?.canAct) {
        const night = st.game.night;
        const sig = `night:${st.game.roundNumber}:${night.subPhase}`;
        if (bot.actedSignature !== sig) {
          bot.actedSignature = sig;
          const alivePlayers = st.players.filter((p) => p.isPlaying && p.isAlive);
          if (night.subPhase === 'MAFIA_TURN') {
            if (night.skipKillTonight) {
              await emitAck(bot.socket, 'game:night_mafia_confirm_truce');
            } else {
              const valid = alivePlayers.filter(
                (p) => !st.game.fellowMafiaIds.includes(p.id)
              );
              if (valid.length > 0) {
                const target = pickRandom(valid);
                const res = await emitAck(bot.socket, 'game:night_mafia_select', {
                  targetPlayerId: target.id,
                });
                if (!res.ok) throw new Error(res.error);
              }
            }
          } else if (night.subPhase === 'HEALER_TURN' && !night.hasSubmitted) {
            const valid = alivePlayers.filter(
              (p) => night.healerCanSelfSave || p.id !== st.myPlayerId
            );
            if (valid.length > 0) {
              const target = pickRandom(valid);
              const res = await emitAck(bot.socket, 'game:night_healer_select', {
                targetPlayerId: target.id,
              });
              if (!res.ok) throw new Error(res.error);
            }
          } else if (night.subPhase === 'DETECTIVE_TURN' && !night.hasSubmitted) {
            const valid = alivePlayers.filter((p) => p.id !== st.myPlayerId);
            if (valid.length > 0) {
              const target = pickRandom(valid);
              const res = await emitAck(bot.socket, 'game:night_detective_select', {
                targetPlayerId: target.id,
              });
              if (!res.ok) throw new Error(res.error);
            }
          }
        }
      } else if (phase === 'DAY_DISCUSSION' && me.isAlive) {
        const sig = `disc:${st.game.roundNumber}`;
        if (bot.actedSignature !== sig) {
          bot.actedSignature = sig;
          const others = st.players.filter(
            (p) => p.isPlaying && p.isAlive && p.id !== st.myPlayerId
          );
          if (others.length > 0 && Math.random() < 0.6) {
            await emitAck(bot.socket, 'game:toggle_accuse', {
              targetPlayerId: pickRandom(others).id,
            });
          }
          await emitAck(bot.socket, 'chat:send', {
            channel: 'PUBLIC',
            content: 'Watching everyone at the table closely.',
          });
          await emitAck(bot.socket, 'game:toggle_ready_to_vote', { ready: true });
        }
      } else if (phase === 'DAY_VOTE' && me.isAlive && st.game.vote && st.game.vote.myVote === null) {
        const vote = st.game.vote;
        const sig = `vote:${st.game.roundNumber}:${vote.voteAttempt}`;
        if (bot.actedSignature !== sig) {
          bot.actedSignature = sig;
          const candidates = st.players.filter(
            (p) =>
              p.isPlaying &&
              p.isAlive &&
              p.id !== st.myPlayerId &&
              (vote.voteAttempt === 1 ||
                vote.revoteCandidateIds.length === 0 ||
                vote.revoteCandidateIds.includes(p.id))
          );
          const choices = candidates.map((c) => c.id);
          if (st.settings.allowSkipVote) {
            choices.push(SKIP_VOTE_TARGET);
          }
          if (choices.length > 0) {
            const res = await emitAck(bot.socket, 'game:cast_vote', {
              targetId: pickRandom(choices),
            });
            if (!res.ok) throw new Error(res.error);
          }
        }
      }
    }

    await new Promise((r) => setTimeout(r, 45));
  }

  const finished = hostBot.state?.game.phase === 'GAME_OVER';
  for (const bot of bots) {
    bot.socket.disconnect();
  }
  if (embeddedServer) {
    await embeddedServer.stop();
  }
  if (!finished) {
    throw new Error('Simulation timed out before reaching GAME_OVER');
  }
}

runSimulation().catch((err) => {
  console.error(err);
  process.exit(1);
});

