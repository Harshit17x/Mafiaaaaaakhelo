import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { ROLE_META, RoleSvgIcon } from './RoleIcons';
import type { Role } from '@midnight-city/shared';

const ROLES: Role[] = ['MAFIA', 'HEALER', 'DETECTIVE', 'JOKER', 'VILLAGER'];

export function RulesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-noir-950/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="noir-card art-deco-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gold-500/25 pb-3">
          <h2
            id="rules-modal-title"
            className="font-display text-2xl text-gold-200 tracking-wider uppercase"
          >
            Midnight City Dossier — Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="p-2 rounded-lg text-cream-300 hover:text-gold-200 hover:bg-noir-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-cream-300 leading-relaxed">
          <section className="space-y-2">
            <h3 className="font-display text-base text-gold-300 uppercase tracking-wider">
              The Roles
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {ROLES.map((role) => {
                const meta = ROLE_META[role];
                return (
                  <div
                    key={role}
                    className={`rounded-xl p-3 bg-noir-900/75 border ${meta.borderClass} flex gap-3`}
                  >
                    <RoleSvgIcon role={role} className={`w-10 h-10 shrink-0 ${meta.colorClass}`} />
                    <div>
                      <div className={`font-display font-bold text-sm uppercase ${meta.colorClass}`}>
                        {meta.label} ({meta.alignmentLabel})
                      </div>
                      <p className="text-xs text-cream-300 mt-0.5">{meta.tagline}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-base text-gold-300 uppercase tracking-wider">
              Night & Day Loop
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>
                <strong>Night:</strong> All players sleep and mics mute. Mafia secretly wake to
                agree on one victim. If multiple Mafia disagree when time ends, the leading target
                wins (ties broken randomly). Mafia cannot target Mafia.
              </li>
              <li>
                <strong>Healer & Detective:</strong> Healer protects one player per night (self-save
                follows room settings). Detective inspects one player and learns Mafia or Not Mafia
                (Joker appears Not Mafia).
              </li>
              <li>
                <strong>Stealth Timing:</strong> Asleep players see a neutral waiting screen, and
                eliminated role slots run on randomized delays so timing never leaks roles.
              </li>
              <li>
                <strong>Dawn & Day:</strong> If the Healer saved the Mafia target (or Joker night
                immunity blocked it), nobody dies — the cause stays secret. Living players discuss,
                raise accuse markers, and vote to eliminate a suspect or skip.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-display text-base text-gold-300 uppercase tracking-wider">
              Victory Conditions
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>
                <strong>Joker Wins:</strong> If voted out during the Day vote. (Does not win if
                killed at night.)
              </li>
              <li>
                <strong>City Wins:</strong> All Mafia members are eliminated.
              </li>
              <li>
                <strong>Mafia Wins:</strong> Alive Mafia count equals or exceeds alive non-Mafia
                count (Joker counts as non-Mafia).
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
