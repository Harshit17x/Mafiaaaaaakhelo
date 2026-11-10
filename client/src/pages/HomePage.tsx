import React, { useEffect, useState } from 'react';
import { normalizeRoomCode } from '@midnight-city/shared';
import { BookOpen, KeyRound, PlusCircle, Sparkles } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

function extractInviteRoomCode(): string {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get('room');
  if (queryCode) {
    return normalizeRoomCode(queryCode);
  }
  const match = window.location.pathname.match(/\/join\/([a-zA-Z0-9]{6})/i);
  if (match && match[1]) {
    return normalizeRoomCode(match[1]);
  }
  return '';
}

export function HomePage() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const setRulesOpen = useGameStore((s) => s.setRulesOpen);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(() => extractInviteRoomCode());
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const code = extractInviteRoomCode();
    if (code) {
      setRoomCode(code);
    }
  }, []);

  const disabled = submitting || connectionStatus !== 'connected';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setLocalError('Enter your alias before opening a room.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    await createRoom(playerName);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setLocalError('Enter your alias before joining.');
      return;
    }
    if (normalizeRoomCode(roomCode).length !== 6) {
      setLocalError('Enter a valid 6-character room code.');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    await joinRoom(roomCode, playerName);
    setSubmitting(false);
  };

  return (
    <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold-500/35 bg-noir-900/80 text-gold-300 text-[11px] uppercase tracking-[0.28em]">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            1940s Social Deduction
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-[0.12em] text-gold-200 drop-shadow-[0_4px_20px_rgba(212,168,79,0.25)]">
            MAFIA
          </h1>
          <p className="font-serif italic text-xl sm:text-2xl text-cream-300 tracking-wide">
            Midnight City
          </p>
        </header>

        <section className="noir-card art-deco-border rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 mb-2"
            >
              Your Alias
            </label>
            <input
              id="player-name-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              placeholder="e.g. Detective Vance"
              className="w-full rounded-xl bg-noir-950/80 border border-gold-500/35 px-4 py-3 text-cream-50 placeholder:text-cream-600 focus:border-gold-400"
            />
          </div>

          {localError && (
            <p role="alert" className="text-sm text-crimson-400 font-medium">
              {localError}
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <button
                type="submit"
                disabled={disabled}
                className="w-full h-full min-h-[3.25rem] rounded-xl bg-gradient-to-r from-gold-600 via-gold-500 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold tracking-wider uppercase px-4 py-3 inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <PlusCircle className="w-5 h-5" aria-hidden="true" />
                {submitting ? 'Opening...' : 'Create Room'}
              </button>
            </form>

            <form onSubmit={handleJoin} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
                  maxLength={6}
                  placeholder="CODE"
                  aria-label="6-character room code"
                  className="w-28 sm:w-32 text-center font-mono uppercase tracking-[0.25em] rounded-xl bg-noir-950/80 border border-gold-500/35 px-3 py-3 text-gold-200 placeholder:text-cream-600"
                />
                <button
                  type="submit"
                  disabled={disabled}
                  className="flex-1 rounded-xl border border-gold-500/50 bg-noir-800/90 hover:bg-noir-700 text-gold-200 font-display font-bold tracking-wider uppercase px-3 py-3 inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  Join
                </button>
              </div>
            </form>
          </div>

          <div className="pt-2 border-t border-gold-500/15 flex items-center justify-between text-xs text-cream-400">
            <span>5–16 players • Private Voice &amp; Text</span>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="inline-flex items-center gap-1.5 text-gold-300 hover:text-gold-200 font-medium"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              Game Rules
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

