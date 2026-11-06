'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap, Crown, Pause, Gamepad2, Award } from 'lucide-react';

const GRID = 20;
const TICK_BASE = 150;
const TICK_MIN = 70;

type Segment = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number };
type Deco = { type: 'grass' | 'flower' | 'stone' | 'firefly'; x: number; y: number; color?: string; size?: number; phase?: number };

export default function GamePage() {
  const t = useTranslations('game');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const accumRef = useRef(0);
  const lastRef = useRef(0);
  const decoRef = useRef<Deco[]>([]);

  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }] as Segment[],
    prevSnake: [{ x: 10, y: 10 }] as Segment[],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
    score: 0,
    running: false,
    gameOver: false,
    paused: false,
    tick: TICK_BASE,
    tickProgress: 0,
    particles: [] as Particle[],
    shake: 0,
    justWrapped: false,
  });

  const [ui, setUi] = useState({ score: 0, best: 0, running: false, gameOver: false, paused: false, newRecord: false });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  // ======================= GARDEN DECORATIONS (once) =======================
  useEffect(() => {
    const decos: Deco[] = [];
    const flowerColors = ['#f472b6', '#facc15', '#fb923c', '#a78bfa', '#f87171', '#fde047'];
    
    // 40 grass tufts
    for (let i = 0; i < 40; i++) decos.push({ type: 'grass', x: Math.random(), y: Math.random() });
    // 14 flowers
    for (let i = 0; i < 14; i++) decos.push({ 
      type: 'flower', x: Math.random(), y: Math.random(),
      color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
    });
    // 6 stones
    for (let i = 0; i < 6; i++) decos.push({ 
      type: 'stone', x: Math.random(), y: Math.random(), 
      size: 3 + Math.random() * 3,
    });
    // 8 fireflies (glowing, animated)
    for (let i = 0; i < 8; i++) decos.push({ 
      type: 'firefly', x: Math.random(), y: Math.random(), 
      phase: Math.random() * Math.PI * 2,
    });
    
    decoRef.current = decos;
  }, []);

  // ======================= INIT =======================
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

  // ======================= RESIZE =======================
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const size = container.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ======================= HELPERS =======================
  const randomFood = () => {
    const s = stateRef.current;
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!s.snake.some(sp => sp.x === p.x && sp.y === p.y)) return p;
    }
  };

  const spawnParticles = (cx: number, cy: number) => {
    const s = stateRef.current;
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      s.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 35 + Math.random() * 25, maxLife: 60,
        size: 2 + Math.random() * 3,
        hue: 330 + Math.random() * 40,
      });
    }
  };

  const step = () => {
    const s = stateRef.current;
    s.dir = s.nextDir;
    let head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    let wrapped = false;

    // WRAP-AROUND (no more game over on walls)
    if (head.x < 0) { head.x = GRID - 1; wrapped = true; }
    else if (head.x >= GRID) { head.x = 0; wrapped = true; }
    if (head.y < 0) { head.y = GRID - 1; wrapped = true; }
    else if (head.y >= GRID) { head.y = 0; wrapped = true; }

    // Self-collision only (exclude tail because it moves)
    const bodyToCheck = s.snake.slice(0, -1);
    if (bodyToCheck.some(p => p.x === head.x && p.y === head.y)) return endGame();

    s.snake.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10;
      s.tick = Math.max(TICK_MIN, s.tick - 3);
      s.shake = 4;
      const canvas = canvasRef.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.width / dpr;
      const cell = size / GRID;
      spawnParticles(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2);
      s.food = randomFood();
      setUi(p => ({ ...p, score: s.score }));
    } else {
      s.snake.pop();
    }

    s.justWrapped = wrapped;
  };

  const endGame = () => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    s.shake = 14;
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
    s.snake = [{ x: 10, y: 10 }];
    s.prevSnake = [{ x: 10, y: 10 }];
    s.dir = { x: 1, y: 0 };
    s.nextDir = { x: 1, y: 0 };
    s.food = randomFood();
    s.score = 0;
    s.tick = TICK_BASE;
    s.tickProgress = 0;
    s.particles = [];
    s.shake = 0;
    s.running = true;
    s.gameOver = false;
    s.paused = false;
    s.justWrapped = false;
    accumRef.current = 0;
    setUi(p => ({ ...p, score: 0, running: true, gameOver: false, paused: false, newRecord: false }));
    setSaved(false);
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (!s.running) return;
    s.paused = !s.paused;
    setUi(p => ({ ...p, paused: s.paused }));
  };

  // ======================= DRAW GARDEN =======================
  const drawGarden = (ctx: CanvasRenderingContext2D, size: number, time: number) => {
    const cell = size / GRID;

    // Base radial gradient (soft garden green)
    const bg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.85);
    bg.addColorStop(0, '#86efac');
    bg.addColorStop(0.5, '#4ade80');
    bg.addColorStop(1, '#15803d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Checkerboard pattern (very subtle)
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(i * cell, j * cell, cell, cell);
        }
      }
    }

    // Grid
    ctx.strokeStyle = 'rgba(21, 128, 61, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }

    // Decorations
    for (const d of decoRef.current) {
      const x = d.x * size;
      const y = d.y * size;

      if (d.type === 'grass') {
        ctx.strokeStyle = 'rgba(21, 128, 61, 0.5)';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        for (const off of [-2, 0, 2]) {
          ctx.beginPath();
          ctx.moveTo(x + off, y + 3);
          ctx.quadraticCurveTo(x + off + off * 0.4, y - 1, x + off * 1.6, y - 4);
          ctx.stroke();
        }
      } else if (d.type === 'flower') {
        // Stem
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y + 5);
        ctx.lineTo(x, y + 1);
        ctx.stroke();
        // Petals
        ctx.fillStyle = d.color!;
        const pr = 2.2;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.4) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        // Center
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'stone') {
        ctx.fillStyle = 'rgba(100, 95, 90, 0.55)';
        ctx.beginPath();
        ctx.ellipse(x, y, d.size!, d.size! * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(x - d.size! * 0.3, y - d.size! * 0.3, d.size! * 0.4, d.size! * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'firefly') {
        const pulse = 0.5 + 0.5 * Math.sin(time / 500 + d.phase!);
        const alpha = 0.25 + 0.5 * pulse;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(253, 224, 71, ${alpha})`;
        ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  // ======================= DRAW FOOD (APPLE) =======================
  const drawFood = (ctx: CanvasRenderingContext2D, food: Segment, cell: number, time: number) => {
    const cx = food.x * cell + cell / 2;
    const cy = food.y * cell + cell / 2;
    const pulse = 1 + Math.sin(time / 300) * 0.06;
    const r = cell * 0.42 * pulse;

    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ef4444';

    const grad = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.05, cx, cy, r * 1.15);
    grad.addColorStop(0, '#fecaca');
    grad.addColorStop(0.35, '#ef4444');
    grad.addColorStop(0.75, '#b91c1c');
    grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shine
    const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.55);
    shine.addColorStop(0, 'rgba(255,255,255,0.95)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Leaf
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.15, cy - r * 0.95, r * 0.38, r * 0.15, -Math.PI / 3, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.8);
    ctx.lineTo(cx + r * 0.1, cy - r * 1.15);
    ctx.stroke();
  };

  // ======================= DRAW SNAKE =======================
  const drawSnakeHead = (ctx: CanvasRenderingContext2D, head: { x: number; y: number }, dir: { x: number; y: number }, cell: number) => {
    const angle = Math.atan2(dir.y, dir.x);
    const hs = cell * 0.62;

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);

    ctx.shadowBlur = 28;
    ctx.shadowColor = '#d946ef';

    // Head base
    const hgrad = ctx.createRadialGradient(-hs * 0.3, -hs * 0.3, 0, 0, 0, hs * 1.2);
    hgrad.addColorStop(0, '#f0abfc');
    hgrad.addColorStop(0.6, '#c026d3');
    hgrad.addColorStop(1, '#7e22ce');
    ctx.fillStyle = hgrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, hs * 1.15, hs, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Highlight
    const hl = ctx.createRadialGradient(-hs * 0.4, -hs * 0.4, 0, 0, 0, hs);
    hl.addColorStop(0, 'rgba(255,255,255,0.55)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.ellipse(0, 0, hs * 1.1, hs * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const ex = hs * 0.4;
    const ey = hs * 0.5;
    const er = hs * 0.26;

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, -ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(ex + er * 0.25, -ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + er * 0.25, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ex + er * 0.45, -ey - er * 0.2, er * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + er * 0.45, ey - er * 0.2, er * 0.18, 0, Math.PI * 2); ctx.fill();

    // Tongue
    if (Date.now() % 1500 < 250) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = Math.max(1.5, cell * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hs * 1.05, 0);
      ctx.lineTo(hs * 1.45, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hs * 1.45, 0);
      ctx.lineTo(hs * 1.65, -hs * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hs * 1.45, 0);
      ctx.lineTo(hs * 1.65, hs * 0.15);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawSnake = (ctx: CanvasRenderingContext2D, cell: number) => {
    const s = stateRef.current;
    if (s.snake.length === 0) return;

    // Interpolated points
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < s.snake.length; i++) {
      const curr = s.snake[i];
      const prev = s.prevSnake[i] || curr;
      let px, py;
      
      // Skip interpolation if wrap caused jump
      if (i === 0 && s.justWrapped) {
        px = curr.x * cell + cell / 2;
        py = curr.y * cell + cell / 2;
      } else {
        px = (prev.x + (curr.x - prev.x) * s.tickProgress) * cell + cell / 2;
        py = (prev.y + (curr.y - prev.y) * s.tickProgress) * cell + cell / 2;
      }
      points.push({ x: px, y: py });
    }

    // For wrapped head, also draw the head at the wrapped position
    const path = new Path2D();
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);

    // Outer glow (magenta)
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#d946ef';
    ctx.strokeStyle = 'rgba(217, 70, 239, 0.3)';
    ctx.lineWidth = cell * 1.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();

    // Main body gradient (purple/magenta)
    const grad = ctx.createLinearGradient(points[0].x, points[0].y, points[points.length - 1].x || points[0].x, points[points.length - 1].y || points[0].y);
    grad.addColorStop(0, '#f0abfc');
    grad.addColorStop(0.35, '#c026d3');
    grad.addColorStop(0.75, '#a855f7');
    grad.addColorStop(1, '#6b21a8');
    ctx.strokeStyle = grad;
    ctx.lineWidth = cell * 0.88;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);

    // Inner highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = cell * 0.3;
    ctx.stroke(path);

    // Scales (dots)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      for (const tt of [0.25, 0.75]) {
        const dx = a.x + (b.x - a.x) * tt;
        const dy = a.y + (b.y - a.y) * tt;
        ctx.beginPath();
        ctx.arc(dx, dy, cell * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Head
    drawSnakeHead(ctx, points[0], s.dir, cell);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    for (const p of s.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ======================= MAIN RENDER =======================
  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.width / dpr;
    const cell = size / GRID;
    const s = stateRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (s.shake > 0.1) {
      const sx = (Math.random() - 0.5) * s.shake;
      const sy = (Math.random() - 0.5) * s.shake;
      ctx.translate(sx, sy);
      s.shake *= 0.85;
    }

    drawGarden(ctx, size, time);
    drawFood(ctx, s.food, cell, time);
    drawSnake(ctx, cell);
    drawParticles(ctx);

    // Vignette
    const vig = ctx.createRadialGradient(size / 2, size / 2, size * 0.4, size / 2, size / 2, size * 0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(21, 128, 61, 0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
  };

  // ======================= GAME LOOP =======================
  useEffect(() => {
    let alive = true;
    lastRef.current = performance.now();
    accumRef.current = 0;

    const loop = (now: number) => {
      if (!alive) return;
      const s = stateRef.current;
      const dt = now - lastRef.current;
      lastRef.current = now;

      if (s.running && !s.paused) {
        accumRef.current += dt;
        let steps = 0;
        while (accumRef.current >= s.tick && steps < 3) {
          accumRef.current -= s.tick;
          s.prevSnake = s.snake.map(p => ({ ...p }));
          step();
          if (s.justWrapped) {
            s.prevSnake[0] = { ...s.snake[0] };
          }
          steps++;
          if (!s.running) break;
        }
        if (steps === 3) accumRef.current = 0;
        s.tickProgress = Math.min(1, accumRef.current / s.tick);
      } else {
        s.tickProgress = 1;
      }

      if (s.particles.length > 0) {
        s.particles = s.particles.filter(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.15; p.vx *= 0.97;
          p.life -= 1;
          return p.life > 0;
        });
      }

      render(now);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ======================= CONTROLS =======================
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
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
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

  // ======================= UI =======================
  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 mb-6 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-fuchsia-400 via-purple-500 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
          <Gamepad2 className="text-fuchsia-500" size={32} /> {t('title')}
        </h1>
        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-3 md:p-4 bg-slate-900/80 backdrop-blur text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Score</p>
                <p className="text-xl md:text-2xl font-bold text-fuchsia-400 leading-none mt-1">{ui.score}</p>
              </div>
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
                <button onClick={start} className="px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-fuchsia-500/30">
                  {ui.running ? <RotateCcw size={16} /> : <Play size={16} />}
                  <span className="hidden sm:inline">{ui.running ? 'Restart' : 'Play'}</span>
                </button>
              </div>
            </div>

            <div ref={containerRef} className="relative aspect-square w-full bg-emerald-400">
              <canvas
                ref={canvasRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="absolute inset-0 w-full h-full touch-none select-none"
              />

              {!ui.running && !ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm text-white text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-fuchsia-500/40">
                    <Zap size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{t('ready')}</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">{t('controls')}</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 font-bold hover:opacity-90 transition shadow-lg shadow-fuchsia-500/30 flex items-center gap-2">
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
                  <p className="text-5xl font-bold text-fuchsia-400 mb-2">{ui.score}</p>
                  {saved && <p className="text-xs text-green-400 mb-2 font-medium">✓ {t('scoreSaved')}</p>}
                  <button onClick={start} className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 font-bold hover:opacity-90 transition shadow-lg shadow-fuchsia-500/30 flex items-center gap-2">
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

            <div className="lg:hidden p-4 grid grid-cols-3 gap-2 max-w-[240px] mx-auto bg-slate-900 border-t border-slate-800">
              <div />
              <button onClick={() => dpad({ x: 0, y: -1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-fuchsia-600 flex items-center justify-center text-white transition-colors shadow-lg" aria-label="Up"><ChevronUp size={28} /></button>
              <div />
              <button onClick={() => dpad({ x: -1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-fuchsia-600 flex items-center justify-center text-white transition-colors shadow-lg" aria-label="Left"><ChevronLeft size={28} /></button>
              <button onClick={() => dpad({ x: 0, y: 1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-fuchsia-600 flex items-center justify-center text-white transition-colors shadow-lg" aria-label="Down"><ChevronDown size={28} /></button>
              <button onClick={() => dpad({ x: 1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-fuchsia-600 flex items-center justify-center text-white transition-colors shadow-lg" aria-label="Right"><ChevronRight size={28} /></button>
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
                <Link href={`/${locale}/login`} className="inline-block bg-fuchsia-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition">{t('login')}</Link>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">{t('noScores')}</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm font-medium truncate">{entry.full_name || 'Joueur'}</p>
                    <p className="font-mono font-bold text-fuchsia-600 text-sm shrink-0">{entry.score}</p>
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