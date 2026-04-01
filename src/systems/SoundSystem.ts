// ── Synthesized Retro Sound Effects ─────────────────────
// All sounds generated via Web Audio API — no files needed.
// Deep, bassy tones. Minimal treble.

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  /** Must be called from a user gesture (click/tap) to unlock AudioContext */
  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch {
      // Audio not supported
    }
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Low-pass filter helper — kills harsh treble */
  private lpf(ctx: AudioContext, freq = 600): BiquadFilterNode {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.Q.value = 1;
    return f;
  }

  // ── Player laser: deep bass "thoom" ──
  playerShoot(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = this.lpf(ctx, 500);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Sub-bass layer
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.08);
    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.1);
  }

  // ── Enemy laser: slightly different bass tone ──
  enemyShoot(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = this.lpf(ctx, 400);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    // Sub rumble
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(45, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.1);
    subGain.gain.setValueAtTime(0.2, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.1);
  }

  // ── Hull hit: deep crunch ──
  hullHit(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Filtered noise burst
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.lpf(ctx, 300);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Deep thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ── Shield hit: mellow resonant ping ──
  shieldHit(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = this.lpf(ctx, 800);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // Sub resonance
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(100, now);
    sub.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    subGain.gain.setValueAtTime(0.15, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.15);
  }

  // ── Big explosion: massive bass boom ──
  explosion(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Filtered noise (rumble, not hiss)
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.lpf(ctx, 400);
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.6);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Massive sub-bass drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, now);
    sub.frequency.exponentialRampToValueAtTime(15, now + 0.6);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.6);

    // Mid-bass body
    const mid = ctx.createOscillator();
    const midGain = ctx.createGain();
    const midFilter = this.lpf(ctx, 300);
    mid.type = 'sawtooth';
    mid.frequency.setValueAtTime(120, now);
    mid.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    midGain.gain.setValueAtTime(0.25, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(this.masterGain);
    mid.start(now);
    mid.stop(now + 0.4);

    // Second sub hit (slightly delayed for "double thump")
    const sub2 = ctx.createOscillator();
    const sub2Gain = ctx.createGain();
    sub2.type = 'sine';
    sub2.frequency.setValueAtTime(40, now + 0.05);
    sub2.frequency.exponentialRampToValueAtTime(12, now + 0.5);
    sub2Gain.gain.setValueAtTime(0.001, now);
    sub2Gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    sub2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub2.connect(sub2Gain);
    sub2Gain.connect(this.masterGain);
    sub2.start(now);
    sub2.stop(now + 0.5);
  }

  // ── Wall bounce: short bass thunk ──
  wallBounce(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.07);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // ── Ship collision: heavy bass crunch ──
  shipCollision(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Filtered noise crunch
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.lpf(ctx, 250);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Deep impact
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.15);
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ── Engine thrust: low rumble ──
  private thrustOsc: OscillatorNode | null = null;
  private thrustGain: GainNode | null = null;
  private thrustFilter: BiquadFilterNode | null = null;
  private thrusting = false;

  startThrust(): void {
    if (this.thrusting) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;

    this.thrustOsc = ctx.createOscillator();
    this.thrustGain = ctx.createGain();
    this.thrustFilter = this.lpf(ctx, 120);
    this.thrustOsc.type = 'sawtooth';
    this.thrustOsc.frequency.value = 40;
    this.thrustGain.gain.value = 0.06;
    this.thrustOsc.connect(this.thrustFilter);
    this.thrustFilter.connect(this.thrustGain);
    this.thrustGain.connect(this.masterGain);
    this.thrustOsc.start();
    this.thrusting = true;
  }

  stopThrust(): void {
    if (!this.thrusting || !this.thrustOsc || !this.thrustGain) return;
    try {
      this.thrustGain.gain.setValueAtTime(this.thrustGain.gain.value, this.ctx!.currentTime);
      this.thrustGain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.15);
      const osc = this.thrustOsc;
      setTimeout(() => { try { osc.stop(); } catch {} }, 200);
    } catch {}
    this.thrustOsc = null;
    this.thrustGain = null;
    this.thrustFilter = null;
    this.thrusting = false;
  }

  // ── Victory: deep warm ascending tones ──
  victory(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const notes = [131, 165, 196, 262]; // C3, E3, G3, C4 — low register
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 800);
      osc.type = 'triangle';
      const t = now + i * 0.2;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.5);

      // Sub octave doubling
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq / 2, t);
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + 0.5);
    });
  }

  // ── Evil laugh: sinister "ha ha ha ha" ──
  evilLaugh(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Each "ha" is a quick pitch drop with a growly tone
    const haTimings = [0, 0.22, 0.42, 0.58, 0.72, 0.9, 1.1];
    const basePitch = [180, 170, 190, 165, 185, 160, 140];

    haTimings.forEach((offset, i) => {
      const t = now + offset;
      const pitch = basePitch[i];

      // Main growl tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 500);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.15);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.setValueAtTime(0.18, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.18);

      // Deep sub "body" of each ha
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(pitch / 2, t);
      sub.frequency.exponentialRampToValueAtTime(pitch * 0.25, t + 0.15);
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + 0.16);
    });

    // Trailing low rumble after the laugh
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    const rumbleFilter = this.lpf(ctx, 200);
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(50, now + 1.2);
    rumble.frequency.exponentialRampToValueAtTime(20, now + 2.0);
    rumbleGain.gain.setValueAtTime(0, now + 1.2);
    rumbleGain.gain.linearRampToValueAtTime(0.1, now + 1.3);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain!);
    rumble.start(now + 1.2);
    rumble.stop(now + 2.0);
  }

  // ── Defeat: deep descending tones ──
  defeat(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const notes = [220, 185, 156, 110]; // A3, F#3, Eb3, A2
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 600);
      osc.type = 'triangle';
      const t = now + i * 0.25;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.6);

      // Sub octave
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq / 2, t);
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.12, t + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + 0.6);
    });
  }
}
