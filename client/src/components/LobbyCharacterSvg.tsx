import React from 'react';
import type { AvatarFilter, ClientPlayerView } from '@midnight-city/shared';
import { Check, Crown, Mic, WifiOff } from 'lucide-react';
import { resolveAvatarImageSrc } from './AvatarPolaroidCard';

const SUIT_PALETTE = [
  { coat: '#9f1d28', trim: '#c92a37', band: '#f5dfb0', tie: '#ffd166' },
  { coat: '#145a43', trim: '#1d8360', band: '#a7f3d0', tie: '#f5dfb0' },
  { coat: '#1e3a5f', trim: '#2e5890', band: '#93c5fd', tie: '#f5dfb0' },
  { coat: '#6b3e1b', trim: '#995a29', band: '#f7e3b5', tie: '#e63946' },
  { coat: '#4c2669', trim: '#703a99', band: '#d8b4fe', tie: '#f5dfb0' },
  { coat: '#1b5563', trim: '#287a8f', band: '#99f6e4', tie: '#fbbf24' },
  { coat: '#7f2447', trim: '#ad3563', band: '#fbcfe8', tie: '#fde68a' },
  { coat: '#334155', trim: '#475569', band: '#cbd5e1', tie: '#ef4444' },
  { coat: '#78350f', trim: '#a16207', band: '#fde68a', tie: '#fef3c7' },
  { coat: '#1e4e4a', trim: '#2d706a', band: '#99f6e4', tie: '#fda4af' },
  { coat: '#3f3f46', trim: '#52525b', band: '#f4f4f5', tie: '#e8c67a' },
  { coat: '#4a1d24', trim: '#742c37', band: '#fecdd3', tie: '#fbbf24' },
] as const;

const FILTER_CSS: Record<AvatarFilter, string> = {
  color: 'none',
  noir: 'grayscale(100%) contrast(1.2) brightness(1.03)',
  sepia: 'sepia(0.84) contrast(1.08) brightness(0.98)',
  vivid: 'contrast(1.22) saturate(1.32)',
};

export interface LobbyCharacterSvgProps {
  player: ClientPlayerView;
  colorIndex: number;
  facing: 'left' | 'right';
  moving: boolean;
  isMe: boolean;
  isSpeaking: boolean;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function LobbyCharacterSvg({
  player,
  colorIndex,
  facing,
  moving,
  isMe,
  isSpeaking,
  selected = false,
  onClick,
}: LobbyCharacterSvgProps) {
  const palette = SUIT_PALETTE[colorIndex % SUIT_PALETTE.length]!;
  const avatarSrc = resolveAvatarImageSrc(player.avatar);
  const clipId = `lobby-char-avatar-${player.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isOffline = !player.connected;
  const ringStroke = isSpeaking
    ? '#34d399'
    : player.isReady
      ? '#10b981'
      : isMe
        ? '#f5dfb0'
        : '#b98e39';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${player.name}${player.isReady ? ', ready' : ', waiting'}${isMe ? ' (you)' : ''}`}
      className={`group relative flex flex-col items-center select-none focus:outline-none cursor-pointer transition-opacity ${
        isOffline ? 'opacity-50' : 'opacity-100'
      }`}
    >
      {/* Floating Name + Status Tag */}
      <div
        className={`mb-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold leading-tight shadow-[0_4px_12px_rgba(0,0,0,0.8)] border whitespace-nowrap max-w-[8.5rem] transition ${
          selected
            ? 'bg-gold-500/25 border-gold-300 text-gold-100'
            : player.isReady
              ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-100'
              : isMe
                ? 'bg-noir-950/95 border-gold-400/75 text-gold-200'
                : 'bg-noir-950/90 border-gold-500/35 text-cream-100'
        }`}
      >
        {player.isHost && (
          <Crown className="w-2.5 h-2.5 text-gold-300 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{player.name}</span>
        {!player.isPlaying ? (
          <span className="text-[8px] font-mono uppercase px-1 rounded bg-purple-900/80 text-purple-200 shrink-0">
            GM
          </span>
        ) : player.isReady ? (
          <Check className="w-3 h-3 text-emerald-300 shrink-0" aria-hidden="true" />
        ) : null}
        {isSpeaking && (
          <Mic className="w-2.5 h-2.5 text-emerald-300 animate-pulse shrink-0" aria-hidden="true" />
        )}
        {isOffline && (
          <WifiOff className="w-2.5 h-2.5 text-amber-400 shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* Small Among-Us-Inspired SVG Noir Character with Avatar Portrait */}
      <svg
        viewBox="0 0 64 84"
        className="w-12 h-16 sm:w-14 sm:h-[4.5rem] overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.72)] transition-transform duration-150 group-hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="32" cy="27" r="14.5" />
          </clipPath>
        </defs>

        {/* Ground Spotlight & Speaking / Ready / Self Aura */}
        <ellipse cx="32" cy="76" rx="18" ry="5.5" fill="rgba(0, 0, 0, 0.55)" />
        {(isMe || isSpeaking || player.isReady) && (
          <ellipse
            cx="32"
            cy="76"
            rx="21"
            ry="6.8"
            fill="none"
            stroke={isSpeaking ? '#34d399' : player.isReady ? '#10b981' : '#e8c67a'}
            strokeWidth={isSpeaking ? '2' : '1.4'}
            strokeDasharray={isMe && !player.isReady && !isSpeaking ? '4 3' : undefined}
            opacity={isSpeaking ? '0.95' : '0.75'}
          />
        )}

        {/* Animated Chibi Character Group */}
        <g className={moving ? 'animate-lobby-bob' : 'animate-lobby-idle'}>
          {/* Feet (facing flipped horizontally when walking left) */}
          <g transform={facing === 'left' ? 'translate(64 0) scale(-1 1)' : undefined}>
            <g className={moving ? 'animate-lobby-foot-a' : undefined}>
              <rect x="20" y="64" width="10" height="10" rx="4.5" fill="#13151d" stroke="#08090d" strokeWidth="1.2" />
              <ellipse cx="26.5" cy="72" rx="5.5" ry="2.6" fill="#1f2430" />
            </g>
            <g className={moving ? 'animate-lobby-foot-b' : undefined}>
              <rect x="34" y="64" width="10" height="10" rx="4.5" fill="#13151d" stroke="#08090d" strokeWidth="1.2" />
              <ellipse cx="40.5" cy="72" rx="5.5" ry="2.6" fill="#1f2430" />
            </g>

            {/* Among-Us Style Trench Coat Cape / Backpack */}
            <rect
              x="12"
              y="40"
              width="9"
              height="21"
              rx="4.5"
              fill={palette.coat}
              stroke="#0c0e14"
              strokeWidth="1.8"
            />

            {/* Chibi Trench Coat Body */}
            <path
              d="M 18 42 C 18 35, 46 35, 46 42 L 47 64 C 47 67.5, 43 69, 39 69 L 25 69 C 21 69, 17 67.5, 17 64 Z"
              fill={palette.trim}
              stroke="#0c0e14"
              strokeWidth="2"
            />
            {/* Coat Shadow Half */}
            <path
              d="M 18 42 C 18 36, 30 36, 31 40 L 29 69 L 25 69 C 21 69, 17 67.5, 17 64 Z"
              fill={palette.coat}
              opacity="0.72"
            />
            {/* Collar & Tie */}
            <polygon points="27,39 37,39 32,48" fill="#f5efe2" stroke="#161820" strokeWidth="1" />
            <polygon points="31,41 33,41 34,54 32,57 30,54" fill={palette.tie} />
            {/* Coat Lapels */}
            <path d="M 24 39 L 30 49 L 26 50 L 21 41 Z" fill={palette.coat} stroke="#0c0e14" strokeWidth="0.9" />
            <path d="M 40 39 L 34 49 L 38 50 L 43 41 Z" fill={palette.coat} stroke="#0c0e14" strokeWidth="0.9" />
            {/* Tiny Arm */}
            <ellipse
              cx="45"
              cy="52"
              rx="4.2"
              ry="6.8"
              transform="rotate(-12 45 52)"
              fill={palette.trim}
              stroke="#0c0e14"
              strokeWidth="1.6"
            />
          </g>

          {/* Circular Avatar Portrait Medallion Head (never mirrored so face/text stay upright) */}
          <circle cx="32" cy="27" r="16.2" fill="#0d111a" stroke={ringStroke} strokeWidth="2.4" />
          {avatarSrc && (
            <image
              href={avatarSrc}
              x="17"
              y="12"
              width="30"
              height="30"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId})`}
              style={{ filter: FILTER_CSS[player.avatar.filter] ?? 'none' }}
            />
          )}
          <circle
            cx="32"
            cy="27"
            r="14.6"
            fill="none"
            stroke="rgba(255, 245, 220, 0.3)"
            strokeWidth="1"
          />

          {/* Dapper Tilted Noir Fedora Hat */}
          <g transform={facing === 'left' ? 'translate(64 0) scale(-1 1)' : undefined}>
            <g transform="rotate(-7 32 13)">
              {/* Hat Crown */}
              <path
                d="M 20 14 L 22.8 4.2 C 23.4 2.5, 27 2.2, 32 3.2 C 37 2.2, 40.6 2.5, 41.2 4.2 L 44 14 Z"
                fill="#171923"
                stroke="#07080d"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* Hat Band */}
              <path d="M 20.6 12.2 L 43.4 12.2 L 43.8 14.2 L 20.2 14.2 Z" fill={palette.band} opacity="0.92" />
              {/* Hat Brim */}
              <ellipse cx="32.5" cy="14.5" rx="18" ry="3.5" fill="#1e212e" stroke="#07080d" strokeWidth="1.5" />
            </g>
          </g>
        </g>
      </svg>
    </button>
  );
}

