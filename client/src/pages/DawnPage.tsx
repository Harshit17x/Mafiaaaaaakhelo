import React from 'react';
import { motion } from 'framer-motion';
import { Newspaper } from 'lucide-react';
import { CountdownBadge } from '../components/CountdownBadge';
import { ROLE_META, RoleSvgIcon } from '../components/RoleIcons';
import { useGameStore } from '../stores/useGameStore';

export function DawnPage() {
  const room = useGameStore((s) => s.room);
  if (!room || !room.game.dawn) return null;

  const { dawn, phaseEndsAt, paused } = room.game;
  const killed = Boolean(dawn.killedPlayerId);

  return (
    <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      <motion.article
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55 }}
        className="noir-card art-deco-border rounded-2xl p-5 sm:p-10 text-center space-y-5 sm:space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-500/30 pb-3 text-[10px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.28em] text-gold-400">
          <span className="inline-flex items-center gap-1.5">
            <Newspaper className="w-4 h-4 shrink-0" />
            The Midnight Gazette
          </span>
          <span>Edition #{dawn.nightNumber}</span>
        </div>

        <div className="flex justify-center">
          <svg
            viewBox="0 0 64 64"
            className="w-12 h-12 sm:w-14 sm:h-14 text-amber-300/90"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M22 46C22 36 28 28 36 24C37 19 34 15 30 15C27 15 25 18 25 22C19 23 14 29 14 37C14 43 18 48 24 49H44C47 44 48 37 44 31C41 34 37 36 33 36"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M36 16L41 13L39 19" stroke="currentColor" strokeWidth="2.2" />
            <path d="M27 49V55M35 49V55" stroke="currentColor" strokeWidth="2.4" />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-wider text-cream-50 break-words">
            {killed
              ? `THE CITY WAKES: ${dawn.killedPlayerName} was found dead`
              : 'THE CITY WAKES: Nobody died tonight'}
          </h1>
          <p className="font-serif italic text-base sm:text-lg text-cream-300">
            {killed
              ? 'Sirens faded before sunrise. Midnight City demands answers.'
              : 'Morning bells toll over empty alleys. Everyone survived the night.'}
          </p>
        </div>

        {killed && dawn.killedPlayerRole && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-noir-950/80 border border-gold-500/35"
          >
            <RoleSvgIcon
              role={dawn.killedPlayerRole}
              className={`w-9 h-9 ${ROLE_META[dawn.killedPlayerRole].colorClass}`}
            />
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-wider text-cream-400">
                Revealed Role
              </div>
              <div
                className={`font-display text-lg font-bold uppercase ${
                  ROLE_META[dawn.killedPlayerRole].colorClass
                }`}
              >
                {ROLE_META[dawn.killedPlayerRole].label}
              </div>
            </div>
          </motion.div>
        )}

        <div className="pt-2 flex justify-center">
          <CountdownBadge endsAt={phaseEndsAt} paused={paused} label="Discussion in" />
        </div>
      </motion.article>
    </div>
  );
}

