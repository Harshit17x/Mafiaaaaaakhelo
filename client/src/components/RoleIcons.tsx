import React from 'react';
import type { Role } from '@midnight-city/shared';

export interface RoleMeta {
  label: string;
  alignmentLabel: string;
  tagline: string;
  colorClass: string;
  borderClass: string;
  badgeBgClass: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  MAFIA: {
    label: 'Mafia',
    alignmentLabel: 'Syndicate',
    tagline: 'Eliminate the City under cover of darkness until Mafia outnumbers or equals the rest.',
    colorClass: 'text-crimson-400',
    borderClass: 'border-crimson-500/60',
    badgeBgClass: 'bg-crimson-900/70 text-crimson-300 border-crimson-500/50',
  },
  HEALER: {
    label: 'Healer',
    alignmentLabel: 'City',
    tagline: 'Guard one soul each night. If the Mafia strikes your patient, they live to see dawn.',
    colorClass: 'text-emerald-300',
    borderClass: 'border-emerald-400/50',
    badgeBgClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
  },
  DETECTIVE: {
    label: 'Detective',
    alignmentLabel: 'City',
    tagline: 'Tail one suspect each night to uncover whether they belong to the Syndicate.',
    colorClass: 'text-sky-300',
    borderClass: 'border-sky-400/50',
    badgeBgClass: 'bg-sky-950/70 text-sky-300 border-sky-500/40',
  },
  JOKER: {
    label: 'Joker',
    alignmentLabel: 'Neutral',
    tagline: 'Chaos incarnate. Convince Midnight City to vote you out by Day to claim victory.',
    colorClass: 'text-purple-300',
    borderClass: 'border-purple-400/55',
    badgeBgClass: 'bg-purple-950/70 text-purple-300 border-purple-500/40',
  },
  VILLAGER: {
    label: 'Villager',
    alignmentLabel: 'City',
    tagline: 'Read the room, sniff out lies by day, and vote the Syndicate out of Midnight City.',
    colorClass: 'text-gold-300',
    borderClass: 'border-gold-400/50',
    badgeBgClass: 'bg-gold-700/30 text-gold-200 border-gold-500/40',
  },
};

export function RoleSvgIcon({
  role,
  className = 'w-12 h-12',
}: {
  role: Role;
  className?: string;
}) {
  switch (role) {
    case 'MAFIA':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 31C12 31 20 26 32 26C44 26 52 31 52 31L57 34C57 34 45 36 32 36C19 36 7 34 7 34L12 31Z"
            fill="currentColor"
            opacity="0.25"
          />
          <path
            d="M16 30L21 15C22 13 25 12 28 14L32 16L36 14C39 12 42 13 43 15L48 30"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 33C16 30 48 30 56 33"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M18 44H42L45 40H52V45H46L43 49H29L25 56H17L21 48H18V44Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="currentColor"
            fillOpacity="0.18"
          />
        </svg>
      );
    case 'HEALER':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <path
            d="M25 11H39V25H53V39H39V53H25V39H11V25H25V11Z"
            stroke="currentColor"
            strokeWidth="2.4"
            fill="currentColor"
            fillOpacity="0.16"
            strokeLinejoin="round"
          />
          <path
            d="M42 12L52 22M47 17L26 38L20 44L14 50M23 35L29 41M38 20L44 26"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'DETECTIVE':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <circle
            cx="28"
            cy="27"
            r="15"
            stroke="currentColor"
            strokeWidth="2.8"
            fill="currentColor"
            fillOpacity="0.15"
          />
          <circle
            cx="28"
            cy="27"
            r="9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <path
            d="M39 38L54 53"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'JOKER':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <path
            d="M14 23C14 23 20 12 32 12C44 12 50 23 50 23C52 37 44 50 32 54C20 50 12 37 14 23Z"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path
            d="M21 27L26 24L28 29L21 27ZM43 27L38 24L36 29L43 27Z"
            fill="currentColor"
          />
          <path
            d="M21 38C25 45 39 45 43 38"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M15 21L9 13L19 16M49 21L55 13L45 16M32 12V7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'VILLAGER':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <path
            d="M26 14C26 10.686 28.686 8 32 8C35.314 8 38 10.686 38 14"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <path d="M22 18H42L45 24H19L22 18Z" stroke="currentColor" strokeWidth="2.2" />
          <path
            d="M21 24H43L40 48H24L21 24Z"
            stroke="currentColor"
            strokeWidth="2.4"
            fill="currentColor"
            fillOpacity="0.15"
          />
          <path
            d="M32 29C35 33 35 38 32 41C29 38 29 33 32 29Z"
            fill="currentColor"
          />
          <path d="M18 48H46L48 53H16L18 48Z" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      );
  }
}

