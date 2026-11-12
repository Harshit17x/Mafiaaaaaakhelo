import React, { useEffect, useRef } from 'react';
import { Headphones, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { useGameStore } from '../stores/useGameStore';
import { useVoiceStore, VOICE_AUTOJOIN_KEY } from '../stores/useVoiceStore';
import { MeshVoiceProvider } from '../voice/MeshVoiceProvider';

export function VoiceControlsBar({
  onSpeakingChange,
}: {
  onSpeakingChange: (speakingIds: Set<string>) => void;
}) {
  const room = useGameStore((s) => s.room);
  const voiceState = useGameStore((s) => s.voiceState);
  const setMicStatus = useGameStore((s) => s.setMicStatus);
  const registerVoiceSignalListener = useGameStore((s) => s.registerVoiceSignalListener);
  const sendVoiceSignal = useGameStore((s) => s.sendVoiceSignal);

  const joined = useVoiceStore((s) => s.joined);
  const pttMode = useVoiceStore((s) => s.pttMode);
  const pttPressed = useVoiceStore((s) => s.pttPressed);
  const openMicMuted = useVoiceStore((s) => s.openMicMuted);
  const autoplayBlocked = useVoiceStore((s) => s.autoplayBlocked);
  const voiceError = useVoiceStore((s) => s.voiceError);
  const canSpeak = useVoiceStore((s) => s.canSpeak);

  const setProvider = useVoiceStore((s) => s.setProvider);
  const setAutoplayBlocked = useVoiceStore((s) => s.setAutoplayBlocked);
  const setVoiceError = useVoiceStore((s) => s.setVoiceError);
  const setSpeakingPeerIds = useVoiceStore((s) => s.setSpeakingPeerIds);
  const setCanSpeak = useVoiceStore((s) => s.setCanSpeak);
  const setPttPressed = useVoiceStore((s) => s.setPttPressed);
  const joinVoice = useVoiceStore((s) => s.joinVoice);
  const resumeBlockedAudio = useVoiceStore((s) => s.resumeBlockedAudio);

  const autoRejoinAttempted = useRef(false);
  const prevPttPressedRef = useRef(false);

  // Sync canSpeak from voiceState
  useEffect(() => {
    setCanSpeak(voiceState ? voiceState.canSpeak : true);
  }, [voiceState, setCanSpeak]);

  // Mesh Voice Provider lifecycle
  useEffect(() => {
    const provider = new MeshVoiceProvider();
    setProvider(provider);

    const unsubProvider = provider.subscribe({
      onSignal: (toPlayerId, signal) => sendVoiceSignal(toPlayerId, signal),
      onSpeakingChange: (ids) => {
        setSpeakingPeerIds(ids);
        onSpeakingChange(ids);
      },
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
      setProvider(null);
    };
  }, [
    onSpeakingChange,
    registerVoiceSignalListener,
    sendVoiceSignal,
    setMicStatus,
    setProvider,
    setSpeakingPeerIds,
    setAutoplayBlocked,
    setVoiceError,
  ]);

  // Sync effective mic mute state
  useEffect(() => {
    const provider = useVoiceStore.getState().provider;
    const effectiveMuted = pttMode ? !pttPressed : openMicMuted;
    provider?.setMicMuted(effectiveMuted);
  }, [pttMode, pttPressed, openMicMuted]);

  // Apply server room voice state (e.g. night mute, mafia channel)
  useEffect(() => {
    const provider = useVoiceStore.getState().provider;
    provider?.applyVoiceState(voiceState);
  }, [voiceState]);

  // Update peer connections as players join/leave voice
  useEffect(() => {
    const provider = useVoiceStore.getState().provider;
    if (!joined || !room || !provider) return;
    const connectedPeerIds = room.players
      .filter((p) => p.id !== room.myPlayerId && p.connected && p.voiceJoined)
      .map((p) => p.id);
    provider.updatePeers(connectedPeerIds);
  }, [joined, room]);

  // Push-to-Talk Space bar listener
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
  }, [pttMode, joined, canSpeak, setPttPressed]);

  // PTT audio cues
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

  // Autorejoin on reconnect if user previously joined
  useEffect(() => {
    if (!room || joined || autoRejoinAttempted.current) return;
    autoRejoinAttempted.current = true;
    try {
      if (localStorage.getItem(VOICE_AUTOJOIN_KEY) === '1') {
        void joinVoice(false);
      }
    } catch {
    }
  }, [room, joined, joinVoice]);

  if (!room) return null;

  // The top voice banner is completely removed per user request!
  // Only non-intrusive floating toasts (autoplay unlock / error) render here.
  return (
    <>
      {autoplayBlocked && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            type="button"
            data-sfx="confirm"
            onClick={() => void resumeBlockedAudio()}
            className="px-3.5 py-2 rounded-xl bg-amber-500 text-noir-950 font-bold inline-flex items-center gap-2 shadow-2xl animate-pulse cursor-pointer text-xs"
          >
            <Headphones className="w-4 h-4" />
            <span>Tap to Enable Audio</span>
          </button>
        </div>
      )}

      {voiceError && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm">
          <div className="rounded-xl bg-crimson-900/90 border border-crimson-400/60 p-2.5 text-xs text-crimson-100 flex items-center justify-between gap-2 shadow-xl">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="p-1 rounded hover:bg-noir-950/40 text-cream-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
