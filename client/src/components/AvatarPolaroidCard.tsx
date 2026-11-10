import React from 'react';
import { AVATAR_PRESETS } from '@midnight-city/shared';
import type {
  AvatarFilter,
  AvatarFrameTint,
  AvatarPinColor,
  PlayerAvatarConfig,
} from '@midnight-city/shared';
import { ImagePlus } from 'lucide-react';

const PIN_PALETTE: Record<
  AvatarPinColor,
  { dome: string; highlight: string; rim: string; shaft: string; stem: string }
> = {
  green: {
    dome: '#1b8f54',
    highlight: '#35ba75',
    rim: '#0e5b34',
    shaft: '#136e40',
    stem: '#0b4426',
  },
  white: {
    dome: '#f7f4ed',
    highlight: '#ffffff',
    rim: '#b9b2a5',
    shaft: '#dfd9cd',
    stem: '#91897c',
  },
  red: {
    dome: '#df3f2f',
    highlight: '#ff6959',
    rim: '#8e1f15',
    shaft: '#b92d20',
    stem: '#6c140c',
  },
  teal: {
    dome: '#288d8b',
    highlight: '#45b8b6',
    rim: '#125352',
    shaft: '#1b6d6b',
    stem: '#0c3a39',
  },
  gold: {
    dome: '#f6b934',
    highlight: '#ffd86b',
    rim: '#a6710a',
    shaft: '#d49418',
    stem: '#744b04',
  },
};

const FRAME_STYLES: Record<
  AvatarFrameTint,
  { bg: string; border: string; innerBorder: string; ink: string }
> = {
  cream: {
    bg: 'bg-[#ebe6dc]',
    border: 'border-[#d2cabd]',
    innerBorder: 'border-[#bdb4a6]',
    ink: 'text-[#2b241d]',
  },
  aged: {
    bg: 'bg-[#dac49d]',
    border: 'border-[#b99d70]',
    innerBorder: 'border-[#9e8053]',
    ink: 'text-[#312214]',
  },
  charcoal: {
    bg: 'bg-[#1a1d28]',
    border: 'border-[#3b4154]',
    innerBorder: 'border-[#4a5168]',
    ink: 'text-gold-200',
  },
  gold: {
    bg: 'bg-gradient-to-b from-[#eedaa8] to-[#dec07c]',
    border: 'border-[#b98e39]',
    innerBorder: 'border-[#946b1d]',
    ink: 'text-[#291b06]',
  },
};

const FILTER_CSS: Record<AvatarFilter, string> = {
  color: 'none',
  noir: 'grayscale(100%) contrast(1.2) brightness(1.03)',
  sepia: 'sepia(0.84) contrast(1.08) brightness(0.98)',
  vivid: 'contrast(1.22) saturate(1.32)',
};

export function resolveAvatarImageSrc(avatar: PlayerAvatarConfig): string | null {
  if (avatar.presetId === 'custom' && avatar.customDataUrl) {
    return avatar.customDataUrl;
  }
  const match = AVATAR_PRESETS.find((p) => p.id === avatar.presetId);
  return (match ?? AVATAR_PRESETS[0])?.imageUrl ?? null;
}

export function resolveAvatarLabel(avatar: PlayerAvatarConfig): string {
  if (avatar.presetId === 'custom') {
    return avatar.caption || 'Custom Photo';
  }
  const match = AVATAR_PRESETS.find((p) => p.id === avatar.presetId);
  return match?.name ?? 'Mafioso';
}

export function AvatarPushpinSvg({
  color,
  className = 'w-6 h-6',
}: {
  color: AvatarPinColor;
  className?: string;
}) {
  const c = PIN_PALETTE[color] ?? PIN_PALETTE.green;
  return (
    <svg
      viewBox="0 0 36 36"
      className={`${className} drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)] pointer-events-none`}
      aria-hidden="true"
    >
      {/* Cast shadow on Polaroid paper */}
      <ellipse cx="14" cy="27" rx="7.5" ry="3.2" fill="rgba(16,8,4,0.34)" transform="rotate(-14 14 27)" />
      {/* Base bulb */}
      <ellipse cx="17.5" cy="22.5" rx="7.5" ry="5.5" fill={c.rim} />
      <ellipse cx="17.5" cy="21" rx="6.6" ry="4.5" fill={c.shaft} />
      {/* Neck */}
      <path d="M13 12 L22 12 L20.5 21 L14.5 21 Z" fill={c.rim} />
      <path d="M14 12 L21 12 L19.8 20 L15.2 20 Z" fill={c.shaft} />
      {/* Flat angled head */}
      <ellipse cx="19" cy="11.2" rx="9.2" ry="7.4" fill={c.rim} />
      <ellipse cx="19.2" cy="9.8" rx="8.8" ry="6.8" fill={c.dome} />
      <ellipse cx="16.8" cy="7.5" rx="4.2" ry="2.2" fill={c.highlight} opacity="0.55" transform="rotate(-18 16.8 7.5)" />
    </svg>
  );
}

export function EquippedScallopBadge({ className = 'w-9 h-9' }: { className?: string }) {
  // 12-petal rosette seal matching the green checkmark sticker in the reference
  const outerPoints: string[] = [];
  const spikes = 24;
  for (let i = 0; i < spikes; i += 1) {
    const angle = (i * Math.PI * 2) / spikes;
    const r = i % 2 === 0 ? 19.5 : 16.8;
    const x = 22 + Math.cos(angle) * r;
    const y = 22 + Math.sin(angle) * r;
    outerPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg
      viewBox="0 0 44 44"
      className={`${className} drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] pointer-events-none`}
      aria-label="Equipped avatar"
    >
      <polygon
        points={outerPoints.join(' ')}
        fill="#0d6c47"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="22" r="14" fill="#118356" />
      <path
        d="M14.5 22.2 L19.5 27.3 L30.2 16.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface AvatarPolaroidCardProps {
  avatar: PlayerAvatarConfig;
  selected?: boolean;
  size?: 'xs' | 'sm' | 'board' | 'preview';
  tiltOverride?: number;
  showPin?: boolean;
  showEquippedBadge?: boolean;
  onClick?: () => void;
  title?: string;
  emptyCustomSlot?: boolean;
  className?: string;
}

export function AvatarPolaroidCard({
  avatar,
  selected = false,
  size = 'board',
  tiltOverride,
  showPin = true,
  showEquippedBadge = false,
  onClick,
  title,
  emptyCustomSlot = false,
  className = '',
}: AvatarPolaroidCardProps) {
  const frame = FRAME_STYLES[avatar.frameTint] ?? FRAME_STYLES.cream;
  const imgSrc = resolveAvatarImageSrc(avatar);
  const rotation = typeof tiltOverride === 'number' ? tiltOverride : avatar.tilt;

  const sizeConfig = {
    xs: {
      outer: 'p-1 pb-2 rounded-[4px] w-11',
      pin: 'w-4 h-4 -top-2',
      badge: 'w-4 h-4 -bottom-1 -left-1',
      caption: 'text-[7px] mt-0.5 leading-none',
    },
    sm: {
      outer: 'p-1.5 pb-2.5 rounded-[5px] w-16',
      pin: 'w-5 h-5 -top-2.5',
      badge: 'w-5 h-5 -bottom-1.5 -left-1.5',
      caption: 'text-[8px] mt-0.5 leading-tight',
    },
    board: {
      outer: 'p-2 sm:p-2.5 pb-4 sm:pb-5 rounded-[3px] w-full max-w-[152px]',
      pin: 'w-7 h-7 sm:w-8 sm:h-8 -top-3.5',
      badge: 'w-9 h-9 -bottom-2.5 -left-2.5',
      caption: 'text-[10px] sm:text-[11px] mt-1.5 leading-tight min-h-[14px]',
    },
    preview: {
      outer: 'p-3 sm:p-3.5 pb-6 sm:pb-7 rounded-[4px] w-44 sm:w-48',
      pin: 'w-9 h-9 -top-4',
      badge: 'w-10 h-10 -bottom-3 -left-3',
      caption: 'text-xs mt-2 leading-tight min-h-[16px]',
    },
  }[size];

  const cardInner = (
    <div
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`relative border ${frame.bg} ${frame.border} ${sizeConfig.outer} shadow-[0_8px_18px_rgba(12,6,3,0.45)] transition-transform duration-200 ${
        onClick ? 'group-hover:scale-[1.04] group-hover:rotate-0' : ''
      } ${selected && size === 'board' ? 'ring-2 ring-gold-300 shadow-[0_12px_26px_rgba(0,0,0,0.65)]' : ''} ${className}`}
    >
      {showPin && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-20 ${sizeConfig.pin}`}>
          <AvatarPushpinSvg color={avatar.pinColor} className="w-full h-full" />
        </div>
      )}

      <div
        className={`relative aspect-square w-full overflow-hidden border ${frame.innerBorder} bg-[#1c1614]`}
      >
        {emptyCustomSlot || !imgSrc ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[#2a1d17] text-gold-200/85 p-2 text-center">
            <ImagePlus className="w-7 h-7 text-gold-300" />
            <span className="font-condensed uppercase tracking-wider text-[11px] font-bold">
              Upload Photo
            </span>
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={title ?? resolveAvatarLabel(avatar)}
            draggable={false}
            style={{
              filter: FILTER_CSS[avatar.filter] ?? 'none',
              transform: `translate(${avatar.offsetX}%, ${avatar.offsetY}%) scale(${avatar.zoom})`,
            }}
            className="w-full h-full object-cover select-none transition-all duration-150"
          />
        )}
      </div>

      {(size === 'board' || size === 'preview') && (
        <div
          className={`text-center font-mono tracking-tight truncate ${sizeConfig.caption} ${frame.ink} ${
            avatar.caption ? 'opacity-90 font-semibold' : 'opacity-45'
          }`}
        >
          {avatar.caption || (emptyCustomSlot ? 'Custom PNG/JPG' : '')}
        </div>
      )}

      {showEquippedBadge && selected && (
        <div className={`absolute z-20 ${sizeConfig.badge}`}>
          <EquippedScallopBadge className="w-full h-full" />
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={selected}
        className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 rounded-md p-1 cursor-pointer"
      >
        {cardInner}
      </button>
    );
  }

  return cardInner;
}

