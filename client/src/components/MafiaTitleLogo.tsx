import React, { useId } from 'react';

interface MafiaTitleLogoProps {
  compact?: boolean;
  className?: string;
}

export function MafiaTitleLogo({ compact = false, className = '' }: MafiaTitleLogoProps) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, '');
  const gradId = `mafia-cream-${safeId}`;
  const distressId = `mafia-distress-${safeId}`;
  const maskId = `mafia-mask-${safeId}`;

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`}>
      <h1 className="sr-only">MAFIA — Midnight City</h1>

      <div className="flex flex-col items-center">
        <div
          className={`inline-flex items-center justify-center bg-[#c81822] px-2.5 sm:px-3 py-[2px] sm:py-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.65)] border border-[#e3323c]/35 ${
            compact ? 'mb-1.5' : 'mb-2 sm:mb-2.5'
          }`}
        >
          <span className="font-condensed font-bold uppercase tracking-[0.09em] text-white text-[11px] sm:text-[13px] leading-none">
            MIDNIGHT CITY
          </span>
        </div>

        <svg
          viewBox="0 0 472 134"
          role="img"
          aria-label="MAFIA"
          className={`block overflow-visible drop-shadow-[0_10px_28px_rgba(0,0,0,0.82)] ${
            compact
              ? 'w-[220px] sm:w-[270px] h-auto'
              : 'w-[265px] sm:w-[345px] md:w-[395px] h-auto'
          }`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#efe8d5" />
              <stop offset="55%" stopColor="#e5dcc3" />
              <stop offset="100%" stopColor="#cfc4a8" />
            </linearGradient>

            <filter id={distressId} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.14 0.22"
                numOctaves="3"
                seed="19"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 -2.5 2.65"
                result="gritMask"
              />
              <feComposite in="SourceGraphic" in2="gritMask" operator="in" />
            </filter>

            <mask id={maskId}>
              <rect x="0" y="0" width="472" height="134" fill="white" />
              {/* Subtle filmic notches and scratches echoing vintage stencil/grunge */}
              <polygon points="10,54 17,57 11,61" fill="black" />
              <polygon points="122,88 128,85 127,92" fill="black" />
              <polygon points="164,19 169,24 163,26" fill="black" />
              <polygon points="214,72 220,76 215,79" fill="black" />
              <polygon points="236,41 242,43 237,46" fill="black" />
              <polygon points="295,8 299,14 292,11" fill="black" />
              <polygon points="343,96 349,99 343,103" fill="black" />
              <polygon points="444,104 452,107 446,112" fill="black" />
              <circle cx="24" cy="96" r="1.4" fill="black" />
              <circle cx="111" cy="31" r="1.3" fill="black" />
              <circle cx="152" cy="112" r="1.5" fill="black" />
              <circle cx="252" cy="84" r="1.4" fill="black" />
              <circle cx="358" cy="48" r="1.5" fill="black" />
              <circle cx="422" cy="24" r="1.3" fill="black" />
              <circle cx="394" cy="115" r="1.4" fill="black" />
            </mask>
          </defs>

          <g fill={`url(#${gradId})`} mask={`url(#${maskId})`} filter={`url(#${distressId})`}>
            {/* M */}
            <path d="M4,6 L37,6 L65,64 L93,6 L126,6 L121,18 L121,115 L125,127 L95,127 L98,115 L98,46 L70,101 L60,101 L32,46 L32,115 L35,127 L5,127 L9,115 L9,18 Z" />

            {/* A (first) */}
            <path
              fillRule="evenodd"
              d="M163,8 L197,8 L226,127 L196,127 L190,99 L170,99 L164,127 L134,127 Z M180,32 L173,77 L187,77 Z"
            />

            {/* F */}
            <path d="M234,8 L315,8 L311,32 L264,32 L264,57 L304,57 L301,79 L264,79 L264,115 L267,127 L235,127 L238,115 L238,20 Z" />

            {/* I */}
            <path d="M327,8 L368,8 L363,21 L363,114 L368,127 L327,127 L332,114 L332,21 Z" />

            {/* A (second) */}
            <path
              fillRule="evenodd"
              d="M405,8 L439,8 L468,127 L438,127 L432,99 L412,99 L406,127 L376,127 Z M422,32 L415,77 L429,77 Z"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
