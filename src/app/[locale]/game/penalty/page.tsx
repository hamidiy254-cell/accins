'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, Target, Crown, Award, Volume2, VolumeX, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { initAudio, playKick, playCrowd, playWhistle, playPost, playSave, setMuted, isMuted } from '@/lib/game-audio';

// ============================================================
// CONSTANTES 3D (en mètres)
// ============================================================
const GOAL_Z = 12;              // Distance du but depuis la caméra
const GOAL_W = 7.32;            // Largeur du but
const GOAL_H = 2.44;            // Hauteur du but
const BALL_R = 0.11;            // Rayon ballon
const BALL_Z_START = 2.5;       // Ballon à 2.5m de la caméra
const GRAVITY = 9.8;
const CAM_HEIGHT = 1.6;         // Hauteur caméra
const SHOT_DURATION = 0.62;     // Temps vol du ballon (s)
const TOTAL_SHOTS = 5;

type Phase = 'ready' | 'aiming' | 'shooting' | 'result' | 'done';
type ShotResult = 'goal' | 'save' | 'post' | 'miss';

// Projection 3D → 2D
function project(worldX: number, worldY: number, worldZ: number, W: number, H: number, focal: number) {
  const dz = worldZ;
  if (dz < 0.1) return null;
  const scale = focal / dz;
  const sx = W / 2 + worldX * scale;
  const sy = H * 0.55 - (worldY - CAM_HEIGHT) * scale;
  return { x: sx, y: sy, scale };
}

export default function PenaltyPage() {
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const isMobileRef = useRef(false);
  const [muteState, setMuteState] = useState(false);

  const S = useRef({
    phase: 'ready' as Phase,
    // Ball 3D
    bx: 0, by: BALL_R, bz: BALL_Z_START,
    bvx: 0, bvy: 0, bvz: 0,
    bRot: 0,
    bTrail: [] as { x: number; y: number; z: number; life: number }[],
    // Target
    tx: 0, ty: 1.22, tz: GOAL_Z,
    aimActive: false,
    // Keeper
    kx: 0, ky: 1.22, kz: GOAL_Z - 0.3,
    kdiveX: 0, kdiveY: 0,
    kProgress: 0,
    kAnim: 'idle' as 'idle' | 'diveL' | 'diveR' | 'jump',
    // Game state
    goals: 0, saves: 0, shots: 0,
    lastResult: null as ShotResult | null,
    shotsLog: [] as ShotResult[],
    // FX
    netWave: 0,
    shake: 0,
    flash: 0,
    flashHue: 90,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; hue: number; }[],
    confetti: [] as { x: number; y: number; vx: number; vy: number; rot: number; rotV: number; life: number; color: string; }[],
    time: 0,
    kickAnim: 0,
    resultTimer: 0,
  });

  const [ui, setUi] = useState({
    goals: 0, saves: 0, shots: 0, phase: 'ready' as Phase,
    lastResult: null as ShotResult | null, score: 0, best: 0,
    shotsLog: [] as ShotResult[],
  });
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
      setUi(p => ({ ...p, best: Number(localStorage.getItem('penalty_best') || 0) }));
      const { data } = await supabase.rpc('get_penalty_leaderboard', { limit_count: 10 });
      setLeaderboard(data || []);
    })();
  }, []);

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current, container = containerRef.current;
      if (!c || !container) return;
      const w = container.clientWidth;
      const h = Math.min(w * 0.62, 420);
      const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const start = () => {
    const s = S.current;
    s.phase = 'aiming';
    s.goals = 0; s.saves = 0; s.shots = 0;
    s.shotsLog = [];
    s.lastResult = null;
    s.particles = []; s.confetti = [];
    s.shake = 0; s.flash = 0;
    s.netWave = 0; s.kickAnim = 0; s.resultTimer = 0;
    resetShot();
    setUi(p => ({ ...p, goals: 0, saves: 0, shots: 0, phase: 'aiming', lastResult: null, score: 0, shotsLog: [] }));
    setSaved(false);
    playWhistle();
  };

  const resetShot = () => {
    const s = S.current;
    s.bx = 0; s.by = BALL_R; s.bz = BALL_Z_START;
    s.bvx = 0; s.bvy = 0; s.bvz = 0;
    s.bRot = 0;
    s.bTrail = [];
    s.kx = 0; s.ky = 1.22; s.kProgress = 0;
    s.kdiveX = 0; s.kdiveY = 0;
    s.kAnim = 'idle';
    s.kickAnim = 0;
    s.netWave = 0;
    s.lastResult = null;
    s.resultTimer = 0;
  };

  const aimAt = (screenX: number, screenY: number, W: number, H: number, focal: number) => {
    const s = S.current;
    if (s.phase !== 'aiming') return;
    // Convertir écran → plan du but (z=GOAL_Z)
    const relX = screenX - W / 2;
    const relY = H * 0.55 - screenY;
    const wx = relX * GOAL_Z / focal;
    const wy = relY * GOAL_Z / focal + CAM_HEIGHT;
    // Clamp dans les limites du but + marge
    s.tx = Math.max(-GOAL_W / 2 + 0.2, Math.min(GOAL_W / 2 - 0.2, wx));
    s.ty = Math.max(0.15, Math.min(GOAL_H - 0.1, wy));
    s.aimActive = true;
  };

  const shoot = () => {
    const s = S.current;
    if (s.phase !== 'aiming') return;
    s.phase = 'shooting';
    s.kickAnim = 1;

    // Calculer la vélocité pour atteindre (tx, ty, GOAL_Z) en SHOT_DURATION
    const dx = s.tx - s.bx;
    const dy = s.ty - s.by;
    const dz = GOAL_Z - s.bz;
    s.bvx = dx / SHOT_DURATION;
    s.bvz = dz / SHOT_DURATION;
    s.bvy = dy / SHOT_DURATION + 0.5 * GRAVITY * SHOT_DURATION;

    // Keeper AI
    const rand = Math.random();
    const guessCorrect = rand < 0.42; // 42% chance de bien deviner le côté
    let keeperTargetX: number;
    if (guessCorrect) {
      keeperTargetX = s.tx > 0 ? 1.5 + Math.random() * 1 : -1.5 - Math.random() * 1;
    } else {
      keeperTargetX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2);
    }
    keeperTargetX = Math.max(-GOAL_W / 2 + 0.3, Math.min(GOAL_W / 2 - 0.3, keeperTargetX));
    const keeperTargetY = s.ty > GOAL_H * 0.6 && Math.random() < 0.55 ? 1.6 + Math.random() * 0.6 : 0.8 + Math.random() * 0.4;

    s.kdiveX = keeperTargetX;
    s.kdiveY = keeperTargetY;
    s.kAnim = keeperTargetX < -0.4 ? 'diveL' : keeperTargetX > 0.4 ? 'diveR' : 'jump';

    playKick();
    setUi(p => ({ ...p, phase: 'shooting' }));
  };

  const resolveResult = () => {
    const s = S.current;
    let result: ShotResult = 'goal';

    // Position finale
    const finalX = s.bx;
    const finalY = s.by;

    // Poteau ?
    const nearPost = Math.abs(Math.abs(finalX) - GOAL_W / 2) < BALL_R + 0.08 || Math.abs(finalY - GOAL_H) < BALL_R + 0.08;
    const insideGoal = Math.abs(finalX) < GOAL_W / 2 - BALL_R && finalY > BALL_R && finalY < GOAL_H - BALL_R;

    if (!insideGoal && !nearPost) {
      result = 'miss';
    } else if (nearPost && (!insideGoal || Math.random() < 0.5)) {
      result = 'post';
      playPost();
    } else {
      // Check keeper
      const keeperReach = 1.15;
      const dxK = Math.abs(finalX - s.kx);
      const dyK = Math.abs(finalY - s.ky);
      const dist = Math.sqrt(dxK * dxK + dyK * dyK);
      if (dist < keeperReach && s.kProgress > 0.3) {
        result = 'save';
      } else {
        result = 'goal';
        s.netWave = 1;
        // Confetti
        for (let i = 0; i < 40; i++) {
          s.confetti.push({
            x: Math.random(), y: 0,
            vx: (Math.random() - 0.5) * 0.008,
            vy: 0.003 + Math.random() * 0.005,
            rot: Math.random() * Math.PI * 2,
            rotV: (Math.random() - 0.5) * 0.3,
            life: 120 + Math.random() * 60,
            color: ['#fbbf24','#f43f5e','#22c55e','#3b82f6','#a855f7'][Math.floor(Math.random()*5)],
          });
        }
        // Particles
        for (let i = 0; i < 20; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 2 + Math.random() * 5;
          s.particles.push({ x: Math.random(), y: Math.random() * 0.5, vx: Math.cos(a) * sp * 0.002, vy: Math.sin(a) * sp * 0.002, life: 60, maxLife: 60, hue: 45 + Math.random() * 30 });
        }
        s.flash = 0.6; s.flashHue = 120;
        s.shake = 6;
        playCrowd(true);
      }
    }

    if (result === 'save') {
      s.flash = 0.4; s.flashHue = 0;
      s.shake = 8;
      playSave();
    }

    s.lastResult = result;
    s.phase = 'result';
    s.resultTimer = 0;
    s.shots++;
    s.shotsLog.push(result);
    if (result === 'goal') s.goals++;
    if (result === 'save') s.saves++;

    setUi(p => ({
      ...p, phase: 'result', lastResult: result,
      goals: s.goals, saves: s.saves, shots: s.shots,
      shotsLog: [...s.shotsLog],
    }));

    setTimeout(() => {
      if (s.shots >= TOTAL_SHOTS) {
        s.phase = 'done';
        setUi(p => ({ ...p, phase: 'done' }));
        finish();
      } else {
        resetShot();
        s.phase = 'aiming';
        setUi(p => ({ ...p, phase: 'aiming', lastResult: null }));
        playWhistle();
      }
    }, 2200);
  };

  const finish = async () => {
    const s = S.current;
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

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = S.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const W = rect.width, H = rect.height;
    const focal = W * 0.9;
    if (s.phase === 'aiming') {
      aimAt(x, y, W, H, focal);
      setTimeout(shoot, 60);
    }
  };

  const onTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = S.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.changedTouches[0];
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    const W = rect.width, H = rect.height;
    const focal = W * 0.9;
    if (s.phase === 'aiming') {
      aimAt(x, y, W, H, focal);
      setTimeout(shoot, 60);
    }
  };

  const toggleMute = () => {
    const m = !isMuted(); setMuted(m); setMuteState(m);
  };

  // ============================================================
  // RENDER
  // ============================================================
  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const dpr = isMobileRef.current ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const s = S.current;
    const focal = W * 0.9;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (s.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      s.shake *= 0.88;
    }

    // --- SKY ---
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(0.5, '#0a1a3d');
    sky.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.55);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 7919) % 1000) / 1000 * W;
      const sy = ((i * 1979) % 1000) / 1000 * H * 0.35;
      const sp = 0.3 + 0.7 * Math.abs(Math.sin(time / 800 + i));
      ctx.fillStyle = `rgba(255, 255, 255, ${sp * 0.7})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // --- FLOODLIGHTS (4 coins) ---
    const lightPositions = [
      { x: W * 0.08, y: H * 0.08 },
      { x: W * 0.92, y: H * 0.08 },
      { x: W * 0.15, y: H * 0.15 },
      { x: W * 0.85, y: H * 0.15 },
    ];
    lightPositions.forEach((lp, i) => {
      const glow = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 60);
      glow.addColorStop(0, 'rgba(255, 255, 200, 0.35)');
      glow.addColorStop(1, 'rgba(255, 255, 200, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 60, 0, Math.PI * 2); ctx.fill();
      // Light beam
      if (!isMobileRef.current) {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.06)';
        ctx.beginPath();
        ctx.moveTo(lp.x - 8, lp.y + 8);
        ctx.lineTo(lp.x + 8, lp.y + 8);
        ctx.lineTo(lp.x + 100, H * 0.55);
        ctx.lineTo(lp.x - 100, H * 0.55);
        ctx.closePath();
        ctx.fill();
      }
    });

    // --- STADIUM STANDS ---
    const standTop = H * 0.18, standBot = H * 0.42;
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, standTop, W, standBot - standTop);
    // Crowd dots
    for (let i = 0; i < 120; i++) {
      const cx = (i % 60) * (W / 60) + (W / 120);
      const cy = standTop + Math.floor(i / 60) * 12 + 6;
      const c = ['#4b5563','#6b7280','#374151','#7c3aed','#0891b2','#f59e0b','#ec4899'][i % 7];
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    }

    // --- GRASS (perspective) ---
    const horizonY = H * 0.42;
    const grassGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    grassGrad.addColorStop(0, '#166534');
    grassGrad.addColorStop(0.4, '#15803d');
    grassGrad.addColorStop(0.7, '#166534');
    grassGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Grass stripes (perspective)
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) continue;
      const t1 = i / 12, t2 = (i + 1) / 12;
      const y1 = horizonY + (H - horizonY) * t1 * t1;
      const y2 = horizonY + (H - horizonY) * t2 * t2;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, y1, W, y2 - y1);
    }

    // --- GOAL LINE ---
    const glLeft = project(-GOAL_W/2 - 1, 0, GOAL_Z, W, H, focal);
    const glRight = project(GOAL_W/2 + 1, 0, GOAL_Z, W, H, focal);
    if (glLeft && glRight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(glLeft.x, glLeft.y); ctx.lineTo(glRight.x, glRight.y); ctx.stroke();
    }

    // --- GOAL ---
    const goalTL = project(-GOAL_W/2, GOAL_H, GOAL_Z, W, H, focal);
    const goalTR = project(GOAL_W/2, GOAL_H, GOAL_Z, W, H, focal);
    const goalBL = project(-GOAL_W/2, 0, GOAL_Z, W, H, focal);
    const goalBR = project(GOAL_W/2, 0, GOAL_Z, W, H, focal);

    if (goalTL && goalTR && goalBL && goalBR) {
      // Net
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 18; i++) {
        const t = i / 18;
        const x1 = goalTL.x + (goalTR.x - goalTL.x) * t;
        const y1 = goalTL.y + (goalTR.y - goalTL.y) * t;
        const x2 = goalBL.x + (goalBR.x - goalBL.x) * t;
        const y2 = goalBL.y + (goalBR.y - goalBL.y) * t;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const x1 = goalTL.x + (goalBL.x - goalTL.x) * t;
        const y1 = goalTL.y + (goalBL.y - goalTL.y) * t;
        const x2 = goalTR.x + (goalBR.x - goalTR.x) * t;
        const y2 = goalTR.y + (goalBR.y - goalTR.y) * t;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      // Net wave on goal
      if (s.netWave > 0.01) {
        const bulge = s.netWave * 20;
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.netWave * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(goalTL.x, goalTL.y + bulge * 0.3);
        ctx.quadraticCurveTo((goalTL.x + goalTR.x) / 2, goalTL.y + bulge, goalTR.x, goalTR.y + bulge * 0.3);
        ctx.stroke();
        s.netWave *= 0.92;
      }

      // Posts (with glow)
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(goalTL.x, goalTL.y); ctx.lineTo(goalTR.x, goalTR.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goalTL.x, goalTL.y); ctx.lineTo(goalBL.x, goalBL.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(goalTR.x, goalTR.y); ctx.lineTo(goalBR.x, goalBR.y); ctx.stroke();
      ctx.restore();
    }

    // --- KEEPER ---
    const kp = project(s.kx, s.ky, s.kz, W, H, focal);
    if (kp) {
      const kScale = kp.scale;
      const kH = 1.85 * kScale; // taille gardien 1.85m
      const kW = 0.6 * kScale;

      // Move keeper toward dive target during shooting
      if (s.phase === 'shooting' || s.phase === 'result') {
        s.kProgress = Math.min(1, s.kProgress + 0.035);
        const eased = 1 - Math.pow(1 - s.kProgress, 3);
        s.kx = s.kdiveX * eased;
        s.ky = 1.22 + (s.kdiveY - 1.22) * eased;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(kp.x, kp.y + 3, kW * 0.7, kW * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#f59e0b';
      ctx.fillStyle = '#f59e0b';
      const bodyTop = kp.y - kH * 0.85;
      const bodyH = kH * 0.55;
      ctx.beginPath();
      ctx.roundRect(kp.x - kW / 2, bodyTop, kW, bodyH, kW * 0.15);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fcd34d';
      const headR = kH * 0.09;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y - kH * 0.92, headR, 0, Math.PI * 2);
      ctx.fill();

      // Arms — spread based on anim
      const spread = s.kAnim === 'idle' ? 0.4 : Math.min(1, s.kProgress);
      const armLen = kH * 0.35;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = kW * 0.22;
      ctx.lineCap = 'round';

      // Left arm
      const laX = kp.x - kW * 0.7 * spread - armLen * 0.3 * spread;
      const laY = kp.y - kH * 0.7 - armLen * spread * 0.6;
      ctx.beginPath(); ctx.moveTo(kp.x - kW / 2, kp.y - kH * 0.65); ctx.lineTo(laX, laY); ctx.stroke();

      // Right arm
      const raX = kp.x + kW * 0.7 * spread + armLen * 0.3 * spread;
      const raY = kp.y - kH * 0.7 - armLen * spread * 0.6;
      ctx.beginPath(); ctx.moveTo(kp.x + kW / 2, kp.y - kH * 0.65); ctx.lineTo(raX, raY); ctx.stroke();

      // Gloves
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(laX, laY, kW * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(raX, raY, kW * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // --- BALL ---
    let ballWorldY = s.by;
    let ballWorldZ = s.bz;
    let ballWorldX = s.bx;

    if (s.phase === 'shooting') {
      // Physics integration
      const dt = 1 / 60;
      s.bx += s.bvx * dt;
      s.by += s.bvy * dt;
      s.bz += s.bvz * dt;
      s.bvy -= GRAVITY * dt;
      s.bRot += s.bvz * dt * 3;

      // Trail
      s.bTrail.push({ x: s.bx, y: s.by, z: s.bz, life: 12 });
      if (s.bTrail.length > 12) s.bTrail.shift();

      // Stop when reaches goal
      if (s.bz >= GOAL_Z) {
        s.bz = GOAL_Z;
        resolveResult();
      }
    } else if (s.phase === 'result') {
      // Ball stays at final position
      ballWorldX = s.bx; ballWorldY = s.by; ballWorldZ = s.bz;
    }

    // Ball trail
    s.bTrail = s.bTrail.filter(tr => {
      tr.life--;
      if (tr.life <= 0) return false;
      const p = project(tr.x, tr.y, tr.z, W, H, focal);
      if (p) {
        const alpha = tr.life / 12 * 0.4;
        const r = BALL_R * p.scale * (tr.life / 12);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      return true;
    });

    // Ball
    const bp = project(ballWorldX, ballWorldY, ballWorldZ, W, H, focal);
    if (bp) {
      const br = BALL_R * bp.scale;

      // Ball shadow on ground
      const shadowP = project(ballWorldX, 0, ballWorldZ, W, H, focal);
      if (shadowP) {
        const shadowR = br * 1.2;
        const shadowAlpha = Math.max(0.15, 0.5 - ballWorldY * 0.15);
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(shadowP.x, shadowP.y, shadowR * 1.1, shadowR * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ball body
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      const ballGrad = ctx.createRadialGradient(bp.x - br * 0.35, bp.y - br * 0.4, br * 0.1, bp.x, bp.y, br);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.6, '#e5e7eb');
      ballGrad.addColorStop(0.9, '#9ca3af');
      ballGrad.addColorStop(1, '#4b5563');
      ctx.fillStyle = ballGrad;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, br, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Pentagon pattern (rotating)
      ctx.save();
      ctx.translate(bp.x, bp.y);
      ctx.rotate(s.bRot);
      ctx.fillStyle = '#111827';
      // Center pentagon
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const r = br * 0.35;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      // Outer pentagons
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * br * 0.7;
        const py = Math.sin(a) * br * 0.7;
        ctx.beginPath(); ctx.arc(px, py, br * 0.18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Highlight
      const shine = ctx.createRadialGradient(bp.x - br * 0.4, bp.y - br * 0.4, 0, bp.x - br * 0.4, bp.y - br * 0.4, br * 0.6);
      shine.addColorStop(0, 'rgba(255,255,255,0.8)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath(); ctx.arc(bp.x - br * 0.35, bp.y - br * 0.4, br * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Kick leg animation
    if (s.kickAnim > 0.01) {
      const legPhase = 1 - s.kickAnim;
      const legX = W / 2;
      const legY = H * 0.92;
      const legAngle = -Math.PI / 3 + legPhase * Math.PI / 1.5;
      const legLen = W * 0.15;
      ctx.save();
      ctx.translate(legX, legY);
      ctx.rotate(legAngle);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(-W * 0.015, -legLen, W * 0.03, legLen, W * 0.015);
      ctx.fill();
      // Shoe
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, -legLen - 6, W * 0.025, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      s.kickAnim -= 0.04;
    }

    // Aiming reticle
    if (s.phase === 'aiming' && s.aimActive) {
      const rp = project(s.tx, s.ty, GOAL_Z, W, H, focal);
      if (rp) {
        const pulse = 1 + Math.sin(time / 100) * 0.15;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 12 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 20 * pulse, 0, Math.PI * 2); ctx.stroke();
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(rp.x - 28, rp.y); ctx.lineTo(rp.x - 8, rp.y);
        ctx.moveTo(rp.x + 8, rp.y); ctx.lineTo(rp.x + 28, rp.y);
        ctx.moveTo(rp.x, rp.y - 28); ctx.lineTo(rp.x, rp.y - 8);
        ctx.moveTo(rp.x, rp.y + 8); ctx.lineTo(rp.x, rp.y + 28);
        ctx.stroke();
        // Center dot
        ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
        ctx.beginPath(); ctx.arc(rp.x, rp.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.0003;
      p.life--;
      if (p.life <= 0) { s.particles.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 3 * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Confetti
    for (let i = s.confetti.length - 1; i >= 0; i--) {
      const c = s.confetti[i];
      c.x += c.vx; c.y += c.vy; c.vy += 0.0002;
      c.rot += c.rotV; c.life--;
      if (c.life <= 0 || c.y > 1.2) { s.confetti.splice(i, 1); continue; }
      const a = Math.min(1, c.life / 40);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(c.x * W, c.y * H);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-3, -6, 6, 12);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Result banner
    if (s.phase === 'result' && s.lastResult) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `bold ${Math.min(W * 0.11, 72)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labels: Record<ShotResult, string> = { goal: 'BUT !', save: 'ARRÊTÉ !', post: 'POTEAU !', miss: 'RATÉ !' };
      const colors: Record<ShotResult, string> = { goal: '#22c55e', save: '#ef4444', post: '#f59e0b', miss: '#ef4444' };
      ctx.fillStyle = colors[s.lastResult];
      ctx.shadowBlur = 30;
      ctx.shadowColor = colors[s.lastResult];
      ctx.fillText(labels[s.lastResult], W / 2, H / 2);
      ctx.shadowBlur = 0;
    }

    // Flash
    if (s.flash > 0.01) {
      ctx.fillStyle = `hsla(${s.flashHue}, 100%, 60%, ${s.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
      s.flash *= 0.9;
    }

    s.time++;
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
      <div className="flex items-center justify-between mb-6">
        <Link href={`/${locale}/game`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition" /> Hub
        </Link>
        <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          {muteState ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-emerald-900/50 bg-slate-950 overflow-hidden shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Buts</p>
                <p className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">{ui.goals} / {ui.shots}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Record</p>
                <p className="text-lg font-bold text-yellow-400">{ui.best}</p>
              </div>
              <button onClick={start} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-emerald-500/40">
                {ui.phase === 'ready' ? <Play size={16} /> : <RotateCcw size={16} />}
                <span className="hidden sm:inline">{ui.phase === 'ready' ? 'Jouer' : 'Restart'}</span>
              </button>
            </div>

            <div ref={containerRef} className="relative w-full bg-slate-950">
              <canvas ref={canvasRef} onClick={onClick} onTouchStart={onTouch} className="absolute inset-0 w-full h-full touch-none select-none cursor-crosshair" />

              {ui.phase === 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur text-white text-center p-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/40">
                    <Target size={36} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Penalty Shootout</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">5 tirs. Clique dans le but pour marquer. Le gardien plonge !</p>
                  <button onClick={start} className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center gap-2">
                    <Play size={20} /> Commencer
                  </button>
                </div>
              )}

              {ui.phase === 'done' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur text-white text-center p-4">
                  {ui.goals >= 4 ? (
                    <><Award size={64} className="text-yellow-400 mb-3 animate-pulse" /><h2 className="text-2xl font-bold text-yellow-400 mb-1">EXCELLENT !</h2></>
                  ) : ui.goals >= 2 ? (
                    <><Trophy size={64} className="text-blue-400 mb-3" /><h2 className="text-2xl font-bold mb-1">Bien joué !</h2></>
                  ) : (
                    <><XCircle size={64} className="text-red-400 mb-3" /><h2 className="text-2xl font-bold mb-1">Essaie encore !</h2></>
                  )}
                  <p className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-2">{ui.goals}/{ui.shots}</p>
                  <div className="flex gap-2 mb-4">
                    {ui.shotsLog.map((r, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        r === 'goal' ? 'bg-emerald-500' : r === 'save' ? 'bg-red-500' : r === 'post' ? 'bg-amber-500' : 'bg-slate-600'
                      }`}>
                        {r === 'goal' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-lg text-slate-400 mb-1">{ui.score} points</p>
                  {saved && <p className="text-xs text-green-400 mb-2">✓ Sauvegardé</p>}
                  <div className="flex gap-2 mt-3">
                    <Link href={`/${locale}/game`} className="px-6 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition flex items-center gap-2">
                      <ArrowLeft size={16} /> Hub
                    </Link>
                    <button onClick={start} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center gap-2">
                      <RotateCcw size={16} /> Rejouer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400">
              {ui.phase === 'ready' && 'Clique sur Commencer'}
              {ui.phase === 'aiming' && 'Clique dans le but pour tirer'}
              {ui.phase === 'shooting' && 'Le ballon vole...'}
              {ui.phase === 'result' && ui.lastResult && (
                <span className={ui.lastResult === 'goal' ? 'text-emerald-400' : ui.lastResult === 'post' ? 'text-amber-400' : 'text-red-400'}>
                  {ui.lastResult === 'goal' ? '⚽ But !' : ui.lastResult === 'save' ? '🧤 Arrêté !' : ui.lastResult === 'post' ? '🥅 Poteau !' : '❌ Raté !'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Classement</h2>
            {!user ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-3">Connecte-toi pour sauvegarder</p>
                <Link href={`/${locale}/login`} className="inline-block bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">Connexion</Link>
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Aucun score</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((e: any, i: number) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.full_name || 'Joueur'}</p>
                      <p className="text-[10px] text-slate-500">{e.goals} buts</p>
                    </div>
                    <p className="font-mono font-bold text-emerald-600 text-sm">{e.score}</p>
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