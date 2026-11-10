import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FastForward,
  Pause,
  Play,
  Plus,
  SkipForward,
  UserX,
} from 'lucide-react';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';
import { useGameStore } from '../stores/useGameStore';

export function GodViewPanel() {
  const room = useGameStore((s) => s.room);
  const hostAdvanceNightStep = useGameStore((s) => s.hostAdvanceNightStep);
  const hostStartDiscussion = useGameStore((s) => s.hostStartDiscussion);
  const hostStartVote = useGameStore((s) => s.hostStartVote);
  const hostEndVoteEarly = useGameStore((s) => s.hostEndVoteEarly);
  const hostAdvanceFromVoteResult = useGameStore((s) => s.hostAdvanceFromVoteResult);
  const hostTogglePause = useGameStore((s) => s.hostTogglePause);
  const hostExtendTimer = useGameStore((s) => s.hostExtendTimer);
  const hostForceDisconnectedActions = useGameStore(
    (s) => s.hostForceDisconnectedActions
  );

  const [collapsed, setCollapsed] = useState(false);

  const godView = room?.game.godView ?? null;
  if (!room || !godView) return null;

  const { game, players, settings } = room;
  const god = godView;
  const playingPlayers = players.filter((p) => p.isPlaying);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const hasDisconnected = playingPlayers.some((p) => !p.connected);

  const getNextStepLabel = () => {
    switch (god.actualNightSubPhase) {
      case 'SLEEPING':
        return 'Mafia, Wake Up';
      case 'MAFIA_TURN':
        if (settings.healerEnabled) return 'Mafia Sleep → Healer Wake Up';
        if (settings.detectiveEnabled) return 'Mafia Sleep → Detective Wake Up';
        return 'Mafia Sleep → City Wake Up (Dawn)';
      case 'HEALER_TURN':
        if (settings.detectiveEnabled) return 'Healer Sleep → Detective Wake Up';
        return 'Healer Sleep → City Wake Up (Dawn)';
      case 'DETECTIVE_TURN':
        return 'Detective Sleep → City Wake Up (Dawn)';
      case 'DAWN_TRANSITION':
        return 'City Wake Up (Dawn)';
    }
  };

  const getNarratorScript = () => {
    switch (game.phase) {
      case 'ROLE_REVEAL':
        return 'Wait for all players to peek at their dossier and press I Understand.';
      case 'NIGHT':
        switch (god.actualNightSubPhase) {
          case 'SLEEPING':
            return 'Read aloud: "Night falls over Midnight City. Everyone, close your eyes."';
          case 'MAFIA_TURN':
            return 'Read aloud: "Mafia, wake up. Open your eyes and choose your target."';
          case 'HEALER_TURN':
            return 'Read aloud: "Mafia, close your eyes. Healer, wake up and protect someone."';
          case 'DETECTIVE_TURN':
            return 'Read aloud: "Healer, close your eyes. Detective, wake up and investigate."';
          case 'DAWN_TRANSITION':
            return 'Read aloud: "Close your eyes. The sun is rising."';
        }
        break;
      case 'DAWN':
        return game.dawn?.killedPlayerName
          ? `Announce aloud: "The city wakes! ${game.dawn.killedPlayerName} was found dead."`
          : 'Announce aloud: "The city wakes! Nobody died tonight."';
      case 'DAY_DISCUSSION':
        return 'Moderate the town discussion. Start the vote when ready.';
      case 'DAY_VOTE':
        return 'Players are casting ballots. Close ballot early or wait for everyone.';
      case 'VOTE_RESULT':
        return game.voteResult?.needsRevote
          ? 'Announce the tie and begin the revote.'
          : 'Announce the verdict and advance when ready.';
      default:
        return '';
    }
  };

  return (
    <section
      aria-label="Host God View Panel"
      className="noir-card border-2 border-gold-400/55 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(212,168,79,0.16)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gold-500/15 border-b border-gold-500/30">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-gold-300" aria-hidden="true" />
          <h2 className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-gold-200">
            Narrator God View
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-noir-950/80 border border-gold-500/40 text-gold-300 font-mono">
            {game.phase === 'NIGHT' ? god.actualNightSubPhase : game.phase}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-noir-900/80 hover:bg-noir-800 text-xs text-gold-200 border border-gold-500/30"
        >
          {collapsed ? (
            <>
              Expand <ChevronDown className="w-4 h-4" />
            </>
          ) : (
            <>
              Collapse <ChevronUp className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 sm:p-5 space-y-5">
          <div className="rounded-xl bg-noir-950/80 border border-gold-500/30 p-3.5 text-sm text-gold-100">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold-400 font-semibold mb-1">
              Narrator Prompt
            </div>
            <p className="font-serif italic text-base">{getNarratorScript()}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {game.phase === 'NIGHT' && (
              <button
                type="button"
                onClick={() => void hostAdvanceNightStep()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                {getNextStepLabel()}
              </button>
            )}

            {game.phase === 'DAWN' && (
              <button
                type="button"
                onClick={() => void hostStartDiscussion()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                <FastForward className="w-4 h-4" />
                Open Day Discussion
              </button>
            )}

            {game.phase === 'DAY_DISCUSSION' && (
              <button
                type="button"
                onClick={() => void hostStartVote()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:brightness-110 text-white font-display font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                <FastForward className="w-4 h-4" />
                Start Day Vote
              </button>
            )}

            {game.phase === 'DAY_VOTE' && (
              <button
                type="button"
                onClick={() => void hostEndVoteEarly()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:brightness-110 text-white font-display font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                <FastForward className="w-4 h-4" />
                Reveal Tally Now
              </button>
            )}

            {game.phase === 'VOTE_RESULT' && (
              <button
                type="button"
                onClick={() => void hostAdvanceFromVoteResult()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                <SkipForward className="w-4 h-4" />
                {game.voteResult?.needsRevote ? 'Begin Revote' : 'Advance to Next Phase'}
              </button>
            )}

            {game.phase !== 'LOBBY' && game.phase !== 'GAME_OVER' && (
              <>
                <button
                  type="button"
                  onClick={() => void hostTogglePause(!game.paused)}
                  className="px-3.5 py-2 rounded-xl border border-gold-500/40 bg-noir-800 hover:bg-noir-700 text-xs font-semibold text-gold-200 inline-flex items-center gap-1.5"
                >
                  {game.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {game.paused ? 'Resume' : 'Pause'}
                </button>

                {game.phaseEndsAt !== null && (
                  <button
                    type="button"
                    onClick={() => void hostExtendTimer(30)}
                    className="px-3 py-2 rounded-xl border border-gold-500/35 bg-noir-800 hover:bg-noir-700 text-xs font-semibold text-cream-200 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    30s
                  </button>
                )}

                {hasDisconnected && (
                  <button
                    type="button"
                    onClick={() => void hostForceDisconnectedActions()}
                    className="px-3 py-2 rounded-xl border border-amber-500/50 bg-amber-950/70 hover:bg-amber-900 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Force Disconnected Actions
                  </button>
                )}
              </>
            )}
          </div>

          {game.phase === 'NIGHT' && (
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-noir-900/80 border border-gold-500/20 p-3.5 space-y-2">
                <div className="font-semibold uppercase tracking-wider text-gold-300">
                  Live Night Actions
                </div>
                <div className="space-y-1.5 text-cream-200">
                  <div>
                    <span className="text-crimson-300 font-semibold">Mafia Target:</span>{' '}
                    {god.nightOutcome.pendingMafiaTargetName ??
                      (settings.skipFirstNightKill && game.roundNumber === 1
                        ? 'Skipped (Night 1 truce)'
                        : 'Pending...')}
                    {Object.keys(god.mafiaVotes).length > 0 && (
                      <div className="text-[11px] text-cream-400 pl-2 mt-0.5">
                        {Object.entries(god.mafiaVotes)
                          .map(
                            ([mId, tId]) =>
                              `${playerMap.get(mId)?.name ?? mId} → ${
                                playerMap.get(tId)?.name ?? tId
                              }`
                          )
                          .join(' | ')}
                      </div>
                    )}
                  </div>
                  {settings.healerEnabled && (
                    <div>
                      <span className="text-emerald-300 font-semibold">Healer Guard:</span>{' '}
                      {god.healerSubmitted
                        ? (god.nightOutcome.pendingHealerTargetName ?? 'Skipped')
                        : 'Pending...'}
                    </div>
                  )}
                  {settings.detectiveEnabled && (
                    <div>
                      <span className="text-sky-300 font-semibold">Detective Check:</span>{' '}
                      {god.detectiveSubmitted
                        ? `${god.nightOutcome.pendingDetectiveTargetName ?? 'Skipped'} (${
                            god.detectiveResult?.isMafia ? 'MAFIA' : 'NOT MAFIA'
                          })`
                        : 'Pending...'}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-noir-900/80 border border-gold-500/20 p-3.5 space-y-2">
                <div className="font-semibold uppercase tracking-wider text-gold-300">
                  Projected Dawn Outcome
                </div>
                <div className="text-sm font-semibold text-cream-100">
                  {god.nightOutcome.projectedKilledPlayerName
                    ? `${god.nightOutcome.projectedKilledPlayerName} will die`
                    : god.nightOutcome.projectedSavedByHealer
                      ? `Nobody dies (Healer saved ${god.nightOutcome.pendingMafiaTargetName})`
                      : god.nightOutcome.projectedBlockedByJoker
                        ? `Nobody dies (Joker immunity blocked kill on ${god.nightOutcome.pendingMafiaTargetName})`
                        : 'Nobody dies tonight'}
                </div>
              </div>
            </div>
          )}

          {game.phase === 'DAY_VOTE' && Object.keys(god.liveVotes).length > 0 && (
            <div className="rounded-xl bg-noir-900/80 border border-gold-500/20 p-3.5 text-xs space-y-1.5">
              <div className="font-semibold uppercase tracking-wider text-gold-300">
                Live Ballots (Hidden from Players)
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(god.liveVotes).map(([voterId, targetId]) => (
                  <span
                    key={voterId}
                    className="px-2.5 py-1 rounded-lg bg-noir-950 border border-gold-500/25 text-cream-200"
                  >
                    {playerMap.get(voterId)?.name} →{' '}
                    {playerMap.get(targetId)?.name ?? 'Skip'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
              All Player Dossiers
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
              {playingPlayers.map((p) => {
                const role = p.role ?? 'VILLAGER';
                const meta = ROLE_META[role];
                const isAwake =
                  game.phase === 'NIGHT' && p.isAlive && god.awakeRole === role;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-2.5 border flex items-center gap-2 ${
                      !p.isAlive
                        ? 'bg-noir-950/70 border-noir-800 opacity-55'
                        : isAwake
                          ? 'bg-gold-500/15 border-gold-400 shadow-[0_0_15px_rgba(212,168,79,0.25)]'
                          : 'bg-noir-900/80 border-gold-500/20'
                    }`}
                  >
                    <RoleSvgIcon role={role} className={`w-6 h-6 shrink-0 ${meta.colorClass}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-cream-100 truncate">{p.name}</div>
                      <div className={`text-[10px] uppercase font-bold ${meta.colorClass}`}>
                        {meta.label}
                        {isAwake ? ' • AWAKE' : !p.isAlive ? ' • DEAD' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
