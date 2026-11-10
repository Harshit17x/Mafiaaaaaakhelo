import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SKIP_VOTE_TARGET } from '@midnight-city/shared';
import { Check, Gavel } from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { CountdownBadge } from '../components/CountdownBadge';
import { MidnightLoungeTable3D } from '../components/MidnightLoungeTable3D';
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

  const accuseCounts = new Map<string, number>();
  for (const p of alivePlayers) {
    if (p.accuseTargetId) {
      accuseCounts.set(p.accuseTargetId, (accuseCounts.get(p.accuseTargetId) ?? 0) + 1);
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

  const tableMode =
    phase === 'DAY_VOTE'
      ? 'DAY_VOTE'
      : phase === 'VOTE_RESULT'
        ? 'VOTE_RESULT'
        : 'DAY_DISCUSSION';

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="noir-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-gold-400">
            Day {game.roundNumber}
          </div>
          <h2 className="font-display text-xl sm:text-2xl text-cream-100 uppercase tracking-wider">
            {phase === 'DAY_DISCUSSION'
              ? 'Round Table Discussion'
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

      <MidnightLoungeTable3D
        players={playingPlayers}
        myPlayerId={myPlayerId}
        mode={tableMode}
        viewerIsHost={Boolean(me?.isHost)}
        speakingPeerIds={speakingPeerIds}
        accuseCounts={accuseCounts}
        myAccuseTargetId={me?.accuseTargetId ?? null}
        selectedVoteTarget={selectedVoteTarget}
        canAccuse={phase === 'DAY_DISCUSSION' && amAlive}
        canVoteCandidate={canVoteCandidate}
        onToggleAccuse={(id) => void toggleAccuse(id)}
        onSelectVote={(id) => setSelectedVoteTarget(id)}
        centerTitle={`Round Table (${alivePlayers.length}/${playingPlayers.length} Alive)`}
        centerSubtitle={
          phase === 'DAY_DISCUSSION'
            ? 'Sit around the table, debate & accuse'
            : phase === 'DAY_VOTE'
              ? 'Select a card above a cushion, then confirm below'
              : 'Verdict complete'
        }
      />

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {phase === 'DAY_VOTE' && amAlive && vote ? (
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
                          : 'Select a card around the 3D table'}
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
          ) : (
            <div className="noir-card rounded-2xl p-4 text-xs text-cream-300 flex items-center justify-between">
              <span>
                {amAlive
                  ? 'Orbit the table to inspect all player cards and accusations.'
                  : 'You are spectating from the shadows. Ghost chat is open if enabled.'}
              </span>
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
