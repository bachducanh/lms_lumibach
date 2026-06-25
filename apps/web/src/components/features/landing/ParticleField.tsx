'use client';

import { useEffect, useRef } from 'react';

/**
 * Nền hạt "constellation" — các chấm sáng trôi nhẹ và nối dây khi đến gần nhau.
 * Đặt trong container position:relative (absolute inset-0). Tự tắt khi
 * prefers-reduced-motion và dọn dẹp rAF/listener khi unmount.
 */
export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Màu theo brand: hồng primary + cyan + trắng.
    const colors = [
      'rgb(253 8 93 / 0.85)',
      'oklch(0.78 0.16 220 / 0.8)',
      'rgb(255 255 255 / 0.45)',
    ];
    type P = { x: number; y: number; r: number; vx: number; vy: number; color: string };
    let particles: P[] = [];
    let raf = 0;

    const parent = canvas.parentElement;
    const dims = () => ({
      w: parent?.clientWidth ?? window.innerWidth,
      h: parent?.clientHeight ?? window.innerHeight,
    });

    function resize() {
      const { w, h } = dims();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const { w, h } = dims();
      const count = Math.min(90, Math.floor(w / 16));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.4 + 1,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      }));
    }

    function draw() {
      const { w, h } = dims();
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 130) {
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgb(255 255 255 / ${0.16 * (1 - dist / 130)})`;
            ctx!.lineWidth = 1;
            ctx!.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    seed();
    draw();
    const onResize = () => {
      resize();
      seed();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
    />
  );
}
