import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SKIP_VOTE_TARGET } from '@midnight-city/shared';
import type { ClientPlayerView } from '@midnight-city/shared';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Crosshair,
  Gavel,
  Skull,
  Vote,
  WifiOff,
  X,
} from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { CountdownBadge } from '../components/CountdownBadge';
import { ROLE_META, RoleSvgIcon } from '../components/RoleIcons';
import { useGameStore } from '../stores/useGameStore';

export function DayTablePage({
  speakingPeerIds = new Set<string>(),
}: {
  speakingPeerIds?: Set<string>;
}) {
  const room = useGameStore((s) => s.room);
  const toggleAccuse = useGameStore((s) => s.toggleAccuse);
  const toggleReadyToVote = useGameStore((s) => s.toggleReadyToVote);
  const castVote = useGameStore((s) => s.castVote);

  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVoteTarget(null);
  }, [room?.game.phase, room?.game.vote?.voteAttempt]);

  if (!room) return null;

  const { game, players, settings, myPlayerId } = room;
  const me = players.find((p) => p.id === myPlayerId);
  const playingPlayers = players.filter((p) => p.isPlaying);
  const alivePlayers = playingPlayers.filter((p) => p.isAlive);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const phase = game.phase;
  const amAlive = Boolean(me?.isPlaying && me.isAlive);

  const accuseCounts = new Map<string, string[]>();
  for (const p of alivePlayers) {
    if (p.accuseTargetId) {
      const list = accuseCounts.get(p.accuseTargetId) ?? [];
      list.push(p.name);
      accuseCounts.set(p.accuseTargetId, list);
    }
  }

  const readyCount = alivePlayers.filter((p) => p.readyToVote).length;
  const majorityNeeded = Math.floor(alivePlayers.length / 2) + 1;

  const vote = game.vote;
  const voteResult = game.voteResult;

  const canVoteCandidate = (candidateId: string) => {
    if (!amAlive || phase !== 'DAY_VOTE' || !vote || vote.myVote !== null) {
      return false;
    }
    if (candidateId === myPlayerId) return false;
    if (
      vote.voteAttempt === 2 &&
      vote.revoteCandidateIds.length > 0 &&
      !vote.revoteCandidateIds.includes(candidateId)
    ) {
      return false;
    }
    return true;
  };

  const totalBallots = voteResult
    ? voteResult.tally.reduce((acc, item) => acc + item.count, 0)
    : 0;

  const renderSeatCard = (p: ClientPlayerView, compact: boolean) => {
    const isMe = p.id === myPlayerId;
    const isSpeaking = speakingPeerIds.has(p.id);
    const accusers = accuseCounts.get(p.id) ?? [];
    const iAccused = me?.accuseTargetId === p.id;
    const isSelectedVote = selectedVoteTarget === p.id;
    const eligibleVote = canVoteCandidate(p.id);
    const isVotable =
      phase === 'DAY_VOTE' &&
      p.isAlive &&
      !isMe &&
      (vote?.voteAttempt === 1 ||
        !vote?.revoteCandidateIds.length ||
        vote.revoteCandidateIds.includes(p.id));

    return (
      <div
        className={`relative rounded-2xl border transition-all ${
          compact ? 'p-2.5 w-36' : 'p-3.5'
        } ${
          !p.isAlive
            ? 'bg-noir-950/85 border-noir-800 opacity-70'
            : isSelectedVote
              ? 'bg-crimson-900/70 border-crimson-400 shadow-[0_0_24px_rgba(201,42,55,0.35)]'
              : isSpeaking
                ? 'bg-noir-800/95 border-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.45)]'
                : 'noir-card border-gold-500/30'
        }`}
      >
        {!p.isAlive && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25"
          >
            <X className="w-12 h-12 text-crimson-500 stroke-[3]" />
          </div>
        )}

        <div className="relative z-10 flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span
                className={`font-semibold text-xs sm:text-sm truncate ${
                  p.isAlive ? 'text-cream-100' : 'line-through text-cream-400'
                }`}
              >
                {p.name}
              </span>
              {isMe && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-gold-500/20 text-gold-300 shrink-0">
                  YOU
                </span>
              )}
            </div>
            <div className="text-[10px] text-cream-400">
              {!p.isAlive ? 'Deceased' : p.connected ? 'Alive' : 'Offline'}
            </div>
          </div>

          {!p.isAlive ? (
            <Skull className="w-4 h-4 text-crimson-500 shrink-0" aria-label="Dead" />
          ) : !p.connected ? (
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" aria-label="Disconnected" />
          ) : phase === 'DAY_VOTE' && p.hasVoted ? (
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0"
              aria-label="Ballot cast"
            />
          ) : null}
        </div>

        {!p.isAlive && p.role && (
          <div
            className={`relative z-10 mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
              ROLE_META[p.role].badgeBgClass
            }`}
          >
            <RoleSvgIcon role={p.role} className="w-3 h-3" />
            {ROLE_META[p.role].label}
          </div>
        )}

        {p.isAlive && accusers.length > 0 && (
          <div
            title={`Accused by: ${accusers.join(', ')}`}
            className="relative z-10 mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-crimson-900/75 border border-crimson-500/50 text-[10px] text-crimson-200"
          >
            <AlertCircle className="w-3 h-3" />
            Accused ({accusers.length})
          </div>
        )}

        {phase === 'DAY_DISCUSSION' && amAlive && p.isAlive && !isMe && (
          <button
            type="button"
            onClick={() => void toggleAccuse(p.id)}
            className={`relative z-10 mt-2 w-full py-1 rounded-lg text-[11px] font-semibold border inline-flex items-center justify-center gap-1 transition ${
              iAccused
                ? 'bg-crimson-600 border-crimson-400 text-white'
                : 'bg-noir-900/80 border-gold-500/25 text-cream-300 hover:border-crimson-400/50'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            {iAccused ? 'Accused' : 'Accuse'}
          </button>
        )}

        {phase === 'DAY_VOTE' && isVotable && eligibleVote && (
          <button
            type="button"
            onClick={() => setSelectedVoteTarget(p.id)}
            className={`relative z-10 mt-2 w-full py-1 rounded-lg text-[11px] font-semibold border inline-flex items-center justify-center gap-1 transition ${
              isSelectedVote
                ? 'bg-crimson-600 border-crimson-300 text-white'
                : 'bg-noir-900/80 border-gold-500/35 text-gold-200 hover:bg-noir-800'
            }`}
          >
            <Vote className="w-3 h-3" />
            {isSelectedVote ? 'Selected' : 'Select'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="noir-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-gold-400">
            Day {game.roundNumber}
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-cream-100 uppercase tracking-wider">
            {phase === 'DAY_DISCUSSION'
              ? 'Town Hall Discussion'
              : phase === 'DAY_VOTE'
                ? vote?.voteAttempt === 2
                  ? 'Tie-Breaker Revote'
                  : 'Gallows Ballot'
                : 'Verdict Delivered'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {phase === 'DAY_DISCUSSION' && amAlive && settings.narratorMode === 'AUTO_NARRATOR' && (
            <button
              type="button"
              onClick={() => void toggleReadyToVote(!me?.readyToVote)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition ${
                me?.readyToVote
                  ? 'bg-emerald-800/80 border-emerald-400/60 text-emerald-100'
                  : 'bg-noir-800 border-gold-500/40 text-gold-200 hover:bg-noir-700'
              }`}
            >
              {me?.readyToVote ? 'Ready to Vote ✓' : 'Skip to Vote'} ({readyCount}/{majorityNeeded})
            </button>
          )}
          <CountdownBadge endsAt={game.phaseEndsAt} paused={game.paused} />
        </div>
      </div>

      {phase === 'VOTE_RESULT' && voteResult && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="noir-card art-deco-border rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gold-500/20 pb-4">
            <div className="flex items-center gap-3">
              <Gavel className="w-7 h-7 text-gold-400" aria-hidden="true" />
              <div>
                <h3 className="font-display text-2xl text-cream-50 uppercase tracking-wider">
                  {voteResult.eliminatedPlayerName
                    ? `${voteResult.eliminatedPlayerName} Eliminated`
                    : voteResult.needsRevote
                      ? 'Tie Detected — Revote Ordered'
                      : 'No One Was Eliminated'}
                </h3>
                <p className="text-xs text-cream-400">
                  {voteResult.wasTie
                    ? 'Top suspects drew equal votes.'
                    : voteResult.wasSkip
                      ? 'The city chose to spare everyone today.'
                      : 'The gavel has fallen.'}
                </p>
              </div>
            </div>

            {voteResult.eliminatedPlayerId && voteResult.eliminatedRole && (
              <motion.div
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                  ROLE_META[voteResult.eliminatedRole].badgeBgClass
                }`}
              >
                <RoleSvgIcon role={voteResult.eliminatedRole} className="w-8 h-8" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">Role Revealed</div>
                  <div className="font-display font-bold text-sm uppercase">
                    {ROLE_META[voteResult.eliminatedRole].label}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-3">
            {voteResult.tally.length === 0 ? (
              <p className="text-sm text-cream-400 italic">No ballots were cast.</p>
            ) : (
              voteResult.tally.map((entry) => {
                const pct = totalBallots > 0 ? Math.round((entry.count / totalBallots) * 100) : 0;
                const voterNames = entry.voterIds
                  .map((id) => playerMap.get(id)?.name ?? 'Unknown')
                  .join(', ');
                return (
                  <div key={entry.targetId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-cream-100">{entry.targetName}</span>
                      <span className="font-mono text-gold-300">
                        {entry.count} {entry.count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-noir-950 overflow-hidden border border-gold-500/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        className={`h-full ${
                          entry.targetId === voteResult.eliminatedPlayerId
                            ? 'bg-crimson-500'
                            : entry.targetId === SKIP_VOTE_TARGET
                              ? 'bg-cream-400/60'
                              : 'bg-gold-500/70'
                        }`}
                      />
                    </div>
                    <div className="text-xs text-cream-400">Voted by: {voterNames}</div>
                  </div>
                );
              })
            )}
          </div>
        </motion.section>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="hidden md:block relative w-full h-[34rem] noir-card rounded-3xl overflow-hidden">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border-2 border-gold-500/30 bg-gradient-to-br from-noir-800/95 to-noir-950/95 shadow-[inset_0_0_50px_rgba(0,0,0,0.75)] flex flex-col items-center justify-center text-center p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold-400">
                Midnight Table
              </div>
              <div className="font-display text-lg text-gold-200 font-bold uppercase mt-1">
                {alivePlayers.length} / {playingPlayers.length} Alive
              </div>
              <div className="text-xs text-cream-300 mt-1">
                {phase === 'DAY_DISCUSSION'
                  ? 'Debate & Accuse'
                  : phase === 'DAY_VOTE'
                    ? 'Cast Your Ballot'
                    : 'Count Complete'}
              </div>
            </div>

            {playingPlayers.map((p, idx) => {
              const angle =
                (idx / Math.max(1, playingPlayers.length)) * Math.PI * 2 - Math.PI / 2;
              const radiusX = playingPlayers.length > 10 ? 40 : 37;
              const radiusY = playingPlayers.length > 10 ? 39 : 37;
              const leftPct = 50 + radiusX * Math.cos(angle);
              const topPct = 50 + radiusY * Math.sin(angle);
              return (
                <div
                  key={p.id}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                >
                  {renderSeatCard(p, true)}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 md:hidden">
            {playingPlayers.map((p) => (
              <React.Fragment key={p.id}>{renderSeatCard(p, false)}</React.Fragment>
            ))}
          </div>

          {phase === 'DAY_VOTE' && amAlive && vote && (
            <div className="noir-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              {vote.myVote !== null ? (
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  Ballot locked ({vote.votedPlayerIds.length}/{alivePlayers.length} voted). Waiting
                  for the city...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {settings.allowSkipVote && (
                      <button
                        type="button"
                        onClick={() => setSelectedVoteTarget(SKIP_VOTE_TARGET)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition ${
                          selectedVoteTarget === SKIP_VOTE_TARGET
                            ? 'bg-cream-100 text-noir-950 border-cream-50'
                            : 'bg-noir-900 border-gold-500/35 text-cream-300 hover:bg-noir-800'
                        }`}
                      >
                        Skip Vote
                      </button>
                    )}
                    <span className="text-xs text-cream-400">
                      {selectedVoteTarget === SKIP_VOTE_TARGET
                        ? 'Skipping elimination'
                        : selectedVoteTarget
                          ? `Target: ${playerMap.get(selectedVoteTarget)?.name}`
                          : 'Tap a suspect to select'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedVoteTarget}
                    onClick={() => selectedVoteTarget && void castVote(selectedVoteTarget)}
                    className="px-5 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-display font-bold uppercase tracking-wider text-xs disabled:opacity-40 transition"
                  >
                    Confirm Ballot
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
