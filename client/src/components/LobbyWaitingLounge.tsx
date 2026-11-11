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
  Sparkles,
  Timer,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
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
  // Top-right Customization Area (wardrobe mirror & trunk)
  { id: 'custom-station', x1: 755, y1: 122, x2: 922, y2: 222 },
  // Bottom-right speakeasy bar counter
  { id: 'bar', x1: 745, y1: 422, x2: 928, y2: 528 },
];

// Center of the Customization Area interaction zone
const CUSTOM_STATION_SPOT = { x: 835, y: 210 };
const CUSTOM_INTERACT_RADIUS = 135;

function fallbackSpawn(index: number): LobbyCharacterPosition {
  const angle = ((index % 16) / 8) * Math.PI - Math.PI / 2;
  const ringRadius = index >= 8 ? 165 : 115;
  const x = Math.round(480 + Math.cos(angle) * ringRadius);
  const y = Math.round(335 + Math.sin(angle) * (ringRadius * 0.65));
  return {
    x,
    y,
    facing: x > 480 ? 'left' : 'right',
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
  onOpenCustomization: () => void;
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
  onOpenCustomization,
  onTransferHost,
  onKickPlayer,
}: LobbyWaitingLoungeProps) {
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [waypoint, setWaypoint] = useState<{ x: number; y: number } | null>(null);
  const [nearCustomize, setNearCustomize] = useState(false);

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

  const onOpenCustomizationRef = useRef(onOpenCustomization);
  onOpenCustomizationRef.current = onOpenCustomization;

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

  // Keyboard movement + 'E' to interact with Customization Area
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
      if (e.code === 'KeyE') {
        const dist = Math.hypot(
          myPosRef.current.x - CUSTOM_STATION_SPOT.x,
          myPosRef.current.y - CUSTOM_STATION_SPOT.y
        );
        if (dist <= CUSTOM_INTERACT_RADIUS) {
          e.preventDefault();
          onOpenCustomizationRef.current();
        }
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
    let wasMoving = false;
    let lastNear = false;

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
          // Stop waypoint if blocked against furniture edge
          setWaypoint(null);
        }

        if (Math.abs(nx) > 0.12) {
          myPosRef.current.facing = nx < 0 ? 'left' : 'right';
        }
      }

      myPosRef.current.moving = isMoving;

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

      // Proximity check for Customization Area
      const distToCustom = Math.hypot(
        myPosRef.current.x - CUSTOM_STATION_SPOT.x,
        myPosRef.current.y - CUSTOM_STATION_SPOT.y
      );
      const isNearCustom = distToCustom <= CUSTOM_INTERACT_RADIUS;
      if (isNearCustom !== lastNear) {
        lastNear = isNearCustom;
        setNearCustomize(isNearCustom);
      }

      // Build updated render positions map (local instantaneous, remote smooth lerp)
      const prevRender = renderedPosRef.current;
      const nextRender: typeof prevRender = {};
      const lerpFactor = 1 - Math.exp(-15 * dt);
      let anyChanged = isMoving;

      playersRef.current.forEach((p, idx) => {
        if (p.id === myPlayerId) {
          const prev = prevRender[p.id];
          if (
            !prev ||
            Math.abs(prev.x - myPosRef.current.x) > 0.05 ||
            Math.abs(prev.y - myPosRef.current.y) > 0.05 ||
            prev.facing !== myPosRef.current.facing ||
            prev.moving !== myPosRef.current.moving
          ) {
            anyChanged = true;
          }
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

        if (dist > 0.4 || prev.moving !== target.moving || prev.facing !== target.facing) {
          anyChanged = true;
        }

        nextRender[p.id] = {
          x: dist < 0.4 ? target.x : prev.x + dx * lerpFactor,
          y: dist < 0.4 ? target.y : prev.y + dy * lerpFactor,
          facing: target.facing,
          moving: dist > 2 ? true : target.moving,
        };
      });

      if (anyChanged || Object.keys(prevRender).length !== Object.keys(nextRender).length) {
        renderedPosRef.current = nextRender;
        setRenderedPositions(nextRender);
      }

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

  return (
    <div className="space-y-2.5">
      {/* Lounge Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-display uppercase tracking-wider text-gold-300 font-semibold">
            <Users className="w-3.5 h-3.5" />
            Waiting Lounge ({playingPlayers.length}/16)
          </span>
          <span className="text-cream-400">
            • {readyCount}/{playingPlayers.length} Ready
          </span>
          {!validationValid && validationError && (
            <span className="text-amber-300/90 text-[11px]">• {validationError}</span>
          )}
        </div>

        <span className="text-[11px] text-cream-400 hidden sm:inline">
          Move with WASD / Arrows or click floor • Walk to Customization Area
        </span>
      </div>

      {/* Interactive Among-Us-Style Speakeasy Lounge Arena */}
      <div
        ref={arenaRef}
        onClick={handleFloorClick}
        role="region"
        aria-label="Interactive Lobby Waiting Area Lounge"
        className="relative w-full aspect-[5/3] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-gold-500/35 bg-[#080c16] shadow-[0_24px_60px_rgba(0,0,0,0.8)] select-none cursor-crosshair"
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
              <rect width="80" height="40" fill="#171214" />
              <path d="M0 0 H80 M0 20 H80" stroke="#241a18" strokeWidth="1.5" />
              <path d="M40 0 V20 M20 20 V40 M60 20 V40" stroke="#1f1615" strokeWidth="1" />
            </pattern>
            <radialGradient id="centerSpot" cx="50%" cy="54%" r="55%">
              <stop offset="0%" stopColor="rgba(245, 200, 110, 0.14)" />
              <stop offset="55%" stopColor="rgba(20, 32, 52, 0.08)" />
              <stop offset="100%" stopColor="rgba(4, 6, 12, 0.72)" />
            </radialGradient>
            <radialGradient id="customGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={nearCustomize ? 'rgba(245, 206, 110, 0.45)' : 'rgba(212, 168, 79, 0.24)'} />
              <stop offset="100%" stopColor="rgba(212, 168, 79, 0)" />
            </radialGradient>
          </defs>

          {/* Hardwood Floor */}
          <rect x="0" y="105" width="1000" height="495" fill="url(#loungeWood)" />

          {/* Back Speakeasy Wall */}
          <rect x="0" y="0" width="1000" height="108" fill="#0d1220" />
          <rect x="0" y="74" width="1000" height="34" fill="#2a1912" />
          <rect x="0" y="72" width="1000" height="4" fill="#b98e39" opacity="0.7" />
          <rect x="0" y="106" width="1000" height="4" fill="#704f1a" />

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
          <ellipse cx="485" cy="342" rx="188" ry="108" fill="#3a1118" stroke="#c99a42" strokeWidth="3" />
          <ellipse cx="485" cy="342" rx="170" ry="94" fill="none" stroke="#e5c170" strokeWidth="1.2" strokeDasharray="8 6" opacity="0.65" />
          <circle cx="485" cy="342" r="46" fill="#250b10" stroke="#c99a42" strokeWidth="1.5" opacity="0.85" />
          <text
            x="485"
            y="338"
            textAnchor="middle"
            fill="#f5dfb0"
            opacity="0.7"
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
            opacity="0.65"
            fontSize="9"
            fontWeight="600"
            letterSpacing="2.5"
          >
            LOUNGE
          </text>

          {/* Left Velvet Booth & Candle Table */}
          <g transform="translate(88, 188)">
            <rect x="0" y="0" width="46" height="122" rx="12" fill="#4f1620" stroke="#22090e" strokeWidth="2.5" />
            <rect x="10" y="10" width="28" height="102" rx="8" fill="#6b1f2d" />
            <circle cx="98" cy="61" r="38" fill="#3b2014" stroke="#b98e39" strokeWidth="2.5" />
            <circle cx="98" cy="61" r="30" fill="#0e4532" />
            <circle cx="98" cy="61" r="6" fill="#ffbe55" opacity="0.85" />
          </g>

          {/* Bottom-Left Jazz Gramophone & Prohibition Crates */}
          <g transform="translate(94, 434)">
            <rect x="0" y="14" width="56" height="56" rx="5" fill="#442919" stroke="#22130b" strokeWidth="2.5" />
            <line x1="0" y1="14" x2="56" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <line x1="56" y1="14" x2="0" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <rect x="64" y="28" width="46" height="44" rx="5" fill="#52321e" stroke="#22130b" strokeWidth="2.5" />
            <ellipse cx="87" cy="24" rx="14" ry="8" fill="#d4a84f" stroke="#704f1a" strokeWidth="1.5" />
          </g>

          {/* Bottom-Right Speakeasy Bar Counter */}
          <g transform="translate(752, 424)">
            <rect x="0" y="10" width="170" height="88" rx="10" fill="#2d1810" stroke="#b98e39" strokeWidth="2.5" />
            <rect x="10" y="18" width="150" height="22" rx="5" fill="#4d2819" />
            {/* Amber bottles / glasses */}
            <circle cx="38" cy="29" r="6" fill="#d97706" />
            <circle cx="58" cy="29" r="5" fill="#991b1b" />
            <circle cx="78" cy="29" r="6" fill="#f59e0b" />
            <circle cx="132" cy="29" r="6" fill="#e5e7eb" opacity="0.7" />
            <text
              x="85"
              y="76"
              textAnchor="middle"
              fill="#d4a84f"
              opacity="0.7"
              fontSize="10"
              fontWeight="700"
              letterSpacing="2"
            >
              SPEAKEASY BAR
            </text>
          </g>

          {/* Top-Right CUSTOMIZATION AREA (Among-Us Wardrobe / Vanity Booth) */}
          <g>
            <ellipse cx="838" cy="184" rx="106" ry="72" fill="url(#customGlow)" />
            {/* Interactive floor zone mat */}
            <rect
              x="732"
              y="124"
              width="210"
              height="128"
              rx="18"
              fill="rgba(20, 26, 42, 0.55)"
              stroke={nearCustomize ? '#fde68a' : '#d4a84f'}
              strokeWidth={nearCustomize ? '2.5' : '1.5'}
              strokeDasharray="6 4"
            />
            {/* Wardrobe / Polaroid Customization Console */}
            <rect
              x="764"
              y="122"
              width="148"
              height="74"
              rx="10"
              fill="#381f13"
              stroke={nearCustomize ? '#fef08a' : '#d4a84f'}
              strokeWidth="2.5"
            />
            {/* Glowing Vanity Mirror + Polaroid Cards */}
            <rect x="780" y="132" width="54" height="44" rx="5" fill="#172033" stroke="#e8c67a" strokeWidth="1.8" />
            <rect x="788" y="138" width="16" height="20" rx="1.5" fill="#ebe6dc" transform="rotate(-8 796 148)" />
            <rect x="808" y="140" width="16" height="20" rx="1.5" fill="#dac49d" transform="rotate(7 816 150)" />
            <rect x="846" y="134" width="52" height="40" rx="5" fill="#23140e" stroke="#b98e39" strokeWidth="1.5" />
            <circle cx="872" cy="154" r="11" fill="#148653" stroke="#a7f3d0" strokeWidth="1.5" />
            <path d="M867 154 H877 M872 149 V159" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </g>

          {/* Ambient Vignette & Lighting Overlay */}
          <rect x="0" y="0" width="1000" height="600" fill="url(#centerSpot)" />
        </svg>

        {/* Clickable Customization Area Station Overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCustomization();
          }}
          style={{
            left: '83.8%',
            top: '27.5%',
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
            nearCustomize
              ? 'bg-gold-500 text-noir-950 border-cream-50 shadow-[0_0_24px_rgba(245,208,116,0.75)] scale-105'
              : 'bg-noir-950/85 hover:bg-noir-900 text-gold-200 border-gold-400/55 shadow-lg'
          }`}
        >
          <span className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-display font-bold uppercase tracking-wider whitespace-nowrap">
            <Sparkles className="w-3 h-3 shrink-0" />
            Customization Area
          </span>
          <span
            className={`text-[8px] sm:text-[9.5px] font-mono whitespace-nowrap ${
              nearCustomize ? 'text-noir-950 font-bold' : 'text-cream-300/85'
            }`}
          >
            {nearCustomize ? 'Press E or Click • Add / Delete Avatar' : 'Add / Delete Avatar'}
          </span>
        </button>

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

        {/* Among-Us-Style Match Launch Countdown Banner */}
        {countdownSec !== null && (
          <div
            role="status"
            aria-live="assertive"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[700] px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-noir-950/95 to-emerald-950/95 border-2 border-emerald-400/75 shadow-[0_14px_40px_rgba(0,0,0,0.85)] flex items-center gap-2.5"
          >
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 animate-pulse shrink-0" />
            <div className="text-center">
              <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300">
                Everyone Ready • Match Beginning
              </div>
              <div className="font-display text-sm sm:text-lg font-bold uppercase tracking-wider text-white">
                {countdownSec > 0 ? `Starting in ${countdownSec}...` : 'Dealing Dossiers...'}
              </div>
            </div>
          </div>
        )}

        {/* Selected Player Host Actions Popover (Kick / Transfer Host) */}
        {selectedPlayer && selectedPlayer.id !== myPlayerId && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 z-[710] game-hud-glass rounded-xl p-3 w-56 space-y-2 shadow-2xl"
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

        {/* Mobile / Touch Directional Pad (hidden on desktop lg+) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="lg:hidden absolute bottom-2.5 left-2.5 z-[680] grid grid-cols-3 gap-1 w-24 h-24 opacity-85"
          aria-label="Touch movement pad"
        >
          <div />
          <button
            type="button"
            aria-label="Move up"
            onPointerDown={() => setTouchPad(0, -1)}
            onPointerUp={() => setTouchPad(0, 0)}
            onPointerLeave={() => setTouchPad(0, 0)}
            onPointerCancel={() => setTouchPad(0, 0)}
            className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Move left"
            onPointerDown={() => setTouchPad(-1, 0)}
            onPointerUp={() => setTouchPad(0, 0)}
            onPointerLeave={() => setTouchPad(0, 0)}
            onPointerCancel={() => setTouchPad(0, 0)}
            className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="rounded-lg bg-noir-950/50 border border-gold-500/15" />
          <button
            type="button"
            aria-label="Move right"
            onPointerDown={() => setTouchPad(1, 0)}
            onPointerUp={() => setTouchPad(0, 0)}
            onPointerLeave={() => setTouchPad(0, 0)}
            onPointerCancel={() => setTouchPad(0, 0)}
            className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Move down"
            onPointerDown={() => setTouchPad(0, 1)}
            onPointerUp={() => setTouchPad(0, 0)}
            onPointerLeave={() => setTouchPad(0, 0)}
            onPointerCancel={() => setTouchPad(0, 0)}
            className="rounded-lg bg-noir-950/85 border border-gold-500/40 text-gold-200 flex items-center justify-center active:bg-gold-500/30 touch-none"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}
