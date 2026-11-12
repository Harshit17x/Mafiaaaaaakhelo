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
 * `files` lists `/assets/sfx/<filename>` paths for sampled MP3 audio cues
 * generated with ElevenLabs Sound Generation and trimmed/mastered for
 * low-latency playback. SoundEngine decodes these buffers on unlock and
 * retains procedural Web Audio synthesis as a safe fallback if any fetch/decode fails.
 */
export const SFX_ASSETS: Record<SfxId, SfxAssetEntry> = {
  uiHover: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 45,
  },
  uiShift: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 45,
  },
  uiClick: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 40,
  },
  uiConfirm: { files: ['/assets/sfx/card-flip-1.mp3'], gain: 0.82, rateJitter: 0.03, cooldownMs: 45 },
  uiBack: { files: ['/assets/sfx/card-flip-1.mp3'], gain: 0.74, rateJitter: 0.03, cooldownMs: 45 },
  uiToggle: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 40,
  },
  uiTab: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 45,
  },
  uiModalOpen: { files: ['/assets/sfx/card-flip-1.mp3'], gain: 0.78, rateJitter: 0.03, cooldownMs: 60 },
  uiModalClose: { files: ['/assets/sfx/card-flip-1.mp3'], gain: 0.74, rateJitter: 0.03, cooldownMs: 60 },
  uiError: { files: ['/assets/sfx/ui-error.mp3'], gain: 0.82, rateJitter: 0.01, cooldownMs: 120 },
  cardHover: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.03,
    cooldownMs: 45,
  },
  cardSelect: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.80,
    rateJitter: 0.04,
    cooldownMs: 45,
  },
  cardFlip: {
    files: ['/assets/sfx/card-flip-1.mp3'],
    gain: 0.78,
    rateJitter: 0.04,
    cooldownMs: 60,
  },
  cardShuffle: { files: ['/assets/sfx/card-shuffle.mp3'], gain: 0.76, rateJitter: 0.02, cooldownMs: 220 },
  chipClink: {
    files: ['/assets/sfx/chip-clink-1.mp3', '/assets/sfx/chip-clink-2.mp3'],
    gain: 0.86,
    rateJitter: 0.06,
    cooldownMs: 50,
  },
  doorCreak: { files: ['/assets/sfx/door-creak.mp3'], gain: 0.72, rateJitter: 0.03, cooldownMs: 300 },
  rooster: { files: ['/assets/sfx/rooster.mp3'], gain: 0.78, rateJitter: 0.02, cooldownMs: 500 },
  gunshot: { files: ['/assets/sfx/gunshot.mp3'], gain: 0.88, rateJitter: 0.03, cooldownMs: 250 },
  healChime: { files: ['/assets/sfx/heal-chime.mp3'], gain: 0.72, rateJitter: 0.02, cooldownMs: 250 },
  investigate: { files: ['/assets/sfx/investigate.mp3'], gain: 0.72, rateJitter: 0.02, cooldownMs: 250 },
  gavel: { files: ['/assets/sfx/gavel.mp3'], gain: 0.86, rateJitter: 0.03, cooldownMs: 250 },
  timerTick: { files: ['/assets/sfx/timer-tick.mp3'], gain: 0.64, rateJitter: 0.02, cooldownMs: 200 },
  countdownGo: { files: ['/assets/sfx/countdown-go.mp3'], gain: 0.82, rateJitter: 0.01, cooldownMs: 300 },
  playerJoin: { files: ['/assets/sfx/player-join.mp3'], gain: 0.62, rateJitter: 0.02, cooldownMs: 180 },
  playerLeave: { files: ['/assets/sfx/player-leave.mp3'], gain: 0.58, rateJitter: 0.02, cooldownMs: 180 },
  footstep: {
    files: ['/assets/sfx/footstep-1.mp3', '/assets/sfx/footstep-2.mp3'],
    gain: 0.48,
    rateJitter: 0.09,
    cooldownMs: 200,
  },
  chatSend: { files: ['/assets/sfx/chat-send.mp3'], gain: 0.62, rateJitter: 0.04, cooldownMs: 65 },
  chatReceive: { files: ['/assets/sfx/chat-receive.mp3'], gain: 0.64, rateJitter: 0.03, cooldownMs: 100 },
  victoryCitizen: { files: ['/assets/sfx/victory-citizen.mp3'], gain: 0.85, rateJitter: 0, cooldownMs: 600 },
  victoryMafia: { files: ['/assets/sfx/victory-mafia.mp3'], gain: 0.85, rateJitter: 0, cooldownMs: 600 },
  ambientHome: { files: ['/assets/sfx/ambient-home.mp3'], gain: 0.10, loop: true },
  ambientNight: { files: ['/assets/sfx/ambient-night.mp3'], gain: 0.11, loop: true },
  ambientDay: { files: ['/assets/sfx/ambient-day.mp3'], gain: 0.095, loop: true },
};
