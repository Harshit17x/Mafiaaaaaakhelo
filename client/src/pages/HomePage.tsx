import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
import { MafiaTitleLogo } from '../components/MafiaTitleLogo';
import { TitleAtmosphereCanvas } from '../components/TitleAtmosphereCanvas';
import { useGameStore } from '../stores/useGameStore';

type TitlePanel = 'menu' | 'create' | 'join' | 'credits';

interface MenuItem {
  id: 'create' | 'join' | 'rules' | 'credits';
  label: string;
  description: string;
}

const DEFAULT_MENU_ITEM: MenuItem = {
  id: 'create',
  label: 'Create Room',
  description: 'Open a private 5–16 player speakeasy table and configure the night rules.',
};

const MENU_ITEMS: MenuItem[] = [
  DEFAULT_MENU_ITEM,
  {
    id: 'join',
    label: 'Join Room',
    description: 'Slip into an existing Midnight City table using a 6-character invite code.',
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
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const mutedAudio = useGameStore((s) => s.mutedAudio);
  const setMutedAudio = useGameStore((s) => s.setMutedAudio);

  const initialInviteCode = useMemo(() => extractInviteRoomCode(), []);

  const [bootPhase, setBootPhase] = useState<'loading' | 'ready'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const bgLoadedRef = useRef(false);
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

  useEffect(() => {
    const code = extractInviteRoomCode();
    if (code) {
      setRoomCode(code);
      setActivePanel('join');
    }
  }, []);

  // Preload the cinematic speakeasy background artwork
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = '/assets/mafia-title-bg.jpg';
    if (img.complete) {
      bgLoadedRef.current = true;
    } else {
      img.onload = () => {
        if (active) bgLoadedRef.current = true;
      };
      img.onerror = () => {
        if (active) bgLoadedRef.current = true;
      };
    }
    const fallbackTimer = window.setTimeout(() => {
      if (active) bgLoadedRef.current = true;
    }, 2400);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
    };
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
      const ready = bgLoadedRef.current;
      const targetCap = ready ? 100 : 88;
      const pct = Math.min(targetCap, Math.round(easedTime * targetCap));
      setLoadProgress(pct);

      if (ready && timeRatio >= 1) {
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
      soundEngine.playMenuConfirm();
      setLoadProgress(100);
      setBootPhase('ready');
    }
  }, [bootPhase]);

  const replayIntro = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playMenuTick();
    setLocalError(null);
    setActivePanel('menu');
    setLoadProgress(0);
    setBootPhase('loading');
    setIntroRunId((n) => n + 1);
  }, []);

  const activateMenuItem = useCallback(
    (itemId: MenuItem['id']) => {
      soundEngine.unlock();
      soundEngine.playMenuConfirm();
      setLocalError(null);
      if (itemId === 'create') {
        setActivePanel('create');
      } else if (itemId === 'join') {
        setActivePanel('join');
      } else if (itemId === 'rules') {
        setRulesOpen(true);
      } else if (itemId === 'credits') {
        setActivePanel('credits');
      }
    },
    [setRulesOpen]
  );

  // Auto-focus alias input when opening Create or Join sub-screen
  useEffect(() => {
    if (bootPhase !== 'ready') return;
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
      if (rulesOpen) return;

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
          soundEngine.playMenuBack();
          setLocalError(null);
          setActivePanel('menu');
        }
        return;
      }

      if (isTyping) return;

      if (activePanel === 'menu') {
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          soundEngine.playMenuTick();
          setSelectedIndex((prev) => (prev + 1) % MENU_ITEMS.length);
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          soundEngine.playMenuTick();
          setSelectedIndex((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const current = MENU_ITEMS[selectedIndex];
          if (current) activateMenuItem(current.id);
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
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
    if (!playerName.trim()) {
      setLocalError('Enter your alias before opening a table.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    soundEngine.playMenuConfirm();
    await createRoom(playerName);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setLocalError('Enter your alias before entering a table.');
      return;
    }
    if (normalizeRoomCode(roomCode).length !== 6) {
      setLocalError('Enter a valid 6-character room code.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    soundEngine.playMenuConfirm();
    await joinRoom(roomCode, playerName);
    setSubmitting(false);
  };

  const activeMenuItem = MENU_ITEMS[selectedIndex] ?? DEFAULT_MENU_ITEM;
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
      className="relative z-10 min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#060405] text-cream-100 select-none flex flex-col justify-between"
    >
      {/* Full-bleed speakeasy background scene with subtle camera breath & cursor parallax */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <motion.div
          animate={{
            opacity: bootPhase === 'loading' ? 0.18 + (loadProgress / 100) * 0.42 : 1,
            scale: bootPhase === 'loading' ? 1.07 - (loadProgress / 100) * 0.03 : 1.035,
            x: parallax.x,
            y: parallax.y,
          }}
          transition={{
            opacity: { duration: 0.7, ease: 'easeOut' },
            scale: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
            x: { type: 'spring', stiffness: 45, damping: 20 },
            y: { type: 'spring', stiffness: 45, damping: 20 },
          }}
          className="w-full h-full will-change-transform"
        >
          <img
            src="/assets/mafia-title-bg.jpg"
            alt=""
            className="w-full h-full object-cover object-[74%_24%] md:object-[68%_center]"
          />
        </motion.div>

        {/* Warm ambient speakeasy light bloom */}
        <div
          className="absolute inset-0 animate-ember-pulse"
          style={{
            background:
              'radial-gradient(circle at 72% 48%, rgba(224, 138, 48, 0.16) 0%, rgba(152, 74, 24, 0.06) 36%, transparent 65%)',
          }}
        />

        {/* Left-column legibility scrim (preserves the brooding figure on the right) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(6,4,6,0.92) 0%, rgba(7,5,6,0.78) 28%, rgba(8,6,7,0.34) 52%, rgba(6,4,6,0.12) 78%, rgba(6,4,6,0.42) 100%)',
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
          className="absolute inset-x-0 bottom-0 h-36"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(5,4,5,0.88) 100%)',
          }}
        />

        <TitleAtmosphereCanvas active />
        <div className="film-grain absolute inset-0 opacity-85" />
        <div className="noir-vignette absolute inset-0" />
      </div>

      {/* Minimal floating top-right audio & connection status HUD */}
      <div className="relative z-20 flex items-center justify-end px-5 sm:px-10 pt-5">
        <div className="inline-flex items-center gap-3 rounded-full bg-black/45 backdrop-blur-md border border-cream-100/15 px-3.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          {connectionStatus === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 font-condensed uppercase tracking-[0.14em] text-[11px] text-cream-100/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Online
            </span>
          ) : (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 font-condensed uppercase tracking-[0.14em] text-[11px] text-amber-300"
            >
              <WifiOff className="w-3 h-3 animate-pulse" />
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
            </span>
          )}
          <span className="h-3.5 w-px bg-cream-100/15" aria-hidden="true" />
          <AudioControls />
        </div>
      </div>

      {/* Left-anchored AAA Title Column */}
      <div className="relative z-20 flex-1 flex items-start px-6 sm:px-12 md:px-16 lg:px-24 pt-[6vh] sm:pt-[9vh] pb-6">
        <div className="w-full max-w-[390px] sm:max-w-[430px] flex flex-col items-start">
          {/* MIDNIGHT CITY Crimson Badge + Distressed MAFIA Logo */}
          <div key={`logo-${introRunId}`} className="mb-7 sm:mb-9 animate-title-enter">
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
                Click anywhere or press Space to enter the speakeasy
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
                      onMouseEnter={() => {
                        if (selectedIndex !== idx) {
                          soundEngine.playMenuTick();
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
          ) : activePanel === 'create' ? (
            <section
              key="create-panel"
              aria-label="Create Room"
              className="w-full max-w-[360px] animate-title-enter"
            >
                <h2 className="font-condensed font-light uppercase tracking-[0.07em] text-2xl sm:text-[28px] leading-none text-cream-50/95 mb-3">
                  CREATE PRIVATE TABLE
                </h2>
                <div className="title-rule w-full mb-4" />

                <form onSubmit={handleCreate} className="space-y-4">
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
                      className="w-full bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-sm px-3.5 py-2.5 text-sm text-cream-50 placeholder:text-cream-400/50 transition"
                    />
                  </div>

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
                      disabled={disabled}
                      className="w-full py-2.5 px-4 rounded-sm bg-gradient-to-r from-[#b87424] via-[#d28d34] to-[#b87424] hover:brightness-110 text-[#0d0804] font-condensed font-bold uppercase tracking-[0.14em] text-base inline-flex items-center justify-center gap-2 transition shadow-[0_8px_24px_rgba(184,116,36,0.3)] disabled:opacity-60"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Opening Table...' : 'Open Table'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playMenuBack();
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
                  5–16 players • Private Voice &amp; Text • Host customizes roles in the lounge.
                </p>
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
                      className="w-full bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-sm px-3.5 py-2.5 text-sm text-cream-50 placeholder:text-cream-400/50 transition"
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
                      placeholder="ABCDEF"
                      className="w-full font-mono uppercase tracking-[0.35em] bg-black/55 backdrop-blur-sm border border-cream-100/20 focus:border-amber-400/80 rounded-sm px-3.5 py-2.5 text-sm text-amber-200 placeholder:text-cream-400/40 transition"
                    />
                  </div>

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
                      disabled={disabled}
                      className="w-full py-2.5 px-4 rounded-sm bg-gradient-to-r from-[#b87424] via-[#d28d34] to-[#b87424] hover:brightness-110 text-[#0d0804] font-condensed font-bold uppercase tracking-[0.14em] text-base inline-flex items-center justify-center gap-2 transition shadow-[0_8px_24px_rgba(184,116,36,0.3)] disabled:opacity-60"
                    >
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Entering Table...' : 'Enter Table'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playMenuBack();
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
                  onClick={() => {
                    soundEngine.playMenuBack();
                    setActivePanel('menu');
                  }}
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
      <footer className="relative z-20 px-6 sm:px-10 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="hidden sm:flex items-center gap-2 font-condensed uppercase tracking-[0.16em] text-[11px] text-cream-300/50">
          <span>MAFIA — MIDNIGHT CITY</span>
          <span>•</span>
          <span>5–16 PLAYERS</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3 sm:gap-5 font-condensed uppercase tracking-[0.1em] text-xs text-cream-100/80">
          {bootPhase === 'ready' && (
            <>
              <button
                type="button"
                onClick={replayIntro}
                className="inline-flex items-center gap-1.5 text-cream-100/75 hover:text-amber-300 transition"
              >
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
                  R
                </span>
                <span className="inline-flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  Replay Intro
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMutedAudio(!mutedAudio)}
                className="inline-flex items-center gap-1.5 text-cream-100/75 hover:text-amber-300 transition"
              >
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
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
                  onClick={() => activateMenuItem(activeMenuItem.id)}
                  className="inline-flex items-center gap-1.5 text-cream-100 hover:text-amber-200 transition"
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-cream-100/70 text-[10px] leading-none">
                    ↵
                  </span>
                  <span>Select</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playMenuBack();
                    setLocalError(null);
                    setActivePanel('menu');
                  }}
                  className="inline-flex items-center gap-1.5 text-cream-100 hover:text-amber-200 transition"
                >
                  <span className="inline-flex items-center justify-center px-1.5 h-5 rounded-full border border-cream-100/70 text-[10px] leading-none">
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
              onClick={skipIntro}
              className="inline-flex items-center gap-1.5 text-cream-100/80 hover:text-amber-300 transition"
            >
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[3px] bg-cream-100/90 text-[#0c090a] font-bold text-[10px] leading-none">
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
    </main>
  );
}
