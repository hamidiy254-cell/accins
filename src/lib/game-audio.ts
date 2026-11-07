let ctx: AudioContext | null = null;
let muted = false;

export function initAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) initAudio();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function playEat(pitch = 1) {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(600 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(900 * pitch, t + 0.08);
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.16);
}

export function playCombo(level: number) {
  if (muted) return; const c = getCtx(); if (!c) return;
  const base = 500 + level * 80;
  [0, 0.06, 0.12].forEach((d, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = base + i * 150;
    const t = c.currentTime + d;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.12);
  });
}

export function playGameOver() {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.6);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.72);
}

export function playWhistle() {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine'; o2.type = 'sine';
  o.frequency.setValueAtTime(2400, t);
  o.frequency.linearRampToValueAtTime(2600, t + 0.15);
  o2.frequency.setValueAtTime(2600, t);
  o2.frequency.linearRampToValueAtTime(2400, t + 0.15);
  g.gain.setValueAtTime(0.04, t);
  g.gain.setValueAtTime(0.04, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g); o2.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.2);
  o2.start(t); o2.stop(t + 0.2);
}

export function playKick() {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  // Noise burst
  const buffer = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(t);

  // Thud
  const o = c.createOscillator();
  const og = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  og.gain.setValueAtTime(0.15, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(og); og.connect(c.destination);
  o.start(t); o.stop(t + 0.14);
}

export function playCrowd(goal: boolean) {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const dur = goal ? 1.8 : 0.9;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t_norm = i / data.length;
    const env = goal
      ? Math.min(1, t_norm * 4) * Math.exp(-t_norm * 0.8)
      : Math.exp(-t_norm * 3);
    data[i] = (Math.random() * 2 - 1) * env * 0.5;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = goal ? 800 : 400;
  filter.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = goal ? 0.35 : 0.2;
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(t);
}

export function playPost() {
  if (muted) return; const c = getCtx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(800, t);
  o.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.36);
}

export function playSave() {
  if (muted) return; const c = getCtx(); if (!c) return;
  playCrowd(false);
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.15);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.2);
}