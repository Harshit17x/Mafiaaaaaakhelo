import React from 'react';
import { FastForward, Pause, Play, Plus, UserX } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

export function HostControlsBar() {
  const room = useGameStore((s) => s.room);
  const hostTogglePause = useGameStore((s) => s.hostTogglePause);
  const hostExtendTimer = useGameStore((s) => s.hostExtendTimer);
  const hostStartVote = useGameStore((s) => s.hostStartVote);
  const hostForceDisconnectedActions = useGameStore(
    (s) => s.hostForceDisconnectedActions
  );

  if (!room) return null;
  const me = room.players.find((p) => p.id === room.myPlayerId);
  if (!me?.isHost || room.game.godView !== null) return null;

  const { phase, paused, phaseEndsAt } = room.game;
  if (phase === 'LOBBY' || phase === 'GAME_OVER') return null;

  const hasDisconnected = room.players.some((p) => p.isPlaying && !p.connected);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-2 sm:pt-3">
      <div className="rounded-xl bg-noir-900/85 border border-gold-500/30 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-display uppercase tracking-wider text-gold-300 font-semibold">
          Host Controls
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void hostTogglePause(!paused)}
            className="px-3 py-1.5 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/35 text-gold-200 inline-flex items-center gap-1"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          {phaseEndsAt !== null && (
            <button
              type="button"
              onClick={() => void hostExtendTimer(30)}
              className="px-3 py-1.5 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/35 text-cream-200 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              30s
            </button>
          )}
          {phase === 'DAY_DISCUSSION' && (
            <button
              type="button"
              onClick={() => void hostStartVote()}
              className="px-3 py-1.5 rounded-lg bg-crimson-700 hover:bg-crimson-600 text-white inline-flex items-center gap-1"
            >
              <FastForward className="w-3.5 h-3.5" />
              End Discussion
            </button>
          )}
          {hasDisconnected && (
            <button
              type="button"
              onClick={() => void hostForceDisconnectedActions()}
              className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/45 text-amber-200 inline-flex items-center gap-1"
            >
              <UserX className="w-3.5 h-3.5" />
              Force Disconnected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

