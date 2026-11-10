import type { VoiceState } from '@midnight-city/shared';
import type { ServerRoom } from './roomStore.js';

export function computeVoiceStateForPlayer(
  room: ServerRoom,
  viewerPlayerId: string
): VoiceState {
  const viewer = room.players.find((p) => p.id === viewerPlayerId);
  const humanHost =
    room.settings.narratorMode === 'HUMAN_HOST'
      ? room.players.find((p) => p.isHost && !p.isPlaying) ?? null
      : null;
  const humanHostId = humanHost ? humanHost.id : null;

  if (!viewer) {
    return {
      channel: 'MUTED',
      canSpeak: false,
      audiblePeerIds: [],
      speakablePeerIds: [],
      humanHostId,
    };
  }

  const connectedOthers = room.players.filter(
    (p) => p.id !== viewer.id && p.connected
  );

  const phase = room.game.phase;
  if (phase === 'LOBBY' || phase === 'ROLE_REVEAL' || phase === 'GAME_OVER') {
    const peerIds = connectedOthers.map((p) => p.id);
    return {
      channel: 'PUBLIC',
      canSpeak: true,
      audiblePeerIds: peerIds,
      speakablePeerIds: peerIds,
      humanHostId,
    };
  }

  if (humanHostId === viewer.id) {
    const peerIds = connectedOthers.map((p) => p.id);
    return {
      channel: 'PUBLIC',
      canSpeak: true,
      audiblePeerIds: peerIds,
      speakablePeerIds: peerIds,
      humanHostId,
    };
  }

  if (phase === 'NIGHT') {
    if (
      room.game.night.subPhase === 'MAFIA_TURN' &&
      viewer.isPlaying &&
      viewer.isAlive &&
      viewer.role === 'MAFIA'
    ) {
      const fellowMafiaIds = connectedOthers
        .filter((p) => p.isPlaying && p.isAlive && p.role === 'MAFIA')
        .map((p) => p.id);
      const audible = [...fellowMafiaIds];
      if (humanHostId && humanHost?.connected && !audible.includes(humanHostId)) {
        audible.push(humanHostId);
      }
      return {
        channel: 'MAFIA',
        canSpeak: true,
        audiblePeerIds: audible,
        speakablePeerIds: audible,
        humanHostId,
      };
    }

    const audible = humanHostId && humanHost?.connected ? [humanHostId] : [];
    return {
      channel: 'MUTED',
      canSpeak: false,
      audiblePeerIds: audible,
      speakablePeerIds: [],
      humanHostId,
    };
  }

  const aliveConnectedIds = connectedOthers
    .filter((p) => p.isPlaying && p.isAlive)
    .map((p) => p.id);

  if (viewer.isPlaying && viewer.isAlive) {
    const peers = [...aliveConnectedIds];
    if (humanHostId && humanHost?.connected && !peers.includes(humanHostId)) {
      peers.push(humanHostId);
    }
    return {
      channel: 'PUBLIC',
      canSpeak: true,
      audiblePeerIds: peers,
      speakablePeerIds: peers,
      humanHostId,
    };
  }

  const deadConnectedIds = connectedOthers
    .filter((p) => p.isPlaying && !p.isAlive)
    .map((p) => p.id);

  const audible = [...aliveConnectedIds];
  if (humanHostId && humanHost?.connected && !audible.includes(humanHostId)) {
    audible.push(humanHostId);
  }
  if (room.settings.allowDeadChat) {
    for (const deadId of deadConnectedIds) {
      if (!audible.includes(deadId)) {
        audible.push(deadId);
      }
    }
  }

  return {
    channel: room.settings.allowDeadChat ? 'GHOST' : 'MUTED',
    canSpeak: room.settings.allowDeadChat,
    audiblePeerIds: audible,
    speakablePeerIds: room.settings.allowDeadChat ? deadConnectedIds : [],
    humanHostId,
  };
}

