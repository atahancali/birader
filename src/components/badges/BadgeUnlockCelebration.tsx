"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BadgeVisual from "@/components/badges/BadgeVisual";
import type { Badge } from "@/lib/badgeSystem";

type BadgeUnlockCelebrationProps = {
  badge: Badge | null;
  lang: "tr" | "en";
  onClose: () => void;
};

type ConfettiParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  ttl: number;
};

const COLORS = ["#f59e0b", "#fbbf24", "#f5edd8", "#ec4899", "#3b82f6", "#22c55e"];

export default function BadgeUnlockCelebration({ badge, lang, onClose }: BadgeUnlockCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://birader.app/badges";
    return `${window.location.origin}/badges`;
  }, []);

  useEffect(() => {
    if (!badge) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const particles: ConfettiParticle[] = [];
    const count = 180;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2.2 + Math.random() * 3.8;
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.3,
        size: 2 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] || "#f59e0b",
        life: 0,
        ttl: 70 + Math.random() * 50,
      });
    }

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of particles) {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.996;
        const alpha = Math.max(0, 1 - p.life / p.ttl);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.65);
      }
      ctx.globalAlpha = 1;

      if (particles.some((p) => p.life < p.ttl)) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [badge]);

  if (!badge) return null;

  async function share() {
    if (!badge) return;
    const text = lang === "en" ? `I unlocked ${badge.name} on Birader!` : `Birader'da ${badge.nameTR} rozetini açtım!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Birader", text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[90]">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <div className="absolute inset-0 bg-black/75" />

      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-amber-300/30 bg-[#0D0A06] p-5 text-center shadow-[0_30px_80px_rgba(0,0,0,0.8)]">
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-[#A0764A]">
          {lang === "en" ? "Badge Unlocked!" : "Rozet Kazanıldı!"}
        </div>

        <div className="mx-auto w-fit animate-[badge-first-unlock_680ms_ease-out]">
          <BadgeVisual badge={badge} size={120} unlocked animateUnlock />
        </div>

        <h3 className="mt-3 text-xl font-semibold text-[#F5EDD8]">
          {lang === "en" ? badge.name : badge.nameTR}
        </h3>
        <p className="mt-1 text-sm text-[#A0764A] italic">
          {lang === "en" ? badge.description : badge.descriptionTR}
        </p>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={share}
            className="rounded-xl border border-amber-300/35 bg-amber-500/15 px-3 py-2 text-sm text-amber-100"
          >
            {copied ? (lang === "en" ? "Copied" : "Kopyalandı") : lang === "en" ? "Share" : "Paylaş"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-[#F5EDD8]"
          >
            {lang === "en" ? "Close" : "Kapat"}
          </button>
        </div>
      </div>
    </div>
  );
}
