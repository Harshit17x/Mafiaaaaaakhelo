import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LOBBY_ARENA_HEIGHT,
  LOBBY_ARENA_WIDTH,
  type ClientPlayerView,
  type LobbyCharacterPosition,
} from '@midnight-city/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crown,
  Timer,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { LobbyCharacterSvg } from './LobbyCharacterSvg';

interface ObstacleBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const WALK_MIN_X = 56;
const WALK_MAX_X = LOBBY_ARENA_WIDTH - 56;
const WALK_MIN_Y = 132;
const WALK_MAX_Y = LOBBY_ARENA_HEIGHT - 46;
const CHAR_SPEED = 265; // virtual units / sec

// Furniture hitboxes matching the SVG speakeasy lounge props
const LOUNGE_OBSTACLES: readonly ObstacleBox[] = [
  // Left velvet booth & candle table
  { id: 'booth', x1: 82, y1: 185, x2: 235, y2: 318 },
  // Bottom-left jazz gramophone & crates
  { id: 'crates', x1: 88, y1: 432, x2: 215, y2: 525 },
  // Bottom-right speakeasy bar counter
  { id: 'bar', x1: 745, y1: 422, x2: 928, y2: 528 },
];

// 16 Well-distributed, non-overlapping spawn spots around the speakeasy lounge
export const LOUNGE_SPAWN_SPOTS: readonly { x: number; y: number; facing: 'left' | 'right' }[] = [
  { x: 440, y: 340, facing: 'right' },
  { x: 260, y: 235, facing: 'right' },
  { x: 715, y: 460, facing: 'left' },
  { x: 490, y: 275, facing: 'left' },
  { x: 265, y: 345, facing: 'right' },
  { x: 805, y: 390, facing: 'left' },
  { x: 245, y: 470, facing: 'right' },
  { x: 575, y: 345, facing: 'left' },
  { x: 410, y: 155, facing: 'right' },
  { x: 490, y: 410, facing: 'right' },
  { x: 710, y: 235, facing: 'right' },
  { x: 340, y: 460, facing: 'right' },
  { x: 620, y: 155, facing: 'left' },
  { x: 635, y: 300, facing: 'left' },
  { x: 885, y: 390, facing: 'left' },
  { x: 670, y: 450, facing: 'left' },
];

function fallbackSpawn(index: number): LobbyCharacterPosition {
  const spot = LOUNGE_SPAWN_SPOTS[index % LOUNGE_SPAWN_SPOTS.length]!;
  return {
    x: spot.x,
    y: spot.y,
    facing: spot.facing,
    moving: false,
    updatedAt: 0,
  };
}

function isBlocked(x: number, y: number): boolean {
  if (x < WALK_MIN_X || x > WALK_MAX_X || y < WALK_MIN_Y || y > WALK_MAX_Y) {
    return true;
  }
  const padX = 20;
  const padY = 12;
  for (const box of LOUNGE_OBSTACLES) {
    if (
      x + padX > box.x1 &&
      x - padX < box.x2 &&
      y + padY > box.y1 &&
      y - padY < box.y2
    ) {
      return true;
    }
  }
  return false;
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export interface LobbyWaitingLoungeProps {
  players: ClientPlayerView[];
  myPlayerId: string;
  viewerIsHost: boolean;
  speakingPeerIds: Set<string>;
  lobbyPositions: Record<string, LobbyCharacterPosition>;
  lobbyCountdownEndsAt: number | null;
  serverTime: number;
  validationValid: boolean;
  validationError: string | null;
  modalOpen: boolean;
  onMove: (pos: { x: number; y: number; facing: 'left' | 'right'; moving: boolean }) => void;
  onOpenCustomization?: () => void;
  onTransferHost: (playerId: string) => void;
  onKickPlayer: (playerId: string) => void;
}

export function LobbyWaitingLounge({
  players,
  myPlayerId,
  viewerIsHost,
  speakingPeerIds,
  lobbyPositions,
  lobbyCountdownEndsAt,
  serverTime,
  validationValid,
  validationError,
  modalOpen,
  onMove,
  onTransferHost,
  onKickPlayer,
}: LobbyWaitingLoungeProps) {
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [waypoint, setWaypoint] = useState<{ x: number; y: number } | null>(null);

  // Sync clock offset so countdown displays consistently across clients
  const clockOffsetRef = useRef(serverTime - Date.now());
  useEffect(() => {
    clockOffsetRef.current = serverTime - Date.now();
  }, [serverTime]);

  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  useEffect(() => {
    if (lobbyCountdownEndsAt === null) return;
    setCountdownNow(Date.now());
    const id = window.setInterval(() => setCountdownNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [lobbyCountdownEndsAt]);

  const countdownSec =
    lobbyCountdownEndsAt !== null
      ? Math.max(0, Math.ceil((lobbyCountdownEndsAt - (countdownNow + clockOffsetRef.current)) / 1000))
      : null;

  const prevCountdownSecRef = useRef<number | null>(null);
  useEffect(() => {
    if (lobbyCountdownEndsAt === null || countdownSec === null) {
      prevCountdownSecRef.current = null;
      return;
    }
    const prev = prevCountdownSecRef.current;
    if (prev === countdownSec) return;
    prevCountdownSecRef.current = countdownSec;

    if (countdownSec >= 1 && countdownSec <= 3) {
      soundEngine.playTimerTick();
    } else if (countdownSec === 0 && prev !== null && prev > 0) {
      soundEngine.playCountdownGo();
    }
  }, [lobbyCountdownEndsAt, countdownSec]);

  // Player color map keeps suit colors stable while players join/leave
  const playerColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    players.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [players]);

  const initialMyPos = useMemo(() => {
    const idx = Math.max(0, players.findIndex((p) => p.id === myPlayerId));
    return lobbyPositions[myPlayerId] ?? fallbackSpawn(idx);
  }, [lobbyPositions, myPlayerId, players]);

  const myPosRef = useRef<{
    x: number;
    y: number;
    facing: 'left' | 'right';
    moving: boolean;
  }>({
    x: initialMyPos.x,
    y: initialMyPos.y,
    facing: initialMyPos.facing,
    moving: false,
  });

  // Render positions state updated smoothly inside requestAnimationFrame
  const [renderedPositions, setRenderedPositions] = useState<
    Record<string, { x: number; y: number; facing: 'left' | 'right'; moving: boolean }>
  >(() => {
    const init: Record<
      string,
      { x: number; y: number; facing: 'left' | 'right'; moving: boolean }
    > = {};
    players.forEach((p, idx) => {
      const sp = lobbyPositions[p.id] ?? fallbackSpawn(idx);
      init[p.id] = { x: sp.x, y: sp.y, facing: sp.facing, moving: sp.moving };
    });
    return init;
  });

  const renderedPosRef = useRef(renderedPositions);
  const serverPositionsRef = useRef(lobbyPositions);
  serverPositionsRef.current = lobbyPositions;

  const playersRef = useRef(players);
  playersRef.current = players;

  const keysHeldRef = useRef<Set<string>>(new Set());
  const touchDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const waypointRef = useRef<{ x: number; y: number } | null>(null);
  waypointRef.current = waypoint;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  // Ensure local spawn syncs if server reassigned positions (e.g. play again)
  useEffect(() => {
    const serverMine = lobbyPositions[myPlayerId];
    if (!serverMine) return;
    if (
      Math.hypot(serverMine.x - myPosRef.current.x, serverMine.y - myPosRef.current.y) > 220 &&
      !myPosRef.current.moving
    ) {
      myPosRef.current = {
        x: serverMine.x,
        y: serverMine.y,
        facing: serverMine.facing,
        moving: false,
      };
    }
  }, [lobbyPositions, myPlayerId]);

  // Clear selected player popover if player leaves
  useEffect(() => {
    if (selectedPlayerId && !players.some((p) => p.id === selectedPlayerId)) {
      setSelectedPlayerId(null);
    }
  }, [players, selectedPlayerId]);

  // Keyboard controls: WASD / Arrows
  useEffect(() => {
    const moveKeys = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (modalOpenRef.current || isTypingElement(e.target)) {
        return;
      }

      if (moveKeys.has(e.code)) {
        e.preventDefault();
        keysHeldRef.current.add(e.code);
        if (waypointRef.current) {
          setWaypoint(null);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const onBlur = () => {
      keysHeldRef.current.clear();
      touchDirRef.current = { dx: 0, dy: 0 };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Main 60fps simulation & remote interpolation loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastEmitAt = 0;
    let lastFootstepAt = 0;
    let wasMoving = false;

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      let vx = touchDirRef.current.dx;
      let vy = touchDirRef.current.dy;

      if (!modalOpenRef.current) {
        const held = keysHeldRef.current;
        if (held.has('KeyA') || held.has('ArrowLeft')) vx -= 1;
        if (held.has('KeyD') || held.has('ArrowRight')) vx += 1;
        if (held.has('KeyW') || held.has('ArrowUp')) vy -= 1;
        if (held.has('KeyS') || held.has('ArrowDown')) vy += 1;
      } else {
        keysHeldRef.current.clear();
      }

      // Click/tap floor waypoint when no manual key/pad is pressed
      if (vx === 0 && vy === 0 && waypointRef.current) {
        const dx = waypointRef.current.x - myPosRef.current.x;
        const dy = waypointRef.current.y - myPosRef.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 7) {
          setWaypoint(null);
        } else {
          vx = dx / dist;
          vy = dy / dist;
        }
      }

      const len = Math.hypot(vx, vy);
      let isMoving = false;

      if (len > 0.01) {
        const nx = vx / len;
        const ny = vy / len;
        const stepX = nx * CHAR_SPEED * dt;
        const stepY = ny * CHAR_SPEED * dt;

        let nextX = myPosRef.current.x;
        let nextY = myPosRef.current.y;

        if (!isBlocked(nextX + stepX, nextY)) {
          nextX += stepX;
        }
        if (!isBlocked(nextX, nextY + stepY)) {
          nextY += stepY;
        }

        const movedDist = Math.hypot(nextX - myPosRef.current.x, nextY - myPosRef.current.y);
        if (movedDist > 0.05) {
          isMoving = true;
          myPosRef.current.x = nextX;
          myPosRef.current.y = nextY;
        } else if (waypointRef.current) {
          setWaypoint(null);
        }

        if (Math.abs(nx) > 0.12) {
          myPosRef.current.facing = nx < 0 ? 'left' : 'right';
        }
      }

      myPosRef.current.moving = isMoving;

      if (isMoving && now - lastFootstepAt >= 260) {
        lastFootstepAt = now;
        soundEngine.playFootstep();
      }

      // Throttle socket emission (~18 Hz) and send immediate stop frame
      if (isMoving && now - lastEmitAt >= 55) {
        lastEmitAt = now;
        onMoveRef.current({
          x: myPosRef.current.x,
          y: myPosRef.current.y,
          facing: myPosRef.current.facing,
          moving: true,
        });
      } else if (!isMoving && wasMoving) {
        lastEmitAt = now;
        onMoveRef.current({
          x: myPosRef.current.x,
          y: myPosRef.current.y,
          facing: myPosRef.current.facing,
          moving: false,
        });
      }
      wasMoving = isMoving;

      // Build updated render positions map (local instantaneous, remote smooth lerp)
      const prevRender = renderedPosRef.current;
      const nextRender: typeof prevRender = {};
      const lerpFactor = 1 - Math.exp(-15 * dt);

      playersRef.current.forEach((p, idx) => {
        if (p.id === myPlayerId) {
          nextRender[p.id] = { ...myPosRef.current };
          return;
        }

        const target = serverPositionsRef.current[p.id] ?? fallbackSpawn(idx);
        const prev = prevRender[p.id] ?? {
          x: target.x,
          y: target.y,
          facing: target.facing,
          moving: target.moving,
        };
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 320) {
          nextRender[p.id] = { ...target };
        } else if (dist > 0.4) {
          nextRender[p.id] = {
            x: prev.x + dx * lerpFactor,
            y: prev.y + dy * lerpFactor,
            facing: Math.abs(dx) > 0.4 ? (dx < 0 ? 'left' : 'right') : target.facing,
            moving: target.moving || dist > 2,
          };
        } else {
          nextRender[p.id] = {
            x: target.x,
            y: target.y,
            facing: target.facing,
            moving: target.moving,
          };
        }
      });

      renderedPosRef.current = nextRender;
      setRenderedPositions(nextRender);

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [myPlayerId]);

  const handleFloorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!arenaRef.current) return;
    setSelectedPlayerId(null);
    const rect = arenaRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * LOBBY_ARENA_WIDTH;
    const clickY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * LOBBY_ARENA_HEIGHT;
    const clampedX = Math.max(WALK_MIN_X, Math.min(WALK_MAX_X, clickX));
    const clampedY = Math.max(WALK_MIN_Y, Math.min(WALK_MAX_Y, clickY));
    setWaypoint({ x: clampedX, y: clampedY });
  }, []);

  const setTouchPad = (dx: number, dy: number) => {
    touchDirRef.current = { dx, dy };
    if (dx !== 0 || dy !== 0) {
      setWaypoint(null);
    }
  };

  const playingPlayers = players.filter((p) => p.isPlaying);
  const readyCount = playingPlayers.filter((p) => p.isReady).length;
  const sortedByDepth = [...players].sort((a, b) => {
    const ya = renderedPositions[a.id]?.y ?? 300;
    const yb = renderedPositions[b.id]?.y ?? 300;
    return ya - yb;
  });

  const selectedPlayer = selectedPlayerId
    ? players.find((p) => p.id === selectedPlayerId) ?? null
    : null;

  const renderTouchPadGrid = (compactSize: boolean) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className={
        compactSize
          ? 'grid grid-cols-3 gap-1 w-[5.5rem] h-[5.5rem] shrink-0'
          : 'hidden sm:grid lg:hidden absolute bottom-2.5 left-2.5 z-[680] grid-cols-3 gap-1 w-24 h-24 opacity-85'
      }
      aria-label="Touch movement pad"
    >
      <div />
      <button
        type="button"
        data-sfx="none"
        aria-label="Move up"
        onPointerDown={() => setTouchPad(0, -1)}
        onPointerUp={() => setTouchPad(0, 0)}
        onPointerLeave={() => setTouchPad(0, 0)}
        onPointerCancel={() => setTouchPad(0, 0)}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <div />
      <button
        type="button"
        data-sfx="none"
        aria-label="Move left"
        onPointerDown={() => setTouchPad(-1, 0)}
        onPointerUp={() => setTouchPad(0, 0)}
        onPointerLeave={() => setTouchPad(0, 0)}
        onPointerCancel={() => setTouchPad(0, 0)}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>
      <div className="rounded-lg bg-noir-950/50 border border-gold-500/15" />
      <button
        type="button"
        data-sfx="none"
        aria-label="Move right"
        onPointerDown={() => setTouchPad(1, 0)}
        onPointerUp={() => setTouchPad(0, 0)}
        onPointerLeave={() => setTouchPad(0, 0)}
        onPointerCancel={() => setTouchPad(0, 0)}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
      <div />
      <button
        type="button"
        data-sfx="none"
        aria-label="Move down"
        onPointerDown={() => setTouchPad(0, 1)}
        onPointerUp={() => setTouchPad(0, 0)}
        onPointerLeave={() => setTouchPad(0, 0)}
        onPointerCancel={() => setTouchPad(0, 0)}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
      <div />
    </div>
  );

  return (
    <div className="space-y-2 sm:space-y-2.5">
      {/* Lounge Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-display uppercase tracking-wider text-gold-200 font-bold">
            <Users className="w-3.5 h-3.5 text-gold-400" />
            Lounge ({playingPlayers.length}/16)
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
              readyCount === playingPlayers.length && playingPlayers.length > 0
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                : 'bg-noir-900 border-gold-500/30 text-cream-300'
            }`}
          >
            {readyCount}/{playingPlayers.length} Ready
          </span>
          {!validationValid && validationError && (
            <span className="text-amber-300/90 text-[11px]">• {validationError}</span>
          )}
        </div>

        <span className="text-[11px] text-cream-400 hidden sm:inline font-mono">
          Move with WASD / Arrows or click floor to walk
        </span>
      </div>

      {/* Interactive Speakeasy Lounge Arena */}
      <div
        ref={arenaRef}
        onClick={handleFloorClick}
        role="region"
        aria-label="Interactive Lobby Waiting Area Lounge"
        className="relative w-full aspect-[5/3] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-gold-500/35 bg-[#080c16] shadow-[0_24px_60px_rgba(0,0,0,0.85)] select-none cursor-crosshair touch-manipulation"
      >
        {/* Speakeasy Lounge Room Vector Artwork */}
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <pattern id="loungeWood" width="80" height="40" patternUnits="userSpaceOnUse">
              <rect width="80" height="40" fill="#140f12" />
              <path d="M0 0 H80 M0 20 H80" stroke="#221715" strokeWidth="1.5" />
              <path d="M40 0 V20 M20 20 V40 M60 20 V40" stroke="#1c1312" strokeWidth="1" />
            </pattern>
            <radialGradient id="centerSpot" cx="50%" cy="54%" r="55%">
              <stop offset="0%" stopColor="rgba(245, 200, 110, 0.16)" />
              <stop offset="55%" stopColor="rgba(20, 32, 52, 0.08)" />
              <stop offset="100%" stopColor="rgba(4, 6, 12, 0.72)" />
            </radialGradient>
            <radialGradient id="sconceLight" cx="50%" cy="0%" r="90%">
              <stop offset="0%" stopColor="rgba(251, 191, 36, 0.35)" />
              <stop offset="60%" stopColor="rgba(245, 158, 11, 0.12)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
            </radialGradient>
          </defs>

          {/* Hardwood Floor */}
          <rect x="0" y="105" width="1000" height="495" fill="url(#loungeWood)" />

          {/* Back Speakeasy Wall */}
          <rect x="0" y="0" width="1000" height="108" fill="#0b0f1a" />
          <rect x="0" y="74" width="1000" height="34" fill="#24150f" />
          <rect x="0" y="72" width="1000" height="4" fill="#b98e39" opacity="0.8" />
          <rect x="0" y="106" width="1000" height="4" fill="#704f1a" />

          {/* Wall Sconce Lights casting warm golden beams */}
          {[70, 310, 520, 730].map((lx) => (
            <g key={lx} transform={`translate(${lx}, 36)`}>
              <polygon points="10,0 -30,120 50,120" fill="url(#sconceLight)" />
              <rect x="6" y="0" width="8" height="14" rx="2" fill="#d4af37" stroke="#78350f" strokeWidth="1" />
              <circle cx="10" cy="5" r="4.5" fill="#fef08a" />
            </g>
          ))}

          {/* Rainy Noir Windows on Back Wall */}
          {[140, 385, 595].map((wx) => (
            <g key={wx} transform={`translate(${wx}, 14)`}>
              <rect width="120" height="52" rx="6" fill="#07101f" stroke="#b98e39" strokeWidth="2" />
              <line x1="60" y1="0" x2="60" y2="52" stroke="#856426" strokeWidth="1.5" />
              <line x1="16" y1="12" x2="26" y2="38" stroke="#60a5fa" strokeOpacity="0.22" strokeWidth="1.5" />
              <line x1="82" y1="10" x2="94" y2="42" stroke="#60a5fa" strokeOpacity="0.18" strokeWidth="1.5" />
            </g>
          ))}

          {/* Center Velvet Gathering Carpet */}
          <ellipse cx="485" cy="342" rx="192" ry="110" fill="#381016" stroke="#c99a42" strokeWidth="3" />
          <ellipse cx="485" cy="342" rx="174" ry="96" fill="none" stroke="#e5c170" strokeWidth="1.2" strokeDasharray="8 6" opacity="0.65" />
          <circle cx="485" cy="342" r="46" fill="#220a0e" stroke="#c99a42" strokeWidth="1.5" opacity="0.85" />
          <text
            x="485"
            y="338"
            textAnchor="middle"
            fill="#f5dfb0"
            opacity="0.8"
            fontSize="11"
            fontWeight="700"
            letterSpacing="3"
          >
            MIDNIGHT
          </text>
          <text
            x="485"
            y="353"
            textAnchor="middle"
            fill="#d4a84f"
            opacity="0.75"
            fontSize="9"
            fontWeight="600"
            letterSpacing="2.5"
          >
            LOUNGE
          </text>

          {/* Left Velvet Booth & Table */}
          <g transform="translate(88, 188)">
            <rect x="0" y="0" width="46" height="122" rx="12" fill="#4f1620" stroke="#22090e" strokeWidth="2.5" />
            <rect x="10" y="10" width="28" height="102" rx="8" fill="#6b1f2d" />
            <circle cx="98" cy="61" r="38" fill="#2a140b" stroke="#b98e39" strokeWidth="2.5" />
            <circle cx="98" cy="61" r="30" fill="#0b3d2b" stroke="#10b981" strokeWidth="1.2" />
            <circle cx="98" cy="61" r="14" fill="#1f1008" stroke="#d4af37" strokeWidth="1.2" />
            <circle cx="98" cy="61" r="5" fill="#f59e0b" />
          </g>

          {/* Bottom-Left Jazz Gramophone & Crates */}
          <g transform="translate(94, 434)">
            <rect x="0" y="14" width="56" height="56" rx="5" fill="#442919" stroke="#22130b" strokeWidth="2.5" />
            <line x1="0" y1="14" x2="56" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <line x1="56" y1="14" x2="0" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <rect x="64" y="28" width="46" height="44" rx="5" fill="#52321e" stroke="#22130b" strokeWidth="2.5" />
            <ellipse cx="87" cy="24" rx="15" ry="9" fill="#171717" stroke="#b45309" strokeWidth="1.5" />
            <path d="M87 24 Q95 8 114 4" stroke="#d4af37" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="116" cy="4" rx="8" ry="12" fill="#d97706" stroke="#fbbf24" strokeWidth="1.2" transform="rotate(20 116 4)" />
          </g>

          {/* Bottom-Right Speakeasy Bar Counter */}
          <g transform="translate(752, 424)">
            <rect x="0" y="10" width="170" height="88" rx="10" fill="#28150d" stroke="#b98e39" strokeWidth="2.5" />
            <rect x="10" y="18" width="150" height="22" rx="5" fill="#422214" />
            <circle cx="34" cy="29" r="6" fill="#d97706" />
            <circle cx="52" cy="29" r="5" fill="#b91c1c" />
            <circle cx="70" cy="29" r="6" fill="#f59e0b" />
            <circle cx="120" cy="29" r="6" fill="#e5e7eb" opacity="0.8" />
            <circle cx="138" cy="29" r="5" fill="#10b981" opacity="0.85" />
          </g>

          {/* Ambient Lighting Overlay */}
          <rect x="0" y="0" width="1000" height="600" fill="url(#centerSpot)" />
        </svg>

        {/* Floor Click Target Ring */}
        {waypoint && (
          <div
            aria-hidden="true"
            style={{
              left: `${(waypoint.x / LOBBY_ARENA_WIDTH) * 100}%`,
              top: `${(waypoint.y / LOBBY_ARENA_HEIGHT) * 100}%`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="w-6 h-3.5 rounded-full border-2 border-gold-300/80 animate-ping" />
          </div>
        )}

        {/* Moving SVG Player Characters (Y-sorted for natural depth overlap) */}
        {sortedByDepth.map((p) => {
          const pos = renderedPositions[p.id] ?? fallbackSpawn(playerColorIndex.get(p.id) ?? 0);
          const leftPct = (pos.x / LOBBY_ARENA_WIDTH) * 100;
          const topPct = (pos.y / LOBBY_ARENA_HEIGHT) * 100;
          return (
            <div
              key={p.id}
              style={{
                left: `${leftPct.toFixed(2)}%`,
                top: `${topPct.toFixed(2)}%`,
                zIndex: Math.round(pos.y) + (p.id === myPlayerId ? 2 : 0),
              }}
              className="absolute -translate-x-1/2 -translate-y-[82%]"
            >
              <LobbyCharacterSvg
                player={p}
                colorIndex={playerColorIndex.get(p.id) ?? 0}
                facing={pos.facing}
                moving={pos.moving}
                isMe={p.id === myPlayerId}
                isSpeaking={speakingPeerIds.has(p.id)}
                selected={selectedPlayerId === p.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.id === myPlayerId) return;
                  setSelectedPlayerId((prev) => (prev === p.id ? null : p.id));
                }}
              />
            </div>
          );
        })}

        {/* Match Launch Countdown Banner */}
        {countdownSec !== null && (
          <div
            role="status"
            aria-live="assertive"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none absolute top-1.5 sm:top-4 left-1/2 -translate-x-1/2 z-[700] max-w-[92%] px-3 sm:px-6 py-1 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-950/95 via-noir-950/95 to-emerald-950/95 border-2 border-emerald-400/75 shadow-[0_14px_40px_rgba(0,0,0,0.85)] flex items-center gap-2 sm:gap-2.5"
          >
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 animate-pulse shrink-0" />
            <div className="text-center">
              <div className="hidden sm:block text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300">
                Everyone Ready • Match Beginning
              </div>
              <div className="font-display text-xs sm:text-lg font-bold uppercase tracking-wider text-white whitespace-nowrap">
                {countdownSec > 0 ? `Starting in ${countdownSec}...` : 'Dealing Dossiers...'}
              </div>
            </div>
          </div>
        )}

        {/* Selected Player Host Actions Popover */}
        {selectedPlayer && selectedPlayer.id !== myPlayerId && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[710] game-hud-glass rounded-xl p-2 sm:p-3 w-44 sm:w-56 space-y-2 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-gold-200 truncate">
                  {selectedPlayer.name}
                </div>
                <div className="text-[10px] text-cream-400">
                  {selectedPlayer.isHost
                    ? 'Room Host'
                    : selectedPlayer.isReady
                      ? 'Ready to play'
                      : 'Waiting in lounge'}
                </div>
              </div>
              <button
                type="button"
                data-sfx="back"
                onClick={() => setSelectedPlayerId(null)}
                aria-label="Close player menu"
                className="p-1 rounded hover:bg-noir-800 text-cream-400 hover:text-cream-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {viewerIsHost && (
              <div className="flex flex-col gap-1.5 pt-1 border-t border-gold-500/20">
                <button
                  type="button"
                  data-sfx="confirm"
                  onClick={() => {
                    onTransferHost(selectedPlayer.id);
                    setSelectedPlayerId(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-noir-900 hover:bg-noir-800 border border-gold-500/35 text-xs text-gold-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Make Host
                </button>
                <button
                  type="button"
                  data-sfx="confirm"
                  onClick={() => {
                    onKickPlayer(selectedPlayer.id);
                    setSelectedPlayerId(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-crimson-950/80 hover:bg-crimson-900 border border-crimson-500/45 text-xs text-crimson-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Kick Player
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tablet Touch Directional Pad */}
        {renderTouchPadGrid(false)}
      </div>

      {/* Unobstructed Phone Touch Pad (<640px) */}
      <div className="sm:hidden flex items-center justify-between gap-3 rounded-xl bg-noir-900/80 border border-gold-500/25 px-3 py-2">
        {renderTouchPadGrid(true)}
        <div className="flex-1 min-w-0 space-y-1 text-right text-[11px] text-cream-300/85">
          <p>Tap anywhere on the floor or use the D-pad to walk.</p>
        </div>
      </div>
    </div>
  );
}
