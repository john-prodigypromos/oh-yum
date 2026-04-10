// ── Synthesized Retro Sound Effects ─────────────────────
// All sounds generated via Web Audio API — no files needed.
// Deep, bassy tones. Minimal treble.

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;

  // ── Singleton: one AudioContext for the entire app ──
  private static _instance: SoundSystem | null = null;
  static getInstance(): SoundSystem {
    if (!SoundSystem._instance) {
      SoundSystem._instance = new SoundSystem();
    }
    return SoundSystem._instance;
  }

  /** Must be called from a user gesture (click/tap) to unlock AudioContext */
  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      // Force-resume in case browser created it suspended
      if (this.ctx.state === 'suspended') this.ctx.resume();
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

  // ── Big explosion: cinematic multi-layered boom with sustained decay ──
  explosion(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Layer 1: Initial transient crack — sharp attack, short noise burst
    const crackSize = ctx.sampleRate * 0.05;
    const crackBuf = ctx.createBuffer(1, crackSize, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackSize; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackSize, 3);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackGain = ctx.createGain();
    const crackFilter = this.lpf(ctx, 2000);
    crackGain.gain.setValueAtTime(0.4, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);
    crack.start(now);

    // Layer 2: Heavy bass thud — the "boom" body
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(12, now + 1.0);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.setValueAtTime(0.5, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.0);

    // Layer 3: Rumbling debris noise — long, filtered, decaying
    const rumbleSize = ctx.sampleRate * 1.5;
    const rumbleBuf = ctx.createBuffer(1, rumbleSize, ctx.sampleRate);
    const rumbleData = rumbleBuf.getChannelData(0);
    for (let i = 0; i < rumbleSize; i++) {
      rumbleData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rumbleSize, 2);
    }
    const rumble = ctx.createBufferSource();
    rumble.buffer = rumbleBuf;
    const rumbleFilter = this.lpf(ctx, 500);
    rumbleFilter.frequency.setValueAtTime(500, now);
    rumbleFilter.frequency.exponentialRampToValueAtTime(60, now + 1.2);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start(now);

    // Layer 4: Mid-frequency growl — adds texture between bass and noise
    const mid = ctx.createOscillator();
    const midGain = ctx.createGain();
    const midFilter = this.lpf(ctx, 400);
    mid.type = 'sawtooth';
    mid.frequency.setValueAtTime(150, now);
    mid.frequency.exponentialRampToValueAtTime(25, now + 0.7);
    midGain.gain.setValueAtTime(0.2, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(this.masterGain);
    mid.start(now);
    mid.stop(now + 0.7);

    // Layer 5: Secondary delayed thump — "echo" of the explosion
    const sub2 = ctx.createOscillator();
    const sub2Gain = ctx.createGain();
    sub2.type = 'sine';
    sub2.frequency.setValueAtTime(50, now + 0.08);
    sub2.frequency.exponentialRampToValueAtTime(10, now + 0.8);
    sub2Gain.gain.setValueAtTime(0.001, now);
    sub2Gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    sub2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    sub2.connect(sub2Gain);
    sub2Gain.connect(this.masterGain);
    sub2.start(now);
    sub2.stop(now + 0.8);
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

  // ── Launch engine: multi-layered rocket roar ──
  private launchEngineActive = false;
  private launchSubOsc: OscillatorNode | null = null;
  private launchSubGain: GainNode | null = null;
  private launchRoarOsc: OscillatorNode | null = null;
  private launchRoarGain: GainNode | null = null;
  private launchRoarFilter: BiquadFilterNode | null = null;
  private launchRoar2Osc: OscillatorNode | null = null;
  private launchRoar2Gain: GainNode | null = null;
  private launchCrackleNode: AudioBufferSourceNode | null = null;
  private launchCrackleGain: GainNode | null = null;
  private launchCrackleFilter: BiquadFilterNode | null = null;
  private launchDistortion: WaveShaperNode | null = null;
  private launchOverdriveGain: GainNode | null = null;
  private launchOverdriveFilter: BiquadFilterNode | null = null;

  // ── Atmospheric wind drone ──
  private windOsc: OscillatorNode | null = null;
  private windGain: GainNode | null = null;

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

  // ── Background Music: real audio file playback ──
  // iOS/Safari fixes: resume AudioContext on visibility change,
  // re-attempt play on every user gesture, preload audio element.
  private musicPlaying = false;
  private musicElement: HTMLAudioElement | null = null;
  private musicGainNode: GainNode | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private musicSourceCreated = false;
  private visibilityHandler: (() => void) | null = null;
  private musicRetryHandler: (() => void) | null = null;

  private static isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  startMusic(): void {
    // Kill music entirely on iOS/iPadOS — too unreliable
    if (SoundSystem.isIOS) return;

    if (this.musicPlaying) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    this.musicPlaying = true;

    // Create audio element — prefer MP3 for broadest Safari support
    if (!this.musicElement) {
      this.musicElement = new Audio();
      this.musicElement.loop = true;
      this.musicElement.volume = 1.0;
      this.musicElement.preload = 'auto';
      this.musicElement.setAttribute('playsinline', ''); // iOS: don't fullscreen
      const canPlayOgg = this.musicElement.canPlayType('audio/ogg; codecs="vorbis"');
      this.musicElement.src = canPlayOgg ? '/audio/cyberpunk_battle.ogg' : '/audio/battle_loop.mp3';
      this.musicElement.load(); // force preload on iOS
    }

    // Route through Web Audio API for gain control (only once per element)
    if (!this.musicSourceCreated) {
      this.musicSourceCreated = true;
      this.musicSource = ctx.createMediaElementSource(this.musicElement);
      this.musicGainNode = ctx.createGain();
      this.musicGainNode.gain.value = 0.35;
      this.musicSource.connect(this.musicGainNode);
      this.musicGainNode.connect(this.masterGain);
    }

    // Attempt play — iOS may block this until a gesture
    this.attemptPlay();

    // Retry on every touch/click until it works (iOS needs gesture per AudioContext resume)
    if (!this.musicRetryHandler) {
      this.musicRetryHandler = () => this.attemptPlay();
      document.addEventListener('click', this.musicRetryHandler, { passive: true });
      document.addEventListener('touchstart', this.musicRetryHandler, { passive: true });
      document.addEventListener('touchend', this.musicRetryHandler, { passive: true });
    }

    // Resume on tab/app visibility change (iOS suspends AudioContext when backgrounded)
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.musicPlaying) {
          this.attemptPlay();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private attemptPlay(): void {
    if (!this.musicElement || !this.musicPlaying) return;

    // Resume suspended AudioContext first (required on iOS after background/lock)
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Then play the audio element
    if (this.musicElement.paused) {
      this.musicElement.play().then(() => {
        // Success — remove retry listeners
        this.removeMusicRetryListeners();
      }).catch(() => {
        // Still blocked — retry listeners stay active
      });
    }
  }

  private removeMusicRetryListeners(): void {
    if (this.musicRetryHandler) {
      document.removeEventListener('click', this.musicRetryHandler);
      document.removeEventListener('touchstart', this.musicRetryHandler);
      document.removeEventListener('touchend', this.musicRetryHandler);
      this.musicRetryHandler = null;
    }
  }

  isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  stopMusic(): void {
    this.musicPlaying = false;
    this.removeMusicRetryListeners();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.musicElement) {
      if (this.musicGainNode && this.ctx) {
        const now = this.ctx.currentTime;
        this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
        this.musicGainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        const el = this.musicElement;
        setTimeout(() => { el.pause(); }, 600);
      } else {
        this.musicElement.pause();
      }
    }
  }

  /** Set music intensity — 0 = ambient hum, 0.5 = mid tension, 1 = full combat.
   *  Adjusts gain and optionally a low-pass filter for mood shifts. */
  private musicIntensity = 0.5;

  setMusicIntensity(intensity: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, intensity));
    if (!this.musicGainNode || !this.ctx) return;

    // Map intensity to gain: 0.15 (ambient) → 0.35 (combat)
    const targetGain = 0.15 + this.musicIntensity * 0.2;
    const now = this.ctx.currentTime;
    this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
    this.musicGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.5);
  }

  /** Drop music to a low hum for slow-mo kill shot. */
  dropToHum(): void {
    this.setMusicIntensity(0.1);
  }

  /** Restore normal music intensity. */
  restoreMusic(): void {
    this.setMusicIntensity(0.5);
  }

  // Boss phase stinger — brief cymbal crash + brass hit for phase transitions
  bossPhaseStinger(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Cymbal crash — filtered noise
    const crashSize = ctx.sampleRate * 0.4;
    const crashBuf = ctx.createBuffer(1, crashSize, ctx.sampleRate);
    const crashData = crashBuf.getChannelData(0);
    for (let i = 0; i < crashSize; i++) {
      crashData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crashSize, 1.5);
    }
    const crash = ctx.createBufferSource();
    crash.buffer = crashBuf;
    const crashFilter = this.lpf(ctx, 3000);
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.2, now);
    crashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    crash.connect(crashFilter);
    crashFilter.connect(crashGain);
    crashGain.connect(this.masterGain);
    crash.start(now);

    // Brass stab
    const stab = ctx.createOscillator();
    const stabGain = ctx.createGain();
    const stabFilter = this.lpf(ctx, 1500);
    stab.type = 'sawtooth';
    stab.frequency.setValueAtTime(220, now);
    stabGain.gain.setValueAtTime(0, now);
    stabGain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    stabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    stab.connect(stabFilter);
    stabFilter.connect(stabGain);
    stabGain.connect(this.masterGain);
    stab.start(now);
    stab.stop(now + 0.4);
  }

  // ── "YAY!" — triumphant cinematic brass-style stab ──
  yay(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Big orchestral-style chord hit with sustain
    const chordFreqs = [262, 330, 392, 523]; // C major spread: C4, E4, G4, C5
    for (const freq of chordFreqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 2500);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gain.gain.setValueAtTime(0.12, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 1.0);
    }

    // Sub bass foundation
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 131; // C3
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    sub.connect(subGain);
    subGain.connect(this.masterGain!);
    sub.start(now);
    sub.stop(now + 0.8);

    // Bright shimmer layer
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1047; // C6
    shimmerGain.gain.setValueAtTime(0, now + 0.05);
    shimmerGain.gain.linearRampToValueAtTime(0.06, now + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain!);
    shimmer.start(now + 0.05);
    shimmer.stop(now + 1.2);
  }

  // ── Victory: epic ascending power chord fanfare ──
  victory(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Three ascending power chords with reverb-like decay
    const chords = [
      { time: 0, notes: [131, 196, 262], dur: 0.8 },      // C power chord
      { time: 0.35, notes: [165, 247, 330], dur: 0.8 },    // E power chord
      { time: 0.7, notes: [196, 294, 392, 523], dur: 1.5 }, // G major → sustain
    ];

    for (const chord of chords) {
      const t = now + chord.time;
      for (const freq of chord.notes) {
        // Rich sawtooth for "brass" feel
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = this.lpf(ctx, 2000);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
        gain.gain.setValueAtTime(0.1, t + chord.dur * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t + chord.dur);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(t);
        osc.stop(t + chord.dur);

        // Detuned layer for thickness
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq * 1.003, t); // slight detune
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.06, t + 0.04);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + chord.dur);
        osc2.connect(filter);
        filter.connect(gain2);
        gain2.connect(this.masterGain!);
        osc2.start(t);
        osc2.stop(t + chord.dur);
      }

      // Sub bass hit per chord
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.value = chord.notes[0] / 2;
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.25, t + 0.03);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + chord.dur * 0.8);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + chord.dur);
    }
  }

  // ── Evil laugh: deep menacing descending growl with distortion ──
  evilLaugh(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Sinister descending tone — like a dark synth stab
    const stabs = [
      { time: 0, freq: 200, dur: 0.25 },
      { time: 0.3, freq: 180, dur: 0.2 },
      { time: 0.55, freq: 160, dur: 0.2 },
      { time: 0.8, freq: 120, dur: 0.35 },
      { time: 1.2, freq: 80, dur: 0.5 },
    ];

    for (const stab of stabs) {
      const t = now + stab.time;

      // Heavy distorted sawtooth
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 600);
      // Waveshaper for distortion
      const distortion = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = Math.tanh(x * 3);
      }
      distortion.curve = curve;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(stab.freq, t);
      osc.frequency.exponentialRampToValueAtTime(stab.freq * 0.5, t + stab.dur);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.setValueAtTime(0.18, t + stab.dur * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stab.dur);
      osc.connect(distortion);
      distortion.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + stab.dur);

      // Sub rumble under each stab
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(stab.freq / 2, t);
      sub.frequency.exponentialRampToValueAtTime(stab.freq * 0.2, t + stab.dur);
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + stab.dur);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + stab.dur);
    }

    // Long trailing bass drone — ominous
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = this.lpf(ctx, 150);
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(40, now + 1.5);
    drone.frequency.exponentialRampToValueAtTime(18, now + 3.0);
    droneGain.gain.setValueAtTime(0, now + 1.5);
    droneGain.gain.linearRampToValueAtTime(0.15, now + 1.7);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain!);
    drone.start(now + 1.5);
    drone.stop(now + 3.0);
  }

  // ── Level start: cinematic bass drop + sweep ──
  levelStart(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Rising sweep
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    const sweepFilter = this.lpf(ctx, 1500);
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(60, now);
    sweep.frequency.exponentialRampToValueAtTime(400, now + 0.4);
    sweepGain.gain.setValueAtTime(0.15, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(this.masterGain!);
    sweep.start(now);
    sweep.stop(now + 0.5);

    // Impact hit at the peak
    const hit = ctx.createOscillator();
    const hitGain = ctx.createGain();
    hit.type = 'sine';
    hit.frequency.setValueAtTime(100, now + 0.35);
    hit.frequency.exponentialRampToValueAtTime(30, now + 0.8);
    hitGain.gain.setValueAtTime(0, now + 0.33);
    hitGain.gain.linearRampToValueAtTime(0.4, now + 0.36);
    hitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    hit.connect(hitGain);
    hitGain.connect(this.masterGain!);
    hit.start(now + 0.33);
    hit.stop(now + 0.8);

    // Noise transient at impact
    const noiseSize = ctx.sampleRate * 0.08;
    const noiseBuf = ctx.createBuffer(1, noiseSize, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseSize, 4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    const noiseFilter = this.lpf(ctx, 1000);
    noiseGain.gain.setValueAtTime(0.2, now + 0.35);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now + 0.35);
  }

  // ── Level complete: powerful ascending hit with shimmer tail ──
  levelComplete(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Two-note ascending stab
    const notes = [196, 294]; // G3, D4 — perfect fifth
    notes.forEach((freq, i) => {
      const t = now + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 1800);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.6);

      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.value = freq / 2;
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + 0.5);
    });

    // Shimmer tail
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 588; // D5
    shimmerGain.gain.setValueAtTime(0, now + 0.3);
    shimmerGain.gain.linearRampToValueAtTime(0.04, now + 0.4);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain!);
    shimmer.start(now + 0.3);
    shimmer.stop(now + 1.2);
  }

  // ── Defeat: dark descending doom with distortion ──
  defeat(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Descending dissonant chord — ominous
    const notes = [220, 185, 147, 98]; // descending through dark intervals
    notes.forEach((freq, i) => {
      const t = now + i * 0.3;

      // Distorted sawtooth for gritty feel
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = this.lpf(ctx, 800);
      const distortion = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let j = 0; j < 256; j++) {
        const x = (j / 128) - 1;
        curve[j] = Math.tanh(x * 2);
      }
      distortion.curve = curve;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.8);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(distortion);
      distortion.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.9);

      // Sub bass
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq / 2, t);
      sub.frequency.exponentialRampToValueAtTime(freq * 0.3, t + 0.8);
      subGain.gain.setValueAtTime(0, t);
      subGain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      sub.start(t);
      sub.stop(t + 0.9);
    });

    // Long low drone fade-out
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = this.lpf(ctx, 200);
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(55, now + 1.0);
    drone.frequency.exponentialRampToValueAtTime(20, now + 2.5);
    droneGain.gain.setValueAtTime(0, now + 1.0);
    droneGain.gain.linearRampToValueAtTime(0.12, now + 1.2);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain!);
    drone.start(now + 1.0);
    drone.stop(now + 2.5);
  }

  // ── Launch engine: cinematic multi-layered rocket roar ──
  // Layers: sub-bass rumble, dual-detuned mid roar, filtered noise crackle,
  // and a distortion overdrive channel that opens up with intensity.

  startLaunchEngine(): void {
    if (this.launchEngineActive) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) {
      console.warn('[SoundSystem] startLaunchEngine: no ctx or masterGain', { ctx: !!ctx, masterGain: !!this.masterGain, initialized: this.initialized });
      return;
    }
    console.log('[SoundSystem] startLaunchEngine: ctx.state =', ctx.state, 'masterGain =', this.masterGain.gain.value);
    this.launchEngineActive = true;

    // Layer 1: Low rumble — sine at 110Hz, audible on laptop speakers
    this.launchSubOsc = ctx.createOscillator();
    this.launchSubGain = ctx.createGain();
    this.launchSubOsc.type = 'sine';
    this.launchSubOsc.frequency.value = 110;
    this.launchSubGain.gain.value = 0.25;
    this.launchSubOsc.connect(this.launchSubGain);
    this.launchSubGain.connect(this.masterGain);
    this.launchSubOsc.start();

    // Layer 2: Engine roar — sawtooth at 150Hz through LP filter (rich harmonics)
    this.launchRoarOsc = ctx.createOscillator();
    this.launchRoarGain = ctx.createGain();
    this.launchRoarFilter = this.lpf(ctx, 600);
    this.launchRoarOsc.type = 'sawtooth';
    this.launchRoarOsc.frequency.value = 150;
    this.launchRoarGain.gain.value = 0.18;
    this.launchRoarOsc.connect(this.launchRoarFilter);
    this.launchRoarFilter.connect(this.launchRoarGain);
    this.launchRoarGain.connect(this.masterGain);
    this.launchRoarOsc.start();

    // Layer 3: Detuned second roar — beating/phasing for thickness
    this.launchRoar2Osc = ctx.createOscillator();
    this.launchRoar2Gain = ctx.createGain();
    const roar2Filter = this.lpf(ctx, 600);
    this.launchRoar2Osc.type = 'sawtooth';
    this.launchRoar2Osc.frequency.value = 153; // 3Hz detune from 150Hz
    this.launchRoar2Gain.gain.value = 0.12;
    this.launchRoar2Osc.connect(roar2Filter);
    roar2Filter.connect(this.launchRoar2Gain);
    this.launchRoar2Gain.connect(this.masterGain);
    this.launchRoar2Osc.start();

    // Layer 4: Roaring noise — filtered white noise for combustion texture
    const crackleLen = ctx.sampleRate * 4;
    const crackleBuf = ctx.createBuffer(1, crackleLen, ctx.sampleRate);
    const crackleData = crackleBuf.getChannelData(0);
    for (let i = 0; i < crackleLen; i++) {
      crackleData[i] = Math.random() * 2 - 1;
    }
    this.launchCrackleNode = ctx.createBufferSource();
    this.launchCrackleNode.buffer = crackleBuf;
    this.launchCrackleNode.loop = true;
    this.launchCrackleGain = ctx.createGain();
    this.launchCrackleFilter = this.lpf(ctx, 800);
    this.launchCrackleGain.gain.value = 0.12;
    this.launchCrackleNode.connect(this.launchCrackleFilter);
    this.launchCrackleFilter.connect(this.launchCrackleGain);
    this.launchCrackleGain.connect(this.masterGain);
    this.launchCrackleNode.start();

    // Layer 5: Overdrive screech — distorted sawtooth, kicks in at higher intensity
    const overdriveOsc = ctx.createOscillator();
    this.launchDistortion = ctx.createWaveShaper();
    this.launchOverdriveGain = ctx.createGain();
    this.launchOverdriveFilter = this.lpf(ctx, 400);
    overdriveOsc.type = 'sawtooth';
    overdriveOsc.frequency.value = 110;
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    this.launchDistortion.curve = curve;
    this.launchOverdriveGain.gain.value = 0.0;
    overdriveOsc.connect(this.launchDistortion);
    this.launchDistortion.connect(this.launchOverdriveFilter);
    this.launchOverdriveFilter.connect(this.launchOverdriveGain);
    this.launchOverdriveGain.connect(this.masterGain);
    overdriveOsc.start();

    // Fire the initial ignition burst
    this.launchIgnitionBurst();
  }

  /** One-shot ignition burst — loud crack + punch when engine fires */
  private launchIgnitionBurst(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    // Loud noise crack — the ignition spark (high-frequency content for laptop speakers)
    const crackLen = ctx.sampleRate * 0.2;
    const crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 3);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackGain = ctx.createGain();
    const crackFilter = this.lpf(ctx, 3000);
    crackGain.gain.setValueAtTime(0.5, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.masterGain);
    crack.start(now);

    // Ignition punch — 150Hz sine, clearly audible
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(60, now + 0.4);
    thumpGain.gain.setValueAtTime(0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thump.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thump.start(now);
    thump.stop(now + 0.4);

    // Engine swell — sawtooth rising through audible range
    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    const swellFilter = this.lpf(ctx, 1000);
    swell.type = 'sawtooth';
    swell.frequency.setValueAtTime(80, now);
    swell.frequency.linearRampToValueAtTime(200, now + 0.8);
    swellGain.gain.setValueAtTime(0.001, now);
    swellGain.gain.linearRampToValueAtTime(0.2, now + 0.5);
    swellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    swell.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(this.masterGain);
    swell.start(now);
    swell.stop(now + 0.9);
  }

  /** Set launch engine intensity: 0 = idle rumble, 1 = full overdrive.
   *  Call every frame during climb — ramps gain, filter cutoffs, and pitch. */
  setLaunchEngineIntensity(t: number): void {
    if (!this.launchEngineActive || !this.ctx) return;
    const intensity = Math.max(0, Math.min(1, t));
    const now = this.ctx.currentTime;

    // Low rumble: 110→180Hz, gain 0.25→0.35
    if (this.launchSubOsc && this.launchSubGain) {
      this.launchSubOsc.frequency.setValueAtTime(110 + intensity * 70, now);
      this.launchSubGain.gain.setValueAtTime(0.25 + intensity * 0.10, now);
    }

    // Engine roar: 150→250Hz, filter 600→2000Hz, gain 0.18→0.30
    if (this.launchRoarOsc && this.launchRoarGain && this.launchRoarFilter) {
      this.launchRoarOsc.frequency.setValueAtTime(150 + intensity * 100, now);
      this.launchRoarFilter.frequency.setValueAtTime(600 + intensity * 1400, now);
      this.launchRoarGain.gain.setValueAtTime(0.18 + intensity * 0.12, now);
    }

    // Detuned roar tracks main roar
    if (this.launchRoar2Osc && this.launchRoar2Gain) {
      this.launchRoar2Osc.frequency.setValueAtTime(153 + intensity * 103, now);
      this.launchRoar2Gain.gain.setValueAtTime(0.12 + intensity * 0.10, now);
    }

    // Noise: filter opens 800→3000Hz, gain 0.12→0.22
    if (this.launchCrackleFilter && this.launchCrackleGain) {
      this.launchCrackleFilter.frequency.setValueAtTime(800 + intensity * 2200, now);
      this.launchCrackleGain.gain.setValueAtTime(0.12 + intensity * 0.10, now);
    }

    // Overdrive: kicks in above 0.3 intensity, screams at full
    if (this.launchOverdriveGain && this.launchOverdriveFilter) {
      const overdriveT = Math.max(0, (intensity - 0.3) / 0.7);
      this.launchOverdriveGain.gain.setValueAtTime(overdriveT * 0.18, now);
      this.launchOverdriveFilter.frequency.setValueAtTime(400 + overdriveT * 1200, now);
    }
  }

  stopLaunchEngine(): void {
    if (!this.launchEngineActive) return;
    this.launchEngineActive = false;
    const now = this.ctx?.currentTime ?? 0;
    const fadeTime = 0.5;

    // Fade all layers out
    const gains = [
      this.launchSubGain,
      this.launchRoarGain,
      this.launchRoar2Gain,
      this.launchCrackleGain,
      this.launchOverdriveGain,
    ];
    for (const g of gains) {
      if (g && this.ctx) {
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + fadeTime);
      }
    }

    // Stop oscillators after fade
    const oscs = [this.launchSubOsc, this.launchRoarOsc, this.launchRoar2Osc];
    setTimeout(() => {
      for (const o of oscs) {
        try { o?.stop(); } catch {}
      }
      try { this.launchCrackleNode?.stop(); } catch {}
    }, (fadeTime + 0.1) * 1000);

    this.launchSubOsc = null;
    this.launchSubGain = null;
    this.launchRoarOsc = null;
    this.launchRoarGain = null;
    this.launchRoarFilter = null;
    this.launchRoar2Osc = null;
    this.launchRoar2Gain = null;
    this.launchCrackleNode = null;
    this.launchCrackleGain = null;
    this.launchCrackleFilter = null;
    this.launchDistortion = null;
    this.launchOverdriveGain = null;
    this.launchOverdriveFilter = null;
  }

  // ── Atmospheric wind drone: continuous sawtooth through deep low-pass ──
  startWindDrone(): void {
    if (this.windOsc) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;

    this.windOsc = ctx.createOscillator();
    this.windGain = ctx.createGain();
    const filter = this.lpf(ctx, 200);
    this.windOsc.type = 'sawtooth';
    this.windOsc.frequency.value = 55;
    this.windGain.gain.value = 0.08;
    this.windOsc.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windOsc.start();
  }

  // ── Set wind intensity: t=0 → full wind (0.08), t=1 → silent ──
  setWindIntensity(t: number): void {
    if (!this.windGain || !this.ctx) return;
    this.windGain.gain.setValueAtTime(0.08 * (1 - t), this.ctx.currentTime);
  }

  // ── Stop wind drone ──
  stopWindDrone(): void {
    if (!this.windOsc) return;
    try { this.windOsc.stop(); } catch {}
    this.windOsc = null;
    this.windGain = null;
  }

  // ── Reentry roar: 3s white noise through low-pass, gain ramps in then out ──
  reentryRoar(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.lpf(ctx, 300);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 1.0);
    gain.gain.linearRampToValueAtTime(0.2, now + 2.0);
    gain.gain.linearRampToValueAtTime(0, now + 3.0);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  // ── Touchdown: mechanical thud — sine dropping 60→30Hz, sharp decay ──
  touchdown(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // ── Landing fanfare: major chord C4-E4-G4-C5 with triangle oscillators ──
  landingFanfare(): void {
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    const freqs = [261.6, 329.6, 392.0, 523.3]; // C4, E4, G4, C5
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.setValueAtTime(0.08, now + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 3.0);
    }
  }
}
