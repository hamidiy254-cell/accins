'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, Target, Crown, Award, Volume2, VolumeX, Maximize2, Minimize2, CheckCircle2, XCircle } from 'lucide-react';
import { initAudio, playKick, playCrowd, playWhistle, playPost, playSave, setMuted, isMuted } from '@/lib/game-audio';
import * as THREE from 'three';

const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_Z = 12;
const BALL_R = 0.11;
const GRAVITY = 9.8;
const SHOT_TIME = 0.62;
const TOTAL_SHOTS = 5;
const KEEPER_REACH = 1.15;

type Phase = 'ready' | 'aiming' | 'shooting' | 'result' | 'done';
type ShotResult = 'goal' | 'save' | 'post' | 'miss';

export default function PenaltyPage() {
  const locale = useLocale();
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);
  const [muteState, setMuteState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const threeRef = useRef<any>({
    scene: null, camera: null, renderer: null, ball: null, ballShadow: null,
    keeper: null, keeperArms: null, net: null, raycaster: null, goalPlane: null,
    goalMesh: null, animId: null, ambient: null, dirLight: null,
  });

  const S = useRef({
    phase: 'ready' as Phase,
    ballPos: new THREE.Vector3(0, BALL_R, 0),
    ballVel: new THREE.Vector3(0, 0, 0),
    ballSpin: 0,
    targetPos: new THREE.Vector3(0, 1.1, GOAL_Z),
    keeperX: 0, keeperY: 1.15,
    keeperTargetX: 0, keeperTargetY: 1.15,
    keeperProgress: 0,
    keeperAnim: 'idle',
    goals: 0, saves: 0, shots: 0,
    lastResult: null as ShotResult | null,
    shotsLog: [] as ShotResult[],
    netWave: 0,
    resolved: false,
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
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFS);
    return () => document.removeEventListener('fullscreenchange', onFS);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ============ THREE.JS SETUP ============
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let alive = true;
    const R = threeRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x051018, 25, 60);
    R.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    camera.position.set(0, 1.4, -3);
    camera.lookAt(0, 1.1, GOAL_Z);
    R.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobileRef.current, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(isMobileRef.current ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = !isMobileRef.current;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x020617, 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'crosshair';
    R.renderer = renderer;

    // Sky gradient background
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16;
    skyCanvas.height = 256;
    const skg = skyCanvas.getContext('2d')!;
    const grad = skg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, '#0a1a3d');
    grad.addColorStop(1, '#1e3a8a');
    skg.fillStyle = grad;
    skg.fillRect(0, 0, 16, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    scene.background = skyTex;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    R.ambient = ambient;

    const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.6);
    dirLight.position.set(-8, 20, 3);
    dirLight.castShadow = !isMobileRef.current;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    scene.add(dirLight);
    R.dirLight = dirLight;

    // Floodlights
    for (const x of [-14, 14]) {
      for (const z of [-2, 20]) {
        const pl = new THREE.PointLight(0xfff5e0, 1.2, 40, 2);
        pl.position.set(x, 12, z);
        scene.add(pl);
      }
    }

    // Grass texture
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 512;
    grassCanvas.height = 1024;
    const gg = grassCanvas.getContext('2d')!;
    gg.fillStyle = '#15682f';
    gg.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        gg.fillStyle = '#1a7a38';
        gg.fillRect(0, i * 128, 512, 128);
      }
    }
    for (let i = 0; i < 3000; i++) {
      gg.fillStyle = `rgba(${30 + Math.random() * 40}, ${100 + Math.random() * 60}, ${40 + Math.random() * 30}, 0.15)`;
      gg.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
    }
    const grassTex = new THREE.CanvasTexture(grassCanvas);
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(2, 2);
    grassTex.anisotropy = isMobileRef.current ? 1 : 4;

    const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95, metalness: 0 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, GOAL_Z + 5);
    grass.receiveShadow = !isMobileRef.current;
    scene.add(grass);

    // Stadium stands (background)
    const crowdCanvas = document.createElement('canvas');
    crowdCanvas.width = 1024;
    crowdCanvas.height = 256;
    const cg = crowdCanvas.getContext('2d')!;
    cg.fillStyle = '#0a0f1e';
    cg.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 3000; i++) {
      const colors = ['#4b5563', '#6b7280', '#374151', '#7c3aed', '#0891b2', '#f59e0b', '#ec4899', '#f43f5e'];
      cg.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      cg.beginPath();
      cg.arc(Math.random() * 1024, Math.random() * 256, 2.5, 0, Math.PI * 2);
      cg.fill();
    }
    const crowdTex = new THREE.CanvasTexture(crowdCanvas);
    const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 });
    const crowd = new THREE.Mesh(new THREE.PlaneGeometry(60, 15), crowdMat);
    crowd.position.set(0, 7, GOAL_Z + 25);
    scene.add(crowd);

    // Goal posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.6 });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, GOAL_H, 16);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    leftPost.castShadow = !isMobileRef.current;
    scene.add(leftPost);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    rightPost.castShadow = !isMobileRef.current;
    scene.add(rightPost);
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, GOAL_W, 16);
    const crossbar = new THREE.Mesh(barGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, GOAL_H, GOAL_Z);
    crossbar.castShadow = !isMobileRef.current;
    scene.add(crossbar);

    // Net
    const netCanvas = document.createElement('canvas');
    netCanvas.width = 256;
    netCanvas.height = 128;
    const ng = netCanvas.getContext('2d')!;
    ng.clearRect(0, 0, 256, 128);
    ng.strokeStyle = 'rgba(255,255,255,0.65)';
    ng.lineWidth = 2;
    for (let i = 0; i <= 32; i++) {
      ng.beginPath(); ng.moveTo(i * 8, 0); ng.lineTo(i * 8, 128); ng.stroke();
    }
    for (let i = 0; i <= 16; i++) {
      ng.beginPath(); ng.moveTo(0, i * 8); ng.lineTo(256, i * 8); ng.stroke();
    }
    const netTex = new THREE.CanvasTexture(netCanvas);
    netTex.wrapS = THREE.RepeatWrapping;
    netTex.wrapT = THREE.RepeatWrapping;
    netTex.repeat.set(3, 2);
    const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
    net.position.set(0, GOAL_H / 2, GOAL_Z + 1.2);
    scene.add(net);
    R.net = net;

    // Ball
    const ballCanvas = document.createElement('canvas');
    ballCanvas.width = 512;
    ballCanvas.height = 256;
    const bg = ballCanvas.getContext('2d')!;
    bg.fillStyle = '#f8fafc';
    bg.fillRect(0, 0, 512, 256);
    bg.fillStyle = '#0f172a';
    for (let i = 0; i < 12; i++) {
      const x = (i % 4) * 128 + 64 + (Math.random() - 0.5) * 20;
      const y = Math.floor(i / 4) * 85 + 42;
      bg.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
        const r = 18;
        if (j === 0) bg.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else bg.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      bg.closePath();
      bg.fill();
    }
    const ballTex = new THREE.CanvasTexture(ballCanvas);
    const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35, metalness: 0.05 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat);
    ball.castShadow = !isMobileRef.current;
    ball.position.copy(S.current.ballPos);
    scene.add(ball);
    R.ball = ball;

    // Ball shadow decal (fallback for mobile where shadows are off)
    if (isMobileRef.current) {
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 64; shadowCanvas.height = 64;
      const sg = shadowCanvas.getContext('2d')!;
      const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(0,0,0,0.5)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = rg;
      sg.fillRect(0, 0, 64, 64);
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
      const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), shadowMat);
      ballShadow.rotation.x = -Math.PI / 2;
      ballShadow.position.copy(S.current.ballPos);
      ballShadow.position.y = 0.001;
      scene.add(ballShadow);
      R.ballShadow = ballShadow;
    }

    // Keeper (simple humanoid with boxes)
    const keeper = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.6 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.28), skinMat);
    torso.position.y = 1.05;
    torso.castShadow = !isMobileRef.current;
    keeper.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), headMat);
    head.position.y = 1.68;
    head.castShadow = !isMobileRef.current;
    keeper.add(head);

    const armGeo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.35, 1.05, 0);
    leftArm.rotation.z = Math.PI / 8;
    keeper.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.35, 1.05, 0);
    rightArm.rotation.z = -Math.PI / 8;
    keeper.add(rightArm);
    R.keeperArms = { left: leftArm, right: rightArm };

    const gloveGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const lGlove = new THREE.Mesh(gloveGeo, gloveMat);
    lGlove.position.set(-0.42, 1.35, 0);
    keeper.add(lGlove);
    const rGlove = new THREE.Mesh(gloveGeo, gloveMat);
    rGlove.position.set(0.42, 1.35, 0);
    keeper.add(rGlove);

    const legGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const leftLeg = new THREE.Mesh(legGeo, skinMat);
    leftLeg.position.set(-0.13, 0.4, 0);
    leftLeg.castShadow = !isMobileRef.current;
    keeper.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, skinMat);
    rightLeg.position.set(0.13, 0.4, 0);
    rightLeg.castShadow = !isMobileRef.current;
    keeper.add(rightLeg);

    keeper.position.set(0, 0, GOAL_Z - 0.5);
    scene.add(keeper);
    R.keeper = keeper;

    // Raycaster for aiming
    const raycaster = new THREE.Raycaster();
    const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z);
    R.raycaster = raycaster;
    R.goalPlane = goalPlane;

    // Resize
    const resize = () => {
      const container = mountRef.current;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Pointer events
    const pointerToNDC = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      return new THREE.Vector2(x, y);
    };

    const aimAndShoot = (clientX: number, clientY: number) => {
      const s = S.current;
      if (s.phase !== 'aiming') return;

      const ndc = pointerToNDC(clientX, clientY);
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(goalPlane, pt);
      if (!hit) return;

      const tx = Math.max(-GOAL_W / 2 + 0.2, Math.min(GOAL_W / 2 - 0.2, pt.x));
      const ty = Math.max(0.2, Math.min(GOAL_H - 0.15, pt.y));
      s.targetPos.set(tx, ty, GOAL_Z);
      shoot(tx, ty);
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      aimAndShoot(e.clientX, e.clientY);
    };

    renderer.domElement.addEventListener('pointerdown', onPointer);

    // Animation loop
    let lastTime = performance.now();
    const animate = (now: number) => {
      if (!alive) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = S.current;

      // Keeper movement
      if (s.phase === 'shooting' || s.phase === 'result') {
        s.keeperProgress = Math.min(1, s.keeperProgress + dt * 2.2);
        const ease = 1 - Math.pow(1 - s.keeperProgress, 3);
        s.keeperX = s.keeperTargetX * ease;
        s.keeperY = 1.15 + (s.keeperTargetY - 1.15) * ease;
        if (keeper) {
          keeper.position.x = s.keeperX;
          keeper.position.y = s.keeperY - 1.15;
          if (R.keeperArms) {
            const spread = ease;
            R.keeperArms.left.rotation.z = Math.PI / 8 + spread * 1.4;
            R.keeperArms.right.rotation.z = -Math.PI / 8 - spread * 1.4;
            R.keeperArms.left.position.x = -0.35 - spread * 0.5;
            R.keeperArms.right.position.x = 0.35 + spread * 0.5;
          }
        }
      } else if (s.phase === 'aiming' || s.phase === 'ready') {
        // Idle sway
        const sway = Math.sin(now / 800) * 0.05;
        if (keeper) {
          keeper.position.x = sway;
          keeper.position.y = 0;
        }
        if (R.keeperArms) {
          R.keeperArms.left.rotation.z = Math.PI / 8;
          R.keeperArms.right.rotation.z = -Math.PI / 8;
          R.keeperArms.left.position.x = -0.35;
          R.keeperArms.right.position.x = 0.35;
        }
      }

      // Ball physics
      if (s.phase === 'shooting' && !s.resolved) {
        s.ballPos.x += s.ballVel.x * dt;
        s.ballPos.y += s.ballVel.y * dt;
        s.ballPos.z += s.ballVel.z * dt;
        s.ballVel.y -= GRAVITY * dt;
        s.ballSpin += (s.ballVel.z + s.ballVel.x) * dt * 4;

        if (ball) {
          ball.position.copy(s.ballPos);
          ball.rotation.x = s.ballSpin;
          ball.rotation.y = s.ballSpin * 0.5;
        }
        if (R.ballShadow) {
          R.ballShadow.position.set(s.ballPos.x, 0.001, s.ballPos.z);
          const scale = 1 + Math.max(0, s.ballPos.y) * 0.8;
          R.ballShadow.scale.set(scale, scale, 1);
          (R.ballShadow.material as any).opacity = Math.max(0.05, 0.5 - s.ballPos.y * 0.15);
        }

        // Net deformation
        if (s.netWave > 0.01 && net) {
          net.scale.z = 1 + s.netWave * 0.15;
          s.netWave *= 0.9;
        }

        // Detect crossing goal plane
        if (s.ballPos.z >= GOAL_Z) {
          s.resolved = true;
          resolveResult();
        }
      }

      // Result timer
      if (s.phase === 'result') {
        s.resultTimer += dt;
      }

      renderer.render(scene, camera);
      R.animId = requestAnimationFrame(animate);
    };
    R.animId = requestAnimationFrame(animate);

    return () => {
      alive = false;
      if (R.animId) cancelAnimationFrame(R.animId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          const m = (obj as any).material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const shoot = (tx: number, ty: number) => {
    const s = S.current;
    if (s.phase !== 'aiming') return;
    s.phase = 'shooting';
    s.resolved = false;
    s.keeperProgress = 0;

    const dx = tx - s.ballPos.x;
    const dy = ty - s.ballPos.y;
    const dz = GOAL_Z - s.ballPos.z;
    s.ballVel.set(dx / SHOT_TIME, dy / SHOT_TIME + 0.5 * GRAVITY * SHOT_TIME, dz / SHOT_TIME);

    // Keeper AI - 40% chance to guess correct side
    const guessCorrect = Math.random() < 0.4;
    let keeperTargetX: number;
    if (guessCorrect) {
      keeperTargetX = tx > 0 ? 1.3 + Math.random() * 1.2 : -1.3 - Math.random() * 1.2;
    } else {
      keeperTargetX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.8);
    }
    keeperTargetX = Math.max(-GOAL_W / 2 + 0.4, Math.min(GOAL_W / 2 - 0.4, keeperTargetX));
    const keeperTargetY = ty > GOAL_H * 0.55 && Math.random() < 0.5 ? 1.5 + Math.random() * 0.6 : 0.85 + Math.random() * 0.35;
    s.keeperTargetX = keeperTargetX;
    s.keeperTargetY = keeperTargetY;

    playKick();
    setUi(p => ({ ...p, phase: 'shooting' }));
  };

  const resolveResult = () => {
    const s = S.current;
    const bx = s.ballPos.x;
    const by = s.ballPos.y;

    const nearPost = Math.abs(Math.abs(bx) - GOAL_W / 2) < BALL_R + 0.15;
    const nearBar = Math.abs(by - GOAL_H) < BALL_R + 0.15;
    const insideX = Math.abs(bx) < GOAL_W / 2 - BALL_R;
    const insideY = by > BALL_R && by < GOAL_H - BALL_R;
    const insideGoal = insideX && insideY;

    let result: ShotResult = 'goal';

    if (nearPost || nearBar) {
      result = 'post';
      playPost();
    } else if (!insideGoal) {
      result = 'miss';
    } else {
      const kpX = s.keeperX;
      const kpY = s.keeperY;
      const kdist = Math.sqrt((bx - kpX) ** 2 + (by - kpY) ** 2);
      if (kdist < KEEPER_REACH && s.keeperProgress > 0.25) {
        result = 'save';
        playSave();
      } else {
        result = 'goal';
        s.netWave = 1;
        playCrowd(true);
      }
    }

    s.lastResult = result;
    s.phase = 'result';
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
    }, 2000);
  };

  const resetShot = () => {
    const s = S.current;
    s.ballPos.set(0, BALL_R, 0);
    s.ballVel.set(0, 0, 0);
    s.ballSpin = 0;
    s.keeperX = 0;
    s.keeperY = 1.15;
    s.keeperTargetX = 0;
    s.keeperTargetY = 1.15;
    s.keeperProgress = 0;
    s.resolved = false;
    s.netWave = 0;
    s.lastResult = null;
    if (threeRef.current.ball) {
      threeRef.current.ball.position.copy(s.ballPos);
      threeRef.current.ball.rotation.set(0, 0, 0);
    }
    if (threeRef.current.keeper) {
      threeRef.current.keeper.position.set(0, 0, GOAL_Z - 0.5);
    }
    if (threeRef.current.net) {
      threeRef.current.net.scale.z = 1;
    }
  };

  const start = () => {
    const s = S.current;
    s.goals = 0; s.saves = 0; s.shots = 0;
    s.shotsLog = [];
    resetShot();
    s.phase = 'aiming';
    setUi(p => ({ ...p, goals: 0, saves: 0, shots: 0, phase: 'aiming', lastResult: null, score: 0, shotsLog: [] }));
    setSaved(false);
    playWhistle();
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

  const toggleMute = () => {
    const m = !isMuted(); setMuted(m); setMuteState(m);
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-950 flex flex-col' : 'container-custom py-6 md:py-10 max-w-5xl'}>
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-6">
          <Link href={`/${locale}/game`} className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition" /> Hub
          </Link>
          <div className="flex gap-2">
            <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              {muteState ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      )}

      <div className={isFullscreen ? 'grid lg:grid-cols-3 gap-3 p-3 h-full' : 'grid lg:grid-cols-3 gap-6'}>
        <div className={isFullscreen ? 'lg:col-span-3 flex flex-col h-full' : 'lg:col-span-2'}>
          <div className={`rounded-2xl border border-emerald-900/50 bg-slate-950 overflow-hidden shadow-2xl shadow-emerald-500/10 ${isFullscreen ? 'flex flex-col h-full' : ''}`}>
            <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800 flex-wrap gap-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Buts</p>
                <p className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">{ui.goals} / {ui.shots}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={12} /> Record</p>
                <p className="text-lg font-bold text-yellow-400">{ui.best}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
                  {muteState ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button onClick={start} className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 font-semibold hover:opacity-90 transition flex items-center gap-1.5 text-sm shadow-lg shadow-emerald-500/40">
                  {ui.phase === 'ready' ? <Play size={16} /> : <RotateCcw size={16} />}
                  <span className="hidden sm:inline">{ui.phase === 'ready' ? 'Jouer' : 'Restart'}</span>
                </button>
              </div>
            </div>

            <div ref={containerRef} className={`relative w-full bg-slate-950 ${isFullscreen ? 'flex-1 min-h-0' : ''}`} style={{ aspectRatio: isFullscreen ? 'auto' : '16/10' }}>
              <div ref={mountRef} className="absolute inset-0" />

              {ui.phase === 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur text-white text-center p-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/40">
                    <Target size={36} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Penalty 3D</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-xs">5 tirs. Clique dans le but pour tirer. Le gardien plonge en 3D temps réel.</p>
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

        {!isFullscreen && (
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
        )}
      </div>
    </div>
  );
}