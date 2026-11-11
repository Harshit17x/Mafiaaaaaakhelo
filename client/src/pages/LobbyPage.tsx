import React, { useState } from 'react';
import {
  Check,
  Copy,
  Lock,
  Play,
  Unlock,
} from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { LobbyWaitingLounge } from '../components/LobbyWaitingLounge';
import { useGameStore } from '../stores/useGameStore';

export function LobbyPage({
  speakingPeerIds = new Set<string>(),
}: {
  speakingPeerIds?: Set<string>;
}) {
  const room = useGameStore((s) => s.room);
  const lobbyPositions = useGameStore((s) => s.lobbyPositions);
  const setReady = useGameStore((s) => s.setReady);
  const kickPlayer = useGameStore((s) => s.kickPlayer);
  const transferHost = useGameStore((s) => s.transferHost);
  const toggleLock = useGameStore((s) => s.toggleLock);
  const startGame = useGameStore((s) => s.startGame);
  const sendLobbyMove = useGameStore((s) => s.sendLobbyMove);
  const setAvatarOpen = useGameStore((s) => s.setAvatarOpen);
  const avatarOpen = useGameStore((s) => s.avatarOpen);
  const rulesOpen = useGameStore((s) => s.rulesOpen);

  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const me = room.players.find((p) => p.id === room.myPlayerId);
  const isHost = Boolean(me?.isHost);
  const { settings, validation } = room;

  const playingPlayers = room.players.filter((p) => p.isPlaying);
  const notReadyCount = playingPlayers.filter((p) => !p.isReady).length;
  const allPlayingReady = playingPlayers.length > 0 && notReadyCount === 0;
  const canStart = isHost && validation.valid && allPlayingReady;

  const inviteUrl = `${window.location.origin}/?room=${room.roomCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
    }
  };

  const startHint = !validation.valid
    ? (validation.errors[0] ?? 'Waiting for valid player setup')
    : !allPlayingReady
      ? `Waiting for ${notReadyCount} player${notReadyCount === 1 ? '' : 's'} to mark Ready`
      : room.game.lobbyCountdownEndsAt !== null
        ? 'All players ready — countdown started!'
        : null;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-6 space-y-3.5 sm:space-y-5">
      <div className="noir-card rounded-2xl p-3.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="text-[10.5px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.25em] text-gold-400">
            Speakeasy Cushion Lounge
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
            <span className="font-mono text-xl sm:text-3xl font-bold tracking-[0.22em] sm:tracking-[0.25em] text-gold-200">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gold-500/40 bg-noir-800 hover:bg-noir-700 text-xs font-semibold text-gold-200 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Link
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Invite Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-1.5 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isHost && (
              <button
                type="button"
                onClick={() => void toggleLock(!room.locked)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                  room.locked
                    ? 'border-crimson-500/60 bg-crimson-900/60 text-crimson-200'
                    : 'border-gold-500/40 bg-noir-800 text-cream-200 hover:bg-noir-700'
                }`}
              >
                {room.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {room.locked ? 'Room Locked' : 'Room Open'}
              </button>
            )}

            {me?.isPlaying && (
              <button
                type="button"
                onClick={() => void setReady(!me.isReady)}
                className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-display font-bold uppercase tracking-wider text-xs sm:text-sm transition ${
                  me.isReady
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-400/50'
                    : 'bg-noir-800 hover:bg-noir-700 text-gold-200 border border-gold-500/50'
                }`}
              >
                {me.isReady ? 'Ready ✓' : 'Mark Ready'}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => void startGame()}
                className="flex-1 sm:flex-initial px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold uppercase tracking-wider text-xs sm:text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 transition"
              >
                <Play className="w-4 h-4" />
                Deal Roles
              </button>
            )}
          </div>
          {isHost && startHint && (
            <span className="text-[11px] text-amber-300/90">{startHint}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_19.5rem] xl:grid-cols-[minmax(0,1fr)_21.5rem] gap-3.5 sm:gap-5 items-stretch">
        <div className="min-w-0">
          <LobbyWaitingLounge
            players={room.players}
            myPlayerId={room.myPlayerId}
            viewerIsHost={isHost}
            speakingPeerIds={speakingPeerIds}
            lobbyPositions={lobbyPositions}
            lobbyCountdownEndsAt={room.game.lobbyCountdownEndsAt}
            serverTime={room.serverTime}
            validationValid={validation.valid}
            validationError={validation.errors[0] ?? null}
            modalOpen={avatarOpen || rulesOpen}
            onMove={sendLobbyMove}
            onOpenCustomization={() => setAvatarOpen(true)}
            onTransferHost={(id) => void transferHost(id)}
            onKickPlayer={(id) => void kickPlayer(id)}
          />
        </div>

        <aside
          aria-label="Lobby chat sidebar"
          className="min-w-0 lg:relative lg:min-h-[26rem]"
        >
          <div className="lg:absolute lg:inset-0 flex flex-col">
            <ChatPanel className="h-72 sm:h-96 lg:h-full" />
          </div>
        </aside>
      </div>

      <div className="noir-card rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-cream-300">
        <span className="font-mono uppercase tracking-[0.16em] text-gold-300">
          Table Rules
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-noir-900 border border-gold-500/25">
            {settings.narratorMode === 'HUMAN_HOST' ? 'Human Host' : 'Auto-Narrator'}
          </span>
          <span className="px-2 py-0.5 rounded bg-crimson-950/70 border border-crimson-500/40 text-crimson-200">
            {settings.mafiaCount} Mafia
          </span>
          {settings.healerEnabled && (
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/35 text-emerald-200">
              Healer
            </span>
          )}
          {settings.detectiveEnabled && (
            <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/35 text-sky-200">
              Detective
            </span>
          )}
          {settings.jokerEnabled && (
            <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/35 text-purple-200">
              Joker
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-noir-900 border border-gold-500/20">
            Discuss {settings.discussionTimeSec ? `${settings.discussionTimeSec}s` : 'Off'} • Vote{' '}
            {settings.votingTimeSec ? `${settings.votingTimeSec}s` : 'Off'} • Night{' '}
            {settings.nightActionTimeSec ? `${settings.nightActionTimeSec}s` : 'Off'}
          </span>
        </div>
      </div>
    </div>
  );
}
