import { SFX_ASSETS, type SfxAssetEntry, type SfxId } from './sfxManifest';

export type { SfxId };
export type AmbientMode = 'none' | 'home' | 'lobby' | 'night' | 'day';

export interface PlaySfxOptions {
  gain?: number;
  rate?: number;
  rateJitter?: number;
  cooldownMs?: number;
  ignoreCooldown?: boolean;
}

interface QueuedSfx {
  id: SfxId;
  opts?: PlaySfxOptions;
  queuedAt: number;
}

interface ActiveAmbientChannel {
  mode: AmbientMode;
  isSample: boolean;
  gainNode: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
}

const DEFAULT_COOLDOWN_MS: Partial<Record<SfxId, number>> = {
  uiHover: 20,
  uiShift: 30,
  uiClick: 25,
  uiToggle: 35,
  uiTab: 40,
  cardHover: 30,
  cardSelect: 45,
  footstep: 220,
  timerTick: 220,
  chatReceive: 160,
  chatSend: 80,
};

const PASSIVE_CUES = new Set<SfxId>(['uiHover', 'uiShift', 'cardHover']);

const DEFAULT_RATE_JITTER: Partial<Record<SfxId, number>> = {
  uiHover: 0.04,
  uiShift: 0.035,
  uiClick: 0.04,
  uiToggle: 0.03,
  uiTab: 0.025,
  cardHover: 0.05,
  cardSelect: 0.04,
  cardFlip: 0.04,
  chipClink: 0.06,
  footstep: 0.08,
  gunshot: 0.03,
  gavel: 0.02,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function ambientModeToSfxId(mode: AmbientMode): SfxId | null {
  switch (mode) {
    case 'home':
    case 'lobby':
      return 'ambientHome';
    case 'night':
      return 'ambientNight';
    case 'day':
      return 'ambientDay';
    default:
      return null;
  }
}

class MidnightSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;

  private muted = false;
  private volume = 0.7;

  private desiredAmbient: AmbientMode = 'none';
  private activeAmbientMode: AmbientMode = 'none';
  private activeAmbientChannel: ActiveAmbientChannel | null = null;

  private rawBuffers = new Map<string, ArrayBuffer>();
  private decodedBuffers = new Map<string, AudioBuffer>();
  private failedUrls = new Set<string>();
  private fetchPromises = new Map<string, Promise<ArrayBuffer | null>>();
  private decodingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private preloadPromise: Promise<void> | null = null;

  private pendingSfxQueue: QueuedSfx[] = [];
  private lastPlayedAt = new Map<SfxId, number>();
  private lastVariantIdx = new Map<SfxId, number>();

  private resumePromise: Promise<void> | null = null;
  private resumeAttemptAt = -Infinity;
  private iosUnlocked = false;
  private listenersAttached = false;
  private isFlushingQueue = false;

  private whiteNoiseBuf: AudioBuffer | null = null;
  private pinkNoiseBuf: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;

      const ctx = new Ctx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(18, ctx.currentTime);
      compressor.ratio.setValueAtTime(6, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.16, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ctx.currentTime);

      const sfxBus = ctx.createGain();
      sfxBus.gain.setValueAtTime(1, ctx.currentTime);

      const ambientBus = ctx.createGain();
      ambientBus.gain.setValueAtTime(1, ctx.currentTime);

      sfxBus.connect(compressor);
      ambientBus.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.sfxBus = sfxBus;
      this.ambientBus = ambientBus;

      ctx.addEventListener('statechange', () => {
        if (this.ctx && this.ctx.state === 'running') {
          this.onContextRunning();
        }
      });

      if (this.rawBuffers.size > 0) {
        void this.decodeAllPending();
      }
    }

    if (!this.listenersAttached && typeof document !== 'undefined') {
      this.listenersAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.ctx) {
          const state = this.ctx.state as string;
          if (state === 'suspended' || state === 'interrupted') {
            void this.unlock(false);
          }
        }
      });
    }

    return this.ctx;
  }

  private playSilentUnlockPulse(ctx: AudioContext): void {
    if (this.iosUnlocked) return;
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'running') {
        this.iosUnlocked = true;
      }
    } catch {
      // Ignore if context forbids source creation before resume
    }
  }

  private onContextRunning(): void {
    this.iosUnlocked = true;
    void this.decodeAllPending();
    void this.flushPendingQueue();
    if (
      this.desiredAmbient !== this.activeAmbientMode ||
      (this.desiredAmbient !== 'none' && this.activeAmbientChannel === null)
    ) {
      this.applyAmbient(this.desiredAmbient);
    }
  }

  unlock(isUserGesture = true): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve();

    if (ctx.state === 'running') {
      this.onContextRunning();
      return Promise.resolve();
    }

    if (!isUserGesture) {
      return Promise.resolve();
    }

    this.playSilentUnlockPulse(ctx);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // Always re-issue ctx.resume() inside a fresh user gesture if a prior
    // resume promise stalled or occurred more than 15ms ago.
    if (!this.resumePromise || now - this.resumeAttemptAt > 15) {
      this.resumeAttemptAt = now;
      const promise = ctx
        .resume()
        .then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            this.onContextRunning();
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (this.resumePromise === promise) {
            this.resumePromise = null;
          }
        });
      this.resumePromise = promise;
    }

    return this.resumePromise;
  }

  preloadAll(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      return Promise.resolve();
    }

    const urls = new Set<string>();
    const assets = SFX_ASSETS as Partial<Record<SfxId, SfxAssetEntry>>;
    for (const key of Object.keys(assets) as SfxId[]) {
      const entry = assets[key];
      if (!entry) continue;
      for (const file of entry.files) {
        if (file) urls.add(file);
      }
    }

    const urlList = Array.from(urls);
    const BATCH_SIZE = 6;

    this.preloadPromise = (async () => {
      for (let i = 0; i < urlList.length; i += BATCH_SIZE) {
        const batch = urlList.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map((url) => this.fetchRawBuffer(url)));
      }
      if (this.ctx) {
        void this.decodeAllPending();
      }
    })();

    return this.preloadPromise;
  }

  private fetchRawBuffer(url: string): Promise<ArrayBuffer | null> {
    if (this.failedUrls.has(url)) return Promise.resolve(null);
    const existing = this.rawBuffers.get(url);
    if (existing) return Promise.resolve(existing);
    const inFlight = this.fetchPromises.get(url);
    if (inFlight) return inFlight;

    const promise = fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          this.failedUrls.add(url);
          return null;
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0) {
          this.failedUrls.add(url);
          return null;
        }
        this.rawBuffers.set(url, buf);
        return buf;
      })
      .catch(() => {
        this.failedUrls.add(url);
        return null;
      })
      .finally(() => {
        this.fetchPromises.delete(url);
      });

    this.fetchPromises.set(url, promise);
    return promise;
  }

  private async decodeUrl(url: string): Promise<AudioBuffer | null> {
    if (this.failedUrls.has(url)) return null;
    const decoded = this.decodedBuffers.get(url);
    if (decoded) return decoded;
    const inFlight = this.decodingPromises.get(url);
    if (inFlight) return inFlight;

    const ctx = this.ctx;
    if (!ctx) return null;

    const promise = (async () => {
      const raw = this.rawBuffers.get(url) ?? (await this.fetchRawBuffer(url));
      if (!raw || !this.ctx) return null;

      try {
        const audioBuf = await this.ctx.decodeAudioData(raw.slice(0));
        this.decodedBuffers.set(url, audioBuf);
        this.maybeUpgradeAmbientToSample(url);
        return audioBuf;
      } catch {
        // Only permanently mark failed if context is running; some browsers
        // restrict decodeAudioData before the first user gesture.
        if (this.ctx?.state === 'running') {
          this.failedUrls.add(url);
        }
        return null;
      } finally {
        this.decodingPromises.delete(url);
      }
    })();

    this.decodingPromises.set(url, promise);
    return promise;
  }

  private async decodeAllPending(): Promise<void> {
    if (!this.ctx) return;
    const urls = Array.from(this.rawBuffers.keys())
      .filter((u) => !this.decodedBuffers.has(u) && !this.failedUrls.has(u))
      .sort((a, b) => {
        const aAmb = a.includes('ambient-') ? 1 : 0;
        const bAmb = b.includes('ambient-') ? 1 : 0;
        return aAmb - bAmb;
      });
    const BATCH_SIZE = 4;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (!this.ctx) break;
      const batch = urls.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map((u) => this.decodeUrl(u)));
    }
  }

  private maybeUpgradeAmbientToSample(decodedUrl: string): void {
    const channel = this.activeAmbientChannel;
    if (!channel || channel.isSample) return;
    const ambId = ambientModeToSfxId(channel.mode);
    if (!ambId) return;
    const entry = this.getAssetEntry(ambId);
    if (entry?.files.includes(decodedUrl) && this.desiredAmbient === channel.mode) {
      this.applyAmbient(channel.mode, true);
    }
  }

  private getAssetEntry(id: SfxId): SfxAssetEntry | undefined {
    return (SFX_ASSETS as Partial<Record<SfxId, SfxAssetEntry>>)[id];
  }

  setPrefs(muted: boolean, volume: number): void {
    this.muted = muted;
    this.volume = clamp(volume, 0, 1);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.03
      );
    }
    if (this.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech synthesis errors
      }
    }
  }

  setAmbient(mode: AmbientMode): void {
    this.desiredAmbient = mode;

    if (mode === 'none') {
      if (this.activeAmbientChannel) {
        this.fadeOutAmbientChannel(this.activeAmbientChannel, 0.85);
        this.activeAmbientChannel = null;
      }
      this.activeAmbientMode = 'none';
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state !== 'running') {
      // Will start automatically once unlock() resolves
      return;
    }

    this.applyAmbient(mode);
  }

  private fadeOutAmbientChannel(channel: ActiveAmbientChannel, fadeSeconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      channel.gainNode.gain.cancelScheduledValues(now);
      channel.gainNode.gain.setValueAtTime(Math.max(0.0001, channel.gainNode.gain.value), now);
      channel.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    } catch {
      // Ignore audio param errors
    }

    const cleanupDelayMs = Math.ceil((fadeSeconds + 0.12) * 1000);
    window.setTimeout(() => {
      for (const src of channel.sources) {
        try {
          src.stop();
        } catch {
          // Ignore already stopped sources
        }
      }
      for (const node of channel.nodes) {
        try {
          node.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    }, cleanupDelayMs);
  }

  private applyAmbient(mode: AmbientMode, forceUpgrade = false): void {
    const ctx = this.ctx;
    const ambientBus = this.ambientBus;
    if (!ctx || !ambientBus || ctx.state !== 'running') return;

    if (
      !forceUpgrade &&
      mode === this.activeAmbientMode &&
      (mode === 'none' || this.activeAmbientChannel !== null)
    ) {
      return;
    }

    if (this.activeAmbientChannel) {
      this.fadeOutAmbientChannel(this.activeAmbientChannel, 0.9);
      this.activeAmbientChannel = null;
    }

    this.activeAmbientMode = mode;
    if (mode === 'none') return;

    const ambSfxId = ambientModeToSfxId(mode);
    const entry = ambSfxId ? this.getAssetEntry(ambSfxId) : undefined;
    const sampleUrl = entry?.files.find((f) => this.decodedBuffers.has(f));
    const decodedBuf = sampleUrl ? this.decodedBuffers.get(sampleUrl) : undefined;

    const now = ctx.currentTime;
    const channelGain = ctx.createGain();
    channelGain.gain.setValueAtTime(0.0001, now);
    channelGain.connect(ambientBus);

    const nodes: AudioNode[] = [channelGain];
    const sources: AudioScheduledSourceNode[] = [];

    if (decodedBuf) {
      const src = ctx.createBufferSource();
      src.buffer = decodedBuf;
      src.loop = entry?.loop ?? true;

      const baseTarget = clamp((entry?.gain ?? 0.24) * (mode === 'lobby' ? 0.78 : 1.0), 0.02, 0.5);
      if (mode === 'lobby') {
        const warmth = ctx.createBiquadFilter();
        warmth.type = 'lowpass';
        warmth.frequency.setValueAtTime(2200, now);
        src.connect(warmth);
        warmth.connect(channelGain);
        nodes.push(warmth);
      } else {
        src.connect(channelGain);
      }

      channelGain.gain.exponentialRampToValueAtTime(baseTarget, now + 1.25);
      src.start(now);
      sources.push(src);
      nodes.push(src);

      this.activeAmbientChannel = {
        mode,
        isSample: true,
        gainNode: channelGain,
        nodes,
        sources,
      };
      return;
    }

    // Kick off decoding in background so we can upgrade once ready
    if (ambSfxId && entry?.files.length) {
      const candidate = entry.files[0];
      if (candidate && !this.failedUrls.has(candidate)) {
        void this.decodeUrl(candidate);
      }
    }

    this.buildProceduralAmbient(ctx, mode, channelGain, nodes, sources);
    channelGain.gain.exponentialRampToValueAtTime(0.085, now + 1.3);

    this.activeAmbientChannel = {
      mode,
      isSample: false,
      gainNode: channelGain,
      nodes,
      sources,
    };
  }

  private buildProceduralAmbient(
    ctx: AudioContext,
    mode: Exclude<AmbientMode, 'none'>,
    dest: GainNode,
    nodes: AudioNode[],
    sources: AudioScheduledSourceNode[]
  ): void {
    const now = ctx.currentTime;
    const pink = this.getPinkNoiseBuffer(ctx);

    const noise = ctx.createBufferSource();
    noise.buffer = pink;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    if (mode === 'night') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(680, now);
      filter.Q.setValueAtTime(0.85, now);
      noiseGain.gain.setValueAtTime(0.42, now);
    } else if (mode === 'home' || mode === 'lobby') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(mode === 'lobby' ? 520 : 420, now);
      filter.Q.setValueAtTime(0.6, now);
      noiseGain.gain.setValueAtTime(mode === 'lobby' ? 0.34 : 0.28, now);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(460, now);
      filter.Q.setValueAtTime(0.5, now);
      noiseGain.gain.setValueAtTime(0.24, now);
    }

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);
    sources.push(noise);
    nodes.push(noise, filter, noiseGain);

    // Warm subtle room drone + harmonic fifth
    const rootFreq = mode === 'night' ? 55 : mode === 'home' ? 73.42 : mode === 'lobby' ? 82.41 : 110;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(rootFreq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(rootFreq * 1.5, now);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(220, now);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(mode === 'night' ? 0.22 : 0.14, now);

    // Subtle slow LFO breathing on ambient noise filter
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(mode === 'night' ? 0.11 : 0.16, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(mode === 'night' ? 140 : 85, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    sources.push(osc1, osc2, lfo);
    nodes.push(osc1, osc2, lfo, lfoGain, droneFilter, droneGain);
  }

  private async flushPendingQueue(): Promise<void> {
    if (this.isFlushingQueue || this.pendingSfxQueue.length === 0) return;
    this.isFlushingQueue = true;

    try {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const queue = this.pendingSfxQueue.splice(0, this.pendingSfxQueue.length);
      const hasActionCue = queue.some(
        (item) => !PASSIVE_CUES.has(item.id) && now - item.queuedAt <= 1500
      );

      const seenInBatch = new Set<SfxId>();
      const toPlay: QueuedSfx[] = [];
      for (const item of queue) {
        const age = now - item.queuedAt;
        if (age > 1500) continue;
        if (PASSIVE_CUES.has(item.id) && (hasActionCue || age > 350)) continue;
        if (seenInBatch.has(item.id)) continue;
        seenInBatch.add(item.id);
        toPlay.push(item);
      }

      for (const item of toPlay) {
        if (!this.ctx || this.ctx.state !== 'running') break;

        const entry = this.getAssetEntry(item.id);
        const files = entry?.files ?? [];
        const hasDecoded = files.some((f) => this.decodedBuffers.has(f));
        if (!hasDecoded && files.length > 0) {
          const preloaded = files.find((f) => this.rawBuffers.has(f) && !this.failedUrls.has(f));
          if (preloaded) {
            await Promise.race([
              this.decodeUrl(preloaded),
              new Promise<null>((resolve) => {
                if (typeof window !== 'undefined') {
                  window.setTimeout(() => resolve(null), 35);
                } else {
                  setTimeout(() => resolve(null), 35);
                }
              }),
            ]);
          }
        }

        if (!this.ctx || this.ctx.state !== 'running') break;
        this.playSfx(item.id, { ...item.opts, ignoreCooldown: true });
      }
    } finally {
      this.isFlushingQueue = false;
      if (this.pendingSfxQueue.length > 0 && this.ctx?.state === 'running') {
        void this.flushPendingQueue();
      }
    }
  }

  private queuePendingSfx(id: SfxId, opts?: PlaySfxOptions): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (PASSIVE_CUES.has(id)) {
      const existingIdx = this.pendingSfxQueue.findIndex((item) => item.id === id);
      if (existingIdx !== -1) {
        this.pendingSfxQueue[existingIdx] = { id, opts, queuedAt: now };
        return;
      }
    } else {
      // Preserve action cues; only coalesce duplicate calls from the exact same event tick
      const existingIdx = this.pendingSfxQueue.findIndex(
        (item) => item.id === id && now - item.queuedAt < 12
      );
      if (existingIdx !== -1) {
        const prev = this.pendingSfxQueue[existingIdx];
        if (prev) {
          this.pendingSfxQueue[existingIdx] = {
            id,
            opts: prev.opts || opts ? { ...prev.opts, ...opts } : undefined,
            queuedAt: now,
          };
        }
        return;
      }
    }

    if (this.pendingSfxQueue.length >= 8) {
      const passiveIdx = this.pendingSfxQueue.findIndex((item) => PASSIVE_CUES.has(item.id));
      if (passiveIdx !== -1) {
        this.pendingSfxQueue.splice(passiveIdx, 1);
      } else {
        this.pendingSfxQueue.shift();
      }
    }
    this.pendingSfxQueue.push({ id, opts, queuedAt: now });
  }

  playSfx(id: SfxId, opts?: PlaySfxOptions): void {
    if (this.muted) return;

    const entry = this.getAssetEntry(id);
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    if (ctx.state !== 'running') {
      this.queuePendingSfx(id, opts);
      if (!PASSIVE_CUES.has(id)) {
        void this.unlock(true);
      }
      return;
    }

    const cooldown =
      opts?.ignoreCooldown
        ? 0
        : (opts?.cooldownMs ?? entry?.cooldownMs ?? DEFAULT_COOLDOWN_MS[id] ?? 0);

    if (cooldown > 0) {
      const prev = this.lastPlayedAt.get(id) ?? -Infinity;
      if (nowMs - prev < cooldown) {
        return;
      }
    }

    this.lastPlayedAt.set(id, nowMs);

    const files = entry?.files ?? [];
    let selectedUrl: string | undefined;
    if (files.length === 1) {
      selectedUrl = files[0];
    } else if (files.length > 1) {
      const prevIdx = this.lastVariantIdx.get(id) ?? -1;
      let idx = Math.floor(Math.random() * files.length);
      if (idx === prevIdx) {
        idx = (idx + 1) % files.length;
      }
      const candidate = files[idx];
      if (candidate && !this.decodedBuffers.has(candidate)) {
        const decodedIdx = files.findIndex(
          (f, i) => i !== prevIdx && this.decodedBuffers.has(f)
        );
        const fallbackDecodedIdx =
          decodedIdx !== -1 ? decodedIdx : files.findIndex((f) => this.decodedBuffers.has(f));
        if (fallbackDecodedIdx !== -1) {
          idx = fallbackDecodedIdx;
        }
      }
      this.lastVariantIdx.set(id, idx);
      selectedUrl = files[idx];
    }

    const gainScale = clamp((entry?.gain ?? 1) * (opts?.gain ?? 1), 0.01, 2.0);
    const jitter = opts?.rateJitter ?? entry?.rateJitter ?? DEFAULT_RATE_JITTER[id] ?? 0;
    const baseRate = opts?.rate ?? 1;
    const playbackRate = clamp(
      baseRate * (jitter > 0 ? 1 + (Math.random() * 2 - 1) * jitter : 1),
      0.5,
      2.0
    );

    const decoded = selectedUrl ? this.decodedBuffers.get(selectedUrl) : undefined;
    if (decoded) {
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainScale, ctx.currentTime);

      src.connect(gain);
      gain.connect(this.sfxBus);
      src.start(ctx.currentTime);
      return;
    }

    // Lazily fetch & decode in background for next play while firing procedural synth now
    if (selectedUrl && !this.failedUrls.has(selectedUrl)) {
      void this.decodeUrl(selectedUrl);
    }

    this.playProceduralFallback(ctx, this.sfxBus, id, gainScale, playbackRate);
  }

  private getWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.whiteNoiseBuf && this.whiteNoiseBuf.sampleRate === ctx.sampleRate) {
      return this.whiteNoiseBuf;
    }
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      ch[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuf = buf;
    return buf;
  }

  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuf && this.pinkNoiseBuf.sampleRate === ctx.sampleRate) {
      return this.pinkNoiseBuf;
    }
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      ch[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.pinkNoiseBuf = buf;
    return buf;
  }

  private playFilteredNoise(
    ctx: AudioContext,
    dest: AudioNode,
    options: {
      startTime: number;
      duration: number;
      filterType: BiquadFilterType;
      freqStart: number;
      freqEnd?: number;
      q?: number;
      gainPeak: number;
      attack?: number;
      pink?: boolean;
    }
  ): void {
    const {
      startTime,
      duration,
      filterType,
      freqStart,
      freqEnd,
      q = 1,
      gainPeak,
      attack = 0.004,
      pink = false,
    } = options;
    const buf = pink ? this.getPinkNoiseBuffer(ctx) : this.getWhiteNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const maxOffset = Math.max(0, buf.duration - duration - 0.05);
    const offset = Math.random() * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(clamp(freqStart, 40, 16000), startTime);
    if (freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(clamp(freqEnd, 40, 16000), startTime + duration);
    }
    filter.Q.setValueAtTime(q, startTime);

    const safeAttack = Math.min(attack, duration * 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, gainPeak), startTime + safeAttack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(startTime, offset, duration + 0.02);
  }

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    options: {
      type: OscillatorType;
      freqStart: number;
      freqEnd?: number;
      startTime: number;
      duration: number;
      gainPeak: number;
      attack?: number;
      filterFreq?: number;
    }
  ): void {
    const {
      type,
      freqStart,
      freqEnd,
      startTime,
      duration,
      gainPeak,
      attack = 0.006,
      filterFreq,
    } = options;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(clamp(freqStart, 20, 18000), startTime);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(clamp(freqEnd, 20, 18000), startTime + duration);
    }

    const safeAttack = Math.min(attack, duration * 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, gainPeak), startTime + safeAttack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playProceduralFallback(
    ctx: AudioContext,
    dest: AudioNode,
    id: SfxId,
    gainScale: number,
    rate: number
  ): void {
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(gainScale, now);
    out.connect(dest);

    switch (id) {
      case 'uiHover': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.055,
          filterType: 'bandpass',
          freqStart: 2400 * rate,
          freqEnd: 1350 * rate,
          q: 1.6,
          gainPeak: 0.28,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 420 * rate,
          freqEnd: 210 * rate,
          startTime: now,
          duration: 0.06,
          gainPeak: 0.22,
          attack: 0.002,
        });
        break;
      }

      case 'uiShift': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.05,
          filterType: 'bandpass',
          freqStart: 2700 * rate,
          freqEnd: 1550 * rate,
          q: 2.0,
          gainPeak: 0.3,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 300 * rate,
          freqEnd: 145 * rate,
          startTime: now,
          duration: 0.068,
          gainPeak: 0.26,
          attack: 0.002,
        });
        break;
      }

      case 'uiClick': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.045,
          filterType: 'bandpass',
          freqStart: 3000 * rate,
          freqEnd: 1200 * rate,
          q: 1.8,
          gainPeak: 0.42,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 240 * rate,
          freqEnd: 82 * rate,
          startTime: now,
          duration: 0.085,
          gainPeak: 0.44,
          attack: 0.001,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 740 * rate,
          freqEnd: 680 * rate,
          startTime: now + 0.006,
          duration: 0.075,
          gainPeak: 0.16,
          attack: 0.002,
        });
        break;
      }

      case 'uiConfirm': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.04,
          filterType: 'bandpass',
          freqStart: 2600 * rate,
          freqEnd: 1100 * rate,
          q: 1.7,
          gainPeak: 0.34,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 205 * rate,
          freqEnd: 78 * rate,
          startTime: now,
          duration: 0.12,
          gainPeak: 0.46,
          attack: 0.002,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 523.25 * rate,
          startTime: now,
          duration: 0.2,
          gainPeak: 0.3,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 783.99 * rate,
          startTime: now + 0.032,
          duration: 0.22,
          gainPeak: 0.26,
        });
        break;
      }

      case 'uiBack': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.075,
          filterType: 'lowpass',
          freqStart: 1500 * rate,
          freqEnd: 420 * rate,
          gainPeak: 0.24,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 340 * rate,
          freqEnd: 135 * rate,
          startTime: now,
          duration: 0.13,
          gainPeak: 0.38,
          filterFreq: 1300,
        });
        break;
      }

      case 'uiToggle': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.032,
          filterType: 'highpass',
          freqStart: 1900 * rate,
          gainPeak: 0.36,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 280 * rate,
          freqEnd: 110 * rate,
          startTime: now,
          duration: 0.065,
          gainPeak: 0.34,
          attack: 0.002,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 420 * rate,
          freqEnd: 620 * rate,
          startTime: now,
          duration: 0.085,
          gainPeak: 0.28,
          attack: 0.002,
        });
        break;
      }

      case 'uiTab': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.095,
          filterType: 'bandpass',
          freqStart: 1200 * rate,
          freqEnd: 2450 * rate,
          q: 1.4,
          gainPeak: 0.36,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 250 * rate,
          freqEnd: 125 * rate,
          startTime: now,
          duration: 0.085,
          gainPeak: 0.32,
          attack: 0.002,
        });
        break;
      }

      case 'uiModalOpen': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.18,
          filterType: 'bandpass',
          freqStart: 500 * rate,
          freqEnd: 1700 * rate,
          q: 1.1,
          gainPeak: 0.28,
          attack: 0.015,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 261.63 * rate,
          startTime: now,
          duration: 0.24,
          gainPeak: 0.28,
          attack: 0.012,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 392 * rate,
          startTime: now + 0.028,
          duration: 0.24,
          gainPeak: 0.22,
          attack: 0.012,
          filterFreq: 1400,
        });
        break;
      }

      case 'uiModalClose': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.14,
          filterType: 'bandpass',
          freqStart: 1500 * rate,
          freqEnd: 380 * rate,
          q: 1.2,
          gainPeak: 0.28,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 240 * rate,
          freqEnd: 95 * rate,
          startTime: now + 0.015,
          duration: 0.15,
          gainPeak: 0.34,
          filterFreq: 1000,
        });
        break;
      }

      case 'uiError': {
        [0, 0.105].forEach((offset, i) => {
          const t = now + offset;
          const base = (i === 0 ? 165 : 138) * rate;
          this.playTone(ctx, out, {
            type: 'triangle',
            freqStart: base,
            freqEnd: base * 0.72,
            startTime: t,
            duration: 0.12,
            gainPeak: 0.42,
            filterFreq: 750,
          });
          this.playTone(ctx, out, {
            type: 'sine',
            freqStart: base * 1.414,
            freqEnd: base * 1.15,
            startTime: t,
            duration: 0.11,
            gainPeak: 0.2,
          });
        });
        break;
      }

      case 'cardHover': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.07,
          filterType: 'bandpass',
          freqStart: 2900 * rate,
          freqEnd: 1700 * rate,
          q: 1.4,
          gainPeak: 0.32,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 290 * rate,
          freqEnd: 150 * rate,
          startTime: now,
          duration: 0.055,
          gainPeak: 0.18,
          attack: 0.002,
        });
        break;
      }

      case 'cardSelect': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.07,
          filterType: 'highpass',
          freqStart: 1500 * rate,
          gainPeak: 0.4,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 188 * rate,
          freqEnd: 64 * rate,
          startTime: now,
          duration: 0.11,
          gainPeak: 0.46,
          attack: 0.002,
        });
        break;
      }

      case 'cardFlip': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.14,
          filterType: 'bandpass',
          freqStart: 1400 * rate,
          freqEnd: 3400 * rate,
          q: 1.3,
          gainPeak: 0.36,
          attack: 0.01,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 210 * rate,
          freqEnd: 88 * rate,
          startTime: now + 0.04,
          duration: 0.1,
          gainPeak: 0.32,
          attack: 0.003,
        });
        break;
      }

      case 'cardShuffle': {
        for (let i = 0; i < 6; i += 1) {
          const t = now + i * 0.045;
          this.playFilteredNoise(ctx, out, {
            startTime: t,
            duration: 0.042,
            filterType: 'bandpass',
            freqStart: (1800 + i * 240) * rate,
            freqEnd: (1100 + i * 160) * rate,
            q: 1.8,
            gainPeak: 0.24,
            attack: 0.003,
          });
        }
        break;
      }

      case 'chipClink': {
        const partials = [2280, 3690, 5040];
        [0, 0.052].forEach((offset, hitIdx) => {
          const t = now + offset;
          const level = hitIdx === 0 ? 0.34 : 0.24;
          partials.forEach((f, idx) => {
            this.playTone(ctx, out, {
              type: 'sine',
              freqStart: f * rate * (hitIdx === 1 ? 1.04 : 1),
              startTime: t,
              duration: 0.1 - idx * 0.015,
              gainPeak: level / (idx + 1),
              attack: 0.001,
            });
          });
        });
        break;
      }

      case 'doorCreak': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.55,
          filterType: 'bandpass',
          freqStart: 500,
          freqEnd: 780,
          q: 4.5,
          gainPeak: 0.08,
          attack: 0.06,
          pink: true,
        });
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(215 * rate, now);
        osc.frequency.linearRampToValueAtTime(155 * rate, now + 0.26);
        osc.frequency.linearRampToValueAtTime(275 * rate, now + 0.54);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(580, now);
        filter.Q.setValueAtTime(5.5, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.62);
        break;
      }

      case 'rooster': {
        const segments = [
          { f1: 660, f2: 780, start: 0, dur: 0.12 },
          { f1: 780, f2: 980, start: 0.14, dur: 0.14 },
          { f1: 980, f2: 1120, start: 0.3, dur: 0.14 },
          { f1: 1100, f2: 740, start: 0.46, dur: 0.44 },
        ];
        for (const seg of segments) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(seg.f1 * rate, now + seg.start);
          osc.frequency.linearRampToValueAtTime(seg.f2 * rate, now + seg.start + seg.dur);

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1350, now + seg.start);
          filter.Q.setValueAtTime(2.6, now + seg.start);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, now + seg.start);
          g.gain.linearRampToValueAtTime(0.14, now + seg.start + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, now + seg.start + seg.dur);

          osc.connect(filter);
          filter.connect(g);
          g.connect(out);
          osc.start(now + seg.start);
          osc.stop(now + seg.start + seg.dur + 0.02);
        }
        break;
      }

      case 'gunshot': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.44,
          filterType: 'lowpass',
          freqStart: 3200 * rate,
          freqEnd: 140,
          q: 0.8,
          gainPeak: 0.62,
          attack: 0.002,
        });
        this.playTone(ctx, out, {
          type: 'triangle',
          freqStart: 185 * rate,
          freqEnd: 36,
          startTime: now,
          duration: 0.18,
          gainPeak: 0.52,
          attack: 0.002,
        });
        break;
      }

      case 'healChime': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.075;
          this.playTone(ctx, out, {
            type: 'sine',
            freqStart: freq * rate,
            startTime: t,
            duration: 0.8,
            gainPeak: 0.15,
            attack: 0.025,
          });
          this.playTone(ctx, out, {
            type: 'triangle',
            freqStart: freq * 2 * rate,
            startTime: t,
            duration: 0.45,
            gainPeak: 0.035,
            attack: 0.02,
          });
        });
        break;
      }

      case 'investigate': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.04,
          filterType: 'bandpass',
          freqStart: 2400,
          q: 2.0,
          gainPeak: 0.12,
        });
        const chord = [293.66, 349.23, 440, 523.25];
        chord.forEach((freq, idx) => {
          this.playTone(ctx, out, {
            type: idx === 0 ? 'triangle' : 'sine',
            freqStart: freq * rate,
            startTime: now + idx * 0.045,
            duration: 0.55,
            gainPeak: 0.1,
            attack: 0.015,
          });
        });
        break;
      }

      case 'gavel': {
        [0, 0.19].forEach((offset) => {
          const t = now + offset;
          this.playFilteredNoise(ctx, out, {
            startTime: t,
            duration: 0.045,
            filterType: 'bandpass',
            freqStart: 950 * rate,
            freqEnd: 350,
            q: 2.2,
            gainPeak: 0.24,
            attack: 0.002,
          });
          this.playTone(ctx, out, {
            type: 'triangle',
            freqStart: 250 * rate,
            freqEnd: 78,
            startTime: t,
            duration: 0.14,
            gainPeak: 0.42,
            attack: 0.002,
          });
        });
        break;
      }

      case 'timerTick': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.022,
          filterType: 'bandpass',
          freqStart: 3600 * rate,
          q: 3.5,
          gainPeak: 0.13,
          attack: 0.001,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 1420 * rate,
          freqEnd: 880 * rate,
          startTime: now,
          duration: 0.032,
          gainPeak: 0.09,
          attack: 0.001,
        });
        break;
      }

      case 'countdownGo': {
        [196, 293.66, 392, 587.33].forEach((freq, idx) => {
          this.playTone(ctx, out, {
            type: idx < 2 ? 'triangle' : 'sine',
            freqStart: freq * rate,
            startTime: now,
            duration: 0.72,
            gainPeak: 0.14 / (idx * 0.35 + 1),
            attack: 0.008,
            filterFreq: 2600,
          });
        });
        break;
      }

      case 'playerJoin': {
        [392, 587.33].forEach((freq, idx) => {
          this.playTone(ctx, out, {
            type: 'sine',
            freqStart: freq * rate,
            startTime: now + idx * 0.075,
            duration: 0.28,
            gainPeak: 0.12,
            attack: 0.01,
          });
        });
        break;
      }

      case 'playerLeave': {
        [329.63, 220].forEach((freq, idx) => {
          this.playTone(ctx, out, {
            type: 'sine',
            freqStart: freq * rate,
            startTime: now + idx * 0.085,
            duration: 0.26,
            gainPeak: 0.11,
            attack: 0.01,
          });
        });
        break;
      }

      case 'footstep': {
        this.playFilteredNoise(ctx, out, {
          startTime: now,
          duration: 0.055,
          filterType: 'lowpass',
          freqStart: 580 * rate,
          freqEnd: 160,
          gainPeak: 0.13,
          attack: 0.004,
          pink: true,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 105 * rate,
          freqEnd: 46,
          startTime: now,
          duration: 0.065,
          gainPeak: 0.14,
          attack: 0.003,
        });
        break;
      }

      case 'chatSend': {
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 480 * rate,
          freqEnd: 720 * rate,
          startTime: now,
          duration: 0.08,
          gainPeak: 0.1,
          attack: 0.004,
        });
        break;
      }

      case 'chatReceive': {
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 880 * rate,
          startTime: now,
          duration: 0.14,
          gainPeak: 0.085,
          attack: 0.006,
        });
        this.playTone(ctx, out, {
          type: 'sine',
          freqStart: 1318.5 * rate,
          startTime: now + 0.04,
          duration: 0.16,
          gainPeak: 0.065,
          attack: 0.006,
        });
        break;
      }

      case 'victoryCitizen': {
        const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.095;
          this.playTone(ctx, out, {
            type: 'triangle',
            freqStart: freq * rate,
            startTime: t,
            duration: idx === notes.length - 1 ? 0.9 : 0.35,
            gainPeak: 0.13,
            attack: 0.015,
            filterFreq: 3200,
          });
          this.playTone(ctx, out, {
            type: 'sine',
            freqStart: freq * 0.5 * rate,
            startTime: t,
            duration: idx === notes.length - 1 ? 0.95 : 0.35,
            gainPeak: 0.08,
            attack: 0.02,
          });
        });
        break;
      }

      case 'victoryMafia': {
        const chord = [110, 220, 261.63, 311.13, 369.99];
        chord.forEach((freq, idx) => {
          const t = now + idx * 0.11;
          this.playTone(ctx, out, {
            type: idx < 2 ? 'triangle' : 'sawtooth',
            freqStart: freq * rate,
            startTime: t,
            duration: 1.05,
            gainPeak: idx < 2 ? 0.16 : 0.075,
            attack: 0.03,
            filterFreq: 950,
          });
        });
        break;
      }

      case 'ambientHome':
      case 'ambientNight':
      case 'ambientDay':
        break;
    }
  }

  // Existing compatibility methods
  playGunshot(): void {
    this.playSfx('gunshot');
  }

  playHealChime(): void {
    this.playSfx('healChime');
  }

  playGavel(): void {
    this.playSfx('gavel');
  }

  playRooster(): void {
    this.playSfx('rooster');
  }

  playDoorCreak(): void {
    this.playSfx('doorCreak');
  }

  playCardFlip(): void {
    this.playSfx('cardFlip');
  }

  playMenuTick(): void {
    this.playSfx('uiHover');
  }

  playMenuConfirm(): void {
    this.playSfx('uiConfirm');
  }

  playMenuBack(): void {
    this.playSfx('uiBack');
  }

  // New semantic UI & game SFX methods
  playUiHover(): void {
    this.playSfx('uiHover');
  }

  playUiShift(): void {
    this.playSfx('uiShift');
  }

  playUiClick(): void {
    this.playSfx('uiClick');
  }

  playUiConfirm(): void {
    this.playSfx('uiConfirm');
  }

  playUiBack(): void {
    this.playSfx('uiBack');
  }

  playUiToggle(): void {
    this.playSfx('uiToggle');
  }

  playUiTab(): void {
    this.playSfx('uiTab');
  }

  playUiModalOpen(): void {
    this.playSfx('uiModalOpen');
  }

  playUiModalClose(): void {
    this.playSfx('uiModalClose');
  }

  playUiError(): void {
    this.playSfx('uiError');
  }

  playCardHover(): void {
    this.playSfx('cardHover');
  }

  playCardSelect(): void {
    this.playSfx('cardSelect');
  }

  playCardShuffle(): void {
    this.playSfx('cardShuffle');
  }

  playChipClink(): void {
    this.playSfx('chipClink');
  }

  playInvestigate(): void {
    this.playSfx('investigate');
  }

  playTimerTick(): void {
    this.playSfx('timerTick');
  }

  playCountdownGo(): void {
    this.playSfx('countdownGo');
  }

  playPlayerJoin(): void {
    this.playSfx('playerJoin');
  }

  playPlayerLeave(): void {
    this.playSfx('playerLeave');
  }

  playFootstep(): void {
    this.playSfx('footstep');
  }

  playChatSend(): void {
    this.playSfx('chatSend');
  }

  playChatReceive(): void {
    this.playSfx('chatReceive');
  }

  playVictoryCitizen(): void {
    this.playSfx('victoryCitizen');
  }

  playVictoryMafia(): void {
    this.playSfx('victoryMafia');
  }

  speakNarration(text: string): void {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = this.volume;
      utterance.rate = 0.96;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  }
}

export const soundEngine = new MidnightSoundEngine();
