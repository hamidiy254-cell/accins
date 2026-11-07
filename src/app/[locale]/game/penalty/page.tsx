'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, Target, Crown, Award, Volume2, VolumeX, Maximize2, Minimize2, CheckCircle2, XCircle, Flame, Zap } from 'lucide-react';
import { initAudio, playKick, playCrowd, playWhistle, playPost, playSave, setMuted, isMuted } from '@/lib/game-audio';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_Z = 12;
const BALL_R = 0.11;
const GRAVITY = 9.8;
const TOTAL_SHOTS = 5;
const KEEPER_REACH = 1.05;
const SHOT_DURATION = 0.72;
const BALL_START = { x: 0, y: BALL_R, z: 0 };
const SHOOTER_POS = { x: -0.4, y: 0, z: -1.4 };
const CAMERA_POS = { x: -2.0, y: 2.2, z: -5.5 };
const CAMERA_LOOK = { x: 0, y: 1.5, z: 8 };

const PLAYER_MODEL_URL = '/models/player.glb';
const KEEPER_MODEL_URL = '/models/keeper.glb';
const FALLBACK_MODEL_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';

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
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);

  const T = useRef<any>({
    scene: null, camera: null, renderer: null,
    ball: null, ballTrail: [] as THREE.Vector3[],
    player: null, keeper: null,
    playerMixer: null, keeperMixer: null,
    playerActions: {} as any, keeperActions: {} as any,
    playerCurrent: 'idle' as string,
    keeperCurrent: 'idle' as string,
    net: null, netBaseZ: 0,
    raycaster: null, goalPlane: null,
    animId: null,
    modelsLoaded: false,
  });

  const S = useRef({
    phase: 'ready' as Phase,
    mode: 'classic' as 'classic' | 'practice',
    ballPos: new THREE.Vector3(BALL_START.x, BALL_START.y, BALL_START.z),
    ballVel: new THREE.Vector3(0, 0, 0),
    ballSpin: new THREE.Vector3(0, 0, 0),
    ballCurve: 0,
    keeperX: 0, keeperTargetX: 0,
    keeperProgress: 0,
    keeperDiveDir: 0,
    goals: 0, saves: 0, shots: 0,
    streak: 0, bestStreak: 0,
    lastResult: null as ShotResult | null,
    shotsLog: [] as ShotResult[],
    netWave: 0,
    resolved: false,
    cameraShake: 0,
    cameraZoom: 0,
    slowmo: 0,
    flash: 0, flashHue: 90,
    particles: [] as { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }[],
    time: 0,
  });

  const [ui, setUi] = useState({
    goals: 0, saves: 0, shots: 0, phase: 'ready' as Phase,
    lastResult: null as ShotResult | null, score: 0, best: 0,
    shotsLog: [] as ShotResult[], streak: 0, mode: 'classic' as 'classic' | 'practice',
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
  // TEXTURES
  // ============================================================
  const texGrass = (q: Quality) => {
    const s = q === 'high' ? 1024 : q === 'medium' ? 512 : 256;
    const c = document.createElement('canvas');
    c.width = s; c.height = s * 2;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#1e6b28'); grad.addColorStop(1, '#0d3d18');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 12; i += 2) {
      g.fillStyle = 'rgba(255,255,255,0.035)';
      g.fillRect(0, (i / 12) * c.height, c.width, (1 / 12) * c.height);
    }
    const dots = q === 'high' ? 8000 : q === 'medium' ? 3000 : 1000;
    for (let i = 0; i < dots; i++) {
      const br = 40 + Math.random() * 80;
      g.fillStyle = `rgba(${br * 0.4}, ${100 + br}, ${br * 0.5}, 0.15)`;
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 1.5, 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    t.anisotropy = q === 'high' ? 4 : 1;
    return t;
  };

  const texCrowd = (q: Quality) => {
    const w = q === 'high' ? 1024 : q === 'medium' ? 512 : 256;
    const h = w / 4;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0a0a14'; g.fillRect(0, 0, w, h);
    const palette = ['#ef4444','#3b82f6','#fbbf24','#ec4899','#8b5cf6','#06b6d4','#f97316','#10b981','#f43f5e','#a855f7'];
    const dots = q === 'high' ? 6000 : q === 'medium' ? 2500 : 1000;
    for (let i = 0; i < dots; i++) {
      g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
    return new THREE.CanvasTexture(c);
  };

  const texBall = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 512, 256);
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

  const texNet = () => {
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

  const texAd = () => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#0ea5e9'); grad.addColorStop(0.5, '#8b5cf6'); grad.addColorStop(1, '#ec4899');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 64);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = 'bold 28px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ACCINS · PENALTY · PRO', 256, 32);
    return new THREE.CanvasTexture(c);
  };

  // ============================================================
  // LOAD MODELS
  // ============================================================
  const loadModel = (url: string): Promise<any> => {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        () => resolve(null) // fallback silently on error
      );
    });
  };

  const setupCharacter = (gltf: any, scale: number, position: { x: number; y: number; z: number }, rotationY: number, scene: THREE.Scene) => {
    if (!gltf) return null;
    const model = gltf.scene.clone(true);
    model.scale.setScalar(scale);
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotationY;

    model.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m: any) => {
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          });
        }
      }
    });

    scene.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations || [];
    const findClip = (name: string) => clips.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()));

    const actions: any = {};
    const idleClip = findClip('idle');
    const runClip = findClip('run') || findClip('walk');
    const tposeClip = findClip('tpose');

    if (idleClip) { actions.idle = mixer.clipAction(idleClip); actions.idle.play(); }
    if (runClip) { actions.run = mixer.clipAction(runClip); }
    if (tposeClip) { actions.tpose = mixer.clipAction(tposeClip); }

    return { model, mixer, actions, current: 'idle' };
  };

  const switchAnim = (char: any, animName: string, fade: number = 0.25) => {
    if (!char || !char.actions || !char.actions[animName]) return;
    if (char.current === animName) return;
    const prev = char.actions[char.current];
    const next = char.actions[animName];
    if (prev) prev.fadeOut(fade);
    next.reset().fadeIn(fade).play();
    char.current = animName;
  };

  // ============================================================
  // SETUP
  // ============================================================
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let alive = true;
    const quality = qualityRef.current;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x020617, 32, 85);
    T.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
    camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y, CAMERA_LOOK.z);
    T.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', alpha: false });
    renderer.setPixelRatio(quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x020617);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:crosshair;touch-action:none';
    T.current.renderer = renderer;

    // SKY
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 16; skyCanvas.height = 256;
    const skg = skyCanvas.getContext('2d')!;
    const skyGrad = skg.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0, '#000005');
    skyGrad.addColorStop(0.5, '#0a1a3d');
    skyGrad.addColorStop(1, '#1e3a8a');
    skg.fillStyle = skyGrad;
    skg.fillRect(0, 0, 16, 256);
    scene.background = new THREE.CanvasTexture(skyCanvas);

    // STARS
    const starCount = quality === 'high' ? 800 : quality === 'medium' ? 350 : 150;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 200;
      starPos[i * 3 + 1] = 25 + Math.random() * 80;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 200 + 20;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.9 })));

    // LIGHTS
    scene.add(new THREE.AmbientLight(0xffffff, quality === 'low' ? 0.95 : 0.55));
    const dirLight = new THREE.DirectionalLight(0xfff5e0, quality === 'low' ? 1.3 : 1.9);
    dirLight.position.set(-12, 24, 6);
    if (quality !== 'low') {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
      dirLight.shadow.camera.left = -16; dirLight.shadow.camera.right = 16;
      dirLight.shadow.camera.top = 16; dirLight.shadow.camera.bottom = -16;
      dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 60;
      dirLight.shadow.bias = -0.0008;
    }
    scene.add(dirLight);

    if (quality !== 'low') {
      for (const x of [-18, 18]) {
        for (const z of [-6, 24]) {
          const spot = new THREE.SpotLight(0xfff5e0, quality === 'high' ? 4 : 2.5, 70, Math.PI / 6, 0.55, 1.4);
          spot.position.set(x, 16, z);
          spot.target.position.set(0, 0, GOAL_Z);
          scene.add(spot, spot.target);
        }
      }
    }

    // GRASS
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ map: texGrass(quality), roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, GOAL_Z + 5);
    grass.receiveShadow = quality !== 'low';
    scene.add(grass);

    // STANDS
    const standMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1e, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(64, 1, 1.5), standMat);
      step.position.set(0, 1 + i, GOAL_Z + 18 + i * 1.5);
      scene.add(step);
    }

    // CROWD
    const crowd = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 12),
      new THREE.MeshStandardMaterial({ map: texCrowd(quality), roughness: 1 })
    );
    crowd.position.set(0, 7, GOAL_Z + 23);
    scene.add(crowd);

    // AD BOARDS
    const adMat = new THREE.MeshStandardMaterial({
      map: texAd(), roughness: 0.6,
      emissive: new THREE.Color(0x223344), emissiveIntensity: 0.35,
    });
    for (let i = -2; i <= 2; i++) {
      const ad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 0.1), adMat);
      ad.position.set(i * 6.5, 0.35, GOAL_Z + 4);
      scene.add(ad);
    }

    // POSTS
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.6 });
    const postGeo = new THREE.CylinderGeometry(0.065, 0.065, GOAL_H, quality === 'high' ? 24 : 12);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    leftPost.castShadow = quality !== 'low';
    scene.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = GOAL_W / 2;
    scene.add(rightPost);
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, GOAL_W, quality === 'high' ? 24 : 12),
      postMat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, GOAL_H, GOAL_Z);
    crossbar.castShadow = quality !== 'low';
    scene.add(crossbar);

    // NET
    const netMat = new THREE.MeshBasicMaterial({
      map: texNet(), transparent: true, opacity: 0.85, side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
    net.position.set(0, GOAL_H / 2, GOAL_Z + 1.5);
    scene.add(net);
    T.current.net = net;
    T.current.netBaseZ = net.position.z;

    const sideNetGeo = new THREE.PlaneGeometry(1.5, GOAL_H);
    const leftSide = new THREE.Mesh(sideNetGeo, netMat);
    leftSide.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z + 0.75);
    leftSide.rotation.y = Math.PI / 2;
    scene.add(leftSide);
    const rightSide = leftSide.clone();
    rightSide.position.x = GOAL_W / 2;
    scene.add(rightSide);

    // SPOT
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(0, 0.01, 0);
    scene.add(spot);

    // BALL
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 32, 24),
      new THREE.MeshStandardMaterial({ map: texBall(), roughness: 0.35, metalness: 0.05 })
    );
    ball.castShadow = quality !== 'low';
    ball.position.copy(S.current.ballPos);
    scene.add(ball);
    T.current.ball = ball;

    // RAYCASTER
    T.current.raycaster = new THREE.Raycaster();
    T.current.goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -GOAL_Z);

    // RESIZE
    const resize = () => {
      const c = mountRef.current;
      if (!c) return;
      const w = c.clientWidth, h = c.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // POINTER
    const aimAndShoot = (cx: number, cy: number) => {
      const s = S.current;
      if (s.phase !== 'aiming') return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1
      );
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

    // LOAD MODELS (async)
    (async () => {
      // Try local player model first, then fallback to CDN
      let playerGltf = await loadModel(PLAYER_MODEL_URL);
      let keeperGltf = await loadModel(KEEPER_MODEL_URL);

      // Fallback to CDN
      if (!playerGltf || !keeperGltf) {
        const fallback = await loadModel(FALLBACK_MODEL_URL);
        if (!playerGltf) playerGltf = fallback;
        if (!keeperGltf) keeperGltf = fallback;
      }

      if (!alive) return;

      if (playerGltf) {
        const player = setupCharacter(playerGltf, 1.0, SHOOTER_POS, Math.PI * 0.05, scene);
        if (player) {
          T.current.player = player;
          T.current.playerMixer = player.mixer;
          T.current.playerActions = player.actions;
        }
      }

      if (keeperGltf) {
        const keeper = setupCharacter(keeperGltf, 1.0, { x: 0, y: 0, z: GOAL_Z - 1.0 }, Math.PI, scene);
        if (keeper) {
          T.current.keeper = keeper;
          T.current.keeperMixer = keeper.mixer;
          T.current.keeperActions = keeper.actions;
        }
      }

      T.current.modelsLoaded = true;
      setModelsReady(true);
      setLoadingModels(false);
    })();

    // ANIMATE
    let last = performance.now();
    const animate = (now: number) => {
      if (!alive) return;
      const realDt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = S.current;
      s.time = now / 1000;

      const dt = s.slowmo > 0 ? realDt * 0.35 : realDt;
      if (s.slowmo > 0) s.slowmo -= realDt;

      // Camera
      s.cameraZoom += ((s.phase === 'shooting' || s.phase === 'result') ? 1 : 0) * realDt * 1.5 - s.cameraZoom * realDt * 2;
      s.cameraZoom = Math.max(0, Math.min(1, s.cameraZoom));
      camera.position.z = CAMERA_POS.z + s.cameraZoom * 1.2;
      camera.position.y = CAMERA_POS.y + s.cameraZoom * 0.2;
      if (s.cameraShake > 0.01) {
        camera.position.x = CAMERA_POS.x + (Math.random() - 0.5) * s.cameraShake * 0.3;
        s.cameraShake *= 0.9;
      } else {
        camera.position.x = CAMERA_POS.x;
      }
      camera.lookAt(CAMERA_LOOK.x, CAMERA_LOOK.y, CAMERA_LOOK.z);

      // Mixers
      if (T.current.playerMixer) T.current.playerMixer.update(dt);
      if (T.current.keeperMixer) T.current.keeperMixer.update(dt);

      // Keeper dive animation (move the whole model)
      if (T.current.keeper) {
        const km = T.current.keeper.model;
        if (s.phase === 'shooting' || s.phase === 'result') {
          s.keeperProgress = Math.min(1, s.keeperProgress + dt * 2.2);
          const ease = 1 - Math.pow(1 - s.keeperProgress, 3);
          km.position.x = s.keeperTargetX * ease * 0.85;
          if (s.keeperDiveDir !== 0) {
            km.rotation.z = s.keeperDiveDir * ease * 0.9;
            km.position.y = Math.sin(ease * Math.PI) * 0.4;
          }
        } else {
          // Idle sway
          km.position.x = Math.sin(now / 800) * 0.08;
          km.position.y = 0;
          km.rotation.z = 0;
        }
      }

      // Ball physics
      if (s.phase === 'shooting' && !s.resolved) {
        s.ballVel.x += s.ballCurve * dt;
        s.ballPos.x += s.ballVel.x * dt;
        s.ballPos.y += s.ballVel.y * dt;
        s.ballPos.z += s.ballVel.z * dt;
        s.ballVel.y -= GRAVITY * dt;

        s.ballSpin.x += s.ballVel.z * dt * 8;
        s.ballSpin.y += s.ballVel.x * dt * 5;

        if (ball) {
          ball.position.copy(s.ballPos);
          ball.rotation.x = s.ballSpin.x;
          ball.rotation.y = s.ballSpin.y;
        }

        if (s.ballPos.z > GOAL_Z - 3 && s.slowmo <= 0.05) s.slowmo = 0.35;
        if (s.ballPos.z >= GOAL_Z) { s.resolved = true; resolveResult(); }
      }

      // Net
      if (s.netWave > 0.01 && T.current.net) {
        T.current.net.position.z = T.current.netBaseZ + Math.sin(now / 40) * s.netWave * 0.18;
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
          (p.mesh.geometry as any)?.dispose?.();
          (p.mesh.material as any)?.dispose?.();
          s.particles.splice(i, 1);
          continue;
        }
      }

      renderer.render(scene, camera);
      T.current.animId = requestAnimationFrame(animate);
    };
    T.current.animId = requestAnimationFrame(animate);

    return () => {
      alive = false;
      if (T.current.animId) cancelAnimationFrame(T.current.animId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointer);
      renderer.dispose();
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
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
    s.keeperProgress = 0;

    // Trigger player run animation
    if (T.current.player) switchAnim(T.current.player, 'run', 0.15);

    const dx = tx - s.ballPos.x;
    const dy = ty - s.ballPos.y;
    const dz = GOAL_Z - s.ballPos.z;
    s.ballVel.set(dx / SHOT_DURATION, dy / SHOT_DURATION + 0.5 * GRAVITY * SHOT_DURATION, dz / SHOT_DURATION);
    s.ballCurve = (Math.random() - 0.5) * 5;

    // Keeper AI
    const guessCorrect = Math.random() < 0.36;
    let kTargetX: number;
    if (guessCorrect) {
      kTargetX = tx > 0 ? 1.2 + Math.random() * 1.3 : -1.2 - Math.random() * 1.3;
    } else {
      kTargetX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.8);
    }
    kTargetX = Math.max(-GOAL_W / 2 + 0.5, Math.min(GOAL_W / 2 - 0.5, kTargetX));
    s.keeperTargetX = kTargetX;
    s.keeperDiveDir = kTargetX < -0.4 ? -1 : kTargetX > 0.4 ? 1 : 0;

    // Keeper run anim
    if (T.current.keeper) switchAnim(T.current.keeper, 'run', 0.2);

    playKick();
    setUi(p => ({ ...p, phase: 'shooting' }));

    // After shot completes → back to idle
    setTimeout(() => {
      if (T.current.player) switchAnim(T.current.player, 'idle', 0.4);
    }, 800);
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
      const kpx = s.keeperTargetX * (1 - Math.pow(1 - s.keeperProgress, 3)) * 0.85;
      const kpy = 1.2;
      const kdist = Math.sqrt((bx - kpx) ** 2 + (by - kpy) ** 2);
      if (kdist < KEEPER_REACH && s.keeperProgress > 0.25) {
        result = 'save';
        playSave();
        s.cameraShake = 2;
      } else {
        result = 'goal';
        s.netWave = 1;
        s.cameraShake = 5;
        s.flash = 0.6;
        s.flashHue = 120;
        playCrowd(true);
        spawnConfetti();
      }
    }

    // Keeper goes back to idle
    if (T.current.keeper) switchAnim(T.current.keeper, 'idle', 0.5);

    s.lastResult = result;
    s.phase = 'result';
    s.shots++;
    s.shotsLog.push(result);

    if (result === 'goal') {
      s.goals++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
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
    }, 2400);
  };

  const spawnConfetti = () => {
    const s = S.current;
    const scene = T.current.scene;
    if (!scene) return;
    const colors = [0xfbbf24, 0xf43f5e, 0x22c55e, 0x3b82f6, 0xa855f7, 0xf97316];
    for (let i = 0; i < 35; i++) {
      const geo = new THREE.SphereGeometry(0.04, 6, 4);
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 2, GOAL_H / 2, GOAL_Z);
      scene.add(mesh);
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
    s.ballPos.set(BALL_START.x, BALL_START.y, BALL_START.z);
    s.ballVel.set(0, 0, 0);
    s.ballSpin.set(0, 0, 0);
    s.ballCurve = 0;
    s.keeperProgress = 0;
    s.keeperDiveDir = 0;
    s.resolved = false;
    s.netWave = 0;
    s.lastResult = null;
    s.slowmo = 0;
    if (T.current.ball) {
      T.current.ball.position.copy(s.ballPos);
      T.current.ball.rotation.set(0, 0, 0);
    }
    if (T.current.net) T.current.net.position.z = T.current.netBaseZ;
    if (T.current.keeper) {
      T.current.keeper.model.position.set(0, 0, GOAL_Z - 1.0);
      T.current.keeper.model.rotation.z = 0;
      switchAnim(T.current.keeper, 'idle', 0.4);
    }
    S.current.particles.forEach(p => {
      T.current.scene?.remove(p.mesh);
      (p.mesh.geometry as any)?.dispose?.();
      (p.mesh.material as any)?.dispose?.();
    });
    S.current.particles = [];
  };

  const start = (mode: 'classic' | 'practice' = 'classic') => {
    const s = S.current;
    s.mode = mode;
    s.goals = 0; s.saves = 0; s.shots = 0;
    s.shotsLog = [];
    s.streak = 0; s.bestStreak = 0;
    resetShot();
    s.phase = 'aiming';
    setUi(p => ({
      ...p, goals: 0, saves: 0, shots: 0, phase: 'aiming',
      lastResult: null, score: 0, shotsLog: [], streak: 0, mode,
    }));
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

            <div ref={containerRef} className={`relative w-full bg-slate-950 ${isFullscreen ? 'flex-1 min-h-0' : ''}`} style={{ aspectRatio: isFullscreen ? 'auto' : '16/10' }}>
              <div ref={mountRef} className="absolute inset-0" />

              {loadingModels && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-30">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 animate-pulse">
                    <Target size={32} />
                  </div>
                  <p className="text-white text-sm font-semibold">Chargement des joueurs...</p>
                  <p className="text-slate-400 text-xs mt-1">Modèles 3D réalistes en cours d'import</p>
                </div>
              )}

              {achievement && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold shadow-2xl animate-bounce z-10">
                  {achievement}
                </div>
              )}

              {ui.phase === 'ready' && !loadingModels && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur text-white text-center p-4 z-20">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/40">
                    <Target size={36} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">Penalty 3D</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-sm">Joueurs 3D réalistes · Physique · Ambiance stade</p>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur text-white text-center p-4 z-20">
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
              {ui.phase === 'ready' && 'Choisis ton mode'}
              {ui.phase === 'aiming' && '👆 Clique dans le but pour tirer'}
              {ui.phase === 'shooting' && '⚽ Frappe en cours...'}
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