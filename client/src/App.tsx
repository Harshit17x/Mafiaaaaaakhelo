import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LogOut, Radio, WifiOff } from 'lucide-react';
import { soundEngine } from './audio/SoundEngine';
import { mountUiSoundDelegator } from './audio/uiSoundDelegator';
import { Atmosphere } from './components/Atmosphere';
import { AudioControls } from './components/AudioControls';
import { AvatarPanelModal } from './components/AvatarPanelModal';
import { DevGodModePanel } from './components/DevGodModePanel';
import { GodViewPanel } from './components/GodViewPanel';
import { HostControlsBar } from './components/HostControlsBar';
import { LivePlayersBadge } from './components/LivePlayersBadge';
import { MafiaTitleLogo } from './components/MafiaTitleLogo';
import { MobsterPaperScene } from './components/MobsterPaperScene';
import { RolePeekChip } from './components/RolePeekChip';
import { RulesModal } from './components/RulesModal';
import { VoiceControlsBar } from './components/VoiceControlsBar';
import { DawnPage } from './pages/DawnPage';
import { DayTablePage } from './pages/DayTablePage';
import { GameOverPage } from './pages/GameOverPage';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { NightPage } from './pages/NightPage';
import { RoleRevealPage } from './pages/RoleRevealPage';
import { useGameStore } from './stores/useGameStore';

export function App() {
  const initConnection = useGameStore((s) => s.initConnection);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const isRestoringSession = useGameStore((s) => s.isRestoringSession);
  const room = useGameStore((s) => s.room);
  const errorBanner = useGameStore((s) => s.errorBanner);
  const kickedReason = useGameStore((s) => s.kickedReason);
  const clearError = useGameStore((s) => s.clearError);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const rulesOpen = useGameStore((s) => s.rulesOpen);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const mutedAudio = useGameStore((s) => s.mutedAudio);
  const volume = useGameStore((s) => s.volume);
  const lastNarration = useGameStore((s) => s.lastNarration);
  const devSpeakingPeerIds = useGameStore((s) => s.devSpeakingPeerIds);

  const [speakingPeerIds, setSpeakingPeerIds] = useState<Set<string>>(() => new Set());
  const effectiveSpeakingPeerIds = useMemo(() => {
    if (devSpeakingPeerIds.length === 0) return speakingPeerIds;
    const merged = new Set(speakingPeerIds);
    for (const id of devSpeakingPeerIds) merged.add(id);
    return merged;
  }, [speakingPeerIds, devSpeakingPeerIds]);
  const prevPhaseRef = useRef<string | null>(null);
  const prevRoomCodeRef = useRef<string | null>(null);
  const prevPlayerCountRef = useRef<{ roomCode: string; count: number } | null>(null);
  const prevAlertRef = useRef<string | null>(null);
  const prevNarrationSeqRef = useRef<number>(0);
  const dawnCueTimerRef = useRef<number | null>(null);
  const lastTickRef = useRef<{ endsAt: number; sec: number } | null>(null);

  const handleSpeakingChange = useCallback((ids: Set<string>) => {
    setSpeakingPeerIds(ids);
  }, []);

  useEffect(() => {
    initConnection();
  }, [initConnection]);

  useEffect(() => {
    soundEngine.preloadAll();
    const unmountDelegator = mountUiSoundDelegator();

    const unlock = () => {
      soundEngine.unlock();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        soundEngine.unlock();
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unmountDelegator();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (dawnCueTimerRef.current !== null) {
        window.clearTimeout(dawnCueTimerRef.current);
        dawnCueTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    soundEngine.setPrefs(mutedAudio, volume);
  }, [mutedAudio, volume]);

  const phase = room ? room.game.phase : 'HOME';
  const isDayTablePhase =
    phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTE' || phase === 'VOTE_RESULT';
  const roomCode = room?.roomCode ?? null;
  const gamePhase = room?.game.phase ?? null;
  const dawnKilled = Boolean(room?.game.dawn?.killedPlayerId);
  const primaryWinner = room?.game.winners[0] ?? 'CITY';
  const playerCount = room?.players.length ?? 0;
  const activeAlertMessage = kickedReason ?? errorBanner ?? null;

  const activeTimerEndsAt =
    room &&
    !room.game.paused &&
    room.game.phase !== 'LOBBY' &&
    room.game.phase !== 'GAME_OVER'
      ? (room.game.phaseEndsAt ??
          (room.game.phase === 'NIGHT' &&
          room.game.night?.canAct &&
          !room.game.night.hasSubmitted
            ? room.game.night.subPhaseEndsAt
            : null))
      : null;

  useEffect(() => {
    if (!roomCode || !gamePhase) {
      soundEngine.setAmbient('home');
      prevPhaseRef.current = null;
      prevRoomCodeRef.current = null;
      if (dawnCueTimerRef.current !== null) {
        window.clearTimeout(dawnCueTimerRef.current);
        dawnCueTimerRef.current = null;
      }
      return;
    }

    if (prevRoomCodeRef.current !== roomCode) {
      prevRoomCodeRef.current = roomCode;
      prevPhaseRef.current = null;
    }

    if (gamePhase === 'LOBBY') {
      soundEngine.setAmbient('lobby');
    } else if (gamePhase === 'NIGHT') {
      soundEngine.setAmbient('night');
    } else if (
      gamePhase === 'DAWN' ||
      gamePhase === 'DAY_DISCUSSION' ||
      gamePhase === 'DAY_VOTE' ||
      gamePhase === 'VOTE_RESULT'
    ) {
      soundEngine.setAmbient('day');
    } else {
      soundEngine.setAmbient('none');
    }

    if (prevPhaseRef.current !== gamePhase) {
      const prevPhase = prevPhaseRef.current;
      prevPhaseRef.current = gamePhase;

      if (dawnCueTimerRef.current !== null) {
        window.clearTimeout(dawnCueTimerRef.current);
        dawnCueTimerRef.current = null;
      }

      if (gamePhase === 'ROLE_REVEAL') {
        if (prevPhase !== null) {
          soundEngine.playCardShuffle();
        }
      } else if (gamePhase === 'NIGHT') {
        soundEngine.playDoorCreak();
      } else if (gamePhase === 'DAWN') {
        soundEngine.playRooster();
        dawnCueTimerRef.current = window.setTimeout(() => {
          dawnCueTimerRef.current = null;
          if (dawnKilled) {
            soundEngine.playGunshot();
          } else {
            soundEngine.playHealChime();
          }
        }, 420);
      } else if (gamePhase === 'DAY_DISCUSSION') {
        soundEngine.playChipClink();
      } else if (gamePhase === 'DAY_VOTE') {
        soundEngine.playGavel();
      } else if (gamePhase === 'VOTE_RESULT') {
        soundEngine.playGavel();
      } else if (gamePhase === 'GAME_OVER') {
        if (primaryWinner === 'MAFIA') {
          soundEngine.playVictoryMafia();
        } else {
          soundEngine.playVictoryCitizen();
        }
      }
    }
  }, [roomCode, gamePhase, dawnKilled, primaryWinner]);

  useEffect(() => {
    if (!roomCode) {
      prevPlayerCountRef.current = null;
      return;
    }
    const prev = prevPlayerCountRef.current;
    if (!prev || prev.roomCode !== roomCode) {
      prevPlayerCountRef.current = { roomCode, count: playerCount };
      return;
    }
    if (playerCount > prev.count) {
      soundEngine.playPlayerJoin();
    } else if (playerCount < prev.count) {
      soundEngine.playPlayerLeave();
    }
    prevPlayerCountRef.current = { roomCode, count: playerCount };
  }, [roomCode, playerCount]);

  useEffect(() => {
    if (activeAlertMessage && activeAlertMessage !== prevAlertRef.current) {
      soundEngine.playUiError();
    }
    prevAlertRef.current = activeAlertMessage;
  }, [activeAlertMessage]);

  useEffect(() => {
    if (!activeTimerEndsAt) {
      lastTickRef.current = null;
      return;
    }

    const checkTick = () => {
      const remainingSec = Math.ceil((activeTimerEndsAt - Date.now()) / 1000);
      if (remainingSec >= 1 && remainingSec <= 5) {
        const prev = lastTickRef.current;
        if (!prev || prev.endsAt !== activeTimerEndsAt || prev.sec !== remainingSec) {
          lastTickRef.current = { endsAt: activeTimerEndsAt, sec: remainingSec };
          soundEngine.playTimerTick();
        }
      }
    };

    checkTick();
    const id = window.setInterval(checkTick, 200);
    return () => window.clearInterval(id);
  }, [activeTimerEndsAt]);

  useEffect(() => {
    if (!lastNarration || lastNarration.seq === prevNarrationSeqRef.current) {
      return;
    }
    prevNarrationSeqRef.current = lastNarration.seq;
    if (room?.settings.narratorMode === 'AUTO_NARRATOR') {
      soundEngine.speakNarration(lastNarration.text);
    }
  }, [lastNarration, room?.settings.narratorMode]);

  return (
    <div
      className={`relative flex flex-col overflow-x-clip ${
        isDayTablePhase ? 'h-screen h-[100dvh]' : 'min-h-screen min-h-[100dvh]'
      }`}
    >
      {room && <Atmosphere phase={phase} />}

      {room && (
        <header className="relative z-20 border-b border-gold-500/20 bg-noir-950/75 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-2.5 sm:px-4 h-14 flex items-center justify-between gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <span className="font-display font-bold tracking-[0.08em] sm:tracking-[0.2em] text-gold-200 text-[11px] sm:text-base whitespace-nowrap">
                MIDNIGHT CITY
              </span>
              <span className="hidden sm:inline-block font-mono text-xs px-2 py-0.5 rounded bg-noir-800 border border-gold-500/30 text-gold-300 shrink-0">
                #{room.roomCode}
              </span>
              <LivePlayersBadge variant="header" />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-2.5 shrink-0">
              {connectionStatus !== 'connected' && (
                <span
                  role="status"
                  aria-label={connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                  title={connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                  className="inline-flex items-center gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs"
                >
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                  </span>
                </span>
              )}

              <RolePeekChip />
              <AudioControls />

              <button
                type="button"
                data-sfx="none"
                onClick={() => setRulesOpen(true)}
                aria-label="Open Rules"
                className="inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-cream-200 hover:text-gold-200 hover:bg-noir-800"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Rules</span>
              </button>

              <button
                type="button"
                data-sfx="back"
                onClick={() => void leaveRoom()}
                aria-label="Leave Room"
                className="inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-crimson-300 hover:text-crimson-200 hover:bg-crimson-900/40"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {(errorBanner || kickedReason) && (
        <div
          role="alert"
          className={
            room
              ? 'relative z-30 max-w-2xl mx-auto mt-3 sm:mt-4 px-3 sm:px-4 w-full'
              : 'fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 max-w-xl px-3 sm:px-4 w-full'
          }
        >
          <div className="rounded-xl bg-crimson-900/95 backdrop-blur-md border border-crimson-400/70 px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-crimson-100 shadow-2xl">
            <span className="min-w-0 break-words">{kickedReason ?? errorBanner}</span>
            <button
              type="button"
              data-sfx="back"
              onClick={clearError}
              className="shrink-0 text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-noir-950/50 hover:bg-noir-950"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isRestoringSession && !room ? (
        <div className="relative z-10 min-h-screen min-h-[100dvh] flex items-center px-5 sm:px-12 md:px-16 lg:px-24 bg-[#050404] overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed right-[-10vw] sm:right-[3vw] lg:right-[5vw] xl:right-[7vw] top-[8vh] sm:top-[6.5vh] h-[76vh] sm:h-[82vh] aspect-[760/1000] opacity-35"
          >
            <MobsterPaperScene className="w-full h-full" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(5,4,4,0.95) 0%, rgba(5,4,4,0.82) 38%, rgba(5,4,4,0.5) 100%)',
            }}
          />
          <div className="relative z-10 max-w-[380px] w-full space-y-6">
            <MafiaTitleLogo compact />
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 font-condensed uppercase tracking-[0.16em] text-sm text-amber-300">
                <span className="inline-block w-2 h-2 rotate-45 border border-amber-400 bg-amber-400/40 animate-spin" />
                Reconnecting to Midnight City...
              </div>
              <div className="h-[2px] w-full bg-cream-100/15 overflow-hidden">
                <div className="h-full w-2/3 bg-gradient-to-r from-amber-600 via-amber-300 to-cream-50 animate-pulse" />
              </div>
              <p className="text-xs text-cream-300/75">Restoring your dossier and table seat.</p>
            </div>
          </div>
        </div>
      ) : !room ? (
        <HomePage />
      ) : (
        <div
          className={`relative z-10 flex-1 flex flex-col min-h-0 ${
            isDayTablePhase ? 'overflow-y-auto' : ''
          }`}
        >
          <VoiceControlsBar onSpeakingChange={handleSpeakingChange} />
          {lastNarration &&
            room.settings.narratorMode === 'AUTO_NARRATOR' &&
            room.game.phase !== 'LOBBY' && (
              <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-2">
                <div
                  aria-live="polite"
                  className="rounded-xl bg-noir-900/75 border border-gold-500/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs text-gold-200/90 flex items-center gap-2"
                >
                  <Radio className="w-3.5 h-3.5 text-gold-400 shrink-0" aria-hidden="true" />
                  <span className="font-serif italic text-xs sm:text-sm">{lastNarration.text}</span>
                </div>
              </div>
            )}
          {room.game.godView && (
            <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-3 sm:pt-4">
              <GodViewPanel />
            </div>
          )}
          <HostControlsBar />
          <AnimatePresence mode="wait">
            <motion.div
              key={isDayTablePhase ? 'DAY_TABLE' : room.game.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={isDayTablePhase ? 'flex-1 flex flex-col min-h-0' : undefined}
            >
              {room.game.phase === 'LOBBY' && (
                <LobbyPage speakingPeerIds={effectiveSpeakingPeerIds} />
              )}
              {room.game.phase === 'ROLE_REVEAL' && <RoleRevealPage />}
              {room.game.phase === 'NIGHT' && (
                <NightPage speakingPeerIds={effectiveSpeakingPeerIds} />
              )}
              {room.game.phase === 'DAWN' && <DawnPage />}
              {isDayTablePhase && (
                <DayTablePage speakingPeerIds={effectiveSpeakingPeerIds} />
              )}
              {room.game.phase === 'GAME_OVER' && <GameOverPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <AvatarPanelModal />
      <DevGodModePanel />
    </div>
  );
}
