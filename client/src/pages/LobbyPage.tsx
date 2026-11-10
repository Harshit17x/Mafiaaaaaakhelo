import React, { useState } from 'react';
import type { HealerSelfSaveRule, RoomSettings, TieRule } from '@midnight-city/shared';
import {
  AlertTriangle,
  Check,
  Copy,
  Lock,
  Play,
  SlidersHorizontal,
  Unlock,
} from 'lucide-react';
import { AvatarPolaroidCard } from '../components/AvatarPolaroidCard';
import { ChatPanel } from '../components/ChatPanel';
import { MidnightLoungeTable3D } from '../components/MidnightLoungeTable3D';
import { useGameStore } from '../stores/useGameStore';

export function LobbyPage({
  speakingPeerIds = new Set<string>(),
}: {
  speakingPeerIds?: Set<string>;
}) {
  const room = useGameStore((s) => s.room);
  const setReady = useGameStore((s) => s.setReady);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const kickPlayer = useGameStore((s) => s.kickPlayer);
  const transferHost = useGameStore((s) => s.transferHost);
  const toggleLock = useGameStore((s) => s.toggleLock);
  const startGame = useGameStore((s) => s.startGame);
  const myAvatar = useGameStore((s) => s.myAvatar);
  const setAvatarOpen = useGameStore((s) => s.setAvatarOpen);

  const [copied, setCopied] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  if (!room) return null;

  const me = room.players.find((p) => p.id === room.myPlayerId);
  const isHost = Boolean(me?.isHost);
  const { settings, validation } = room;

  const playingPlayers = room.players.filter((p) => p.isPlaying);
  const notReadyCount = playingPlayers.filter((p) => !p.isReady).length;
  const allPlayingReady = playingPlayers.length > 0 && notReadyCount === 0;
  const canStart = isHost && validation.valid && allPlayingReady;

  const inviteUrl = `${window.location.origin}/?room=${room.roomCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
    }
  };

  const patch = (partial: Partial<RoomSettings>) => {
    if (!isHost) return;
    void updateSettings(partial);
  };

  const startHint = !validation.valid
    ? 'Fix house rules errors to start'
    : !allPlayingReady
      ? `Waiting for ${notReadyCount} player${notReadyCount === 1 ? '' : 's'} to mark Ready`
      : null;

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="noir-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-gold-400">
            Speakeasy Cushion Lounge
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.25em] text-gold-200">
              {room.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold-500/40 bg-noir-800 hover:bg-noir-700 text-xs font-semibold text-gold-200 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied Link
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Invite Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gold-500/40 bg-noir-900/80 hover:bg-noir-800 text-xs font-semibold text-gold-200 transition cursor-pointer"
            >
              <AvatarPolaroidCard
                avatar={me?.avatar ?? myAvatar}
                size="xs"
                showPin={false}
                tiltOverride={-2}
                className="!w-7 !p-0.5 !pb-1"
              />
              <span>Edit Avatar</span>
            </button>

            {isHost && (
              <button
                type="button"
                onClick={() => void toggleLock(!room.locked)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition ${
                  room.locked
                    ? 'border-crimson-500/60 bg-crimson-900/60 text-crimson-200'
                    : 'border-gold-500/40 bg-noir-800 text-cream-200 hover:bg-noir-700'
                }`}
              >
                {room.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {room.locked ? 'Room Locked' : 'Room Open'}
              </button>
            )}

            {me?.isPlaying && (
              <button
                type="button"
                onClick={() => void setReady(!me.isReady)}
                className={`px-5 py-2.5 rounded-xl font-display font-bold uppercase tracking-wider text-sm transition ${
                  me.isReady
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-400/50'
                    : 'bg-noir-800 hover:bg-noir-700 text-gold-200 border border-gold-500/50'
                }`}
              >
                {me.isReady ? 'Ready ✓' : 'Mark Ready'}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={() => void startGame()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 hover:brightness-110 text-noir-950 font-display font-bold uppercase tracking-wider text-sm inline-flex items-center gap-2 disabled:opacity-40 transition"
              >
                <Play className="w-4 h-4" />
                Deal Roles
              </button>
            )}
          </div>
          {isHost && startHint && (
            <span className="text-[11px] text-amber-300/90">{startHint}</span>
          )}
        </div>
      </div>

      <MidnightLoungeTable3D
        players={room.players}
        myPlayerId={room.myPlayerId}
        mode="LOBBY"
        viewerIsHost={isHost}
        speakingPeerIds={speakingPeerIds}
        accuseCounts={new Map()}
        myAccuseTargetId={null}
        selectedVoteTarget={null}
        canAccuse={false}
        canVoteCandidate={() => false}
        onTransferHost={(id) => void transferHost(id)}
        onKickPlayer={(id) => void kickPlayer(id)}
        centerTitle={`Lounge Cushions (${playingPlayers.length}/16 Seated)`}
        centerSubtitle="5–16 players required • Chill and chat while gathering"
      />

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <ChatPanel />
        </div>

        <div className="lg:col-span-7">
          <section className="noir-card rounded-2xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-500/20 pb-3">
              <div>
                <h2 className="font-display text-lg text-gold-200 uppercase tracking-wider">
                  House Rules &amp; Roles
                </h2>
                <p className="text-xs text-cream-400">
                  {isHost
                    ? 'Adjust rules below — updates live for everyone.'
                    : 'Only the Host can modify rules.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isHost && settings.mafiaCount !== validation.suggestedMafiaCount ? (
                  <button
                    type="button"
                    onClick={() => patch({ mafiaCount: validation.suggestedMafiaCount })}
                    className="text-xs px-3 py-1 rounded-full border border-gold-400/50 bg-gold-500/15 hover:bg-gold-500/25 text-gold-200 transition"
                  >
                    Use Suggested ({validation.suggestedMafiaCount})
                  </button>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full border border-gold-500/30 bg-noir-900 text-gold-300">
                    Suggested Mafia: {validation.suggestedMafiaCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsExpanded((v) => !v)}
                  className="p-1.5 rounded-lg bg-noir-800 border border-gold-500/25 text-cream-300 hover:text-gold-200 lg:hidden"
                  aria-label="Toggle house rules"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {settingsExpanded && (
              <div className="space-y-5">
                {validation.errors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-xl bg-crimson-900/50 border border-crimson-500/60 p-3 space-y-1 text-xs text-crimson-200"
                  >
                    {validation.errors.map((err) => (
                      <div key={err} className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-crimson-400" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-950/60 border border-amber-500/50 p-3 space-y-1 text-xs text-amber-200">
                    {validation.warnings.map((warn) => (
                      <div key={warn} className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3.5 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                      Narrator Mode
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!isHost}
                        onClick={() => patch({ narratorMode: 'AUTO_NARRATOR' })}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                          settings.narratorMode === 'AUTO_NARRATOR'
                            ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                            : 'bg-noir-950/60 border-noir-700 text-cream-400'
                        }`}
                      >
                        Auto-Narrator
                      </button>
                      <button
                        type="button"
                        disabled={!isHost}
                        onClick={() => patch({ narratorMode: 'HUMAN_HOST' })}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                          settings.narratorMode === 'HUMAN_HOST'
                            ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                            : 'bg-noir-950/60 border-noir-700 text-cream-400'
                        }`}
                      >
                        Human Host
                      </button>
                    </div>
                    <p className="text-[11px] text-cream-400">
                      {settings.narratorMode === 'HUMAN_HOST'
                        ? 'Host does not play, sees God View, and triggers each phase.'
                        : 'Server narrates automatically via voice synthesis & timers.'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3.5 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                      Mafia Count
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={!isHost || settings.mafiaCount <= 1}
                        onClick={() => patch({ mafiaCount: settings.mafiaCount - 1 })}
                        className="w-9 h-9 rounded-lg border border-gold-500/35 bg-noir-800 text-lg font-bold disabled:opacity-40"
                        aria-label="Decrease Mafia count"
                      >
                        -
                      </button>
                      <span className="font-mono text-2xl font-bold text-crimson-400">
                        {settings.mafiaCount}
                      </span>
                      <button
                        type="button"
                        disabled={!isHost || settings.mafiaCount >= 8}
                        onClick={() => patch({ mafiaCount: settings.mafiaCount + 1 })}
                        className="w-9 h-9 rounded-lg border border-gold-500/35 bg-noir-800 text-lg font-bold disabled:opacity-40"
                        aria-label="Increase Mafia count"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[11px] text-cream-400">
                      5-6→1, 7-9→2, 10-12→3, 13-16→4
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  {[
                    { key: 'healerEnabled', label: 'Healer Role', disabledWhen: false },
                    { key: 'detectiveEnabled', label: 'Detective Role', disabledWhen: false },
                    { key: 'jokerEnabled', label: 'Joker Role', disabledWhen: false },
                    {
                      key: 'jokerWinEndsGame',
                      label: 'Joker Win Ends Game',
                      disabledWhen: !settings.jokerEnabled,
                    },
                    {
                      key: 'jokerNightImmunity',
                      label: 'Joker Immune to Night Kill',
                      disabledWhen: !settings.jokerEnabled,
                    },
                    { key: 'revealRoleOnDeath', label: 'Reveal Role on Death', disabledWhen: false },
                    { key: 'skipFirstNightKill', label: 'Skip First-Night Kill', disabledWhen: false },
                    { key: 'allowDeadChat', label: 'Allow Ghost Chat', disabledWhen: false },
                    { key: 'allowSkipVote', label: 'Allow Skip Vote', disabledWhen: false },
                  ].map((toggle) => {
                    const checked = Boolean(settings[toggle.key as keyof RoomSettings]);
                    const isDisabled = !isHost || toggle.disabledWhen;
                    return (
                      <label
                        key={toggle.key}
                        className={`flex items-center justify-between gap-3 rounded-xl bg-noir-900/65 border border-gold-500/15 px-3.5 py-2.5 ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <span className="text-cream-200">{toggle.label}</span>
                        <input
                          type="checkbox"
                          disabled={isDisabled}
                          checked={checked}
                          onChange={(e) =>
                            patch({ [toggle.key]: e.target.checked } as Partial<RoomSettings>)
                          }
                          className="w-4 h-4 accent-gold-500"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <label className="block space-y-1">
                    <span className="text-gold-300 font-semibold uppercase text-xs tracking-wider">
                      Healer Self-Save Rule
                    </span>
                    <select
                      disabled={!isHost || !settings.healerEnabled}
                      value={settings.healerSelfSaveRule}
                      onChange={(e) =>
                        patch({ healerSelfSaveRule: e.target.value as HealerSelfSaveRule })
                      }
                      className="w-full rounded-xl bg-noir-950 border border-gold-500/30 px-3 py-2 text-cream-100 disabled:opacity-50"
                    >
                      <option value="not_consecutive">Not on consecutive nights (Default)</option>
                      <option value="unlimited">Unlimited</option>
                      <option value="once_per_game">Once per game</option>
                      <option value="never">Never</option>
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-gold-300 font-semibold uppercase text-xs tracking-wider">
                      Vote Tie Rule
                    </span>
                    <select
                      disabled={!isHost}
                      value={settings.tieRule}
                      onChange={(e) => patch({ tieRule: e.target.value as TieRule })}
                      className="w-full rounded-xl bg-noir-950 border border-gold-500/30 px-3 py-2 text-cream-100"
                    >
                      <option value="no_elimination">Nobody eliminated (Default)</option>
                      <option value="revote_then_no_elimination">One revote, then nobody</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="text-cream-300 font-semibold">Discussion</span>
                    <select
                      disabled={!isHost}
                      value={settings.discussionTimeSec ?? 'off'}
                      onChange={(e) =>
                        patch({
                          discussionTimeSec:
                            e.target.value === 'off' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2 py-2 text-cream-100"
                    >
                      <option value="off">Off</option>
                      <option value={60}>60s</option>
                      <option value={120}>120s</option>
                      <option value={180}>180s</option>
                      <option value={240}>240s</option>
                      <option value={300}>300s</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-cream-300 font-semibold">Voting</span>
                    <select
                      disabled={!isHost}
                      value={settings.votingTimeSec ?? 'off'}
                      onChange={(e) =>
                        patch({
                          votingTimeSec:
                            e.target.value === 'off' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2 py-2 text-cream-100"
                    >
                      <option value="off">Off</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-cream-300 font-semibold">Night Action</span>
                    <select
                      disabled={!isHost}
                      value={settings.nightActionTimeSec ?? 'off'}
                      onChange={(e) =>
                        patch({
                          nightActionTimeSec:
                            e.target.value === 'off' ? null : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2 py-2 text-cream-100"
                    >
                      <option value="off">Off</option>
                      <option value={20}>20s</option>
                      <option value={30}>30s</option>
                      <option value={45}>45s</option>
                      <option value={60}>60s</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-xl bg-noir-950/75 border border-gold-500/25 p-3.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gold-300 mb-2">
                    Final Role Breakdown (Counts Only)
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-crimson-900/60 border border-crimson-500/50 text-crimson-200">
                      Mafia: {validation.breakdown.mafia}
                    </span>
                    {validation.breakdown.healer > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-200">
                        Healer: {validation.breakdown.healer}
                      </span>
                    )}
                    {validation.breakdown.detective > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-sky-950/60 border border-sky-500/40 text-sky-200">
                        Detective: {validation.breakdown.detective}
                      </span>
                    )}
                    {validation.breakdown.joker > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-200">
                        Joker: {validation.breakdown.joker}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-full bg-gold-700/25 border border-gold-500/40 text-gold-200">
                      Villagers: {validation.breakdown.villager}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
