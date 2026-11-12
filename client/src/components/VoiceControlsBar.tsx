import React, { useEffect, useRef, useState } from 'react';
import {
  Headphones,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { useGameStore } from '../stores/useGameStore';
import { MeshVoiceProvider } from '../voice/MeshVoiceProvider';
import { fetchIceServers } from '../voice/iceConfig';
import type { VoiceProvider } from '../voice/VoiceProvider';

const VOICE_AUTOJOIN_KEY = 'midnight_city_voice_wanted_v1';

export function VoiceControlsBar({
  onSpeakingChange,
}: {
  onSpeakingChange: (speakingIds: Set<string>) => void;
}) {
  const room = useGameStore((s) => s.room);
  const voiceState = useGameStore((s) => s.voiceState);
  const setVoiceJoined = useGameStore((s) => s.setVoiceJoined);
  const setMicStatus = useGameStore((s) => s.setMicStatus);
  const registerVoiceSignalListener = useGameStore(
    (s) => s.registerVoiceSignalListener
  );
  const sendVoiceSignal = useGameStore((s) => s.sendVoiceSignal);

  const providerRef = useRef<VoiceProvider | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [pttMode, setPttMode] = useState(false);
  const [openMicMuted, setOpenMicMuted] = useState(false);
  const [pttPressed, setPttPressed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>({});
  const autoRejoinAttempted = useRef(false);
  const prevPttPressedRef = useRef(false);

  const effectiveLocalMuted = pttMode ? !pttPressed : openMicMuted;
  const canSpeak = voiceState ? voiceState.canSpeak : true;

  useEffect(() => {
    const provider = new MeshVoiceProvider();
    providerRef.current = provider;
    const unsubProvider = provider.subscribe({
      onSignal: (toPlayerId, signal) => sendVoiceSignal(toPlayerId, signal),
      onSpeakingChange,
      onAutoplayBlocked: setAutoplayBlocked,
      onError: setVoiceError,
      onLocalMicActiveChange: (active) => {
        void setMicStatus(active);
      },
    });
    const unsubSignals = registerVoiceSignalListener((fromPlayerId, signal) => {
      void provider.handleSignal(fromPlayerId, signal);
    });

    return () => {
      unsubSignals();
      unsubProvider();
      provider.disconnect();
      providerRef.current = null;
    };
  }, [onSpeakingChange, registerVoiceSignalListener, sendVoiceSignal, setMicStatus]);

  useEffect(() => {
    providerRef.current?.setMicMuted(effectiveLocalMuted);
  }, [effectiveLocalMuted]);

  useEffect(() => {
    providerRef.current?.applyVoiceState(voiceState);
  }, [voiceState]);

  useEffect(() => {
    if (!joined || !room || !providerRef.current) return;
    const connectedPeerIds = room.players
      .filter((p) => p.id !== room.myPlayerId && p.connected && p.voiceJoined)
      .map((p) => p.id);
    providerRef.current.updatePeers(connectedPeerIds);
  }, [joined, room]);

  useEffect(() => {
    if (!pttMode || !joined || !canSpeak) return;
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isTypingTarget(e.target)) {
        e.preventDefault();
        setPttPressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setPttPressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      setPttPressed(false);
    };
  }, [pttMode, joined, canSpeak]);

  useEffect(() => {
    if (pttPressed === prevPttPressedRef.current) return;
    prevPttPressedRef.current = pttPressed;
    if (!joined || !pttMode || !canSpeak) return;
    if (pttPressed) {
      soundEngine.playUiToggle();
    } else {
      soundEngine.playUiClick();
    }
  }, [pttPressed, joined, pttMode, canSpeak]);

  const handleJoinVoice = async (userInitiated = false) => {
    if (!room || !providerRef.current || joining) return;
    if (userInitiated) {
      soundEngine.playUiConfirm();
    }
    setJoining(true);
    setVoiceError(null);
    try {
      const iceServers = await fetchIceServers();
      const peerIds = room.players
        .filter((p) => p.id !== room.myPlayerId && p.connected && p.voiceJoined)
        .map((p) => p.id);
      await providerRef.current.connect({
        myPlayerId: room.myPlayerId,
        peerIds,
        iceServers,
        initialVoiceState: voiceState,
      });
      providerRef.current.setMicMuted(effectiveLocalMuted);
      await setVoiceJoined(true);
      setJoined(true);
      try {
        localStorage.setItem(VOICE_AUTOJOIN_KEY, '1');
      } catch {
      }
    } catch {
      setJoined(false);
      if (userInitiated) {
        soundEngine.playUiError();
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveVoice = async () => {
    soundEngine.playUiBack();
    providerRef.current?.disconnect();
    setJoined(false);
    await setVoiceJoined(false);
    try {
      localStorage.removeItem(VOICE_AUTOJOIN_KEY);
    } catch {
    }
  };

  useEffect(() => {
    if (!room || joined || autoRejoinAttempted.current) return;
    autoRejoinAttempted.current = true;
    try {
      if (localStorage.getItem(VOICE_AUTOJOIN_KEY) === '1') {
        void handleJoinVoice(false);
      }
    } catch {
    }
  });

  if (!room) return null;

  const channelLabel =
    voiceState?.channel === 'MAFIA'
      ? 'Syndicate Voice'
      : voiceState?.channel === 'GHOST'
        ? 'Ghost Channel'
        : voiceState?.channel === 'MUTED'
          ? 'Night Silence'
          : 'City Voice';

  const otherPlayers = room.players.filter((p) => p.id !== room.myPlayerId);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-2 sm:pt-3 space-y-2">
      <div className="noir-card rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="inline-flex items-center gap-1.5 font-display uppercase tracking-wider text-gold-300 font-semibold">
            <Radio className="w-4 h-4 shrink-0" aria-hidden="true" />
            {channelLabel}
          </span>

          {!joined ? (
            <button
              type="button"
              disabled={joining}
              data-sfx="none"
              onClick={() => void handleJoinVoice(true)}
              className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              {joining ? 'Connecting Mic...' : 'Join Voice'}
            </button>
          ) : (
            <>
              {!pttMode ? (
                <button
                  type="button"
                  disabled={!canSpeak}
                  data-sfx="none"
                  aria-pressed={effectiveLocalMuted}
                  onClick={() => {
                    soundEngine.playUiToggle();
                    setOpenMicMuted((m) => !m);
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 border transition ${
                    !canSpeak
                      ? 'bg-noir-900 border-noir-700 text-cream-600'
                      : effectiveLocalMuted
                        ? 'bg-crimson-900/70 border-crimson-500/60 text-crimson-200'
                        : 'bg-emerald-900/70 border-emerald-400/60 text-emerald-200'
                  }`}
                >
                  {effectiveLocalMuted || !canSpeak ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  {!canSpeak
                    ? 'Silenced'
                    : effectiveLocalMuted
                      ? 'Muted'
                      : 'Mic Live'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSpeak}
                  data-sfx="none"
                  onPointerDown={() => {
                    if (canSpeak) setPttPressed(true);
                  }}
                  onPointerUp={() => setPttPressed(false)}
                  onPointerLeave={() => setPttPressed(false)}
                  onPointerCancel={() => setPttPressed(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ WebkitTouchCallout: 'none' }}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 border select-none touch-none transition ${
                    !canSpeak
                      ? 'bg-noir-900 border-noir-700 text-cream-600'
                      : pttPressed
                        ? 'bg-emerald-700 border-emerald-300 text-white'
                        : 'bg-noir-800 border-gold-500/45 text-gold-200'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  {!canSpeak ? (
                    'Silenced'
                  ) : pttPressed ? (
                    'Transmitting...'
                  ) : (
                    <>
                      <span>Hold to Talk</span>
                      <span className="hidden sm:inline">(Space)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                data-sfx="none"
                aria-pressed={pttMode}
                onClick={() => {
                  soundEngine.playUiToggle();
                  setPttMode((v) => !v);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/30 text-cream-200"
              >
                <span className="hidden sm:inline">Mode: </span>
                {pttMode ? 'Push-to-Talk' : 'Open Mic'}
              </button>

              <button
                type="button"
                data-sfx="none"
                aria-expanded={mixerOpen}
                onClick={() => {
                  if (mixerOpen) {
                    soundEngine.playUiModalClose();
                  } else {
                    soundEngine.playUiModalOpen();
                  }
                  setMixerOpen((v) => !v);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/30 text-cream-200 inline-flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                Mixer
              </button>

              <button
                type="button"
                data-sfx="none"
                onClick={() => void handleLeaveVoice()}
                className="px-2.5 py-1.5 rounded-lg bg-crimson-950/80 hover:bg-crimson-900 border border-crimson-500/40 text-crimson-200 inline-flex items-center gap-1"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {autoplayBlocked && (
            <button
              type="button"
              data-sfx="confirm"
              onClick={() => void providerRef.current?.resumeBlockedAudio()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-noir-950 font-bold inline-flex items-center gap-1.5 animate-pulse"
            >
              <Headphones className="w-3.5 h-3.5" />
              Tap to Enable Audio
            </button>
          )}
          <span className="text-[11px] text-cream-400 hidden md:inline">
            Mesh P2P audio (best up to 8 players)
          </span>
        </div>
      </div>

      {voiceError && (
        <div
          role="alert"
          className="rounded-xl bg-crimson-900/80 border border-crimson-500/60 px-4 py-2 text-xs text-crimson-100"
        >
          {voiceError}
        </div>
      )}

      {mixerOpen && joined && (
        <div className="noir-card rounded-xl p-3.5 space-y-2.5 text-xs">
          <div className="font-semibold uppercase tracking-wider text-gold-300">
            Per-Player Audio Mixer
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {otherPlayers.map((p) => {
              const vol = peerVolumes[p.id] ?? 1;
              const isMuted = peerMuted[p.id] ?? false;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-noir-900/75 border border-gold-500/20 px-2.5 py-2"
                >
                  <span className="truncate text-cream-100 flex-1 min-w-0">{p.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      data-sfx="none"
                      aria-pressed={isMuted}
                      onClick={() => {
                        const next = !isMuted;
                        soundEngine.playUiToggle();
                        setPeerMuted((prev) => ({ ...prev, [p.id]: next }));
                        providerRef.current?.setPeerLocalMuted(p.id, next);
                      }}
                      aria-label={isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                      className="p-1.5 sm:p-1 rounded hover:bg-noir-800 text-cream-300"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-crimson-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-300" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={vol}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setPeerVolumes((prev) => ({ ...prev, [p.id]: v }));
                        providerRef.current?.setPeerVolume(p.id, v);
                      }}
                      aria-label={`Volume for ${p.name}`}
                      className="w-24 sm:w-20 accent-gold-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

