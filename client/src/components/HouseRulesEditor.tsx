import React, { useState } from 'react';
import { validateSettings } from '@midnight-city/shared';
import type { HealerSelfSaveRule, RoomSettings, TieRule } from '@midnight-city/shared';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface HouseRulesEditorProps {
  settings: RoomSettings;
  onChange: (partial: Partial<RoomSettings>) => void;
  onReset?: () => void;
}

const BOOLEAN_TOGGLES: {
  key: keyof RoomSettings;
  label: string;
  requiresJoker?: boolean;
}[] = [
  { key: 'healerEnabled', label: 'Healer Role' },
  { key: 'detectiveEnabled', label: 'Detective Role' },
  { key: 'jokerEnabled', label: 'Joker Role' },
  { key: 'jokerWinEndsGame', label: 'Joker Win Ends Game', requiresJoker: true },
  { key: 'jokerNightImmunity', label: 'Joker Immune to Night Kill', requiresJoker: true },
  { key: 'revealRoleOnDeath', label: 'Reveal Role on Death' },
  { key: 'skipFirstNightKill', label: 'Skip First-Night Kill' },
  { key: 'allowDeadChat', label: 'Allow Ghost Chat' },
  { key: 'allowSkipVote', label: 'Allow Skip Vote' },
];

export function HouseRulesEditor({ settings, onChange, onReset }: HouseRulesEditorProps) {
  const [previewPlayers, setPreviewPlayers] = useState(6);
  const validation = validateSettings(previewPlayers, settings);

  return (
    <section
      aria-label="House Rules and Roles"
      className="rounded-2xl border border-gold-500/25 bg-noir-950/90 p-3.5 sm:p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-500/20 pb-2.5">
        <div>
          <h3 className="font-display text-base sm:text-lg text-gold-200 uppercase tracking-wider">
            House Rules &amp; Roles
          </h3>
          <p className="text-xs text-cream-400">
            Configure roles, timers, and win rules before opening the table.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {settings.mafiaCount !== validation.suggestedMafiaCount ? (
            <button
              type="button"
              onClick={() => onChange({ mafiaCount: validation.suggestedMafiaCount })}
              className="text-xs px-3 py-1 rounded-full border border-gold-400/50 bg-gold-500/15 hover:bg-gold-500/25 text-gold-200 transition cursor-pointer"
            >
              Use Suggested ({validation.suggestedMafiaCount})
            </button>
          ) : (
            <span className="text-xs px-3 py-1 rounded-full border border-gold-500/30 bg-noir-900 text-gold-300">
              Suggested Mafia: {validation.suggestedMafiaCount}
            </span>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset to default rules"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gold-500/25 bg-noir-900 hover:bg-noir-800 text-[11px] font-mono text-cream-300 hover:text-gold-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

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

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            Narrator Mode
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ narratorMode: 'AUTO_NARRATOR' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                settings.narratorMode === 'AUTO_NARRATOR'
                  ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                  : 'bg-noir-950/60 border-noir-700 text-cream-400 hover:text-cream-100'
              }`}
            >
              Auto-Narrator
            </button>
            <button
              type="button"
              onClick={() => onChange({ narratorMode: 'HUMAN_HOST' })}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                settings.narratorMode === 'HUMAN_HOST'
                  ? 'bg-gold-500/20 border-gold-400 text-gold-200'
                  : 'bg-noir-950/60 border-noir-700 text-cream-400 hover:text-cream-100'
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

        <div className="rounded-xl bg-noir-900/70 border border-gold-500/20 p-3 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            Mafia Count
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={settings.mafiaCount <= 1}
              onClick={() => onChange({ mafiaCount: Math.max(1, settings.mafiaCount - 1) })}
              className="w-9 h-9 rounded-lg border border-gold-500/35 bg-noir-800 hover:bg-noir-700 text-lg font-bold disabled:opacity-40 cursor-pointer"
              aria-label="Decrease Mafia count"
            >
              -
            </button>
            <span className="font-mono text-2xl font-bold text-crimson-400">
              {settings.mafiaCount}
            </span>
            <button
              type="button"
              disabled={settings.mafiaCount >= 8}
              onClick={() => onChange({ mafiaCount: Math.min(8, settings.mafiaCount + 1) })}
              className="w-9 h-9 rounded-lg border border-gold-500/35 bg-noir-800 hover:bg-noir-700 text-lg font-bold disabled:opacity-40 cursor-pointer"
              aria-label="Increase Mafia count"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-cream-400">
            5–6→1, 7–9→2, 10–12→3, 13–16→4
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-xs sm:text-sm">
        {BOOLEAN_TOGGLES.map((toggle) => {
          const checked = Boolean(settings[toggle.key]);
          const isDisabled = Boolean(toggle.requiresJoker && !settings.jokerEnabled);
          return (
            <label
              key={toggle.key}
              className={`flex items-center justify-between gap-3 rounded-xl bg-noir-900/65 border border-gold-500/15 px-3 py-2.5 sm:py-1.5 ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gold-400/35'
              }`}
            >
              <span className="text-cream-100/90">{toggle.label}</span>
              <input
                type="checkbox"
                disabled={isDisabled}
                checked={checked}
                onChange={(e) =>
                  onChange({ [toggle.key]: e.target.checked } as Partial<RoomSettings>)
                }
                className="w-5 h-5 sm:w-4 sm:h-4 accent-gold-500 shrink-0"
              />
            </label>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
        <label className="block space-y-1">
          <span className="text-gold-300 font-semibold uppercase text-xs tracking-wider">
            Healer Self-Save Rule
          </span>
          <select
            disabled={!settings.healerEnabled}
            value={settings.healerSelfSaveRule}
            onChange={(e) =>
              onChange({ healerSelfSaveRule: e.target.value as HealerSelfSaveRule })
            }
            className="w-full rounded-xl bg-noir-950 border border-gold-500/30 px-3 py-2 text-base sm:text-sm text-cream-100 disabled:opacity-50"
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
            value={settings.tieRule}
            onChange={(e) => onChange({ tieRule: e.target.value as TieRule })}
            className="w-full rounded-xl bg-noir-950 border border-gold-500/30 px-3 py-2 text-base sm:text-sm text-cream-100"
          >
            <option value="no_elimination">Nobody eliminated (Default)</option>
            <option value="revote_then_no_elimination">One revote, then nobody</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
        <label className="space-y-1">
          <span className="text-cream-300 font-semibold">Discussion</span>
          <select
            value={settings.discussionTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                discussionTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-2 text-base sm:text-xs text-cream-100"
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
            value={settings.votingTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                votingTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-2 text-base sm:text-xs text-cream-100"
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
            value={settings.nightActionTimeSec ?? 'off'}
            onChange={(e) =>
              onChange({
                nightActionTimeSec: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-lg bg-noir-950 border border-gold-500/30 px-2.5 py-2 text-base sm:text-xs text-cream-100"
          >
            <option value="off">Off</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={45}>45s</option>
            <option value={60}>60s</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl bg-noir-900/75 border border-gold-500/25 p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            Final Role Breakdown (Counts Only)
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cream-300">
            <span>Preview @</span>
            <button
              type="button"
              onClick={() => setPreviewPlayers((p) => Math.max(5, p - 1))}
              className="w-7 h-7 sm:w-5 sm:h-5 rounded border border-gold-500/30 bg-noir-950 hover:bg-noir-800 text-gold-200 cursor-pointer"
              aria-label="Decrease preview player count"
            >
              -
            </button>
            <span className="text-gold-200 font-bold w-5 text-center">{previewPlayers}</span>
            <button
              type="button"
              onClick={() => setPreviewPlayers((p) => Math.min(16, p + 1))}
              className="w-7 h-7 sm:w-5 sm:h-5 rounded border border-gold-500/30 bg-noir-950 hover:bg-noir-800 text-gold-200 cursor-pointer"
              aria-label="Increase preview player count"
            >
              +
            </button>
            <span>players</span>
          </div>
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
    </section>
  );
}
