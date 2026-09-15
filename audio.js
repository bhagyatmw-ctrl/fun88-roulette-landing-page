/**
 * Procedural Web Audio Engine for Realistic 3D Casino Experience
 * Zero external asset dependencies - 100% reliable synthesized casino audio
 */
class CasinoAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.ambientPlaying = false;
    this.ambientNodes = [];
    this.wheelSpinNode = null;
    this.ballOrbitNode = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.startAmbience();
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  /** Subtle warm casino lounge ambience with soft murmur & filtered white noise */
  startAmbience() {
    if (!this.ctx || this.ambientPlaying || this.isMuted) return;
    try {
      // Pink noise buffer for ambient casino room tone
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.015;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      whiteNoise.start();

      this.ambientNodes = [whiteNoise, filter, gain];
      this.ambientPlaying = true;
    } catch (e) {
      console.warn('Ambience sound error:', e);
    }
  }

  /** Button click sound */
  playClick() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  /** Chip selection / bet option toggle sound */
  playChipSelect() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Dual clay chip clack
    [0, 0.025].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 1800 : 2400, now + offset);
      osc.frequency.exponentialRampToValueAtTime(800, now + offset + 0.03);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now + offset);
      filter.Q.setValueAtTime(4, now + offset);

      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + offset);
      osc.stop(now + offset + 0.04);
    });
  }

  /** Spin activation whoosh + wheel motor hum */
  startWheelSpin() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    this.stopWheelSpin();

    const now = this.ctx.currentTime;
    // Low frequency rotor rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(220, now + 1.2);
    osc.frequency.exponentialRampToValueAtTime(45, now + 6.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.linearRampToValueAtTime(600, now + 1.0);
    filter.frequency.exponentialRampToValueAtTime(120, now + 6.0);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 6.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 6.5);
    this.wheelSpinNode = { osc, gain };
  }

  stopWheelSpin() {
    if (this.wheelSpinNode && this.ctx) {
      try {
        this.wheelSpinNode.gain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.1);
        this.wheelSpinNode.osc.stop(this.ctx.currentTime + 0.15);
      } catch (e) {}
      this.wheelSpinNode = null;
    }
  }

  /** Ball clicking on metal pocket frets and deflector diamonds */
  playBallBounce(pitch = 1.0, volume = 0.4) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    const baseFreq = (2400 + Math.random() * 600) * pitch;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.035);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(Math.min(0.5, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  /** Ball final landing thud into pocket */
  playBallLand() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Metallic rattle + heavy click
    [0, 0.04, 0.09].forEach((offset, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400 - i * 300, now + offset);
      osc.frequency.exponentialRampToValueAtTime(400, now + offset + 0.05);

      gain.gain.setValueAtTime(0.4 / (i + 1), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  /** Round 1 Loss sound (dramatic minor descending chime) */
  playLose() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [440, 392, 349, 311]; // A4, G4, F4, Eb4
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.3, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.4);
    });
  }

  /** Round 2 Win celebration fanfare (Triumphant brass/synth chord arpeggios) */
  playWin() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Major triumphant chords: C4, E4, G4, C5, E5, G5
    const fanfare = [
      { note: 523.25, time: 0.0, dur: 0.15 }, // C5
      { note: 659.25, time: 0.12, dur: 0.15 }, // E5
      { note: 783.99, time: 0.24, dur: 0.18 }, // G5
      { note: 1046.50, time: 0.40, dur: 0.6 }, // C6
      { note: 1318.51, time: 0.55, dur: 0.8 }, // E6
    ];

    fanfare.forEach(({ note, time, dur }) => {
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc2.type = 'sawtooth';
      osc.frequency.setValueAtTime(note, now + time);
      osc2.frequency.setValueAtTime(note * 1.002, now + time); // Slight detune for fullness

      gain.gain.setValueAtTime(0.35, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + time);
      osc2.start(now + time);
      osc.stop(now + time + dur);
      osc2.stop(now + time + dur);
    });

    // Cascade coin showers
    this.playCoinShower(0.3);
  }

  /** Realistic gold coins dropping and cascading */
  playCoinShower(delay = 0) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime + delay;

    for (let i = 0; i < 18; i++) {
      const coinTime = now + (i * 0.08) + Math.random() * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      const baseFreq = 3000 + Math.random() * 2500;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, coinTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, coinTime + 0.08);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq, coinTime);
      filter.Q.setValueAtTime(8, coinTime);

      gain.gain.setValueAtTime(0.25, coinTime);
      gain.gain.exponentialRampToValueAtTime(0.001, coinTime + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(coinTime);
      osc.stop(coinTime + 0.09);
    }
  }

  /** Grand bonus reveal cinematic riser and impact chord */
  playBonusReveal() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Sub bass hit
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.9);

    // Shimmer chord (Gold harp / chime)
    const chord = [587.33, 739.99, 880.00, 1174.66, 1479.98]; // D major 9
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.05 + idx * 0.06);

      gain.gain.setValueAtTime(0.3, now + 0.05 + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + idx * 0.06 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + 0.05 + idx * 0.06);
      osc.stop(now + 0.05 + idx * 0.06 + 1.2);
    });

    this.playCoinShower(0.2);
  }
}

window.casinoAudio = new CasinoAudioEngine();
