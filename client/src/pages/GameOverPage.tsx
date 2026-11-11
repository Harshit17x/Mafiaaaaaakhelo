import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Trophy } from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { ROLE_META, RoleSvgIcon } from '../components/RoleIcons';
import { useGameStore } from '../stores/useGameStore';

const CONFETTI_PIECES = Array.from({ length: 24 }, (_, idx) => ({
  id: idx,
  left: `${(idx * 41) % 96 + 2}%`,
  delay: (idx % 6) * 0.15,
  color: idx % 3 === 0 ? '#d4a84f' : idx % 3 === 1 ? '#e04f5b' : '#ece4d4',
}));

export function GameOverPage() {
  const room = useGameStore((s) => s.room);
  const playAgain = useGameStore((s) => s.playAgain);

  if (!room) return null;

  const { game, players, myPlayerId } = room;
  const me = players.find((p) => p.id === myPlayerId);
  const playingPlayers = players.filter((p) => p.isPlaying);
  const primaryWinner = game.winners[0] ?? 'CITY';
  const jokerWinner = game.jokerWinnerPlayerId
    ? players.find((p) => p.id === game.jokerWinnerPlayerId)
    : null;

  const bannerStyles =
    primaryWinner === 'MAFIA'
      ? 'border-crimson-500/60 bg-crimson-900/35 text-crimson-200'
      : primaryWinner === 'JOKER'
        ? 'border-purple-400/60 bg-purple-950/45 text-purple-200'
        : 'border-gold-400/60 bg-gold-500/15 text-gold-200';

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {CONFETTI_PIECES.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{ y: -20, opacity: 1, rotate: 0 }}
            animate={{ y: '100vh', opacity: 0, rotate: 360 }}
            transition={{
              duration: 3.4,
              delay: piece.delay,
              repeat: Infinity,
              repeatDelay: 2,
            }}
            style={{ left: piece.left, backgroundColor: piece.color }}
            className="absolute top-0 w-2 h-3 rounded-sm opacity-80"
          />
        ))}
      </div>

      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative z-10 noir-card border-2 rounded-2xl p-5 sm:p-8 text-center space-y-3 ${bannerStyles}`}
      >
        <div className="flex justify-center">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-wider break-words">
          {primaryWinner === 'MAFIA'
            ? 'Syndicate Reigns Over Midnight City'
            : primaryWinner === 'JOKER'
              ? 'The Joker Had the Last Laugh'
              : 'Midnight City Prevails'}
        </h1>
        {jokerWinner && primaryWinner !== 'JOKER' && (
          <p className="text-sm text-purple-200 font-semibold">
            Bonus Triumph: {jokerWinner.name} (Joker) also secured an earlier victory!
          </p>
        )}

        {me?.isHost && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => void playAgain()}
              className="w-full sm:w-auto px-5 sm:px-6 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold uppercase tracking-wider text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              Play Again (Return to Lobby)
            </button>
          </div>
        )}
      </motion.section>

      <div className="relative z-10 grid lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          <section className="noir-card rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 className="font-display text-lg text-gold-200 uppercase tracking-wider">
              Final Dossiers
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {playingPlayers.map((p) => {
                const role = p.role ?? 'VILLAGER';
                const meta = ROLE_META[role];
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-3 bg-noir-900/80 border ${meta.borderClass} flex items-center justify-between gap-2`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <RoleSvgIcon role={role} className={`w-8 h-8 shrink-0 ${meta.colorClass}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-cream-100 truncate">
                          {p.name}
                        </div>
                        <div className={`text-xs font-semibold uppercase ${meta.colorClass}`}>
                          {meta.label}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        p.isAlive
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                          : 'bg-noir-950 text-cream-400 border border-noir-700'
                      }`}
                    >
                      {p.isAlive ? 'Survived' : 'Deceased'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="noir-card rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-lg text-gold-200 uppercase tracking-wider">
              Case Timeline
            </h2>
            <div className="space-y-3 text-sm">
              {(game.timeline ?? []).map((entry, idx) =>
                entry.kind === 'NIGHT' ? (
                  <div
                    key={`n-${entry.nightNumber}-${idx}`}
                    className="rounded-xl bg-noir-900/75 border border-gold-500/20 p-3.5 space-y-1"
                  >
                    <div className="font-display text-xs uppercase tracking-wider text-gold-300">
                      Night {entry.nightNumber}
                    </div>
                    <div className="text-cream-200">
                      {entry.killedPlayerName
                        ? `Mafia eliminated ${entry.killedPlayerName}.`
                        : entry.savedByHealer
                          ? `Mafia targeted ${entry.mafiaTargetName}, but the Healer saved them!`
                          : entry.blockedByJokerImmunity
                            ? `Mafia targeted ${entry.mafiaTargetName}, who survived via Joker night immunity.`
                            : 'Quiet night — nobody was killed.'}
                    </div>
                    <div className="text-xs text-cream-400 flex flex-wrap gap-x-4 gap-y-1">
                      {entry.healerTargetName && <span>Healer guarded: {entry.healerTargetName}</span>}
                      {entry.detectiveTargetName && (
                        <span>
                          Detective checked: {entry.detectiveTargetName} (
                          {entry.detectiveFoundMafia ? 'Mafia' : 'Not Mafia'})
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key={`v-${entry.dayNumber}-${entry.voteAttempt}-${idx}`}
                    className="rounded-xl bg-noir-900/75 border border-gold-500/20 p-3.5 space-y-1"
                  >
                    <div className="font-display text-xs uppercase tracking-wider text-amber-300">
                      Day {entry.dayNumber} Vote {entry.voteAttempt === 2 ? '(Revote)' : ''}
                    </div>
                    <div className="text-cream-200">
                      {entry.eliminatedPlayerName
                        ? `${entry.eliminatedPlayerName} was voted out.`
                        : entry.wasTie
                          ? 'Vote tied — no elimination.'
                          : 'City voted to skip.'}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

