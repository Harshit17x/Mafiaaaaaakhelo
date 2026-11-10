import React, { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { RoleCard } from '../components/RoleCard';
import { useGameStore } from '../stores/useGameStore';

export function RoleRevealPage() {
  const room = useGameStore((s) => s.room);
  const acknowledgeRole = useGameStore((s) => s.acknowledgeRole);
  const [hasPeeked, setHasPeeked] = useState(false);

  if (!room) return null;

  const me = room.players.find((p) => p.id === room.myPlayerId);
  const playingPlayers = room.players.filter((p) => p.isPlaying);
  const ackCount = playingPlayers.filter((p) => p.roleAcknowledged).length;

  const fellowMafiaNames = room.players
    .filter((p) => room.game.fellowMafiaIds.includes(p.id) && p.id !== room.myPlayerId)
    .map((p) => p.name);

  if (me && !me.isPlaying) {
    return (
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 text-center space-y-6">
        <div className="noir-card art-deco-border rounded-2xl p-8 space-y-4">
          <h2 className="font-display text-2xl text-gold-200 uppercase tracking-wider">
            Dossiers Distributed
          </h2>
          <p className="text-sm text-cream-300">
            Waiting for players to privately inspect and acknowledge their roles.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-noir-900 border border-gold-500/35 text-gold-300 text-sm font-mono">
            <Clock className="w-4 h-4" />
            {ackCount} / {playingPlayers.length} Ready
          </div>
        </div>
      </div>
    );
  }

  const myRole = room.game.myRole ?? 'VILLAGER';
  const acknowledged = room.game.myRoleAcknowledged;

  return (
    <div className="relative z-10 max-w-xl mx-auto px-4 py-8 flex flex-col items-center space-y-6">
      <div className="text-center space-y-1">
        <div className="text-xs uppercase tracking-[0.28em] text-gold-400">
          Confidential Briefing
        </div>
        <h2 className="font-display text-2xl sm:text-3xl text-gold-200 uppercase tracking-wider">
          Your Secret Identity
        </h2>
      </div>

      <RoleCard
        role={myRole}
        fellowMafiaNames={fellowMafiaNames}
        holdToReveal
        onFirstReveal={() => {
          if (!hasPeeked) {
            soundEngine.playCardFlip();
          }
          setHasPeeked(true);
        }}
      />

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {!acknowledged ? (
          <>
            <button
              type="button"
              disabled={!hasPeeked}
              onClick={() => void acknowledgeRole()}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold uppercase tracking-wider text-sm disabled:opacity-40 transition"
            >
              I Understand
            </button>
            {!hasPeeked && (
              <p className="text-xs text-cream-400 text-center">
                Hold the card above (or hold Space/Enter) to read your dossier first.
              </p>
            )}
          </>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Waiting for other citizens ({ackCount}/{playingPlayers.length})
          </div>
        )}
      </div>
    </div>
  );
}
