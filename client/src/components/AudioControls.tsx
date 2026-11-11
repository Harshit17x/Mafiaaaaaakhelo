import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

export function AudioControls() {
  const mutedAudio = useGameStore((s) => s.mutedAudio);
  const volume = useGameStore((s) => s.volume);
  const setMutedAudio = useGameStore((s) => s.setMutedAudio);
  const setVolume = useGameStore((s) => s.setVolume);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMutedAudio(!mutedAudio)}
        aria-label={mutedAudio ? 'Unmute game audio' : 'Mute game audio'}
        title={mutedAudio ? 'Unmute audio' : 'Mute audio'}
        className="p-2 sm:p-1.5 rounded-lg text-cream-200 hover:text-gold-200 hover:bg-noir-800"
      >
        {mutedAudio ? (
          <VolumeX className="w-4 h-4 text-crimson-400" />
        ) : (
          <Volume2 className="w-4 h-4 text-gold-300" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={mutedAudio ? 0 : volume}
        onChange={(e) => {
          const val = Number(e.target.value);
          if (mutedAudio && val > 0) {
            setMutedAudio(false);
          }
          setVolume(val);
        }}
        aria-label="Master audio volume"
        className="hidden sm:block w-16 md:w-20 accent-gold-500 cursor-pointer"
      />
    </div>
  );
}

