import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LogOut, Radio, WifiOff } from 'lucide-react';
import { soundEngine } from './audio/SoundEngine';
import { Atmosphere } from './components/Atmosphere';
import { AudioControls } from './components/AudioControls';
import { GodViewPanel } from './components/GodViewPanel';
import { HostControlsBar } from './components/HostControlsBar';
import { LivePlayersBadge } from './components/LivePlayersBadge';
import { MafiaTitleLogo } from './components/MafiaTitleLogo';
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

  const [speakingPeerIds, setSpeakingPeerIds] = useState<Set<string>>(() => new Set());
  const prevPhaseRef = useRef<string | null>(null);
  const prevNarrationSeqRef = useRef<number>(0);

  const handleSpeakingChange = useCallback((ids: Set<string>) => {
    setSpeakingPeerIds(ids);
  }, []);

  useEffect(() => {
    initConnection();
  }, [initConnection]);

  useEffect(() => {
    const unlock = () => soundEngine.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    soundEngine.setPrefs(mutedAudio, volume);
  }, [mutedAudio, volume]);

  const phase = room ? room.game.phase : 'HOME';

  useEffect(() => {
    if (!room) {
      soundEngine.setAmbient('none');
      prevPhaseRef.current = null;
      return;
    }

    if (room.game.phase === 'NIGHT') {
      soundEngine.setAmbient('night');
    } else if (
      room.game.phase === 'DAWN' ||
      room.game.phase === 'DAY_DISCUSSION' ||
      room.game.phase === 'DAY_VOTE' ||
      room.game.phase === 'VOTE_RESULT'
    ) {
      soundEngine.setAmbient('day');
    } else {
      soundEngine.setAmbient('none');
    }

    if (prevPhaseRef.current !== room.game.phase) {
      prevPhaseRef.current = room.game.phase;
      if (room.game.phase === 'NIGHT') {
        soundEngine.playDoorCreak();
      } else if (room.game.phase === 'DAWN') {
        soundEngine.playRooster();
        if (room.game.dawn?.killedPlayerId) {
          window.setTimeout(() => soundEngine.playGunshot(), 420);
        }
      } else if (room.game.phase === 'VOTE_RESULT') {
        soundEngine.playGavel();
      }
    }
  }, [room]);

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
    <div className="relative min-h-screen flex flex-col">
      {room && <Atmosphere phase={phase} />}

      {room && (
        <header className="relative z-20 border-b border-gold-500/20 bg-noir-950/75 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span className="font-display font-bold tracking-[0.2em] text-gold-200 text-sm sm:text-base truncate">
                MIDNIGHT CITY
              </span>
              <span className="hidden sm:inline-block font-mono text-xs px-2 py-0.5 rounded bg-noir-800 border border-gold-500/30 text-gold-300">
                #{room.roomCode}
              </span>
              <LivePlayersBadge variant="header" />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {connectionStatus !== 'connected' && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs"
                >
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                </span>
              )}

              <RolePeekChip />
              <AudioControls />

              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-cream-200 hover:text-gold-200 hover:bg-noir-800"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Rules</span>
              </button>

              <button
                type="button"
                onClick={() => void leaveRoom()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-crimson-300 hover:text-crimson-200 hover:bg-crimson-900/40"
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
              ? 'relative z-30 max-w-2xl mx-auto mt-4 px-4 w-full'
              : 'fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-xl px-4 w-full'
          }
        >
          <div className="rounded-xl bg-crimson-900/95 backdrop-blur-md border border-crimson-400/70 px-4 py-3 flex items-center justify-between gap-3 text-sm text-crimson-100 shadow-2xl">
            <span>{kickedReason ?? errorBanner}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-xs uppercase font-bold tracking-wider px-2 py-1 rounded bg-noir-950/50 hover:bg-noir-950"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isRestoringSession && !room ? (
        <div className="relative z-10 min-h-screen flex items-center px-6 sm:px-12 md:px-16 lg:px-24 bg-[#060405] overflow-hidden">
          <img
            src="/assets/mafia-title-bg.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 w-full h-full object-cover object-[74%_24%] md:object-[68%_center] opacity-30"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(6,4,6,0.94) 0%, rgba(7,5,6,0.8) 38%, rgba(6,4,6,0.5) 100%)',
            }}
          />
          <div className="relative z-10 max-w-[380px] space-y-6">
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
        <div className="relative z-10 flex-1">
          <VoiceControlsBar onSpeakingChange={handleSpeakingChange} />
          {lastNarration &&
            room.settings.narratorMode === 'AUTO_NARRATOR' &&
            room.game.phase !== 'LOBBY' && (
              <div className="max-w-6xl mx-auto px-4 pt-2">
                <div
                  aria-live="polite"
                  className="rounded-xl bg-noir-900/75 border border-gold-500/20 px-4 py-2 text-xs text-gold-200/90 flex items-center gap-2"
                >
                  <Radio className="w-3.5 h-3.5 text-gold-400 shrink-0" aria-hidden="true" />
                  <span className="font-serif italic text-sm">{lastNarration.text}</span>
                </div>
              </div>
            )}
          {room.game.godView && (
            <div className="max-w-6xl mx-auto px-4 pt-4">
              <GodViewPanel />
            </div>
          )}
          <HostControlsBar />
          <AnimatePresence mode="wait">
            <motion.div
              key={room.game.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {room.game.phase === 'LOBBY' && (
                <LobbyPage speakingPeerIds={speakingPeerIds} />
              )}
              {room.game.phase === 'ROLE_REVEAL' && <RoleRevealPage />}
              {room.game.phase === 'NIGHT' && (
                <NightPage speakingPeerIds={speakingPeerIds} />
              )}
              {room.game.phase === 'DAWN' && <DawnPage />}
              {(room.game.phase === 'DAY_DISCUSSION' ||
                room.game.phase === 'DAY_VOTE' ||
                room.game.phase === 'VOTE_RESULT') && (
                <DayTablePage speakingPeerIds={speakingPeerIds} />
              )}
              {room.game.phase === 'GAME_OVER' && <GameOverPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
