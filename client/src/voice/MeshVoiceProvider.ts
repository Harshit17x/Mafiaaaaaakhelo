import type {
  IceServerConfig,
  VoiceSignalPayload,
  VoiceState,
} from '@midnight-city/shared';
import type {
  VoiceConnectConfig,
  VoiceProvider,
  VoiceProviderCallbacks,
} from './VoiceProvider';

interface PeerEntry {
  peerId: string;
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  pendingIceCandidates: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
  analyser: AnalyserNode | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  stream: MediaStream | null;
}

export class MeshVoiceProvider implements VoiceProvider {
  private callbacks: VoiceProviderCallbacks | null = null;
  private myPlayerId: string | null = null;
  private iceServers: IceServerConfig[] = [];
  private localStream: MediaStream | null = null;
  private voiceState: VoiceState | null = null;
  private userMicMuted = false;

  private readonly peers = new Map<string, PeerEntry>();
  private readonly peerVolumes = new Map<string, number>();
  private readonly peerLocalMuted = new Map<string, boolean>();

  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private analyserTimer: number | null = null;
  private connected = false;

  subscribe(callbacks: VoiceProviderCallbacks): () => void {
    this.callbacks = callbacks;
    return () => {
      if (this.callbacks === callbacks) {
        this.callbacks = null;
      }
    };
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    return this.audioCtx;
  }

  private formatMicError(err: unknown): string {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return 'Microphone permission denied. Allow mic access in your browser settings and try again.';
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return 'No microphone detected on this device.';
      }
      if (err.name === 'NotReadableError') {
        return 'Microphone is currently in use by another application.';
      }
    }
    return 'Could not access microphone for voice chat.';
  }

  async connect(config: VoiceConnectConfig): Promise<void> {
    this.disconnect();
    this.myPlayerId = config.myPlayerId;
    this.iceServers = config.iceServers;
    this.voiceState = config.initialVoiceState;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC audio is unavailable in this browser context.');
      }
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      const msg = this.formatMicError(err);
      this.callbacks?.onError(msg);
      throw new Error(msg);
    }

    this.connected = true;
    this.callbacks?.onError(null);

    const ctx = this.ensureAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        this.localSource = ctx.createMediaStreamSource(this.localStream);
        this.localAnalyser = ctx.createAnalyser();
        this.localAnalyser.fftSize = 256;
        this.localSource.connect(this.localAnalyser);
      } catch {
      }
    }

    this.syncTrackEnabled();
    this.updatePeers(config.peerIds);
    this.startSpeakingMonitor();
  }

  disconnect(): void {
    this.connected = false;
    if (this.analyserTimer !== null) {
      window.clearInterval(this.analyserTimer);
      this.analyserTimer = null;
    }

    for (const peerId of Array.from(this.peers.keys())) {
      this.closePeer(peerId);
    }

    if (this.localSource) {
      try {
        this.localSource.disconnect();
      } catch {
      }
      this.localSource = null;
    }
    this.localAnalyser = null;

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.callbacks?.onSpeakingChange(new Set());
    this.callbacks?.onLocalMicActiveChange(false);
    this.callbacks?.onAutoplayBlocked(false);
  }

  updatePeers(peerIds: string[]): void {
    if (!this.connected || !this.myPlayerId) {
      return;
    }

    const desired = new Set(peerIds.filter((id) => id !== this.myPlayerId));
    for (const existingId of Array.from(this.peers.keys())) {
      if (!desired.has(existingId)) {
        this.closePeer(existingId);
      }
    }

    for (const remoteId of desired) {
      if (!this.peers.has(remoteId)) {
        void this.createPeer(remoteId, this.myPlayerId < remoteId);
      }
    }

    this.applyAllPeerAudioPolicies();
  }

  applyVoiceState(voiceState: VoiceState | null): void {
    this.voiceState = voiceState;
    this.syncTrackEnabled();
    this.applyAllPeerAudioPolicies();
  }

  setMicMuted(muted: boolean): void {
    this.userMicMuted = muted;
    this.syncTrackEnabled();
  }

  setPeerVolume(peerId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.peerVolumes.set(peerId, clamped);
    const entry = this.peers.get(peerId);
    if (entry) {
      entry.audioEl.volume = clamped;
    }
  }

  setPeerLocalMuted(peerId: string, muted: boolean): void {
    this.peerLocalMuted.set(peerId, muted);
    this.applyPeerAudioPolicy(peerId);
  }

  async resumeBlockedAudio(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
      }
    }
    let anyStillBlocked = false;
    for (const entry of this.peers.values()) {
      if (entry.stream) {
        try {
          await entry.audioEl.play();
        } catch {
          anyStillBlocked = true;
        }
      }
    }
    this.callbacks?.onAutoplayBlocked(anyStillBlocked);
  }

  private syncTrackEnabled(): void {
    const allowedByServer = this.voiceState ? this.voiceState.canSpeak : true;
    const active = this.connected && allowedByServer && !this.userMicMuted;
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = active;
      }
    }
    this.callbacks?.onLocalMicActiveChange(active);
  }

  private applyAllPeerAudioPolicies(): void {
    for (const peerId of this.peers.keys()) {
      this.applyPeerAudioPolicy(peerId);
    }
  }

  private applyPeerAudioPolicy(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    const allowedByServer = this.voiceState
      ? this.voiceState.audiblePeerIds.includes(peerId)
      : true;
    const locallyMuted = this.peerLocalMuted.get(peerId) ?? false;
    entry.audioEl.muted = !allowedByServer || locallyMuted;
    entry.audioEl.volume = this.peerVolumes.get(peerId) ?? 1;
  }

  private async createPeer(remoteId: string, initiator: boolean): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');

    const entry: PeerEntry = {
      peerId: remoteId,
      pc,
      audioEl,
      pendingIceCandidates: [],
      remoteDescriptionSet: false,
      analyser: null,
      sourceNode: null,
      stream: null,
    };
    this.peers.set(remoteId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks?.onSignal(remoteId, {
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment ?? null,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      entry.stream = stream;
      audioEl.srcObject = stream;
      this.applyPeerAudioPolicy(remoteId);
      void audioEl.play().catch(() => {
        this.callbacks?.onAutoplayBlocked(true);
      });

      const ctx = this.ensureAudioContext();
      if (ctx) {
        try {
          if (entry.sourceNode) {
            entry.sourceNode.disconnect();
          }
          entry.sourceNode = ctx.createMediaStreamSource(stream);
          entry.analyser = ctx.createAnalyser();
          entry.analyser.fftSize = 256;
          entry.sourceNode.connect(entry.analyser);
        } catch {
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (this.myPlayerId && this.myPlayerId < remoteId && this.connected) {
          void this.renegotiateOffer(remoteId);
        }
      }
    };

    if (initiator) {
      await this.renegotiateOffer(remoteId);
    }
  }

  private async renegotiateOffer(remoteId: string): Promise<void> {
    const entry = this.peers.get(remoteId);
    if (!entry) return;
    try {
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true });
      await entry.pc.setLocalDescription(offer);
      if (entry.pc.localDescription) {
        this.callbacks?.onSignal(remoteId, {
          type: 'offer',
          sdp: entry.pc.localDescription.sdp,
        });
      }
    } catch {
    }
  }

  async handleSignal(fromPlayerId: string, signal: VoiceSignalPayload): Promise<void> {
    if (!this.connected || !this.myPlayerId) {
      return;
    }

    let entry = this.peers.get(fromPlayerId);
    if (!entry) {
      await this.createPeer(fromPlayerId, false);
      entry = this.peers.get(fromPlayerId);
    }
    if (!entry) return;

    const { pc } = entry;

    if (signal.type === 'offer') {
      const offerCollision = pc.signalingState !== 'stable';
      const polite = this.myPlayerId > fromPlayerId;
      if (offerCollision && !polite) {
        return;
      }
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      entry.remoteDescriptionSet = true;
      await this.flushIceCandidates(entry);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (pc.localDescription) {
        this.callbacks?.onSignal(fromPlayerId, {
          type: 'answer',
          sdp: pc.localDescription.sdp,
        });
      }
    } else if (signal.type === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        entry.remoteDescriptionSet = true;
        await this.flushIceCandidates(entry);
      }
    } else if (signal.type === 'ice-candidate') {
      const candidateInit: RTCIceCandidateInit = {
        candidate: signal.candidate.candidate,
        sdpMid: signal.candidate.sdpMid,
        sdpMLineIndex: signal.candidate.sdpMLineIndex,
        usernameFragment: signal.candidate.usernameFragment ?? undefined,
      };
      if (entry.remoteDescriptionSet) {
        try {
          await pc.addIceCandidate(candidateInit);
        } catch {
        }
      } else {
        entry.pendingIceCandidates.push(candidateInit);
      }
    }
  }

  private async flushIceCandidates(entry: PeerEntry): Promise<void> {
    while (entry.pendingIceCandidates.length > 0) {
      const cand = entry.pendingIceCandidates.shift()!;
      try {
        await entry.pc.addIceCandidate(cand);
      } catch {
      }
    }
  }

  private closePeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    if (entry.sourceNode) {
      try {
        entry.sourceNode.disconnect();
      } catch {
      }
    }
    entry.audioEl.pause();
    entry.audioEl.srcObject = null;
    entry.pc.close();
    this.peers.delete(peerId);
  }

  private computeLevel(analyser: AnalyserNode): number {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sumSq = 0;
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i]! - 128) / 128;
      sumSq += normalized * normalized;
    }
    return Math.sqrt(sumSq / data.length);
  }

  private startSpeakingMonitor(): void {
    if (this.analyserTimer !== null) {
      window.clearInterval(this.analyserTimer);
    }
    const threshold = 0.025;
    this.analyserTimer = window.setInterval(() => {
      if (!this.connected) return;
      const speaking = new Set<string>();

      const localCanSpeak =
        (this.voiceState ? this.voiceState.canSpeak : true) && !this.userMicMuted;
      if (localCanSpeak && this.localAnalyser && this.myPlayerId) {
        if (this.computeLevel(this.localAnalyser) > threshold) {
          speaking.add(this.myPlayerId);
        }
      }

      for (const [peerId, entry] of this.peers.entries()) {
        const audible = this.voiceState
          ? this.voiceState.audiblePeerIds.includes(peerId)
          : true;
        const locallyMuted = this.peerLocalMuted.get(peerId) ?? false;
        if (audible && !locallyMuted && entry.analyser) {
          if (this.computeLevel(entry.analyser) > threshold) {
            speaking.add(peerId);
          }
        }
      }

      this.callbacks?.onSpeakingChange(speaking);
    }, 100);
  }
}

