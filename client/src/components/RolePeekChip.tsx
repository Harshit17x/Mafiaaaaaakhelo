import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';
import { useGameStore } from '../stores/useGameStore';

export function RolePeekChip() {
  const room = useGameStore((s) => s.room);
  const [peeking, setPeeking] = useState(false);

  if (!room) return null;
  const phase = room.game.phase;
  if (phase === 'LOBBY' || phase === 'ROLE_REVEAL' || phase === 'GAME_OVER') {
    return null;
  }
  const me = room.players.find((p) => p.id === room.myPlayerId);
  if (!me || !me.isPlaying || !room.game.myRole) {
    return null;
  }

  const role = room.game.myRole;
  const meta = ROLE_META[role];
  const fellowMafiaNames = room.players
    .filter((p) => room.game.fellowMafiaIds.includes(p.id) && p.id !== room.myPlayerId)
    .map((p) => p.name);

  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={() => setPeeking(true)}
        onPointerUp={() => setPeeking(false)}
        onPointerLeave={() => setPeeking(false)}
        onPointerCancel={() => setPeeking(false)}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setPeeking(true);
          }
        }}
        onKeyUp={() => setPeeking(false)}
        aria-label="Hold to peek at your secret role"
        className="inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-lg border border-gold-500/40 bg-noir-900/90 hover:bg-noir-800 text-xs font-semibold text-gold-200 select-none touch-none"
      >
        <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gold-300" />
        <span className="hidden sm:inline">Hold: My Role</span>
      </button>

      {peeking && (
        <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-11 z-[980] sm:w-64 noir-card border-2 border-gold-400/70 rounded-xl p-3.5 shadow-2xl space-y-2">
          <div className="flex items-center gap-2.5">
            <RoleSvgIcon role={role} className={`w-8 h-8 ${meta.colorClass}`} />
            <div>
              <div className={`font-display font-bold text-sm uppercase ${meta.colorClass}`}>
                {meta.label}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-cream-400">
                {meta.alignmentLabel}
              </div>
            </div>
          </div>
          {fellowMafiaNames.length > 0 && (
            <div className="text-xs text-crimson-200 border-t border-gold-500/20 pt-1.5">
              Allies: {fellowMafiaNames.join(', ')}
            </div>
          )}
          {room.game.detectiveHistory.length > 0 && (
            <div className="text-[11px] text-sky-200 border-t border-gold-500/20 pt-1.5 space-y-0.5">
              {room.game.detectiveHistory.map((h) => (
                <div key={`${h.nightNumber}-${h.targetId}`}>
                  N{h.nightNumber}: {h.targetName} → {h.isMafia ? 'MAFIA' : 'NOT MAFIA'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
