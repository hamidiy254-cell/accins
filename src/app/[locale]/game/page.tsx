'use client';
import { useEffect, useState, useRef } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Gamepad2, ArrowLeft, Trophy, Play, Flame, Target, Crown, Zap, Star, Sparkles } from 'lucide-react';

type GameCardProps = {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  bestScore: number | null;
  totalPlayers: number;
  previewType: 'snake' | 'penalty';
};

function AnimatedPreview({ type }: { type: 'snake' | 'penalty' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 320;
    const H = 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.scale(dpr, dpr);

    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      if (type === 'snake') {
        // Background
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#0a2a2a');
        bg.addColorStop(1, '#020617');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i < W; i += 20) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke();
        }
        for (let i = 0; i < H; i += 20) {
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
        }

        // Snake (sin wave path)
        const segs = 12;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < segs; i++) {
          const p = t / 40 - i * 0.4;
          pts.push({
            x: W / 2 + Math.cos(p) * 90,
            y: H / 2 + Math.sin(p * 1.3) * 45,
          });
        }

        // Trail
        for (let i = pts.length - 1; i >= 1; i--) {
          const ratio = i / segs;
          const hue = 190 + ratio * 110;
          ctx.fillStyle = `hsl(${hue}, 95%, ${60 - ratio * 22}%)`;
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, 9 - ratio * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head with glow
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#22d3ee';
        const hg = ctx.createRadialGradient(pts[0].x - 3, pts[0].y - 3, 0, pts[0].x, pts[0].y, 11);
        hg.addColorStop(0, '#67e8f9');
        hg.addColorStop(1, '#0891b2');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Eyes
        const angle = Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x);
        const ex = pts[0].x + Math.cos(angle) * 4;
        const ey = pts[0].y + Math.sin(angle) * 4;
        const perpX = Math.cos(angle + Math.PI / 2) * 3.5;
        const perpY = Math.sin(angle + Math.PI / 2) * 3.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + perpX, ey + perpY, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - perpX, ey - perpY, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(ex + perpX + Math.cos(angle) * 0.5, ey + perpY + Math.sin(angle) * 0.5, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - perpX + Math.cos(angle) * 0.5, ey - perpY + Math.sin(angle) * 0.5, 1, 0, Math.PI * 2); ctx.fill();

        // Apple (pulsing)
        const foodX = W / 2 + Math.cos(t / 40 + 3) * 90;
        const foodY = H / 2 + Math.sin((t / 40 + 3) * 1.3) * 45;
        const pulse = 1 + Math.sin(t / 8) * 0.15;
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        const fg = ctx.createRadialGradient(foodX - 2, foodY - 2, 0, foodX, foodY, 8 * pulse);
        fg.addColorStop(0, '#fecaca');
        fg.addColorStop(0.6, '#ef4444');
        fg.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(foodX, foodY, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // PENALTY preview
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0a1a3d');
        bg.addColorStop(0.5, '#0f2a5c');
        bg.addColorStop(0.6, '#0f5d1e');
        bg.addColorStop(1, '#062a0e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Stars
        for (let i = 0; i < 20; i++) {
          const sx = ((i * 7919) % 1000) / 1000 * W;
          const sy = ((i * 1979) % 1000) / 1000 * H * 0.5;
          const sp = 0.3 + 0.7 * Math.abs(Math.sin(t / 30 + i));
          ctx.fillStyle = `rgba(255,255,255,${sp * 0.8})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Goal
        const gx = W * 0.15;
        const gy = H * 0.25;
        const gw = W * 0.7;
        const gh = H * 0.4;

        // Net
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 15; i++) {
          const x = gx + (gw / 15) * i;
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
        }
        for (let i = 1; i < 8; i++) {
          const y = gy + (gh / 8) * i;
          ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
        }

        // Frame glow
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, gw, gh);

        // Keeper
        const kx = gx + gw * (0.5 + Math.sin(t / 30) * 0.2);
        const ky = gy + gh * 0.65;
        const ks = gh * 0.25;

        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f59e0b';
        // Body
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(kx - ks * 0.4, ky - ks * 0.3, ks * 0.8, ks * 0.9);
        // Head
        ctx.fillStyle = '#fcd34d';
        ctx.beginPath();
        ctx.arc(kx, ky - ks * 0.55, ks * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Arms
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = ks * 0.18;
        ctx.lineCap = 'round';
        const spread = 0.5 + 0.5 * Math.abs(Math.sin(t / 30));
        ctx.beginPath();
        ctx.moveTo(kx - ks * 0.4, ky - ks * 0.1);
        ctx.lineTo(kx - ks * 0.9 * spread, ky - ks * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(kx + ks * 0.4, ky - ks * 0.1);
        ctx.lineTo(kx + ks * 0.9 * spread, ky - ks * 0.6);
        ctx.stroke();
        ctx.restore();

        // Ball flying
        const ballProgress = (t % 90) / 90;
        const ballX = W / 2 + (kx - W / 2) * ballProgress;
        const ballY = H * 0.9 - (H * 0.9 - ky + 20) * ballProgress;
        const ballR = 7 * (1 - ballProgress * 0.4);
        const ballGrad = ctx.createRadialGradient(ballX - 2, ballY - 2, 0, ballX, ballY, ballR);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.6, '#e5e7eb');
        ballGrad.addColorStop(1, '#6b7280');
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#fff';
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Ball pattern
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      t++;
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [type]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

function GameCard({ href, title, subtitle, icon, gradient, glow, bestScore, totalPlayers, previewType }: GameCardProps) {
  return (
    <Link href={href} className="group relative block">
      <div className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${glow} opacity-30 blur-2xl group-hover:opacity-70 transition-opacity duration-500`} />
      <div className={`relative rounded-3xl overflow-hidden border-2 border-white/10 bg-slate-950 transform group-hover:-translate-y-1 group-hover:scale-[1.02] transition-all duration-300 shadow-2xl`}>
        {/* Preview animée */}
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
          <AnimatedPreview type={previewType} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          
          {/* Best score badge */}
          {bestScore !== null && bestScore > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-yellow-400/30">
              <Crown size={12} className="text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400">{bestScore}</span>
            </div>
          )}
          
          {/* Play button flottant */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300`}>
              <Play size={32} className="text-white ml-1" fill="white" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className={`relative p-5 bg-gradient-to-br ${gradient}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white">
                  {icon}
                </div>
                <h3 className="text-xl font-bold text-white truncate">{title}</h3>
              </div>
              <p className="text-sm text-white/80 line-clamp-2">{subtitle}</p>
            </div>
            <div className="flex flex-col items-end shrink-0 text-white/70">
              <span className="text-[10px] uppercase tracking-wider">Joueurs</span>
              <span className="text-sm font-bold text-white">{totalPlayers}</span>
            </div>
          </div>
        </div>

        {/* Sparkle decoration */}
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Sparkles size={16} className="text-white/60 animate-pulse" />
        </div>
      </div>
    </Link>
  );
}

export default function GameHubPage() {
  const locale = useLocale();
  const supabase = createClient();
  const [stats, setStats] = useState({
    snakeBest: null as number | null,
    penaltyBest: null as number | null,
    snakePlayers: 0,
    penaltyPlayers: 0,
    snakeTotal: 0,
    penaltyTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [snakeScores, penaltyScores] = await Promise.all([
        supabase.from('game_scores').select('score, user_id'),
        supabase.from('penalty_scores').select('score, user_id'),
      ]);

      const snakeList = snakeScores.data || [];
      const penaltyList = penaltyScores.data || [];

      setStats({
        snakeBest: snakeList.length > 0 ? Math.max(...snakeList.map((s: any) => s.score)) : null,
        penaltyBest: penaltyList.length > 0 ? Math.max(...penaltyList.map((s: any) => s.score)) : null,
        snakePlayers: new Set(snakeList.map((s: any) => s.user_id)).size,
        penaltyPlayers: new Set(penaltyList.map((s: any) => s.user_id)).size,
        snakeTotal: snakeList.length,
        penaltyTotal: penaltyList.length,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 mb-6 transition">
        <ArrowLeft size={16} /> Retour
      </Link>

      {/* Header */}
      <div className="relative mb-10 text-center">
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="w-96 h-96 rounded-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-emerald-500 blur-3xl" />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-emerald-500/10 border border-fuchsia-500/30 mb-4">
            <Flame size={14} className="text-fuchsia-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">Arcade Zone</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black mb-3 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-500 bg-clip-text text-transparent leading-tight">
            Accins Arcade
          </h1>
          <p className="text-slate-500 text-lg">Choisis ton jeu. Bats les records. Deviens une légende.</p>
        </div>
      </div>

      {/* Stats globales */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Joueurs</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">{stats.snakePlayers + stats.penaltyPlayers}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Parties</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-fuchsia-500 to-pink-600 bg-clip-text text-transparent">{stats.snakeTotal + stats.penaltyTotal}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Jeux</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">2</p>
          </div>
        </div>
      )}

      {/* Grid des jeux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <GameCard
          href={`/${locale}/game/snake`}
          title="Snake"
          subtitle="Le serpent néon. Mange les pommes, évite ta queue. Traverse les bords."
          icon={<Zap size={16} />}
          gradient="from-cyan-500 to-blue-700"
          glow="from-cyan-500 to-blue-600"
          bestScore={stats.snakeBest}
          totalPlayers={stats.snakePlayers}
          previewType="snake"
        />

        <GameCard
          href={`/${locale}/game/penalty`}
          title="Penalty Shootout"
          subtitle="5 tirs au but. Trompe le gardien. Devenez le roi du penalty."
          icon={<Target size={16} />}
          gradient="from-emerald-500 to-green-700"
          glow="from-emerald-500 to-green-600"
          bestScore={stats.penaltyBest}
          totalPlayers={stats.penaltyPlayers}
          previewType="penalty"
        />
      </div>

      {/* Footer CTA */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
          <Star size={12} className="text-yellow-500" fill="currentColor" />
          Connecte-toi pour sauvegarder tes scores et apparaître dans le classement
        </div>
      </div>
    </div>
  );
}