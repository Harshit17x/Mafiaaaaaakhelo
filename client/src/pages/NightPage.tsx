import React, { useEffect, useRef } from 'react';
import { Check, Moon, Search, Shield, Skull } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { ChatPanel } from '../components/ChatPanel';
import { CountdownBadge } from '../components/CountdownBadge';
import { useGameStore } from '../stores/useGameStore';

export function NightPage({
  speakingPeerIds = new Set<string>(),
}: {
  speakingPeerIds?: Set<string>;
}) {
  const room = useGameStore((s) => s.room);
  const nightMafiaSelect = useGameStore((s) => s.nightMafiaSelect);
  const nightMafiaConfirmTruce = useGameStore((s) => s.nightMafiaConfirmTruce);
  const nightHealerSelect = useGameStore((s) => s.nightHealerSelect);
  const nightDetectiveSelect = useGameStore((s) => s.nightDetectiveSelect);

  const lockedMafiaTargetId =
    room?.game.night?.subPhase === 'MAFIA_TURN'
      ? (room.game.night.mafiaLockedTargetId ?? null)
      : null;
  const prevLockedMafiaTargetRef = useRef<string | null>(lockedMafiaTargetId);

  useEffect(() => {
    if (lockedMafiaTargetId && lockedMafiaTargetId !== prevLockedMafiaTargetRef.current) {
      soundEngine.playGunshot();
    }
    prevLockedMafiaTargetRef.current = lockedMafiaTargetId;
  }, [lockedMafiaTargetId]);

  if (!room || !room.game.night) return null;

  const { night, roundNumber, paused, myRole, detectiveHistory, fellowMafiaIds } = room.game;
  const me = room.players.find((p) => p.id === room.myPlayerId);
  const alivePlaying = room.players.filter((p) => p.isPlaying && p.isAlive);
  const playerMap = new Map(room.players.map((p) => [p.id, p]));

  const canUseNightChat =
    night.canAct &&
    night.subPhase === 'MAFIA_TURN' &&
    me?.role === 'MAFIA' &&
    me.isAlive;
  const isHumanNarrator = Boolean(me && !me.isPlaying);

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-noir-900/90 border border-gold-500/35 shrink-0">
            <Moon className="w-5 h-5 text-gold-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] text-gold-400">
              Night {roundNumber}
            </div>
            <h2 className="font-display text-lg sm:text-2xl text-cream-100 uppercase tracking-wider leading-tight">
              {night.canAct || isHumanNarrator ? night.narrationText : 'The City Sleeps'}
            </h2>
          </div>
        </div>
        {night.canAct && (
          <CountdownBadge endsAt={night.subPhaseEndsAt} paused={paused} label="Turn" />
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {isHumanNarrator ? (
            <div className="noir-card art-deco-border rounded-2xl p-6 sm:p-8 text-center space-y-3">
              <h3 className="font-display text-lg sm:text-xl text-gold-200 uppercase tracking-wider">
                Narrator Directing Night {roundNumber}
              </h3>
              <p className="text-sm text-cream-300">
                Use the Narrator God View panel above to wake each role, watch submissions live,
                and bring the city to Dawn.
              </p>
            </div>
          ) : !night.canAct ? (
            <div className="noir-card art-deco-border rounded-2xl p-6 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-noir-950 border border-gold-500/30 flex items-center justify-center">
                <Moon className="w-8 h-8 text-gold-300/80 animate-pulse" />
              </div>
              <h3 className="font-display text-xl text-gold-200 uppercase tracking-wider">
                Keep Your Eyes Closed
              </h3>
              <p className="text-sm text-cream-400 max-w-md mx-auto leading-relaxed">
                Footsteps echo down wet cobblestones. Wait quietly until dawn breaks over
                Midnight City.
              </p>
              {myRole === 'DETECTIVE' && detectiveHistory.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gold-500/20 text-left max-w-sm mx-auto">
                  <div className="text-xs uppercase tracking-wider text-sky-300 font-semibold mb-2">
                    Your Case Notes
                  </div>
                  <ul className="space-y-1 text-xs text-cream-300">
                    {detectiveHistory.map((item) => (
                      <li key={`${item.nightNumber}-${item.targetId}`} className="flex justify-between">
                        <span>
                          Night {item.nightNumber}: {item.targetName}
                        </span>
                        <span
                          className={
                            item.isMafia ? 'text-crimson-400 font-bold' : 'text-emerald-300 font-semibold'
                          }
                        >
                          {item.isMafia ? 'MAFIA' : 'NOT MAFIA'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : night.subPhase === 'MAFIA_TURN' ? (
            <div className="noir-card border-2 border-crimson-500/50 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-crimson-300 font-display text-lg uppercase">
                  <Skull className="w-5 h-5" />
                  Syndicate Strike
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {fellowMafiaIds.map((mId) => {
                    const m = playerMap.get(mId);
                    if (!m) return null;
                    const talking = speakingPeerIds.has(mId);
                    return (
                      <span
                        key={mId}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                          talking
                            ? 'bg-emerald-900/70 border-emerald-400 text-emerald-200'
                            : 'bg-noir-900 border-crimson-500/35 text-crimson-200'
                        }`}
                      >
                        {m.name}
                      </span>
                    );
                  })}
                  {night.mafiaLockedTargetId && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-crimson-900/70 border border-crimson-500/50 text-crimson-200">
                      Target Locked
                    </span>
                  )}
                </div>
              </div>

              {night.skipKillTonight ? (
                <div className="space-y-4">
                  <p className="text-sm text-cream-300">
                    First-night kill is disabled by room settings. Recognize your fellow Syndicate
                    members and plan tomorrow&apos;s alibi.
                  </p>
                  <button
                    type="button"
                    disabled={night.hasSubmitted}
                    data-sfx="none"
                    onClick={() => {
                      soundEngine.playUiConfirm();
                      void nightMafiaConfirmTruce();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-semibold text-sm disabled:opacity-50"
                  >
                    {night.hasSubmitted ? 'Ready for Dawn ✓' : 'Confirm Ready'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-cream-400">
                    Select a target. All alive Mafia must agree to lock early, or the leading
                    target is chosen when time expires.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {alivePlaying
                      .filter((p) => !fellowMafiaIds.includes(p.id))
                      .map((target) => {
                        const selected = night.mySelection === target.id;
                        const votersForTarget = Object.entries(night.mafiaVotes ?? {})
                          .filter(([, targetId]) => targetId === target.id)
                          .map(([voterId]) => playerMap.get(voterId)?.name ?? 'Mafia');
                        return (
                          <button
                            key={target.id}
                            type="button"
                            data-sfx="none"
                            onClick={() => {
                              soundEngine.playCardSelect();
                              void nightMafiaSelect(target.id);
                            }}
                            className={`text-left rounded-xl p-3 border transition flex items-center justify-between gap-2 ${
                              selected
                                ? 'bg-crimson-900/70 border-crimson-400 text-white'
                                : 'bg-noir-900/80 border-gold-500/20 hover:border-crimson-400/50 text-cream-100'
                            }`}
                          >
                            <span className="font-medium text-sm truncate min-w-0">{target.name}</span>
                            {votersForTarget.length > 0 && (
                              <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-crimson-950 text-crimson-200 border border-crimson-500/40">
                                {votersForTarget.join(', ')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          ) : night.subPhase === 'HEALER_TURN' ? (
            <div className="noir-card border-2 border-emerald-500/45 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-300 font-display text-lg uppercase">
                <Shield className="w-5 h-5" />
                Protect a Soul
              </div>
              <p className="text-xs text-cream-400">
                Choose one player to guard tonight.
                {!night.healerCanSelfSave && ' Self-protection is unavailable tonight.'}
              </p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {alivePlaying.map((target) => {
                  const isSelf = target.id === room.myPlayerId;
                  const disabledTarget =
                    night.hasSubmitted || (isSelf && !night.healerCanSelfSave);
                  const selected = night.mySelection === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      disabled={disabledTarget}
                      data-sfx="none"
                      onClick={() => {
                        soundEngine.playHealChime();
                        void nightHealerSelect(target.id);
                      }}
                      className={`text-left rounded-xl p-3 border transition flex items-center justify-between ${
                        selected
                          ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100'
                          : 'bg-noir-900/80 border-gold-500/20 hover:border-emerald-400/50 text-cream-100 disabled:opacity-40'
                      }`}
                    >
                      <span className="font-medium text-sm truncate min-w-0">
                        {target.name} {isSelf ? '(Yourself)' : ''}
                      </span>
                      {selected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {night.hasSubmitted && (
                <p className="text-xs text-emerald-300">
                  Protection locked in. Waiting quietly for night to conclude...
                </p>
              )}
            </div>
          ) : night.subPhase === 'DETECTIVE_TURN' ? (
            <div className="noir-card border-2 border-sky-500/45 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sky-300 font-display text-lg uppercase">
                <Search className="w-5 h-5" />
                Private Investigation
              </div>
              <p className="text-xs text-cream-400">
                Inspect one living citizen to learn whether they belong to the Syndicate.
              </p>

              <div className="grid sm:grid-cols-2 gap-2.5">
                {alivePlaying
                  .filter((p) => p.id !== room.myPlayerId)
                  .map((target) => {
                    const selected = night.mySelection === target.id;
                    return (
                      <button
                        key={target.id}
                        type="button"
                        disabled={night.hasSubmitted}
                        data-sfx="none"
                        onClick={() => {
                          soundEngine.playInvestigate();
                          void nightDetectiveSelect(target.id);
                        }}
                        className={`text-left rounded-xl p-3 border transition flex items-center justify-between ${
                          selected
                            ? 'bg-sky-950/80 border-sky-400 text-sky-100'
                            : 'bg-noir-900/80 border-gold-500/20 hover:border-sky-400/50 text-cream-100 disabled:opacity-40'
                        }`}
                      >
                        <span className="font-medium text-sm truncate min-w-0">{target.name}</span>
                        {selected && <Check className="w-4 h-4 text-sky-300 shrink-0" />}
                      </button>
                    );
                  })}
              </div>

              {night.detectiveResult && (
                <div
                  role="status"
                  className={`rounded-xl p-4 border ${
                    night.detectiveResult.isMafia
                      ? 'bg-crimson-900/60 border-crimson-400/60 text-crimson-100'
                      : 'bg-emerald-950/70 border-emerald-400/60 text-emerald-100'
                  }`}
                >
                  <div className="text-xs uppercase tracking-wider opacity-80">
                    Case File Result
                  </div>
                  <div className="font-display text-lg font-bold mt-0.5">
                    {night.detectiveResult.targetName} is{' '}
                    {night.detectiveResult.isMafia ? 'MAFIA' : 'NOT MAFIA'}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          {canUseNightChat ? (
            <ChatPanel className="h-72 sm:h-80 lg:h-[26rem]" />
          ) : (
            <div className="noir-card rounded-2xl p-6 text-center text-xs text-cream-400 space-y-2">
              <div className="font-display uppercase tracking-wider text-gold-300 text-sm">
                Night Silence
              </div>
              <p>
                All communications are blacked out until morning.
                {me && !me.isAlive && room.settings.allowDeadChat
                  ? ' Ghost chat resumes at Dawn.'
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
