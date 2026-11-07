'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap, Crown, Pause, Award, Flame, Star, Volume2, VolumeX } from 'lucide-react';
import { initAudio, playEat, playCombo, playGameOver, setMuted, isMuted } from '@/lib/game-audio';

const GRID = 22;
const TICK_BASE = 155;
const TICK_MIN = 75;
const COMBO_WINDOW = 2200;

type Seg = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number; };
type Popup = { x: number; y: number; text: string; life: number; maxLife: number; hue: number; };
type FoodType = 'apple' | 'golden' | 'bonus';
type Food = { x: number; y: number; type: FoodType; bornAt: number; };

export default function SnakePage() {
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const accumRef = useRef(0);
  const lastRef = useRef(0);
  const isMobileRef = useRef(false);
  const bgCacheRef = useRef<HTMLCanvasElement | null>(null);
  const [muteState, setMuteState] = useState(false);

  const S = useRef({
    snake: [{ x: 11, y: 11 }] as Seg[],
    prevSnake: [{ x: 11, y: 11 }] as Seg[],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 11, type: 'apple' as FoodType, bornAt: 0 } as Food,
    score: 0, combo: 1, lastEatAt: 0,
    running: false, gameOver: false, paused: false,
    tick: TICK_BASE, tickProgress: 0,
    particles: [] as Particle[], popups: [] as Popup[],
    shake: 0, flash: 0, flashHue: 180,
    justWrapped: false, eaten: 0,
  });

  const [ui, setUi] = useState({ score: 0, best: 0, combo: 1, running: false, gameOver: false, paused: false, newRecord: false });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    isMobileRef.current = /Mobi|Android/i.test(navigator.userAgent);
    const init = () => initAudio();
    document.addEventListener('pointerdown', init, { once: true });
    setMuteState(isMuted());
    return () => document.removeEventListener('pointerdown', init);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUi(p => ({ ...p, best: Number(localStorage.getItem('snake_best') || 0) }));
      const { data } = await supabase.rpc('get_leaderboard', { limit_count: 10 });
      setLeaderboard(data || []);
    })();
  }, []);

  const buildBg = (size: number) => {
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const c = document.createElement('canvas');
    c.width = size * dpr; c.height = size * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(size * 0.3, size * 0.3, 0, size / 2, size / 2, size);
    bg.addColorStop(0, '#0f3831'); bg.addColorStop(0.4, '#0a2a2a'); bg.addColorStop(0.7, '#061a1e'); bg.addColorStop(1, '#020617');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    const cell = size / GRID;
    g.strokeStyle = 'rgba(34, 211, 238, 0.05)'; g.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, size); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(size, i * cell); g.stroke();
    }
    bgCacheRef.current = c;
  };

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current, container = containerRef.current;
      if (!canvas || !container) return;
      const size = container.clientWidth;
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = size * dpr; canvas.height = size * dpr;
      canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
      buildBg(size);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const placeFood = () => {
    const s = S.current;
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (s.snake.some(sp => sp.x === p.x && sp.y === p.y)) continue;
      const r = Math.random();
      const type: FoodType = r < 0.08 ? 'bonus' : r < 0.23 ? 'golden' : 'apple';
      return { ...p, type, bornAt: performance.now() };
    }
  };

  const spawn = (cx: number, cy: number, count: number, hue: number) => {
    const s = S.current;
    const cap = isMobileRef.current ? 35 : 60;
    if (s.particles.length > cap) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      s.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30 + Math.random() * 25, maxLife: 55, size: 1.5 + Math.random() * 2.5, hue: hue + (Math.random() * 40 - 20) });
    }
  };

  const step = () => {
    const s = S.current;
    s.dir = s.nextDir;
    let h = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    let wrapped = false;
    if (h.x < 0) { h.x = GRID - 1; wrapped = true; } else if (h.x >= GRID) { h.x = 0; wrapped = true; }
    if (h.y < 0) { h.y = GRID - 1; wrapped = true; } else if (h.y >= GRID) { h.y = 0; wrapped = true; }
    if (s.snake.slice(0, -1).some(p => p.x === h.x && p.y === h.y)) return endGame();
    s.snake.unshift(h);
    if (h.x === s.food.x && h.y === s.food.y) {
      const now = performance.now();
      s.combo = now - s.lastEatAt < COMBO_WINDOW ? Math.min(s.combo + 1, 9) : 1;
      s.lastEatAt = now;
      let base = 10;
      let hue = 350;
      if (s.food.type === 'golden') { base = 30; hue = 45; }
      else if (s.food.type === 'bonus') { base = 50; hue = 280; }
      const gained = base * s.combo;
      s.score += gained;
      s.eaten++;
      s.tick = Math.max(TICK_MIN, s.tick - 2.5);
      s.shake = s.food.type === 'bonus' ? 6 : 3;
      s.flash = 0.25;
      s.flashHue = hue;
      const canvas = canvasRef.current!;
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      const size = canvas.width / dpr, cell = size / GRID;
      const cx = s.food.x * cell + cell / 2, cy = s.food.y * cell + cell / 2;
      spawn(cx, cy, s.food.type === 'bonus' ? 22 : 14, hue);
      s.popups.push({ x: cx, y: cy, text: `+${gained}${s.combo > 1 ? ' x' + s.combo : ''}`, life: 55, maxLife: 55, hue });
      if (s.combo > 1) playCombo(s.combo); else playEat(s.food.type === 'golden' ? 1.4 : s.food.type === 'bonus' ? 1.8 : 1);
      s.food = placeFood();
      setUi(p => ({ ...p, score: s.score, combo: s.combo }));
    } else {
      s.snake.pop();
    }
    s.justWrapped = wrapped;
  };

  const endGame = () => {
    const s = S.current;
    s.running = false; s.gameOver = true; s.shake = 14; s.flash = 0.6; s.flashHue = 0;
    playGameOver();
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
    const s = S.current;
    s.snake = [{ x: 11, y: 11 }]; s.prevSnake = [{ x: 11, y: 11 }];
    s.dir = { x: 1, y: 0 }; s.nextDir = { x: 1, y: 0 };
    s.food = placeFood();
    s.score = 0; s.combo = 1; s.lastEatAt = 0; s.eaten = 0;
    s.tick = TICK_BASE; s.tickProgress = 0;
    s.particles = []; s.popups = [];
    s.shake = 0; s.flash = 0;
    s.running = true; s.gameOver = false; s.paused = false; s.justWrapped = false;
    accumRef.current = 0;
    setUi(p => ({ ...p, score: 0, combo: 1, running: true, gameOver: false, paused: false, newRecord: false }));
    setSaved(false);
  };

  const togglePause = () => {
    const s = S.current;
    if (!s.running) return;
    s.paused = !s.paused;
    setUi(p => ({ ...p, paused: s.paused }));
  };

  const toggleMute = () => {
    const m = !isMuted();
    setMuted(m);
    setMuteState(m);
  };

  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const size = canvas.width / dpr, cell = size / GRID;
    const s = S.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (s.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      s.shake *= 0.85;
    }

    if (bgCacheRef.current) ctx.drawImage(bgCacheRef.current, 0, 0, size, size);
    else { ctx.fillStyle = '#0a2a2a'; ctx.fillRect(0, 0, size, size); }

    // FOOD
    const fx = s.food.x * cell + cell / 2, fy = s.food.y * cell + cell / 2;
    const pulse = 1 + Math.sin(time / 200) * 0.1;
    let foodR = cell * 0.4 * pulse;
    let foodHue = 0;
    if (s.food.type === 'apple') foodHue = 0;
    else if (s.food.type === 'golden') foodHue = 45;
    else foodHue = 280;

    // Food aura
    if (!isMobileRef.current) { ctx.shadowBlur = 25; ctx.shadowColor = `hsl(${foodHue}, 100%, 60%)`; }
    const fg = ctx.createRadialGradient(fx - foodR * 0.35, fy - foodR * 0.35, foodR * 0.05, fx, fy, foodR);
    fg.addColorStop(0, `hsl(${foodHue}, 100%, 90%)`);
    fg.addColorStop(0.4, `hsl(${foodHue}, 95%, 60%)`);
    fg.addColorStop(0.75, `hsl(${foodHue}, 90%, 40%)`);
    fg.addColorStop(1, `hsl(${foodHue}, 80%, 20%)`);
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fx, fy, foodR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Star for bonus
    if (s.food.type === 'bonus') {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(time / 500);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        ctx.lineTo(Math.cos(a1) * foodR * 0.7, Math.sin(a1) * foodR * 0.7);
        ctx.lineTo(Math.cos(a2) * foodR * 0.3, Math.sin(a2) * foodR * 0.3);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // Leaf
      ctx.fillStyle = '#22c55e';
      ctx.save();
      ctx.translate(fx + foodR * 0.15, fy - foodR * 0.95);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, foodR * 0.35, foodR * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // SNAKE
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

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        const r = cell * (0.4 - 0.22 * t);
        ctx.beginPath();
        ctx.arc(pts[i].x + 2, pts[i].y + 3, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Body
      for (let i = pts.length - 1; i >= 1; i--) {
        const t = i / pts.length;
        const r = cell * (0.44 - 0.24 * t);
        const hue = 190 + t * 110;
        const sat = 95 - t * 20;
        const lig = 60 - t * 22;
        if (!isMobileRef.current && i < 6) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        }
        const bg2 = ctx.createRadialGradient(pts[i].x - r * 0.3, pts[i].y - r * 0.3, 0, pts[i].x, pts[i].y, r);
        bg2.addColorStop(0, `hsl(${hue}, ${sat}%, ${lig + 15}%)`);
        bg2.addColorStop(1, `hsl(${hue}, ${sat}%, ${lig}%)`);
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Head
      const head = pts[0];
      const hs = cell * 0.55;
      const angle = Math.atan2(s.dir.y, s.dir.x);
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(angle);
      if (!isMobileRef.current) { ctx.shadowBlur = 18; ctx.shadowColor = '#22d3ee'; }
      const hg = ctx.createRadialGradient(-hs * 0.3, -hs * 0.3, 0, 0, 0, hs * 1.1);
      hg.addColorStop(0, '#a5f3fc');
      hg.addColorStop(0.5, '#22d3ee');
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
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(hs * 0.5, -hs * 0.6, hs * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hs * 0.5, hs * 0.5, hs * 0.06, 0, Math.PI * 2); ctx.fill();

      // Tongue
      if (time % 1500 < 250) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hs * 1.05, 0); ctx.lineTo(hs * 1.5, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs * 1.5, 0); ctx.lineTo(hs * 1.65, -hs * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hs * 1.5, 0); ctx.lineTo(hs * 1.65, hs * 0.15); ctx.stroke();
      }
      ctx.restore();
    }

    // Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.96; p.vy *= 0.96;
      p.life--;
      if (p.life <= 0) { s.particles.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
      if (!isMobileRef.current) { ctx.shadowBlur = 8; ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Popups
    for (let i = s.popups.length - 1; i >= 0; i--) {
      const p = s.popups[i];
      p.y -= 0.8; p.life--;
      if (p.life <= 0) { s.popups.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.font = `bold ${Math.min(cell * 0.9, 22)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
      if (!isMobileRef.current) { ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`; }
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Flash
    if (s.flash > 0.01) {
      ctx.fillStyle = `hsla(${s.flashHue}, 100%, 60%, ${s.flash * 0.25})`;
      ctx.fillRect(-20, -20, size + 40, size + 40);
      s.flash *= 0.9;
    }
  };

  useEffect(() => {
    let alive = true;
    lastRef.current = performance.now();
    accumRef.current = 0;
    const loop = (now: number) => {
      if (!alive) return;
      const s = S.current;
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
    const h = (e: KeyboardEvent) => {
      const s = S.current;
      if (!s.running) return;
      const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)) e.preventDefault();
      if ((k === 'arrowup' || k === 'w') && s.dir.y === 0) s.nextDir = { x: 0, y: -1 };
      if ((k === 'arrowdown' || k === 's') && s.dir.y === 0) s.nextDir = { x: 0, y: 1 };
      if ((k === 'arrowleft' || k === 'a') && s.dir.x === 0) s.nextDir = { x: -1, y: 0 };
      if ((k === 'arrowright' || k === 'd') && s.dir.x === 0) s.nextDir = { x: 1, y: 0 };
      if (k === ' ') togglePause();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const s = S.current;
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
  const dpad = (d: { x: number; y: number }) => {
    const s = S.current;
    if (!s.running) return;
    if (d.x !== 0 && s.dir.x === 0) s.nextDir = d;
    if (d.y !== 0 && s.dir.y === 0) s.nextDir = d;
  };

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <Link href={`/${locale}/game`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 transition group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition" /> Hub
        </Link>
        <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          {muteState ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Score</p>
                <p className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">{ui.score}</p>
              </div>
              {ui.combo > 1 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40">
                  <Flame size={14} /><span className="text-sm font-bold">x{ui.combo}</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Record</p>
                <p className="text-lg font-bold text-yellow-400">{ui.best}</p>
              </div>
              <div className="flex gap-2">
                {ui.running && <button onClick={togglePause} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"><Pause size={18} /></button>}
                <button onClick={start} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-cyan-500/40">
                  {ui.running ? <RotateCcw size={16} /> : <Play size={16} />}
                  <span className="hidden sm:inline">{ui.running ? 'Restart' : 'Jouer'}</span>
                </button>
              </div>
            </div>

            <div ref={containerRef} className="relative aspect-square w-full bg-slate-950">
              <canvas ref={canvasRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="absolute inset-0 w-full h-full touch-none select-none" />

              {!ui.running && !ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur text-white text-center p-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-2xl shadow-cyan-500/40">
                    <Zap size={36} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Snake</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">Mange les pommes, évite ta queue. Pomme dorée = 30 pts · Étoile = 50 pts</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/40 flex items-center gap-2">
                    <Play size={20} /> Jouer
                  </button>
                </div>
              )}

              {ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur text-white text-center p-4">
                  {ui.newRecord ? (<><Award size={64} className="text-yellow-400 mb-3 animate-pulse" /><h2 className="text-2xl font-bold text-yellow-400 mb-1">NOUVEAU RECORD !</h2></>) :
                    (<><Trophy size={64} className="text-yellow-400 mb-3" /><h2 className="text-2xl font-bold mb-1">Game Over</h2></>)}
                  <p className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent mb-3">{ui.score}</p>
                  {saved && <p className="text-xs text-green-400 mb-2">✓ Score sauvegardé</p>}
                  <div className="flex gap-2 mt-2">
                    <Link href={`/${locale}/game`} className="px-6 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition flex items-center gap-2">
                      <ArrowLeft size={16} /> Hub
                    </Link>
                    <button onClick={start} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/40 flex items-center gap-2">
                      <RotateCcw size={16} /> Rejouer
                    </button>
                  </div>
                </div>
              )}

              {ui.paused && ui.running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur">
                  <Pause size={48} className="text-white mb-3" />
                  <p className="text-white text-2xl font-bold mb-4">Pause</p>
                  <button onClick={togglePause} className="px-6 py-2 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-200 transition">Reprendre</button>
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
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Classement</h2>
            {!user ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-3">Connecte-toi pour sauvegarder</p>
                <Link href={`/${locale}/login`} className="inline-block bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 transition">Connexion</Link>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Aucun score</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((e: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</div>
                    <p className="flex-1 text-sm font-medium truncate">{e.full_name || 'Joueur'}</p>
                    <p className="font-mono font-bold text-cyan-600 text-sm">{e.score}</p>
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