import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeRoomCode } from '@midnight-city/shared';
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { AudioControls } from '../components/AudioControls';
import { AvatarPolaroidCard, resolveAvatarLabel } from '../components/AvatarPolaroidCard';
import { HouseRulesEditor } from '../components/HouseRulesEditor';
import { LivePlayersBadge } from '../components/LivePlayersBadge';
import { MafiaTitleLogo } from '../components/MafiaTitleLogo';
import { MobsterPaperScene } from '../components/MobsterPaperScene';
import { TitleAtmosphereCanvas } from '../components/TitleAtmosphereCanvas';
import { useGameStore } from '../stores/useGameStore';

type TitlePanel = 'menu' | 'create' | 'join' | 'credits';

interface MenuItem {
  id: 'create' | 'join' | 'avatars' | 'rules' | 'credits';
  label: string;
  description: string;
}

const DEFAULT_MENU_ITEM: MenuItem = {
  id: 'create',
  label: 'Create Room',
  description: 'Customize your avatar first, then enter your alias and open a 5–16 player table.',
};

const MENU_ITEMS: MenuItem[] = [
  DEFAULT_MENU_ITEM,
  {
    id: 'join',
    label: 'Join Room',
    description: 'Customize your avatar first, then enter your alias and 6-character invite code.',
  },
  {
    id: 'avatars',
    label: 'Avatars',
    description: 'Pin your Polaroid dossier portrait and customize filters, frames, pushpins, or custom photos.',
  },
  {
    id: 'rules',
    label: 'The Dossier',
    description: 'Inspect secret role abilities, night phase order, and city victory rules.',
  },
  {
    id: 'credits',
    label: 'View Credits',
    description: 'Review the Midnight City lounge architecture, voice mesh, and audio credits.',
  },
];

const LOADING_MESSAGES = [
  'CONNECTING TO MIDNIGHT CITY',
  'POURING THE BOURBON',
  'SEALING THE DOSSIERS',
  'DIMMING THE SPEAKEASY',
] as const;

function extractInviteRoomCode(): string {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('room');
  if (queryCode) {
    return normalizeRoomCode(queryCode);
  }
  const match = window.location.pathname.match(/\/join\/([a-zA-Z0-9]{6})/i);
  if (match && match[1]) {
    return normalizeRoomCode(match[1]);
  }
  return '';
}

export function HomePage() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const rulesOpen = useGameStore((s) => s.rulesOpen);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const avatarOpen = useGameStore((s) => s.avatarOpen);
  const avatarCompletedTarget = useGameStore((s) => s.avatarCompletedTarget);
  const setAvatarOpen = useGameStore((s) => s.setAvatarOpen);
  const clearCompletedAvatarFlow = useGameStore((s) => s.clearCompletedAvatarFlow);
  const myAvatar = useGameStore((s) => s.myAvatar);
  const pendingRoomSettings = useGameStore((s) => s.pendingRoomSettings);
  const setPendingRoomSettings = useGameStore((s) => s.setPendingRoomSettings);
  const resetPendingRoomSettings = useGameStore((s) => s.resetPendingRoomSettings);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const mutedAudio = useGameStore((s) => s.mutedAudio);
  const setMutedAudio = useGameStore((s) => s.setMutedAudio);

  const initialInviteCode = useMemo(() => extractInviteRoomCode(), []);

  const [bootPhase, setBootPhase] = useState<'loading' | 'ready'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [introRunId, setIntroRunId] = useState(0);

  const [activePanel, setActivePanel] = useState<TitlePanel>(
    initialInviteCode ? 'join' : 'menu'
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(initialInviteCode);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const aliasInputRef = useRef<HTMLInputElement | null>(null);
  const prevConnectionStatusRef = useRef(connectionStatus);

  useEffect(() => {
    if (
      connectionStatus === 'disconnected' &&
      prevConnectionStatusRef.current !== 'disconnected'
    ) {
      soundEngine.playUiError();
    }
    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    const code = extractInviteRoomCode();
    if (code) {
      setRoomCode(code);
      setActivePanel('join');
    }
  }, []);

  // Smooth AAA title loading progression
  useEffect(() => {
    if (bootPhase !== 'loading') return;

    const startTime = Date.now();
    const minDuration = initialInviteCode ? 950 : 1750;
    let doneTimer: number | null = null;

    const update = () => {
      const elapsed = Math.max(0, Date.now() - startTime);
      const timeRatio = Math.min(1, elapsed / minDuration);
      const easedTime = 1 - Math.pow(1 - timeRatio, 2.3);
      const pct = Math.min(100, Math.round(easedTime * 100));
      setLoadProgress(pct);

      if (timeRatio >= 1) {
        setLoadProgress(100);
        window.clearInterval(intervalId);
        doneTimer = window.setTimeout(() => {
          setBootPhase('ready');
        }, 180);
      }
    };

    const intervalId = window.setInterval(update, 32);
    update();
    return () => {
      window.clearInterval(intervalId);
      if (doneTimer !== null) {
        window.clearTimeout(doneTimer);
      }
    };
  }, [bootPhase, introRunId, initialInviteCode]);

  const skipIntro = useCallback(() => {
    if (bootPhase === 'loading') {
      soundEngine.unlock();
      soundEngine.playUiConfirm();
      setLoadProgress(100);
      setBootPhase('ready');
    }
  }, [bootPhase]);

  const replayIntro = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiShift();
    setLocalError(null);
    setActivePanel('menu');
    setLoadProgress(0);
    setBootPhase('loading');
    setIntroRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    if (avatarCompletedTarget === 'create' || avatarCompletedTarget === 'join') {
      if (avatarCompletedTarget === 'create') {
        soundEngine.playUiModalOpen();
      } else {
        soundEngine.playUiConfirm();
      }
      setLocalError(null);
      setActivePanel(avatarCompletedTarget);
      clearCompletedAvatarFlow();
    }
  }, [avatarCompletedTarget, clearCompletedAvatarFlow]);

  const activateMenuItem = useCallback(
    (itemId: MenuItem['id']) => {
      soundEngine.unlock();
      setLocalError(null);
      if (itemId === 'create') {
        setAvatarOpen(true, 'create');
      } else if (itemId === 'join') {
        setAvatarOpen(true, 'join');
      } else if (itemId === 'avatars') {
        setAvatarOpen(true);
      } else if (itemId === 'rules') {
        setRulesOpen(true);
      } else if (itemId === 'credits') {
        soundEngine.playUiConfirm();
        setActivePanel('credits');
      }
    },
    [setRulesOpen, setAvatarOpen]
  );

  // Auto-focus alias input when opening Create or Join sub-screen on desktop
  useEffect(() => {
    if (bootPhase !== 'ready') return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return undefined;
    if (activePanel === 'create' || activePanel === 'join') {
      const timer = window.setTimeout(() => {
        aliasInputRef.current?.focus();
      }, 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [bootPhase, activePanel]);

  // Keyboard navigation matching AAA console/PC title screens
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (rulesOpen || avatarOpen) return;

      if (bootPhase === 'loading') {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          skipIntro();
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (activePanel !== 'menu') {
          e.preventDefault();
          if (activePanel === 'create') {
            soundEngine.playUiModalClose();
          } else {
            soundEngine.playUiBack();
          }
          setLocalError(null);
          setActivePanel('menu');
        }
        return;
      }

      if (isTyping) return;

      if (activePanel === 'menu') {
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          soundEngine.playUiShift();
          setSelectedIndex((prev) => (prev + 1) % MENU_ITEMS.length);
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          soundEngine.playUiShift();
          setSelectedIndex((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const current = MENU_ITEMS[selectedIndex];
          if (current) activateMenuItem(current.id);
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          soundEngine.playUiToggle();
          setMutedAudio(!mutedAudio);
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          replayIntro();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    bootPhase,
    activePanel,
    selectedIndex,
    rulesOpen,
    avatarOpen,
    mutedAudio,
    setMutedAudio,
    skipIntro,
    replayIntro,
    activateMenuItem,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setParallax({ x: -nx * 10, y: -ny * 6 });
  };

  const disabled = submitting || connectionStatus !== 'connected';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connectionStatus !== 'connected') {
      soundEngine.playUiError();
      setLocalError('Connecting to game server — please wait until online.');
      return;
    }
    if (!playerName.trim()) {
      soundEngine.playUiError();
      setLocalError('Enter your alias before opening a table.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    soundEngine.playUiConfirm();
    await createRoom(playerName, pendingRoomSettings);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connectionStatus !== 'connected') {
      soundEngine.playUiError();
      setLocalError('Connecting to game server — please wait until online.');
      return;
    }
    if (!playerName.trim()) {
      soundEngine.playUiError();
      setLocalError('Enter your alias before entering a table.');
      return;
    }
    if (normalizeRoomCode(roomCode).length !== 6) {
      soundEngine.playUiError();
      setLocalError('Enter a valid 6-character room code.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    soundEngine.playUiConfirm();
    await joinRoom(roomCode, playerName);
    setSubmitting(false);
  };

  const activeMenuItem = MENU_ITEMS[selectedIndex] ?? DEFAULT_MENU_ITEM;
  const avatarLabel = resolveAvatarLabel(myAvatar);
  const avatarSelectorBar = (
    <div className="flex items-center justify-between gap-3 rounded-sm bg-black/50 border border-cream-100/15 px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <AvatarPolaroidCard
          avatar={myAvatar}
          size="xs"
          showPin={false}
          tiltOverride={-2}
          className="!w-8 !p-0.5 !pb-1 shrink-0"
        />
        <div className="min-w-0">
          <div className="text-[10px] font-condensed uppercase tracking-[0.18em] text-amber-300/85">
            Selected Avatar
          </div>
          <div className="text-xs font-semibold text-cream-100 truncate">
            {avatarLabel}
          </div>
        </div>
      </div>
      <button
        type="button"
        data-sfx="none"
        onClick={() => setAvatarOpen(true)}
        className="shrink-0 px-2.5 py-1 rounded-sm border border-gold-400/45 bg-noir-900/80 hover:bg-noir-800 text-[11px] font-condensed uppercase tracking-wider text-gold-200 transition cursor-pointer"
      >
        Customize
      </button>
    </div>
  );
  const loadingMessageIndex = Math.min(
    LOADING_MESSAGES.length - 1,
    Math.floor((loadProgress / 100) * LOADING_MESSAGES.length)
  );
  const currentLoadingMessage =
    LOADING_MESSAGES[loadingMessageIndex] ?? LOADING_MESSAGES[0];

  return (
    <main
      onMouseMove={handleMouseMove}
      onClick={bootPhase === 'loading' ? skipIntro : undefined}
      className="relative z-10 min-h-screen min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-[#060405] text-cream-100 select-none flex flex-col justify-between"
    >
      {/* Full-bleed speakeasy 3D Paper SVG Diorama scene */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="relative w-full h-full transition-opacity duration-700"
          style={{
            opacity: bootPhase === 'loading' ? 0.28 + (loadProgress / 100) * 0.55 : 1,
          }}
        >
          {/* Deep smoky speakeasy ambient backdrop behind the 3D paper shadowbox */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 74% 46%, rgba(126, 68, 26, 0.44) 0%, rgba(36, 20, 12, 0.65) 42%, #050404 82%)',
            }}
          />

          {/* 3D Pop-Out Paper-Cut SVG Diorama on the right half */}
          <div className="absolute right-[-10vw] sm:right-[3vw] lg:right-[5vw] xl:right-[7vw] top-[8vh] sm:top-[6.5vh] h-[76vh] sm:h-[82vh] aspect-[760/1000] flex items-center justify-center opacity-50 md:opacity-100 transition-opacity">
            <MobsterPaperScene
              tiltX={parallax.y * 0.85}
              tiltY={-parallax.x * 0.9}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Warm ambient speakeasy light bloom */}
        <div
          className="absolute inset-0 animate-ember-pulse"
          style={{
            background:
              'radial-gradient(circle at 72% 48%, rgba(224, 138, 48, 0.16) 0%, rgba(152, 74, 24, 0.05) 36%, transparent 65%)',
          }}
        />

        {/* Left-column legibility scrim */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(5,4,4,0.94) 0%, rgba(5,4,4,0.78) 28%, rgba(5,4,4,0.16) 46%, transparent 64%)',
          }}
        />
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,4,6,0.55) 0%, rgba(6,4,6,0.65) 45%, rgba(6,4,6,0.92) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(5,4,5,0.58) 100%)',
          }}
        />

        <TitleAtmosphereCanvas active />
        <div className="film-grain absolute inset-0 opacity-75" />
        <div className="noir-vignette absolute inset-0 opacity-30" />
      </div>

      {/* Top bar: live player counter on the left, audio & status on the right */}
      <div className="relative z-20 flex items-center justify-between gap-2 sm:gap-3 px-4 sm:px-10 pt-4 sm:pt-5">
        <LivePlayersBadge variant="title" />

        <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-black/45 backdrop-blur-md border border-cream-100/15 px-2.5 sm:px-3.5 py-1 sm:py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] shrink-0">
          {connectionStatus === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 font-condensed uppercase tracking-[0.14em] text-[11px] text-cream-100/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="hidden sm:inline">Online</span>
            </span>
          ) : (
            <span
              role="status"
              aria-label={connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
              className="inline-flex items-center gap-1.5 font-condensed uppercase tracking-[0.14em] text-[11px] text-amber-300"
            >
              <WifiOff className="w-3 h-3 animate-pulse" />
              <span className="hidden sm:inline">
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
              </span>
            </span>
          )}
          <span className="h-3.5 w-px bg-cream-100/15" aria-hidden="true" />
          <AudioControls />
        </div>
      </div>

      {/* Left-anchored AAA Title Column */}
      <div className="relative z-20 flex-1 flex items-start px-5 sm:px-12 md:px-16 lg:px-24 pt-[4vh] sm:pt-[9vh] pb-4 sm:pb-6">
        <div className="w-full max-w-[390px] sm:max-w-[430px] flex flex-col items-start">
          {/* MIDNIGHT CITY Crimson Badge + Distressed MAFIA Logo */}
          <div key={`logo-${introRunId}`} className="mb-6 sm:mb-9 animate-title-enter max-w-full">
            <MafiaTitleLogo />
          </div>

          {/* Either Loading Readout OR Interactive Menu / Panels */}
          {bootPhase === 'loading' ? (
            <section
              key="loading-stage"
              aria-label="Loading Midnight City Mafia"
              className="w-full max-w-[340px] space-y-3 pt-2 animate-title-enter"
            >
              <div className="flex items-center justify-between gap-4 font-condensed uppercase tracking-[0.16em] text-xs sm:text-sm text-cream-100/85">
                <span className="inline-flex items-center gap-2.5">
                  <span className="inline-block w-2 h-2 rotate-45 border border-amber-400 bg-amber-400/30 animate-spin" />
                  {currentLoadingMessage}
                </span>
                <span className="font-mono text-xs text-amber-300/90 tabular-nums">
                  {String(loadProgress).padStart(2, '0')}%
                </span>
              </div>

              <div className="relative h-[2px] w-full bg-cream-100/15 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-700 via-amber-400 to-cream-50 transition-[width] duration-100 ease-out"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>

              <p className="font-condensed tracking-[0.06em] text-xs text-cream-300/60 pt-1">
                <span className="sm:hidden">Tap anywhere to enter the speakeasy</span>
                <span className="hidden sm:inline">
                  Click anywhere or press Space to enter the speakeasy
                </span>
              </p>
            </section>
          ) : activePanel === 'menu' ? (
            <section
              key="main-menu"
              aria-label="Main Menu"
              className="w-full max-w-[360px] animate-title-enter"
            >
              <h2 className="font-condensed font-light uppercase tracking-[0.07em] text-2xl sm:text-[28px] leading-none text-cream-50/95 mb-3">
                ENTER THE CITY
              </h2>

              <div className="title-rule w-full mb-2.5" />

              <nav aria-label="Title screen actions" className="py-1 space-y-0.5">
                {MENU_ITEMS.map((item, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-sfx="none"
                      onMouseEnter={() => {
                        if (selectedIndex !== idx) {
                          setSelectedIndex(idx);
                        }
                      }}
                      onFocus={() => setSelectedIndex(idx)}
                      onClick={() => activateMenuItem(item.id)}
                      className="relative w-full text-left py-2 sm:py-2.5 px-2.5 -mx-2.5 rounded-sm transition-colors focus-visible:outline-none group"
                    >
                      <div
                        className={`title-menu-glow absolute inset-0 pointer-events-none transition-opacity duration-150 ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <span
                        className={`relative z-10 inline-flex items-center gap-2 font-sans text-[15px] sm:text-base tracking-wide transition-all duration-150 ${
                          isActive
                            ? 'text-[#fffaf0] font-medium translate-x-1 drop-shadow-[0_1px_10px_rgba(235,168,72,0.35)]'
                            : 'text-cream-100/80 font-normal group-hover:text-cream-50'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="title-rule w-full mt-2.5 mb-3" />

              <div className="min-h-[2.5rem]">
                <p
                  key={activeMenuItem.id}
                  className="text-xs sm:text-[13px] text-cream-100/90 leading-relaxed animate-title-enter"
                >
                  {activeMenuItem.description}
                </p>
              </div>
            </section>
          ) : activePanel === 'join' ? (
              <section
                key="join-panel"
                aria-label="Join Room"
                className="w-full max-w-[360px] animate-title-enter"
              >
                <h2 className="font-condensed font-light uppercase tracking-[0.07em] text-2xl sm:text-[28px] leading-none text-cream-50/95 mb-3">
                  JOIN EXISTING TABLE
                </h2>
                <div className="title-rule w-full mb-4" />

                <form onSubmit={handleJoin} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="player-name-input"
                      className="block font-condensed uppercase tracking-[0.18em] text-xs text-amber-300/90 mb-1.5"
                    >
                      Your Alias
                    </label>
                    <input
                      ref={aliasInputRef}
                      id="player-name-input"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={20}
                      placeholder="e.g. Detective Vance"
                      className="w-full bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-sm px-3.5 py-2.5 text-base sm:text-sm text-cream-50 placeholder:text-cream-400/50 transition"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="room-code-input"
                      className="block font-condensed uppercase tracking-[0.18em] text-xs text-amber-300/90 mb-1.5"
                    >
                      Room Invite Code
                    </label>
                    <input
                      id="room-code-input"
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                      maxLength={6}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="ABCDEF"
                      className="w-full font-mono uppercase tracking-[0.35em] bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-sm px-3.5 py-2.5 text-base sm:text-sm text-amber-200 placeholder:text-cream-400/40 transition"
                    />
                  </div>

                  {avatarSelectorBar}

                  {localError && (
                    <p role="alert" className="text-xs text-crimson-400 font-medium">
                      {localError}
                    </p>
                  )}

                  {connectionStatus !== 'connected' && (
                    <p className="text-xs text-amber-300/90">
                      Connecting to game server — button activates once online.
                    </p>
                  )}

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      data-sfx="none"
                      disabled={disabled}
                      className="w-full py-2.5 px-4 rounded-sm bg-gradient-to-r from-[#b87424] via-[#d28d34] to-[#b87424] hover:brightness-110 text-[#0d0804] font-condensed font-bold uppercase tracking-[0.14em] text-base inline-flex items-center justify-center gap-2 transition shadow-[0_8px_24px_rgba(184,116,36,0.3)] disabled:opacity-60"
                    >
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Entering Table...' : 'Enter Table'}
                    </button>

                    <button
                      type="button"
                      data-sfx="back"
                      onClick={() => {
                        setLocalError(null);
                        setActivePanel('menu');
                      }}
                      className="w-full py-2 px-2 text-left font-condensed uppercase tracking-[0.14em] text-xs text-cream-100/75 hover:text-cream-50 inline-flex items-center gap-1.5 transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      Back to Title Menu
                    </button>
                  </div>
                </form>

                <div className="title-rule w-full mt-4 mb-2.5" />
                <p className="text-xs text-cream-100/65">
                  Ask the table host for the 6-character code or direct invite URL.
                </p>
              </section>
            ) : (
              <section
                key="credits-panel"
                aria-label="View Credits"
                className="w-full max-w-[380px] animate-title-enter"
              >
                <h2 className="font-condensed font-light uppercase tracking-[0.07em] text-2xl sm:text-[28px] leading-none text-cream-50/95 mb-3">
                  MIDNIGHT CITY CREDITS
                </h2>
                <div className="title-rule w-full mb-4" />

                <dl className="space-y-2.5 text-sm mb-4">
                  <div className="flex items-baseline justify-between gap-4 border-b border-cream-100/10 pb-2">
                    <dt className="font-condensed uppercase tracking-[0.14em] text-xs text-amber-300/85">
                      Game Design
                    </dt>
                    <dd className="text-cream-100/90 text-xs sm:text-sm text-right">
                      1940s Social Deduction (5–16 Players)
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-cream-100/10 pb-2">
                    <dt className="font-condensed uppercase tracking-[0.14em] text-xs text-amber-300/85">
                      3D Speakeasy
                    </dt>
                    <dd className="text-cream-100/90 text-xs sm:text-sm text-right">
                      Three.js Midnight Lounge Table
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-cream-100/10 pb-2">
                    <dt className="font-condensed uppercase tracking-[0.14em] text-xs text-amber-300/85">
                      Voice &amp; State
                    </dt>
                    <dd className="text-cream-100/90 text-xs sm:text-sm text-right">
                      WebRTC Mesh Audio &amp; Socket.IO
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 pb-1">
                    <dt className="font-condensed uppercase tracking-[0.14em] text-xs text-amber-300/85">
                      Audio Engine
                    </dt>
                    <dd className="text-cream-100/90 text-xs sm:text-sm text-right">
                      Web Audio Procedural Synthesizer
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  data-sfx="back"
                  onClick={() => setActivePanel('menu')}
                  className="py-2 px-3 rounded-sm title-menu-glow text-cream-50 font-condensed uppercase tracking-[0.14em] text-xs inline-flex items-center gap-2 transition hover:brightness-110"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Back to Title Menu
                </button>
              </section>
          )}
        </div>
      </div>

      {/* Bottom-right console-style control prompt bar */}
      <footer className="relative z-20 px-4 sm:px-10 pb-4 sm:pb-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden sm:flex items-center gap-2 font-condensed uppercase tracking-[0.16em] text-[11px] text-cream-300/50">
          <span>MAFIA — MIDNIGHT CITY</span>
          <span>•</span>
          <span>5–16 PLAYERS</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:gap-5 font-condensed uppercase tracking-[0.1em] text-xs text-cream-100/80">
          {bootPhase === 'ready' && (
            <>
              <button
                type="button"
                data-sfx="none"
                onClick={replayIntro}
                className="inline-flex items-center gap-1.5 py-1 text-cream-100/75 hover:text-amber-300 transition"
              >
                <span className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
                  R
                </span>
                <span className="inline-flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  Replay Intro
                </span>
              </button>

              <button
                type="button"
                data-sfx="toggle"
                onClick={() => setMutedAudio(!mutedAudio)}
                className="inline-flex items-center gap-1.5 py-1 text-cream-100/75 hover:text-amber-300 transition"
              >
                <span className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
                  M
                </span>
                <span className="inline-flex items-center gap-1">
                  {mutedAudio ? (
                    <VolumeX className="w-3 h-3 text-crimson-400" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-amber-300" aria-hidden="true" />
                  )}
                  {mutedAudio ? 'Muted' : 'Sound On'}
                </span>
              </button>

              {activePanel === 'menu' ? (
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => activateMenuItem(activeMenuItem.id)}
                  className="inline-flex items-center gap-1.5 py-1 text-cream-100 hover:text-amber-200 transition"
                >
                  <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded-full border border-cream-100/70 text-[10px] leading-none">
                    ↵
                  </span>
                  <span>Select</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-sfx={activePanel === 'create' ? 'modalClose' : 'back'}
                  onClick={() => {
                    setLocalError(null);
                    setActivePanel('menu');
                  }}
                  className="inline-flex items-center gap-1.5 py-1 text-cream-100 hover:text-amber-200 transition"
                >
                  <span className="hidden sm:inline-flex items-center justify-center px-1.5 h-5 rounded-full border border-cream-100/70 text-[10px] leading-none">
                    ESC
                  </span>
                  <span>Back</span>
                </button>
              )}
            </>
          )}

          {bootPhase === 'loading' && (
            <button
              type="button"
              data-sfx="none"
              onClick={(e) => {
                e.stopPropagation();
                skipIntro();
              }}
              className="inline-flex items-center gap-1.5 py-1 text-cream-100/80 hover:text-amber-300 transition"
            >
              <span className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
                SPACE
              </span>
              <span className="inline-flex items-center gap-1">
                Skip
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </footer>

      {activePanel === 'create' && !avatarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Create Room Setup and House Rules"
        >
          <div className="relative w-full max-w-5xl max-h-[94dvh] flex flex-col overflow-hidden rounded-2xl border border-gold-500/35 bg-[#0c0a0d] shadow-[0_28px_80px_rgba(0,0,0,0.9)]">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-gold-500/20 bg-noir-950/90">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => setAvatarOpen(true, 'create')}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-gold-500/35 bg-noir-900 hover:bg-noir-800 text-xs font-condensed font-bold uppercase tracking-wider text-gold-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Back to Avatar
                </button>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono uppercase tracking-[0.14em] sm:tracking-[0.18em] text-amber-200 font-bold">
                  <span className="sm:hidden">2/2 • Rules</span>
                  <span className="hidden sm:inline">Step 2 of 2 • Table &amp; Rules</span>
                </span>
              </div>

              <button
                type="button"
                data-sfx="modalClose"
                onClick={() => {
                  setLocalError(null);
                  setActivePanel('menu');
                }}
                className="text-xs font-condensed uppercase tracking-[0.14em] text-cream-300 hover:text-cream-50 px-2.5 py-1 rounded hover:bg-noir-800 transition cursor-pointer"
              >
                Title Menu
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6">
              <div className="grid lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                <form onSubmit={handleCreate} className="lg:col-span-4 space-y-4">
                  <div className="rounded-2xl border border-gold-500/25 bg-noir-950/90 p-3.5 sm:p-4 space-y-4">
                    <div>
                      <h2 className="font-display text-lg text-gold-200 uppercase tracking-wider">
                        Create Private Table
                      </h2>
                      <p className="text-xs text-cream-400 mt-0.5">
                        Enter your alias and review your pinned dossier card.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="player-name-input"
                        className="block font-condensed uppercase tracking-[0.18em] text-xs text-amber-300/90 mb-1.5"
                      >
                        Your Alias
                      </label>
                      <input
                        ref={aliasInputRef}
                        id="player-name-input"
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={20}
                        placeholder="e.g. Detective Vance"
                        className="w-full bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-lg px-3.5 py-2.5 text-base sm:text-sm text-cream-50 placeholder:text-cream-400/50 transition"
                      />
                    </div>

                    {avatarSelectorBar}

                    {localError && (
                      <p role="alert" className="text-xs text-crimson-400 font-medium">
                        {localError}
                      </p>
                    )}

                    {connectionStatus !== 'connected' && (
                      <p className="text-xs text-amber-300/90">
                        Connecting to game server — button activates once online.
                      </p>
                    )}

                    <button
                      type="submit"
                      data-sfx="none"
                      disabled={disabled}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#b87424] via-[#d28d34] to-[#b87424] hover:brightness-110 text-[#0d0804] font-display font-bold uppercase tracking-[0.14em] text-sm inline-flex items-center justify-center gap-2 transition shadow-[0_8px_24px_rgba(184,116,36,0.3)] disabled:opacity-60 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Opening Table...' : 'Open Table'}
                    </button>

                    <p className="text-[11px] text-cream-400 leading-relaxed">
                      5–16 players • Private Voice &amp; Text • Rules configured here apply to the table when created.
                    </p>
                  </div>
                </form>

                <div className="lg:col-span-8">
                  <HouseRulesEditor
                    settings={pendingRoomSettings}
                    onChange={setPendingRoomSettings}
                    onReset={resetPendingRoomSettings}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
