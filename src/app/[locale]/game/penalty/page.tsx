'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, RotateCcw, Play, ArrowLeft, Target, Crown, Award, Volume2, VolumeX, Maximize2, Minimize2, CheckCircle2, XCircle, Flame, Zap } from 'lucide-react';
import { initAudio, playKick, playCrowd, playWhistle, playPost, playSave, setMuted, isMuted } from '@/lib/game-audio';
import * as THREE from 'three';

// ============================================================
// CONSTANTES 3D
// ============================================================
const GOAL_W = 7.32;
const GOAL_H = 2.44;
const GOAL_Z = 12;
const BALL_R = 0.11;
const GRAVITY = 9.8;
const TOTAL_SHOTS = 5;
const KEEPER_REACH = 1.1;
const SHOT_TIME = 0.75;
const BALL_START = { x: 0, y: BALL_R, z: 0 };
const SHOOTER_POS = { x: -0.55, y: 0, z: -1.35 };
const CAM_POS = { x: -2.2, y: 2.4, z: -5.8 };
const CAM_LOOK = { x: 0, y: 1.5, z: 8 };

type Phase = 'ready' | 'aiming' | 'shooting' | 'result' | 'done';
type ShotResult = 'goal' | 'save' | 'post' | 'miss';
type Quality = 'low' | 'medium' | 'high';

// ============================================================
// PALETTE LOW-POLY
// ============================================================
const PALETTE = {
  skyTop:    0x1a2744,
  skyMid:    0x2d3d5c,
  skyBottom: 0x4a5a7a,
  mountain:  0x1e2d47,
  mountain2: 0x152136,
  grass:     0x4a8f4a,
  grassDark: 0x3a7038,
  grassLight:0x5fa35f,
  stand:     0x1c2538,
  standLight:0x2a3450,
  post:      0xf5f0e6,
  net:       0xe8e2d0,
  skin:      0xd4a574,
  skinDark:  0xb08860,
  hair:      0x3d2b1a,
  boots:     0xfbbf24,
  // Player (rouge)
  pJersey:   0xe85d4a,
  pJerseyDk: 0xb84436,
  pShorts:   0xf5f0e6,
  pSocks:    0xe85d4a,
  // Keeper (jaune/or)
  kJersey:   0xf5c84a,
  kJerseyDk: 0xc9a13a,
  kShorts:   0x2a2a2a,
  kSocks:    0xf5c84a,
  gloves:    0xe85d4a,
  // Ball
  ballWhite: 0xf8f4e8,
  ballBlack: 0x1a1a1a,
  // Confetti
  confetti: [0xf5c84a, 0xe85d4a, 0x5fa35f, 0x4a8f4a, 0x6a9fda, 0xd46a9d],
};

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
    player: null, keeper: null,
    net: null, netBaseZ: 0,
    raycaster: null, goalPlane: null,
    animId: null,
    crowd: null,
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
    playerKickProgress: 0,
    playerPhase: 'idle' as 'idle' | 'runup' | 'kick' | 'follow',
    timeSinceShot: 0,
    keeperPhase: 'idle' as 'idle' | 'anticipate' | 'dive' | 'land' | 'celebrate' | 'frustrated',
    keeperTime: 0,
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
  // BUILDERS LOW-POLY
  // ============================================================
  const lowPolyMat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });

  const buildPlayer = (scene: THREE.Scene) => {
    const root = new THREE.Group();
    // Style Crossy Road : proportions cartoon
    const skinMat = lowPolyMat(PALETTE.skin);
    const hairMat = lowPolyMat(PALETTE.hair);
    const jerseyMat = lowPolyMat(PALETTE.pJersey);
    const jerseyDarkMat = lowPolyMat(PALETTE.pJerseyDk);
    const shortsMat = lowPolyMat(PALETTE.pShorts);
    const socksMat = lowPolyMat(PALETTE.pSocks);
    const bootsMat = lowPolyMat(PALETTE.boots);

    // Torse trapézoïdal
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.5, 6), jerseyMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    root.add(torso);

    // Bas du maillot plus foncé
    const jerseyBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 6), jerseyDarkMat);
    jerseyBottom.position.y = 0.94;
    root.add(jerseyBottom);

    // Tête (box + forme)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    root.add(head);

    // Cheveux (demi-sphère aplatie)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.73;
    root.add(hair);

    // Yeux (petits cubes noirs)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.01), eyeMat);
    eyeL.position.set(-0.06, 1.65, 0.13);
    root.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.01), eyeMat);
    eyeR.position.set(0.06, 1.65, 0.13);
    root.add(eyeR);

    // Cou
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), skinMat);
    neck.position.y = 1.46;
    root.add(neck);

    // Bras (avec articulation)
    const makeArm = (side: number) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(0.28 * side, 1.36, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.28, 6), jerseyMat);
      upper.position.y = -0.14;
      upper.castShadow = true;
      armGroup.add(upper);
      const forearmGroup = new THREE.Group();
      forearmGroup.position.y = -0.28;
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.25, 6), skinMat);
      forearm.position.y = -0.12;
      forearm.castShadow = true;
      forearmGroup.add(forearm);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.07), skinMat);
      hand.position.y = -0.28;
      forearmGroup.add(hand);
      armGroup.add(forearmGroup);
      root.add(armGroup);
      return { armGroup, forearmGroup };
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    // Jambes avec articulation
    const makeLeg = (side: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(0.1 * side, 0.9, 0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.32, 6), shortsMat);
      thigh.position.y = -0.16;
      thigh.castShadow = true;
      legGroup.add(thigh);
      const shinGroup = new THREE.Group();
      shinGroup.position.y = -0.32;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), socksMat);
      shin.position.y = -0.15;
      shin.castShadow = true;
      shinGroup.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), bootsMat);
      boot.position.set(0, -0.34, 0.04);
      boot.castShadow = true;
      shinGroup.add(boot);
      legGroup.add(shinGroup);
      root.add(legGroup);
      return { legGroup, shinGroup };
    };
    const leftLeg = makeLeg(-1);
    const rightLeg = makeLeg(1);

    root.position.set(SHOOTER_POS.x, 0, SHOOTER_POS.z);
    root.rotation.y = Math.PI * 0.15;
    scene.add(root);

    return { root, torso, head, hair, leftArm, rightArm, leftLeg, rightLeg };
  };

  const buildKeeper = (scene: THREE.Scene) => {
    const root = new THREE.Group();
    const skinMat = lowPolyMat(PALETTE.skin);
    const hairMat = lowPolyMat(PALETTE.hair);
    const jerseyMat = lowPolyMat(PALETTE.kJersey);
    const jerseyDarkMat = lowPolyMat(PALETTE.kJerseyDk);
    const shortsMat = lowPolyMat(PALETTE.kShorts);
    const socksMat = lowPolyMat(PALETTE.kSocks);
    const glovesMat = lowPolyMat(PALETTE.gloves);

    // Torse
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.5, 6), jerseyMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    root.add(torso);

    const jerseyBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 6), jerseyDarkMat);
    jerseyBottom.position.y = 0.94;
    root.add(jerseyBottom);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    root.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.73;
    root.add(hair);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.01), eyeMat);
    eyeL.position.set(-0.06, 1.65, 0.13);
    root.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.01), eyeMat);
    eyeR.position.set(0.06, 1.65, 0.13);
    root.add(eyeR);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), skinMat);
    neck.position.y = 1.46;
    root.add(neck);

    const makeArm = (side: number) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(0.28 * side, 1.36, 0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.28, 6), jerseyMat);
      upper.position.y = -0.14;
      upper.castShadow = true;
      armGroup.add(upper);
      const forearmGroup = new THREE.Group();
      forearmGroup.position.y = -0.28;
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.25, 6), skinMat);
      forearm.position.y = -0.12;
      armGroup.add(forearmGroup);
      forearmGroup.add(forearm);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), glovesMat);
      glove.position.y = -0.28;
      forearmGroup.add(glove);
      root.add(armGroup);
      return { armGroup, forearmGroup, glove };
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    const makeLeg = (side: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(0.1 * side, 0.9, 0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.32, 6), shortsMat);
      thigh.position.y = -0.16;
      thigh.castShadow = true;
      legGroup.add(thigh);
      const shinGroup = new THREE.Group();
      shinGroup.position.y = -0.32;
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), socksMat);
      shin.position.y = -0.15;
      shinGroup.add(shin);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), lowPolyMat(PALETTE.boots));
      boot.position.set(0, -0.34, 0.04);
      shinGroup.add(boot);
      legGroup.add(shinGroup);
      root.add(legGroup);
      return { legGroup, shinGroup };
    };
    const leftLeg = makeLeg(-1);
    const rightLeg = makeLeg(1);

    root.position.set(0, 0, GOAL_Z - 1.0);
    root.rotation.y = Math.PI;
    scene.add(root);

    return { root, torso, head, hair, leftArm, rightArm, leftLeg, rightLeg };
  };

  // ============================================================
  // SETUP SCÈNE
  // ============================================================
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let alive = true;
    const quality = qualityRef.current;

    const scene = new THREE.Scene();
    // Sky gradient via vertex-colored sphere
    const skyGeo = new THREE.SphereGeometry(80, 16, 12);
    const skyColors: number[] = [];
    const skyPositions = skyGeo.attributes.position;
    for (let i = 0; i < skyPositions.count; i++) {
      const y = skyPositions.getY(i);
      let c: number;
      if (y > 30) c = PALETTE.skyTop;
      else if (y > 0) c = PALETTE.skyMid;
      else c = PALETTE.skyBottom;
      const col = new THREE.Color(c);
      skyColors.push(col.r, col.g, col.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    scene.add(sky);
    T.current.scene = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(CAM_POS.x, CAM_POS.y, CAM_POS.z);
    camera.lookAt(CAM_LOOK.x, CAM_LOOK.y, CAM_LOOK.z);
    T.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', alpha: false });
    renderer.setPixelRatio(quality === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(PALETTE.skyBottom);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;cursor:crosshair;touch-action:none';
    T.current.renderer = renderer;

    // LIGHTS — style low-poly : peu de lumières, fortes
    scene.add(new THREE.AmbientLight(0xffffff, quality === 'low' ? 0.85 : 0.65));
    const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sunLight.position.set(-8, 15, 10);
    if (quality !== 'low') {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
      sunLight.shadow.camera.left = -15;
      sunLight.shadow.camera.right = 15;
      sunLight.shadow.camera.top = 15;
      sunLight.shadow.camera.bottom = -15;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 40;
    }
    scene.add(sunLight);

    // Fill light (bleuté, côté opposé)
    const fillLight = new THREE.DirectionalLight(0x8899cc, 0.4);
    fillLight.position.set(10, 8, -5);
    scene.add(fillLight);

    // PELOUSE — grandes bandes
    const grassBase = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 1, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.grass })
    );
    grassBase.rotation.x = -Math.PI / 2;
    grassBase.position.set(0, 0, GOAL_Z + 10);
    grassBase.receiveShadow = quality !== 'low';
    scene.add(grassBase);

    // Bandes tondues alternées
    for (let i = 0; i < 8; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 2.2),
        new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? PALETTE.grassLight : PALETTE.grassDark })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.005, 5 + i * 2.2);
      stripe.receiveShadow = quality !== 'low';
      scene.add(stripe);
    }

    // MONTAGNES en arrière-plan (silhouettes basses poly)
    const makeMountain = (x: number, z: number, w: number, h: number, color: number) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(w, h, 5),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      m.position.set(x, h / 2 - 0.5, z);
      m.rotation.y = Math.random() * Math.PI;
      scene.add(m);
    };
    makeMountain(-25, 55, 12, 10, PALETTE.mountain);
    makeMountain(-8, 58, 14, 12, PALETTE.mountain2);
    makeMountain(15, 56, 10, 9, PALETTE.mountain);
    makeMountain(30, 60, 15, 13, PALETTE.mountain2);

    // TRIBUNES (marches low-poly)
    for (let i = 0; i < 5; i++) {
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(50, 1, 1.6),
        new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? PALETTE.stand : PALETTE.standLight })
      );
      tier.position.set(0, 0.5 + i * 1, GOAL_Z + 16 + i * 1.6);
      tier.castShadow = quality !== 'low';
      scene.add(tier);
    }

    // FOULE (petits cubes colorés en instanced)
    const crowdGeo = new THREE.BoxGeometry(0.35, 0.5, 0.35);
    const crowdColors = [0xe85d4a, 0xf5c84a, 0x5fa35f, 0x6a9fda, 0xd46a9d, 0xf5f0e6, 0x4a8f4a];
    const crowdCount = quality === 'high' ? 200 : quality === 'medium' ? 120 : 60;
    for (let i = 0; i < crowdCount; i++) {
      const color = crowdColors[Math.floor(Math.random() * crowdColors.length)];
      const dot = new THREE.Mesh(crowdGeo, new THREE.MeshLambertMaterial({ color }));
      const row = Math.floor(i / 25);
      dot.position.set(
        -20 + (i % 25) * 1.6 + Math.random() * 0.3,
        0.8 + row * 1 + Math.random() * 0.2,
        GOAL_Z + 16 + row * 1.6 + Math.random() * 0.3
      );
      dot.rotation.y = Math.random() * Math.PI;
      scene.add(dot);
    }

    // PANNEAUX PUB
    const adMat = new THREE.MeshLambertMaterial({ color: 0x2d3d5c, flatShading: true });
    for (let i = -1; i <= 1; i++) {
      const ad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 0.15), adMat);
      ad.position.set(i * 7, 0.35, GOAL_Z + 3);
      scene.add(ad);
    }

    // POTEAUX + BARRE
    const postMat = new THREE.MeshLambertMaterial({ color: PALETTE.post, flatShading: true });
    const postGeo = new THREE.CylinderGeometry(0.065, 0.065, GOAL_H, 8);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z);
    leftPost.castShadow = quality !== 'low';
    scene.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = GOAL_W / 2;
    scene.add(rightPost);
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, GOAL_W, 8),
      postMat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, GOAL_H, GOAL_Z);
    crossbar.castShadow = quality !== 'low';
    scene.add(crossbar);

    // FILET (simple semi-transparent)
    const netMat = new THREE.MeshBasicMaterial({
      color: PALETTE.net,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, GOAL_H), netMat);
    net.position.set(0, GOAL_H / 2, GOAL_Z + 1.5);
    scene.add(net);
    T.current.net = net;
    T.current.netBaseZ = net.position.z;

    // Lignes du filet (côtés)
    const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, GOAL_H), netMat);
    sideNet.position.set(-GOAL_W / 2, GOAL_H / 2, GOAL_Z + 0.75);
    sideNet.rotation.y = Math.PI / 2;
    scene.add(sideNet);
    const sideNet2 = sideNet.clone();
    sideNet2.position.x = GOAL_W / 2;
    scene.add(sideNet2);

    // POINT DE PENALTY
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 12),
      new THREE.MeshBasicMaterial({ color: PALETTE.post })
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(0, 0.01, 0);
    scene.add(spot);

    // BALLON — icosaèdre pour un look low-poly
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(BALL_R, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.ballWhite, flatShading: true })
    );
    ball.castShadow = quality !== 'low';
    ball.position.copy(S.current.ballPos);
    scene.add(ball);
    T.current.ball = ball;

    // Petits patchs noirs sur le ballon (5 cubes pour le style)
    const patchMat = new THREE.MeshBasicMaterial({ color: PALETTE.ballBlack });
    const patchGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const patchPositions = [
      [0.06, 0.02, 0.08],
      [-0.07, 0.05, 0.06],
      [0.02, 0.09, 0.04],
      [-0.04, -0.05, 0.09],
      [0.08, -0.04, 0.03],
    ];
    for (const [px, py, pz] of patchPositions) {
      const patch = new THREE.Mesh(patchGeo, patchMat);
      patch.position.set(px, py, pz);
      ball.add(patch);
    }

    // JOUEUR + GARDIEN
    T.current.player = buildPlayer(scene);
    T.current.keeper = buildKeeper(scene);

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

    // ANIMATION LOOP
    let last = performance.now();
    const animate = (now: number) => {
      if (!alive) return;
      const realDt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const time = now / 1000;
      const s = S.current;
      s.time = time;

      const dt = s.slowmo > 0 ? realDt * 0.35 : realDt;
      if (s.slowmo > 0) s.slowmo -= realDt;
      s.timeSinceShot += realDt;

      // CAMERA
      s.cameraZoom += ((s.phase === 'shooting' || s.phase === 'result') ? 1 : 0) * realDt * 1.5 - s.cameraZoom * realDt * 2;
      s.cameraZoom = Math.max(0, Math.min(1, s.cameraZoom));
      camera.position.z = CAM_POS.z + s.cameraZoom * 1.0;
      camera.position.y = CAM_POS.y + s.cameraZoom * 0.15;
      if (s.cameraShake > 0.01) {
        camera.position.x = CAM_POS.x + (Math.random() - 0.5) * s.cameraShake * 0.25;
        s.cameraShake *= 0.88;
      } else {
        camera.position.x = CAM_POS.x;
      }
      camera.lookAt(CAM_LOOK.x, CAM_LOOK.y, CAM_LOOK.z);

      // PLAYER ANIMATION
      const player = T.current.player;
      if (player) {
        if (s.playerPhase === 'idle') {
          const breath = Math.sin(time * 1.8) * 0.01;
          player.torso.position.y = 1.2 + breath;
          player.head.position.y = 1.62 + breath;
          player.leftArm.armGroup.rotation.z = 0.15 + Math.sin(time * 1.5) * 0.05;
          player.rightArm.armGroup.rotation.z = -0.15 - Math.sin(time * 1.5) * 0.05;
          player.root.rotation.x = 0;
          player.root.position.set(SHOOTER_POS.x, 0, SHOOTER_POS.z);
        } else if (s.playerPhase === 'runup') {
          const p = Math.min(1, s.playerKickProgress / 0.28);
          const ease = p * p;
          player.root.position.x = SHOOTER_POS.x + ease * 0.4;
          player.root.position.z = SHOOTER_POS.z + ease * 0.9;
          player.root.rotation.y = Math.PI * 0.15 - ease * Math.PI * 0.3;
          // Right leg pulls back
          player.rightLeg.legGroup.rotation.x = -ease * 0.9;
          player.rightLeg.shinGroup.rotation.x = ease * 0.7;
          // Left arm forward for balance
          player.leftArm.armGroup.rotation.x = -ease * 0.6;
          player.rightArm.armGroup.rotation.x = ease * 0.4;
          player.torso.rotation.x = -ease * 0.1;
        } else if (s.playerPhase === 'kick') {
          const p = Math.min(1, (s.playerKickProgress - 0.28) / 0.14);
          const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          player.root.position.x = SHOOTER_POS.x + 0.4;
          player.root.position.z = SHOOTER_POS.z + 0.9;
          player.root.rotation.y = Math.PI * 0.15 - Math.PI * 0.3;
          // Right leg swings forward
          player.rightLeg.legGroup.rotation.x = -0.9 + ease * 2.2;
          player.rightLeg.shinGroup.rotation.x = 0.7 - ease * 0.6;
          player.torso.rotation.x = -0.1 + ease * 0.15;
          player.leftArm.armGroup.rotation.x = -0.6 + ease * 0.4;
        } else if (s.playerPhase === 'follow') {
          const p = Math.min(1, (s.playerKickProgress - 0.42) / 0.5);
          player.root.position.x = SHOOTER_POS.x + 0.4 - p * 0.2;
          player.root.position.z = SHOOTER_POS.z + 0.9 - p * 0.3;
          player.root.rotation.y = Math.PI * 0.15 - Math.PI * 0.3;
          player.rightLeg.legGroup.rotation.x = 1.3 * (1 - p * 0.6);
          player.rightLeg.shinGroup.rotation.x = 0.1;
          player.torso.rotation.x = 0.05;
          // Shift back to idle slowly
          if (p > 0.8) {
            s.playerPhase = 'idle';
            s.playerKickProgress = 0;
          }
        }
        // Advance kick progress
        if (s.playerPhase !== 'idle') {
          s.playerKickProgress += realDt;
          if (s.playerKickProgress >= 0.28 && s.playerPhase === 'runup') s.playerPhase = 'kick';
          if (s.playerKickProgress >= 0.42 && s.playerPhase === 'kick') s.playerPhase = 'follow';
        }
      }

      // KEEPER ANIMATION
      const keeper = T.current.keeper;
      if (keeper) {
        s.keeperTime += realDt;
        if (s.keeperPhase === 'idle') {
          // Balancement réaliste
          const sway = Math.sin(time * 1.5) * 0.08;
          const bounce = Math.abs(Math.sin(time * 2.2)) * 0.02;
          keeper.root.position.x = sway;
          keeper.root.position.y = bounce;
          keeper.root.rotation.z = 0;
          keeper.torso.rotation.z = Math.sin(time * 1.5) * 0.03;
          keeper.head.rotation.y = Math.sin(time * 1.2) * 0.15;
          // Bras légèrement écartés
          keeper.leftArm.armGroup.rotation.z = 0.35 + Math.sin(time * 1.5) * 0.1;
          keeper.rightArm.armGroup.rotation.z = -0.35 - Math.sin(time * 1.5) * 0.1;
          keeper.leftArm.forearmGroup.rotation.x = -0.2;
          keeper.rightArm.forearmGroup.rotation.x = -0.2;
          // Jambes légèrement fléchies
          keeper.leftLeg.legGroup.rotation.x = 0.05;
          keeper.rightLeg.legGroup.rotation.x = 0.05;
        } else if (s.keeperPhase === 'anticipate') {
          const p = Math.min(1, s.keeperTime / 0.15);
          keeper.torso.rotation.x = 0.1 * p;
          keeper.root.position.y = -0.08 * p;
          keeper.leftLeg.legGroup.rotation.x = 0.25 * p;
          keeper.rightLeg.legGroup.rotation.x = 0.25 * p;
          keeper.leftLeg.shinGroup.rotation.x = 0.2 * p;
          keeper.rightLeg.shinGroup.rotation.x = 0.2 * p;
        } else if (s.keeperPhase === 'dive') {
          const p = Math.min(1, s.keeperProgress);
          const ease = 1 - Math.pow(1 - p, 3);
          const dir = s.keeperDiveDir;

          keeper.root.position.x = s.keeperTargetX * ease * 0.9;
          keeper.root.position.y = Math.sin(p * Math.PI) * 0.9;
          keeper.root.rotation.z = dir * ease * 1.5;

          // Arms extended toward ball
          if (dir < 0) {
            keeper.leftArm.armGroup.rotation.z = 0.35 + ease * 2.2;
            keeper.rightArm.armGroup.rotation.z = -0.35 - ease * 0.6;
          } else {
            keeper.leftArm.armGroup.rotation.z = 0.35 + ease * 0.6;
            keeper.rightArm.armGroup.rotation.z = -0.35 - ease * 2.2;
          }
          keeper.leftArm.forearmGroup.rotation.x = -0.1;
          keeper.rightArm.forearmGroup.rotation.x = -0.1;

          // Legs trail
          keeper.leftLeg.legGroup.rotation.z = dir * ease * 0.5;
          keeper.rightLeg.legGroup.rotation.z = dir * ease * 0.5;
          keeper.leftLeg.legGroup.rotation.x = -ease * 0.3;
          keeper.rightLeg.legGroup.rotation.x = -ease * 0.3;

          if (p >= 1) {
            s.keeperPhase = 'land';
            s.keeperTime = 0;
          }
        } else if (s.keeperPhase === 'land') {
          const p = Math.min(1, s.keeperTime / 0.4);
          const dir = s.keeperDiveDir;
          keeper.root.position.x = s.keeperTargetX * 0.9;
          keeper.root.position.y = Math.max(0, 0.9 * (1 - p));
          keeper.root.rotation.z = dir * 1.5 * (1 - p * 0.3);
        } else if (s.keeperPhase === 'celebrate') {
          const pump = Math.sin(s.keeperTime * 8) * 0.3;
          keeper.root.position.y = Math.abs(Math.sin(s.keeperTime * 6)) * 0.1;
          keeper.leftArm.armGroup.rotation.z = 2.4 + pump;
          keeper.rightArm.armGroup.rotation.z = -2.4 - pump;
          keeper.leftArm.forearmGroup.rotation.x = -0.5;
          keeper.rightArm.forearmGroup.rotation.x = -0.5;
        } else if (s.keeperPhase === 'frustrated') {
          keeper.head.rotation.x = 0.5;
          keeper.torso.rotation.x = 0.15;
          keeper.leftArm.armGroup.rotation.z = 0.1;
          keeper.rightArm.armGroup.rotation.z = -0.1;
        }
      }

      // BALL PHYSICS
      if (s.phase === 'shooting' && !s.resolved) {
        s.ballVel.x += s.ballCurve * dt;
        s.ballPos.x += s.ballVel.x * dt;
        s.ballPos.y += s.ballVel.y * dt;
        s.ballPos.z += s.ballVel.z * dt;
        s.ballVel.y -= GRAVITY * dt;

        s.ballSpin.x += s.ballVel.z * dt * 6;
        s.ballSpin.y += s.ballVel.x * dt * 4;

        if (ball) {
          ball.position.copy(s.ballPos);
          ball.rotation.x = s.ballSpin.x;
          ball.rotation.y = s.ballSpin.y;
        }

        // Trail
        if (quality !== 'low') {
          T.current.ballTrail.push(s.ballPos.clone());
          if (T.current.ballTrail.length > 10) T.current.ballTrail.shift();
        }

        if (s.ballPos.z > GOAL_Z - 3 && s.slowmo <= 0.05) s.slowmo = 0.3;
        if (s.ballPos.z >= GOAL_Z) { s.resolved = true; resolveResult(); }
      }

      // TRAIL render
      if (T.current.ballTrail.length > 0 && quality !== 'low') {
        // Rendered as a fixed object outside
      }

      // NET WAVE
      if (s.netWave > 0.01 && T.current.net) {
        T.current.net.position.z = T.current.netBaseZ + Math.sin(now / 30) * s.netWave * 0.15;
        s.netWave *= 0.9;
      }

      // PARTICLES
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 6 * dt;
        p.mesh.rotation.x += dt * 5;
        p.mesh.rotation.z += dt * 3;
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          (p.mesh.geometry as any)?.dispose?.();
          (p.mesh.material as any)?.dispose?.();
          s.particles.splice(i, 1);
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
    s.keeperTime = 0;
    s.timeSinceShot = 0;
    s.playerPhase = 'runup';
    s.playerKickProgress = 0;
    s.keeperPhase = 'anticipate';

    const dx = tx - s.ballPos.x;
    const dy = ty - s.ballPos.y;
    const dz = GOAL_Z - s.ballPos.z;
    s.ballVel.set(dx / SHOT_TIME, dy / SHOT_TIME + 0.5 * GRAVITY * SHOT_TIME, dz / SHOT_TIME);
    s.ballCurve = (Math.random() - 0.5) * 4;

    // Keeper AI
    const guessCorrect = Math.random() < 0.36;
    let kTargetX: number;
    if (guessCorrect) {
      kTargetX = tx > 0 ? 1.3 + Math.random() * 1.2 : -1.3 - Math.random() * 1.2;
    } else {
      kTargetX = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.6);
    }
    kTargetX = Math.max(-GOAL_W / 2 + 0.5, Math.min(GOAL_W / 2 - 0.5, kTargetX));
    s.keeperTargetX = kTargetX;
    s.keeperDiveDir = kTargetX < 0 ? -1 : 1;

    // Keeper starts dive after a delay (reaction time)
    setTimeout(() => {
      if (s.phase === 'shooting') {
        s.keeperPhase = 'dive';
        s.keeperTime = 0;
      }
    }, 180);

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
      s.keeperPhase = 'celebrate';
      s.keeperTime = 0;
    } else if (!insideX || !insideY) {
      result = 'miss';
      s.keeperPhase = 'celebrate';
      s.keeperTime = 0;
    } else {
      const kpx = s.keeperTargetX * 0.9;
      const kpy = 1.2;
      const kdist = Math.sqrt((bx - kpx) ** 2 + (by - kpy) ** 2);
      if (kdist < KEEPER_REACH && s.keeperProgress > 0.3) {
        result = 'save';
        playSave();
        s.cameraShake = 2;
        s.keeperPhase = 'celebrate';
        s.keeperTime = 0;
      } else {
        result = 'goal';
        s.netWave = 1;
        s.cameraShake = 4;
        s.flash = 0.5;
        s.flashHue = 120;
        playCrowd(true);
        s.keeperPhase = 'frustrated';
        s.keeperTime = 0;
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
    for (let i = 0; i < 30; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
      const col = PALETTE.confetti[Math.floor(Math.random() * PALETTE.confetti.length)];
      const mat = new THREE.MeshLambertMaterial({ color: col, flatShading: true });
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
    s.keeperPhase = 'idle';
    s.keeperTime = 0;
    s.playerPhase = 'idle';
    s.playerKickProgress = 0;
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
      T.current.keeper.root.position.set(0, 0, GOAL_Z - 1.0);
      T.current.keeper.root.rotation.set(0, Math.PI, 0);
      T.current.keeper.head.rotation.set(0, 0, 0);
      T.current.keeper.torso.rotation.set(0, 0, 0);
    }
    if (T.current.player) {
      T.current.player.root.position.set(SHOOTER_POS.x, 0, SHOOTER_POS.z);
      T.current.player.root.rotation.set(0, Math.PI * 0.15, 0);
      T.current.player.torso.rotation.set(0, 0, 0);
      T.current.player.rightLeg.legGroup.rotation.set(0, 0, 0);
      T.current.player.rightLeg.shinGroup.rotation.set(0, 0, 0);
      T.current.player.leftArm.armGroup.rotation.set(0, 0, 0.15);
      T.current.player.rightArm.armGroup.rotation.set(0, 0, -0.15);
    }

    S.current.particles.forEach(p => {
      T.current.scene?.remove(p.mesh);
      (p.mesh.geometry as any)?.dispose?.();
      (p.mesh.material as any)?.dispose?.();
    });
    S.current.particles = [];
    T.current.ballTrail = [];
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

              {achievement && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold shadow-2xl animate-bounce z-10">
                  {achievement}
                </div>
              )}

              {ui.phase === 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur text-white text-center p-4 z-20">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-2xl shadow-emerald-500/40">
                    <Target size={36} />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">Penalty</h2>
                  <p className="text-slate-400 mb-6 text-sm max-w-sm">Low-poly · Style unique · 60 FPS mobile</p>
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