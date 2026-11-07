'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap, Crown, Pause, Gamepad2, Award, Flame } from 'lucide-react';

const GRID = 22;
const TICK_BASE = 155;
const TICK_MIN = 70;
const COMBO_WINDOW = 2200;

type Segment = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; };
type ScorePopup = { x: number; y: number; text: string; life: number; maxLife: number; color: string; };
type Firefly = { x: number; y: number; phase: number; vx: number; vy: number; };

export default function GamePage() {
  const t = useTranslations('game');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const accumRef = useRef(0);
  const lastRef = useRef(0);
  const firefliesRef = useRef<Firefly[]>([]);
  const isMobileRef = useRef(false);
  const bgCacheRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef({
    snake: [{ x: 11, y: 11 }] as Segment[],
    prevSnake: [{ x: 11, y: 11 }] as Segment[],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 11 },
    score: 0,
    combo: 1,
    lastEatAt: 0,
    running: false,
    gameOver: false,
    paused: false,
    tick: TICK_BASE,
    tickProgress: 0,
    particles: [] as Particle[],
    popups: [] as ScorePopup[],
    shake: 0,
    flash: 0,
    flashColor: '255,255,255',
    justWrapped: false,
  });

  const [ui, setUi] = useState({ score: 0, best: 0, combo: 1, running: false, gameOver: false, paused: false, newRecord: false });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    isMobileRef.current = /Mobi|Android/i.test(navigator.userAgent);
    firefliesRef.current = Array.from({ length: 8 }, () => ({
      x: Math.random(), y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
    }));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const best = Number(localStorage.getItem('snake_best') || 0);
      setUi(p => ({ ...p, best }));
      const { data } = await supabase.rpc('get_leaderboard', { limit_count: 10 });
      setLeaderboard(data || []);
    })();
  }, []);

  const buildBgCache = (size: number) => {
    const cache = document.createElement('canvas');
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    cache.width = size * dpr;
    cache.height = size * dpr;
    const c = cache.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = c.createRadialGradient(size * 0.3, size * 0.3, 0, size / 2, size / 2, size);
    bg.addColorStop(0, '#0f3831');
    bg.addColorStop(0.4, '#0a2a2a');
    bg.addColorStop(0.7, '#061a1e');
    bg.addColorStop(1, '#020617');
    c.fillStyle = bg;
    c.fillRect(0, 0, size, size);

    const cell = size / GRID;
    c.strokeStyle = 'rgba(34, 211, 238, 0.05)';
    c.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      c.beginPath(); c.moveTo(i * cell, 0); c.lineTo(i * cell, size); c.stroke();
      c.beginPath(); c.moveTo(0, i * cell); c.lineTo(size, i * cell); c.stroke();
    }
    bgCacheRef.current = cache;
  };

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const size = container.clientWidth;
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      buildBgCache(size);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const randomFood = () => {
    const s = stateRef.current;
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!s.snake.some(sp => sp.x === p.x && sp.y === p.y)) return p;
    }
  };

  const spawnParticles = (cx: number, cy: number, count: number, color: string) => {
    const s = stateRef.current;
    const cap = isMobileRef.current ? 30 : 50;
    if (s.particles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      s.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 25 + Math.random() * 25, maxLife: 50,
        size: 1.5 + Math.random() * 2.5, color,
      });
    }
  };

  const step = () => {
    const s = stateRef.current;
    s.dir = s.nextDir;
    let head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    let wrapped = false;
    if (head.x < 0) { head.x = GRID - 1; wrapped = true; }
    else if (head.x >= GRID) { head.x = 0; wrapped = true; }
    if (head.y < 0) { head.y = GRID - 1; wrapped = true; }
    else if (head.y >= GRID) { head.y = 0; wrapped = true; }

    if (s.snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y)) return endGame();

    s.snake.unshift(head);

    if (head.x === s.food.x && head.y === s.food.y) {
      const now = performance.now();
      s.combo = now - s.lastEatAt < COMBO_WINDOW ? Math.min(s.combo + 1, 9) : 1;
      s.lastEatAt = now;
      const gained = 10 * s.combo;
      s.score += gained;
      s.tick = Math.max(TICK_MIN, s.tick - 2.5);
      s.shake = 3;
      s.flash = 0.3;

      const canvas = canvasRef.current!;
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      const size = canvas.width / dpr;
      const cell = size / GRID;
      spawnParticles(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, 12, '#f43f5e');
      s.popups.push({ x: s.food.x * cell + cell / 2, y: s.food.y * cell + cell / 2, text: `+${gained}${s.combo > 1 ? ' x' + s.combo : ''}`, life: 50, maxLife: 50, color: '#fbbf24' });

      s.food = randomFood();
      setUi(p => ({ ...p, score: s.score, combo: s.combo }));
    } else {
      s.snake.pop();
    }
    s.justWrapped = wrapped;
  };

  const endGame = () => {
    const s = stateRef.current;
    s.running = false; s.gameOver = true; s.shake = 14; s.flash = 0.6; s.flashColor = '239,68,68';
    const isBest = s.score > ui.best;
    const best = isBest ? s.score : ui.best;
    if (isBest) localStorage.setItem('snake_best', String(best));
    setUi(p => ({ ...p, gameOver: true, running: false, best, newRecord: isBest }));
    if (user && s.score > 0) saveScore(s.score);
  };

  const saveScore = async (score: number) => {
    await supabase.from('game_scores').insert({ user_id: user.id, score });
    const { data } = await supabase.rpc('get_leaderboard', { limit_count: 10 });
    setLeaderboard(data || []);
    setSaved(true);
  };

  const start = () => {
    const s = stateRef.current;
    s.snake = [{ x: 11, y: 11 }]; s.prevSnake = [{ x: 11, y: 11 }];
    s.dir = { x: 1, y: 0 }; s.nextDir = { x: 1, y: 0 };
    s.food = randomFood(); s.score = 0; s.combo = 1; s.lastEatAt = 0;
    s.tick = TICK_BASE; s.tickProgress = 0;
    s.particles = []; s.popups = []; s.shake = 0; s.flash = 0;
    s.running = true; s.gameOver = false; s.paused = false; s.justWrapped = false;
    accumRef.current = 0;
    setUi(p => ({ ...p, score: 0, combo: 1, running: true, gameOver: false, paused: false, newRecord: false }));
    setSaved(false);
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (!s.running) return;
    s.paused = !s.paused;
    setUi(p => ({ ...p, paused: s.paused }));
  };

  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const size = canvas.width / dpr;
    const cell = size / GRID;
    const s = stateRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (s.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      s.shake *= 0.85;
    }

    if (bgCacheRef.current) ctx.drawImage(bgCacheRef.current, 0, 0, size, size);
    else { ctx.fillStyle = '#0a2a2a'; ctx.fillRect(0, 0, size, size); }

    // Fireflies (réduits sur mobile)
    const ffCount = isMobileRef.current ? 4 : 8;
    for (let i = 0; i < Math.min(ffCount, firefliesRef.current.length); i++) {
      const f = firefliesRef.current[i];
      f.x += f.vx; f.y += f.vy;
      if (f.x < 0.02 || f.x > 0.98) f.vx *= -1;
      if (f.y < 0.02 || f.y > 0.98) f.vy *= -1;
      const fp = 0.4 + 0.6 * Math.abs(Math.sin(time / 500 + f.phase));
      const fx = f.x * size, fy = f.y * size;
      ctx.fillStyle = `rgba(253, 224, 71, ${fp * 0.7})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Food
    const cx = s.food.x * cell + cell / 2;
    const cy = s.food.y * cell + cell / 2;
    const pulse = 1 + Math.sin(time / 250) * 0.08;
    const r = cell * 0.4 * pulse;

    if (!isMobileRef.current) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ef4444';
    }
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    grad.addColorStop(0, '#fecaca');
    grad.addColorStop(0.4, '#f87171');
    grad.addColorStop(0.75, '#dc2626');
    grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Snake
    if (s.snake.length > 0) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < s.snake.length; i++) {
        const c = s.snake[i];
        const p = s.prevSnake[i] || c;
        if (i === 0 && s.justWrapped) {
          pts.push({ x: c.x * cell + cell / 2, y: c.y * cell + cell / 2 });
        } else {
          pts.push({ x: (p.x + (c.x - p.x) * s.tickProgress) * cell + cell / 2, y: (p.y + (c.y - p.y) * s.tickProgress) * cell + cell / 2 });
        }
      }

      for (let i = pts.length - 1; i >= 1; i--) {
        const t = i / pts.length;
        const radius = cell * (0.44 - 0.24 * t);
        const hue = 190 + t * 110;
        const sat = 95 - t * 20;
        const lig = 60 - t * 22;
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lig}%)`;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head (simplifié pour perf)
      const head = pts[0];
      const hs = cell * 0.55;
      const angle = Math.atan2(s.dir.y, s.dir.x);
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(angle);

      if (!isMobileRef.current) { ctx.shadowBlur = 15; ctx.shadowColor = '#22d3ee'; }
      const hg = ctx.createRadialGradient(-hs * 0.3, -hs * 0.3, 0, 0, 0, hs);
      hg.addColorStop(0, '#67e8f9');
      hg.addColorStop(0.6, '#22d3ee');
      hg.addColorStop(1, '#0891b2');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(0, 0, hs * 1.1, hs, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hs * 0.35, -hs * 0.55, hs * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hs * 0.35, hs * 0.55, hs * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(hs * 0.45, -hs * 0.55, hs * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hs * 0.45, hs * 0.55, hs * 0.15, 0, Math.PI * 2); ctx.fill();

      // Tongue
      if (time % 1500 < 250) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hs * 1.05, 0);
        ctx.lineTo(hs * 1.5, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Particles
    const parts = s.particles;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.97; p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Popups
    for (let i = s.popups.length - 1; i >= 0; i--) {
      const pop = s.popups[i];
      pop.y -= 0.7; pop.life--;
      if (pop.life <= 0) { s.popups.splice(i, 1); continue; }
      ctx.globalAlpha = pop.life / pop.maxLife;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    // Flash
    if (s.flash > 0.01) {
      ctx.fillStyle = `rgba(${s.flashColor}, ${s.flash * 0.3})`;
      ctx.fillRect(-20, -20, size + 40, size + 40);
      s.flash *= 0.88;
    }
  };

  useEffect(() => {
    let alive = true;
    lastRef.current = performance.now();
    accumRef.current = 0;

    const loop = (now: number) => {
      if (!alive) return;
      const s = stateRef.current;
      const dt = Math.min(now - lastRef.current, 100);
      lastRef.current = now;

      if (s.running && !s.paused) {
        accumRef.current += dt;
        let steps = 0;
        while (accumRef.current >= s.tick && steps < 2) {
          accumRef.current -= s.tick;
          s.prevSnake = s.snake.map(p => ({ ...p }));
          step();
          if (s.justWrapped) s.prevSnake[0] = { ...s.snake[0] };
          steps++;
          if (!s.running) break;
        }
        if (steps >= 2) accumRef.current = 0;
        s.tickProgress = Math.min(1, accumRef.current / s.tick);
      } else {
        s.tickProgress = 1;
      }

      if (s.running && s.lastEatAt > 0 && now - s.lastEatAt > COMBO_WINDOW && s.combo > 1) {
        s.combo = 1;
        setUi(p => ({ ...p, combo: 1 }));
      }

      render(now);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s.running) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault();
      if ((k === 'arrowup' || k === 'w') && s.dir.y === 0) s.nextDir = { x: 0, y: -1 };
      if ((k === 'arrowdown' || k === 's') && s.dir.y === 0) s.nextDir = { x: 0, y: 1 };
      if ((k === 'arrowleft' || k === 'a') && s.dir.x === 0) s.nextDir = { x: -1, y: 0 };
      if ((k === 'arrowright' || k === 'd') && s.dir.x === 0) s.nextDir = { x: 1, y: 0 };
      if (k === ' ') togglePause();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const s = stateRef.current;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && s.dir.x === 0) s.nextDir = { x: 1, y: 0 };
      else if (dx < 0 && s.dir.x === 0) s.nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 0 && s.dir.y === 0) s.nextDir = { x: 0, y: 1 };
      else if (dy < 0 && s.dir.y === 0) s.nextDir = { x: 0, y: -1 };
    }
    touchStartRef.current = null;
  };
  const dpad = (dir: { x: number; y: number }) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (dir.x !== 0 && s.dir.x === 0) s.nextDir = dir;
    if (dir.y !== 0 && s.dir.y === 0) s.nextDir = dir;
  };

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}/game`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 mb-6 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent flex items-center gap-3">
            <Gamepad2 className="text-cyan-500" size={32} /> Snake
          </h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Score</p>
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent leading-none mt-1">{ui.score}</p>
              </div>
              {ui.combo > 1 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40">
                  <Flame size={14} />
                  <span className="text-sm font-bold">x{ui.combo}</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Record</p>
                <p className="text-lg md:text-xl font-bold text-yellow-400 leading-none mt-1">{ui.best}</p>
              </div>
              <div className="flex gap-2">
                {ui.running && (
                  <button onClick={togglePause} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition" aria-label="Pause">
                    <Pause size={18} />
                  </button>
                )}
                <button onClick={start} className="px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-cyan-500/40">
                  {ui.running ? <RotateCcw size={16} /> : <Play size={16} />}
                  <span className="hidden sm:inline">{ui.running ? 'Restart' : 'Jouer'}</span>
                </button>
              </div>
            </div>

            <div ref={containerRef} className="relative aspect-square w-full bg-slate-950">
              <canvas
                ref={canvasRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="absolute inset-0 w-full h-full touch-none select-none"
              />

              {!ui.running && !ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm text-white text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/40">
                    <Zap size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{t('ready')}</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">{t('controls')}</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/40 flex items-center gap-2">
                    <Play size={20} /> {t('play')}
                  </button>
                </div>
              )}

              {ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm text-white text-center p-4">
                  {ui.newRecord ? (
                    <>
                      <Award size={56} className="text-yellow-400 mb-3 animate-pulse" />
                      <h2 className="text-2xl font-bold mb-1 text-yellow-400">NOUVEAU RECORD !</h2>
                    </>
                  ) : (
                    <>
                      <Trophy size={56} className="text-yellow-400 mb-3" />
                      <h2 className="text-2xl font-bold mb-1">{t('gameOver')}</h2>
                    </>
                  )}
                  <p className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">{ui.score}</p>
                  {saved && <p className="text-xs text-green-400 mb-2 font-medium">✓ {t('scoreSaved')}</p>}
                  <button onClick={start} className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/40 flex items-center gap-2">
                    <RotateCcw size={18} /> {t('playAgain')}
                  </button>
                </div>
              )}

              {ui.paused && ui.running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                  <Pause size={48} className="text-white mb-3" />
                  <p className="text-white text-2xl font-bold">{t('paused')}</p>
                  <button onClick={togglePause} className="mt-4 px-6 py-2 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-200 transition">Reprendre</button>
                </div>
              )}
            </div>

            <div className="lg:hidden p-4 grid grid-cols-3 gap-2 max-w-[240px] mx-auto bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
              <div />
              <button onClick={() => dpad({ x: 0, y: -1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Up"><ChevronUp size={28} /></button>
              <div />
              <button onClick={() => dpad({ x: -1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Left"><ChevronLeft size={28} /></button>
              <button onClick={() => dpad({ x: 0, y: 1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Down"><ChevronDown size={28} /></button>
              <button onClick={() => dpad({ x: 1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Right"><ChevronRight size={28} /></button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" /> {t('leaderboard')}
            </h2>
            {!user ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-3">{t('loginToSave')}</p>
                <Link href={`/${locale}/login`} className="inline-block bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 transition">{t('login')}</Link>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">{t('noScores')}</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</div>
                    <p className="flex-1 text-sm font-medium truncate">{entry.full_name || 'Joueur'}</p>
                    <p className="font-mono font-bold text-cyan-600 text-sm shrink-0">{entry.score}</p>
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