import React from 'react';
import type { GamePhase } from '@midnight-city/shared';

const RAIN_DROPS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 19) % 14) * 0.1}s`,
  duration: `${0.9 + ((i * 7) % 5) * 0.15}s`,
}));

export function Atmosphere({ phase }: { phase: GamePhase | 'HOME' }) {
  const isNight = phase === 'NIGHT';
  const isDawn = phase === 'DAWN';
  const isDay =
    phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTE' || phase === 'VOTE_RESULT';

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          isNight
            ? 'bg-gradient-to-b from-[#03050b] via-[#070b17] to-[#0d1324]'
            : isDawn
              ? 'bg-gradient-to-b from-[#17182b] via-[#4a2626] to-[#9b5b2a]/60'
              : isDay
                ? 'bg-gradient-to-b from-[#10182b] via-[#1b273e] to-[#2e3547]'
                : 'bg-gradient-to-b from-[#050811] via-[#0a1020] to-[#11192e]'
        }`}
      />

      {isNight && (
        <div className="absolute right-[10%] top-[8%] w-24 h-24 rounded-full bg-gradient-to-br from-cream-100/90 to-gold-200/40 blur-[0.5px] shadow-[0_0_80px_rgba(236,228,212,0.28)] opacity-85" />
      )}

      {(isDawn || isDay) && (
        <>
          <div
            className={`absolute left-1/2 -translate-x-1/2 transition-all duration-1000 rounded-full blur-2xl ${
              isDawn
                ? 'bottom-[14%] w-72 h-72 bg-amber-500/35'
                : 'top-[4%] w-72 h-72 bg-gold-300/20'
            }`}
          />
          {isDay && (
            <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-amber-500/15 via-gold-400/5 to-transparent" />
          )}
        </>
      )}

      <div className="absolute -bottom-12 left-[-10%] right-[-10%] h-48 bg-gradient-to-t from-cream-300/10 via-cream-300/5 to-transparent blur-2xl animate-fog" />

      {isNight && (
        <div className="absolute inset-0 opacity-35">
          {RAIN_DROPS.map((drop) => (
            <span
              key={drop.id}
              style={{
                left: drop.left,
                animationDelay: drop.delay,
                animationDuration: drop.duration,
              }}
              className="absolute top-0 w-[1px] h-16 bg-gradient-to-b from-transparent via-sky-200/45 to-transparent animate-rain"
            />
          ))}
        </div>
      )}

      <svg
        viewBox="0 0 1440 260"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-44 sm:h-56 text-[#04060c] opacity-90"
      >
        <path
          fill="currentColor"
          d="M0,260 L0,160 L55,160 L55,115 L105,115 L105,175 L145,175 L145,80 L165,62 L185,80 L185,150 L235,150 L235,105 L295,105 L295,180 L345,180 L345,52 L370,34 L395,52 L395,140 L450,140 L450,120 L510,120 L510,175 L560,175 L560,90 L615,90 L615,155 L670,155 L670,40 L692,20 L714,40 L714,148 L770,148 L770,110 L835,110 L835,182 L890,182 L890,70 L945,70 L945,145 L1005,145 L1005,98 L1065,98 L1065,170 L1110,170 L1110,48 L1132,26 L1154,48 L1154,152 L1220,152 L1220,112 L1280,112 L1280,175 L1335,175 L1335,92 L1395,92 L1395,160 L1440,160 L1440,260 Z"
        />
        <g>
          {[
            { x: 155, y: 95, w: 8, h: 10, delay: '0.2s', op: 0.55 },
            { x: 169, y: 112, w: 8, h: 10, delay: '1.8s', op: 0.45 },
            { x: 358, y: 75, w: 9, h: 12, delay: '0.7s', op: 0.65 },
            { x: 373, y: 96, w: 9, h: 12, delay: '2.9s', op: 0.45 },
            { x: 684, y: 65, w: 10, h: 12, delay: '1.1s', op: 0.6 },
            { x: 684, y: 88, w: 10, h: 12, delay: '3.6s', op: 0.4 },
            { x: 905, y: 92, w: 9, h: 11, delay: '2.2s', op: 0.55 },
            { x: 1125, y: 70, w: 9, h: 12, delay: '0.5s', op: 0.65 },
            { x: 1352, y: 112, w: 8, h: 11, delay: '3.1s', op: 0.5 },
          ].map((win, idx) => (
            <rect
              key={idx}
              x={win.x}
              y={win.y}
              width={win.w}
              height={win.h}
              fill="#e8c67a"
              opacity={isNight ? undefined : win.op}
              style={isNight ? { animationDelay: win.delay } : undefined}
              className={isNight ? 'animate-window-blink' : undefined}
            />
          ))}
        </g>
      </svg>

      <div className="film-grain absolute inset-0" />
      <div className="noir-vignette absolute inset-0" />
    </div>
  );
}

