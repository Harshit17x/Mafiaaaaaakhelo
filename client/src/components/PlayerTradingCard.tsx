import React, { useRef, useState } from 'react';
import type { ClientPlayerView } from '@midnight-city/shared';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Crosshair,
  Crown,
  Mic,
  MicOff,
  Skull,
  UserMinus,
  Vote,
  WifiOff,
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';
import { AvatarPolaroidCard } from './AvatarPolaroidCard';

export interface PlayerTradingCardProps {
  player: ClientPlayerView | null;
  seatNumber: number;
  mode: 'LOBBY' | 'DAY_DISCUSSION' | 'DAY_VOTE' | 'VOTE_RESULT';
  isMe: boolean;
  viewerIsHost: boolean;
  isSpeaking: boolean;
  accuseCount: number;
  iAccused: boolean;
  isSelectedVote: boolean;
  canAccuse: boolean;
  canVote: boolean;
  onToggleAccuse?: () => void;
  onSelectVote?: () => void;
  onTransferHost?: () => void;
  onKickPlayer?: () => void;
  onHoverChange?: (hovered: boolean) => void;
  compact?: boolean;
  fluid?: boolean;
}

export function PlayerTradingCard({
  player,
  seatNumber,
  mode,
  isMe,
  viewerIsHost,
  isSpeaking,
  accuseCount,
  iAccused,
  isSelectedVote,
  canAccuse,
  canVote,
  onToggleAccuse,
  onSelectVote,
  onTransferHost,
  onKickPlayer,
  onHoverChange,
  compact = false,
  fluid = false,
}: PlayerTradingCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [glare, setGlare] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 25,
    active: false,
  });
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({ rx: 0, ry: 0 });

  if (!player) {
    return (
      <div
        className={`${
          fluid
            ? 'w-full max-w-[11rem] h-[10.5rem]'
            : compact
              ? 'w-[7.4rem] h-[9.4rem]'
              : 'w-36 h-44'
        } rounded-xl p-[1.5px] bg-gradient-to-b from-gold-400/35 via-gold-600/15 to-noir-900/60 shadow-[0_14px_32px_rgba(0,0,0,0.72)] select-none pointer-events-none`}
      >
        <div className="relative w-full h-full rounded-[10.5px] bg-gradient-to-b from-[#131926]/90 via-[#0c101a]/92 to-[#070a11]/95 backdrop-blur-md border border-dashed border-gold-500/25 flex flex-col items-center justify-between p-2.5 text-center overflow-hidden">
          <div className="w-full flex items-center justify-between text-[9px] font-mono text-gold-400/60">
            <span>SEAT</span>
            <span>#{seatNumber.toString().padStart(2, '0')}</span>
          </div>

          <div className="w-9 h-9 rounded-full border border-gold-500/25 bg-noir-900/80 flex items-center justify-center shadow-inner">
            <div className="w-4 h-4 rotate-45 border border-gold-400/35 bg-gold-500/10" />
          </div>

          <div className="w-full border-t border-gold-500/15 pt-1.5">
            <div className="font-display text-[10px] uppercase tracking-[0.2em] text-cream-300/55">
              Vacant Chair
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDead = mode !== 'LOBBY' && !player.isAlive;
  const revealedRole = player.role;
  const roleMeta = revealedRole ? ROLE_META[revealedRole] : null;

  const outerFoilClass = isDead
    ? 'foil-card-frame-dead'
    : isSelectedVote
      ? 'foil-card-frame-crimson'
      : isSpeaking
        ? 'foil-card-frame-emerald'
        : 'foil-card-frame';

  const innerSurfaceGradient = isDead
    ? 'from-[#1b1e26] via-[#11131a] to-[#090b10]'
    : isSelectedVote
      ? 'from-[#4d0f18] via-[#26070d] to-[#110407]'
      : isSpeaking
        ? 'from-[#0e382b] via-[#09201b] to-[#061012]'
        : revealedRole === 'MAFIA'
          ? 'from-[#3f0e16] via-[#1f080e] to-[#0d0509]'
          : isMe
            ? 'from-[#2d2212] via-[#171724] to-[#0a0d17]'
            : 'from-[#231c14] via-[#141622] to-[#090d16]';

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    const ry = ((px - 50) / 50) * 7;
    const rx = -((py - 50) / 50) * 7;
    setGlare({ x: px, y: py, active: true });
    setTilt({ rx, ry });
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    onHoverChange?.(true);
    setGlare((prev) => ({ ...prev, active: true }));
  };

  const handlePointerLeave = () => {
    onHoverChange?.(false);
    setGlare((prev) => ({ ...prev, active: false }));
    setTilt({ rx: 0, ry: 0 });
  };

  const statusTag = player.isHost
    ? 'DON'
    : !player.isPlaying
      ? 'GM'
      : mode === 'LOBBY'
        ? player.isReady
          ? 'READY'
          : 'WAIT'
        : isDead
          ? 'KIA'
          : 'LIVE';

  const canCardClickVote = mode === 'DAY_VOTE' && canVote && !isDead && !isMe;

  return (
    <div
      ref={cardRef}
      data-sfx-hover="card"
      data-sfx={canCardClickVote ? 'none' : undefined}
      onClick={
        canCardClickVote
          ? () => {
              soundEngine.playCardSelect();
              onSelectVote?.();
            }
          : undefined
      }
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transform: `perspective(750px) rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(
          2
        )}deg) ${isSelectedVote ? 'translateY(-6px) scale(1.04)' : glare.active ? 'translateY(-4px) scale(1.02)' : ''}`,
      }}
      className={`group relative select-none transition-[transform,filter] duration-150 ease-out will-change-transform ${
        canCardClickVote ? 'cursor-pointer' : ''
      } ${
        fluid
          ? 'w-full max-w-[11rem] mx-auto'
          : compact
            ? 'w-[8.2rem] sm:w-[9.1rem]'
            : 'w-40 sm:w-44'
      }`}
    >
      {/* Ambient ground contact & selection aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-1.5 rounded-2xl blur-md transition-opacity duration-300 ${
          isSelectedVote
            ? 'bg-crimson-500/45 opacity-100'
            : isSpeaking
              ? 'bg-emerald-400/40 opacity-100'
              : isMe && !isDead
                ? 'bg-gold-400/25 opacity-80'
                : 'bg-gold-500/20 opacity-0 group-hover:opacity-75'
        }`}
      />

      {/* Metallic Foil Outer Bezel */}
      <div className={`relative rounded-[14px] p-[2px] ${outerFoilClass}`}>
        {/* Inner Embossed Cardstock Body */}
        <div
          className={`relative rounded-[12px] bg-gradient-to-b ${innerSurfaceGradient} cardstock-texture p-2 pb-2.5 overflow-hidden`}
        >
          {/* Subtle Inner Filigree Hairline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[3.5px] rounded-[9px] border border-gold-300/20"
          />

          {/* Art Deco Corner Ornaments */}
          <svg
            viewBox="0 0 180 240"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full h-full opacity-35"
            aria-hidden="true"
          >
            <path d="M8 22 L8 8 L24 8" stroke="#f5dfb0" strokeWidth="1.4" fill="none" />
            <path d="M172 22 L172 8 L156 8" stroke="#f5dfb0" strokeWidth="1.4" fill="none" />
            <path d="M8 218 L8 232 L24 232" stroke="#d4a84f" strokeWidth="1.4" fill="none" />
            <path d="M172 218 L172 232 L156 232" stroke="#d4a84f" strokeWidth="1.4" fill="none" />
            <polygon points="90,3 95,8 90,13 85,8" fill="#e8c67a" opacity="0.55" />
          </svg>

          {/* Dynamic Specular Foil Sheen */}
          <div
            aria-hidden="true"
            style={{
              opacity: glare.active ? 0.34 : 0.08,
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,246,214,0.62) 0%, rgba(212,168,79,0.14) 34%, transparent 68%)`,
            }}
            className="pointer-events-none absolute inset-0 z-20 mix-blend-screen transition-opacity duration-200"
          />

          {/* Eliminated Stamp Overlay */}
          {isDead && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-noir-950/45"
            >
              <div className="-rotate-12 border-2 border-crimson-500/85 bg-crimson-950/85 px-2.5 py-0.5 rounded shadow-[0_4px_14px_rgba(0,0,0,0.85)]">
                <span className="font-condensed font-black text-[11px] tracking-[0.24em] text-crimson-300 uppercase">
                  ELIMINATED
                </span>
              </div>
            </div>
          )}

          {/* Top Index Strip (Playing-Card Corner Pip + Live Indicators) */}
          <div className="relative z-10 flex items-center justify-between gap-1 px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1 rounded bg-noir-950/90 border border-gold-400/45 font-mono font-bold text-[10px] text-gold-200 shadow-inner">
                {seatNumber.toString().padStart(2, '0')}
              </span>
              <span
                className={`text-[8.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  isDead
                    ? 'bg-crimson-950/80 border-crimson-500/40 text-crimson-300'
                    : player.isHost
                      ? 'bg-gold-500/20 border-gold-400/50 text-gold-200'
                      : 'bg-noir-950/70 border-gold-500/25 text-cream-300'
                }`}
              >
                {statusTag}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {player.isHost && (
                <Crown
                  className="w-3.5 h-3.5 text-gold-300 drop-shadow-[0_0_6px_rgba(245,223,176,0.55)]"
                  aria-label="Host"
                />
              )}
              {!player.connected && (
                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-label="Offline" />
              )}
              {mode === 'LOBBY' && player.isPlaying && player.isReady && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Ready" />
              )}
              {mode === 'DAY_VOTE' && player.hasVoted && !isDead && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Voted" />
              )}
              <span
                className={`p-1 rounded-md border shadow-inner transition-colors ${
                  isSpeaking
                    ? 'border-emerald-300 bg-emerald-500/30 text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.6)]'
                    : player.voiceJoined && player.micEnabled
                      ? 'border-emerald-500/40 bg-noir-950/75 text-emerald-300'
                      : 'border-noir-700/80 bg-noir-950/75 text-cream-600'
                }`}
              >
                {player.voiceJoined && player.micEnabled ? (
                  <Mic className="w-2.5 h-2.5" />
                ) : (
                  <MicOff className="w-2.5 h-2.5" />
                )}
              </span>
            </div>
          </div>

          {/* Recessed Velvet Portrait Well */}
          <div className="relative z-10 mt-1.5 mx-0.5 rounded-lg bg-gradient-to-b from-[#090c14] to-[#131827] border border-gold-400/30 shadow-[inset_0_3px_10px_rgba(0,0,0,0.88)] py-1.5 flex items-center justify-center h-[76px] overflow-visible">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg opacity-35"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, rgba(212,168,79,0.26) 0%, transparent 72%)',
              }}
            />

            <div
              className={`relative flex items-center justify-center ${
                isDead ? 'opacity-60 grayscale contrast-125' : ''
              }`}
            >
              <AvatarPolaroidCard
                avatar={player.avatar}
                size="sm"
                showPin={false}
                tiltOverride={isDead ? -4 : -1.5}
                className="!w-[58px] !p-1 !pb-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.78)]"
              />

              {revealedRole && (
                <div
                  title={roleMeta?.label}
                  className="absolute -bottom-1.5 -right-3 z-20 flex items-center gap-0.5 rounded-full bg-gradient-to-b from-noir-800 to-noir-950 border border-gold-300/70 px-1.5 py-0.5 shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
                >
                  <RoleSvgIcon
                    role={revealedRole}
                    className={`w-3.5 h-3.5 ${roleMeta?.colorClass ?? 'text-gold-200'}`}
                  />
                  <span
                    className={`text-[8px] font-display font-bold uppercase tracking-wider ${
                      roleMeta?.colorClass ?? 'text-gold-200'
                    }`}
                  >
                    {roleMeta?.label}
                  </span>
                </div>
              )}

              {!revealedRole && isDead && (
                <div className="absolute -bottom-1.5 -right-2.5 z-20 rounded-full bg-noir-950 border border-crimson-400/70 p-1 shadow-lg">
                  <Skull className="w-3.5 h-3.5 text-crimson-400" />
                </div>
              )}
            </div>
          </div>

          {/* Engraved Brass Nameplate */}
          <div className="relative z-10 mt-1.5 brass-nameplate rounded-md border border-gold-400/45 px-2 py-1 flex items-center justify-between gap-1">
            <span className="w-1 h-1 rounded-full bg-gold-300/75 shrink-0" aria-hidden="true" />
            <div className="font-display font-bold text-[11px] tracking-wide text-cream-50 truncate flex items-center justify-center gap-1 min-w-0">
              <span className="truncate">{player.name}</span>
              {isMe && (
                <span className="text-[7.5px] font-mono font-bold px-1 py-px rounded bg-gold-500/30 border border-gold-300/50 text-gold-200 shrink-0">
                  YOU
                </span>
              )}
            </div>
            <span className="w-1 h-1 rounded-full bg-gold-300/75 shrink-0" aria-hidden="true" />
          </div>

          {/* Embossed Stat Ledger */}
          <div className="relative z-10 mt-1.5 grid grid-cols-3 divide-x divide-gold-500/15 rounded-md bg-noir-950/70 border border-gold-500/20 py-1 text-center text-[8.5px] font-mono">
            {mode === 'LOBBY' ? (
              <>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">LINK</div>
                  <div className="font-bold text-gold-200">{player.connected ? 'ON' : 'OFF'}</div>
                </div>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">VOICE</div>
                  <div className="font-bold text-emerald-300">
                    {player.voiceJoined ? (player.micEnabled ? 'LIVE' : 'MUTE') : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">DEAL</div>
                  <div className="font-bold text-cream-100">
                    {!player.isPlaying ? 'GM' : player.isReady ? 'RDY' : 'WAIT'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">VITAL</div>
                  <div className={`font-bold ${isDead ? 'text-crimson-400' : 'text-emerald-300'}`}>
                    {isDead ? 'DEAD' : 'ALIVE'}
                  </div>
                </div>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">HEAT</div>
                  <div
                    className={`font-bold ${
                      accuseCount > 0 ? 'text-crimson-300' : 'text-cream-300/70'
                    }`}
                  >
                    {accuseCount}
                  </div>
                </div>
                <div>
                  <div className="text-cream-400/65 text-[7.5px]">VOTE</div>
                  <div className="font-bold text-gold-200">
                    {mode === 'DAY_VOTE' ? (player.hasVoted ? 'CAST' : 'OPEN') : '--'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interactive Action Bar */}
          <div className="relative z-30 mt-1.5 flex items-center justify-center gap-1">
            {mode === 'LOBBY' && viewerIsHost && !isMe && (
              <>
                <button
                  type="button"
                  data-sfx="confirm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransferHost?.();
                  }}
                  title="Transfer Host"
                  aria-label={`Transfer host to ${player.name}`}
                  className="flex-1 py-1.5 sm:py-1 rounded bg-gradient-to-b from-noir-800 to-noir-950 hover:from-noir-700 hover:to-noir-900 border border-gold-400/45 text-gold-200 text-[10px] sm:text-[9.5px] font-semibold inline-flex items-center justify-center gap-0.5 shadow-sm transition cursor-pointer"
                >
                  <Crown className="w-2.5 h-2.5" />
                  Host
                </button>
                <button
                  type="button"
                  data-sfx="confirm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onKickPlayer?.();
                  }}
                  title="Kick Player"
                  aria-label={`Kick ${player.name}`}
                  className="flex-1 py-1.5 sm:py-1 rounded bg-gradient-to-b from-crimson-900/80 to-noir-950 hover:from-crimson-800 hover:to-crimson-950 border border-crimson-400/45 text-crimson-200 text-[10px] sm:text-[9.5px] font-semibold inline-flex items-center justify-center gap-0.5 shadow-sm transition cursor-pointer"
                >
                  <UserMinus className="w-2.5 h-2.5" />
                  Kick
                </button>
              </>
            )}

            {mode === 'DAY_DISCUSSION' && canAccuse && !isDead && !isMe && (
              <button
                type="button"
                data-sfx="none"
                data-sfx-hover="card"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playCardSelect();
                  onToggleAccuse?.();
                }}
                className={`w-full py-1.5 sm:py-1 rounded-md text-[10px] sm:text-[9.5px] font-display font-bold uppercase tracking-wider border inline-flex items-center justify-center gap-1 shadow-md transition cursor-pointer ${
                  iAccused
                    ? 'bg-gradient-to-b from-crimson-500 to-crimson-700 border-crimson-200 text-white shadow-[0_0_12px_rgba(224,79,91,0.5)]'
                    : 'bg-gradient-to-b from-noir-800 to-noir-950 border-gold-400/45 text-gold-200 hover:border-crimson-400 hover:text-crimson-200'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                {iAccused ? 'Suspect Marked' : 'Accuse'}
              </button>
            )}

            {mode === 'DAY_VOTE' && canVote && !isDead && !isMe && (
              <button
                type="button"
                data-sfx="none"
                data-sfx-hover="card"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEngine.playCardSelect();
                  onSelectVote?.();
                }}
                className={`w-full py-1.5 sm:py-1 rounded-md text-[10px] sm:text-[9.5px] font-display font-bold uppercase tracking-wider border inline-flex items-center justify-center gap-1 shadow-md transition cursor-pointer ${
                  isSelectedVote
                    ? 'bg-gradient-to-b from-crimson-500 to-crimson-700 border-crimson-100 text-white shadow-[0_0_14px_rgba(224,79,91,0.6)]'
                    : 'bg-gradient-to-b from-noir-800 to-noir-950 border-gold-400/50 text-gold-200 hover:border-gold-300 hover:text-cream-50'
                }`}
              >
                {isSelectedVote ? <Check className="w-3 h-3" /> : <Vote className="w-3 h-3" />}
                {isSelectedVote ? 'Target Locked' : 'Vote Out'}
              </button>
            )}
          </div>

          {/* Accusation Wax Chip Pill */}
          {accuseCount > 0 && !isDead && mode === 'DAY_DISCUSSION' && (
            <div className="relative z-20 mt-1 flex justify-center">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-crimson-900 via-crimson-800 to-crimson-900 border border-crimson-300/65 text-[8.5px] font-semibold tracking-wide text-crimson-100 shadow-[0_2px_8px_rgba(201,42,55,0.5)]">
                <AlertCircle className="w-2.5 h-2.5 text-crimson-200" />
                {accuseCount} {accuseCount === 1 ? 'Finger Pointed' : 'Fingers Pointed'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
