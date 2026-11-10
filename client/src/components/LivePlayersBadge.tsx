import React from 'react';
import { Users } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

interface LivePlayersBadgeProps {
  variant?: 'title' | 'header';
}

export function LivePlayersBadge({ variant = 'title' }: LivePlayersBadgeProps) {
  const liveStats = useGameStore((s) => s.liveStats);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const isSynced = connectionStatus === 'connected' && liveStats !== null;
  const playingCount = liveStats?.playersInRooms ?? 0;
  const inMatchCount = liveStats?.playersInGame ?? 0;
  const activeRooms = liveStats?.activeRooms ?? 0;
  const onlineCount = liveStats?.onlineCount ?? 0;

  const tooltip = isSynced
    ? `${playingCount} playing across ${activeRooms} ${
        activeRooms === 1 ? 'table' : 'tables'
      } (${inMatchCount} in active matches) • ${onlineCount} online`
    : 'Connecting to live player counter...';

  const containerClasses =
    variant === 'title'
      ? 'inline-flex items-center gap-2 sm:gap-2.5 rounded-full bg-black/45 backdrop-blur-md border border-cream-100/15 px-3 sm:px-3.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
      : 'inline-flex items-center gap-2 rounded-full bg-noir-900/85 border border-gold-500/30 px-2.5 sm:px-3 py-1';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={tooltip}
      title={tooltip}
      className={containerClasses}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {isSynced ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse" />
        )}
      </span>

      <Users
        className={`w-3.5 h-3.5 shrink-0 ${
          isSynced ? 'text-amber-300/90' : 'text-cream-400/70'
        }`}
        aria-hidden="true"
      />

      {isSynced ? (
        <div className="flex items-center gap-1.5 font-condensed uppercase tracking-[0.12em] text-[11px] sm:text-xs leading-none">
          <span className="hidden sm:inline text-emerald-300/90 font-semibold">Live</span>
          <span
            key={playingCount}
            className="font-mono font-bold text-cream-50 tabular-nums animate-live-tick"
          >
            {playingCount}
          </span>
          <span className="text-cream-100/85">Playing</span>

          {inMatchCount > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 text-amber-300/90">
              <span aria-hidden="true">•</span>
              <span key={`m-${inMatchCount}`} className="font-mono font-bold tabular-nums">
                {inMatchCount}
              </span>
              <span>In Match</span>
            </span>
          )}

          <span className="hidden sm:inline-flex items-center gap-1 text-cream-300/70">
            <span aria-hidden="true">•</span>
            <span key={`o-${onlineCount}`} className="font-mono tabular-nums">
              {onlineCount}
            </span>
            <span>Online</span>
          </span>
        </div>
      ) : (
        <span className="font-condensed uppercase tracking-[0.14em] text-[11px] text-cream-300/75 leading-none">
          -- Playing
        </span>
      )}
    </div>
  );
}

