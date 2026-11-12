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
 * `files` lists `/assets/sfx/<filename>` paths for sampled WAV audio cues
 * (plus variations where repetitive playback benefits from variety).
 * SoundEngine decodes these buffers on unlock and still retains procedural
 * Web Audio synthesis as a safe fallback if any fetch/decode fails.
 */
export const SFX_ASSETS: Record<SfxId, SfxAssetEntry> = {
  uiHover: {
    files: ['/assets/sfx/ui-hover-1.wav', '/assets/sfx/ui-hover-2.wav', '/assets/sfx/ui-hover-3.wav'],
    gain: 0.22,
    rateJitter: 0.06,
    cooldownMs: 55,
  },
  uiShift: {
    files: ['/assets/sfx/ui-shift-1.wav', '/assets/sfx/ui-shift-2.wav', '/assets/sfx/ui-shift-3.wav'],
    gain: 0.26,
    rateJitter: 0.05,
    cooldownMs: 45,
  },
  uiClick: {
    files: ['/assets/sfx/ui-click-1.wav', '/assets/sfx/ui-click-2.wav', '/assets/sfx/ui-click-3.wav'],
    gain: 0.42,
    rateJitter: 0.04,
    cooldownMs: 35,
  },
  uiConfirm: { files: ['/assets/sfx/ui-confirm.wav'], gain: 0.52, rateJitter: 0.02, cooldownMs: 70 },
  uiBack: { files: ['/assets/sfx/ui-back.wav'], gain: 0.44, rateJitter: 0.02, cooldownMs: 70 },
  uiToggle: {
    files: ['/assets/sfx/ui-toggle-1.wav', '/assets/sfx/ui-toggle-2.wav'],
    gain: 0.42,
    rateJitter: 0.03,
    cooldownMs: 50,
  },
  uiTab: {
    files: ['/assets/sfx/ui-tab-1.wav', '/assets/sfx/ui-tab-2.wav'],
    gain: 0.40,
    rateJitter: 0.03,
    cooldownMs: 60,
  },
  uiModalOpen: { files: ['/assets/sfx/ui-modal-open.wav'], gain: 0.46, rateJitter: 0.02, cooldownMs: 120 },
  uiModalClose: { files: ['/assets/sfx/ui-modal-close.wav'], gain: 0.40, rateJitter: 0.02, cooldownMs: 120 },
  uiError: { files: ['/assets/sfx/ui-error.wav'], gain: 0.55, rateJitter: 0.01, cooldownMs: 160 },
  cardHover: {
    files: ['/assets/sfx/card-hover-1.wav', '/assets/sfx/card-hover-2.wav', '/assets/sfx/card-hover-3.wav'],
    gain: 0.24,
    rateJitter: 0.07,
    cooldownMs: 65,
  },
  cardSelect: {
    files: ['/assets/sfx/card-select-1.wav', '/assets/sfx/card-select-2.wav'],
    gain: 0.50,
    rateJitter: 0.04,
    cooldownMs: 60,
  },
  cardFlip: {
    files: ['/assets/sfx/card-flip-1.wav', '/assets/sfx/card-flip-2.wav'],
    gain: 0.52,
    rateJitter: 0.04,
    cooldownMs: 90,
  },
  cardShuffle: { files: ['/assets/sfx/card-shuffle.wav'], gain: 0.58, rateJitter: 0.02, cooldownMs: 250 },
  chipClink: {
    files: ['/assets/sfx/chip-clink-1.wav', '/assets/sfx/chip-clink-2.wav', '/assets/sfx/chip-clink-3.wav'],
    gain: 0.48,
    rateJitter: 0.06,
    cooldownMs: 65,
  },
  doorCreak: { files: ['/assets/sfx/door-creak.wav'], gain: 0.55, rateJitter: 0.03, cooldownMs: 300 },
  rooster: { files: ['/assets/sfx/rooster.wav'], gain: 0.62, rateJitter: 0.02, cooldownMs: 500 },
  gunshot: { files: ['/assets/sfx/gunshot.wav'], gain: 0.72, rateJitter: 0.03, cooldownMs: 250 },
  healChime: { files: ['/assets/sfx/heal-chime.wav'], gain: 0.54, rateJitter: 0.02, cooldownMs: 250 },
  investigate: { files: ['/assets/sfx/investigate.wav'], gain: 0.52, rateJitter: 0.02, cooldownMs: 250 },
  gavel: { files: ['/assets/sfx/gavel.wav'], gain: 0.66, rateJitter: 0.03, cooldownMs: 250 },
  timerTick: { files: ['/assets/sfx/timer-tick.wav'], gain: 0.44, rateJitter: 0.02, cooldownMs: 250 },
  countdownGo: { files: ['/assets/sfx/countdown-go.wav'], gain: 0.64, rateJitter: 0.01, cooldownMs: 300 },
  playerJoin: { files: ['/assets/sfx/player-join.wav'], gain: 0.45, rateJitter: 0.02, cooldownMs: 180 },
  playerLeave: { files: ['/assets/sfx/player-leave.wav'], gain: 0.42, rateJitter: 0.02, cooldownMs: 180 },
  footstep: {
    files: [
      '/assets/sfx/footstep-1.wav',
      '/assets/sfx/footstep-2.wav',
      '/assets/sfx/footstep-3.wav',
      '/assets/sfx/footstep-4.wav',
    ],
    gain: 0.30,
    rateJitter: 0.09,
    cooldownMs: 220,
  },
  chatSend: { files: ['/assets/sfx/chat-send.wav'], gain: 0.36, rateJitter: 0.03, cooldownMs: 80 },
  chatReceive: { files: ['/assets/sfx/chat-receive.wav'], gain: 0.40, rateJitter: 0.03, cooldownMs: 120 },
  victoryCitizen: { files: ['/assets/sfx/victory-citizen.wav'], gain: 0.68, rateJitter: 0, cooldownMs: 600 },
  victoryMafia: { files: ['/assets/sfx/victory-mafia.wav'], gain: 0.68, rateJitter: 0, cooldownMs: 600 },
  ambientHome: { files: ['/assets/sfx/ambient-home.wav'], gain: 0.16, loop: true },
  ambientNight: { files: ['/assets/sfx/ambient-night.wav'], gain: 0.18, loop: true },
  ambientDay: { files: ['/assets/sfx/ambient-day.wav'], gain: 0.15, loop: true },
};
