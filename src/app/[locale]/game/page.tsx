'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap, Crown, Pause, Gamepad2 } from 'lucide-react';

const GRID = 20;
const TICK_BASE = 160;

type Dir = { x: number; y: number };

export default function GamePage() {
  const t = useTranslations('game');
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
    score: 0,
    running: false,
    gameOver: false,
    tick: TICK_BASE,
    paused: false,
  });

  const [ui, setUi] = useState({ score: 0, best: 0, running: false, gameOver: false, paused: false });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  const accumRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const supabase = createClient();

  // Load user + best + leaderboard
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const best = Number(localStorage.getItem('snake_best') || 0);
      setUi(prev => ({ ...prev, best }));
      await loadLeaderboard();
    })();
  }, []);

  const loadLeaderboard = async () => {
    const { data } = await supabase.rpc('get_leaderboard', { limit_count: 10 });
    setLeaderboard(data || []);
  };

  const saveScore = async (score: number) => {
    if (!user || score === 0) return;
    await supabase.from('game_scores').insert({ user_id: user.id, score });
    await loadLeaderboard();
    setSaved(true);
  };

  // Resize canvas with device pixel ratio
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const size = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.width / dpr;
    const cell = size / GRID;
    const s = stateRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }

    // Snake
    s.snake.forEach((p, i) => {
      const ratio = 1 - (i / s.snake.length) * 0.6;
      ctx.shadowBlur = i === 0 ? 20 : 8;
      ctx.shadowColor = '#22d3ee';
      ctx.fillStyle = i === 0 ? '#22d3ee' : `rgba(34, 211, 238, ${ratio})`;
      const pad = i === 0 ? 1 : 2;
      ctx.fillRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2);
    });

    // Food with pulse
    const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, (cell / 2 - 2) * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }, []);

  // Game loop
  useEffect(() => {
    let alive = true;
    let last = performance.now();
    
    const loop = (now: number) => {
      if (!alive) return;
      const s = stateRef.current;
      
      if (s.running && !s.paused) {
        accumRef.current += now - last;
        if (accumRef.current >= s.tick) {
          accumRef.current = 0;
          step();
        }
      }
      last = now;
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [render]);

  const step = () => {
    const s = stateRef.current;
    s.dir = s.nextDir;
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };

    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return endGame();
    if (s.snake.some(p => p.x === head.x && p.y === head.y)) return endGame();

    s.snake.unshift(head);
    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 10;
      s.tick = Math.max(70, s.tick - 4);
      s.food = randomFood();
      setUi(prev => ({ ...prev, score: s.score }));
    } else {
      s.snake.pop();
    }
  };

  const randomFood = () => {
    const s = stateRef.current;
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!s.snake.some(sp => sp.x === p.x && sp.y === p.y)) return p;
    }
  };

  const endGame = () => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    const isBest = s.score > ui.best;
    if (isBest) localStorage.setItem('snake_best', String(s.score));
    setUi(prev => ({ ...prev, gameOver: true, running: false, best: isBest ? s.score : prev.best }));
    saveScore(s.score);
  };

  const start = () => {
    const s = stateRef.current;
    s.snake = [{ x: 10, y: 10 }];
    s.dir = { x: 1, y: 0 };
    s.nextDir = { x: 1, y: 0 };
    s.food = { x: 15, y: 10 };
    s.score = 0;
    s.tick = TICK_BASE;
    s.running = true;
    s.gameOver = false;
    s.paused = false;
    accumRef.current = 0;
    setUi(prev => ({ ...prev, score: 0, running: true, gameOver: false, paused: false }));
    setSaved(false);
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (!s.running) return;
    s.paused = !s.paused;
    setUi(prev => ({ ...prev, paused: s.paused }));
  };

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s.running) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if ((k === 'arrowup' || k === 'w') && s.dir.y === 0) s.nextDir = { x: 0, y: -1 };
      if ((k === 'arrowdown' || k === 's') && s.dir.y === 0) s.nextDir = { x: 0, y: 1 };
      if ((k === 'arrowleft' || k === 'a') && s.dir.x === 0) s.nextDir = { x: -1, y: 0 };
      if ((k === 'arrowright' || k === 'd') && s.dir.x === 0) s.nextDir = { x: 1, y: 0 };
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Swipe controls
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

  const dpad = (dir: Dir) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (dir.x !== 0 && s.dir.x === 0) s.nextDir = dir;
    if (dir.y !== 0 && s.dir.y === 0) s.nextDir = dir;
  };

  return (
    <div className="container-custom py-6 md:py-10 max-w-5xl">
      <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 mb-6 transition">
        <ArrowLeft size={16} /> {t('back')}
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
          <Gamepad2 className="text-indigo-500" size={32} />
          {t('title')}
        </h1>
        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            {/* HUD */}
            <div className="flex items-center justify-between p-3 md:p-4 bg-slate-900 text-white">
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Score</p>
                <p className="text-xl md:text-2xl font-bold text-cyan-400 leading-none mt-1">{ui.score}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Best</p>
                <p className="text-lg md:text-xl font-bold text-yellow-400 leading-none mt-1">{ui.best}</p>
              </div>
              <div className="flex gap-2">
                {ui.running && (
                  <button onClick={togglePause} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition" aria-label="Pause">
                    <Pause size={18} />
                  </button>
                )}
                <button onClick={start} className="px-3 md:px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm">
                  {ui.running ? <RotateCcw size={16} /> : <Play size={16} />}
                  <span className="hidden sm:inline">{ui.running ? 'Restart' : 'Play'}</span>
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div ref={containerRef} className="relative aspect-square w-full bg-slate-950">
              <canvas
                ref={canvasRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="absolute inset-0 w-full h-full touch-none select-none"
              />
              
              {/* Overlays */}
              {!ui.running && !ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm text-white text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/40">
                    <Zap size={32} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{t('ready')}</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">{t('controls')}</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/30 flex items-center gap-2">
                    <Play size={20} /> {t('play')}
                  </button>
                </div>
              )}
              {ui.gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm text-white text-center p-4">
                  <Trophy size={56} className="text-yellow-400 mb-3" />
                  <h2 className="text-2xl font-bold mb-1">{t('gameOver')}</h2>
                  <p className="text-5xl font-bold text-cyan-400 mb-2">{ui.score}</p>
                  {saved && <p className="text-xs text-green-400 mb-2 font-medium">✓ {t('scoreSaved')}</p>}
                  <button onClick={start} className="mt-4 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold hover:opacity-90 transition shadow-lg shadow-cyan-500/30 flex items-center gap-2">
                    <RotateCcw size={18} /> {t('playAgain')}
                  </button>
                </div>
              )}
              {ui.paused && ui.running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                  <Pause size={48} className="text-white mb-3" />
                  <p className="text-white text-2xl font-bold">{t('paused')}</p>
                </div>
              )}
            </div>

            {/* Mobile D-pad */}
            <div className="lg:hidden p-4 grid grid-cols-3 gap-2 max-w-[220px] mx-auto bg-slate-900 border-t border-slate-800">
              <div />
              <button onClick={() => dpad({ x: 0, y: -1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Up"><ChevronUp size={28} /></button>
              <div />
              <button onClick={() => dpad({ x: -1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Left"><ChevronLeft size={28} /></button>
              <button onClick={() => dpad({ x: 0, y: 1 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Down"><ChevronDown size={28} /></button>
              <button onClick={() => dpad({ x: 1, y: 0 })} className="aspect-square rounded-xl bg-slate-800 active:bg-cyan-600 flex items-center justify-center text-white transition-colors" aria-label="Right"><ChevronRight size={28} /></button>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500" /> {t('leaderboard')}
            </h2>
            {!user ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-3">{t('loginToSave')}</p>
                <Link href={`/${locale}/login`} className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
                  {t('login')}
                </Link>
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