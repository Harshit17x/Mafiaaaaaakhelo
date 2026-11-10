import type {
  IceServerConfig,
  VoiceSignalPayload,
  VoiceState,
} from '@midnight-city/shared';

export interface VoiceProviderCallbacks {
  onSignal: (toPlayerId: string, signal: VoiceSignalPayload) => void;
  onSpeakingChange: (speakingPeerIds: Set<string>) => void;
  onAutoplayBlocked: (blocked: boolean) => void;
  onError: (message: string | null) => void;
  onLocalMicActiveChange: (active: boolean) => void;
}

export interface VoiceConnectConfig {
  myPlayerId: string;
  peerIds: string[];
  iceServers: IceServerConfig[];
  initialVoiceState: VoiceState | null;
}

export interface VoiceProvider {
  connect(config: VoiceConnectConfig): Promise<void>;
  disconnect(): void;
  updatePeers(peerIds: string[]): void;
  applyVoiceState(voiceState: VoiceState | null): void;
  setMicMuted(muted: boolean): void;
  setPeerVolume(peerId: string, volume: number): void;
  setPeerLocalMuted(peerId: string, muted: boolean): void;
  resumeBlockedAudio(): Promise<void>;
  handleSignal(fromPlayerId: string, signal: VoiceSignalPayload): Promise<void>;
  subscribe(callbacks: VoiceProviderCallbacks): () => void;
}

