'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Play, ArrowLeft, Target, Award, Loader2, Gamepad2, Zap, Flame, Goal, Crown, RotateCcw } from 'lucide-react';

type Phase = 'ready' | 'aiming' | 'shooting' | 'keeper' | 'result' | 'done';

export default function PenaltyPage() {
  const t = useTranslations('game');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const isMobileRef = useRef(false);

  const stateRef = useRef({
    phase: 'ready' as Phase,
    ballX: 0.5,
    ballY: 0.85,
    ballScale: 1,
    targetX: 0.5,
    targetY: 0.5,
    keeperX: 0.5,
    keeperDir: 0,
    ballVelX: 0,
    ballVelY: 0,
    ballProgress: 0,
    keeperProgress: 0,
    keeperTargetX: 0.5,
    goals: 0,
    saves: 0,
    shots: 0,
    totalShots: 5,
    lastResult: '' as '' | 'goal' | 'save',
    flash: 0,
    flashColor: '255,255,255',
    shake: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; }[],
    trails: [] as { x: number; y: number; life: number; }[],
    time: 0,
  });

  const [ui, setUi] = useState({
    goals: 0, saves: 0, shots: 0, phase: 'ready' as Phase,
    lastResult: '' as '' | 'goal' | 'save', score: 0, best: 0,
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    isMobileRef.current = /Mobi|Android/i.test(navigator.userAgent);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const best = Number(localStorage.getItem('penalty_best') || 0);
      setUi(p => ({ ...p, best }));
      const { data } = await supabase.rpc('get_penalty_leaderboard', { limit_count: 10 });
      setLeaderboard(data || []);
    })();
  }, []);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = w * 0.7;
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const start = () => {
    const s = stateRef.current;
    s.phase = 'aiming';
    s.goals = 0; s.saves = 0; s.shots = 0;
    s.lastResult = '';
    s.flash = 0; s.shake = 0;
    s.particles = []; s.trails = [];
    resetShot();
    setUi(p => ({ ...p, goals: 0, saves: 0, shots: 0, phase: 'aiming', lastResult: '', score: 0 }));
    setSaved(false);
  };

  const resetShot = () => {
    const s = stateRef.current;
    s.ballX = 0.5; s.ballY = 0.85; s.ballScale = 1;
    s.ballProgress = 0;
    s.keeperProgress = 0;
    s.keeperX = 0.5;
    s.ballVelX = 0; s.ballVelY = 0;
    s.trails = [];
  };

  const aimAt = (nx: number, ny: number) => {
    const s = stateRef.current;
    if (s.phase !== 'aiming') return;
    s.targetX = Math.max(0.15, Math.min(0.85, nx));
    s.targetY = Math.max(0.25, Math.min(0.6, ny));
  };

  const shoot = () => {
    const s = stateRef.current;
    if (s.phase !== 'aiming') return;
    s.phase = 'shooting';
    s.ballProgress = 0;
    s.ballVelX = (s.targetX - s.ballX) * 0.08;
    s.ballVelY = (s.targetY - s.ballY) * 0.08;
    // Keeper picks random direction, biased slightly toward target
    const bias = Math.random() < 0.35 ? s.targetX : (0.2 + Math.random() * 0.6);
    s.keeperTargetX = Math.max(0.2, Math.min(0.8, bias));
    setUi(p => ({ ...p, phase: 'shooting' }));
  };

  const onResult = (result: 'goal' | 'save') => {
    const s = stateRef.current;
    s.lastResult = result;
    s.phase = 'result';
    if (result === 'goal') {
      s.goals++; s.flash = 0.5; s.flashColor = '34,197,94';
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 6;
        s.particles.push({ x: 0.5, y: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 50, maxLife: 50, color: ['#fbbf24','#22c55e','#f43f5e','#3b82f6'][Math.floor(Math.random()*4)] });
      }
    } else {
      s.saves++; s.flash = 0.4; s.flashColor = '239,68,68'; s.shake = 8;
    }
    s.shots++;
    setUi(p => ({ ...p, goals: s.goals, saves: s.saves, shots: s.shots, phase: 'result', lastResult: result }));

    setTimeout(() => {
      if (s.shots >= s.totalShots) {
        s.phase = 'done';
        setUi(p => ({ ...p, phase: 'done' }));
        finish(s);
      } else {
        resetShot();
        s.phase = 'aiming';
        setUi(p => ({ ...p, phase: 'aiming', lastResult: '' }));
      }
    }, 1400);
  };

  const finish = async (s: any) => {
    const score = s.goals * 100;
    const isBest = score > Number(localStorage.getItem('penalty_best') || 0);
    if (isBest) localStorage.setItem('penalty_best', String(score));
    setUi(p => ({ ...p, score, best: isBest ? score : p.best }));
    if (user && s.goals > 0) {
      await supabase.from('penalty_scores').insert({ user_id: user.id, score, goals: s.goals, saves: s.saves });
      const { data } = await supabase.rpc('get_penalty_leaderboard', { limit_count: 10 });
      setLeaderboard(data || []);
      setSaved(true);
    }
  };

  // Click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (s.phase === 'aiming') {
      aimAt(nx, ny);
      setTimeout(shoot, 100);
    }
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const nx = (touch.clientX - rect.left) / rect.width;
    const ny = (touch.clientY - rect.top) / rect.height;
    if (s.phase === 'aiming') {
      aimAt(nx, ny);
      setTimeout(shoot, 100);
    }
  };

  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const s = stateRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (s.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      s.shake *= 0.88;
    }

    // SKY
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    skyGrad.addColorStop(0, '#0a1a3d');
    skyGrad.addColorStop(0.5, '#0f2a5c');
    skyGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 7919) % 1000) / 1000 * W;
      const sy = ((i * 1979) % 1000) / 1000 * H * 0.4;
      const sp = 0.3 + 0.7 * Math.abs(Math.sin(time / 800 + i));
      ctx.fillStyle = `rgba(255, 255, 255, ${sp * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // STADIUM (crowd stands)
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, H * 0.15, W, H * 0.15);
    // Crowd dots
    for (let i = 0; i < 80; i++) {
      const cx = (i % 40) * (W / 40) + (W / 80);
      const cy = H * 0.18 + Math.floor(i / 40) * 8;
      const c = ['#4b5563','#6b7280','#374151','#7c3aed','#0891b2'][i % 5];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // GRASS
    const grassGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    grassGrad.addColorStop(0, '#0f5d1e');
    grassGrad.addColorStop(0.5, '#0a4a17');
    grassGrad.addColorStop(1, '#062a0e');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Grass stripes
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, H * 0.55 + i * (H * 0.45 / 8), W, H * 0.45 / 8);
      }
    }

    // GOAL (perspective)
    const goalX = W * 0.18;
    const goalY = H * 0.22;
    const goalW = W * 0.64;
    const goalH = H * 0.35;

    // Goal net
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    // Frame
    ctx.strokeRect(goalX, goalY, goalW, goalH);
    // Vertical net lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 20; i++) {
      const x = goalX + (goalW / 20) * i;
      ctx.beginPath(); ctx.moveTo(x, goalY); ctx.lineTo(x, goalY + goalH); ctx.stroke();
    }
    for (let i = 1; i < 12; i++) {
      const y = goalY + (goalH / 12) * i;
      ctx.beginPath(); ctx.moveTo(goalX, y); ctx.lineTo(goalX + goalW, y); ctx.stroke();
    }

    // Goal frame glow
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(goalX, goalY, goalW, goalH);

    // KEEPER
    const kp = s.phase === 'shooting' || s.phase === 'result' ? s.keeperProgress : 0;
    const currentKeeperX = s.phase === 'result' ? s.keeperTargetX : (0.5 + (s.keeperTargetX - 0.5) * kp);
    const kx = goalX + currentKeeperX * goalW;
    const ky = goalY + goalH * 0.6;
    const kSize = goalH * 0.22;

    // Keeper shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(kx, ky + kSize * 0.9, kSize * 0.7, kSize * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Keeper body
    ctx.save();
    if (!isMobileRef.current) { ctx.shadowBlur = 15; ctx.shadowColor = '#f59e0b'; }
    // Body
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(kx - kSize * 0.4, ky - kSize * 0.3, kSize * 0.8, kSize * 0.9, kSize * 0.15);
    ctx.fill();
    // Head
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(kx, ky - kSize * 0.55, kSize * 0.32, 0, Math.PI * 2);
    ctx.fill();
    // Arms (depending on phase)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = kSize * 0.18;
    ctx.lineCap = 'round';
    const armSpread = s.phase === 'shooting' || s.phase === 'result' ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(kx - kSize * 0.4, ky - kSize * 0.1);
    ctx.lineTo(kx - kSize * 0.9 * armSpread, ky - kSize * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(kx + kSize * 0.4, ky - kSize * 0.1);
    ctx.lineTo(kx + kSize * 0.9 * armSpread, ky - kSize * 0.5);
    ctx.stroke();
    ctx.restore();

    // TRAILS
    s.trails = s.trails.filter(tr => {
      tr.life--;
      if (tr.life <= 0) return false;
      const alpha = tr.life / 20;
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(tr.x * W, tr.y * H, 3 * alpha, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // BALL
    let ballPx = s.ballX;
    let ballPy = s.ballY;
    let ballR = W * 0.025;

    if (s.phase === 'shooting') {
      s.ballProgress += 0.025;
      if (s.ballProgress >= 1) s.ballProgress = 1;
      const tp = s.ballProgress;
      ballPx = s.ballX + (s.targetX - s.ballX) * tp;
      ballPy = s.ballY + (s.targetY - s.ballY) * tp;
      ballR = W * 0.025 * (1 - tp * 0.5);
      s.trails.push({ x: ballPx, y: ballPy, life: 20 });

      // Keeper moves
      s.keeperProgress = Math.min(1, s.keeperProgress + 0.03);

      if (tp >= 1) {
        // Result check
        const keeperReachX = 0.12;
        const isSaved = Math.abs(s.targetX - currentKeeperX) < keeperReachX && Math.random() < 0.75;
        setTimeout(() => onResult(isSaved ? 'save' : 'goal'), 50);
      }
    } else if (s.phase === 'result') {
      ballPx = s.targetX;
      ballPy = s.targetY;
      ballR = W * 0.0125;
    }

    const bx = ballPx * W;
    const by = ballPy * H;

    // Ball shadow (only in aiming phase)
    if (s.phase === 'aiming' || s.phase === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(bx, by + ballR * 1.5, ballR * 1.1, ballR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball
    ctx.save();
    if (!isMobileRef.current) { ctx.shadowBlur = 20; ctx.shadowColor = '#ffffff'; }
    const ballGrad = ctx.createRadialGradient(bx - ballR * 0.4, by - ballR * 0.4, ballR * 0.1, bx, by, ballR);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.6, '#e5e7eb');
    ballGrad.addColorStop(1, '#6b7280');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(bx, by, ballR, 0, Math.PI * 2);
    ctx.fill();
    // Pentagon patches (soccer ball pattern)
    ctx.fillStyle = '#111827';
    const patches = s.ballProgress > 0 ? 1 : 5;
    for (let i = 0; i < patches; i++) {
      const a = (i / patches) * Math.PI * 2 + (s.ballProgress * 8);
      const px = bx + Math.cos(a) * ballR * 0.5;
      const py = by + Math.sin(a) * ballR * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, ballR * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // TARGET RETICLE (aiming)
    if (s.phase === 'aiming') {
      const tx = s.targetX * W;
      const ty = s.targetY * H;
      const pulse = 1 + Math.sin(time / 150) * 0.15;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 14 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 22 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(tx - 30, ty); ctx.lineTo(tx - 8, ty);
      ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + 30, ty);
      ctx.moveTo(tx, ty - 30); ctx.lineTo(tx, ty - 8);
      ctx.moveTo(tx, ty + 8); ctx.lineTo(tx, ty + 30);
      ctx.stroke();
    }

    // PARTICLES
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x = p.x + p.vx / W;
      p.y = p.y + p.vy / H;
      p.vy += 0.2 / H;
      p.life--;
      if (p.life <= 0) { s.particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 3 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // RESULT BANNER
    if (s.phase === 'result' && s.lastResult) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `bold ${Math.min(W * 0.12, 80)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (s.lastResult === 'goal') {
        ctx.fillStyle = '#22c55e';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#22c55e';
        ctx.fillText('BUT !', W / 2, H / 2);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ef4444';
        ctx.fillText('ARRÊTÉ !', W / 2, H / 2);
      }
      ctx.shadowBlur = 0;
    }

    // FLASH
    if (s.flash > 0.01) {
      ctx.fillStyle = `rgba(${s.flashColor}, ${s.flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
      s.flash *= 0.9;
    }
  };

  useEffect(() => {
    let alive = true;
    const loop = (time: number) => {
      if (!alive) return;
      render(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}/game`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 mb-6 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 bg-clip-text text-transparent flex items-center gap-3">
            <Target className="text-emerald-500" size={32} /> Penalty
          </h1>
          <p className="text-slate-500 mt-1">5 tirs. Cliquez où vous voulez tirer.</p>
        </div>
        <Link href={`/${locale}/game`} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:opacity-90 transition">
          <Gamepad2 size={18} /> Snake
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-emerald-900/50 bg-slate-950 overflow-hidden shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Buts</p>
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent leading-none mt-1">{ui.goals} / {ui.shots}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Record</p>
                <p className="text-lg md:text-xl font-bold text-yellow-400 leading-none mt-1">{ui.best}</p>
              </div>
              <button onClick={start} className="px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-emerald-500/40">
                {ui.phase === 'ready' ? <Play size={16} /> : <RotateCcw size={16} />}
                <span className="hidden sm:inline">{ui.phase === 'ready' ? 'Jouer' : 'Restart'}</span>
              </button>
            </div>

            <div ref={containerRef} className="relative w-full bg-slate-950">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onTouchStart={handleTouch}
                className="absolute inset-0 w-full h-full touch-none select-none cursor-crosshair"
              />

              {ui.phase === 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm text-white text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/40">
                    <Target size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Penalty Shootout</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">5 tirs. Clique dans le but pour marquer. Le gardien est prêt.</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center gap-2">
                    <Play size={20} /> Commencer
                  </button>
                </div>
              )}

              {ui.phase === 'done' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm text-white text-center p-4">
                  {ui.goals >= 4 ? (
                    <>
                      <Award size={56} className="text-yellow-400 mb-3 animate-pulse" />
                      <h2 className="text-2xl font-bold mb-1 text-yellow-400">EXCELLENT !</h2>
                    </>
                  ) : (
                    <>
                      <Trophy size={56} className="text-yellow-400 mb-3" />
                      <h2 className="text-2xl font-bold mb-1">Terminé !</h2>
                    </>
                  )}
                  <p className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-2">{ui.goals}/{ui.shots}</p>
                  <p className="text-lg text-slate-400 mb-1">{ui.score} points</p>
                  {saved && <p className="text-xs text-green-400 mb-2 font-medium">✓ Score sauvegardé</p>}
                  <button onClick={start} className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center gap-2">
                    <RotateCcw size={18} /> Rejouer
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400">
              {ui.phase === 'aiming' && 'Clique où tu veux tirer'}
              {ui.phase === 'shooting' && 'Le ballon vole...'}
              {ui.phase === 'result' && (ui.lastResult === 'goal' ? '⚽ But !' : '🧤 Arrêté !')}
              {ui.phase === 'ready' && 'Clique sur Jouer pour commencer'}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" /> Classement
            </h2>
            {!user ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-3">Connecte-toi pour sauvegarder tes scores</p>
                <Link href={`/${locale}/login`} className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">Connexion</Link>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Aucun score enregistré</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.full_name || 'Joueur'}</p>
                      <p className="text-[10px] text-slate-500">{entry.goals} buts</p>
                    </div>
                    <p className="font-mono font-bold text-emerald-600 text-sm shrink-0">{entry.score}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}