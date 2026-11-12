export type SfxId =
  | 'uiHover'
  | 'uiShift'
  | 'uiClick'
  | 'uiConfirm'
  | 'uiBack'
  | 'uiToggle'
  | 'uiTab'
  | 'uiModalOpen'
  | 'uiModalClose'
  | 'uiError'
  | 'cardHover'
  | 'cardSelect'
  | 'cardFlip'
  | 'cardShuffle'
  | 'chipClink'
  | 'doorCreak'
  | 'rooster'
  | 'gunshot'
  | 'healChime'
  | 'investigate'
  | 'gavel'
  | 'timerTick'
  | 'countdownGo'
  | 'playerJoin'
  | 'playerLeave'
  | 'footstep'
  | 'chatSend'
  | 'chatReceive'
  | 'victoryCitizen'
  | 'victoryMafia'
  | 'ambientHome'
  | 'ambientNight'
  | 'ambientDay';

export interface SfxAssetEntry {
  files: readonly string[];
  gain?: number;
  rateJitter?: number;
  cooldownMs?: number;
  loop?: boolean;
}

/**
 * Sound effect manifest consumed by SoundEngine.
 *
 * `files` lists `/assets/sfx/<filename>` paths for sampled audio variations.
 * Currently initialized as empty arrays pending approved external CC0 sample
 * downloads; SoundEngine falls back cleanly to procedural Web Audio synthesis
 * whenever an entry has no decoded sample buffers.
 */
export const SFX_ASSETS: Record<SfxId, SfxAssetEntry> = {
  uiHover: { files: [], gain: 0.22, rateJitter: 0.06, cooldownMs: 55 },
  uiShift: { files: [], gain: 0.26, rateJitter: 0.05, cooldownMs: 45 },
  uiClick: { files: [], gain: 0.42, rateJitter: 0.04, cooldownMs: 35 },
  uiConfirm: { files: [], gain: 0.52, rateJitter: 0.02, cooldownMs: 70 },
  uiBack: { files: [], gain: 0.44, rateJitter: 0.02, cooldownMs: 70 },
  uiToggle: { files: [], gain: 0.42, rateJitter: 0.03, cooldownMs: 50 },
  uiTab: { files: [], gain: 0.40, rateJitter: 0.03, cooldownMs: 60 },
  uiModalOpen: { files: [], gain: 0.46, rateJitter: 0.02, cooldownMs: 120 },
  uiModalClose: { files: [], gain: 0.40, rateJitter: 0.02, cooldownMs: 120 },
  uiError: { files: [], gain: 0.55, rateJitter: 0.01, cooldownMs: 160 },
  cardHover: { files: [], gain: 0.24, rateJitter: 0.07, cooldownMs: 65 },
  cardSelect: { files: [], gain: 0.50, rateJitter: 0.04, cooldownMs: 60 },
  cardFlip: { files: [], gain: 0.52, rateJitter: 0.04, cooldownMs: 90 },
  cardShuffle: { files: [], gain: 0.58, rateJitter: 0.02, cooldownMs: 250 },
  chipClink: { files: [], gain: 0.48, rateJitter: 0.06, cooldownMs: 65 },
  doorCreak: { files: [], gain: 0.55, rateJitter: 0.03, cooldownMs: 300 },
  rooster: { files: [], gain: 0.62, rateJitter: 0.02, cooldownMs: 500 },
  gunshot: { files: [], gain: 0.72, rateJitter: 0.03, cooldownMs: 250 },
  healChime: { files: [], gain: 0.54, rateJitter: 0.02, cooldownMs: 250 },
  investigate: { files: [], gain: 0.52, rateJitter: 0.02, cooldownMs: 250 },
  gavel: { files: [], gain: 0.66, rateJitter: 0.03, cooldownMs: 250 },
  timerTick: { files: [], gain: 0.44, rateJitter: 0.02, cooldownMs: 250 },
  countdownGo: { files: [], gain: 0.64, rateJitter: 0.01, cooldownMs: 300 },
  playerJoin: { files: [], gain: 0.45, rateJitter: 0.02, cooldownMs: 180 },
  playerLeave: { files: [], gain: 0.42, rateJitter: 0.02, cooldownMs: 180 },
  footstep: { files: [], gain: 0.30, rateJitter: 0.09, cooldownMs: 220 },
  chatSend: { files: [], gain: 0.36, rateJitter: 0.03, cooldownMs: 80 },
  chatReceive: { files: [], gain: 0.40, rateJitter: 0.03, cooldownMs: 120 },
  victoryCitizen: { files: [], gain: 0.68, rateJitter: 0, cooldownMs: 600 },
  victoryMafia: { files: [], gain: 0.68, rateJitter: 0, cooldownMs: 600 },
  ambientHome: { files: [], gain: 0.16, loop: true },
  ambientNight: { files: [], gain: 0.18, loop: true },
  ambientDay: { files: [], gain: 0.15, loop: true },
};
