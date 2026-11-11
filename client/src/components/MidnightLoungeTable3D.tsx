import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ClientPlayerView } from '@midnight-city/shared';
import {
  Camera,
  Eye,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import { PlayerTradingCard } from './PlayerTradingCard';

interface SeatVisualHandle {
  leatherMat: THREE.MeshStandardMaterial;
  pipingMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  spotBeamMat: THREE.MeshBasicMaterial;
  cardPropMat: THREE.MeshStandardMaterial;
  baseY: number;
  position: THREE.Vector3;
  seatPos: THREE.Vector3;
  angle: number;
}

export interface MidnightLoungeTable3DProps {
  players: ClientPlayerView[];
  myPlayerId: string;
  mode: 'LOBBY' | 'DAY_DISCUSSION' | 'DAY_VOTE' | 'VOTE_RESULT';
  viewerIsHost: boolean;
  speakingPeerIds: Set<string>;
  accuseCounts: Map<string, number>;
  myAccuseTargetId: string | null;
  selectedVoteTarget: string | null;
  canAccuse: boolean;
  canVoteCandidate: (playerId: string) => boolean;
  onToggleAccuse?: (playerId: string) => void;
  onSelectVote?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;
  onKickPlayer?: (playerId: string) => void;
  centerTitle: string;
  centerSubtitle: string;
  fillViewport?: boolean;
  overlayTopLeft?: React.ReactNode;
  overlayTopRight?: React.ReactNode;
  overlayBottom?: React.ReactNode;
}

type CameraPreset = 'lounge' | 'overhead' | 'my-seat';

function createMahoganyTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 512;
  colorCanvas.height = 512;
  const ctx = colorCanvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#3d1f12');
  grad.addColorStop(0.5, '#4d2717');
  grad.addColorStop(1, '#2f160c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 240; i += 1) {
    const y = (i / 240) * 512;
    const dark = i % 3 === 0;
    ctx.strokeStyle = dark ? 'rgba(18, 7, 3, 0.42)' : 'rgba(116, 66, 38, 0.24)';
    ctx.lineWidth = 0.8 + (i % 4) * 0.65;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      160,
      y + Math.sin(i * 0.7) * 9,
      350,
      y - Math.cos(i * 0.6) * 9,
      512,
      y + Math.sin(i) * 3
    );
    ctx.stroke();

    bctx.strokeStyle = dark ? '#5c5c5c' : '#9c9c9c';
    bctx.lineWidth = 1 + (i % 3) * 0.5;
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.bezierCurveTo(160, y + Math.sin(i * 0.7) * 9, 350, y - Math.cos(i * 0.6) * 9, 512, y);
    bctx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function createCasinoFeltTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const rad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.5);
  rad.addColorStop(0, '#14533c');
  rad.addColorStop(0.58, '#0d3d2b');
  rad.addColorStop(0.88, '#08291d');
  rad.addColorStop(1, '#051a12');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  // Subtle wool baize fiber speckle
  for (let i = 0; i < 16000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255, 255, 255, 0.028)' : 'rgba(0, 0, 0, 0.065)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Gold Art Deco Casino Betting Ring & Compass Emblem
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 184, 96, 0.62)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 355, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(226, 184, 96, 0.32)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, 336, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(226, 184, 96, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 175, 0, Math.PI * 2);
  ctx.stroke();

  // 16 Art Deco radial rays
  for (let r = 0; r < 16; r += 1) {
    const a = (r / 16) * Math.PI * 2;
    ctx.strokeStyle =
      r % 2 === 0 ? 'rgba(226, 184, 96, 0.34)' : 'rgba(226, 184, 96, 0.14)';
    ctx.lineWidth = r % 2 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 180, cy + Math.sin(a) * 180);
    ctx.lineTo(cx + Math.cos(a) * 330, cy + Math.sin(a) * 330);
    ctx.stroke();
  }

  // Inner diamond star
  ctx.strokeStyle = 'rgba(245, 223, 176, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let p = 0; p < 8; p += 1) {
    const a = (p / 8) * Math.PI * 2;
    const radLen = p % 2 === 0 ? 138 : 66;
    const px = cx + Math.cos(a) * radLen;
    const py = cy + Math.sin(a) * radLen;
    if (p === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i += 1) {
    bctx.fillStyle = i % 2 === 0 ? '#969696' : '#6a6a6a';
    bctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 6);

  return { map, bumpMap };
}

function createParquetRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const cx = 512;
  const cy = 512;

  const bg = ctx.createRadialGradient(cx, cy, 80, cx, cy, 512);
  bg.addColorStop(0, '#3b151b');
  bg.addColorStop(0.65, '#250d12');
  bg.addColorStop(0.92, '#16080b');
  bg.addColorStop(1, '#0d0507');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  // Persian/Art-Deco concentric borders
  const rings = [
    { r: 486, w: 14, c: 'rgba(212, 168, 79, 0.55)' },
    { r: 462, w: 4, c: 'rgba(245, 223, 176, 0.35)' },
    { r: 432, w: 18, c: 'rgba(18, 34, 48, 0.72)' },
    { r: 412, w: 3, c: 'rgba(212, 168, 79, 0.45)' },
    { r: 280, w: 3, c: 'rgba(212, 168, 79, 0.28)' },
  ];
  for (const ring of rings) {
    ctx.strokeStyle = ring.c;
    ctx.lineWidth = ring.w;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 36; i += 1) {
    const a = (i / 36) * Math.PI * 2;
    ctx.fillStyle = 'rgba(212, 168, 79, 0.42)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 432, cy + Math.sin(a) * 432, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPlayingCardBackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4ede0';
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#5e141d';
  ctx.fillRect(7, 7, 114, 178);
  ctx.strokeStyle = '#d4a84f';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 104, 168);
  ctx.beginPath();
  ctx.moveTo(64, 34);
  ctx.lineTo(98, 96);
  ctx.lineTo(64, 158);
  ctx.lineTo(30, 96);
  ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function MidnightLoungeTable3D({
  players,
  myPlayerId,
  mode,
  viewerIsHost,
  speakingPeerIds,
  accuseCounts,
  myAccuseTargetId,
  selectedVoteTarget,
  canAccuse,
  canVoteCandidate,
  onToggleAccuse,
  onSelectVote,
  onTransferHost,
  onKickPlayer,
  centerTitle,
  centerSubtitle,
  fillViewport = false,
  overlayTopLeft,
  overlayTopRight,
  overlayBottom,
}: MidnightLoungeTable3DProps) {
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const seatHandlesRef = useRef<Map<string, SeatVisualHandle>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hoveredKeyRef = useRef<string | null>(null);
  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 5.4, 8.8),
    target: new THREE.Vector3(0, 0.9, 0),
    active: false,
  });

  const [compactFallback, setCompactFallback] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>('lounge');

  const seatSlots = useMemo(() => {
    const minSeats = mode === 'LOBBY' ? Math.max(6, players.length) : Math.max(1, players.length);
    return Array.from({ length: minSeats }, (_, idx) => ({
      key: players[idx]?.id ?? `empty-${idx}`,
      seatNumber: idx + 1,
      player: players[idx] ?? null,
    }));
  }, [players, mode]);

  const seatKeysSignature = seatSlots.map((s) => s.key).join('|');
  const seatSlotsRef = useRef(seatSlots);
  seatSlotsRef.current = seatSlots;

  const liveVisualsRef = useRef({
    speakingPeerIds,
    selectedVoteTarget,
    mode,
    accuseCounts,
  });
  liveVisualsRef.current = {
    speakingPeerIds,
    selectedVoteTarget,
    mode,
    accuseCounts,
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = stageWrapperRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  }, []);

  const applyCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setActivePreset(preset);
      if (preset === 'overhead') {
        cameraGoalRef.current = {
          pos: new THREE.Vector3(0, 10.6, 0.85),
          target: new THREE.Vector3(0, 0.75, 0),
          active: true,
        };
        return;
      }
      if (preset === 'my-seat') {
        const myHandle = seatHandlesRef.current.get(myPlayerId);
        if (myHandle) {
          const outward = myHandle.seatPos.clone().normalize();
          cameraGoalRef.current = {
            pos: new THREE.Vector3(
              outward.x * 6.4,
              3.25,
              outward.z * 6.4
            ),
            target: new THREE.Vector3(0, 1.02, 0),
            active: true,
          };
          return;
        }
      }
      cameraGoalRef.current = {
        pos: new THREE.Vector3(0, 5.25, 8.75),
        target: new THREE.Vector3(0, 0.92, 0),
        active: true,
      };
    },
    [myPlayerId]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || compactFallback) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 1024;
    const height = container.clientHeight || 680;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06080f');
    scene.fog = new THREE.FogExp2('#06080f', 0.036);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 70);
    camera.position.set(0, 5.25, 8.75);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.target.set(0, 0.92, 0);
    controls.minDistance = 4.2;
    controls.maxDistance = 12.8;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.enablePan = false;
    const cancelPresetGlide = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', cancelPresetGlide);
    controlsRef.current = controls;

    // Cinematic Speakeasy Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#ffdcb0', '#131b30', 0.55);
    scene.add(hemiLight);

    const tableSpot = new THREE.SpotLight('#ffca80', 48, 20, Math.PI * 0.36, 0.62, 1.35);
    tableSpot.position.set(0, 5.1, 0);
    tableSpot.target.position.set(0, 0.6, 0);
    tableSpot.castShadow = true;
    tableSpot.shadow.mapSize.set(2048, 2048);
    tableSpot.shadow.bias = -0.0003;
    scene.add(tableSpot);
    scene.add(tableSpot.target);

    const chandelierFill = new THREE.PointLight('#ffb764', 11, 16, 1.6);
    chandelierFill.position.set(0, 4.15, 0);
    scene.add(chandelierFill);

    const centerCandleLight = new THREE.PointLight('#ff9238', 5.2, 6.2, 1.7);
    centerCandleLight.position.set(0, 1.24, 0);
    scene.add(centerCandleLight);

    const coolMoonRim = new THREE.DirectionalLight('#6c8fd6', 0.95);
    coolMoonRim.position.set(-6.5, 4.8, -6.5);
    scene.add(coolMoonRim);

    const warmBackRim = new THREE.DirectionalLight('#c97a3d', 0.55);
    warmBackRim.position.set(6, 3.6, 5);
    scene.add(warmBackRim);

    // Procedural Textures
    const { map: mahoganyMap, bumpMap: mahoganyBump } = createMahoganyTextures();
    const { map: feltMap, bumpMap: feltBump } = createCasinoFeltTextures();
    const rugTex = createParquetRugTexture();
    const cardBackTex = createPlayingCardBackTexture();

    const floorWoodMap = mahoganyMap.clone();
    floorWoodMap.repeat.set(5, 5);
    floorWoodMap.needsUpdate = true;
    const floorWoodBump = mahoganyBump.clone();
    floorWoodBump.repeat.set(5, 5);
    floorWoodBump.needsUpdate = true;

    // Speakeasy Hardwood Floor
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorWoodMap,
      bumpMap: floorWoodBump,
      bumpScale: 0.015,
      color: '#5a3825',
      roughness: 0.56,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ornate Circular Lounge Carpet + Brass Binding Ring
    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      bumpMap: feltBump,
      bumpScale: 0.012,
      roughness: 0.88,
      metalness: 0.04,
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(4.95, 5.0, 0.035, 96), rugMat);
    rug.position.y = 0.018;
    rug.receiveShadow = true;
    scene.add(rug);

    const brassMat = new THREE.MeshStandardMaterial({
      color: '#dfb25b',
      metalness: 0.84,
      roughness: 0.22,
    });
    const darkBronzeMat = new THREE.MeshStandardMaterial({
      color: '#5a4320',
      metalness: 0.72,
      roughness: 0.36,
    });
    const mahoganyMat = new THREE.MeshStandardMaterial({
      map: mahoganyMap,
      bumpMap: mahoganyBump,
      bumpScale: 0.012,
      color: '#7c4328',
      roughness: 0.28,
      metalness: 0.1,
    });
    const darkLeatherMat = new THREE.MeshStandardMaterial({
      bumpMap: feltBump,
      bumpScale: 0.008,
      color: '#201312',
      roughness: 0.42,
      metalness: 0.08,
    });

    const rugBrassTrim = new THREE.Mesh(
      new THREE.TorusGeometry(4.97, 0.022, 12, 96),
      darkBronzeMat
    );
    rugBrassTrim.rotation.x = Math.PI / 2;
    rugBrassTrim.position.y = 0.03;
    scene.add(rugBrassTrim);

    // Octagonal Noir Speakeasy Architecture
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#111726',
      roughness: 0.86,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      map: mahoganyMap,
      color: '#4c2c1b',
      roughness: 0.65,
    });

    const roomRadius = 11.2;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const wallGroup = new THREE.Group();
      wallGroup.position.set(Math.sin(angle) * roomRadius, 0, Math.cos(angle) * roomRadius);
      wallGroup.rotation.y = angle + Math.PI;

      const upperWall = new THREE.Mesh(new THREE.BoxGeometry(9.6, 6.2, 0.28), wallMat);
      upperWall.position.y = 3.1;
      wallGroup.add(upperWall);

      const lowerWood = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.65, 0.36), wainscotMat);
      lowerWood.position.y = 0.825;
      wallGroup.add(lowerWood);

      const chairRail = new THREE.Mesh(new THREE.BoxGeometry(9.65, 0.08, 0.42), brassMat);
      chairRail.position.y = 1.66;
      wallGroup.add(chairRail);

      // Pilaster columns
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.45, 6.2, 0.48), wainscotMat);
      pilaster.position.set(4.55, 3.1, 0.06);
      wallGroup.add(pilaster);

      // Warm Art Deco Wall Sconces
      if (i % 2 === 0) {
        const sconceBack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.56, 0.08), brassMat);
        sconceBack.position.set(0, 3.05, 0.18);
        wallGroup.add(sconceBack);

        const sconceShade = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.1, 0.34, 16),
          new THREE.MeshStandardMaterial({
            color: '#ffdf9e',
            emissive: '#ff9d3b',
            emissiveIntensity: 1.8,
            roughness: 0.3,
          })
        );
        sconceShade.position.set(0, 3.16, 0.28);
        wallGroup.add(sconceShade);
      }

      // Backlit Liquor & Dossier Credenza on back walls
      if (i === 3 || i === 4 || i === 5) {
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 0.6), wainscotMat);
        cabinet.position.set(0, 1.4, 0.46);
        wallGroup.add(cabinet);

        for (let b = -1.2; b <= 1.2; b += 0.4) {
          const bottle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.08, 0.38, 12),
            new THREE.MeshPhysicalMaterial({
              color: b < 0 ? '#9c2430' : '#c98a2c',
              roughness: 0.15,
              transmission: 0.45,
              thickness: 0.2,
            })
          );
          bottle.position.set(b, 2.05, 0.54);
          wallGroup.add(bottle);
        }
      }

      scene.add(wallGroup);
    }

    // Coffered Ceiling & Brass Chandelier + Volumetric Light Cone
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshStandardMaterial({ color: '#18100c', roughness: 0.92 })
    );
    ceiling.position.y = 6.2;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    const chandelierGroup = new THREE.Group();
    chandelierGroup.position.set(0, 4.75, 0);

    const downRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 16), brassMat);
    downRod.position.y = 0.72;
    chandelierGroup.add(downRod);

    const mainShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.42, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#123d2b',
        roughness: 0.32,
        metalness: 0.25,
        side: THREE.DoubleSide,
      })
    );
    mainShade.position.y = 0.06;
    chandelierGroup.add(mainShade);

    const shadeBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.03, 14, 48),
      brassMat
    );
    shadeBrassRim.rotation.x = Math.PI / 2;
    shadeBrassRim.position.y = -0.15;
    chandelierGroup.add(shadeBrassRim);

    const innerBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 20),
      new THREE.MeshStandardMaterial({
        color: '#fff5d6',
        emissive: '#ffbe5c',
        emissiveIntensity: 2.8,
      })
    );
    innerBulb.position.y = -0.04;
    chandelierGroup.add(innerBulb);

    // Subtle volumetric light haze cone over the round table
    const lightConeGeo = new THREE.ConeGeometry(2.85, 4.1, 48, 1, true);
    const lightConeMat = new THREE.MeshBasicMaterial({
      color: '#ffcf86',
      transparent: true,
      opacity: 0.042,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lightCone = new THREE.Mesh(lightConeGeo, lightConeMat);
    lightCone.position.set(0, 2.62, 0);
    scene.add(lightCone);

    scene.add(chandelierGroup);

    // =========================================================
    // REALISTIC CASINO / SPEAKEASY ROUND TABLE
    // =========================================================
    const currentSlots = seatSlotsRef.current;
    const total = currentSlots.length;
    const tableRadius = total > 11 ? 2.38 : total > 8 ? 2.18 : 2.02;
    const tableHeight = 0.76;

    const tableGroup = new THREE.Group();

    // 1. Heavy Carved Mahogany Base Plinth & Claw Feet
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.86, 1.02, 0.1, 48),
      mahoganyMat
    );
    basePlinth.position.y = 0.05;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    tableGroup.add(basePlinth);

    const baseBrassRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.022, 12, 48),
      brassMat
    );
    baseBrassRing.rotation.x = Math.PI / 2;
    baseBrassRing.position.y = 0.1;
    tableGroup.add(baseBrassRing);

    const centerPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.48, 0.62, 36),
      mahoganyMat
    );
    centerPedestal.position.y = 0.38;
    centerPedestal.castShadow = true;
    tableGroup.add(centerPedestal);

    const pedestalCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.03, 14, 36),
      brassMat
    );
    pedestalCollar.rotation.x = Math.PI / 2;
    pedestalCollar.position.y = 0.52;
    tableGroup.add(pedestalCollar);

    for (let legIdx = 0; legIdx < 4; legIdx += 1) {
      const la = (legIdx / 4) * Math.PI * 2 + Math.PI / 4;
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.95), mahoganyMat);
      buttress.position.set(Math.cos(la) * 0.68, 0.16, Math.sin(la) * 0.68);
      buttress.rotation.y = -la + Math.PI / 2;
      buttress.rotation.x = 0.18;
      buttress.castShadow = true;
      tableGroup.add(buttress);

      const brassPaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.22), brassMat);
      brassPaw.position.set(Math.cos(la) * 1.12, 0.045, Math.sin(la) * 1.12);
      brassPaw.rotation.y = -la + Math.PI / 2;
      tableGroup.add(brassPaw);
    }

    // 2. Mahogany Apron Skirt & Sub-Table Deck
    const tableApron = new THREE.Mesh(
      new THREE.CylinderGeometry(tableRadius - 0.05, tableRadius - 0.14, 0.14, 72),
      mahoganyMat
    );
    tableApron.position.y = tableHeight - 0.09;
    tableApron.castShadow = true;
    tableApron.receiveShadow = true;
    tableGroup.add(tableApron);

    // 3. Recessed Emerald Wool Baize Playing Surface
    const feltMat = new THREE.MeshStandardMaterial({
      map: feltMap,
      bumpMap: feltBump,
      bumpScale: 0.016,
      roughness: 0.88,
      metalness: 0.02,
    });
    const feltSurface = new THREE.Mesh(
      new THREE.CylinderGeometry(tableRadius - 0.16, tableRadius - 0.16, 0.03, 96),
      feltMat
    );
    feltSurface.position.y = tableHeight;
    feltSurface.receiveShadow = true;
    tableGroup.add(feltSurface);

    // 4. Mahogany Racetrack Wood Inlay Ring + Brass Inner Trim
    const racetrackRing = new THREE.Mesh(
      new THREE.RingGeometry(tableRadius - 0.34, tableRadius - 0.15, 96),
      mahoganyMat
    );
    racetrackRing.rotation.x = -Math.PI / 2;
    racetrackRing.position.y = tableHeight + 0.016;
    racetrackRing.receiveShadow = true;
    tableGroup.add(racetrackRing);

    const innerBrassInlay = new THREE.Mesh(
      new THREE.TorusGeometry(tableRadius - 0.34, 0.01, 10, 96),
      brassMat
    );
    innerBrassInlay.rotation.x = Math.PI / 2;
    innerBrassInlay.position.y = tableHeight + 0.018;
    tableGroup.add(innerBrassInlay);

    // 5. Padded Tufted Oxblood/Espresso Leather Armrest Bolster Rail
    const paddedRail = new THREE.Mesh(
      new THREE.TorusGeometry(tableRadius - 0.04, 0.135, 28, 96),
      darkLeatherMat
    );
    paddedRail.rotation.x = Math.PI / 2;
    paddedRail.scale.set(1, 1, 0.68);
    paddedRail.position.y = tableHeight + 0.045;
    paddedRail.castShadow = true;
    paddedRail.receiveShadow = true;
    tableGroup.add(paddedRail);

    // Outer Brass Nailhead Studs around the table bolster
    const studGeo = new THREE.SphereGeometry(0.016, 10, 10);
    const studCount = 36;
    for (let s = 0; s < studCount; s += 1) {
      const sa = (s / studCount) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, brassMat);
      stud.position.set(
        Math.cos(sa) * (tableRadius + 0.082),
        tableHeight + 0.035,
        Math.sin(sa) * (tableRadius + 0.082)
      );
      tableGroup.add(stud);
    }

    // 6. Centerpiece: Brass Hurricane Oil Lamp, Revolver Silhouette / Gavel Block, Dossier Deck & Chip Stacks
    const centerTray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.45, 0.024, 48),
      mahoganyMat
    );
    centerTray.position.y = tableHeight + 0.026;
    centerTray.castShadow = true;
    centerTray.receiveShadow = true;
    tableGroup.add(centerTray);

    const centerTrayTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.435, 0.012, 10, 48),
      brassMat
    );
    centerTrayTrim.rotation.x = Math.PI / 2;
    centerTrayTrim.position.y = tableHeight + 0.036;
    tableGroup.add(centerTrayTrim);

    const lampPedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.09, 28),
      brassMat
    );
    lampPedestal.position.y = tableHeight + 0.08;
    lampPedestal.castShadow = true;
    tableGroup.add(lampPedestal);

    const candleWax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.18, 20),
      new THREE.MeshStandardMaterial({ color: '#f2ead9', roughness: 0.42 })
    );
    candleWax.position.y = tableHeight + 0.2;
    tableGroup.add(candleWax);

    const glassHurricane = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.34, 28, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: '#fff6e5',
        transparent: true,
        opacity: 0.24,
        roughness: 0.08,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    glassHurricane.position.y = tableHeight + 0.28;
    tableGroup.add(glassHurricane);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 14, 14),
      new THREE.MeshStandardMaterial({
        color: '#ffebb3',
        emissive: '#ff8c1a',
        emissiveIntensity: 3.6,
      })
    );
    flame.scale.set(0.7, 1.55, 0.7);
    flame.position.y = tableHeight + 0.33;
    tableGroup.add(flame);

    // Center Dealing Shoe / Card Deck Stack
    const cardDeckMat = new THREE.MeshStandardMaterial({
      map: cardBackTex,
      roughness: 0.35,
      metalness: 0.08,
    });
    for (let c = 0; c < 7; c += 1) {
      const deckCard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.29), cardDeckMat);
      deckCard.position.set(0.24 + c * 0.004, tableHeight + 0.044 + c * 0.0085, 0.12);
      deckCard.rotation.y = 0.28 + c * 0.03;
      deckCard.castShadow = true;
      tableGroup.add(deckCard);
    }

    // Center Poker / Syndicate Pot Chips
    const chipPalette = ['#b91c1c', '#d4a84f', '#1e293b', '#0f766e'];
    chipPalette.forEach((hex, stackIdx) => {
      const chipMat = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.32,
        metalness: 0.2,
      });
      const count = 4 + (stackIdx % 3) * 2;
      const angle = 2.4 + stackIdx * 0.55;
      const rx = Math.cos(angle) * 0.27;
      const rz = Math.sin(angle) * 0.27;
      for (let k = 0; k < count; k += 1) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 20), chipMat);
        chip.position.set(
          rx + (k % 2) * 0.003,
          tableHeight + 0.045 + k * 0.0145,
          rz
        );
        chip.castShadow = true;
        tableGroup.add(chip);
      }
    });

    // Judge's Gavel on Sounding Block near center
    const soundingBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.095, 0.03, 24),
      mahoganyMat
    );
    soundingBlock.position.set(-0.24, tableHeight + 0.052, -0.16);
    soundingBlock.castShadow = true;
    tableGroup.add(soundingBlock);

    const gavelHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.13, 18),
      mahoganyMat
    );
    gavelHead.rotation.z = Math.PI / 2;
    gavelHead.rotation.y = 0.45;
    gavelHead.position.set(-0.23, tableHeight + 0.088, -0.15);
    gavelHead.castShadow = true;
    tableGroup.add(gavelHead);

    const gavelHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.22, 12),
      mahoganyMat
    );
    gavelHandle.rotation.x = Math.PI / 2;
    gavelHandle.rotation.z = -0.45;
    gavelHandle.position.set(-0.16, tableHeight + 0.075, -0.06);
    tableGroup.add(gavelHandle);

    scene.add(tableGroup);

    // =========================================================
    // SPEAKEASY CLUB ARMCHAIRS & TABLE PLACE SETTINGS
    // =========================================================
    const seatsGroup = new THREE.Group();
    scene.add(seatsGroup);

    const chairRadius = tableRadius + (total > 11 ? 0.95 : 0.86);
    const cardAnchorRadius = tableRadius + 0.26;

    seatHandlesRef.current.clear();

    currentSlots.forEach((slot, idx) => {
      const angle = ((idx + 0.5) / total) * Math.PI * 2;
      const sx = Math.sin(angle) * chairRadius;
      const sz = Math.cos(angle) * chairRadius;

      const seatGroup = new THREE.Group();
      seatGroup.position.set(sx, 0, sz);
      seatGroup.rotation.y = angle + Math.PI;

      const leatherMat = new THREE.MeshStandardMaterial({
        bumpMap: feltBump,
        bumpScale: 0.01,
        color: slot.player ? '#581922' : '#1b202d',
        roughness: 0.48,
        metalness: 0.08,
      });
      const pipingMat = new THREE.MeshStandardMaterial({
        color: slot.player ? '#d4a84f' : '#3c4457',
        roughness: 0.3,
        metalness: 0.72,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#34d399',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const spotBeamMat = new THREE.MeshBasicMaterial({
        color: '#e04f5b',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      // 4 Carved Wooden Chair Legs
      const legOffsets: [number, number][] = [
        [-0.27, -0.24],
        [0.27, -0.24],
        [-0.27, 0.24],
        [0.27, 0.24],
      ];
      for (const [lx, lz] of legOffsets) {
        const cLeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.022, 0.42, 12),
          mahoganyMat
        );
        cLeg.position.set(lx, 0.21, lz);
        cLeg.castShadow = true;
        seatGroup.add(cLeg);

        const legTip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.023, 0.05, 12),
          brassMat
        );
        legTip.position.set(lx, 0.025, lz);
        seatGroup.add(legTip);
      }

      // Chair Wooden Seat Frame + Plush Leather Cushion
      const seatFrame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.6), mahoganyMat);
      seatFrame.position.y = 0.42;
      seatFrame.castShadow = true;
      seatGroup.add(seatFrame);

      const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.11, 0.56), leatherMat);
      seatCushion.position.y = 0.49;
      seatCushion.castShadow = true;
      seatCushion.receiveShadow = true;
      seatGroup.add(seatCushion);

      // Curved Tufted Club Backrest (positioned at -Z so chair faces +Z toward table center)
      const backrest = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.34, 0.62, 24, 1, false, Math.PI * 0.72, Math.PI * 0.56),
        leatherMat
      );
      backrest.position.set(0, 0.78, 0.02);
      backrest.scale.set(1.05, 1, 0.92);
      backrest.castShadow = true;
      seatGroup.add(backrest);

      const backCap = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.58, 0.1), leatherMat);
      backCap.position.set(0, 0.78, -0.26);
      backCap.rotation.x = -0.1;
      backCap.castShadow = true;
      seatGroup.add(backCap);

      const brassTopCrest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.035, 0.11), pipingMat);
      brassTopCrest.position.set(0, 1.08, -0.29);
      seatGroup.add(brassTopCrest);

      // Padded Armrests
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.48), leatherMat);
        arm.position.set(side * 0.31, 0.62, -0.02);
        arm.castShadow = true;
        seatGroup.add(arm);
      }

      // Floor Status Halo Ring
      const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 40), glowMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.032;
      seatGroup.add(glowRing);

      // Accusation / Selection Overhead Spotlight Beam
      const spotBeam = new THREE.Mesh(
        new THREE.ConeGeometry(0.52, 2.5, 28, 1, true),
        spotBeamMat
      );
      spotBeam.position.set(0, 1.65, 0.32);
      seatGroup.add(spotBeam);

      seatsGroup.add(seatGroup);

      // Per-Player Table Place Setting (Coaster, Crystal Whiskey Glass, Chips & Dealt Card)
      const placeRadius = tableRadius - 0.52;
      const px = Math.sin(angle) * placeRadius;
      const pz = Math.cos(angle) * placeRadius;

      const settingGroup = new THREE.Group();
      settingGroup.position.set(px, tableHeight + 0.017, pz);
      settingGroup.rotation.y = angle + Math.PI;

      const cardPropMat = new THREE.MeshStandardMaterial({
        map: cardBackTex,
        roughness: 0.34,
        metalness: 0.1,
      });

      const brassPlacemat = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.005, 0.28),
        slot.player ? cardPropMat : darkBronzeMat
      );
      brassPlacemat.position.set(0, 0.004, 0);
      brassPlacemat.castShadow = true;
      settingGroup.add(brassPlacemat);

      if (slot.player) {
        // Brass Coaster + Crystal Rocks Tumbler with Amber Whiskey
        const coaster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.08, 0.008, 24),
          brassMat
        );
        coaster.position.set(0.18, 0.004, -0.04);
        settingGroup.add(coaster);

        const glassCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.045, 0.11, 20),
          new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.38,
            roughness: 0.06,
            metalness: 0.08,
          })
        );
        glassCup.position.set(0.18, 0.062, -0.04);
        glassCup.castShadow = true;
        settingGroup.add(glassCup);

        const whiskeyLiquid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.04, 0.052, 18),
          new THREE.MeshStandardMaterial({
            color: '#c96f18',
            emissive: '#592804',
            emissiveIntensity: 0.35,
            roughness: 0.18,
          })
        );
        whiskeyLiquid.position.set(0.18, 0.036, -0.04);
        settingGroup.add(whiskeyLiquid);

        // Player's Personal Chip Stack
        const pChipMat = new THREE.MeshStandardMaterial({
          color: idx % 2 === 0 ? '#9f1d28' : '#1e3a5f',
          roughness: 0.35,
        });
        for (let ch = 0; ch < 3; ch += 1) {
          const pChip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.038, 0.012, 16),
            pChipMat
          );
          pChip.position.set(-0.17, 0.008 + ch * 0.0125, -0.03);
          pChip.castShadow = true;
          settingGroup.add(pChip);
        }
      }

      scene.add(settingGroup);

      const ax = Math.sin(angle) * cardAnchorRadius;
      const az = Math.cos(angle) * cardAnchorRadius;
      const anchorY = 1.56;

      seatHandlesRef.current.set(slot.key, {
        leatherMat,
        pipingMat,
        glowMat,
        spotBeamMat,
        cardPropMat,
        baseY: anchorY,
        position: new THREE.Vector3(ax, anchorY, az),
        seatPos: new THREE.Vector3(sx, 0, sz),
        angle,
      });
    });

    // Floating Speakeasy Dust & Smoke Motes in Spotlight
    const dustCount = 130;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 9.5;
      dustPositions[i * 3 + 1] = 0.5 + Math.random() * 4.4;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 9.5;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: '#f7e3b5',
        size: 0.036,
        transparent: true,
        opacity: 0.42,
      })
    );
    scene.add(dustPoints);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1024;
      const h = container.clientHeight || 680;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let rafId = 0;
    const tempVec = new THREE.Vector3();
    const clock = new THREE.Clock();

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      centerCandleLight.intensity = 5.0 + Math.sin(t * 8.5) * 0.45 + Math.cos(t * 14) * 0.22;
      flame.scale.set(0.7, 1.48 + Math.sin(t * 11) * 0.14, 0.7);
      dustPoints.rotation.y = t * 0.022;
      chandelierGroup.rotation.z = Math.sin(t * 0.55) * 0.008;

      if (cameraGoalRef.current.active) {
        camera.position.lerp(cameraGoalRef.current.pos, 0.08);
        controls.target.lerp(cameraGoalRef.current.target, 0.08);
        if (
          camera.position.distanceTo(cameraGoalRef.current.pos) < 0.04 &&
          controls.target.distanceTo(cameraGoalRef.current.target) < 0.04
        ) {
          cameraGoalRef.current.active = false;
        }
      }

      controls.update();

      const {
        speakingPeerIds: speakingSet,
        selectedVoteTarget: selVote,
        mode: currentMode,
        accuseCounts: liveAccuseMap,
      } = liveVisualsRef.current;

      const slots = seatSlotsRef.current;
      const w = container.clientWidth || 1024;
      const h = container.clientHeight || 680;

      for (const slot of slots) {
        const handle = seatHandlesRef.current.get(slot.key);
        const cardEl = cardRefs.current.get(slot.key);
        if (!handle) continue;

        const p = slot.player;
        const isDead = Boolean(p && currentMode !== 'LOBBY' && !p.isAlive);
        const isSpeaking = Boolean(p && speakingSet.has(p.id));
        const isSelected = Boolean(p && selVote === p.id);
        const isHovered = hoveredKeyRef.current === slot.key;
        const accuseNum = p ? (liveAccuseMap.get(p.id) ?? 0) : 0;

        if (!p) {
          handle.leatherMat.color.set('#1a202c');
          handle.pipingMat.color.set('#3d4559');
          handle.glowMat.opacity = 0;
          handle.spotBeamMat.opacity = 0;
        } else if (isDead) {
          handle.leatherMat.color.set('#16181f');
          handle.pipingMat.color.set('#5a141c');
          handle.glowMat.opacity = 0.16;
          handle.glowMat.color.set('#9f1d28');
          handle.spotBeamMat.opacity = 0;
        } else if (isSelected) {
          handle.leatherMat.color.set('#881927');
          handle.pipingMat.color.set('#f7e3b5');
          handle.glowMat.opacity = 0.78;
          handle.glowMat.color.set('#e04f5b');
          handle.spotBeamMat.color.set('#e04f5b');
          handle.spotBeamMat.opacity = 0.14 + Math.sin(t * 5) * 0.03;
        } else if (isSpeaking) {
          handle.leatherMat.color.set('#114636');
          handle.pipingMat.color.set('#34d399');
          handle.glowMat.opacity = 0.58 + Math.sin(t * 8) * 0.22;
          handle.glowMat.color.set('#34d399');
          handle.spotBeamMat.color.set('#34d399');
          handle.spotBeamMat.opacity = 0.09;
        } else {
          handle.leatherMat.color.set(p.id === myPlayerId ? '#6e202b' : '#3a1f1b');
          handle.pipingMat.color.set(isHovered ? '#f7e3b5' : '#d4a84f');
          handle.glowMat.opacity = isHovered ? 0.42 : accuseNum > 0 ? 0.28 : 0;
          handle.glowMat.color.set(accuseNum > 0 ? '#e04f5b' : '#d4a84f');
          handle.spotBeamMat.color.set('#f5dfb0');
          handle.spotBeamMat.opacity = isHovered ? 0.07 : accuseNum > 0 ? 0.05 : 0;
        }

        if (cardEl) {
          tempVec.copy(handle.position);
          tempVec.y = handle.baseY + Math.sin(t * 1.55 + slot.seatNumber * 0.9) * 0.025;
          const dist = camera.position.distanceTo(tempVec);
          tempVec.project(camera);

          if (tempVec.z < -1 || tempVec.z > 1) {
            cardEl.style.display = 'none';
          } else {
            const screenX = (tempVec.x * 0.5 + 0.5) * w;
            const screenY = (-tempVec.y * 0.5 + 0.5) * h;
            const baseFactor = slots.length > 10 ? 6.6 : 7.4;
            const scale = Math.max(0.58, Math.min(1.06, baseFactor / Math.max(3.4, dist)));
            cardEl.style.display = 'block';
            cardEl.style.left = `${screenX.toFixed(1)}px`;
            cardEl.style.top = `${screenY.toFixed(1)}px`;
            cardEl.style.zIndex = isHovered
              ? '950'
              : `${Math.max(10, Math.round((1 - tempVec.z) * 800))}`;
            cardEl.style.transform = `translate(-50%, -86%) scale(${scale.toFixed(3)})`;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', cancelPresetGlide);
      controls.dispose();
      mahoganyMap.dispose();
      mahoganyBump.dispose();
      floorWoodMap.dispose();
      floorWoodBump.dispose();
      feltMap.dispose();
      feltBump.dispose();
      rugTex.dispose();
      cardBackTex.dispose();
      renderer.dispose();
    };
  }, [compactFallback, seatKeysSignature, myPlayerId]);

  const stageHeightClass = isFullscreen
    ? 'w-screen h-screen rounded-none border-0'
    : fillViewport
      ? 'w-full min-h-[calc(100dvh-3.5rem)] h-[calc(100dvh-3.5rem)] rounded-none border-y border-gold-500/25'
      : 'w-full h-[72vh] min-h-[34rem] max-h-[54rem] rounded-3xl border-2 border-gold-500/35 shadow-[0_28px_70px_rgba(0,0,0,0.82)]';

  return (
    <div
      ref={stageWrapperRef}
      className={`relative ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[#06080f]' : fillViewport ? 'w-full' : 'space-y-3'
      }`}
    >
      {!fillViewport && !isFullscreen && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
          <div className="flex items-center gap-2">
            <span className="font-display uppercase tracking-wider text-gold-300 font-semibold">
              {centerTitle}
            </span>
            <span className="text-cream-400">• {centerSubtitle}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!compactFallback && !webglError && (
              <>
                <button
                  type="button"
                  onClick={() => applyCameraPreset('lounge')}
                  className={`px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
                    activePreset === 'lounge'
                      ? 'bg-gold-500/20 border-gold-400/60 text-gold-200'
                      : 'bg-noir-900/85 hover:bg-noir-800 border-gold-500/30 text-cream-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Lounge Angle
                </button>
                <button
                  type="button"
                  onClick={() => applyCameraPreset('overhead')}
                  className={`px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
                    activePreset === 'overhead'
                      ? 'bg-gold-500/20 border-gold-400/60 text-gold-200'
                      : 'bg-noir-900/85 hover:bg-noir-800 border-gold-500/30 text-cream-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Top-Down
                </button>
                <button
                  type="button"
                  onClick={() => applyCameraPreset('my-seat')}
                  className={`px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 transition cursor-pointer ${
                    activePreset === 'my-seat'
                      ? 'bg-gold-500/20 border-gold-400/60 text-gold-200'
                      : 'bg-noir-900/85 hover:bg-noir-800 border-gold-500/30 text-cream-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  My Seat
                </button>
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="px-2.5 py-1 rounded-lg bg-noir-900/85 hover:bg-noir-800 border border-gold-500/35 text-gold-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Fullscreen
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setCompactFallback((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-noir-900/85 hover:bg-noir-800 border border-gold-500/35 text-gold-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {compactFallback ? '3D Round Table' : 'Card Grid'}
            </button>
          </div>
        </div>
      )}

      {compactFallback || webglError ? (
        <div
          className={`${
            fillViewport || isFullscreen
              ? 'min-h-[calc(100dvh-3.5rem)] flex flex-col justify-center p-6 sm:p-10 bg-noir-950/95'
              : 'noir-card rounded-2xl p-5 sm:p-6'
          }`}
        >
          {(fillViewport || isFullscreen) && (
            <div className="max-w-6xl mx-auto w-full mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display uppercase tracking-wider text-gold-300 font-bold text-sm">
                  {centerTitle}
                </div>
                <div className="text-xs text-cream-400">{centerSubtitle}</div>
              </div>
              {!webglError && (
                <button
                  type="button"
                  onClick={() => setCompactFallback(false)}
                  className="px-3 py-1.5 rounded-lg game-hud-glass text-xs font-semibold text-gold-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Return to 3D Table
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
            {seatSlots.map((slot) => {
              const p = slot.player;
              return (
                <PlayerTradingCard
                  key={slot.key}
                  player={p}
                  seatNumber={slot.seatNumber}
                  mode={mode}
                  isMe={p?.id === myPlayerId}
                  viewerIsHost={viewerIsHost}
                  isSpeaking={Boolean(p && speakingPeerIds.has(p.id))}
                  accuseCount={p ? (accuseCounts.get(p.id) ?? 0) : 0}
                  iAccused={Boolean(p && myAccuseTargetId === p.id)}
                  isSelectedVote={Boolean(p && selectedVoteTarget === p.id)}
                  canAccuse={canAccuse}
                  canVote={Boolean(p && canVoteCandidate(p.id))}
                  onToggleAccuse={() => p && onToggleAccuse?.(p.id)}
                  onSelectVote={() => p && onSelectVote?.(p.id)}
                  onTransferHost={() => p && onTransferHost?.(p.id)}
                  onKickPlayer={() => p && onKickPlayer?.(p.id)}
                />
              );
            })}
          </div>

          {overlayBottom && <div className="mt-6 max-w-3xl mx-auto w-full">{overlayBottom}</div>}
        </div>
      ) : (
        <div className={`relative overflow-hidden bg-[#06080f] ${stageHeightClass}`}>
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Subtle Radial Cinema Vignette over 3D Viewport */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 48%, transparent 52%, rgba(4, 6, 12, 0.72) 100%)',
            }}
          />

          {/* 3D Projected Player Card Panels */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {seatSlots.map((slot) => {
              const p = slot.player;
              return (
                <div
                  key={slot.key}
                  ref={(el) => {
                    if (el) {
                      cardRefs.current.set(slot.key, el);
                    } else {
                      cardRefs.current.delete(slot.key);
                    }
                  }}
                  style={{ display: 'none' }}
                  className="absolute pointer-events-auto"
                >
                  <PlayerTradingCard
                    player={p}
                    seatNumber={slot.seatNumber}
                    mode={mode}
                    isMe={p?.id === myPlayerId}
                    viewerIsHost={viewerIsHost}
                    isSpeaking={Boolean(p && speakingPeerIds.has(p.id))}
                    accuseCount={p ? (accuseCounts.get(p.id) ?? 0) : 0}
                    iAccused={Boolean(p && myAccuseTargetId === p.id)}
                    isSelectedVote={Boolean(p && selectedVoteTarget === p.id)}
                    canAccuse={canAccuse}
                    canVote={Boolean(p && canVoteCandidate(p.id))}
                    onToggleAccuse={() => p && onToggleAccuse?.(p.id)}
                    onSelectVote={() => p && onSelectVote?.(p.id)}
                    onTransferHost={() => p && onTransferHost?.(p.id)}
                    onKickPlayer={() => p && onKickPlayer?.(p.id)}
                    onHoverChange={(hovered) => {
                      hoveredKeyRef.current = hovered ? slot.key : null;
                    }}
                    compact
                  />
                </div>
              );
            })}
          </div>

          {/* Floating Top Game HUD Bar (when fillViewport or Fullscreen) */}
          {(fillViewport || isFullscreen) && (
            <div className="pointer-events-none absolute top-3 left-3 right-3 sm:top-4 sm:left-5 sm:right-5 z-[960] flex flex-wrap items-start justify-between gap-3">
              <div className="pointer-events-auto flex flex-col gap-2 max-w-full">
                {overlayTopLeft ?? (
                  <div className="game-hud-glass rounded-xl px-3.5 py-2">
                    <div className="font-display text-xs sm:text-sm uppercase tracking-wider text-gold-200 font-bold">
                      {centerTitle}
                    </div>
                    <div className="text-[11px] text-cream-300/80">{centerSubtitle}</div>
                  </div>
                )}
              </div>

              <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
                {overlayTopRight}

                <div className="game-hud-glass rounded-xl p-1 flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => applyCameraPreset('lounge')}
                    title="Default Lounge View"
                    className={`px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1 transition cursor-pointer ${
                      activePreset === 'lounge'
                        ? 'bg-gold-500/25 text-gold-200 border border-gold-400/40'
                        : 'text-cream-300 hover:text-cream-50'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Lounge</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCameraPreset('overhead')}
                    title="Overhead Tactical View"
                    className={`px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1 transition cursor-pointer ${
                      activePreset === 'overhead'
                        ? 'bg-gold-500/25 text-gold-200 border border-gold-400/40'
                        : 'text-cream-300 hover:text-cream-50'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Top</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyCameraPreset('my-seat')}
                    title="My Seat Perspective"
                    className={`px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1 transition cursor-pointer ${
                      activePreset === 'my-seat'
                        ? 'bg-gold-500/25 text-gold-200 border border-gold-400/40'
                        : 'text-cream-300 hover:text-cream-50'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Seat</span>
                  </button>

                  <span className="w-px h-4 bg-gold-500/25 mx-0.5" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => setCompactFallback(true)}
                    title="Switch to 2D Card Grid"
                    className="px-2 py-1 rounded-lg text-cream-300 hover:text-gold-200 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    className="px-2 py-1 rounded-lg text-gold-200 hover:bg-gold-500/20 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Bottom Dock / Controls inside 3D Viewport */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-5 sm:right-5 z-[960] flex flex-col items-center gap-2">
            {overlayBottom && (
              <div className="pointer-events-auto w-full max-w-2xl">{overlayBottom}</div>
            )}

            <div className="w-full flex items-center justify-between text-[10.5px] text-cream-300/75">
              <span className="px-2.5 py-1 rounded-full bg-noir-950/80 border border-gold-500/25 backdrop-blur-sm">
                Drag to orbit round table • Scroll to zoom
              </span>
              {!fillViewport && !isFullscreen && (
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="pointer-events-auto px-2.5 py-1 rounded-full bg-noir-950/85 hover:bg-noir-900 border border-gold-500/35 text-gold-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  Fullscreen Table
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
