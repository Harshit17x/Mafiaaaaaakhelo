import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { useGameStore } from '../stores/useGameStore';

export function AudioControls() {
  const mutedAudio = useGameStore((s) => s.mutedAudio);
  const volume = useGameStore((s) => s.volume);
  const setMutedAudio = useGameStore((s) => s.setMutedAudio);
  const setVolume = useGameStore((s) => s.setVolume);

  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastPreviewAtRef = useRef<number>(0);

  useEffect(() => {
    if (!mobileOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setMobileOpen(false);
        soundEngine.playUiModalClose();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        soundEngine.playUiModalClose();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [mobileOpen]);

  const handleToggleMute = () => {
    void soundEngine.unlock();
    const nextMuted = !mutedAudio;
    soundEngine.setPrefs(nextMuted, volume);
    setMutedAudio(nextMuted);
    if (!nextMuted) {
      soundEngine.playUiToggle();
    }
  };

  const handleVolumeChange = (val: number) => {
    void soundEngine.unlock();
    const shouldUnmute = mutedAudio && val > 0;
    if (shouldUnmute) {
      setMutedAudio(false);
    }
    const effectiveMuted = shouldUnmute ? false : mutedAudio;
    soundEngine.setPrefs(effectiveMuted, val);
    setVolume(val);

    if (!effectiveMuted && val > 0) {
      const now = performance.now();
      if (now - lastPreviewAtRef.current >= 90) {
        lastPreviewAtRef.current = now;
        soundEngine.playSfx('uiClick', { gain: 0.55, cooldownMs: 80 });
      }
    }
  };

  const handleToggleMobilePopover = () => {
    void soundEngine.unlock();
    const next = !mobileOpen;
    setMobileOpen(next);
    if (next) {
      soundEngine.playUiModalOpen();
    } else {
      soundEngine.playUiModalClose();
    }
  };

  const displayPercent = mutedAudio ? 0 : Math.round(volume * 100);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1 sm:gap-2">
      <button
        type="button"
        data-sfx="none"
        onClick={handleToggleMute}
        aria-label={mutedAudio ? 'Unmute game audio' : 'Mute game audio'}
        aria-pressed={mutedAudio}
        title={mutedAudio ? 'Unmute audio' : 'Mute audio'}
        className="p-1.5 rounded-lg text-cream-200 hover:text-gold-200 hover:bg-noir-800 transition-colors cursor-pointer"
      >
        {mutedAudio ? (
          <VolumeX className="w-4 h-4 text-crimson-400" />
        ) : (
          <Volume2 className="w-4 h-4 text-gold-300" />
        )}
      </button>

      {/* Desktop inline volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={mutedAudio ? 0 : volume}
        onChange={(e) => handleVolumeChange(Number(e.target.value))}
        aria-label="Master audio volume"
        className="hidden sm:block w-16 md:w-20 accent-gold-500 cursor-pointer"
      />

      {/* Mobile compact volume popover trigger */}
      <button
        type="button"
        data-sfx="none"
        onClick={handleToggleMobilePopover}
        aria-label="Adjust master audio volume"
        aria-expanded={mobileOpen}
        aria-haspopup="dialog"
        title={`Volume: ${displayPercent}%`}
        className={`sm:hidden inline-flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
          mobileOpen
            ? 'bg-noir-800 text-gold-200 ring-1 ring-gold-500/40'
            : 'text-cream-300 hover:text-gold-200 hover:bg-noir-800'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-gold-300/90" aria-hidden="true" />
        <span>{displayPercent}%</span>
      </button>

      {mobileOpen && (
        <div
          role="dialog"
          aria-label="Audio volume controls"
          className="sm:hidden absolute right-0 top-full mt-2 z-50 w-52 rounded-xl bg-noir-950/95 backdrop-blur-md border border-gold-500/35 p-3 shadow-2xl space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-condensed uppercase tracking-[0.14em] text-[11px] text-gold-200 font-semibold">
              Master Volume
            </span>
            <span className="font-mono text-xs text-cream-200 tabular-nums">
              {displayPercent}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mutedAudio ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            aria-label="Mobile master audio volume"
            className="w-full h-6 accent-gold-500 cursor-pointer"
          />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              data-sfx="none"
              onClick={handleToggleMute}
              className="w-full py-1.5 px-2.5 rounded-lg border border-gold-500/25 bg-noir-900 hover:bg-noir-800 text-xs font-medium text-cream-100 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {mutedAudio ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-gold-300" aria-hidden="true" />
                  Unmute Audio
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-crimson-400" aria-hidden="true" />
                  Mute Audio
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
