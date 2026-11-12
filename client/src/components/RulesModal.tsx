import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  EyeOff,
  Flame,
  HelpCircle,
  MicOff,
  Moon,
  Scale,
  Search,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react';
import type { Role } from '@midnight-city/shared';
import { soundEngine } from '../audio/SoundEngine';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';

type TabKey = 'roles' | 'loop' | 'victory';

interface TabDefinition {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDefinition[] = [
  { key: 'roles', label: 'Roles & Powers', shortLabel: 'Roles', icon: Users },
  { key: 'loop', label: 'Night & Day Loop', shortLabel: 'Game Loop', icon: Clock },
  { key: 'victory', label: 'Victory Conditions', shortLabel: 'Victory', icon: Trophy },
];

const ROLES: Role[] = ['MAFIA', 'HEALER', 'DETECTIVE', 'JOKER', 'VILLAGER'];

export function RulesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('roles');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundEngine.playUiModalClose();
        onClose();
      } else if (e.key === 'ArrowRight') {
        setActiveTab((curr) => {
          const idx = TABS.findIndex((t) => t.key === curr);
          const next = TABS[(idx + 1) % TABS.length]!;
          soundEngine.playUiTab();
          return next.key;
        });
      } else if (e.key === 'ArrowLeft') {
        setActiveTab((curr) => {
          const idx = TABS.findIndex((t) => t.key === curr);
          const prev = TABS[(idx - 1 + TABS.length) % TABS.length]!;
          soundEngine.playUiTab();
          return prev.key;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleTabChange = (key: TabKey) => {
    if (key !== activeTab) {
      soundEngine.playUiTab();
      setActiveTab(key);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-noir-950/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="noir-card art-deco-border rounded-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.95)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-gold-500/25 bg-noir-950/90 shrink-0">
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-400 block mb-0.5">
              Midnight City Dossier
            </span>
            <h2
              id="rules-modal-title"
              className="font-display text-lg sm:text-2xl text-gold-100 tracking-wider uppercase truncate"
            >
              How to Play &amp; City Rules
            </h2>
          </div>
          <button
            type="button"
            data-sfx="modalClose"
            onClick={onClose}
            aria-label="Close dossier rules"
            className="p-2 rounded-xl text-cream-300 hover:text-gold-200 hover:bg-noir-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div
          role="tablist"
          aria-label="Dossier Rules Sections"
          className="flex items-stretch border-b border-gold-500/20 bg-noir-900/80 px-2 sm:px-6 pt-2 shrink-0 gap-1.5 sm:gap-3 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                data-sfx="tab"
                onClick={() => handleTabChange(tab.key)}
                className={`relative pb-2.5 pt-2 px-3 sm:px-4 rounded-t-xl text-xs sm:text-sm font-condensed uppercase tracking-wider font-semibold transition-all duration-150 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-gold-200 bg-noir-950/90 border-t border-x border-gold-500/40 shadow-sm'
                    : 'text-cream-300/75 hover:text-gold-300 hover:bg-noir-800/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-cream-400'}`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-amber-500 via-gold-300 to-amber-500"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 min-h-0 bg-gradient-to-b from-noir-950 via-[#0a080c] to-noir-950">
          {/* TAB 1: ROLES & POWERS */}
          {activeTab === 'roles' && (
            <div
              role="tabpanel"
              id="tabpanel-roles"
              aria-labelledby="tab-roles"
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-cream-300/90">
                  Every player secretly belongs to one of three factions: the{' '}
                  <span className="text-crimson-400 font-semibold">Syndicate</span>, the{' '}
                  <span className="text-sky-300 font-semibold">City</span>, or a{' '}
                  <span className="text-purple-300 font-semibold">Neutral Lone Wolf</span>.
                </p>
                <span className="text-[11px] font-mono text-gold-400/80 bg-noir-900 border border-gold-500/25 px-2 py-0.5 rounded shrink-0">
                  5 Roles
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 sm:gap-3.5">
                {ROLES.map((role) => {
                  const meta = ROLE_META[role];
                  return (
                    <article
                      key={role}
                      className={`rounded-2xl p-3.5 sm:p-4 bg-noir-900/90 border ${meta.borderClass} flex flex-col justify-between gap-3 shadow-md hover:border-gold-400/50 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-xl bg-noir-950 border border-white/10 shrink-0 ${meta.colorClass}`}
                        >
                          <RoleSvgIcon role={role} className="w-9 h-9" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <h3
                              className={`font-display font-bold text-base uppercase tracking-wide ${meta.colorClass}`}
                            >
                              {meta.label}
                            </h3>
                            <span
                              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${meta.badgeBgClass}`}
                            >
                              {meta.alignmentLabel}
                            </span>
                          </div>
                          <p className="text-xs text-cream-200/95 leading-relaxed font-normal">
                            {meta.tagline}
                          </p>
                        </div>
                      </div>

                      {/* Detailed Role Breakdown */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px] text-cream-300/85">
                        {role === 'MAFIA' && (
                          <>
                            <div className="flex items-start gap-1.5">
                              <Moon className="w-3.5 h-3.5 text-crimson-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-crimson-300">Night Action:</strong> Wake up
                                with partner Mafia to select one citizen victim.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-amber-300">Win Goal:</strong> Equal or
                                outnumber all remaining alive non-Mafia.
                              </span>
                            </div>
                          </>
                        )}

                        {role === 'DETECTIVE' && (
                          <>
                            <div className="flex items-start gap-1.5">
                              <Search className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-sky-300">Night Action:</strong> Secretly
                                inspect one living suspect to reveal if they are Mafia or Not Mafia.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-purple-300 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-purple-300">Notice:</strong> The Joker
                                appears as <em>Not Mafia</em> to Detective inspections!
                              </span>
                            </div>
                          </>
                        )}

                        {role === 'HEALER' && (
                          <>
                            <div className="flex items-start gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-emerald-300">Night Action:</strong> Guard one
                                soul per night. If Mafia strikes them, they survive dawn unharmed.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-emerald-300">Miracle Save:</strong> When a
                                save happens, nobody dies at dawn — but the identity stays secret!
                              </span>
                            </div>
                          </>
                        )}

                        {role === 'JOKER' && (
                          <>
                            <div className="flex items-start gap-1.5">
                              <Vote className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-purple-300">Chaos Goal:</strong> Trick the
                                town into voting you out on the Day Ballot.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-amber-300">Warning:</strong> Joker wins
                                ONLY by Day vote. If killed by Mafia at night, the Joker loses!
                              </span>
                            </div>
                          </>
                        )}

                        {role === 'VILLAGER' && (
                          <>
                            <div className="flex items-start gap-1.5">
                              <Scale className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-gold-300">Day Power:</strong> Holds the
                                majority vote. Sniff out contradictions, interrogate suspects, and
                                cast deciding ballots.
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>
                                <strong className="text-amber-300">Win Goal:</strong> Help the City
                                vote out every single Mafia member.
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: NIGHT & DAY LOOP (Visual Timeline) */}
          {activeTab === 'loop' && (
            <div
              role="tabpanel"
              id="tabpanel-loop"
              aria-labelledby="tab-loop"
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-cream-300/90">
                  Games alternate between <strong>Night</strong> (silent covert actions) and{' '}
                  <strong>Day</strong> (open debate &amp; voting) until a team claims victory.
                </p>
                <span className="text-[11px] font-mono text-gold-400/80 bg-noir-900 border border-gold-500/25 px-2 py-0.5 rounded shrink-0">
                  4 Steps
                </span>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="relative rounded-2xl border border-sky-500/30 bg-noir-900/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:justify-center p-2.5 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-300 shrink-0">
                    <Moon className="w-6 h-6" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
                      Step 1
                    </span>
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm sm:text-base text-gold-200 uppercase tracking-wide">
                        Night Falls &amp; Mics Silence
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-crimson-950/70 border border-crimson-500/40 text-crimson-300 inline-flex items-center gap-1 font-bold">
                        <MicOff className="w-3 h-3" /> Microphones Muted
                      </span>
                    </div>
                    <p className="text-xs text-cream-200/90 leading-relaxed">
                      Darkness envelops the speakeasy. Microphones are automatically silenced.
                      Citizens sleep while special roles wake up sequentially to cast their covert moves.
                    </p>
                    <p className="text-[11px] text-cream-400 flex items-center gap-1.5 pt-0.5">
                      <EyeOff className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <em>Stealth Timing: All sleeping players see randomized countdowns so role types are never leaked by delays.</em>
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative rounded-2xl border border-crimson-500/30 bg-noir-900/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:justify-center p-2.5 rounded-xl bg-crimson-950/80 border border-crimson-500/40 text-crimson-300 shrink-0">
                    <Zap className="w-6 h-6" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
                      Step 2
                    </span>
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <h3 className="font-display text-sm sm:text-base text-gold-200 uppercase tracking-wide">
                      Secret Midnight Operations
                    </h3>
                    <div className="grid sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-noir-950/70 border border-crimson-500/25">
                        <span className="font-bold text-crimson-400 block mb-0.5">1. Mafia Strike</span>
                        <span className="text-cream-300/85 text-[11px] leading-tight block">
                          Syndicate members secretly agree on one victim to eliminate.
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-noir-950/70 border border-emerald-500/25">
                        <span className="font-bold text-emerald-300 block mb-0.5">2. Healer Guard</span>
                        <span className="text-cream-300/85 text-[11px] leading-tight block">
                          Chooses one player to protect against violence overnight.
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-noir-950/70 border border-sky-500/25">
                        <span className="font-bold text-sky-300 block mb-0.5">3. Detective Tail</span>
                        <span className="text-cream-300/85 text-[11px] leading-tight block">
                          Inspects one player and learns Mafia or Not Mafia.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative rounded-2xl border border-amber-500/30 bg-noir-900/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:justify-center p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 shrink-0">
                    <Sun className="w-6 h-6" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
                      Step 3
                    </span>
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm sm:text-base text-gold-200 uppercase tracking-wide">
                        Dawn Breaks &amp; News Revealed
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Microphones Unmuted
                      </span>
                    </div>
                    <p className="text-xs text-cream-200/90 leading-relaxed">
                      The rooster crows, the speakeasy re-lights, and voice lines restore. The morning
                      newspaper headline announces whether someone fell during the night.
                    </p>
                    <p className="text-[11px] text-cream-400">
                      If the Healer successfully guarded the victim (or Joker night immunity held),
                      <strong> nobody dies</strong> — and the reason remains confidential.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative rounded-2xl border border-gold-500/30 bg-noir-900/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:justify-center p-2.5 rounded-xl bg-gold-950/80 border border-gold-500/40 text-gold-300 shrink-0">
                    <Scale className="w-6 h-6" />
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
                      Step 4
                    </span>
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-display text-sm sm:text-base text-gold-200 uppercase tracking-wide">
                      Day Town Hall &amp; Town Vote
                    </h3>
                    <p className="text-xs text-cream-200/90 leading-relaxed">
                      Living players debate, call out suspicious behavior, and place live accusation
                      markers. Then, everyone casts a ballot to execute a suspect or <strong>Skip</strong>.
                    </p>
                    <p className="text-[11px] text-amber-300/90">
                      The player with the most votes is eliminated and their secret role is unmasked.
                      If the game continues, night falls again!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VICTORY CONDITIONS */}
          {activeTab === 'victory' && (
            <div
              role="tabpanel"
              id="tabpanel-victory"
              aria-labelledby="tab-victory"
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-cream-300/90">
                  The match concludes instantly whenever any faction satisfies its win condition.
                </p>
                <span className="text-[11px] font-mono text-gold-400/80 bg-noir-900 border border-gold-500/25 px-2 py-0.5 rounded shrink-0">
                  3 Endings
                </span>
              </div>

              <div className="grid gap-3.5">
                {/* City Victory */}
                <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-950/40 via-noir-900 to-noir-900 p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4">
                  <div className="p-3 rounded-2xl bg-sky-950 border border-sky-500/50 text-sky-300 shrink-0">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base sm:text-lg text-sky-200 uppercase tracking-wide font-bold">
                        City Victory (Citizens &amp; Town Win)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-900/60 border border-sky-400/50 text-sky-200 uppercase font-bold">
                        Clean Sweep
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-cream-100 font-medium">
                      All Mafia Syndicate members are identified and eliminated by town vote.
                    </p>
                    <p className="text-xs text-cream-300/80 leading-relaxed">
                      The surviving townspeople, Detective, and Healer successfully rid Midnight City
                      of organized crime.
                    </p>
                  </div>
                </div>

                {/* Syndicate Victory */}
                <div className="rounded-2xl border border-crimson-500/40 bg-gradient-to-r from-crimson-950/40 via-noir-900 to-noir-900 p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4">
                  <div className="p-3 rounded-2xl bg-crimson-950 border border-crimson-500/50 text-crimson-300 shrink-0">
                    <Flame className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base sm:text-lg text-crimson-300 uppercase tracking-wide font-bold">
                        Syndicate Victory (Mafia Takes Over)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-crimson-900/60 border border-crimson-400/50 text-crimson-200 uppercase font-bold">
                        Dominance
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-cream-100 font-medium">
                      Living Mafia count equals or exceeds living non-Mafia citizens.
                    </p>
                    <p className="text-xs text-cream-300/80 leading-relaxed">
                      At this parity point, the Mafia controls the majority vote and the city falls under
                      complete Syndicate dominion.
                    </p>
                  </div>
                </div>

                {/* Joker Solo Victory */}
                <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-noir-900 to-noir-900 p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4">
                  <div className="p-3 rounded-2xl bg-purple-950 border border-purple-500/50 text-purple-300 shrink-0">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base sm:text-lg text-purple-300 uppercase tracking-wide font-bold">
                        Joker Solo Victory (Chaos Reigns)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-900/60 border border-purple-400/50 text-purple-200 uppercase font-bold">
                        Solo Win
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-cream-100 font-medium">
                      The Joker gets successfully voted out by the town during the Day vote.
                    </p>
                    <p className="text-xs text-cream-300/80 leading-relaxed">
                      The Joker laughs last, instantly winning the entire match alone. Both City and
                      Mafia lose! <span className="text-amber-300 font-medium">(Note: If killed at night by Mafia, the Joker does NOT win.)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-gold-500/20 bg-noir-950/90 text-xs text-cream-400 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-cream-400/70">
            <span>Use Tab or ← → to switch sections</span>
            <span>•</span>
            <span>Esc to close</span>
          </div>
          <button
            type="button"
            data-sfx="modalClose"
            onClick={onClose}
            className="ml-auto px-4 py-1.5 rounded-lg border border-gold-500/35 bg-noir-900 hover:bg-noir-800 text-xs font-condensed font-bold uppercase tracking-wider text-gold-200 transition cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
