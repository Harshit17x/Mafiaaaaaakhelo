import React, { useRef, useState } from 'react';
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
  const [glare, setGlare] = useState({ x: 50, y: 30, active: false });
  const cardWrapRef = useRef<HTMLDivElement | null>(null);
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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    setGlare({ x, y, active: true });
  };

  const roleOuterFoil =
    role === 'MAFIA'
      ? 'foil-card-frame-crimson'
      : role === 'HEALER'
        ? 'foil-card-frame-emerald'
        : 'foil-card-frame';

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        ref={cardWrapRef}
        role={holdToReveal ? 'button' : undefined}
        tabIndex={holdToReveal ? 0 : undefined}
        aria-label={
          holdToReveal
            ? 'Hold to reveal your secret role card'
            : `Role card: ${meta.label}`
        }
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          endHold();
          setGlare((g) => ({ ...g, active: false }));
        }}
        onPointerCancel={endHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`w-76 sm:w-80 h-[25.5rem] perspective-1000 ${
          holdToReveal ? 'cursor-pointer touch-none' : ''
        }`}
      >
        <motion.div
          animate={{ rotateY: holding ? 180 : 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full h-full preserve-3d"
        >
          {/* CARD BACK — Embossed Foil Casino Back */}
          <div className="absolute inset-0 backface-hidden rounded-2xl p-[3px] foil-card-frame">
            <div className="relative w-full h-full rounded-[13px] bg-gradient-to-b from-[#171d2f] via-[#0c111e] to-[#070911] cardstock-texture p-5 flex flex-col items-center justify-between text-center overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2.5 rounded-xl border border-gold-400/35"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-4 rounded-lg border border-dashed border-gold-400/20"
              />

              {/* Art Deco Geometric Guilloche SVG */}
              <svg
                viewBox="0 0 240 340"
                className="pointer-events-none absolute inset-0 w-full h-full opacity-20"
                aria-hidden="true"
              >
                <polygon
                  points="120,26 214,170 120,314 26,170"
                  fill="none"
                  stroke="#e8c67a"
                  strokeWidth="1.2"
                />
                <polygon
                  points="120,48 194,170 120,292 46,170"
                  fill="none"
                  stroke="#d4a84f"
                  strokeWidth="0.9"
                />
                <circle cx="120" cy="170" r="56" fill="none" stroke="#f5dfb0" strokeWidth="1" />
                <path d="M18 36 L18 18 L36 18" stroke="#f5dfb0" strokeWidth="2" fill="none" />
                <path d="M222 36 L222 18 L204 18" stroke="#f5dfb0" strokeWidth="2" fill="none" />
                <path d="M18 304 L18 322 L36 322" stroke="#f5dfb0" strokeWidth="2" fill="none" />
                <path d="M222 304 L222 322 L204 322" stroke="#f5dfb0" strokeWidth="2" fill="none" />
              </svg>

              {/* Specular Glare */}
              <div
                aria-hidden="true"
                style={{
                  opacity: glare.active ? 0.3 : 0.1,
                  background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,244,209,0.55), transparent 65%)`,
                }}
                className="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity"
              />

              <div className="relative z-10 text-[10px] uppercase tracking-[0.38em] text-gold-300 font-display font-semibold pt-1">
                Midnight City
              </div>

              <div className="relative z-10 flex flex-col items-center gap-3.5">
                <div className="relative w-24 h-24 rounded-full p-[2px] foil-card-frame shadow-[0_0_36px_rgba(212,168,79,0.28)]">
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1a2238] to-[#090d18] flex items-center justify-center">
                    <Eye className="w-10 h-10 text-gold-300 drop-shadow-[0_0_10px_rgba(245,223,176,0.45)]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-xl tracking-[0.14em] text-gold-200 uppercase">
                    Sealed Dossier
                  </h3>
                  <p className="text-xs text-cream-300/80 max-w-[13.5rem] leading-relaxed">
                    Check over your shoulder before breaking the seal.
                  </p>
                </div>
              </div>

              <div className="relative z-10 w-full py-2.5 px-4 rounded-lg brass-nameplate border border-gold-400/50 text-[11px] uppercase tracking-[0.22em] text-gold-200 font-display font-bold">
                Hold Card to Peek
              </div>
            </div>
          </div>

          {/* CARD FRONT — Role Identity Face */}
          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl p-[3px] ${roleOuterFoil}`}
          >
            <div className="relative w-full h-full rounded-[13px] bg-gradient-to-b from-[#1a1826] via-[#0e111d] to-[#070910] cardstock-texture p-5 flex flex-col items-center justify-between text-center overflow-hidden">
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-2.5 rounded-xl border ${meta.borderClass}`}
              />

              <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-cream-300 px-1 pt-0.5">
                <span className="px-2 py-0.5 rounded bg-noir-950/85 border border-gold-500/30 text-gold-200">
                  {meta.alignmentLabel}
                </span>
                <span className="text-gold-400/80">DOSSIER #47</span>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-3 px-1">
                <div
                  className={`p-4 rounded-2xl bg-gradient-to-b from-noir-900 to-noir-950 border-2 ${meta.borderClass} shadow-[inset_0_2px_10px_rgba(0,0,0,0.85),0_10px_24px_rgba(0,0,0,0.65)]`}
                >
                  <RoleSvgIcon role={role} className={`w-16 h-16 ${meta.colorClass}`} />
                </div>

                <div className="w-full brass-nameplate rounded-lg border border-gold-400/45 py-1.5 px-3">
                  <h2
                    className={`font-display text-2xl sm:text-3xl font-extrabold tracking-[0.14em] uppercase ${meta.colorClass}`}
                  >
                    {meta.label}
                  </h2>
                </div>

                <p className="text-xs sm:text-sm text-cream-200/90 leading-relaxed max-w-[14.5rem]">
                  {meta.tagline}
                </p>

                {role === 'MAFIA' && fellowMafiaNames.length > 0 && (
                  <div className="mt-0.5 w-full rounded-lg bg-crimson-950/80 border border-crimson-400/50 px-3 py-2 text-xs text-crimson-100 shadow-inner">
                    <div className="flex items-center justify-center gap-1 font-display font-bold uppercase tracking-wider text-[10px] text-crimson-300 mb-0.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Fellow Syndicate
                    </div>
                    <div className="font-medium truncate">{fellowMafiaNames.join(', ')}</div>
                  </div>
                )}
              </div>

              <div className="relative z-10 text-[10px] font-mono uppercase tracking-[0.24em] text-cream-400/75 pb-0.5">
                {holdToReveal ? 'Release to Conceal' : 'Identity Confirmed'}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
