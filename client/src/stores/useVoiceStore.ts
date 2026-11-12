import { create } from 'zustand';
import { soundEngine } from '../audio/SoundEngine';
import { useGameStore } from './useGameStore';
import { fetchIceServers } from '../voice/iceConfig';
import type { VoiceProvider } from '../voice/VoiceProvider';

export const VOICE_AUTOJOIN_KEY = 'midnight_city_voice_wanted_v1';

export interface VoiceStoreState {
  joined: boolean;
  joining: boolean;
  openMicMuted: boolean;
  pttMode: boolean;
  pttPressed: boolean;
  autoplayBlocked: boolean;
  voiceError: string | null;
  speakingPeerIds: Set<string>;
  canSpeak: boolean;
  provider: VoiceProvider | null;

  setProvider: (provider: VoiceProvider | null) => void;
  setJoined: (joined: boolean) => void;
  setJoining: (joining: boolean) => void;
  setOpenMicMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setPttMode: (ptt: boolean) => void;
  setPttPressed: (pressed: boolean) => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  setVoiceError: (error: string | null) => void;
  setSpeakingPeerIds: (ids: Set<string>) => void;
  setCanSpeak: (can: boolean) => void;

  joinVoice: (userInitiated?: boolean) => Promise<boolean>;
  leaveVoice: () => Promise<void>;
  resumeBlockedAudio: () => Promise<void>;
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  joined: false,
  joining: false,
  openMicMuted: false,
  pttMode: false,
  pttPressed: false,
  autoplayBlocked: false,
  voiceError: null,
  speakingPeerIds: new Set<string>(),
  canSpeak: true,
  provider: null,

  setProvider: (provider) => set({ provider }),
  setJoined: (joined) => set({ joined }),
  setJoining: (joining) => set({ joining }),
  setOpenMicMuted: (openMicMuted) => {
    const { provider, pttMode, pttPressed } = get();
    const effectiveMuted = pttMode ? !pttPressed : openMicMuted;
    provider?.setMicMuted(effectiveMuted);
    set({ openMicMuted });
  },
  toggleMute: () => {
    const { openMicMuted, provider, pttMode, pttPressed } = get();
    const next = !openMicMuted;
    soundEngine.playUiToggle();
    const effectiveMuted = pttMode ? !pttPressed : next;
    provider?.setMicMuted(effectiveMuted);
    set({ openMicMuted: next });
  },
  setPttMode: (pttMode) => {
    soundEngine.playUiToggle();
    const { provider, pttPressed, openMicMuted } = get();
    const effectiveMuted = pttMode ? !pttPressed : openMicMuted;
    provider?.setMicMuted(effectiveMuted);
    set({ pttMode });
  },
  setPttPressed: (pttPressed) => {
    const { provider, pttMode, openMicMuted, canSpeak } = get();
    if (!canSpeak) return;
    const effectiveMuted = pttMode ? !pttPressed : openMicMuted;
    provider?.setMicMuted(effectiveMuted);
    set({ pttPressed });
  },
  setAutoplayBlocked: (autoplayBlocked) => set({ autoplayBlocked }),
  setVoiceError: (voiceError) => set({ voiceError }),
  setSpeakingPeerIds: (speakingPeerIds) => set({ speakingPeerIds }),
  setCanSpeak: (canSpeak) => set({ canSpeak }),

  joinVoice: async (userInitiated = true) => {
    const { provider, joining, pttMode, pttPressed, openMicMuted } = get();
    const room = useGameStore.getState().room;
    const voiceState = useGameStore.getState().voiceState;
    const setVoiceJoined = useGameStore.getState().setVoiceJoined;

    if (!room || !provider || joining) return false;
    if (userInitiated) {
      soundEngine.playUiConfirm();
    }
    set({ joining: true, voiceError: null });

    try {
      const iceServers = await fetchIceServers();
      const peerIds = room.players
        .filter((p) => p.id !== room.myPlayerId && p.connected && p.voiceJoined)
        .map((p) => p.id);

      await provider.connect({
        myPlayerId: room.myPlayerId,
        peerIds,
        iceServers,
        initialVoiceState: voiceState,
      });

      const effectiveMuted = pttMode ? !pttPressed : openMicMuted;
      provider.setMicMuted(effectiveMuted);
      await setVoiceJoined(true);
      set({ joined: true });

      try {
        localStorage.setItem(VOICE_AUTOJOIN_KEY, '1');
      } catch {
      }
      return true;
    } catch (err) {
      set({ joined: false, voiceError: err instanceof Error ? err.message : 'Voice connection failed' });
      if (userInitiated) {
        soundEngine.playUiError();
      }
      return false;
    } finally {
      set({ joining: false });
    }
  },

  leaveVoice: async () => {
    const { provider } = get();
    soundEngine.playUiBack();
    provider?.disconnect();
    set({ joined: false });
    try {
      localStorage.removeItem(VOICE_AUTOJOIN_KEY);
    } catch {
    }
    await useGameStore.getState().setVoiceJoined(false);
  },

  resumeBlockedAudio: async () => {
    const { provider } = get();
    await provider?.resumeBlockedAudio();
    set({ autoplayBlocked: false });
  },
}));

