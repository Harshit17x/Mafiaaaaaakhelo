import React, { useEffect, useRef } from 'react';

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
}

interface SmokeWisp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  age: number;
  maxAge: number;
}

export function TitleAtmosphereCanvas({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    const motes: DustMote[] = Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.35) * 0.00018,
      vy: -(0.0001 + Math.random() * 0.00022),
      radius: 0.9 + Math.random() * 1.9,
      alpha: 0.14 + Math.random() * 0.32,
      phase: Math.random() * Math.PI * 2,
    }));

    const wisps: SmokeWisp[] = Array.from({ length: 8 }, (_, idx) => ({
      x: 0.84 + (Math.random() - 0.5) * 0.04,
      y: 0.72 - idx * 0.045,
      vx: (Math.random() - 0.3) * 0.00028,
      vy: -(0.00035 + Math.random() * 0.00025),
      radius: 18 + idx * 7,
      alpha: 0.045,
      age: idx * 35,
      maxAge: 280,
    }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let tick = 0;
    const render = () => {
      if (document.hidden) {
        rafId = window.requestAnimationFrame(render);
        return;
      }
      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // Gentle rising cigar smoke wisps on desktop right foreground
      if (width >= 640) {
        for (const w of wisps) {
          w.age += 1;
          w.x += w.vx + Math.sin(tick * 0.015 + w.age * 0.04) * 0.00018;
          w.y += w.vy;
          w.radius += 0.11;

          if (w.age >= w.maxAge) {
            w.x = 0.85 + (Math.random() - 0.5) * 0.025;
            w.y = 0.76;
            w.radius = 14 + Math.random() * 8;
            w.age = 0;
          }

          const life = w.age / w.maxAge;
          const fade = Math.sin(life * Math.PI);
          const px = w.x * width;
          const py = w.y * height;

          const grad = ctx.createRadialGradient(px, py, 0, px, py, w.radius);
          grad.addColorStop(0, `rgba(220, 206, 188, ${w.alpha * fade})`);
          grad.addColorStop(0.55, `rgba(180, 165, 152, ${w.alpha * 0.45 * fade})`);
          grad.addColorStop(1, 'rgba(180, 165, 152, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, w.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Warm amber dust motes drifting in the lounge lighting
      for (const m of motes) {
        m.x += m.vx + Math.sin(tick * 0.01 + m.phase) * 0.00005;
        m.y += m.vy;
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;

        const twinkle = 0.65 + 0.35 * Math.sin(tick * 0.028 + m.phase);
        const px = m.x * width;
        const py = m.y * height;

        ctx.fillStyle = `rgba(235, 188, 114, ${m.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(px, py, m.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[3]"
    />
  );
}

