'use client';
import { useEffect, useState, useRef } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Play, Crown, Target, Zap, Users, Trophy, TrendingUp, Sparkles } from 'lucide-react';

// ============================================================
// PREVIEW CANVAS COMPONENTS
// ============================================================
function SnakePreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 400;
    const H = 250;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;
    const render = () => {
      // Background
      const bg = ctx.createRadialGradient(W * 0.3, H * 0.3, 0, W / 2, H / 2, W);
      bg.addColorStop(0, '#0f3831');
      bg.addColorStop(0.5, '#0a2a2a');
      bg.addColorStop(1, '#020617');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 25) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let i = 0; i < H; i += 25) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

      // Snake path (smooth sin wave)
      const segs = 18;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < segs; i++) {
        const p = t / 45 - i * 0.32;
        pts.push({
          x: W / 2 + Math.cos(p) * 110,
          y: H / 2 + Math.sin(p * 1.3) * 55,
        });
      }

      // Body segments with glow
      for (let i = pts.length - 1; i >= 1; i--) {
        const ratio = i / segs;
        const hue = 190 + ratio * 110;
        const radius = 13 - ratio * 8;
        ctx.save();
        if (i < 5) { ctx.shadowBlur = 20; ctx.shadowColor = `hsl(${hue}, 100%, 60%)`; }
        const grad = ctx.createRadialGradient(pts[i].x - 3, pts[i].y - 3, 0, pts[i].x, pts[i].y, radius);
        grad.addColorStop(0, `hsl(${hue}, 100%, 75%)`);
        grad.addColorStop(1, `hsl(${hue}, 90%, 45%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Head with eyes
      const head = pts[0];
      const angle = Math.atan2(head.y - pts[1].y, head.x - pts[1].x);
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(angle);

      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#22d3ee';
      const hg = ctx.createRadialGradient(-3, -3, 0, 0, 0, 15);
      hg.addColorStop(0, '#67e8f9');
      hg.addColorStop(0.6, '#22d3ee');
      hg.addColorStop(1, '#0891b2');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(5, -6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(6, -6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 6, 2, 0, Math.PI * 2); ctx.fill();

      // Tongue
      if (Math.floor(t / 30) % 15 < 3) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(24, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Apple (food)
      const foodX = W / 2 + Math.cos(t / 45 + 4) * 110;
      const foodY = H / 2 + Math.sin((t / 45 + 4) * 1.3) * 55;
      const pulse = 1 + Math.sin(t / 12) * 0.12;
      ctx.save();
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ef4444';
      const fg = ctx.createRadialGradient(foodX - 4, foodY - 4, 0, foodX, foodY, 11 * pulse);
      fg.addColorStop(0, '#fecaca');
      fg.addColorStop(0.4, '#f87171');
      fg.addColorStop(0.75, '#dc2626');
      fg.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(foodX, foodY, 11 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Leaf + stem
      ctx.fillStyle = '#22c55e';
      ctx.save();
      ctx.translate(foodX + 3, foodY - 12);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(4, 0, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(foodX - 3, foodY - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      t++;
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return <canvas ref={ref} className="w-full h-full" />;
}

function PenaltyPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 400;
    const H = 250;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;
    const render = () => {
      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, '#0a1a3d');
      sky.addColorStop(0.5, '#0f2a5c');
      sky.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H * 0.55);

      // Stars
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 7919) % 1000) / 1000 * W;
        const sy = ((i * 1979) % 1000) / 1000 * H * 0.4;
        const sp = 0.3 + 0.7 * Math.abs(Math.sin(t / 40 + i));
        ctx.fillStyle = `rgba(255, 255, 255, ${sp * 0.8})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stadium
      ctx.fillStyle = '#0a0f1e';
      ctx.fillRect(0, H * 0.15, W, H * 0.2);
      for (let i = 0; i < 60; i++) {
        const cx = (i % 30) * (W / 30) + (W / 60);
        const cy = H * 0.2 + Math.floor(i / 30) * 10;
        const c = ['#4b5563','#6b7280','#374151','#7c3aed','#0891b2','#f59e0b'][i % 6];
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grass
      const grass = ctx.createLinearGradient(0, H * 0.55, 0, H);
      grass.addColorStop(0, '#0f5d1e');
      grass.addColorStop(0.5, '#0a4a17');
      grass.addColorStop(1, '#062a0e');
      ctx.fillStyle = grass;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);

      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(0, H * 0.55 + i * (H * 0.45 / 6), W, H * 0.45 / 6);
        }
      }

      // Goal
      const gx = W * 0.2;
      const gy = H * 0.25;
      const gw = W * 0.6;
      const gh = H * 0.35;

      // Net
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 16; i++) {
        const x = gx + (gw / 16) * i;
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke();
      }
      for (let i = 1; i < 10; i++) {
        const y = gy + (gh / 10) * i;
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
      }

      // Frame glow
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(gx, gy, gw, gh);

      // Keeper (moving side to side)
      const kp = (t % 90) / 90;
      const keeperX = gx + gw * (0.5 + Math.sin(t / 35) * 0.18);
      const keeperY = gy + gh * 0.7;
      const kSize = gh * 0.22;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(keeperX, keeperY + kSize * 0.9, kSize * 0.7, kSize * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f59e0b';
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(keeperX - kSize * 0.4, keeperY - kSize * 0.3, kSize * 0.8, kSize * 0.9, kSize * 0.15);
      ctx.fill();
      ctx.restore();

      // Head
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(keeperX, keeperY - kSize * 0.55, kSize * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // Arms
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = kSize * 0.18;
      ctx.lineCap = 'round';
      const spread = 0.6 + 0.4 * Math.abs(Math.sin(t / 20));
      ctx.beginPath();
      ctx.moveTo(keeperX - kSize * 0.4, keeperY - kSize * 0.1);
      ctx.lineTo(keeperX - kSize * 0.9 * spread, keeperY - kSize * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(keeperX + kSize * 0.4, keeperY - kSize * 0.1);
      ctx.lineTo(keeperX + kSize * 0.9 * spread, keeperY - kSize * 0.5);
      ctx.stroke();

      // Ball (flying toward goal)
      const ballP = (t % 90) / 90;
      const targetX = keeperX > gx + gw / 2 ? gx + gw * 0.3 : gx + gw * 0.7;
      const targetY = gy + gh * 0.4;
      const startX = W * 0.5;
      const startY = H * 0.9;
      const bX = startX + (targetX - startX) * ballP;
      const bY = startY + (targetY - startY) * ballP;
      const bR = 8 * (1 - ballP * 0.55);

      // Ball trail
      for (let i = 1; i < 4; i++) {
        const tp = Math.max(0, ballP - i * 0.04);
        const tx = startX + (targetX - startX) * tp;
        const ty = startY + (targetY - startY) * tp;
        ctx.fillStyle = `rgba(255,255,255,${0.4 - i * 0.1})`;
        ctx.beginPath();
        ctx.arc(tx, ty, bR * (1 - i * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }

      // Ball
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fff';
      const bg = ctx.createRadialGradient(bX - bR * 0.3, bY - bR * 0.3, 0, bX, bY, bR);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.6, '#e5e7eb');
      bg.addColorStop(1, '#6b7280');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bX, bY, bR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pattern
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(bX, bY, bR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      t++;
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return <canvas ref={ref} className="w-full h-full" />;
}

// ============================================================
// GAME CARD
// ============================================================
type GameCardProps = {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  bestScore: number | null;
  players: number;
  preview: React.ReactNode;
  accent: string;
};

function GameCard({ href, title, description, badge, icon, gradient, glowColor, bestScore, players, preview, accent }: GameCardProps) {
  return (
    <Link href={href} className="group block">
      <div className={`relative rounded-3xl overflow-hidden transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl`}
        style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.05)` }}>
        {/* Glow effect behind */}
        <div className={`absolute -inset-1 rounded-3xl blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500`}
          style={{ background: glowColor }} />

        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-slate-950">
          {/* Preview */}
          <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
            {preview}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent pointer-events-none" />

            {/* Badge top-left */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20">
              <Sparkles size={11} className={accent} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">{badge}</span>
            </div>

            {/* Best score top-right */}
            {bestScore !== null && bestScore > 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-yellow-400/40">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-xs font-bold text-yellow-300">{bestScore}</span>
              </div>
            )}

            {/* Play button hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30 backdrop-blur-[2px]">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-300`}>
                <Play size={32} className="text-white ml-1" fill="white" />
              </div>
            </div>
          </div>

          {/* Info bar */}
          <div className="p-5 md:p-6 bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xl text-white truncate">{title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{description}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-slate-500" />
                  <span className="text-slate-400"><strong className="text-white">{players}</strong> joueurs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy size={13} className="text-yellow-500" />
                  <span className="text-slate-400">Record <strong className="text-white">{bestScore || 0}</strong></span>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r ${gradient} text-white text-sm font-bold shadow-lg group-hover:scale-105 transition-transform`}>
                JOUER <Play size={12} fill="white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// PAGE HUB
// ============================================================
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
    topPlayers: [] as { name: string; score: number; game: string }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [snakeScores, penaltyScores] = await Promise.all([
        supabase.from('game_scores').select('score, user_id, created_at'),
        supabase.from('penalty_scores').select('score, user_id, created_at'),
      ]);

      const snakeList = snakeScores.data || [];
      const penaltyList = penaltyScores.data || [];

      // Top players across both games
      const allScores = [
        ...snakeList.map((s: any) => ({ user_id: s.user_id, score: s.score, game: 'Snake' })),
        ...penaltyList.map((s: any) => ({ user_id: s.user_id, score: s.score, game: 'Penalty' })),
      ];
      const bestPerUser = new Map<string, { score: number; game: string }>();
      allScores.forEach((s) => {
        const current = bestPerUser.get(s.user_id);
        if (!current || s.score > current.score) {
          bestPerUser.set(s.user_id, { score: s.score, game: s.game });
        }
      });

      // Fetch profile names
      const userIds = Array.from(bestPerUser.keys()).slice(0, 20);
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p.full_name || 'Joueur'; });
      }

      const topPlayers = Array.from(bestPerUser.entries())
        .map(([id, v]) => ({ name: profilesMap[id] || 'Joueur', score: v.score, game: v.game }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setStats({
        snakeBest: snakeList.length > 0 ? Math.max(...snakeList.map((s: any) => s.score)) : null,
        penaltyBest: penaltyList.length > 0 ? Math.max(...penaltyList.map((s: any) => s.score)) : null,
        snakePlayers: new Set(snakeList.map((s: any) => s.user_id)).size,
        penaltyPlayers: new Set(penaltyList.map((s: any) => s.user_id)).size,
        snakeTotal: snakeList.length,
        penaltyTotal: penaltyList.length,
        topPlayers,
      });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container-custom py-6 md:py-10 max-w-6xl">
        {/* Breadcrumb */}
        <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 mb-8 transition group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition" /> Retour à l'accueil
        </Link>

        {/* Hero */}
        <div className="relative mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-emerald-500/10 border border-fuchsia-500/30 mb-5">
            <Sparkles size={14} className="text-fuchsia-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">Arcade</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-emerald-500 bg-clip-text text-transparent leading-tight">
            Accins Arcade
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Sélectionne ton jeu et bats les records. Connecte-toi pour sauvegarder tes scores.
          </p>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
              <Users size={16} className="mx-auto text-cyan-500 mb-1.5" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Joueurs</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.snakePlayers + stats.penaltyPlayers}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
              <TrendingUp size={16} className="mx-auto text-fuchsia-500 mb-1.5" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Parties jouées</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.snakeTotal + stats.penaltyTotal}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
              <Trophy size={16} className="mx-auto text-yellow-500 mb-1.5" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Jeux</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">2</p>
            </div>
          </div>
        )}

        {/* Game Selection */}
        <div className="mb-4">
          <h2 className="text-center text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">
            Choisis ton jeu
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <GameCard
            href={`/${locale}/game/snake`}
            title="Snake"
            description="Le serpent néon. Mange les pommes, évite ta queue, bats les records."
            badge="Classique"
            icon={<Zap size={22} />}
            gradient="from-cyan-500 to-blue-600"
            glowColor="rgba(34, 211, 238, 0.5)"
            bestScore={stats.snakeBest}
            players={stats.snakePlayers}
            preview={<SnakePreview />}
            accent="text-cyan-400"
          />
          <GameCard
            href={`/${locale}/game/penalty`}
            title="Penalty Shootout"
            description="5 tirs au but. Trompe le gardien. Deviens le roi du penalty."
            badge="Nouveau"
            icon={<Target size={22} />}
            gradient="from-emerald-500 to-green-600"
            glowColor="rgba(16, 185, 129, 0.5)"
            bestScore={stats.penaltyBest}
            players={stats.penaltyPlayers}
            preview={<PenaltyPreview />}
            accent="text-emerald-400"
          />
        </div>

        {/* Top players */}
        {!loading && stats.topPlayers.length > 0 && (
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Top joueurs</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.topPlayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                      i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/40' :
                      i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                      'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                    }`}>
                      {i === 0 ? <Crown size={16} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.game}</p>
                    </div>
                    <p className="font-mono font-bold text-lg text-fuchsia-600 dark:text-fuchsia-400 shrink-0">{p.score}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-xs text-slate-500">
            Connecte-toi pour sauvegarder tes scores et apparaître dans le classement
          </p>
        </div>
      </div>
    </div>
  );
}