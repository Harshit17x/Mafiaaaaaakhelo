import React from 'react';
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
  X,
} from 'lucide-react';
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
}: PlayerTradingCardProps) {
  if (!player) {
    return (
      <div
        className={`${
          compact ? 'w-28 h-36' : 'w-32 h-40'
        } rounded-2xl border border-dashed border-gold-500/25 bg-noir-950/55 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center select-none pointer-events-none`}
      >
        <div className="text-[10px] font-mono text-gold-400/60">
          #{seatNumber.toString().padStart(2, '0')}
        </div>
        <div className="font-display text-[11px] uppercase tracking-widest text-cream-400/50 mt-1">
          Open Cushion
        </div>
      </div>
    );
  }

  const isDead = mode !== 'LOBBY' && !player.isAlive;
  const revealedRole = player.role;
  const roleMeta = revealedRole ? ROLE_META[revealedRole] : null;

  const themeGradient = isDead
    ? 'from-[#1a1c24] via-[#101219] to-[#08090e] border-noir-700'
    : isSelectedVote
      ? 'from-[#7f1d28] via-[#450c14] to-[#1a060a] border-crimson-400 shadow-[0_0_26px_rgba(224,79,91,0.55)]'
      : isSpeaking
        ? 'from-[#114232] via-[#0c2621] to-[#081316] border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.5)]'
        : revealedRole === 'MAFIA'
          ? 'from-[#5e1520] via-[#2c0b12] to-[#12070c] border-crimson-500/70'
          : 'from-[#3a2d15] via-[#1b1a29] to-[#0b101d] border-gold-400/70 shadow-[0_12px_30px_rgba(0,0,0,0.65)]';

  return (
    <div
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`relative select-none transition-transform duration-200 ${
        compact ? 'w-32' : 'w-36 sm:w-40'
      } ${isSelectedVote ? '-translate-y-1.5 scale-[1.03]' : 'hover:-translate-y-1'}`}
    >
      <div
        style={{
          clipPath:
            'polygon(8% 0%, 92% 0%, 100% 7%, 100% 88%, 50% 100%, 0% 88%, 0% 7%)',
        }}
        className={`relative bg-gradient-to-b ${themeGradient} border-2 rounded-t-xl p-2 pb-3.5 overflow-hidden`}
      >
        <svg
          viewBox="0 0 160 120"
          className="absolute inset-x-0 top-0 w-full h-24 opacity-20 pointer-events-none"
          aria-hidden="true"
        >
          <polygon points="0,0 85,0 45,65" fill="#f5dfb0" />
          <polygon points="160,0 90,0 125,75" fill="#d4a84f" />
          <polygon points="45,65 125,75 80,115" fill="#8a6723" />
        </svg>

        {isDead && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-noir-950/35"
          >
            <X className="w-16 h-16 text-crimson-500/75 stroke-[3]" />
          </div>
        )}

        <div className="relative z-10 flex items-start justify-between gap-1">
          <div className="flex flex-col items-start leading-none">
            <span className="font-mono font-bold text-xs text-gold-200">
              {seatNumber.toString().padStart(2, '0')}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-cream-300/80 mt-0.5">
              {player.isHost ? 'HOST' : !player.isPlaying ? 'GM' : mode === 'LOBBY' ? (player.isReady ? 'RDY' : 'WAIT') : isDead ? 'OUT' : 'LIVE'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {player.isHost && (
              <Crown className="w-3.5 h-3.5 text-gold-300" aria-label="Host" />
            )}
            {!player.connected && (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-label="Offline" />
            )}
            {mode === 'LOBBY' && player.isPlaying && player.isReady && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Ready" />
            )}
            {mode === 'DAY_VOTE' && player.hasVoted && !isDead && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-label="Voted" />
            )}
            <span
              className={`p-1 rounded-md border ${
                isSpeaking
                  ? 'border-emerald-300 bg-emerald-500/25 text-emerald-200'
                  : player.voiceJoined && player.micEnabled
                    ? 'border-emerald-500/40 bg-noir-950/60 text-emerald-300'
                    : 'border-noir-700 bg-noir-950/60 text-cream-600'
              }`}
            >
              {player.voiceJoined && player.micEnabled ? (
                <Mic className="w-3 h-3" />
              ) : (
                <MicOff className="w-3 h-3" />
              )}
            </span>
          </div>
        </div>

        <div className="relative z-10 my-1.5 flex items-center justify-center h-[68px]">
          <div className={`relative flex items-center justify-center ${isDead ? 'opacity-65 grayscale' : ''}`}>
            <AvatarPolaroidCard
              avatar={player.avatar}
              size="sm"
              showPin={false}
              tiltOverride={isDead ? -4 : -1.5}
              className="!w-[54px] !p-1 !pb-1.5 shadow-[0_6px_14px_rgba(0,0,0,0.65)]"
            />
            {revealedRole && (
              <div
                title={roleMeta?.label}
                className="absolute -bottom-1.5 -right-2.5 z-20 flex items-center gap-0.5 rounded-full bg-noir-950/95 border border-gold-400/60 px-1.5 py-0.5 shadow-lg"
              >
                <RoleSvgIcon
                  role={revealedRole}
                  className={`w-4 h-4 ${roleMeta?.colorClass ?? 'text-gold-200'}`}
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
              <div className="absolute -bottom-1 -right-2 z-20 rounded-full bg-noir-950/95 border border-crimson-500/60 p-1 shadow-lg">
                <Skull className="w-4 h-4 text-crimson-400" />
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 border-y border-gold-400/40 bg-noir-950/75 px-1.5 py-1 text-center">
          <div className="font-display font-bold text-xs text-cream-50 truncate flex items-center justify-center gap-1">
            <span className="truncate">{player.name}</span>
            {isMe && (
              <span className="text-[8px] px-1 rounded bg-gold-500/25 text-gold-200 shrink-0">
                YOU
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-1.5 grid grid-cols-3 text-center text-[9px] font-mono text-cream-300">
          {mode === 'LOBBY' ? (
            <>
              <div>
                <div className="text-cream-400/70">STS</div>
                <div className="font-bold text-gold-200">
                  {player.connected ? 'ON' : 'OFF'}
                </div>
              </div>
              <div>
                <div className="text-cream-400/70">MIC</div>
                <div className="font-bold text-emerald-300">
                  {player.voiceJoined ? (player.micEnabled ? 'ON' : 'MUTE') : '--'}
                </div>
              </div>
              <div>
                <div className="text-cream-400/70">RDY</div>
                <div className="font-bold text-cream-100">
                  {!player.isPlaying ? 'GM' : player.isReady ? 'YES' : 'NO'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-cream-400/70">STS</div>
                <div className={`font-bold ${isDead ? 'text-crimson-400' : 'text-emerald-300'}`}>
                  {isDead ? 'DEAD' : 'LIVE'}
                </div>
              </div>
              <div>
                <div className="text-cream-400/70">ACC</div>
                <div className="font-bold text-crimson-300">{accuseCount}</div>
              </div>
              <div>
                <div className="text-cream-400/70">BAL</div>
                <div className="font-bold text-gold-200">
                  {mode === 'DAY_VOTE' ? (player.hasVoted ? 'IN' : 'WAIT') : '--'}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-10 mt-1.5 flex items-center justify-center gap-1">
          {mode === 'LOBBY' && viewerIsHost && !isMe && (
            <>
              <button
                type="button"
                onClick={onTransferHost}
                title="Transfer Host"
                aria-label={`Transfer host to ${player.name}`}
                className="px-2 py-1 rounded bg-noir-900/90 hover:bg-noir-800 border border-gold-500/40 text-gold-300 text-[10px] inline-flex items-center gap-0.5"
              >
                <Crown className="w-3 h-3" />
                Host
              </button>
              <button
                type="button"
                onClick={onKickPlayer}
                title="Kick Player"
                aria-label={`Kick ${player.name}`}
                className="px-2 py-1 rounded bg-noir-900/90 hover:bg-crimson-900 border border-crimson-500/40 text-crimson-300 text-[10px] inline-flex items-center gap-0.5"
              >
                <UserMinus className="w-3 h-3" />
                Kick
              </button>
            </>
          )}

          {mode === 'DAY_DISCUSSION' && canAccuse && !isDead && !isMe && (
            <button
              type="button"
              onClick={onToggleAccuse}
              className={`w-full py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border inline-flex items-center justify-center gap-1 transition ${
                iAccused
                  ? 'bg-crimson-600 border-crimson-300 text-white'
                  : 'bg-noir-950/85 border-gold-500/40 text-gold-200 hover:border-crimson-400'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              {iAccused ? 'Accused' : 'Accuse'}
            </button>
          )}

          {mode === 'DAY_VOTE' && canVote && !isDead && !isMe && (
            <button
              type="button"
              onClick={onSelectVote}
              className={`w-full py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border inline-flex items-center justify-center gap-1 transition ${
                isSelectedVote
                  ? 'bg-crimson-600 border-crimson-200 text-white'
                  : 'bg-noir-950/85 border-gold-500/45 text-gold-200 hover:bg-noir-800'
              }`}
            >
              {isSelectedVote ? <Check className="w-3 h-3" /> : <Vote className="w-3 h-3" />}
              {isSelectedVote ? 'Selected' : 'Select'}
            </button>
          )}
        </div>

        {accuseCount > 0 && !isDead && mode === 'DAY_DISCUSSION' && (
          <div className="relative z-10 mt-1 flex justify-center">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-crimson-900/90 border border-crimson-400/60 text-[9px] text-crimson-100">
              <AlertCircle className="w-2.5 h-2.5" />
              {accuseCount} Accusation{accuseCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
