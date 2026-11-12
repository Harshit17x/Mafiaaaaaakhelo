import React, { useState } from 'react';
import { validateSettings } from '@midnight-city/shared';
import type { HealerSelfSaveRule, RoomSettings, TieRule } from '@midnight-city/shared';
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Vote,
  Zap,
} from 'lucide-react';
import { RoleSvgIcon } from './RoleIcons';

export interface HouseRulesEditorProps {
  settings: RoomSettings;
  onChange: (partial: Partial<RoomSettings>) => void;
  onReset?: () => void;
}

export function HouseRulesEditor({ settings, onChange, onReset }: HouseRulesEditorProps) {
  const [previewPlayers, setPreviewPlayers] = useState(6);
  const validation = validateSettings(previewPlayers, settings);

  // 1-Click Presets for fast setup
  const applyPreset = (preset: 'classic' | 'chaos' | 'speed') => {
    if (preset === 'classic') {
      onChange({
        narratorMode: 'AUTO_NARRATOR',
        healerEnabled: true,
        detectiveEnabled: true,
        jokerEnabled: false,
        revealRoleOnDeath: true,
        skipFirstNightKill: false,
        allowDeadChat: true,
        allowSkipVote: true,
        healerSelfSaveRule: 'not_consecutive',
        tieRule: 'no_elimination',
        discussionTimeSec: 180,
        votingTimeSec: 45,
        nightActionTimeSec: 30,
      });
    } else if (preset === 'chaos') {
      onChange({
        narratorMode: 'AUTO_NARRATOR',
        healerEnabled: true,
        detectiveEnabled: true,
        jokerEnabled: true,
        jokerWinEndsGame: true,
        jokerNightImmunity: true,
        revealRoleOnDeath: false,
        allowDeadChat: true,
        allowSkipVote: true,
        tieRule: 'revote_then_no_elimination',
      });
    } else if (preset === 'speed') {
      onChange({
        narratorMode: 'AUTO_NARRATOR',
        discussionTimeSec: 90,
        votingTimeSec: 30,
        nightActionTimeSec: 20,
        allowSkipVote: true,
      });
    }
  };

  return (
    <section
      aria-label="House Rules and Roles"
      className="rounded-2xl border border-gold-500/25 bg-noir-950/90 p-4 sm:p-5 space-y-4"
    >
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-gold-500/20 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base sm:text-lg text-gold-200 uppercase tracking-wider">
            House Rules
          </h3>
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cream-400">
              Presets:
            </span>
            <button
              type="button"
              data-sfx="tab"
              onClick={() => applyPreset('classic')}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-gold-500/30 bg-noir-900 hover:bg-gold-500/20 text-gold-200 transition cursor-pointer"
            >
              Classic
            </button>
            <button
              type="button"
              data-sfx="tab"
              onClick={() => applyPreset('chaos')}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-purple-500/40 bg-noir-900 hover:bg-purple-500/20 text-purple-300 transition cursor-pointer"
            >
              Chaos Joker
            </button>
            <button
              type="button"
              data-sfx="tab"
              onClick={() => applyPreset('speed')}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-amber-500/30 bg-noir-900 hover:bg-amber-500/20 text-amber-200 transition cursor-pointer"
            >
              Speed
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settings.mafiaCount !== validation.suggestedMafiaCount ? (
            <button
              type="button"
              data-sfx="chip"
              onClick={() => onChange({ mafiaCount: validation.suggestedMafiaCount })}
              className="text-xs px-2.5 py-1 rounded-lg border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 transition cursor-pointer inline-flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Suggested ({validation.suggestedMafiaCount})
            </button>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-lg border border-gold-500/30 bg-noir-900 text-gold-300 inline-flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" />
              Suggested: {validation.suggestedMafiaCount}
            </span>
          )}

          {onReset && (
            <button
              type="button"
              data-sfx="back"
              onClick={onReset}
              title="Reset rules to default"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gold-500/25 bg-noir-900 hover:bg-noir-800 text-xs font-mono text-cream-300 hover:text-gold-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Validation Alert */}
      {validation.errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-crimson-900/50 border border-crimson-500/60 p-2.5 text-xs text-crimson-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-crimson-400" />
          <span>{validation.errors[0]}</span>
        </div>
      )}

      {/* Primary Row: Narrator & Mafia Count */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Narrator Mode */}
        <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-300 block">
            Narrator Mode
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-sfx="tab"
              onClick={() => onChange({ narratorMode: 'AUTO_NARRATOR' })}
              className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                settings.narratorMode === 'AUTO_NARRATOR'
                  ? 'bg-gold-500/25 border-gold-400 text-gold-200 shadow-sm'
                  : 'bg-noir-950/60 border-noir-700 text-cream-400 hover:text-cream-200'
              }`}
            >
              Auto-Narrator
            </button>
            <button
              type="button"
              data-sfx="tab"
              onClick={() => onChange({ narratorMode: 'HUMAN_HOST' })}
              className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                settings.narratorMode === 'HUMAN_HOST'
                  ? 'bg-gold-500/25 border-gold-400 text-gold-200 shadow-sm'
                  : 'bg-noir-950/60 border-noir-700 text-cream-400 hover:text-cream-200'
              }`}
            >
              Human Host
            </button>
          </div>
        </div>

        {/* Mafia Stepper */}
        <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-300 block">
              Mafia Count
            </span>
            <span className="text-[11px] text-cream-400">
              Syndicate members
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-sfx="chip"
              disabled={settings.mafiaCount <= 1}
              onClick={() => onChange({ mafiaCount: Math.max(1, settings.mafiaCount - 1) })}
              className="w-8 h-8 rounded-lg border border-gold-500/35 bg-noir-800 hover:bg-noir-700 text-gold-200 disabled:opacity-30 cursor-pointer inline-flex items-center justify-center transition"
              aria-label="Decrease Mafia count"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-2xl font-bold text-crimson-400 w-6 text-center tabular-nums">
              {settings.mafiaCount}
            </span>
            <button
              type="button"
              data-sfx="chip"
              disabled={settings.mafiaCount >= 8}
              onClick={() => onChange({ mafiaCount: Math.min(8, settings.mafiaCount + 1) })}
              className="w-8 h-8 rounded-lg border border-gold-500/35 bg-noir-800 hover:bg-noir-700 text-gold-200 disabled:opacity-30 cursor-pointer inline-flex items-center justify-center transition"
              aria-label="Increase Mafia count"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Special Role Toggle Cards */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-300 block">
          Special Roles
        </span>

        <div className="grid sm:grid-cols-3 gap-2.5">
          {/* Healer Role Card */}
          <div
            className={`rounded-xl p-3 border transition flex flex-col justify-between gap-2.5 ${
              settings.healerEnabled
                ? 'bg-emerald-950/40 border-emerald-500/50'
                : 'bg-noir-900/60 border-white/10 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    settings.healerEnabled ? 'bg-emerald-950 text-emerald-300' : 'bg-noir-950 text-cream-400'
                  }`}
                >
                  <RoleSvgIcon role="HEALER" className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-display font-bold text-sm uppercase text-emerald-200 block leading-tight">
                    Healer
                  </span>
                  <span className="text-[10px] text-cream-400">Guards 1 player</span>
                </div>
              </div>

              <button
                type="button"
                data-sfx="toggle"
                onClick={() => onChange({ healerEnabled: !settings.healerEnabled })}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  settings.healerEnabled ? 'bg-emerald-600' : 'bg-noir-800'
                }`}
                aria-pressed={settings.healerEnabled}
                aria-label="Toggle Healer role"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.healerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {settings.healerEnabled && (
              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-1 text-[11px]">
                <span className="text-cream-400">Self-Save:</span>
                <select
                  data-sfx="click"
                  value={settings.healerSelfSaveRule}
                  onChange={(e) =>
                    onChange({ healerSelfSaveRule: e.target.value as HealerSelfSaveRule })
                  }
                  className="rounded bg-noir-950 border border-emerald-500/30 px-1.5 py-0.5 text-emerald-200 text-[11px]"
                >
                  <option value="not_consecutive">Non-Consecutive</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="once_per_game">Once Only</option>
                  <option value="never">Disabled</option>
                </select>
              </div>
            )}
          </div>

          {/* Detective Role Card */}
          <div
            className={`rounded-xl p-3 border transition flex flex-col justify-between gap-2.5 ${
              settings.detectiveEnabled
                ? 'bg-sky-950/40 border-sky-500/50'
                : 'bg-noir-900/60 border-white/10 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    settings.detectiveEnabled ? 'bg-sky-950 text-sky-300' : 'bg-noir-950 text-cream-400'
                  }`}
                >
                  <RoleSvgIcon role="DETECTIVE" className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-display font-bold text-sm uppercase text-sky-200 block leading-tight">
                    Detective
                  </span>
                  <span className="text-[10px] text-cream-400">Tails 1 suspect</span>
                </div>
              </div>

              <button
                type="button"
                data-sfx="toggle"
                onClick={() => onChange({ detectiveEnabled: !settings.detectiveEnabled })}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  settings.detectiveEnabled ? 'bg-sky-600' : 'bg-noir-800'
                }`}
                aria-pressed={settings.detectiveEnabled}
                aria-label="Toggle Detective role"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.detectiveEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 border-t border-sky-500/20 text-[11px] text-cream-400">
              Reveals Mafia / Not Mafia
            </div>
          </div>

          {/* Joker Role Card */}
          <div
            className={`rounded-xl p-3 border transition flex flex-col justify-between gap-2.5 ${
              settings.jokerEnabled
                ? 'bg-purple-950/40 border-purple-500/50'
                : 'bg-noir-900/60 border-white/10 opacity-75'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-lg ${
                    settings.jokerEnabled ? 'bg-purple-950 text-purple-300' : 'bg-noir-950 text-cream-400'
                  }`}
                >
                  <RoleSvgIcon role="JOKER" className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-display font-bold text-sm uppercase text-purple-200 block leading-tight">
                    Joker
                  </span>
                  <span className="text-[10px] text-cream-400">Wins if voted out</span>
                </div>
              </div>

              <button
                type="button"
                data-sfx="toggle"
                onClick={() => onChange({ jokerEnabled: !settings.jokerEnabled })}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  settings.jokerEnabled ? 'bg-purple-600' : 'bg-noir-800'
                }`}
                aria-pressed={settings.jokerEnabled}
                aria-label="Toggle Joker role"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.jokerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {settings.jokerEnabled ? (
              <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-purple-200">
                  <input
                    type="checkbox"
                    data-sfx="toggle"
                    checked={settings.jokerNightImmunity}
                    onChange={(e) => onChange({ jokerNightImmunity: e.target.checked })}
                    className="w-3.5 h-3.5 accent-purple-500"
                  />
                  <span>Night Shield</span>
                </label>
              </div>
            ) : (
              <div className="pt-2 border-t border-purple-500/20 text-[11px] text-cream-400">
                Neutral Lone Wolf
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gameplay Toggles (Visual Switch Pills) */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-300 block">
          Gameplay &amp; Voting
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Reveal Role on Death */}
          <button
            type="button"
            data-sfx="toggle"
            onClick={() => onChange({ revealRoleOnDeath: !settings.revealRoleOnDeath })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
              settings.revealRoleOnDeath
                ? 'bg-noir-900 border-gold-500/40 text-cream-100'
                : 'bg-noir-950/60 border-white/10 text-cream-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <Eye className="w-4 h-4 text-gold-400" />
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.revealRoleOnDeath ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-noir-700'
                }`}
              />
            </div>
            <span className="font-medium text-[11px] leading-tight">Reveal on Death</span>
          </button>

          {/* Skip First Night Kill */}
          <button
            type="button"
            data-sfx="toggle"
            onClick={() => onChange({ skipFirstNightKill: !settings.skipFirstNightKill })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
              settings.skipFirstNightKill
                ? 'bg-noir-900 border-gold-500/40 text-cream-100'
                : 'bg-noir-950/60 border-white/10 text-cream-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <Shield className="w-4 h-4 text-sky-400" />
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.skipFirstNightKill ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-noir-700'
                }`}
              />
            </div>
            <span className="font-medium text-[11px] leading-tight">Skip Night 1 Kill</span>
          </button>

          {/* Allow Ghost Chat */}
          <button
            type="button"
            data-sfx="toggle"
            onClick={() => onChange({ allowDeadChat: !settings.allowDeadChat })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
              settings.allowDeadChat
                ? 'bg-noir-900 border-gold-500/40 text-cream-100'
                : 'bg-noir-950/60 border-white/10 text-cream-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.allowDeadChat ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-noir-700'
                }`}
              />
            </div>
            <span className="font-medium text-[11px] leading-tight">Ghost Chat</span>
          </button>

          {/* Allow Skip Vote */}
          <button
            type="button"
            data-sfx="toggle"
            onClick={() => onChange({ allowSkipVote: !settings.allowSkipVote })}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
              settings.allowSkipVote
                ? 'bg-noir-900 border-gold-500/40 text-cream-100'
                : 'bg-noir-950/60 border-white/10 text-cream-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <Vote className="w-4 h-4 text-emerald-400" />
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.allowSkipVote ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-noir-700'
                }`}
              />
            </div>
            <span className="font-medium text-[11px] leading-tight">Allow Skip Vote</span>
          </button>
        </div>
      </div>

      {/* Timers & Tie Rule Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <label className="space-y-1 block">
          <span className="text-cream-400 font-medium text-[11px]">Discussion</span>
          <select
            data-sfx="click"
            value={settings.discussionTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                discussionTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-1.5 text-cream-100 text-xs"
          >
            <option value="off">No Timer</option>
            <option value={60}>60s</option>
            <option value={120}>120s</option>
            <option value={180}>180s</option>
            <option value={240}>240s</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-cream-400 font-medium text-[11px]">Voting</span>
          <select
            data-sfx="click"
            value={settings.votingTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                votingTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-1.5 text-cream-100 text-xs"
          >
            <option value="off">No Timer</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
            <option value={90}>90s</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-cream-400 font-medium text-[11px]">Night Action</span>
          <select
            data-sfx="click"
            value={settings.nightActionTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                nightActionTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-1.5 text-cream-100 text-xs"
          >
            <option value="off">No Timer</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-cream-400 font-medium text-[11px]">Vote Tie</span>
          <select
            data-sfx="click"
            value={settings.tieRule}
            onChange={(e) => onChange({ tieRule: e.target.value as TieRule })}
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-1.5 text-cream-100 text-xs"
          >
            <option value="no_elimination">Nobody Dies</option>
            <option value="revote_then_no_elimination">Revote Once</option>
          </select>
        </label>
      </div>

      {/* Role Breakdown Live Bar */}
      <div className="rounded-xl bg-noir-900/80 border border-gold-500/25 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            Role Distribution
          </span>
          <div className="inline-flex items-center gap-1 text-[11px] font-mono text-cream-400 ml-1">
            <span>for</span>
            <button
              type="button"
              data-sfx="chip"
              onClick={() => setPreviewPlayers((p) => Math.max(5, p - 1))}
              className="w-5 h-5 rounded border border-gold-500/30 bg-noir-950 hover:bg-noir-800 text-gold-200 cursor-pointer inline-flex items-center justify-center"
              aria-label="Decrease preview player count"
            >
              -
            </button>
            <span className="text-gold-200 font-bold w-5 text-center">{previewPlayers}</span>
            <button
              type="button"
              data-sfx="chip"
              onClick={() => setPreviewPlayers((p) => Math.min(16, p + 1))}
              className="w-5 h-5 rounded border border-gold-500/30 bg-noir-950 hover:bg-noir-800 text-gold-200 cursor-pointer inline-flex items-center justify-center"
              aria-label="Increase preview player count"
            >
              +
            </button>
            <span>players:</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="px-2.5 py-0.5 rounded-full bg-crimson-950 border border-crimson-500/50 text-crimson-300 font-bold">
            {validation.breakdown.mafia} Mafia
          </span>
          {validation.breakdown.healer > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
              {validation.breakdown.healer} Healer
            </span>
          )}
          {validation.breakdown.detective > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-sky-950 border border-sky-500/50 text-sky-300 font-bold">
              {validation.breakdown.detective} Detective
            </span>
          )}
          {validation.breakdown.joker > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500/50 text-purple-300 font-bold">
              {validation.breakdown.joker} Joker
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded-full bg-gold-950/60 border border-gold-500/40 text-gold-300 font-bold">
            {validation.breakdown.villager} Villagers
          </span>
        </div>
      </div>
    </section>
  );
}
