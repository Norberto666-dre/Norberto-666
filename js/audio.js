// Timbre de los 10 cursores: forma de onda + desplazamiento de tono (valores iniciales).
const CURSOR_SOUND = {
  pulso: { wave: 'square', shift: 1 },
  tesla: { wave: 'sawtooth', shift: 1.18 },
  aegis: { wave: 'triangle', shift: 0.88 },
  cronos: { wave: 'sine', shift: 0.95 },
  nova: { wave: 'square', shift: 1.32 },
  prisma: { wave: 'triangle', shift: 1.5 },
  criogenico: { wave: 'sine', shift: 1.25 },
  nucleo: { wave: 'square', shift: 0.75 },
  fantasma: { wave: 'sine', shift: 0.82 },
  overclock: { wave: 'sawtooth', shift: 1.6 }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.available = true;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.combo = 0;
    this.perfectCount = 0;
    this.lastPitch = 1;
    this.musicOscs = [];
    this.musicLayers = {};
    this.layerStep = {};
    this.musicStarted = false;
    this.overdrive = false;
    this.musicOverdrive = false;
    this.lastSfxAt = 0; // marca de tiempo del último SFX (QA input→sonido)
  }

  stampSfx() {
    this.lastSfxAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  init() {
    if (this.available === false) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio no soportado');
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.9;
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      // init() es idempotente: no reinicia la música ni deja timers huérfanos.
      // stopMusic() es el único lugar que pone musicStarted a false.
    } catch (e) {
      console.warn('Audio no disponible:', e);
      this.available = false;
      this.enabled = false;
    }
  }

  setEnabled(v) { this.enabled = !!v; }
  setMasterVolume(v) { if (this.masterGain) this.masterGain.gain.value = v; }

  // ---------- SFX ----------

  // Paneo estéreo simple: izquierda / centro / derecha según columna del hoyo
  connectSfx(node, pan = 0) {
    const p = Math.max(-1, Math.min(1, pan));
    if (p && this.ctx && this.ctx.createStereoPanner) {
      // Los extremos suenan un poco más lejos que el centro
      const distance = this.ctx.createGain();
      distance.gain.value = 0.78 + 0.22 * (1 - Math.abs(p));
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = p;
      node.connect(distance);
      distance.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      node.connect(this.sfxGain);
    }
  }

  // Cada cursor tiene un timbre propio: mismo input, retroalimentación distinta.
  playHit(perfect = false, pan = 0, cursorId = 'pulso') {
    if (!this.enabled || !this.ctx) return;
    this.stampSfx();
    const t = this.ctx.currentTime;
    const profile = CURSOR_SOUND[cursorId] || CURSOR_SOUND.pulso;
    const base = (perfect ? 880 : 440) * profile.shift;
    // Pitch ladder: cada acierto sube el tono
    this.combo = Math.min(this.combo + 1, 20);
    const mult = Math.pow(1.05, this.combo);
    const freq = base * mult;
    this.lastPitch = mult;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = profile.wave;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.06, t + 0.06);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    this.connectSfx(gain, pan);
    osc.start(t);
    osc.stop(t + 0.14);

    // Chord extra en perfecto
    if (perfect) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 1.5, t);
      gain2.gain.setValueAtTime(0.1, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc2.connect(gain2);
      this.connectSfx(gain2, pan);
      osc2.start(t);
      osc2.stop(t + 0.22);
    }
  }

  playMiss() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
    this.combo = 0;
  }

  playBomb() {
    if (!this.enabled || !this.ctx) return;
    this.stampSfx();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.2);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  // Explosión Nova: ruido filtrado + sub-barrido + ping metálico (todo sintetizado)
  playNova( /* pan */ ) {
    if (!this.enabled || !this.ctx) return;
    this.stampSfx();
    const t = this.ctx.currentTime;

    const len = Math.floor(this.ctx.sampleRate * 0.45);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1800, t);
    filt.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(filt); filt.connect(ng); ng.connect(this.sfxGain);
    src.start(t); src.stop(t + 0.46);

    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(35, t + 0.35);
    sg.gain.setValueAtTime(0.28, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    sub.connect(sg); sg.connect(this.sfxGain);
    sub.start(t); sub.stop(t + 0.42);

    const ping = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1320, t);
    ping.frequency.exponentialRampToValueAtTime(660, t + 0.28);
    pg.gain.setValueAtTime(0.12, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    ping.connect(pg); pg.connect(this.sfxGain);
    ping.start(t); ping.stop(t + 0.32);
  }

  playVoltageFill() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.04);
      gain.gain.setValueAtTime(0.12, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.04);
      osc.stop(t + i * 0.04 + 0.34);
    });
  }

  playOverdriveStart() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.linearRampToValueAtTime(0.02, t + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  playOverdriveEnd() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  playSpawn(pan = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.06);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    this.connectSfx(gain, pan);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playEscape(pan = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.18);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    this.connectSfx(gain, pan);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  playSlowMoStart() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  playBossHit() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(300, t + 0.1);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Señal dedicada para la inversión del Núcleo Espejo
  playGlitch(active = true) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(active ? 900 : 300, t);
    osc.frequency.linearRampToValueAtTime(active ? 180 : 720, t + 0.22);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  // ---------- Música adaptativa (capas) ----------

  startMusic() {
    if (this.musicStarted || !this.enabled || !this.ctx) return;
    this.musicStarted = true;
    this.musicOverdrive = false;
    this.musicGain.gain.value = 0.5;
    this.musicLayers = {};
    this.layerStep = {};
    // Capas independientes: la base siempre suena, ritmo y melodía entran por combo.
    // Cada capa recorre 8 notas; Overdrive cambia la secuencia sin nuevos oscillators.
    this.createMusicLayer('base', [55, 55, 65.41, 55, 73.42, 65.41, 55, 49], 1.2, 'sawtooth', 0.10);
    this.createMusicLayer('rhythm', [220, 246.94, 220, 293.66, 220, 246.94, 329.63, 293.66], 0.5, 'square', 0);
    this.createMusicLayer('melody', [660, 783.99, 880, 783.99, 987.77, 880, 783.99, 659.25], 0.9, 'triangle', 0);
  }

  createMusicLayer(name, notes, rate, type, gainVal) {
    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;
    gain.connect(this.musicGain);
    const layer = {
      gain, notes, rate, type, timer: null, step: 0,
      targetGain: gainVal, pendingNotes: null, switchAt: 0
    };
    this.musicLayers[name] = layer;

    const schedule = () => {
      if (!this.musicStarted) return;
      const t = this.ctx.currentTime;
      // El cambio de secuencia se aplica en el reloj del AudioContext, no por setTimeout
      if (layer.pendingNotes && t >= layer.switchAt) {
        layer.notes = layer.pendingNotes;
        layer.pendingNotes = null;
        layer.step = 0;
        const g = layer.gain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(0.0001, g.value), t);
        g.linearRampToValueAtTime(Math.max(0.0001, layer.targetGain), t + 0.08);
      }
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const note = layer.notes[layer.step % layer.notes.length];
      osc.type = type;
      osc.frequency.setValueAtTime(note, t);
      noteGain.gain.setValueAtTime(0.8, t);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + rate * 0.9);
      osc.connect(noteGain);
      noteGain.connect(gain);
      osc.start(t);
      osc.stop(t + rate);
      layer.step++;
      // Un solo timer por capa: evita acumular osciladores y timers
      layer.timer = setTimeout(schedule, rate * 1000);
    };
    schedule();
  }

  stopMusic() {
    this.musicStarted = false;
    Object.values(this.musicLayers).forEach(layer => {
      if (layer.timer) clearTimeout(layer.timer);
      layer.pendingNotes = null;
      try { layer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); } catch (e) { /* ctx cerrado */ }
    });
    this.musicLayers = {};
    this.layerStep = {};
  }

  setMusicIntensity(intensity) {
    if (!this.musicGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(0.35 + 0.25 * intensity, t, 0.2);
    const rhythm = this.musicLayers.rhythm;
    const melody = this.musicLayers.melody;
    if (rhythm) {
      const target = intensity > 0.15 ? 0.05 + 0.05 * intensity : 0;
      rhythm.targetGain = target;
      rhythm.gain.gain.setTargetAtTime(target, t, 0.3);
    }
    if (melody) {
      const target = intensity > 0.45 ? 0.04 + 0.06 * intensity : 0;
      melody.targetGain = target;
      melody.gain.gain.setTargetAtTime(target, t, 0.3);
    }
  }

  // ---------- Estado ----------
  resetCombo() { this.combo = 0; }
  setOverdrive(v) { this.overdrive = !!v; }

  // Overdrive cambia el compás con un crossfade en el reloj de audio, sin nuevos osciladores
  setMusicOverdrive(v) {
    const next = !!v;
    if (this.musicOverdrive === next) return;
    this.musicOverdrive = next;
    const sequences = next
      ? {
          base: [55, 82.41, 55, 73.42, 55, 82.41, 98, 73.42],
          rhythm: [220, 220, 329.63, 220, 246.94, 293.66, 220, 329.63],
          melody: [880, 987.77, 880, 1046.5, 987.77, 880, 783.99, 987.77]
        }
      : {
          base: [55, 55, 65.41, 55, 73.42, 65.41, 55, 49],
          rhythm: [220, 246.94, 220, 293.66, 220, 246.94, 329.63, 293.66],
          melody: [660, 783.99, 880, 783.99, 987.77, 880, 783.99, 659.25]
        };
    Object.entries(this.musicLayers).forEach(([name, layer]) => {
      if (!sequences[name]) return;
      if (!this.ctx || !this.musicStarted) { layer.notes = sequences[name]; return; }
      try {
        const t = this.ctx.currentTime;
        const g = layer.gain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(0.0001, g.value), t);
        g.linearRampToValueAtTime(0.0001, t + 0.1);
        // El siguiente note-onset (gobernado por AudioContext) aplica la nueva secuencia
        layer.pendingNotes = sequences[name];
        layer.switchAt = t + 0.11;
      } catch (e) {
        layer.notes = sequences[name];
      }
    });
  }
}

export const audioManager = new AudioManager();