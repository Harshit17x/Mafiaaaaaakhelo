import React, { useEffect, useState } from 'react';
import { Clock, Pause } from 'lucide-react';

export function CountdownBadge({
  endsAt,
  paused,
  label,
}: {
  endsAt: number | null;
  paused: boolean;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt || paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt, paused]);

  if (paused) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-400/50 text-amber-200 text-xs font-mono font-semibold"
        role="status"
      >
        <Pause className="w-3.5 h-3.5" aria-hidden="true" />
        PAUSED
      </span>
    );
  }

  if (endsAt === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-noir-800/80 border border-gold-500/30 text-cream-300 text-xs font-mono">
        <Clock className="w-3.5 h-3.5 text-gold-400" aria-hidden="true" />
        {label ? `${label}: No Timer` : 'No Timer'}
      </span>
    );
  }

  const remainingSec = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;
  const urgent = remainingSec <= 10;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-semibold transition-colors ${
        urgent
          ? 'bg-crimson-900/80 border-crimson-400/70 text-crimson-200 animate-pulse'
          : 'bg-noir-800/90 border-gold-500/40 text-gold-200'
      }`}
      aria-live="polite"
    >
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      {label ? `${label}: ` : ''}
      {formatted}
    </span>
  );
}

