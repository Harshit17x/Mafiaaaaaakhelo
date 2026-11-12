import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SKIP_VOTE_TARGET } from '@midnight-city/shared';
import { Check, Gavel, MessageSquare, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
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
  const chatMessages = useGameStore((s) => s.chatMessages);
  const toggleAccuse = useGameStore((s) => s.toggleAccuse);
  const toggleReadyToVote = useGameStore((s) => s.toggleReadyToVote);
  const castVote = useGameStore((s) => s.castVote);

  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [verdictMinimized, setVerdictMinimized] = useState(false);

  useEffect(() => {
    setSelectedVoteTarget(null);
    setVerdictMinimized(false);
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

  const phaseHeadline =
    phase === 'DAY_DISCUSSION'
      ? 'Round Table Council'
      : phase === 'DAY_VOTE'
        ? vote?.voteAttempt === 2
          ? 'Tie-Breaker Revote'
          : 'Gallows Ballot'
        : 'Verdict Delivered';

  const topLeftHud = (
    <div className="game-hud-glass rounded-xl sm:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
      <div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[9.5px] sm:text-[10px] font-mono uppercase tracking-[0.2em] sm:tracking-[0.26em] text-gold-300">
            Day {game.roundNumber}
          </span>
          <span className="text-[9.5px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-noir-950/80 border border-gold-500/25 text-cream-300">
            {alivePlayers.length}/{playingPlayers.length} Alive
          </span>
        </div>
        <h2 className="font-display text-sm sm:text-lg text-cream-50 uppercase tracking-wider leading-tight">
          {phaseHeadline}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <CountdownBadge endsAt={game.phaseEndsAt} paused={game.paused} />
        {phase === 'DAY_DISCUSSION' && amAlive && settings.narratorMode === 'AUTO_NARRATOR' && (
          <button
            type="button"
            data-sfx="none"
            aria-pressed={Boolean(me?.readyToVote)}
            onClick={() => {
              soundEngine.playUiToggle();
              void toggleReadyToVote(!me?.readyToVote);
            }}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-display font-bold uppercase tracking-wider border transition cursor-pointer ${
              me?.readyToVote
                ? 'bg-emerald-800/85 border-emerald-400/60 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.3)]'
                : 'bg-noir-900/90 border-gold-500/40 text-gold-200 hover:bg-noir-800'
            }`}
          >
            {me?.readyToVote ? 'Ready ✓' : 'Call Vote'} ({readyCount}/{majorityNeeded})
          </button>
        )}
      </div>
    </div>
  );

  const topRightHud = (
    <div className="flex items-center gap-1.5">
      {phase === 'VOTE_RESULT' && voteResult && verdictMinimized && (
        <button
          type="button"
          data-sfx="none"
          onClick={() => {
            soundEngine.playUiModalOpen();
            setVerdictMinimized(false);
          }}
          className="game-hud-glass px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-display font-semibold uppercase tracking-wider text-gold-200 hover:border-gold-300 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Gavel className="w-3.5 h-3.5 text-gold-300" />
          <span className="hidden sm:inline">Verdict Sheet</span>
          <span className="sm:hidden">Verdict</span>
        </button>
      )}
      <button
        type="button"
        data-sfx="none"
        aria-expanded={chatOpen}
        onClick={() => {
          if (chatOpen) {
            soundEngine.playUiModalClose();
          } else {
            soundEngine.playUiModalOpen();
          }
          setChatOpen((v) => !v);
        }}
        className={`game-hud-glass px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer ${
          chatOpen ? 'border-gold-300 text-gold-200' : 'text-cream-200 hover:text-gold-200'
        }`}
      >
        <MessageSquare className="w-3.5 h-3.5 text-gold-300" />
        <span>Chat</span>
        {chatMessages.length > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-gold-500/25 border border-gold-400/40 text-[10px] font-mono text-gold-200">
            {chatMessages.length}
          </span>
        )}
      </button>
    </div>
  );

  const bottomActionHud =
    phase === 'DAY_VOTE' && amAlive && vote ? (
      <div className="game-hud-glass rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {vote.myVote !== null ? (
          <div className="flex items-center gap-2 text-emerald-300 text-xs sm:text-sm font-medium">
            <Check className="w-4 h-4 shrink-0" />
            Ballot sealed ({vote.votedPlayerIds.length}/{alivePlayers.length} cast). Awaiting
            verdict...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
              {settings.allowSkipVote && (
                <button
                  type="button"
                  data-sfx="none"
                  onClick={() => {
                    soundEngine.playCardSelect();
                    setSelectedVoteTarget(SKIP_VOTE_TARGET);
                  }}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-display font-bold uppercase tracking-wider border transition cursor-pointer ${
                    selectedVoteTarget === SKIP_VOTE_TARGET
                      ? 'bg-cream-100 text-noir-950 border-cream-50 shadow-md'
                      : 'bg-noir-900/90 border-gold-500/35 text-cream-200 hover:bg-noir-800'
                  }`}
                >
                  Spare All (Skip)
                </button>
              )}
              <span className="text-[11px] sm:text-xs text-cream-200 truncate">
                {selectedVoteTarget === SKIP_VOTE_TARGET
                  ? 'Ballot: Spare everyone today'
                  : selectedVoteTarget
                    ? `Target Locked: ${playerMap.get(selectedVoteTarget)?.name}`
                    : 'Tap a player card to target'}
              </span>
            </div>
            <button
              type="button"
              disabled={!selectedVoteTarget}
              data-sfx="none"
              onClick={() => {
                if (!selectedVoteTarget) return;
                soundEngine.playChipClink();
                soundEngine.playUiConfirm();
                void castVote(selectedVoteTarget);
              }}
              className="w-full sm:w-auto px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:brightness-110 text-white font-display font-bold uppercase tracking-wider text-xs border border-crimson-300/40 shadow-[0_0_20px_rgba(201,42,55,0.45)] disabled:opacity-40 transition cursor-pointer"
            >
              Confirm Ballot
            </button>
          </>
        )}
      </div>
    ) : !amAlive ? (
      <div className="game-hud-glass rounded-full px-3 sm:px-4 py-1.5 text-center text-[11px] sm:text-xs text-cream-300 mx-auto w-fit max-w-full">
        Spectating from the shadows • Open Chat to whisper with ghosts
      </div>
    ) : null;

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col min-h-0">
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
            ? 'Orbit the table, read expressions & point accusations'
            : phase === 'DAY_VOTE'
              ? 'Select a dossier card above a chair, then lock your ballot'
              : 'Verdict complete'
        }
        fillViewport
        overlayTopLeft={topLeftHud}
        overlayTopRight={topRightHud}
        overlayBottom={bottomActionHud}
      />

      {/* Floating Verdict Modal Card over Full-Screen 3D Table */}
      <AnimatePresence>
        {phase === 'VOTE_RESULT' && voteResult && !verdictMinimized && (
          <div className="fixed inset-0 z-[970] flex items-center justify-center p-3 sm:p-5 pointer-events-none">
            <motion.section
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="pointer-events-auto w-full max-w-xl max-h-[86dvh] flex flex-col p-[2px] rounded-2xl foil-card-frame overflow-hidden"
            >
              <div className="rounded-[14px] bg-gradient-to-b from-[#161c2d]/95 to-[#090c15] backdrop-blur-xl p-4 sm:p-6 flex flex-col min-h-0 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-gold-500/25 pb-3.5 shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-noir-950 border border-gold-400/40 shrink-0">
                      <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-gold-300" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base sm:text-xl text-cream-50 uppercase tracking-wider break-words">
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
                            ? 'The council chose to spare everyone today.'
                            : 'The gavel has fallen at the round table.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-sfx="none"
                    onClick={() => {
                      soundEngine.playUiModalClose();
                      setVerdictMinimized(true);
                    }}
                    aria-label="Minimize verdict overlay to inspect table"
                    className="shrink-0 p-1.5 rounded-lg bg-noir-900/80 hover:bg-noir-800 border border-gold-500/30 text-cream-300 hover:text-cream-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {voteResult.eliminatedPlayerId && voteResult.eliminatedRole && (
                  <div
                    className={`shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                      ROLE_META[voteResult.eliminatedRole].badgeBgClass
                    }`}
                  >
                    <RoleSvgIcon role={voteResult.eliminatedRole} className="w-8 h-8 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider opacity-80">
                        Dossier Unsealed
                      </div>
                      <div className="font-display font-bold text-sm uppercase">
                        {ROLE_META[voteResult.eliminatedRole].label}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
                  {voteResult.tally.length === 0 ? (
                    <p className="text-sm text-cream-400 italic">No ballots were cast.</p>
                  ) : (
                    voteResult.tally.map((entry) => {
                      const pct =
                        totalBallots > 0 ? Math.round((entry.count / totalBallots) * 100) : 0;
                      const voterNames = entry.voterIds
                        .map((id) => playerMap.get(id)?.name ?? 'Unknown')
                        .join(', ');
                      return (
                        <div key={entry.targetId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-semibold text-cream-100">{entry.targetName}</span>
                            <span className="font-mono text-gold-300">
                              {entry.count} {entry.count === 1 ? 'vote' : 'votes'}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-noir-950 overflow-hidden border border-gold-500/20">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className={`h-full ${
                                entry.targetId === voteResult.eliminatedPlayerId
                                  ? 'bg-crimson-500'
                                  : entry.targetId === SKIP_VOTE_TARGET
                                    ? 'bg-cream-400/60'
                                    : 'bg-gold-500/75'
                              }`}
                            />
                          </div>
                          <div className="text-[11px] text-cream-400">Voted by: {voterNames}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-Over Floating Chat Drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.aside
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.2 }}
            className="fixed right-2.5 sm:right-5 bottom-2.5 sm:bottom-14 w-[min(24rem,calc(100vw-1.25rem))] z-[975] shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
          >
            <ChatPanel
              className="h-[min(23rem,calc(100dvh-7rem))] sm:h-80 lg:h-[26rem]"
              onClose={() => {
                soundEngine.playUiModalClose();
                setChatOpen(false);
              }}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
