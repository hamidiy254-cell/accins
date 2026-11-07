'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, Target, Crown, Award, Volume2, VolumeX, Maximize2, Minimize2, CheckCircle2, XCircle, Flame, Sparkles, Zap } from 'lucide-react';
import { initAudio, playKick, playCrowd, playWhistle, playPost, playSave, setMuted, isMuted } from '@/lib/game-audio';
import * as THREE from 'three';

// ============================================================
// CONSTANTES
// ============================================================
const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_Z = 12;
const BALL_R = 0.11;
const GRAVITY = 9.8;
const SHOT_TIME = 0.68;
const TOTAL_SHOTS = 5;
const KEEPER_REACH = 1.05;

type Phase = 'ready' | 'aiming' | 'shooting' | 'result' | 'done';
type ShotResult = 'goal' | 'save' | 'post' | 'miss';
type Quality = 'low' | 'medium' | 'high';

export default function PenaltyPage() {
  const locale = useLocale();
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);
  const qualityRef = useRef<Quality>('medium');
  const [muteState, setMuteState] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [achievement, setAchievement] = useState<string | null>(null);

  const T = useRef<any>({
    scene: null, camera: null, renderer: null,
    ball: null, ballTrail: [] as THREE.Vector3[],
    keeperRoot: null, keeperParts: {} as any,
    net: null, netOriginalY: 0,
    posts: [] as THREE.Mesh[],
    cameraBaseZ: 0, cameraBaseY: 0, cameraLookY: 0,
    crowdSprites: [] as THREE.Sprite[],
    floodlights: [] as THREE.SpotLight[],
    raycaster: null, goalPlane: null,
    animId: null, clock: null,
    slowmo: 0,
  });

  const S = useRef({
    phase: 'ready' as Phase,
    mode: 'classic' as 'classic' | 'practice',
    ballPos: new THREE.Vector3(0, BALL_R, 0),
    ballVel: new THREE.Vector3(0, 0, 0),
    ballSpin: 0,
    keeperX: 0, keeperY: 0,
    keeperTargetX: 0, keeperTargetY: 0,
    keeperProgress: 0,
    keeperAnim: 'idle' as 'idle' | 'diveL' | 'diveR' | 'jump' | 'celebrate' | 'frustrated',
    keeperAnimTime: 0,
    goals: 0, saves: 0, shots: 0,
    streak: 0, bestStreak: 0,
    lastResult: null as ShotResult | null,
    shotsLog: [] as ShotResult[],
    netWave: 0,
    resolved: false,
    hitBounce: false,
    cameraShake: 0,
    cameraZoom: 0,
    shootStartTime: 0,
    slowmo: 0,
    flash: 0, flashHue: 90,
    particles: [] as { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }[],
  });

  const [ui, setUi] = useState({
    goals: 0, saves: 0, shots: 0, phase: 'ready' as Phase,
    lastResult: null as ShotResult | null, score: 0, best: 0,
    shotsLog: [] as ShotResult[],
    streak: 0, mode: 'classic' as 'classic' | 'practice',
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  const showAchievement = (msg: string) => {
    setAchievement(msg);
    setTimeout(() => setAchievement(null), 3000);
  };

  useEffect(() => {
    isMobileRef.current = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const cores = (navigator as any).hardwareConcurrency || 4;
    qualityRef.current = isMobileRef.current ? (cores >= 6 ? 'medium' : 'low') : 'high';
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
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // ============================================================
  // TEXTURES PROCÉDURALES
  // ============================================================
  const createGrassTexture = (quality: Quality) => {
    const size = quality === 'high' ? 1024 : quality === 'medium' ? 512 : 256;
    const c = document.createElement('canvas');
    c.width = size; c.height = size * 2;
    const g = c.getContext('2d')!;
    // Base
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#1a5c26'); grad.addColorStop(1, '#0f3d1a');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    // Stripes
    const stripes = 10;
    for (let i = 0; i < stripes; i += 2) {
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(0, (i / stripes) * c.height, c.width, (1 / stripes) * c.height);
    }
    // Grass detail
    const dots = quality === 'high' ? 6000 : quality === 'medium' ? 2000 : 800;
    for (let i = 0; i < dots; i++) {
      const bright = 40 + Math.random() * 80;
      g.fillStyle = `rgba(${bright * 0.4}, ${100 + bright}, ${bright * 0.5}, 0.12)`;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 1.5, 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.anisotropy = quality === 'high' ? 4 : 1;
    return tex;
  };

  const createCrowdTexture = (quality: Quality) => {
    const w = quality === 'high' ? 1024 : quality === 'medium' ? 512 : 256;
    const h = w / 4;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a0a14'; g.fillRect(0, 0, w, h);
    const palette = ['#ef4444','#3b82f6','#fbbf24','#ec4899','#8b5cf6','#06b6d4','#f97316','#10b981','#f43f5e'];
    const dots = quality === 'high' ? 5000 : quality === 'medium' ? 2000 : 800;
    for (let i = 0; i < dots; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const r = 1.5 + Math.random() * 1.5;
      g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    return new THREE.CanvasTexture(c);
  };

  const createBallTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 512, 256);
    // Pentagons
    for (let i = 0; i < 12; i++) {
      const px = (i % 4) * 128 + 64;
      const py = Math.floor(i / 4) * 85 + 42;
      g.fillStyle = '#0f172a';
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
        const r = 18;
        if (j === 0) g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
        else g.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
      g.closePath(); g.fill();
    }
    return new THREE.CanvasTexture(c);
  };

  const createNetTexture = () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 256, 128);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 32; i++) { g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8, 128); g.stroke(); }
    for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(0, i * 8); g.lineTo(256, i * 8); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  };

  const createAdBoardTexture = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#0ea5e9'); grad.addColorStop(0.5, '#8b5cf6'); grad.addColorStop(1, '#ec4899');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 64);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = 'bold 32px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ACCINS · PENALTY · PRO', 256, 32);
    return new THREE.CanvasTexture(c);
  };

  const createParticleTexture = () => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,220,120,0.8)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };

  // ============================================================
  // CRÉATION DU GARDIEN
  // ============================================================
  const buildKeeper = (scene: THREE.Scene, quality: Quality) => {
    const root = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7, roughness: 0.85, metalness: 0 });
    const jerseyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7, metalness: 0.05 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5, metalness: 0.1 });
    const sockMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.85 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3f2a1a, roughness: 0.9 });

    const castShadow = quality !== 'low';

    // TORSO
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), jerseyMat);
    torso.position.y = 1.25;
    torso.castShadow = castShadow;
    root.add(torso);

    // HEAD
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skinMat);
    head.position.y = 1.78;
    head.castShadow = castShadow;
    root.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    hair.position.y = 1.79;
    root.add(hair);

    // ARMS with joints
    const makeArm = (side: number) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(0.28 * side, 1.5, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 8), jerseyMat);
      upper.position.y = -0.18;
      upper.castShadow = castShadow;
      armGroup.add(upper);
      const forearmGroup = new THREE.Group();
      forearmGroup.position.y = -0.38;
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 4, 8), skinMat);
      forearm.position.y = -0.14;
      forearm.castShadow = castShadow;
      forearmGroup.add(forearm);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), gloveMat);
      glove.position.y = -0.3;
      glove.scale.set(1, 1.2, 1);
      forearmGroup.add(glove);
      armGroup.add(forearmGroup);
      return { armGroup, forearmGroup };
    };
    const { armGroup: leftArm, forearmGroup: leftForearm } = makeArm(-1);
    const { armGroup: rightArm, forearmGroup: rightForearm } = makeArm(1);
    root.add(leftArm);
    root.add(rightArm);

    // LEGS with joints
    const makeLeg = (side: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(0.1 * side, 0.85, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8), shortsMat);
      thigh.position.y = -0.2;
      thigh.castShadow = castShadow;
      legGroup.add(thigh);
      const shinGroup = new THREE.Group();
      shinGroup.position.y = -0.42;
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.32, 4, 8), sockMat);
      shin.position.y = -0.18;
      shin.castShadow = castShadow;
      shinGroup.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), bootMat);
      boot.position.y = -0.38;
      boot.position.z = 0.04;
      boot.castShadow = castShadow;
      shinGroup.add(boot);
      legGroup.add(shinGroup);
      return { legGroup, shinGroup };
    };
    const { legGroup: leftLeg, shinGroup: leftShin } = makeLeg(-1);
    const { legGroup: rightLeg, shinGroup: rightShin } = makeLeg(1);
    root.add(leftLeg);
    root.add(rightLeg);

    root.position.set(0, 0, GOAL_Z - 0.6);
    scene.add(root);

    return {
      root, torso, head, hair,
      leftArm, rightArm, leftForearm, rightForearm,
      leftLeg, rightLeg, leftShin, rightShin,
    };
  };

  // ============================================================
  // SETUP THREE.JS
  // ============================================================
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let alive = true;
    const quality = qualityRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050810, 30, 80);
    T.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    camera.position.set(0, 1.6, -3.5);
    camera.lookAt(0, 1.2, GOAL_Z);
    T.current.camera = camera;
    T.current.cameraBaseZ = -3.5;
    T.current.cameraBaseY = 1.6;
    T.current.cameraLookY = 1.2;

    const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x020617);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'crosshair';
    renderer.domElement.style.touchAction = 'none';
    T.current.renderer = renderer;

    // SKY
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16; skyCanvas.height = 256;
    const skg = skyCanvas.getContext('2d')!;
    const skyGrad = skg.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0, '#000008');
    skyGrad.addColorStop(0.4, '#0a1a3d');
    skyGrad.addColorStop(0.75, '#1e3a8a');
    skyGrad.addColorStop(1, '#3b82f6');
    skg.fillStyle = skyGrad;
    skg.fillRect(0, 0, 16, 256);
    scene.background = new THREE.CanvasTexture(skyCanvas);

    // STARS
    const starGeo = new THREE.BufferGeometry();
    const starCount = quality === 'high' ? 600 : quality === 'medium' ? 250 : 100;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 200;
      starPos[i * 3 + 1] = 20 + Math.random() * 80;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 200 + 20;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.9 }));
    scene.add(stars);

    // LIGHTS
    const ambient = new THREE.AmbientLight(0xffffff, quality === 'low' ? 0.9 : 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff5e0, quality === 'low' ? 1.2 : 1.8);
    dirLight.position.set(-10, 22, 4);
    if (quality !== 'low') {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
      dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
      dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
      dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 50;
      dirLight.shadow.bias = -0.001;
    }
    scene.add(dirLight);

    // FLOODLIGHTS
    if (quality !== 'low') {
      for (const x of [-16, 16]) {
        for (const z of [-4, 22]) {
          const spot = new THREE.SpotLight(0xfff5e0, quality === 'high' ? 3 : 2, 60, Math.PI / 6, 0.5, 1.5);
          spot.position.set(x, 14, z);
          spot.target.position.set(0, 0, GOAL_Z);
          scene.add(spot);
          scene.add(spot.target);
          T.current.floodlights.push(spot);
        }
      }
    }

    // GRASS
    const grassTex = createGrassTexture(quality);
    const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95, metalness: 0 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, GOAL_Z + 5);
    grass.receiveShadow = quality !== 'low';
    scene.add(grass);

    // STANDS (tiered steps)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
    const stepGeo = new THREE.BoxGeometry(60, 1, 1.5);
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(stepGeo, standMat);
      step.position.set(0, 1 + i, GOAL_Z + 18 + i * 1.5);
      scene.add(step);
    }

    // CROWD
    const crowdTex = createCrowdTexture(quality);
    const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 1 });
    const crowd = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), crowdMat);
    crowd.position.set(0, 7, GOAL_Z + 22);
    scene.add(crowd);

    // AD BOARDS
    const adTex = createAdBoardTexture();
    const adMat = new THREE.MeshStandardMaterial({ map: adTex, roughness: 0.6, emissive: new THREE.Color(0x334455), emissiveIntensity: 0.3 });
    for (let i = -2; i <= 2; i++) {
      const ad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 0.1), adMat);
      ad.position.set(i * 6.5, 0.35, GOAL_Z + 4);
      scene.add(ad);
    }

    // GOAL POSTS
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.6, emissive: 0x111111 });
    const postGeo = new THREE.CylinderGeometry(0.065, 0.065, GOAL_H, quality === 'high' ? 24 : 12);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    leftPost.castShadow = quality !== 'low';
    scene.add(leftPost);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    rightPost.castShadow = quality !== 'low';
    scene.add(rightPost);
    const barGeo = new THREE.CylinderGeometry(0.065, 0.065, GOAL_W, quality === 'high' ? 24 : 12);
    const crossbar = new THREE.Mesh(barGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, GOAL_H, GOAL_Z);
    crossbar.castShadow = quality !== 'low';
    scene.add(crossbar);
    T.current.posts = [leftPost, rightPost, crossbar];

    // NET (with vertical mesh for depth)
    const netTex = createNetTexture();
    const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const netBack = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
    netBack.position.set(0, GOAL_H / 2, GOAL_Z + 1.5);
    scene.add(netBack);
    T.current.net = netBack;
    T.current.netOriginalY = netBack.position.z;

    // Side nets
    const sideNetGeo = new THREE.PlaneGeometry(1.5, GOAL_H);
    const leftSideNet = new THREE.Mesh(sideNetGeo, netMat);
    leftSideNet.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z + 0.75);
    leftSideNet.rotation.y = Math.PI / 2;
    scene.add(leftSideNet);
    const rightSideNet = new THREE.Mesh(sideNetGeo, netMat);
    rightSideNet.position.set(GOAL_W / 2, GOAL_H / 2, GOAL_Z + 0.75);
    rightSideNet.rotation.y = -Math.PI / 2;
    scene.add(rightSideNet);

    // PENALTY SPOT
    const spotCircle = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    spotCircle.rotation.x = -Math.PI / 2;
    spotCircle.position.set(0, 0.01, 0);
    scene.add(spotCircle);

    // BALL
    const ballTex = createBallTexture();
    const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35, metalness: 0.05 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat);
    ball.castShadow = quality !== 'low';
    ball.position.copy(S.current.ballPos);
    scene.add(ball);
    T.current.ball = ball;

    // KEEPER
    const keeper = buildKeeper(scene, quality);
    T.current.keeperRoot = keeper.root;
    T.current.keeperParts = keeper;

    // RAYCASTER
    T.current.raycaster = new THREE.Raycaster();
    T.current.goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z);
    T.current.clock = new THREE.Clock();

    // RESIZE
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

    // POINTER
    const pointerNDC = (cx: number, cy: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      );
    };

    const aimAndShoot = (cx: number, cy: number) => {
      const s = S.current;
      if (s.phase !== 'aiming') return;
      const ndc = pointerNDC(cx, cy);
      T.current.raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      const hit = T.current.raycaster.ray.intersectPlane(T.current.goalPlane, pt);
      if (!hit) return;
      const tx = Math.max(-GOAL_W / 2 + 0.2, Math.min(GOAL_W / 2 - 0.2, pt.x));
      const ty = Math.max(0.2, Math.min(GOAL_H - 0.15, pt.y));
      shoot(tx, ty);
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      aimAndShoot(e.clientX, e.clientY);
    };
    renderer.domElement.addEventListener('pointerdown', onPointer);

    // ============================================================
    // ANIMATION DU GARDIEN
    // ============================================================
    const animateKeeper = (dt: number, time: number) => {
      const s = S.current;
      const kp = T.current.keeperParts;
      if (!kp) return;

      s.keeperAnimTime += dt;

      // Reset base pose
      kp.leftArm.rotation.set(0, 0, 0.15);
      kp.rightArm.rotation.set(0, 0, -0.15);
      kp.leftForearm.rotation.set(0, 0, 0);
      kp.rightForearm.rotation.set(0, 0, 0);
      kp.leftLeg.rotation.set(0, 0, 0);
      kp.rightLeg.rotation.set(0, 0, 0);
      kp.leftShin.rotation.set(0, 0, 0);
      kp.rightShin.rotation.set(0, 0, 0);
      kp.torso.rotation.set(0, 0, 0);
      kp.head.rotation.set(0, 0, 0);
      kp.root.rotation.set(0, 0, 0);
      kp.root.position.y = 0;

      if (s.keeperAnim === 'idle') {
        // Idle bounce + arm sway
        const sway = Math.sin(time * 2) * 0.06;
        const bounce = Math.abs(Math.sin(time * 3)) * 0.03;
        kp.root.position.x = s.keeperX + sway;
        kp.root.position.y = bounce;
        kp.leftArm.rotation.z = 0.3 + Math.sin(time * 2) * 0.1;
        kp.rightArm.rotation.z = -0.3 - Math.sin(time * 2) * 0.1;
        kp.head.rotation.y = Math.sin(time * 1.5) * 0.15;
      } else if (s.keeperAnim === 'diveL' || s.keeperAnim === 'diveR') {
        const progress = Math.min(1, s.keeperProgress);
        const ease = 1 - Math.pow(1 - progress, 3);
        const dir = s.keeperAnim === 'diveL' ? -1 : 1;

        kp.root.position.x = s.keeperX;
        kp.root.position.y = Math.sin(ease * Math.PI) * 0.6 + s.keeperY * ease;
        kp.root.rotation.z = dir * ease * Math.PI / 2.5;

        // Arms extended toward ball
        kp.leftArm.rotation.z = 0.3 + ease * 1.5;
        kp.rightArm.rotation.z = -0.3 - ease * 1.5;
        if (s.keeperAnim === 'diveL') {
          kp.leftArm.rotation.z = 0.3 + ease * 2.2;
          kp.rightArm.rotation.z = -0.3 - ease * 0.8;
        } else {
          kp.leftArm.rotation.z = 0.3 + ease * 0.8;
          kp.rightArm.rotation.z = -0.3 - ease * 2.2;
        }
        // Legs
        kp.leftLeg.rotation.z = dir * ease * 0.4;
        kp.rightLeg.rotation.z = dir * ease * 0.4;
      } else if (s.keeperAnim === 'jump') {
        const progress = Math.min(1, s.keeperProgress);
        const ease = 1 - Math.pow(1 - progress, 3);
        kp.root.position.y = Math.sin(ease * Math.PI) * 1.8;
        kp.root.position.x = s.keeperX * ease;
        kp.leftArm.rotation.z = 0.3 + ease * 2.5;
        kp.rightArm.rotation.z = -0.3 - ease * 2.5;
        kp.leftLeg.rotation.x = -ease * 0.5;
        kp.rightLeg.rotation.x = -ease * 0.5;
      } else if (s.keeperAnim === 'celebrate') {
        // Arms up
        kp.leftArm.rotation.z = 2.5;
        kp.rightArm.rotation.z = -2.5;
        kp.root.position.y = Math.abs(Math.sin(time * 8)) * 0.15;
      } else if (s.keeperAnim === 'frustrated') {
        // Head down, arms down
        kp.head.rotation.x = 0.5;
        kp.leftArm.rotation.z = 0.05;
        kp.rightArm.rotation.z = -0.05;
      }
    };

    // ============================================================
    // ANIMATION LOOP
    // ============================================================
    let lastTime = performance.now();
    const animate = (now: number) => {
      if (!alive) return;
      const realDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const time = now / 1000;
      const s = S.current;

      // Slowmo effect
      const dt = s.slowmo > 0 ? realDt * 0.35 : realDt;
      if (s.slowmo > 0) s.slowmo -= realDt;

      // Camera cinematic
      if (s.phase === 'shooting' || s.phase === 'result') {
        s.cameraZoom = Math.min(1, s.cameraZoom + realDt * 1.5);
      } else {
        s.cameraZoom = Math.max(0, s.cameraZoom - realDt * 2);
      }
      const camZ = T.current.cameraBaseZ + s.cameraZoom * 1.2;
      const camY = T.current.cameraBaseY + s.cameraZoom * 0.2;
      camera.position.z += (camZ - camera.position.z) * 0.1;
      camera.position.y += (camY - camera.position.y) * 0.1;

      // Camera shake
      if (s.cameraShake > 0.01) {
        camera.position.x = (Math.random() - 0.5) * s.cameraShake * 0.3;
        s.cameraShake *= 0.9;
      } else {
        camera.position.x *= 0.9;
      }
      camera.lookAt(0, T.current.cameraLookY, GOAL_Z);

      // Keeper animation
      animateKeeper(dt, time);

      // Keeper movement during shoot
      if (s.phase === 'shooting' || s.phase === 'result') {
        s.keeperProgress = Math.min(1, s.keeperProgress + dt * 2.5);
        if (s.keeperAnim === 'diveL' || s.keeperAnim === 'diveR' || s.keeperAnim === 'jump') {
          const ease = 1 - Math.pow(1 - s.keeperProgress, 3);
          s.keeperX = s.keeperTargetX * ease;
          if (s.keeperAnim === 'jump') s.keeperY = 0;
          else s.keeperY = s.keeperTargetY * 0.15 * ease;
        }
      }

      // Ball physics
      if (s.phase === 'shooting' && !s.resolved) {
        s.ballPos.x += s.ballVel.x * dt;
        s.ballPos.y += s.ballVel.y * dt;
        s.ballPos.z += s.ballVel.z * dt;
        s.ballVel.y -= GRAVITY * dt;
        s.ballSpin += (s.ballVel.z + s.ballVel.x * 2) * dt * 4;

        if (ball) {
          ball.position.copy(s.ballPos);
          ball.rotation.x = s.ballSpin;
          ball.rotation.y = s.ballSpin * 0.6;
        }

        // Trail
        if (quality !== 'low') {
          T.current.ballTrail.push(s.ballPos.clone());
          if (T.current.ballTrail.length > 15) T.current.ballTrail.shift();
        }

        // Slowmo when near goal
        if (s.ballPos.z > GOAL_Z - 3 && s.slowmo <= 0 && !s.hitBounce) {
          s.slowmo = 0.4;
        }

        if (s.ballPos.z >= GOAL_Z) {
          s.resolved = true;
          resolveResult();
        }
      }

      // Net wave
      if (s.netWave > 0.01 && T.current.net) {
        T.current.net.position.z = T.current.netOriginalY + Math.sin(time * 30) * s.netWave * 0.2;
        s.netWave *= 0.92;
      }

      // Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 8 * dt;
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          s.particles.splice(i, 1);
          continue;
        }
        const lifeRatio = p.life / p.maxLife;
        p.mesh.scale.setScalar(lifeRatio * 0.15 + 0.02);
        (p.mesh.material as THREE.Material).opacity = lifeRatio;
      }

      // Crowd subtle animation (using sprite scale)
      if (quality !== 'low') {
        crowd.position.y = 7 + Math.sin(time * 0.5) * 0.15;
      }

      renderer.render(scene, camera);
      T.current.animId = requestAnimationFrame(animate);
    };
    T.current.animId = requestAnimationFrame(animate);

    // CLEANUP
    return () => {
      alive = false;
      if (T.current.animId) cancelAnimationFrame(T.current.animId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          const m = (obj as any).material;
          if (Array.isArray(m)) m.forEach((mm: any) => mm.dispose());
          else m.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // ============================================================
  // GAMEPLAY
  // ============================================================
  const shoot = (tx: number, ty: number) => {
    const s = S.current;
    if (s.phase !== 'aiming') return;
    s.phase = 'shooting';
    s.resolved = false;
    s.hitBounce = false;
    s.keeperProgress = 0;
    s.shootStartTime = performance.now();

    const dx = tx - s.ballPos.x;
    const dy = ty - s.ballPos.y;
    const dz = GOAL_Z - s.ballPos.z;
    s.ballVel.set(dx / SHOT_TIME, dy / SHOT_TIME + 0.5 * GRAVITY * SHOT_TIME, dz / SHOT_TIME);

    // Keeper AI - smart but fair
    const guessCorrect = Math.random() < 0.38;
    let targetX: number;
    if (guessCorrect) {
      targetX = tx > 0 ? 1.2 + Math.random() * 1.4 : -1.2 - Math.random() * 1.4;
    } else {
      targetX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.8);
    }
    targetX = Math.max(-GOAL_W / 2 + 0.5, Math.min(GOAL_W / 2 - 0.5, targetX));

    // Choose anim based on shot height
    if (ty > GOAL_H * 0.6) {
      s.keeperAnim = Math.abs(targetX) < 0.5 ? 'jump' : (targetX < 0 ? 'diveL' : 'diveR');
      s.keeperTargetY = 2.0;
    } else {
      s.keeperAnim = targetX < 0 ? 'diveL' : 'diveR';
      s.keeperTargetY = ty * 0.3;
    }
    s.keeperTargetX = targetX;

    playKick();
    setUi(p => ({ ...p, phase: 'shooting' }));
  };

  const resolveResult = () => {
    const s = S.current;
    const bx = s.ballPos.x;
    const by = s.ballPos.y;

    const nearPost = Math.abs(Math.abs(bx) - GOAL_W / 2) < BALL_R + 0.2;
    const nearBar = Math.abs(by - GOAL_H) < BALL_R + 0.2;
    const insideX = Math.abs(bx) < GOAL_W / 2 - BALL_R;
    const insideY = by > BALL_R && by < GOAL_H - BALL_R;

    let result: ShotResult = 'goal';

    if (nearPost || nearBar) {
      result = 'post';
      playPost();
      s.cameraShake = 3;
    } else if (!insideX || !insideY) {
      result = 'miss';
    } else {
      const kpx = s.keeperX;
      const kpy = 1.2 + s.keeperY * 0.3;
      const kdist = Math.sqrt((bx - kpx) ** 2 + (by - kpy) ** 2);
      if (kdist < KEEPER_REACH && s.keeperProgress > 0.2) {
        result = 'save';
        playSave();
        s.keeperAnim = 'celebrate';
        s.cameraShake = 2;
      } else {
        result = 'goal';
        s.netWave = 1;
        s.keeperAnim = 'frustrated';
        s.cameraShake = 5;
        playCrowd(true);
        // Spawn confetti
        spawnConfetti();
      }
    }

    s.lastResult = result;
    s.phase = 'result';
    s.shots++;
    s.shotsLog.push(result);
    if (result === 'goal') {
      s.goals++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      if (s.streak === 2) showAchievement('🔥 Double !');
      if (s.streak === 3) showAchievement('🔥🔥 Triplé !');
      if (s.streak === 5) showAchievement('🏆 Série parfaite !');
    } else {
      s.streak = 0;
    }
    if (result === 'save') s.saves++;

    setUi(p => ({
      ...p, phase: 'result', lastResult: result,
      goals: s.goals, saves: s.saves, shots: s.shots,
      shotsLog: [...s.shotsLog], streak: s.streak,
    }));

    setTimeout(() => {
      if (s.mode === 'classic' && s.shots >= TOTAL_SHOTS) {
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

  const spawnConfetti = () => {
    const s = S.current;
    const colors = [0xfbbf24, 0xf43f5e, 0x22c55e, 0x3b82f6, 0xa855f7, 0xf97316];
    const geo = new THREE.SphereGeometry(0.04, 6, 4);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], emissive: colors[Math.floor(Math.random() * colors.length)], emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, GOAL_H / 2, GOAL_Z);
      T.current.scene.add(mesh);
      s.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 4,
        vy: 3 + Math.random() * 3,
        vz: (Math.random() - 0.5) * 2,
        life: 2 + Math.random(),
        maxLife: 3,
      });
    }
  };

  const resetShot = () => {
    const s = S.current;
    s.ballPos.set(0, BALL_R, 0);
    s.ballVel.set(0, 0, 0);
    s.ballSpin = 0;
    s.keeperX = 0;
    s.keeperY = 0;
    s.keeperTargetX = 0;
    s.keeperTargetY = 0;
    s.keeperProgress = 0;
    s.keeperAnim = 'idle';
    s.resolved = false;
    s.netWave = 0;
    s.lastResult = null;
    s.slowmo = 0;
    if (T.current.ball) {
      T.current.ball.position.copy(s.ballPos);
      T.current.ball.rotation.set(0, 0, 0);
    }
    if (T.current.net) T.current.net.position.z = T.current.netOriginalY;
    T.current.ballTrail = [];
    // Clean particles
    S.current.particles.forEach(p => {
      T.current.scene?.remove(p.mesh);
    });
    S.current.particles = [];
  };

  const start = (mode: 'classic' | 'practice' = 'classic') => {
    const s = S.current;
    s.mode = mode;
    s.goals = 0; s.saves = 0; s.shots = 0;
    s.shotsLog = [];
    s.streak = 0;
    s.bestStreak = 0;
    resetShot();
    s.phase = 'aiming';
    setUi(p => ({ ...p, goals: 0, saves: 0, shots: 0, phase: 'aiming', lastResult: null, score: 0, shotsLog: [], streak: 0, mode }));
    setSaved(false);
    playWhistle();
  };

  const finish = async () => {
    const s = S.current;
    const score = s.goals * 100 + s.bestStreak * 20;
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

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[9999] bg-slate-950 flex flex-col' : 'container-custom py-6 md:py-10 max-w-5xl'}>
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-4">
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

      <div className={isFullscreen ? 'grid lg:grid-cols-4 gap-3 p-3 h-full' : 'grid lg:grid-cols-4 gap-6'}>
        <div className={isFullscreen ? 'lg:col-span-3 flex flex-col h-full' : 'lg:col-span-3'}>
          <div className={`rounded-2xl border border-emerald-900/50 bg-slate-950 overflow-hidden shadow-2xl shadow-emerald-500/10 ${isFullscreen ? 'flex flex-col h-full' : ''}`}>
            {/* HUD */}
            <div className="flex items-center justify-between p-2 md:p-3 bg-gradient-to-r from-slate-900 to-slate-950 text-white border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Buts</p>
                  <p className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent leading-tight">{ui.goals} / {ui.shots}</p>
                </div>
                {ui.streak > 1 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40 animate-pulse">
                    <Flame size={12} /><span className="text-xs font-bold">x{ui.streak}</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1 justify-center"><Crown size={11} /> Record</p>
                <p className="text-base font-bold text-yellow-400 leading-tight">{ui.best}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
                  {muteState ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button onClick={() => start('classic')} className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 font-semibold hover:opacity-90 transition flex items-center gap-1 text-xs shadow-lg shadow-emerald-500/40">
                  {ui.phase === 'ready' ? <Play size={14} /> : <RotateCcw size={14} />}
                  <span className="hidden sm:inline">{ui.phase === 'ready' ? 'Jouer' : 'Restart'}</span>
                </button>
              </div>
            </div>

            {/* CANVAS */}
            <div ref={containerRef} className={`relative w-full bg-slate-950 ${isFullscreen ? 'flex-1 min-h-0' : ''}`} style={{ aspectRatio: isFullscreen ? 'auto' : '16/10' }}>
              <div ref={mountRef} className="absolute inset-0" />

              {/* Achievement toast */}
              {achievement && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold shadow-2xl animate-bounce">
                  {achievement}
                </div>
              )}

              {ui.phase === 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur text-white text-center p-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/40">
                    <Target size={36} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">Penalty 3D</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-sm">Choisis ton mode et défie le gardien</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => start('classic')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center justify-center gap-2">
                      <Play size={18} /> Best of 5
                    </button>
                    <button onClick={() => start('practice')} className="px-6 py-3 rounded-xl border border-white/20 text-white font-bold hover:bg-white/10 transition flex items-center justify-center gap-2">
                      <Zap size={18} /> Practice (∞)
                    </button>
                  </div>
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
                  <p className="text-5xl font-black bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent mb-2">{ui.goals}/{ui.shots}</p>
                  <div className="flex gap-2 mb-4">
                    {ui.shotsLog.map((r, i) => (
                      <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center ${r === 'goal' ? 'bg-emerald-500' : r === 'save' ? 'bg-red-500' : r === 'post' ? 'bg-amber-500' : 'bg-slate-600'}`}>
                        {r === 'goal' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-lg text-slate-400 mb-1">{ui.score} points</p>
                  {saved && <p className="text-xs text-green-400 mb-2">✓ Sauvegardé</p>}
                  <div className="flex gap-2 mt-3">
                    <Link href={`/${locale}/game`} className="px-5 py-2.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition flex items-center gap-2">
                      <ArrowLeft size={16} /> Hub
                    </Link>
                    <button onClick={() => start('classic')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold hover:opacity-90 transition shadow-lg shadow-emerald-500/40 flex items-center gap-2">
                      <RotateCcw size={16} /> Rejouer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400">
              {ui.phase === 'ready' && 'Choisis ton mode de jeu'}
              {ui.phase === 'aiming' && '👆 Clique dans le but pour tirer'}
              {ui.phase === 'shooting' && '⚽ Le ballon vole...'}
              {ui.phase === 'result' && ui.lastResult && (
                <span className={ui.lastResult === 'goal' ? 'text-emerald-400 font-bold' : ui.lastResult === 'post' ? 'text-amber-400 font-bold' : 'text-red-400 font-bold'}>
                  {ui.lastResult === 'goal' ? '⚽ BUT !' : ui.lastResult === 'save' ? '🧤 ARRÊTÉ !' : ui.lastResult === 'post' ? '🥅 POTEAU !' : '❌ RATÉ !'}
                </span>
              )}
            </div>
          </div>
        </div>

        {!isFullscreen && (
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-500" /> Top 10</h2>
              {!user ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500 mb-2">Connecte-toi pour sauvegarder</p>
                  <Link href={`/${locale}/login`} className="inline-block bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">Connexion</Link>
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Aucun score</p>
              ) : (
                <div className="space-y-1.5">
                  {leaderboard.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg text-xs ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : i === 1 ? 'bg-slate-50 dark:bg-slate-800/50' : i === 2 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{i + 1}</div>
                      <p className="flex-1 font-medium truncate">{e.full_name || 'Joueur'}</p>
                      <p className="font-mono font-bold text-emerald-600 shrink-0">{e.score}</p>
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