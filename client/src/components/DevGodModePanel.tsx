import React, { useEffect, useMemo, useState } from 'react';
import type { Role, Winner } from '@midnight-city/shared';
import {
  Activity,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileCode2,
  Layers,
  LogOut,
  MessageSquarePlus,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DEFAULT_DEV_CONFIG,
  DEV_PAGES_CATALOG,
  type DevNightViewMode,
  type DevPageKey,
  isGodModeAvailable,
} from '../dev/devGodMode';
import { useGameStore } from '../stores/useGameStore';

type StudioTab = 'pages' | 'controls' | 'inspector';

const ROLES: Role[] = ['VILLAGER', 'MAFIA', 'HEALER', 'DETECTIVE', 'JOKER'];
const NIGHT_MODES: { id: DevNightViewMode; label: string }[] = [
  { id: 'MAFIA_TURN', label: 'Mafia Turn' },
  { id: 'HEALER_TURN', label: 'Healer Turn' },
  { id: 'DETECTIVE_TURN', label: 'Detective Turn' },
  { id: 'SLEEPING', label: 'Sleeping' },
];
const WINNERS: Winner[] = ['CITY', 'MAFIA', 'JOKER'];

export function DevGodModePanel() {
  const available = useMemo(() => isGodModeAvailable(), []);
  const room = useGameStore((s) => s.room);
  const liveRoom = useGameStore((s) => s.liveRoom);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const lobbyPositions = useGameStore((s) => s.lobbyPositions);
  const devGodConfig = useGameStore((s) => s.devGodConfig);
  const setDevGodConfig = useGameStore((s) => s.setDevGodConfig);
  const resetDevGodScene = useGameStore((s) => s.resetDevGodScene);
  const exitDevGodMode = useGameStore((s) => s.exitDevGodMode);
  const stepDevLobbyBots = useGameStore((s) => s.stepDevLobbyBots);
  const pushDevChatMessage = useGameStore((s) => s.pushDevChatMessage);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<StudioTab>('pages');
  const [walkBots, setWalkBots] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Keyboard shortcut: Shift+Alt+G toggles the God Mode drawer
  useEffect(() => {
    if (!available) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyG') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [available]);

  // Animate mock players strolling in Lobby when Walk Bots is enabled
  useEffect(() => {
    if (!walkBots || !devGodConfig || devGodConfig.page !== 'LOBBY') return;
    const id = window.setInterval(() => {
      stepDevLobbyBots();
    }, 900);
    return () => window.clearInterval(id);
  }, [walkBots, devGodConfig, stepDevLobbyBots]);

  if (!available) return null;

  const activeConfig = devGodConfig ?? DEFAULT_DEV_CONFIG;
  const activePageKey: DevPageKey = devGodConfig
    ? devGodConfig.page
    : (room?.game.phase ?? 'HOME');

  const currentIdx = DEV_PAGES_CATALOG.findIndex((p) => p.key === activePageKey);

  const cyclePage = (delta: -1 | 1) => {
    const idx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (idx + delta + DEV_PAGES_CATALOG.length) % DEV_PAGES_CATALOG.length;
    setDevGodConfig({ page: DEV_PAGES_CATALOG[nextIdx]!.key });
  };

  const handleCopyPath = async (filePath: string) => {
    try {
      await navigator.clipboard.writeText(filePath);
      setCopiedPath(filePath);
      window.setTimeout(() => setCopiedPath(null), 1500);
    } catch {
    }
  };

  return (
    <>
      {/* Floating Always-Accessible God Mode Quick Dock */}
      <div className="fixed bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 z-[1200] max-w-[calc(100vw-1.25rem)] flex items-center gap-0.5 sm:gap-1 rounded-full bg-[#090d17]/95 backdrop-blur-md border border-gold-400/55 shadow-[0_10px_30px_rgba(0,0,0,0.85)] p-1 text-xs">
        <button
          type="button"
          onClick={() => cyclePage(-1)}
          title="Previous page in God Mode"
          aria-label="Previous page in God Mode"
          className="p-1.5 rounded-full hover:bg-noir-800 text-gold-300 cursor-pointer transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Open God Mode Page Studio (Shift+Alt+G)"
          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full hover:bg-noir-800 transition cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-gold-300 shrink-0" />
          <span className="hidden sm:inline font-display font-bold uppercase tracking-wider text-gold-200 text-[11px]">
            God Mode
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
              devGodConfig
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-noir-800 text-cream-300 border border-gold-500/30'
            }`}
          >
            {devGodConfig ? activePageKey : `LIVE:${activePageKey}`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => cyclePage(1)}
          title="Next page in God Mode"
          aria-label="Next page in God Mode"
          className="p-1.5 rounded-full hover:bg-noir-800 text-gold-300 cursor-pointer transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {devGodConfig && (
          <button
            type="button"
            onClick={exitDevGodMode}
            title="Exit God Sandbox & Return to Live"
            aria-label="Exit God Sandbox"
            className="p-1.5 rounded-full bg-crimson-950/80 hover:bg-crimson-900 text-crimson-200 border border-crimson-500/40 cursor-pointer transition"
          >
            <LogOut className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expandable God Mode Studio Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[1250] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Developer God Mode Studio"
            className="w-full max-w-4xl max-h-[90dvh] sm:max-h-[86dvh] flex flex-col rounded-2xl border border-gold-400/45 bg-[#0a0f1c]/98 shadow-[0_28px_80px_rgba(0,0,0,0.92)] overflow-hidden text-cream-100"
          >
            {/* Studio Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gold-500/25 bg-[#0f1628]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gold-500/15 border border-gold-400/40 text-gold-300">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold uppercase tracking-wider text-gold-200">
                    God Mode • All Pages &amp; Live Inspector
                  </h2>
                  <p className="text-[11px] text-cream-400">
                    {devGodConfig
                      ? `Previewing ${activePageKey} in Sandbox (${room?.players.length ?? 0} players) • Edit files & see HMR updates live`
                      : `Observing Live App (${liveRoom ? `Room #${liveRoom.roomCode} • ${liveRoom.game.phase}` : 'Home Screen'})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {devGodConfig ? (
                  <button
                    type="button"
                    onClick={exitDevGodMode}
                    className="px-3 py-1.5 rounded-lg bg-crimson-950/90 hover:bg-crimson-900 border border-crimson-500/50 text-xs font-semibold text-crimson-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Return to Live
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDevGodConfig({ page: activePageKey })}
                    className="px-3 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-400/50 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Enter Sandbox
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close God Mode Studio"
                  className="p-1.5 rounded-lg bg-noir-900 hover:bg-noir-800 border border-gold-500/30 text-cream-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Studio Tabs */}
            <div className="flex items-center gap-1 px-3 sm:px-4 pt-2.5 border-b border-gold-500/20 bg-[#0c1221] overflow-x-auto whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={() => setTab('pages')}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer shrink-0 ${
                  tab === 'pages'
                    ? 'border-gold-400 text-gold-200 bg-[#121a2f]'
                    : 'border-transparent text-cream-400 hover:text-cream-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All Pages ({DEV_PAGES_CATALOG.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('controls')}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer shrink-0 ${
                  tab === 'controls'
                    ? 'border-gold-400 text-gold-200 bg-[#121a2f]'
                    : 'border-transparent text-cream-400 hover:text-cream-100'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Controls
              </button>
              <button
                type="button"
                onClick={() => setTab('inspector')}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider border-b-2 transition cursor-pointer shrink-0 ${
                  tab === 'inspector'
                    ? 'border-gold-400 text-gold-200 bg-[#121a2f]'
                    : 'border-transparent text-cream-400 hover:text-cream-100'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                What&apos;s Going On
              </button>
            </div>

            {/* Studio Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {tab === 'pages' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DEV_PAGES_CATALOG.map((page) => {
                    const isActive = devGodConfig?.page === page.key || (!devGodConfig && activePageKey === page.key);
                    return (
                      <div
                        key={page.key}
                        className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition ${
                          isActive
                            ? 'bg-gold-500/10 border-gold-400 shadow-[0_0_24px_rgba(212,168,79,0.16)]'
                            : 'bg-[#111829] border-gold-500/20 hover:border-gold-400/50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-widest text-gold-400">
                                {page.key}
                              </div>
                              <h3 className="font-display text-sm font-bold text-cream-50">
                                {page.title}
                              </h3>
                            </div>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-mono font-bold">
                                OPEN
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-cream-300/85 leading-relaxed">
                            {page.description}
                          </p>

                          <div className="flex flex-wrap gap-1">
                            {page.sections.map((sec) => (
                              <span
                                key={sec}
                                className="px-1.5 py-0.5 rounded bg-noir-950/80 border border-gold-500/20 text-[10px] text-cream-300"
                              >
                                {sec}
                              </span>
                            ))}
                          </div>

                          <div className="space-y-1 pt-1 border-t border-gold-500/15">
                            <div className="text-[10px] font-mono uppercase text-cream-400 flex items-center gap-1">
                              <FileCode2 className="w-3 h-3 text-gold-400" />
                              Source Files
                            </div>
                            {page.files.map((file) => (
                              <div
                                key={file}
                                className="flex items-center justify-between gap-1 text-[10.5px] font-mono text-gold-200/90 bg-noir-950/70 rounded px-2 py-1"
                              >
                                <span className="truncate">{file}</span>
                                <button
                                  type="button"
                                  onClick={() => void handleCopyPath(file)}
                                  title="Copy file path"
                                  className="shrink-0 text-cream-400 hover:text-gold-200 cursor-pointer"
                                >
                                  {copiedPath === file ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDevGodConfig({ page: page.key });
                          }}
                          className={`w-full py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                            isActive && devGodConfig
                              ? 'bg-emerald-700 text-white'
                              : 'bg-gradient-to-r from-gold-600 to-gold-400 text-noir-950 hover:brightness-110'
                          }`}
                        >
                          {isActive && devGodConfig ? 'Active in Preview' : `Open ${page.shortLabel}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === 'controls' && (
                <div className="space-y-4">
                  {!devGodConfig && (
                    <div className="rounded-xl bg-amber-950/40 border border-amber-400/40 p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
                      <span>
                        You are currently viewing the real app. Modifying controls below will open God Mode Sandbox so your live room is not disrupted.
                      </span>
                      <button
                        type="button"
                        onClick={() => setDevGodConfig({ page: activePageKey })}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-noir-950 font-bold cursor-pointer"
                      >
                        Start Sandbox
                      </button>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Player Count & Role */}
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-4 space-y-3">
                      <div className="text-xs font-display uppercase tracking-wider text-gold-300">
                        Roster &amp; Perspective
                      </div>

                      <label className="block space-y-1 text-xs">
                        <div className="flex justify-between text-cream-300">
                          <span>Players in Room</span>
                          <span className="font-mono text-gold-300 font-bold">
                            {activeConfig.playerCount}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={16}
                          value={activeConfig.playerCount}
                          onChange={(e) =>
                            setDevGodConfig({ playerCount: Number(e.target.value) })
                          }
                          className="w-full accent-gold-400"
                        />
                      </label>

                      <div className="space-y-1.5">
                        <div className="text-xs text-cream-300">Your Role</div>
                        <div className="flex flex-wrap gap-1.5">
                          {ROLES.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setDevGodConfig({ myRole: role })}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                                activeConfig.myRole === role
                                  ? 'bg-gold-500/25 border-gold-300 text-gold-200'
                                  : 'bg-noir-950 border-gold-500/20 text-cream-300 hover:border-gold-400/50'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeConfig.myIsHost}
                            onChange={(e) => setDevGodConfig({ myIsHost: e.target.checked })}
                            className="accent-gold-400"
                          />
                          <span>You are Host</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeConfig.myAlive}
                            onChange={(e) => setDevGodConfig({ myAlive: e.target.checked })}
                            className="accent-gold-400"
                          />
                          <span>You are Alive</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeConfig.humanHostSpectator}
                            onChange={(e) =>
                              setDevGodConfig({ humanHostSpectator: e.target.checked })
                            }
                            className="accent-gold-400"
                          />
                          <span>Human Host GodView</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeConfig.simulateSpeaking}
                            onChange={(e) =>
                              setDevGodConfig({ simulateSpeaking: e.target.checked })
                            }
                            className="accent-gold-400"
                          />
                          <span>Speaking Peer Glow</span>
                        </label>
                      </div>
                    </div>

                    {/* Phase-Specific Section Controls */}
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-4 space-y-3">
                      <div className="text-xs font-display uppercase tracking-wider text-gold-300">
                        Section States
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs text-cream-300">Lobby Waiting Lounge</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDevGodConfig({
                                page: 'LOBBY',
                                lobbyAllReadyCountdown: !activeConfig.lobbyAllReadyCountdown,
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                              activeConfig.lobbyAllReadyCountdown
                                ? 'bg-emerald-800/80 border-emerald-400 text-white'
                                : 'bg-noir-950 border-gold-500/30 text-cream-200'
                            }`}
                          >
                            {activeConfig.lobbyAllReadyCountdown
                              ? 'Countdown Active ✓'
                              : 'Trigger All-Ready Countdown'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!devGodConfig || devGodConfig.page !== 'LOBBY') {
                                setDevGodConfig({ page: 'LOBBY' });
                              }
                              setWalkBots((v) => !v);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                              walkBots
                                ? 'bg-emerald-800/80 border-emerald-400 text-white'
                                : 'bg-noir-950 border-gold-500/30 text-cream-200'
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            {walkBots ? 'Stop Bot Walk' : 'Walk Lobby Bots'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs text-cream-300">Night Sub-Phase</div>
                        <div className="flex flex-wrap gap-1.5">
                          {NIGHT_MODES.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setDevGodConfig({
                                  page: 'NIGHT',
                                  nightSubPhase: m.id,
                                  myRole:
                                    m.id === 'MAFIA_TURN'
                                      ? 'MAFIA'
                                      : m.id === 'HEALER_TURN'
                                        ? 'HEALER'
                                        : m.id === 'DETECTIVE_TURN'
                                          ? 'DETECTIVE'
                                          : 'VILLAGER',
                                })
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                activeConfig.page === 'NIGHT' && activeConfig.nightSubPhase === m.id
                                  ? 'bg-sky-900/80 border-sky-400 text-sky-100'
                                  : 'bg-noir-950 border-gold-500/20 text-cream-300'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-xs text-cream-300">Dawn Outcome</div>
                          <button
                            type="button"
                            onClick={() =>
                              setDevGodConfig({
                                page: 'DAWN',
                                dawnOutcome:
                                  activeConfig.dawnOutcome === 'KILLED' ? 'SAVED' : 'KILLED',
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-noir-950 border border-gold-500/30 text-xs text-gold-200 cursor-pointer"
                          >
                            {activeConfig.dawnOutcome === 'KILLED' ? 'Victim Killed' : 'Nobody Died'}
                          </button>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs text-cream-300">Vote Mode</div>
                          <button
                            type="button"
                            onClick={() =>
                              setDevGodConfig({
                                page: 'DAY_VOTE',
                                voteRevote: !activeConfig.voteRevote,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-noir-950 border border-gold-500/30 text-xs text-gold-200 cursor-pointer"
                          >
                            {activeConfig.voteRevote ? 'Tie Revote' : 'Standard Ballot'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-cream-300">Game Over Winner</div>
                        <div className="flex gap-1.5">
                          {WINNERS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setDevGodConfig({ page: 'GAME_OVER', winner: w })}
                              className={`flex-1 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                activeConfig.page === 'GAME_OVER' && activeConfig.winner === w
                                  ? 'bg-gold-500/25 border-gold-300 text-gold-200'
                                  : 'bg-noir-950 border-gold-500/20 text-cream-300'
                              }`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Sandbox Utilities */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!devGodConfig) {
                          setDevGodConfig({ page: activePageKey });
                        }
                        pushDevChatMessage(
                          'PUBLIC',
                          'Elena',
                          `Sample message sent at ${new Date().toLocaleTimeString()}`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#162138] hover:bg-[#1e2d4d] border border-gold-500/35 text-xs text-gold-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      Inject Chat Message
                    </button>

                    {devGodConfig && (
                      <button
                        type="button"
                        onClick={resetDevGodScene}
                        className="px-3 py-1.5 rounded-lg bg-[#162138] hover:bg-[#1e2d4d] border border-gold-500/35 text-xs text-cream-200 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Sandbox Scene
                      </button>
                    )}
                  </div>
                </div>
              )}

              {tab === 'inspector' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-3">
                      <div className="text-[10px] uppercase text-cream-400">Mode</div>
                      <div className="font-mono font-bold text-gold-200 mt-0.5">
                        {devGodConfig ? 'GOD SANDBOX' : 'LIVE ROOM'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-3">
                      <div className="text-[10px] uppercase text-cream-400">Phase</div>
                      <div className="font-mono font-bold text-emerald-300 mt-0.5">
                        {room?.game.phase ?? 'HOME'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-3">
                      <div className="text-[10px] uppercase text-cream-400">Socket</div>
                      <div className="font-mono font-bold text-cream-100 mt-0.5">
                        {connectionStatus}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-3">
                      <div className="text-[10px] uppercase text-cream-400">Room / Players</div>
                      <div className="font-mono font-bold text-cream-100 mt-0.5">
                        {room ? `#${room.roomCode} (${room.players.length})` : 'None'}
                      </div>
                    </div>
                  </div>

                  {room ? (
                    <>
                      <div className="rounded-xl border border-gold-500/25 overflow-hidden">
                        <div className="px-3.5 py-2 bg-[#111829] border-b border-gold-500/20 text-xs font-display uppercase tracking-wider text-gold-300">
                          Live Player State Table
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-noir-950/90 text-[10px] font-mono uppercase text-cream-400">
                              <tr>
                                <th className="px-3 py-2">Player</th>
                                <th className="px-3 py-2">Role</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Lobby Pos</th>
                                <th className="px-3 py-2">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gold-500/10 bg-[#0d1322]">
                              {room.players.map((p) => {
                                const pos = lobbyPositions[p.id];
                                return (
                                  <tr key={p.id}>
                                    <td className="px-3 py-2 font-medium text-cream-100">
                                      {p.name}{' '}
                                      {p.id === room.myPlayerId && (
                                        <span className="text-[10px] text-gold-300">(You)</span>
                                      )}
                                      {p.isHost && (
                                        <span className="ml-1 text-[10px] px-1 rounded bg-gold-500/20 text-gold-300">
                                          HOST
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[11px] text-gold-200">
                                      {p.role ?? (p.isPlaying ? 'HIDDEN' : 'GM')}
                                    </td>
                                    <td className="px-3 py-2 text-[11px]">
                                      {room.game.phase === 'LOBBY'
                                        ? p.isReady
                                          ? 'Ready ✓'
                                          : 'Waiting'
                                        : p.isAlive
                                          ? 'Alive'
                                          : 'Dead'}
                                      {!p.connected && ' (Offline)'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-[11px] text-cream-300">
                                      {pos ? `${Math.round(pos.x)}, ${Math.round(pos.y)}` : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-[11px] text-cream-400">
                                      {p.accuseTargetId
                                        ? `Accusing ${room.players.find((x) => x.id === p.accuseTargetId)?.name ?? p.accuseTargetId}`
                                        : p.hasVoted
                                          ? 'Ballot Cast'
                                          : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowRawJson((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111829] border border-gold-500/30 text-xs text-gold-200 cursor-pointer"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          {showRawJson ? 'Hide State JSON' : 'Inspect Raw State JSON'}
                        </button>

                        {showRawJson && (
                          <pre className="p-3 rounded-xl bg-black/75 border border-gold-500/20 text-[11px] font-mono text-emerald-200/90 overflow-x-auto max-h-64">
                            {JSON.stringify(
                              {
                                game: room.game,
                                settings: room.settings,
                                validation: room.validation,
                                lobbyPositions,
                              },
                              null,
                              2
                            )}
                          </pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-[#111829] border border-gold-500/20 p-6 text-center text-xs text-cream-300">
                      Currently on the Home screen. Switch to any page from the <strong>All Pages</strong> tab to inspect live room &amp; player state.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

