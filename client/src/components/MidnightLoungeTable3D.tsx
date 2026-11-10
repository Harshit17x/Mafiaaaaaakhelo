import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ClientPlayerView } from '@midnight-city/shared';
import { LayoutGrid, RotateCcw } from 'lucide-react';
import { PlayerTradingCard } from './PlayerTradingCard';

interface SeatVisualHandle {
  cushionMat: THREE.MeshStandardMaterial;
  pipingMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  baseY: number;
  position: THREE.Vector3;
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
}

function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3c2516';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i += 1) {
    const y = (i / 160) * 512;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(24, 12, 6, 0.35)' : 'rgba(92, 58, 34, 0.22)';
    ctx.lineWidth = 1 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + Math.sin(i) * 8, 340, y - Math.cos(i) * 8, 512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTatamiRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b2621';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(212, 168, 79, 0.04)' : 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(0, y, 512, 3);
  }
  ctx.strokeStyle = 'rgba(212, 168, 79, 0.42)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
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
}: MidnightLoungeTable3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const seatHandlesRef = useRef<Map<string, SeatVisualHandle>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hoveredKeyRef = useRef<string | null>(null);

  const [compactFallback, setCompactFallback] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const seatSlots = useMemo(() => {
    const minSeats = mode === 'LOBBY' ? Math.max(5, players.length) : Math.max(1, players.length);
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
  });
  liveVisualsRef.current = {
    speakingPeerIds,
    selectedVoteTarget,
    mode,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || compactFallback) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090d16');
    scene.fog = new THREE.FogExp2('#090d16', 0.042);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(0, 5.6, 8.6);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0.95, 0);
    controls.minDistance = 4.6;
    controls.maxDistance = 11.4;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.enablePan = false;
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight('#ffe5c2', 0.68);
    scene.add(ambient);

    const chandelierLight = new THREE.PointLight('#ffbe6b', 22, 18, 1.5);
    chandelierLight.position.set(0, 4.1, 0);
    chandelierLight.castShadow = true;
    chandelierLight.shadow.mapSize.set(1024, 1024);
    scene.add(chandelierLight);

    const candleLight = new THREE.PointLight('#ff9640', 4.5, 6.5, 1.8);
    candleLight.position.set(0, 1.18, 0);
    scene.add(candleLight);

    const fillRimLight = new THREE.DirectionalLight('#6b88c9', 0.85);
    fillRimLight.position.set(-5, 4, -5);
    scene.add(fillRimLight);

    const woodTex = createWoodTexture();
    const rugTex = createTatamiRugTexture();

    const floorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const rugMat = new THREE.MeshStandardMaterial({
      map: rugTex,
      roughness: 0.92,
      metalness: 0.04,
    });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.45, 0.04, 64), rugMat);
    rug.position.y = 0.02;
    rug.receiveShadow = true;
    scene.add(rug);

    const wallMat = new THREE.MeshStandardMaterial({
      color: '#171d2c',
      roughness: 0.85,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: '#5a3a26',
      roughness: 0.78,
    });

    const roomRadius = 9.5;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const wallGroup = new THREE.Group();
      wallGroup.position.set(Math.sin(angle) * roomRadius, 0, Math.cos(angle) * roomRadius);
      wallGroup.rotation.y = angle + Math.PI;

      const upperWall = new THREE.Mesh(new THREE.BoxGeometry(8.2, 5.5, 0.25), wallMat);
      upperWall.position.y = 2.75;
      wallGroup.add(upperWall);

      const lowerWood = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.45, 0.32), wainscotMat);
      lowerWood.position.y = 0.72;
      wallGroup.add(lowerWood);

      if (i % 2 === 0) {
        const sconce = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.42, 0.2),
          new THREE.MeshStandardMaterial({
            color: '#ffd699',
            emissive: '#ffaa44',
            emissiveIntensity: 1.6,
          })
        );
        sconce.position.set(0, 2.7, 0.2);
        wallGroup.add(sconce);
      }

      if (i === 4 || i === 5 || i === 3) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 0.55), wainscotMat);
        shelf.position.set(0, 1.2, 0.45);
        wallGroup.add(shelf);
        for (let b = -1.0; b <= 1.0; b += 0.36) {
          const item = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.42, 0.28),
            new THREE.MeshStandardMaterial({
              color: b < 0 ? '#9f1d28' : '#d4a84f',
              roughness: 0.5,
            })
          );
          item.position.set(b, 1.65, 0.5);
          wallGroup.add(item);
        }
      }

      scene.add(wallGroup);
    }

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: '#241710', roughness: 0.9 })
    );
    ceiling.position.y = 5.5;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    for (let r = -6; r <= 6; r += 3) {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(20, 0.28, 0.32), wainscotMat);
      rafter.position.set(0, 5.36, r);
      scene.add(rafter);
    }

    const chandelierGroup = new THREE.Group();
    chandelierGroup.position.set(0, 4.45, 0);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.1, 12),
      new THREE.MeshStandardMaterial({ color: '#b38936', metalness: 0.7, roughness: 0.3 })
    );
    rod.position.y = 0.55;
    chandelierGroup.add(rod);

    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.04, 12, 32),
      new THREE.MeshStandardMaterial({ color: '#d4a84f', metalness: 0.75, roughness: 0.28 })
    );
    ringMesh.rotation.x = Math.PI / 2;
    chandelierGroup.add(ringMesh);

    for (let b = 0; b < 6; b += 1) {
      const a = (b / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshStandardMaterial({
          color: '#fff1cc',
          emissive: '#ffb84d',
          emissiveIntensity: 2.2,
        })
      );
      bulb.position.set(Math.cos(a) * 0.75, -0.05, Math.sin(a) * 0.75);
      chandelierGroup.add(bulb);
    }
    scene.add(chandelierGroup);

    const tableGroup = new THREE.Group();
    const tableMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: '#6b472d',
      roughness: 0.36,
      metalness: 0.08,
    });
    const tableGoldTrimMat = new THREE.MeshStandardMaterial({
      color: '#d4a84f',
      metalness: 0.72,
      roughness: 0.28,
    });

    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.72, 1.68, 0.12, 64),
      tableMat
    );
    tableTop.position.y = 0.68;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    const tableTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.022, 12, 64),
      tableGoldTrimMat
    );
    tableTrim.rotation.x = Math.PI / 2;
    tableTrim.position.y = 0.68;
    tableGroup.add(tableTrim);

    for (let l = 0; l < 4; l += 1) {
      const a = (l / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.14), tableMat);
      leg.position.set(Math.cos(a) * 0.92, 0.34, Math.sin(a) * 0.92);
      leg.rotation.y = -a;
      leg.rotation.z = 0.26;
      leg.castShadow = true;
      tableGroup.add(leg);
    }

    const crossBrace1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.1), tableMat);
    crossBrace1.position.y = 0.25;
    crossBrace1.rotation.y = Math.PI / 4;
    tableGroup.add(crossBrace1);

    const crossBrace2 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.1), tableMat);
    crossBrace2.position.y = 0.25;
    crossBrace2.rotation.y = -Math.PI / 4;
    tableGroup.add(crossBrace2);

    const lanternBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.08, 24),
      tableGoldTrimMat
    );
    lanternBase.position.y = 0.78;
    tableGroup.add(lanternBase);

    const candleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 0.22, 18),
      new THREE.MeshStandardMaterial({ color: '#ece4d4', roughness: 0.5 })
    );
    candleBody.position.y = 0.91;
    tableGroup.add(candleBody);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshStandardMaterial({
        color: '#ffe099',
        emissive: '#ff9022',
        emissiveIntensity: 3.0,
      })
    );
    flame.scale.set(0.75, 1.4, 0.75);
    flame.position.y = 1.07;
    tableGroup.add(flame);

    for (let c = 0; c < 4; c += 1) {
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.015, 0.34),
        new THREE.MeshStandardMaterial({ color: '#141d33', roughness: 0.45 })
      );
      card.position.set(0.42 + c * 0.01, 0.75 + c * 0.016, 0.15);
      card.rotation.y = 0.2 * c;
      tableGroup.add(card);
    }

    scene.add(tableGroup);

    const seatsGroup = new THREE.Group();
    scene.add(seatsGroup);

    const currentSlots = seatSlotsRef.current;
    const total = currentSlots.length;
    const seatRadius = total > 10 ? 3.15 : total > 7 ? 2.85 : 2.55;

    seatHandlesRef.current.clear();

    currentSlots.forEach((slot, idx) => {
      const angle = ((idx + 0.5) / total) * Math.PI * 2;
      const sx = Math.sin(angle) * seatRadius;
      const sz = Math.cos(angle) * seatRadius;

      const seatGroup = new THREE.Group();
      seatGroup.position.set(sx, 0, sz);
      seatGroup.rotation.y = angle + Math.PI;

      const cushionMat = new THREE.MeshStandardMaterial({
        color: slot.player ? '#6e1d27' : '#1b2232',
        roughness: 0.82,
        metalness: 0.05,
      });
      const pipingMat = new THREE.MeshStandardMaterial({
        color: slot.player ? '#d4a84f' : '#3d4559',
        roughness: 0.45,
        metalness: 0.5,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#34d399',
        transparent: true,
        opacity: 0,
      });

      const cushion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.6, 0.16, 24),
        cushionMat
      );
      cushion.position.y = 0.11;
      cushion.scale.set(1.12, 1, 0.92);
      cushion.castShadow = true;
      cushion.receiveShadow = true;
      seatGroup.add(cushion);

      const piping = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.025, 10, 28),
        pipingMat
      );
      piping.rotation.x = Math.PI / 2;
      piping.position.y = 0.18;
      piping.scale.set(1.12, 0.92, 1);
      seatGroup.add(piping);

      const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 32), glowMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.05;
      seatGroup.add(glowRing);

      if (slot.player) {
        const coaster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.02, 20),
          new THREE.MeshStandardMaterial({ color: '#d4a84f', metalness: 0.65, roughness: 0.3 })
        );
        coaster.position.set(0, 0.75, 1.15);
        seatGroup.add(coaster);

        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.065, 0.14, 16),
          new THREE.MeshStandardMaterial({ color: '#ece4d4', roughness: 0.35 })
        );
        cup.position.set(0, 0.83, 1.15);
        seatGroup.add(cup);
      }

      seatsGroup.add(seatGroup);
      seatHandlesRef.current.set(slot.key, {
        cushionMat,
        pipingMat,
        glowMat,
        baseY: 1.48,
        position: new THREE.Vector3(sx, 1.48, sz),
      });
    });

    const dustCount = 90;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 10;
      dustPositions[i * 3 + 1] = 0.4 + Math.random() * 4;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: '#f5dfb0',
        size: 0.04,
        transparent: true,
        opacity: 0.45,
      })
    );
    scene.add(dustPoints);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 560;
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

      candleLight.intensity = 4.2 + Math.sin(t * 9) * 0.45 + Math.cos(t * 15) * 0.25;
      flame.scale.set(0.75, 1.3 + Math.sin(t * 12) * 0.15, 0.75);
      dustPoints.rotation.y = t * 0.025;

      const {
        speakingPeerIds: speakingSet,
        selectedVoteTarget: selVote,
        mode: currentMode,
      } = liveVisualsRef.current;

      const slots = seatSlotsRef.current;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 560;

      controls.update();

      for (const slot of slots) {
        const handle = seatHandlesRef.current.get(slot.key);
        const cardEl = cardRefs.current.get(slot.key);
        if (!handle) continue;

        const p = slot.player;
        const isDead = Boolean(p && currentMode !== 'LOBBY' && !p.isAlive);
        const isSpeaking = Boolean(p && speakingSet.has(p.id));
        const isSelected = Boolean(p && selVote === p.id);
        const isHovered = hoveredKeyRef.current === slot.key;

        if (!p) {
          handle.cushionMat.color.set('#1a2130');
          handle.pipingMat.color.set('#3d4559');
          handle.glowMat.opacity = 0;
        } else if (isDead) {
          handle.cushionMat.color.set('#191b22');
          handle.pipingMat.color.set('#621017');
          handle.glowMat.opacity = 0.15;
          handle.glowMat.color.set('#9f1d28');
        } else if (isSelected) {
          handle.cushionMat.color.set('#8f1d2c');
          handle.pipingMat.color.set('#f5dfb0');
          handle.glowMat.opacity = 0.72;
          handle.glowMat.color.set('#e04f5b');
        } else if (isSpeaking) {
          handle.cushionMat.color.set('#144a38');
          handle.pipingMat.color.set('#34d399');
          handle.glowMat.opacity = 0.55 + Math.sin(t * 8) * 0.25;
          handle.glowMat.color.set('#34d399');
        } else {
          handle.cushionMat.color.set(p.id === myPlayerId ? '#7c2934' : '#3a2b22');
          handle.pipingMat.color.set(isHovered ? '#f5dfb0' : '#d4a84f');
          handle.glowMat.opacity = isHovered ? 0.35 : 0;
          handle.glowMat.color.set('#d4a84f');
        }

        if (cardEl) {
          tempVec.copy(handle.position);
          tempVec.y = handle.baseY + Math.sin(t * 1.6 + slot.seatNumber) * 0.03;
          const dist = camera.position.distanceTo(tempVec);
          tempVec.project(camera);

          if (tempVec.z < -1 || tempVec.z > 1) {
            cardEl.style.display = 'none';
          } else {
            const screenX = (tempVec.x * 0.5 + 0.5) * w;
            const screenY = (-tempVec.y * 0.5 + 0.5) * h;
            const scale = Math.max(0.65, Math.min(1.06, 7.2 / Math.max(3.2, dist)));
            cardEl.style.display = 'block';
            cardEl.style.left = `${screenX.toFixed(1)}px`;
            cardEl.style.top = `${screenY.toFixed(1)}px`;
            cardEl.style.zIndex = `${Math.round((1 - tempVec.z) * 1000)}`;
            cardEl.style.transform = `translate(-50%, -88%) scale(${scale.toFixed(3)})`;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      woodTex.dispose();
      rugTex.dispose();
      renderer.dispose();
    };
  }, [compactFallback, seatKeysSignature, myPlayerId]);

  const handleResetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 5.6, 8.6);
      controlsRef.current.target.set(0, 0.95, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-display uppercase tracking-wider text-gold-300 font-semibold">
            {centerTitle}
          </span>
          <span className="text-cream-400">• {centerSubtitle}</span>
        </div>

        <div className="flex items-center gap-2">
          {!compactFallback && !webglError && (
            <button
              type="button"
              onClick={handleResetView}
              className="px-2.5 py-1 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/35 text-cream-200 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset View
            </button>
          )}
          <button
            type="button"
            onClick={() => setCompactFallback((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-noir-800 hover:bg-noir-700 border border-gold-500/35 text-gold-200 inline-flex items-center gap-1"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {compactFallback ? '3D Table View' : 'Flat Cards'}
          </button>
        </div>
      </div>

      {compactFallback || webglError ? (
        <div className="noir-card rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap justify-center gap-4">
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
                  compact
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-[27rem] sm:h-[34rem] lg:h-[38rem] noir-card rounded-3xl overflow-hidden border-2 border-gold-500/35 shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

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

          <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between items-center text-[11px] text-cream-300/75">
            <span className="px-2.5 py-1 rounded-full bg-noir-950/75 border border-gold-500/25">
              Drag to orbit lounge • Scroll to zoom
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
