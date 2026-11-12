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
  Dices,
  Disc3,
  GlassWater,
  Music,
  Sparkles,
  Timer,
  UserMinus,
  Users,
  Wine,
  X,
  Zap,
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
  // Top-right Customization Area (wardrobe mirror & trunk)
  { id: 'custom-station', x1: 755, y1: 122, x2: 922, y2: 222 },
  // Bottom-right speakeasy bar counter
  { id: 'bar', x1: 745, y1: 422, x2: 928, y2: 528 },
];

// Interactive Station Spots
const CUSTOM_STATION_SPOT = { x: 835, y: 210 };
const BAR_STATION_SPOT = { x: 770, y: 440 };
const ROULETTE_STATION_SPOT = { x: 210, y: 260 };
const JUKEBOX_STATION_SPOT = { x: 170, y: 460 };

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

const SPEAKEASY_DRINKS = [
  '🥃 Old Fashioned',
  '🍸 Dry Martini',
  '🍷 Syndicate Merlot',
  '🍺 Speakeasy Ale',
] as const;

const JAZZ_TUNES = [
  '🎷 Smooth Jazz',
  '🎺 Noir Trumpet',
  '🎹 Speakeasy Rag',
  '🎵 1940s Swing',
] as const;

const QUICK_EMOTES = [
  { id: 'sus', emoji: '🕵️', label: 'Suspect', key: '1' },
  { id: 'cheers', emoji: '🥃', label: 'Cheers', key: '2' },
  { id: 'dice', emoji: '🎲', label: 'Roll', key: '3' },
  { id: 'shh', emoji: '🤫', label: 'Shh', key: '4' },
  { id: 'wave', emoji: '👋', label: 'Wave', key: '5' },
  { id: 'dance', emoji: '💃', label: 'Dance', key: '6' },
] as const;

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

  // Proximity flags for interactive stations
  const [nearStation, setNearStation] = useState<'custom' | 'bar' | 'roulette' | 'jukebox' | null>(null);

  // Floating emotes and activity tags over players
  const [playerEmotes, setPlayerEmotes] = useState<Record<string, string>>({});
  const drinkIndexRef = useRef(0);
  const tuneIndexRef = useRef(0);

  // Trigger floating emote bubble above any player with automatic decay
  const triggerEmote = useCallback((playerId: string, text: string) => {
    setPlayerEmotes((prev) => ({ ...prev, [playerId]: text }));
    window.setTimeout(() => {
      setPlayerEmotes((prev) => {
        if (prev[playerId] === text) {
          const next = { ...prev };
          delete next[playerId];
          return next;
        }
        return prev;
      });
    }, 3600);
  }, []);

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

  const onOpenCustomizationRef = useRef(onOpenCustomization);
  onOpenCustomizationRef.current = onOpenCustomization;

  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  // Station action handlers
  const handleOrderDrink = useCallback(() => {
    soundEngine.playChipClink();
    const drink = SPEAKEASY_DRINKS[drinkIndexRef.current % SPEAKEASY_DRINKS.length]!;
    drinkIndexRef.current += 1;
    triggerEmote(myPlayerId, drink);
  }, [myPlayerId, triggerEmote]);

  const handleRollDice = useCallback(() => {
    soundEngine.playCardShuffle();
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    const tag =
      sum === 7 || sum === 11
        ? `🎲 ${sum}! Lucky!`
        : sum === 2
          ? '🎲 Snake Eyes!'
          : `🎲 Rolled ${sum}`;
    triggerEmote(myPlayerId, tag);
  }, [myPlayerId, triggerEmote]);

  const handlePlayJukebox = useCallback(() => {
    soundEngine.playHealChime();
    const tune = JAZZ_TUNES[tuneIndexRef.current % JAZZ_TUNES.length]!;
    tuneIndexRef.current += 1;
    triggerEmote(myPlayerId, tune);
  }, [myPlayerId, triggerEmote]);

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

  // Keyboard controls: WASD / Arrows + Hotkeys (E, B, R, J, 1-6)
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

      // Quick Emotes (1-6)
      if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1;
        const em = QUICK_EMOTES[idx];
        if (em) {
          e.preventDefault();
          soundEngine.playUiClick();
          triggerEmote(myPlayerId, `${em.emoji} ${em.label}`);
          return;
        }
      }

      // Station hotkeys
      if (e.code === 'KeyE') {
        const myX = myPosRef.current.x;
        const myY = myPosRef.current.y;
        if (Math.hypot(myX - CUSTOM_STATION_SPOT.x, myY - CUSTOM_STATION_SPOT.y) <= 140) {
          e.preventDefault();
          soundEngine.playUiModalOpen();
          onOpenCustomizationRef.current();
        } else if (Math.hypot(myX - BAR_STATION_SPOT.x, myY - BAR_STATION_SPOT.y) <= 135) {
          e.preventDefault();
          handleOrderDrink();
        } else if (Math.hypot(myX - ROULETTE_STATION_SPOT.x, myY - ROULETTE_STATION_SPOT.y) <= 135) {
          e.preventDefault();
          handleRollDice();
        } else if (Math.hypot(myX - JUKEBOX_STATION_SPOT.x, myY - JUKEBOX_STATION_SPOT.y) <= 135) {
          e.preventDefault();
          handlePlayJukebox();
        }
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        handleOrderDrink();
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        handleRollDice();
        return;
      }
      if (e.code === 'KeyJ') {
        e.preventDefault();
        handlePlayJukebox();
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
  }, [myPlayerId, handleOrderDrink, handleRollDice, handlePlayJukebox, triggerEmote]);

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
          // Stop waypoint if blocked against furniture edge
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

      // Proximity check for 4 interactive stations
      const myX = myPosRef.current.x;
      const myY = myPosRef.current.y;
      if (Math.hypot(myX - CUSTOM_STATION_SPOT.x, myY - CUSTOM_STATION_SPOT.y) <= 135) {
        setNearStation('custom');
      } else if (Math.hypot(myX - BAR_STATION_SPOT.x, myY - BAR_STATION_SPOT.y) <= 125) {
        setNearStation('bar');
      } else if (Math.hypot(myX - ROULETTE_STATION_SPOT.x, myY - ROULETTE_STATION_SPOT.y) <= 125) {
        setNearStation('roulette');
      } else if (Math.hypot(myX - JUKEBOX_STATION_SPOT.x, myY - JUKEBOX_STATION_SPOT.y) <= 120) {
        setNearStation('jukebox');
      } else {
        setNearStation(null);
      }

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

  const walkToStation = useCallback((spot: { x: number; y: number }, onArrival?: () => void) => {
    setWaypoint({ x: spot.x, y: spot.y });
    if (onArrival) {
      window.setTimeout(onArrival, 200);
    }
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
      {/* Lounge Header Strip with Quick Station Nav */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-display uppercase tracking-wider text-gold-200 font-bold">
            <Users className="w-3.5 h-3.5 text-gold-400" />
            Lounge ({playingPlayers.length}/16)
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
            readyCount === playingPlayers.length && playingPlayers.length > 0
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
              : 'bg-noir-900 border-gold-500/30 text-cream-300'
          }`}>
            {readyCount}/{playingPlayers.length} Ready
          </span>
          {!validationValid && validationError && (
            <span className="text-amber-300/90 text-[11px]">• {validationError}</span>
          )}
        </div>

        {/* Quick Station Navigation Buttons */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-cream-400">
          <span className="text-cream-400/70 mr-0.5">Quick Walk:</span>
          <button
            type="button"
            data-sfx="tab"
            onClick={() => walkToStation(BAR_STATION_SPOT, handleOrderDrink)}
            className="px-2 py-0.5 rounded border border-amber-500/30 bg-noir-900/80 hover:bg-amber-500/20 text-amber-200 transition cursor-pointer"
          >
            🍸 Bar
          </button>
          <button
            type="button"
            data-sfx="tab"
            onClick={() => walkToStation(ROULETTE_STATION_SPOT, handleRollDice)}
            className="px-2 py-0.5 rounded border border-emerald-500/30 bg-noir-900/80 hover:bg-emerald-500/20 text-emerald-200 transition cursor-pointer"
          >
            🎲 Roulette
          </button>
          <button
            type="button"
            data-sfx="tab"
            onClick={() => walkToStation(JUKEBOX_STATION_SPOT, handlePlayJukebox)}
            className="px-2 py-0.5 rounded border border-sky-500/30 bg-noir-900/80 hover:bg-sky-500/20 text-sky-200 transition cursor-pointer"
          >
            🎷 Jukebox
          </button>
          <button
            type="button"
            data-sfx="tab"
            onClick={() => walkToStation(CUSTOM_STATION_SPOT, onOpenCustomization)}
            className="px-2 py-0.5 rounded border border-gold-500/40 bg-noir-900/80 hover:bg-gold-500/25 text-gold-200 transition cursor-pointer"
          >
            ✨ Studio
          </button>
        </div>
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
            <radialGradient id="stationGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(245, 206, 110, 0.38)" />
              <stop offset="100%" stopColor="rgba(212, 168, 79, 0)" />
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

          {/* Left Velvet Booth & Roulette Table */}
          <g transform="translate(88, 188)">
            <ellipse cx="98" cy="61" rx="65" ry="48" fill="url(#stationGlow)" opacity={nearStation === 'roulette' ? '0.9' : '0.4'} />
            <rect x="0" y="0" width="46" height="122" rx="12" fill="#4f1620" stroke="#22090e" strokeWidth="2.5" />
            <rect x="10" y="10" width="28" height="102" rx="8" fill="#6b1f2d" />
            <circle cx="98" cy="61" r="40" fill="#2a140b" stroke="#b98e39" strokeWidth="2.5" />
            <circle cx="98" cy="61" r="32" fill="#0b3d2b" stroke="#10b981" strokeWidth="1.5" />
            {/* Roulette spokes & wheel */}
            <circle cx="98" cy="61" r="16" fill="#1f1008" stroke="#d4af37" strokeWidth="1.5" />
            <line x1="98" y1="29" x2="98" y2="93" stroke="#d4af37" strokeWidth="1.2" opacity="0.6" />
            <line x1="66" y1="61" x2="130" y2="61" stroke="#d4af37" strokeWidth="1.2" opacity="0.6" />
            <circle cx="98" cy="61" r="6" fill="#f59e0b" />
            <circle cx="92" cy="54" r="2.5" fill="#ffffff" />
          </g>

          {/* Bottom-Left Jazz Gramophone & Jukebox Crates */}
          <g transform="translate(94, 434)">
            <ellipse cx="50" cy="40" rx="60" ry="40" fill="url(#stationGlow)" opacity={nearStation === 'jukebox' ? '0.9' : '0.4'} />
            <rect x="0" y="14" width="56" height="56" rx="5" fill="#442919" stroke="#22130b" strokeWidth="2.5" />
            <line x1="0" y1="14" x2="56" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <line x1="56" y1="14" x2="0" y2="70" stroke="#2e1a0f" strokeWidth="2" />
            <rect x="64" y="28" width="46" height="44" rx="5" fill="#52321e" stroke="#22130b" strokeWidth="2.5" />
            {/* Gramophone vinyl & brass horn */}
            <ellipse cx="87" cy="24" rx="15" ry="9" fill="#171717" stroke="#b45309" strokeWidth="1.5" />
            <path d="M87 24 Q95 8 114 4" stroke="#d4af37" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="116" cy="4" rx="8" ry="12" fill="#d97706" stroke="#fbbf24" strokeWidth="1.2" transform="rotate(20 116 4)" />
          </g>

          {/* Bottom-Right Speakeasy Bar Counter */}
          <g transform="translate(752, 424)">
            <ellipse cx="85" cy="45" rx="100" ry="55" fill="url(#stationGlow)" opacity={nearStation === 'bar' ? '0.9' : '0.4'} />
            <rect x="0" y="10" width="170" height="88" rx="10" fill="#28150d" stroke="#b98e39" strokeWidth="2.5" />
            <rect x="10" y="18" width="150" height="22" rx="5" fill="#422214" />
            {/* Amber bottles / cocktail glasses */}
            <circle cx="34" cy="29" r="6" fill="#d97706" />
            <circle cx="52" cy="29" r="5" fill="#b91c1c" />
            <circle cx="70" cy="29" r="6" fill="#f59e0b" />
            <circle cx="120" cy="29" r="6" fill="#e5e7eb" opacity="0.8" />
            <circle cx="138" cy="29" r="5" fill="#10b981" opacity="0.85" />
            <text
              x="85"
              y="76"
              textAnchor="middle"
              fill="#fef08a"
              opacity="0.9"
              fontSize="10"
              fontWeight="800"
              letterSpacing="2.5"
            >
              SPEAKEASY BAR
            </text>
          </g>

          {/* Top-Right CUSTOMIZATION AREA (Wardrobe / Vanity Booth) */}
          <g>
            <ellipse cx="838" cy="184" rx="110" ry="76" fill="url(#stationGlow)" opacity={nearStation === 'custom' ? '0.9' : '0.4'} />
            <rect
              x="732"
              y="124"
              width="210"
              height="128"
              rx="18"
              fill="rgba(18, 22, 36, 0.6)"
              stroke={nearStation === 'custom' ? '#fde68a' : '#d4a84f'}
              strokeWidth={nearStation === 'custom' ? '2.5' : '1.5'}
              strokeDasharray="6 4"
            />
            {/* Wardrobe console */}
            <rect
              x="764"
              y="122"
              width="148"
              height="74"
              rx="10"
              fill="#341b10"
              stroke={nearStation === 'custom' ? '#fef08a' : '#d4a84f'}
              strokeWidth="2.5"
            />
            <rect x="780" y="132" width="54" height="44" rx="5" fill="#172033" stroke="#e8c67a" strokeWidth="1.8" />
            <rect x="788" y="138" width="16" height="20" rx="1.5" fill="#ebe6dc" transform="rotate(-8 796 148)" />
            <rect x="808" y="140" width="16" height="20" rx="1.5" fill="#dac49d" transform="rotate(7 816 150)" />
            <rect x="846" y="134" width="52" height="40" rx="5" fill="#20110a" stroke="#b98e39" strokeWidth="1.5" />
            <circle cx="872" cy="154" r="11" fill="#148653" stroke="#a7f3d0" strokeWidth="1.5" />
            <path d="M867 154 H877 M872 149 V159" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </g>

          {/* Ambient Lighting Overlay */}
          <rect x="0" y="0" width="1000" height="600" fill="url(#centerSpot)" />
        </svg>

        {/* 4 Interactive Station Overlays */}

        {/* 1. Customization Studio Station */}
        <button
          type="button"
          data-sfx="none"
          onClick={(e) => {
            e.stopPropagation();
            soundEngine.playUiModalOpen();
            onOpenCustomization();
          }}
          style={{ left: '83.5%', top: '28%' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
            nearStation === 'custom'
              ? 'bg-gold-500 text-noir-950 border-cream-50 shadow-[0_0_24px_rgba(245,208,116,0.8)] scale-105'
              : 'bg-noir-950/85 hover:bg-noir-900 text-gold-200 border-gold-400/50 shadow-lg'
          }`}
        >
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-gold-300" />
            <span>Polaroid Studio</span>
          </span>
          <span className={`text-[9px] font-mono whitespace-nowrap ${nearStation === 'custom' ? 'text-noir-950 font-bold' : 'text-cream-400'}`}>
            {nearStation === 'custom' ? 'Press E or Click • Style Avatar' : 'Avatar Vanity'}
          </span>
        </button>

        {/* 2. Speakeasy Bar Station */}
        <button
          type="button"
          data-sfx="none"
          onClick={(e) => {
            e.stopPropagation();
            handleOrderDrink();
          }}
          style={{ left: '83.5%', top: '78%' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
            nearStation === 'bar'
              ? 'bg-amber-500 text-noir-950 border-cream-50 shadow-[0_0_24px_rgba(245,158,11,0.8)] scale-105'
              : 'bg-noir-950/85 hover:bg-noir-900 text-amber-200 border-amber-500/40 shadow-lg'
          }`}
        >
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap">
            <Wine className="w-3 h-3 text-amber-300" />
            <span>Speakeasy Bar</span>
          </span>
          <span className={`text-[9px] font-mono whitespace-nowrap ${nearStation === 'bar' ? 'text-noir-950 font-bold' : 'text-cream-400'}`}>
            {nearStation === 'bar' ? 'Press E or Click • Pour Drink' : 'Order Bourbon & Gin'}
          </span>
        </button>

        {/* 3. Lucky Roulette & Dice Station */}
        <button
          type="button"
          data-sfx="none"
          onClick={(e) => {
            e.stopPropagation();
            handleRollDice();
          }}
          style={{ left: '18.5%', top: '42%' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
            nearStation === 'roulette'
              ? 'bg-emerald-500 text-noir-950 border-cream-50 shadow-[0_0_24px_rgba(16,185,129,0.8)] scale-105'
              : 'bg-noir-950/85 hover:bg-noir-900 text-emerald-200 border-emerald-500/40 shadow-lg'
          }`}
        >
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap">
            <Dices className="w-3 h-3 text-emerald-300" />
            <span>Lucky Roulette</span>
          </span>
          <span className={`text-[9px] font-mono whitespace-nowrap ${nearStation === 'roulette' ? 'text-noir-950 font-bold' : 'text-cream-400'}`}>
            {nearStation === 'roulette' ? 'Press E/R • Roll Dice' : 'Test Your Luck'}
          </span>
        </button>

        {/* 4. Jukebox Gramophone Station */}
        <button
          type="button"
          data-sfx="none"
          onClick={(e) => {
            e.stopPropagation();
            handlePlayJukebox();
          }}
          style={{ left: '16.5%', top: '82%' }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl border transition cursor-pointer ${
            nearStation === 'jukebox'
              ? 'bg-sky-500 text-noir-950 border-cream-50 shadow-[0_0_24px_rgba(14,165,233,0.8)] scale-105'
              : 'bg-noir-950/85 hover:bg-noir-900 text-sky-200 border-sky-500/40 shadow-lg'
          }`}
        >
          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap">
            <Music className="w-3 h-3 text-sky-300" />
            <span>Jukebox</span>
          </span>
          <span className={`text-[9px] font-mono whitespace-nowrap ${nearStation === 'jukebox' ? 'text-noir-950 font-bold' : 'text-cream-400'}`}>
            {nearStation === 'jukebox' ? 'Press E/J • Play Jazz' : 'Vinyl Music'}
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
                activeEmote={playerEmotes[p.id] ?? null}
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

      {/* Gamified Speakeasy Emote Bar & Mobile Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-noir-950/85 border border-gold-500/25 p-2 sm:px-3 sm:py-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-gold-300 font-bold mr-1">
            Reactions:
          </span>
          {QUICK_EMOTES.map((em) => (
            <button
              key={em.id}
              type="button"
              data-sfx="click"
              title={`${em.label} (Press ${em.key})`}
              onClick={() => {
                soundEngine.playUiClick();
                triggerEmote(myPlayerId, `${em.emoji} ${em.label}`);
              }}
              className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border border-gold-500/25 bg-noir-900 hover:bg-gold-500/20 text-xs sm:text-sm transition cursor-pointer inline-flex items-center gap-1 group"
            >
              <span>{em.emoji}</span>
              <span className="hidden md:inline text-[11px] font-mono text-cream-200 group-hover:text-gold-200">
                {em.label}
              </span>
            </button>
          ))}
        </div>

        {/* Mobile quick action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-sfx="none"
            onClick={() => {
              soundEngine.playUiModalOpen();
              onOpenCustomization();
            }}
            className="sm:hidden px-2.5 py-1 rounded-lg border border-gold-400/50 bg-gold-500/20 text-gold-200 text-xs font-display uppercase tracking-wider font-bold"
          >
            Avatar Studio
          </button>
        </div>
      </div>

      {/* Unobstructed Phone Touch Pad (<640px) */}
      <div className="sm:hidden flex items-center justify-between gap-3 rounded-xl bg-noir-900/80 border border-gold-500/25 px-3 py-2">
        {renderTouchPadGrid(true)}
        <div className="flex-1 min-w-0 space-y-1 text-right text-[11px] text-cream-300/85">
          <p>Tap anywhere to walk or tap Bar, Roulette &amp; Jukebox to interact!</p>
        </div>
      </div>
    </div>
  );
}
