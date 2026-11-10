import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { Role } from '@midnight-city/shared';
import { Eye, ShieldAlert } from 'lucide-react';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';

interface RoleCardProps {
  role: Role;
  fellowMafiaNames?: string[];
  holdToReveal?: boolean;
  onFirstReveal?: () => void;
}

export function RoleCard({
  role,
  fellowMafiaNames = [],
  holdToReveal = false,
  onFirstReveal,
}: RoleCardProps) {
  const [holding, setHolding] = useState(!holdToReveal);
  const meta = ROLE_META[role];

  const startHold = () => {
    if (!holdToReveal) return;
    setHolding(true);
    onFirstReveal?.();
  };

  const endHold = () => {
    if (!holdToReveal) return;
    setHolding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      startHold();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      endHold();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        role={holdToReveal ? 'button' : undefined}
        tabIndex={holdToReveal ? 0 : undefined}
        aria-label={
          holdToReveal
            ? 'Hold to reveal your secret role card'
            : `Role card: ${meta.label}`
        }
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`w-72 h-[24rem] perspective-1000 ${
          holdToReveal ? 'cursor-pointer touch-none' : ''
        }`}
      >
        <motion.div
          animate={{ rotateY: holding ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full h-full preserve-3d"
        >
          <div className="absolute inset-0 backface-hidden rounded-2xl noir-card art-deco-border p-6 flex flex-col items-center justify-between text-center">
            <div className="text-[11px] uppercase tracking-[0.35em] text-gold-400/80 font-display">
              Midnight City
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full border border-gold-500/40 bg-noir-900/90 flex items-center justify-center shadow-[0_0_30px_rgba(212,168,79,0.16)]">
                <Eye className="w-9 h-9 text-gold-400" />
              </div>
              <h3 className="font-display text-xl tracking-wider text-gold-200 uppercase">
                Classified Dossier
              </h3>
              <p className="text-sm text-cream-400 max-w-[13rem]">
                Check over your shoulder before peeking.
              </p>
            </div>
            <div className="w-full py-2.5 px-4 rounded-lg border border-gold-500/40 bg-gold-500/10 text-xs uppercase tracking-[0.2em] text-gold-300 font-semibold">
              Hold Card to Reveal
            </div>
          </div>

          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl noir-card border-2 ${meta.borderClass} p-6 flex flex-col items-center justify-between text-center`}
          >
            <div className="w-full flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-cream-400">
              <span>{meta.alignmentLabel}</span>
              <span>File #47</span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full bg-noir-950/70 border ${meta.borderClass}`}>
                <RoleSvgIcon role={role} className={`w-16 h-16 ${meta.colorClass}`} />
              </div>
              <h2 className={`font-display text-3xl font-bold tracking-wider uppercase ${meta.colorClass}`}>
                {meta.label}
              </h2>
              <p className="text-sm text-cream-300 leading-relaxed">{meta.tagline}</p>

              {role === 'MAFIA' && fellowMafiaNames.length > 0 && (
                <div className="mt-1 w-full rounded-lg bg-crimson-900/40 border border-crimson-500/40 px-3 py-2 text-xs text-crimson-200">
                  <div className="flex items-center justify-center gap-1 font-semibold uppercase tracking-wider mb-0.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Fellow Syndicate
                  </div>
                  <div>{fellowMafiaNames.join(', ')}</div>
                </div>
              )}
            </div>

            <div className="text-[11px] uppercase tracking-[0.25em] text-cream-400/70">
              Release to Conceal
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

