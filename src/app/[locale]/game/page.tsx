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
type Trail = { x: number; y: number; life: number; maxLife: number; };
type Firefly = { x: number; y: number; phase: number; vx: number; vy: number; };
type Dust = { x: number; y: number; vx: number; vy: number; size: number; };

export default function GamePage() {
  const t = useTranslations('game');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const accumRef = useRef(0);
  const lastRef = useRef(0);
  const firefliesRef = useRef<Firefly[]>([]);
  const dustRef = useRef<Dust[]>([]);

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
    trails: [] as Trail[],
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
    firefliesRef.current = Array.from({ length: 12 }, () => ({
      x: Math.random(), y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
    }));
    dustRef.current = Array.from({ length: 50 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0002,
      vy: (Math.random() - 0.5) * 0.0002,
      size: 0.5 + Math.random() * 1.2,
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

  const randomFood = () => {
    const s = stateRef.current;
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!s.snake.some(sp => sp.x === p.x && sp.y === p.y)) return p;
    }
  };

  const spawnParticles = (cx: number, cy: number, count: number, color: string) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      s.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 30, maxLife: 60,
        size: 1.5 + Math.random() * 3, color,
      });
    }
  };

  const addPopup = (x: number, y: number, text: string, color: string) => {
    stateRef.current.popups.push({ x, y, text, life: 55, maxLife: 55, color });
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

    const bodyToCheck = s.snake.slice(0, -1);
    if (bodyToCheck.some(p => p.x === head.x && p.y === head.y)) return endGame();

    s.snake.unshift(head);

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.width / dpr;
      const cell = size / GRID;
      s.trails.push({
        x: s.snake[0].x * cell + cell / 2,
        y: s.snake[0].y * cell + cell / 2,
        life: 12, maxLife: 12,
      });
    }

    if (head.x === s.food.x && head.y === s.food.y) {
      const now = performance.now();
      if (now - s.lastEatAt < COMBO_WINDOW) {
        s.combo = Math.min(s.combo + 1, 9);
      } else {
        s.combo = 1;
      }
      s.lastEatAt = now;
      const gained = 10 * s.combo;
      s.score += gained;
      s.tick = Math.max(TICK_MIN, s.tick - 2.5);
      s.shake = 3;
      s.flash = 0.3;
      s.flashColor = '255,255,255';

      const canvas2 = canvasRef.current!;
      const dpr2 = Math.min(window.devicePixelRatio || 1, 2);
      const size2 = canvas2.width / dpr2;
      const cell2 = size2 / GRID;
      const fx = s.food.x * cell2 + cell2 / 2;
      const fy = s.food.y * cell2 + cell2 / 2;

      spawnParticles(fx, fy, 16, 'hsl(0, 90%, 60%)');
      spawnParticles(fx, fy, 8, 'hsl(45, 100%, 60%)');

      if (s.combo > 1) {
        addPopup(fx, fy, `+${gained} x${s.combo}`, '#fbbf24');
      } else {
        addPopup(fx, fy, `+${gained}`, '#fbbf24');
      }

      s.food = randomFood();
      setUi(p => ({ ...p, score: s.score, combo: s.combo }));
    } else {
      s.snake.pop();
    }

    s.justWrapped = wrapped;
  };

  const endGame = () => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    s.shake = 18;
    s.flash = 0.7;
    s.flashColor = '239,68,68';

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.width / dpr;
      const cell = size / GRID;
      s.snake.forEach((seg, i) => {
        const hue = 180 + (i / s.snake.length) * 120;
        for (let p = 0; p < 2; p++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 5;
          s.particles.push({
            x: seg.x * cell + cell / 2,
            y: seg.y * cell + cell / 2,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 40 + Math.random() * 40, maxLife: 80,
            size: 2 + Math.random() * 3,
            color: `hsl(${hue}, 90%, 60%)`,
          });
        }
      });
    }

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
    s.snake = [{ x: 11, y: 11 }];
    s.prevSnake = [{ x: 11, y: 11 }];
    s.dir = { x: 1, y: 0 };
    s.nextDir = { x: 1, y: 0 };
    s.food = randomFood();
    s.score = 0;
    s.combo = 1;
    s.lastEatAt = 0;
    s.tick = TICK_BASE;
    s.tickProgress = 0;
    s.particles = [];
    s.popups = [];
    s.trails = [];
    s.shake = 0;
    s.flash = 0;
    s.running = true;
    s.gameOver = false;
    s.paused = false;
    s.justWrapped = false;
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

  const drawBackground = (ctx: CanvasRenderingContext2D, size: number, time: number) => {
    const bg = ctx.createRadialGradient(size * 0.3, size * 0.3, 0, size / 2, size / 2, size);
    bg.addColorStop(0, '#0f3831');
    bg.addColorStop(0.4, '#0a2a2a');
    bg.addColorStop(0.7, '#061a1e');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const cell = size / GRID;
    const pulse = 0.04 + 0.02 * Math.sin(time / 1000);
    ctx.strokeStyle = `rgba(34, 211, 238, ${pulse})`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }

    dustRef.current.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = 1;
      if (d.x > 1) d.x = 0;
      if (d.y < 0) d.y = 1;
      if (d.y > 1) d.y = 0;
      ctx.fillStyle = `rgba(148, 233, 255, ${0.15 + 0.2 * Math.sin(time / 800 + d.x * 10)})`;
      ctx.beginPath();
      ctx.arc(d.x * size, d.y * size, d.size, 0, Math.PI * 2);
      ctx.fill();
    });

    firefliesRef.current.forEach(f => {
      f.x += f.vx; f.y += f.vy;
      if (f.x < 0.02 || f.x > 0.98) f.vx *= -1;
      if (f.y < 0.02 || f.y > 0.98) f.vy *= -1;
      const fx = f.x * size;
      const fy = f.y * size;
      const fp = 0.4 + 0.6 * Math.abs(Math.sin(time / 500 + f.phase));
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14);
      grad.addColorStop(0, `rgba(253, 224, 71, ${0.6 * fp})`);
      grad.addColorStop(0.5, `rgba(253, 224, 71, ${0.15 * fp})`);
      grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 240, 150, ${fp})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawTrails = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    s.trails = s.trails.filter(t => {
      t.life--;
      if (t.life <= 0) return false;
      const alpha = (t.life / t.maxLife) * 0.25;
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 6 * (t.life / t.maxLife), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  };

  const drawFood = (ctx: CanvasRenderingContext2D, food: Segment, cell: number, time: number) => {
    const cx = food.x * cell + cell / 2;
    const cy = food.y * cell + cell / 2;
    const pulse = 1 + Math.sin(time / 250) * 0.08;
    const r = cell * 0.4 * pulse;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.75, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowBlur = 35;
    ctx.shadowColor = '#ef4444';
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    grad.addColorStop(0, '#fecaca');
    grad.addColorStop(0.4, '#f87171');
    grad.addColorStop(0.75, '#dc2626');
    grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.5);
    shine.addColorStop(0, 'rgba(255,255,255,0.9)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 1.05, cx + r * 0.2, cy - r * 1.2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx + r * 0.15, cy - r);
    ctx.rotate(-Math.PI / 4);
    const leafGrad = ctx.createLinearGradient(0, 0, r * 0.6, 0);
    leafGrad.addColorStop(0, '#4ade80');
    leafGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.25, 0, r * 0.35, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 3; i++) {
      const a = time / 400 + i * Math.PI * 2 / 3;
      const sr = r * 1.5;
      const sx = cx + Math.cos(a) * sr;
      const sy = cy + Math.sin(a) * sr * 0.7;
      const sp = 0.5 + 0.5 * Math.sin(time / 150 + i * 2);
      ctx.fillStyle = `rgba(255, 240, 150, ${sp * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawHead = (ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, dir: { x: number; y: number }, cell: number, time: number) => {
    const angle = Math.atan2(dir.y, dir.x);
    const hs = cell * 0.55;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(2, 4, hs * 1.1, hs * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#22d3ee';
    const headGrad = ctx.createRadialGradient(-hs * 0.3, -hs * 0.3, 0, 0, 0, hs * 1.2);
    headGrad.addColorStop(0, '#67e8f9');
    headGrad.addColorStop(0.5, '#22d3ee');
    headGrad.addColorStop(1, '#0891b2');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, hs * 1.15, hs * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const shine = ctx.createRadialGradient(-hs * 0.4, -hs * 0.4, 0, 0, 0, hs);
    shine.addColorStop(0, 'rgba(255,255,255,0.7)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(-hs * 0.15, -hs * 0.15, hs * 0.6, hs * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const ex = hs * 0.35;
    const ey = hs * 0.55;
    const er = hs * 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex, -ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(ex + er * 0.35, -ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + er * 0.35, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ex + er * 0.5, -ey - er * 0.25, er * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + er * 0.5, ey - er * 0.25, er * 0.2, 0, Math.PI * 2); ctx.fill();

    const flickCycle = time % 1800;
    if (flickCycle < 300) {
      const flick = Math.sin(flickCycle / 300 * Math.PI);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(1.5, cell * 0.055);
      ctx.lineCap = 'round';
      const tl = hs * 0.6 * flick;
      ctx.beginPath();
      ctx.moveTo(hs * 1.05, 0);
      ctx.lineTo(hs * 1.05 + tl, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hs * 1.05 + tl, 0);
      ctx.lineTo(hs * 1.05 + tl * 1.2, -hs * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hs * 1.05 + tl, 0);
      ctx.lineTo(hs * 1.05 + tl * 1.2, hs * 0.12);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawSnake = (ctx: CanvasRenderingContext2D, cell: number, time: number) => {
    const s = stateRef.current;
    if (s.snake.length === 0) return;

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < s.snake.length; i++) {
      const curr = s.snake[i];
      const prev = s.prevSnake[i] || curr;
      let px, py;
      if (i === 0 && s.justWrapped) {
        px = curr.x * cell + cell / 2;
        py = curr.y * cell + cell / 2;
      } else {
        px = (prev.x + (curr.x - prev.x) * s.tickProgress) * cell + cell / 2;
        py = (prev.y + (curr.y - prev.y) * s.tickProgress) * cell + cell / 2;
      }
      points.push({ x: px, y: py });
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    points.forEach((p, i) => {
      if (i === 0) return;
      const t = i / points.length;
      const radius = cell * (0.35 - 0.15 * t);
      ctx.beginPath();
      ctx.arc(p.x + 2, p.y + 3, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let i = points.length - 1; i >= 1; i--) {
      const t = i / points.length;
      const radius = cell * (0.44 - 0.24 * t);
      const hue = 190 + t * 110;
      const sat = 95 - t * 20;
      const lig = 60 - t * 22;

      ctx.save();
      ctx.shadowBlur = i < 4 ? 22 : 12;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lig}%)`;
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.35)`;
      ctx.beginPath();
      ctx.arc(points[i].x - radius * 0.3, points[i].y - radius * 0.3, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHead(ctx, points[0], s.dir, cell, time);
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    s.particles = s.particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) return false;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
  };

  const drawPopups = (ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    s.popups = s.popups.filter(p => {
      p.y -= 0.7;
      p.life--;
      if (p.life <= 0) return false;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
      return true;
    });
  };

  const drawVignette = (ctx: CanvasRenderingContext2D, size: number) => {
    const vig = ctx.createRadialGradient(size / 2, size / 2, size * 0.4, size / 2, size / 2, size * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
  };

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

    drawBackground(ctx, size, time);
    drawTrails(ctx);
    drawFood(ctx, s.food, cell, time);
    drawSnake(ctx, cell, time);
    drawParticles(ctx);
    drawPopups(ctx);
    drawVignette(ctx, size);

    if (s.flash > 0.01) {
      ctx.fillStyle = `rgba(${s.flashColor}, ${s.flash * 0.35})`;
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
      const dt = now - lastRef.current;
      lastRef.current = now;

      if (s.running && !s.paused) {
        accumRef.current += dt;
        let steps = 0;
        while (accumRef.current >= s.tick && steps < 3) {
          accumRef.current -= s.tick;
          s.prevSnake = s.snake.map(p => ({ ...p }));
          step();
          if (s.justWrapped) s.prevSnake[0] = { ...s.snake[0] };
          steps++;
          if (!s.running) break;
        }
        if (steps === 3) accumRef.current = 0;
        s.tickProgress = Math.min(1, accumRef.current / s.tick);
      } else {
        s.tickProgress = 1;
      }

      if (s.running && s.lastEatAt > 0) {
        if (now - s.lastEatAt > COMBO_WINDOW && s.combo > 1) {
          s.combo = 1;
          setUi(p => ({ ...p, combo: 1 }));
        }
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

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 mb-6 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent flex items-center gap-3">
          <Gamepad2 className="text-cyan-500" size={32} /> {t('title')}
        </h1>
        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 backdrop-blur text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Score</p>
                <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent leading-none mt-1">{ui.score}</p>
              </div>
              {ui.combo > 1 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40 animate-pulse">
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
              <button onClick={() => dpad({ x: 0, y: -1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-cyan-500/20" aria-label="Up"><ChevronUp size={28} /></button>
              <div />
              <button onClick={() => dpad({ x: -1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-cyan-500/20" aria-label="Left"><ChevronLeft size={28} /></button>
              <button onClick={() => dpad({ x: 0, y: 1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-cyan-500/20" aria-label="Down"><ChevronDown size={28} /></button>
              <button onClick={() => dpad({ x: 1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-cyan-500/20" aria-label="Right"><ChevronRight size={28} /></button>
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
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {i + 1}
                    </div>
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