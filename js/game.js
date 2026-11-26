import { ABILITIES, ABILITY_EFFECTS, CHIP_EFFECTS, CURSORS, CURSOR_EFFECTS, cursorById } from './content.js';
import { BALANCE, comboMultiplier, nextComboMilestone, boardById } from './balance.js';

export const HOLE_COLS = 3;
export const HOLE_ROWS = 3;
export const HOLE_COUNT = 9;

export const HoleState = { EMPTY: 0, TELEGRAPH: 1, ACTIVE: 2, HIT: 3, ESCAPED: 4 };
export const CoreType = {
  STANDARD: 'standard', BOMB: 'bomb', CRONO: 'crono', NOVA: 'nova',
  WHITE: 'white', BOSS: 'boss'
};

export const SCREEN = { MENU: 'menu', PREP: 'prep', PLAYING: 'playing', RESULTS: 'results', SETTINGS: 'settings' };
export { comboMultiplier, nextComboMilestone };

// PRNG determinista para el Ciclo Diario (misma semilla → misma partida)
export function makeRng(seed) {
  let s = (Number(seed) || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const ASCENSION_RULES = [
  null,
  { id: 'twin', name: 'DOBLE BOMBA', short: '2X-BOMBA' },
  { id: 'split', name: 'NÚCLEOS PARTIDOS', short: 'SPLIT' },
  { id: 'latentMirror', name: 'ESPEJO LATENTE', short: 'ESPEJO' }
];

export function ascensionRuleNames(level) {
  const n = Math.max(0, Number(level) || 0);
  return ASCENSION_RULES.slice(1, Math.min(n, ASCENSION_RULES.length - 1) + 1)
    .filter(Boolean).map(r => r.name);
}

export function endlessHpBonus(wave) {
  const w = Math.max(1, Number(wave) || 1);
  return Math.min(1.5, 0.45 * Math.log2(1 + w * 1.6));
}

export function dailyCode(seed, score, date) {
  const s = (Number(seed) >>> 0).toString(36).toUpperCase().padStart(7, '0');
  const p = Math.max(0, Math.floor(Number(score) || 0)).toString(36).toUpperCase();
  const d = String(date || '').replaceAll('-', '').slice(2);
  return `O9-${d}-${s}-${p}`;
}

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.perfects = 0;
    this.totalHits = 0;
    this.totalMisses = 0;
    this.bombs = 0;
    this.lastMilestone = 0;
  }

  // El multiplicador por hitos se aplica DESPUÉS de incrementar el combo:
  // el primer golpe sigue valiendo ×1, y 5/10/20… cambian el escalón.
  onHit(perfect = false, extraMult = 1, runMult = 1) {
    this.totalHits++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const pMult = perfect ? 2 : 1;
    const gained = Math.floor(BALANCE.core.standard * this.multiplierFor(this.combo) * pMult * extraMult * runMult);
    this.score += gained;
    if (perfect) this.perfects++;
    this.multiplier = this.multiplierFor(this.combo);
    this.lastMilestone = this.milestone(this.combo);
    return gained;
  }

  multiplierFor(combo) { return comboMultiplier(combo); }
  milestone(combo) {
    return BALANCE.comboMilestones.includes(combo) ? combo : 0;
  }

  onMiss(keep = 0) {
    this.totalMisses++;
    this.combo = keep > 0 && this.combo > 0 ? Math.max(1, Math.floor(this.combo * keep)) : 0;
    this.multiplier = this.multiplierFor(this.combo);
  }

  onBomb(keep = 0) {
    this.bombs++;
    this.onMiss(keep);
  }

  // Núcleos rojos: restan 1 (o 2 si están enlazados), nunca crean combo.
  reduceCombo(amount = 1) {
    this.combo = Math.max(0, this.combo - Math.max(0, Math.floor(amount)));
    this.multiplier = this.multiplierFor(this.combo);
  }

  addCombo(amount = 1) {
    this.combo += Math.max(0, Math.floor(amount));
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.multiplier = this.multiplierFor(this.combo);
    this.lastMilestone = this.milestone(this.combo);
  }

  setMultiplier(m) { this.multiplier = m; }
  reset() {
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.multiplier = 1;
    this.perfects = 0; this.totalHits = 0; this.totalMisses = 0; this.bombs = 0;
    this.lastMilestone = 0;
  }
}

export class Hole {
  constructor(index) {
    this.index = index;
    this.state = HoleState.EMPTY;
    this.core = CoreType.STANDARD;
    this.timer = 0;
    this.lifetime = 0;
    this.telegraphTime = 0.3;
    this.spawnTime = 0;
    this.x = 0; this.y = 0; this.r = 0;
    this.linkId = 0;
    this.trapped = false;
    this.trapTimer = 0;
    this.dragX = 0;
    this.dragY = 0;
  }

  spawn(core, lifetime, linkId = 0) {
    this.state = HoleState.TELEGRAPH;
    this.core = core;
    this.timer = 0;
    this.lifetime = lifetime;
    this.spawnTime = performance.now();
    this.linkId = linkId;
    this.trapped = false;
    this.trapTimer = 0;
  }

  hit() {
    if (this.state === HoleState.ACTIVE || this.state === HoleState.TELEGRAPH) {
      this.state = HoleState.HIT;
      this.timer = 0;
      return true;
    }
    return false;
  }

  escape() {
    if (this.state === HoleState.ACTIVE) {
      this.state = HoleState.ESCAPED;
      this.timer = 0;
      return true;
    }
    return false;
  }

  reset() {
    this.state = HoleState.EMPTY;
    this.timer = 0;
    this.core = CoreType.STANDARD;
    this.lifetime = 0;
    this.linkId = 0;
    this.trapped = false;
    this.trapTimer = 0;
  }

  isPerfectWindow() {
    return this.state === HoleState.ACTIVE && this.timer < 0.15;
  }

  isTelegraphWindow() {
    return this.state === HoleState.TELEGRAPH;
  }
}

export class Director {
  constructor() {
    this.history = [];
    this.failStreak = 0;
    this.perfectStreak = 0;
    this.recentHistory = [];
    this.maxHistory = 4;
  }

  registerHit(perfect) {
    if (perfect) {
      this.perfectStreak++;
      this.failStreak = 0;
    } else {
      this.failStreak++;
      this.perfectStreak = 0;
    }
  }

  registerMiss() {
    this.failStreak++;
    this.perfectStreak = 0;
  }

  pick(availableHoles, time, sector = 1, noBombs = false, rnd = Math.random, pressure = 0, telegraphScale = 1) {
    const r = typeof rnd === 'function' ? rnd : Math.random;
    const candidates = availableHoles.filter(h => !this.recentHistory.includes(h.index));
    if (candidates.length === 0) candidates.push(...availableHoles);

    if (noBombs) {
      const hole = this.pickRandom(candidates, r);
      this.recordPick(hole.index);
      return { hole, core: CoreType.STANDARD, lifetime: 1.1, telegraph: 0.25 * telegraphScale };
    }

    if (this.failStreak >= 3 && r() < 0.5) {
      const hole = this.pickRandom(candidates, r);
      this.recordPick(hole.index);
      return { hole, core: CoreType.CRONO, lifetime: 1.2, telegraph: 0.4 * telegraphScale };
    }

    const novaChance = Math.min(0.11, 0.035 + 0.018 * Math.max(0, sector - 1) +
      (this.perfectStreak >= 3 ? 0.025 : 0));
    if (r() < novaChance) {
      const hole = this.pickRandom(candidates, r);
      this.recordPick(hole.index);
      return { hole, core: CoreType.NOVA, lifetime: 1.35, telegraph: 0.42 * telegraphScale };
    }

    if (this.perfectStreak >= 4 && r() < 0.45) {
      const hole = this.pickRandom(candidates, r);
      this.recordPick(hole.index);
      return { hole, core: CoreType.BOMB, lifetime: 1.4, telegraph: 0.3 * telegraphScale };
    }

    const bombChance = Math.min(0.38, (sector >= 2 ? 0.22 : 0.18) + pressure);
    const isBomb = sector >= 1 && r() < bombChance;
    const core = isBomb ? CoreType.BOMB : CoreType.STANDARD;
    const lifetime = isBomb ? 1.4 : sector >= 2 ? 1.45 : 1.6;
    const telegraph = (sector >= 2 ? 0.26 : 0.3) * telegraphScale;
    const hole = this.pickRandom(candidates, r);
    this.recordPick(hole.index);
    return { hole, core, lifetime, telegraph };
  }

  recordPick(index) {
    this.recentHistory.push(index);
    if (this.recentHistory.length > this.maxHistory) this.recentHistory.shift();
  }

  pickRandom(list, rnd = Math.random) { return list[Math.floor(rnd() * list.length)]; }

  reset() {
    this.history = [];
    this.failStreak = 0;
    this.perfectStreak = 0;
    this.recentHistory = [];
  }
}

export const BOSS_ROTATION = BALANCE.boss.rotation;

export const BOSS_BY_SECTOR = Object.fromEntries(
  BOSS_ROTATION.map((type, i) => [i + 1, type])
);

export const BOSS_STYLE = {
  golem: { color: '#ff6a00', glyph: 'gear' },
  mirror: { color: '#cc00ff', glyph: 'diamond' },
  prisma: { color: '#ff40d0', glyph: 'triangle' },
  crio: { color: '#8ff6ff', glyph: 'frost' },
  sobrecarga: { color: '#ff3355', glyph: 'bolt' },
  sifon: { color: '#00ff9c', glyph: 'siphon' },
  taquigrafo: { color: '#ffe600', glyph: 'clock' },
  enjambre: { color: '#ff8a3d', glyph: 'swarm' },
  apagon: { color: '#7a7aff', glyph: 'void' },
  cerrojo: { color: '#ff4fa3', glyph: 'lock' }
};

export class Boss {
  constructor(type = 'golem', level = 1) {
    this.type = type;
    this.level = Math.max(1, level);
    this.maxHp = BALANCE.boss.hp[type] || 300;
    this.hp = this.maxHp;
    this.phase = 1;
    this.defeated = false;
    this.slamTimers = [3, 3.6];
    this.slammedRows = [];
    this.blockedCols = [];
    this.blockTimer = BALANCE.boss.env.blockSeconds;
    this.damageFlash = 0;
    this.halves = [this.hp / 2, this.hp / 2];

    this.invertTimer = 6;
    this.invertRemaining = 0;
    this.invertJustStarted = false;
    this.invertJustEnded = false;

    this.overloadTimer = 4;
    this.overloadJustFired = false;
    this.crioTimer = 5;
    this.rng = Math.random;

    // Núcleo móvil: ocupa un hoyo, salta a otro y solo es vulnerable al aterrizar.
    const style = BOSS_STYLE[type] || BOSS_STYLE.golem;
    this.color = style.color;
    this.glyph = style.glyph;
    this.holeIndex = 4;
    this.teleportTimer = BALANCE.boss.teleportEvery;
    this.vanishing = 0;
    this.arriving = 0;
    this.hitsSinceTeleport = 0;
    this.cols = 3;
    this.rows = 3;
  }

  get hpPercent() { return this.hp / this.maxHp; }
  get vulnerable() { return !this.defeated && this.vanishing <= 0 && this.arriving <= 0; }
  get name() {
    const names = {
      golem: 'GÓLEM MECÁNICO', mirror: 'NÚCLEO ESPEJO', prisma: 'PRISMA ÓPTICO',
      crio: 'CRIOGENERADOR', sobrecarga: 'SOBRECARGA', sifon: 'SIFÓN DE VOLTAJE',
      taquigrafo: 'TAQUÍGRAFO', enjambre: 'ENJAMBRE', apagon: 'APAGÓN', cerrojo: 'CERROJO'
    };
    return names[this.type] || 'GÓLEM MECÁNICO';
  }

  getPhase() {
    return this.hp > this.maxHp * 0.66 ? 1 : this.hp > this.maxHp * 0.33 ? 2 : 3;
  }

  update(dt) {
    this.phase = this.getPhase();
    this.invertJustStarted = false;
    this.invertJustEnded = false;
    this.overloadJustFired = false;
    const pace = 1 + 0.12 * (this.level - 1);

    if (this.type === 'crio' && !this.defeated) {
      this.crioTimer -= dt * pace;
      if (this.crioTimer <= 0) {
        this.crioTimer = (this.phase === 3 ? 3.2 : 5) / pace;
        this.slammedRows.push({
          row: Math.floor((this.rng || Math.random)() * this.rows),
          timer: this.phase === 3 ? 2.5 : 2,
          half: 2
        });
      }
    }

    if (this.type === 'sobrecarga' && !this.defeated) {
      this.overloadTimer -= dt * pace;
      if (this.overloadTimer <= 0) {
        this.overloadTimer = (this.phase === 3 ? 2 : this.phase === 2 ? 3 : 4) / pace;
        this.overloadJustFired = true;
      }
    }

    this.slammedRows = this.slammedRows.filter(r => { r.timer -= dt; return r.timer > 0; });
    if (this.phase >= 2 && !this.defeated) {
      const activeHalves = this.phase === 3 ? [0, 1] : [0];
      activeHalves.forEach(half => {
        this.slamTimers[half] -= dt * pace;
        if (this.slamTimers[half] <= 0) {
          this.slamTimers[half] = (this.phase === 3 ? (half === 0 ? 2.2 : 3.1) : 4) / pace;
          const taken = this.slammedRows.filter(r => r.half !== half).map(r => r.row);
          const options = [];
          for (let row = 0; row < this.rows; row++) if (!taken.includes(row)) options.push(row);
          const pool = options.length ? options : Array.from({ length: this.rows }, (_, i) => i);
          const row = pool[Math.floor((this.rng || Math.random)() * pool.length)];
          this.slammedRows.push({ row, timer: 2, half });
        }
      });
    }
    if (this.type === 'mirror' && !this.defeated) {
      if (this.invertRemaining > 0) {
        this.invertRemaining -= dt;
        if (this.invertRemaining <= 0) {
          this.invertRemaining = 0;
          this.invertJustEnded = true;
        }
      } else {
        this.invertTimer -= dt * pace;
        if (this.invertTimer <= 0) {
          this.invertTimer = 9 / pace;
          this.invertRemaining = 3;
          this.invertJustStarted = true;
        }
      }
    }
    if (this.type === 'cerrojo' && !this.defeated) {
      this.blockTimer -= dt * pace;
      if (this.blockTimer <= 0) {
        this.blockTimer = BALANCE.boss.env.blockSeconds / pace;
        const col = Math.floor((this.rng || Math.random)() * this.cols);
        this.blockedCols = this.level >= 3
          ? [col, (col + 1) % this.cols]
          : [col];
      }
    }
    if (this.damageFlash > 0) this.damageFlash -= dt * 4;
    if (this.vanishing > 0) this.vanishing = Math.max(0, this.vanishing - dt);
    if (this.arriving > 0) this.arriving = Math.max(0, this.arriving - dt);
    if (!this.defeated) {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0 || this.hitsSinceTeleport >= 5) this.teleport();
    }
  }

  teleport() {
    this.teleportTimer = BALANCE.boss.teleportEvery;
    this.hitsSinceTeleport = 0;
    this.vanishing = BALANCE.boss.vanishSeconds;
    this.pendingArrive = BALANCE.boss.arriveSeconds;
  }

  arrive(index) {
    this.holeIndex = index;
    this.arriving = this.pendingArrive || BALANCE.boss.arriveSeconds;
    this.pendingArrive = 0;
  }

  // Cada golpe quita un porcentaje fijo de la vida máxima: 20 golpes = 100 %.
  hit(percent = BALANCE.boss.hitPercent) {
    if (this.defeated) return;
    const p = Math.min(1, Math.max(0, percent));
    const damage = this.maxHp * p;
    if (this.phase < 3) {
      this.hp = Math.max(0, Math.round((this.hp - damage) * 1000) / 1000);
      const nextPhase = this.getPhase();
      if (nextPhase === 3 && this.hp > 0) {
        // Al entrar en la fase partida se reparte la vida restante en dos mitades.
        this.halves = [this.hp / 2, this.hp / 2];
      } else {
        const first = Math.min(this.hp, this.maxHp / 2);
        this.halves = [first, Math.max(0, this.hp - first)];
      }
      this.phase = nextPhase;
    } else {
      if (!this.halves || this.halves.length !== 2) this.halves = [this.hp / 2, this.hp / 2];
      let remaining = damage;
      for (let i = 0; i < 2 && remaining > 0; i++) {
        const applied = Math.min(this.halves[i], remaining);
        this.halves[i] = Math.round((this.halves[i] - applied) * 1000) / 1000;
        remaining -= applied;
      }
      this.hp = Math.round((this.halves[0] + this.halves[1]) * 1000) / 1000;
    }
    this.damageFlash = 1;
    this.hitsSinceTeleport++;
    if (this.hp <= 0) this.defeated = true;
  }

  isRowBlocked(row) { return this.slammedRows.some(r => r.row === row); }
  isColBlocked(col) { return this.blockedCols.includes(col); }
}

export class Game {
  constructor({ audio, input, renderer }) {
    this.audio = audio;
    this.input = input;
    this.renderer = renderer;
    this.screen = SCREEN.MENU;

    this.cols = HOLE_COLS;
    this.rows = HOLE_ROWS;
    this.boardId = '3x3';
    this.timeScale = 1;
    this.hitStopTimer = 0;
    this.hitStopDuration = 0.05;
    this.elapsed = 0;

    this.holes = Array.from({ length: HOLE_COUNT }, (_, i) => new Hole(i));
    this.score = new ScoreManager();
    this.director = new Director();
    this.voltage = BALANCE.voltage.start;
    this.voltageTier = 1;
    this.voltageArmed = false;
    this.voltageFrozen = 0;
    this.nightmare = false;
    this.nightmareTimer = 0;
    this.whiteUsed = false;
    this.fakeEndings = 0;

    this.spawnTimer = 0;
    this.spawnInterval = BALANCE.spawn.startInterval;

    this.sessionHits = 0;
    this.sessionMisses = 0;
    this.pendingInputAt = 0;
    this.lastAudioLatency = 0;

    this.particles = [];
    this.shockwaves = [];
    this.tapRipples = [];
    this.links = [];
    this.linkSeq = 0;
    this.novaDetonations = 0;
    this.novaCoresCleared = 0;
    this.novaPoints = 0;
    this.redTapped = 0;
    this.redPurged = 0;
    this.redEscaped = 0;
    this.clustersCleared = 0;

    this.credits = 0;
    this.creditsGained = 0;
    this.creditMultiplier = 1;
    this.sector = 1;
    this.onEndCycle = null;

    this.loadout = { hammer: 'pulso', chips: ['volc_bomb'] };
    this.resetModifiers();

    this.endgameTriggered = false;
    this.jackpotActive = false;
    this.jackpotTimer = 0;
    this.popups = [];
    this.chainLightning = null;
    this.clutchActive = false;
    this.clutchTimer = 0;

    this.boss = null;
    this.bossMode = false;
    this.bossVictoryTimer = 0;
    this.onBossDefeatedCb = null;

    this.run = this.freshRun();
    this.upgrades = {};
  }

  freshRun() {
    return {
      tier: 1, cyclesDone: 0, scoreTotal: 0, nextBoss: false,
      bossesKilled: 0, lastBoard: this.boardId || '3x3',
      elapsed: 0, novaDetonations: 0, novaCoresCleared: 0, novaPoints: 0,
      redTapped: 0, redPurged: 0, redEscaped: 0, clustersCleared: 0
    };
  }

  // Todos los modificadores se reinician por ciclo: evita fugas entre partidas.
  resetModifiers() {
    this.perfectWindow = 0.15;
    this.bombIgnoresLeft = 0;
    this.bombIgnoreUsed = false;
    this.cronoMultiplier = 1;
    this.voltageMultiplier = 1;
    this.bombToVoltage = false;
    this.mirrorShield = false;
    this.freezeReduction = false;
    this.bossDamageMultiplier = 1;
    this.scoreMultiplier = 1;
    this.creditAbilityMult = 1;
    this.doubleTapChance = 0;
    this.comboKeep = 0;
    this.comboShields = 0;
    this.chainRange = 1;
    this.cronoBonus = 0;
    this.cronoScoreMult = 0;
    this.novaMult = 1;
    this.novaRadiusMult = 1;
    this.novaExtraRing = false;
    this.chipSlots = 2;
    this.startVoltage = 0;
    this.reflectBonus = 0;
    this.umbralBonus = 0;
    this.holeLifetimeMult = 1;
    this.telegraphScale = 1;
    this.abilities = {};
    this.cursorDef = cursorById(this.loadout && this.loadout.hammer);
  }

  applyModifiers() {
    const { hammer, chips = [], abilities = {} } = this.loadout;
    this.abilities = abilities;
    this.cursorDef = cursorById(hammer);
    CURSOR_EFFECTS[this.cursorDef.id]?.(this);
    const pulsoLvl = this.upgrades.pulso || 0;
    const teslaLvl = this.upgrades.tesla || 0;
    if (hammer === 'pulso') this.perfectWindow *= 1 + 0.05 * pulsoLvl;
    if (hammer === 'tesla') this.voltageMultiplier *= 1 + 0.05 * teslaLvl;

    if (chips.includes('perfect_window')) this.perfectWindow *= 1.5;
    if (chips.includes('volc_bomb')) this.bombToVoltage = true;
    if (chips.includes('chrono_x3')) this.cronoMultiplier = 3;
    if (chips.includes('mirror_core')) {
      this.mirrorShield = true;
      this.cronoMultiplier += 0.25;
    }
    if (chips.includes('criogenia')) this.freezeReduction = true;
    if (chips.includes('nucleo')) this.bossDamageMultiplier *= 1.2;
    chips.forEach(id => CHIP_EFFECTS[id]?.(this));

    Object.entries(abilities).forEach(([id, level]) => {
      const def = ABILITIES.find(a => a.id === id);
      const fn = ABILITY_EFFECTS[id];
      if (fn && def && level > 0) fn(this, Math.min(level, def.max));
    });

    this.telegraphScale = Math.max(0.4, this.telegraphScale);
  }

  // ---------- Geometría ----------

  setBoard(boardId) {
    const def = boardById(boardId);
    this.boardId = def.id;
    this.cols = def.cols;
    this.rows = def.rows;
    this.holes = Array.from({ length: def.cols * def.rows }, (_, i) => new Hole(i));
    if (this.canvasWidth) this.setCanvasSize(this.canvasWidth, this.canvasHeight, this.renderer.board);
  }

  centerIndex() { return Math.floor(this.rows / 2) * this.cols + Math.floor(this.cols / 2); }

  setCanvasSize(width, height, board = null) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    let b = board;
    if (!b) {
      const size = Math.min(width * 0.94, height * 0.62);
      b = { x: (width - size) / 2, y: height * 0.20, cell: size / this.cols };
    }
    this.holes.forEach(hole => {
      hole.x = b.x + (hole.index % this.cols) * b.cell + b.cell / 2;
      hole.y = b.y + Math.floor(hole.index / this.cols) * b.cell + b.cell / 2;
      hole.r = b.cell * 0.35;
    });
  }

  // ---------- Pantallas ----------

  startMenu() { this.screen = SCREEN.MENU; }
  startPrep() { this.screen = SCREEN.PREP; }

  startCycle(loadout = {}, options = {}) {
    // Diario: carga fija también a nivel de motor, no solo de UI.
    // Así cualquier llamador (tests, deep link, teclado) produce la misma semilla jugable.
    this.loadout = options.daily
      ? { hammer: 'pulso', chips: [], upgrades: {}, abilities: {} }
      : { hammer: 'pulso', chips: ['volc_bomb'], ...loadout };
    this.upgrades = this.loadout.upgrades || {};
    this.setBoard(options.board || this.boardId || '3x3');
    if (!options.continueRun) this.run = this.freshRun();
    else if (options.run) this.run = { ...this.freshRun(), ...options.run };
    this.run.lastBoard = this.boardId;
    this.runComplete = false;
    this.voltageTier = this.run.tier;
    this.bossMode = !!options.bossMode || (!options.daily && this.run.nextBoss);
    if (!this.bossMode) this.run.nextBoss = false;
    this.sector = options.sector || this.sector || 1;
    const bossOrdinal = this.run.nextBoss
      ? Math.max(1, Math.ceil((this.run.cyclesDone || 0) / BALANCE.run.bossEvery))
      : 1;
    this.bossLevel = 1 + Math.floor((bossOrdinal - 1) / BOSS_ROTATION.length);
    this.bossType = this.run.nextBoss && !options.bossMode
      ? BOSS_ROTATION[(bossOrdinal - 1) % BOSS_ROTATION.length]
      : (BOSS_BY_SECTOR[this.sector] || 'golem');
    this.endless = !!options.endless;
    this.endlessRounds = 0;
    this.endlessMistakes = 0;
    this.daily = !!options.daily;
    this.dailyDate = options.date || null;
    this.dailySeedValue = options.seed != null ? Number(options.seed) >>> 0 : null;
    this.ascension = Math.max(0, Number(options.ascension) || 0);
    this.rng = options.seed != null ? makeRng(options.seed) : Math.random;
    this.telegraphScale = Math.max(0.55, 1 - 0.06 * this.ascension);
    this.bombPressure = Math.min(0.15, 0.03 * this.ascension);
    this.ascensionRules = {
      twin: this.ascension >= 1,
      split: this.ascension >= 2,
      latentMirror: this.ascension >= 3
    };
    this.globalInvertTimer = 12;
    this.globalInvertRemaining = 0;
    this.globalInvertJustStarted = false;
    this.globalInvertJustEnded = false;
    this.creditMultiplier = Math.max(1, Number(options.creditMultiplier) || 1);
    this.screen = SCREEN.PLAYING;
    this.elapsed = 0;
    this.creditsGained = 0;
    this.score.reset();
    this.voltage = Math.min(BALANCE.voltage.max, BALANCE.voltage.start + this.startVoltage);
    this.voltageArmed = false;
    this.voltageFrozen = 0;
    this.nightmare = false;
    this.nightmareTimer = 0;
    this.whiteUsed = false;
    this.fakeEndings = 0;
    this.timeScale = 1;
    this.hitStopTimer = 0;
    this.spawnTimer = 0;
    this.spawnInterval = BALANCE.spawn.startInterval;
    this.sessionHits = 0;
    this.sessionMisses = 0;
    this.novaDetonations = 0;
    this.novaCoresCleared = 0;
    this.novaPoints = 0;
    this.redTapped = 0;
    this.redPurged = 0;
    this.redEscaped = 0;
    this.clustersCleared = 0;
    this.holes.forEach(h => h.reset());
    this.director.reset();

    this.resetModifiers();
    this.applyModifiers();
    this.voltage = Math.min(BALANCE.voltage.max, BALANCE.voltage.start + this.startVoltage);

    this.endgameTriggered = false;
    this.jackpotActive = false;
    this.jackpotTimer = 0;
    this.popups = [];
    this.chainLightning = null;
    this.particles = [];
    this.shockwaves = [];
    this.tapRipples = [];
    this.links = [];
    this.linkSeq = 0;
    this.clutchActive = false;
    this.clutchTimer = 0;

    this.boss = this.bossMode
      ? this.spawnBoss(this.bossType, (this.bossLevel - 1) * BALANCE.boss.levelHpStep, this.bossLevel)
      : null;
    this.bossVictoryTimer = 0;

    this.audio.init();
    this.audio.startMusic();
    this.trySpawn();
  }

  pause() { if (this.screen === SCREEN.PLAYING) { this.screen = 'paused'; } }
  resume() { if (this.screen === 'paused') { this.screen = SCREEN.PLAYING; } }

  spawnBoss(type, extra = 0, level = 1) {
    const boss = this.scaleBoss(new Boss(type, level), extra);
    boss.cols = this.cols;
    boss.rows = this.rows;
    boss.rng = this.rng;
    boss.holeIndex = this.centerIndex();
    this.placeBossCore(boss.holeIndex);
    this.applyBossEnvironment(boss);
    this.spawnPopupAtCenter(`JEFE NV ${boss.level} · ${boss.name}`, boss.color);
    return boss;
  }

  // Cada jefe cambia el entorno. El nivel (vuelta de la rotación de 10) endurece el efecto.
  applyBossEnvironment(boss) {
    const env = BALANCE.boss.env;
    if (boss.type === 'taquigrafo') {
      const factor = Math.max(0.4, 1 - env.tempoFactorPerLevel * boss.level);
      this.holeLifetimeMult *= factor;
      this.telegraphScale = Math.max(0.4, this.telegraphScale * factor);
    }
  }

  // El jefe es un núcleo móvil: occupy un hoyo real y solo se toca cuando aterriza.
  placeBossCore(index) {
    const h = this.holes[index];
    if (!h) return;
    h.reset();
    h.state = HoleState.ACTIVE;
    h.core = CoreType.BOSS;
    h.timer = 0;
    h.lifetime = Number.POSITIVE_INFINITY;
    h.telegraphTime = 0;
  }

  // ---------- Actualización ----------

  update(dt) {
    const realDt = Math.min(dt || 0, 0.1);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= realDt;
      if (this.hitStopTimer < 0) this.hitStopTimer = 0;
      this.updateParticles(realDt);
      return;
    }
    const effectiveDt = realDt * this.timeScale;

    if (this.screen === SCREEN.PLAYING) {
      this.elapsed += effectiveDt;
      if (this.run) this.run.elapsed += effectiveDt;

      if (this.nightmare) {
        this.nightmareTimer -= realDt;
        if (this.nightmareTimer <= 0) this.endNightmare();
      }
      if (this.voltageFrozen > 0) this.voltageFrozen = Math.max(0, this.voltageFrozen - realDt);

      // Voltaje como vida: drena con el tiempo. El Falso Final congela solo la barra.
      if (this.voltageFrozen <= 0) {
        const redDrain = this.holes.filter(h => h.state === HoleState.ACTIVE && h.core === CoreType.BOMB).length
          * BALANCE.voltage.red.drainPerSec;
        const boss = this.boss && !this.boss.defeated ? this.boss : null;
        const baseRate = BALANCE.voltage.drainPerSec + BALANCE.voltage.drainPerSector * (this.sector - 1)
          + redDrain;
        const bossMult = boss ? BALANCE.voltage.bossDrainMult : 1;
        // Sifón drena voltaje extra mientras vive; su intensidad crece con el nivel.
        const siphonDrain = boss && boss.type === 'sifon'
          ? BALANCE.boss.env.siphonDrainPerLevel * boss.level : 0;
        const rate = baseRate * bossMult + siphonDrain;
        this.voltage = Math.max(0, this.voltage - rate * effectiveDt);
        if (this.voltage < BALANCE.voltage.rearmBelow) this.voltageArmed = true;
      }
      if (this.voltage <= 0) {
        this.voltage = 0;
        this.endCycle();
        return;
      }

      // Enlaces: ventana interactiva para limpiar el clúster.
      this.links.forEach(group => {
        if (!group.done) {
          group.timer -= effectiveDt;
          if (group.timer <= 0) this.releaseLinkGroup(group);
        }
      });
      this.links = this.links.filter(g => !g.done && g.timer > 0);

      if (this.clutchActive) {
        this.clutchTimer -= realDt;
        if (this.clutchTimer <= 0) { this.clutchActive = false; this.timeScale = 1; }
      }
      this.timeScale = this.clutchActive ? 0.5 : 1;

      if (this.chainLightning) {
        this.chainLightning.life -= effectiveDt;
        if (this.chainLightning.life <= 0) this.chainLightning = null;
      }

      this.globalInvertJustStarted = false;
      this.globalInvertJustEnded = false;
      if (this.ascensionRules && this.ascensionRules.latentMirror && !this.daily) {
        if (this.globalInvertRemaining > 0) {
          this.globalInvertRemaining -= realDt;
          if (this.globalInvertRemaining <= 0) {
            this.globalInvertRemaining = 0;
            this.globalInvertJustEnded = true;
            this.audio.playGlitch(false);
          }
        } else {
          this.globalInvertTimer -= realDt;
          if (this.globalInvertTimer <= 0) {
            this.globalInvertTimer = 12;
            this.globalInvertRemaining = 2;
            this.globalInvertJustStarted = true;
            this.audio.playGlitch(true);
            this.spawnPopupAtCenter('ESPEJO LATENTE', '#cc00ff');
          }
        }
      }

      if (this.boss && !this.boss.defeated) this.updateBoss(effectiveDt);
      if (this.boss && this.boss.defeated && this.bossVictoryTimer > 0) {
        this.bossVictoryTimer -= realDt;
        if (this.bossVictoryTimer <= 0) {
          if (this.endless) {
            this.boss = null;
            this.spawnInterval = Math.max(0.28, this.spawnInterval - 0.08);
          } else {
            this.endCycle();
            return;
          }
        }
      }

      this.audio.setMusicIntensity(Math.min(1, this.score.combo / 20));

      // Núcleo blanco neón: una vez por ciclo, cuando la partida lo merece.
      if (!this.daily && !this.whiteUsed && !this.boss &&
          (this.score.combo >= BALANCE.whiteCore.minCombo || this.voltage <= BALANCE.whiteCore.maxVoltage)) {
        const candidates = this.holes.filter(h => h.state === HoleState.EMPTY);
        if (candidates.length) {
          const h = candidates[Math.floor((this.rng || Math.random)() * candidates.length)];
          h.spawn(CoreType.WHITE, 1.7);
          h.telegraphTime = 0.45;
          this.whiteUsed = true;
          this.spawnPopup(h.x, h.y - 24, 'SEÑAL ANÓMALA', '#ffffff');
          this.audio.playVoltageFill();
        }
      }

      // Aparición progresiva: muy lenta al inicio, muy rápida al final de la run.
      this.spawnInterval = this.currentSpawnInterval();
      this.spawnTimer -= effectiveDt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this.trySpawn();
      }

      this.holes.forEach(h => {
        this.updateHole(h, effectiveDt);
        if (h.state === HoleState.HIT || h.state === HoleState.ESCAPED) {
          h.timer += effectiveDt;
          if (h.timer > 0.25) h.reset();
        }
      });
      this.updatePopups(effectiveDt);
    }

    this.updateParticles(effectiveDt);
  }

  updateBoss(dt) {
    const boss = this.boss;
    boss.update(dt);
    // Cerrojo puede cerrar la columna donde está el jefe: lo obliga asaltar.
    if (!boss.defeated && boss.isColBlocked(boss.holeIndex % this.cols)) boss.teleport();
    if (boss.pendingArrive > 0 && boss.vanishing <= 0) {
      const candidates = this.holes.filter(h =>
        h.state === HoleState.EMPTY &&
        !boss.isRowBlocked(Math.floor(h.index / this.cols)) &&
        !boss.isColBlocked(h.index % this.cols));
      const pool = candidates.length ? candidates : this.holes.filter(h =>
        h !== this.holes[boss.holeIndex] && !boss.isColBlocked(h.index % this.cols));
      if (!pool.length) return;
      if (pool.length) {
        const next = pool[Math.floor((this.rng || Math.random)() * pool.length)];
        const previous = this.holes[boss.holeIndex];
        if (previous && previous.core === CoreType.BOSS) previous.reset();
        boss.arrive(next.index);
        this.placeBossCore(next.index);
        this.spawnParticles(next.x, next.y, boss.color, 14, { streak: true });
        this.audio.playGlitch(true);
      }
    }
    if (boss.invertJustStarted) {
      this.spawnPopupAtCenter('LECTURA INVERTIDA', '#cc00ff');
      this.audio.playGlitch(true);
    }
    if (boss.invertJustEnded) this.audio.playGlitch(false);
    if (this.freezeReduction) boss.slammedRows.forEach(r => { r.timer = Math.min(r.timer, 1); });
    if (boss.overloadJustFired) this.triggerOverload();
    boss.slammedRows.forEach(r => {
      if (r.half === 2) return; // el hielo congela, no destruye
      for (let c = 0; c < this.cols; c++) {
        const h = this.holes[r.row * this.cols + c];
        if (h && (h.state === HoleState.TELEGRAPH || h.state === HoleState.ACTIVE)) {
          this.spawnParticles(h.x, h.y, boss.color, 6);
          h.reset();
        }
      }
    });
  }

  updateHole(h, dt) {
    if (h.state === HoleState.TELEGRAPH) {
      h.timer += dt;
      if (h.timer >= h.telegraphTime) { h.state = HoleState.ACTIVE; h.timer = 0; }
    } else if (h.state === HoleState.ACTIVE) {
      h.timer += dt;
      if (h.core === CoreType.BOSS) return;
      if (h.timer >= h.lifetime) {
        h.escape();
        if (h.core === CoreType.BOMB) {
          this.redEscaped++;
          this.voltage = Math.max(0, this.voltage - BALANCE.voltage.red.escapePenalty);
          this.spawnPopup(h.x, h.y - 20, '-10 VOLTAJE', '#ff0033');
          this.audio.playEscape((h.index % this.cols - 1) * 0.7);
          this.director.registerMiss();
          this.sessionMisses++;
        } else if (h.core !== CoreType.BOSS) {
          if (this.consumeComboShield(h.x, h.y)) { h.reset(); return; }
          this.audio.playEscape((h.index % this.cols - 1) * 0.7);
          this.score.onMiss(this.comboKeep);
          this.director.registerMiss();
          this.sessionMisses++;
          if (this.endless && ++this.endlessMistakes >= 3) this.endCycle();
        }
      }
    }
  }

  // ---------- Spawns y enlaces ----------

  // Progreso 0→1 a lo largo de la run: define cadencia y tope de núcleos simultáneos.
  spawnProgress() {
    return Math.min(1, Math.max(0, (this.run?.elapsed || 0) / BALANCE.spawn.rampSeconds));
  }

  currentSpawnInterval() {
    const p = this.spawnProgress();
    const base = BALANCE.spawn.startInterval +
      (BALANCE.spawn.minInterval - BALANCE.spawn.startInterval) * p;
    // Enjambre acelera la aparición mientras el jefe está vivo.
    const boss = this.boss;
    if (!boss || boss.defeated || boss.type !== 'enjambre') return base;
    const factor = 1 + BALANCE.boss.env.swarmFactorPerLevel * boss.level;
    return Math.max(BALANCE.spawn.minInterval * 0.5, base / factor);
  }

  trySpawn() {
    const empty = this.holes.filter(h =>
      h.state === HoleState.EMPTY &&
      !(this.boss && h.index === this.boss.holeIndex) &&
      !(this.boss && this.boss.isRowBlocked(Math.floor(h.index / this.cols))) &&
      !(this.boss && this.boss.isColBlocked(h.index % this.cols))
    );
    if (empty.length === 0) return;
    let { hole, core, lifetime, telegraph } = this.director.pick(
      empty, this.elapsed, this.sector, false,
      this.rng, this.bombPressure, this.telegraphScale
    );

    if (this.boss && this.boss.type === 'mirror' && this.boss.invertRemaining > 0 && (this.rng || Math.random)() < 0.5) {
      core = CoreType.BOMB;
      lifetime = 1.4;
      telegraph = Math.max(telegraph, 0.34);
    }

    const reflectChance = this.boss && this.boss.type === 'prisma'
      ? Math.min(0.95, (this.boss.phase === 3 ? 0.8 : this.boss.phase === 2 ? 0.6 : 0.4) +
        0.05 * (this.boss.level - 1)) : 0;
    if (reflectChance && (this.rng || Math.random)() < reflectChance) {
      const row = Math.floor(hole.index / this.cols);
      const col = hole.index % this.cols;
      const mirrored = this.holes[row * this.cols + (this.cols - 1 - col)];
      if (mirrored && mirrored.state === HoleState.EMPTY) hole = mirrored;
    }

    if (this.ascensionRules && this.ascensionRules.split && this.isSplitActive()) {
      lifetime *= 0.72;
      telegraph *= 0.9;
    }
    if (this.boss && this.boss.type === 'apagon' && !this.boss.defeated) {
      // Apagón: la telegrafía se acorta y el tablero se oscurece en el render.
      telegraph *= Math.max(0.4, 1 - BALANCE.boss.env.blackoutTelegraph * this.boss.level);
    }

    hole.spawn(core, lifetime * (this.holeLifetimeMult || 1));
    hole.telegraphTime = telegraph;
    this.audio.playSpawn((hole.index % this.cols - (this.cols - 1) / 2) * 0.6);

    if (!this.daily && !this.boss && core !== CoreType.NOVA && core !== CoreType.WHITE) {
      const chance = BALANCE.links.clusterChanceBase + BALANCE.links.clusterChancePerSector * (this.sector - 1);
      if ((this.rng || Math.random)() < chance) this.spawnLinkedCluster(hole, lifetime * (this.holeLifetimeMult || 1), telegraph);
    }

    if (this.ascensionRules && this.ascensionRules.twin && core === CoreType.BOMB) {
      const others = this.holes.filter(h =>
        h !== hole && h.state === HoleState.EMPTY &&
        !(this.boss && this.boss.isRowBlocked(Math.floor(h.index / this.cols)))
      );
      if (others.length) {
        const twin = others[Math.floor((this.rng || Math.random)() * others.length)];
        twin.spawn(CoreType.BOMB, lifetime * (this.holeLifetimeMult || 1));
        twin.telegraphTime = telegraph;
      }
    }
  }

  spawnLinkedCluster(primary, lifetime, telegraph) {
    const neighbors = this.getNeighbors(primary.index, 1).filter(idx => {
      const h = this.holes[idx];
      return h && h.state === HoleState.EMPTY && !(this.boss && idx === this.boss.holeIndex);
    });
    if (!neighbors.length) return;
    const count = Math.min(neighbors.length, BALANCE.links.maxSize - 1,
      coreIsRed(primary.core) ? 1 : 2);
    if (!count) return;
    const id = ++this.linkSeq;
    const members = [primary];
    for (let i = 0; i < count; i++) {
      const pick = neighbors.shift();
      const h = this.holes[pick];
      h.spawn(primary.core, lifetime, id);
      h.telegraphTime = telegraph;
      members.push(h);
    }
    primary.linkId = id;
    this.links.push({ id, indices: members.map(h => h.index), timer: 0, trapped: false, done: false });
  }

  registerLinkHit(hole) {
    if (!hole.linkId) return false;
    const group = this.links.find(g => g.id === hole.linkId && !g.done);
    if (!group) return false;
    if (!group.trapped) {
      group.trapped = true;
      group.timer = BALANCE.links.trapWindow;
      group.indices.forEach(idx => {
        const h = this.holes[idx];
        if (h && h !== hole && (h.state === HoleState.ACTIVE || h.state === HoleState.TELEGRAPH)) {
          h.lifetime += BALANCE.links.trappedLifeBonus;
          h.trapped = true;
          h.trapTimer = BALANCE.links.trapWindow;
        }
      });
      this.spawnPopup(hole.x, hole.y - 34, 'TRAMPA', '#00f3ff');
      this.audio.playGlitch(true);
    }
    const remaining = group.indices.filter(idx => {
      const h = this.holes[idx];
      return h && (h.state === HoleState.ACTIVE || h.state === HoleState.TELEGRAPH);
    });
    if (remaining.length === 0) {
      this.completeLinkGroup(group);
      return true;
    }
    return true;
  }

  completeLinkGroup(group) {
    group.done = true;
    this.clustersCleared++;
    const extra = Math.max(0, group.indices.length - 1);
    const points = Math.round(BALANCE.core.clusterPerCore * extra * this.scoreMultiplier *
      this.voltageTier * this.score.multiplier);
    this.score.score += points;
    this.score.addCombo(extra * BALANCE.links.comboPerExtra);
    this.director.registerHit(true);
    this.addVoltage(BALANCE.voltage.gain.connected * this.voltageMultiplier);
    const cx = group.indices.reduce((sum, idx) => sum + this.holes[idx].x, 0) / group.indices.length;
    const cy = group.indices.reduce((sum, idx) => sum + this.holes[idx].y, 0) / group.indices.length;
    this.spawnPopup(cx, cy - 40, `CHAIN ×${group.indices.length} +${points}`, '#ffcc00');
    this.spawnParticles(cx, cy, '#ffcc00', 26, { streak: true, speed: 2.2 });
    this.shockwaves.push({ x: cx, y: cy, life: 0.5, maxLife: 0.5, radius: this.renderer?.board?.cell * 1.4 || 120, extraRing: true });
    this.triggerShake(12);
    this.triggerFlash(0.35);
    this.audio.playNova(0);
  }

  releaseLinkGroup(group) {
    group.done = true;
    group.indices.forEach(idx => {
      const h = this.holes[idx];
      if (h) { h.trapped = false; h.trapTimer = 0; }
    });
  }

  isSplitActive() {
    if (this.boss && !this.boss.defeated) return this.boss.phase >= 2;
    return this.voltage <= 25;
  }

  // ---------- Entrada ----------

  playCursorHit(perfect, pan = 0) {
    this.audio.playHit(perfect, pan, this.loadout && this.loadout.hammer);
  }

  consumeComboShield(x, y) {
    if (!this.comboShields || this.comboShields <= 0) return false;
    this.comboShields--;
    this.spawnPopup(x, y - 22, 'GUARDIA', '#7b8cff');
    this.spawnParticles(x, y, '#7b8cff', 10);
    this.playCursorHit(true, 0);
    return true;
  }

  isBossHole(hole) {
    return !!this.boss && !this.boss.defeated && hole.index === this.boss.holeIndex;
  }

  handlePointerHole(hole) {
    if (this.hitStopTimer > 0 || this.screen !== SCREEN.PLAYING) return;
    if (!hole || (hole.state !== HoleState.ACTIVE && hole.state !== HoleState.TELEGRAPH)) return;

    const pan = (hole.index % this.cols - (this.cols - 1) / 2) * 0.6;
    this.lastInputLatency = this.input && this.input.lastEventLatency ? this.input.lastEventLatency : 0;
    this.pendingInputAt = this.input && this.input.lastPointerTime ? this.input.lastPointerTime : 0;

    if (this.isBossHole(hole)) {
      if (!this.boss.vulnerable) {
        this.spawnPopup(hole.x, hole.y - 20, 'EN TRÁNSITO', this.boss.color);
        return;
      }
      hole.hit();
      this.sessionHits++;
      const perfect = hole.timer < this.perfectWindow;
      const pts = Math.round(BALANCE.core.bossHit * this.bossDamageMultiplier *
        this.score.multiplier * (perfect ? 2 : 1) * this.scoreMultiplier * this.voltageTier);
      this.score.score += pts;
      this.damageBoss(BALANCE.boss.hitPercent);
      this.playCursorHit(perfect, pan);
      this.audio.playBossHit();
      this.spawnPopup(hole.x, hole.y - 24, `+${pts} JEFE`, this.boss.color);
      this.spawnParticles(hole.x, hole.y, this.boss.color, 18, { streak: true });
      this.triggerShake(9);
      this.triggerHitStop(0.05);
      return;
    }

    if (this.boss && this.boss.isColBlocked(hole.index % this.cols)) {
      this.spawnPopup(hole.x, hole.y - 20, 'CERROJO', '#ff4fa3');
      this.triggerShake(3);
      return;
    }
    if (this.boss && this.boss.isRowBlocked(Math.floor(hole.index / this.cols))) {
      this.spawnPopup(hole.x, hole.y - 20, 'BLOQUEADO', '#ff0033');
      this.triggerShake(3);
      return;
    }

    const activeWindow = this.perfectWindow * (this.score.combo >= 10 ? 1 + this.umbralBonus : 1);
    const perfect = hole.timer < activeWindow;
    hole.hit();
    this.sessionHits++;
    this.registerLinkHit(hole);

    if (typeof navigator !== 'undefined' && navigator.vibrate &&
        typeof window !== 'undefined' && window.__userInteracted && window.__hapticsEnabled !== false) {
      navigator.vibrate(perfect ? 20 : 10);
    }

    if (hole.core === CoreType.BOMB) {
      this.hitRedCore(hole, pan);
      return;
    }

    if (hole.core === CoreType.WHITE) {
      if (this.fakeEndings > 0) { hole.reset(); return; }
      this.whiteUsed = true;
      this.fakeEndings++;
      this.score.score += Math.round(BALANCE.whiteCore.scoreBonus * this.score.multiplier * this.voltageTier);
      this.startNightmare();
      this.spawnPopup(hole.x, hole.y - 28, 'FALSO FINAL', '#ffffff');
      this.spawnParticles(hole.x, hole.y, '#ffffff', 30, { streak: true, speed: 2.5 });
      this.playCursorHit(true, pan);
      this.audio.playVoltageFill();
      return;
    }

    if (hole.core === CoreType.NOVA) {
      this.detonateNova(hole, perfect, pan);
    } else if (hole.core === CoreType.CRONO) {
      const extra = this.scoreMultiplier * (1 + this.cronoScoreMult);
      const base = BALANCE.core.crono * this.score.multiplier * (perfect ? 2 : 1) * extra * this.voltageTier;
      const bonus = base * (this.cronoMultiplier - 1);
      this.score.onHit(perfect, extra, this.voltageTier);
      this.score.score += Math.round(bonus);
      this.director.registerHit(perfect);
      this.playCursorHit(perfect, pan);
      this.addVoltage((perfect ? 4 : 2) * this.voltageMultiplier + this.cronoBonus * 2);
      this.triggerHitStop(0.04);
      this.triggerShake(5);
      this.spawnParticles(hole.x, hole.y, this.cursorDef?.color || '#cc00ff', 12,
        { streak: ['arc', 'star', 'rainbow'].includes(this.cursorDef?.trail) });
      this.spawnPopup(hole.x, hole.y - 20, `+${Math.round(base + bonus)}`, '#cc00ff');
      this.damageBoss(BALANCE.boss.hitPercent);
      if (this.loadout.hammer === 'tesla' || this.loadout.chips.includes('chain_master')) this.triggerChainLightning(hole);
    } else {
      const linked = !!hole.linkId;
      const gain = linked ? BALANCE.voltage.gain.connected
        : perfect ? BALANCE.voltage.gain.perfect : BALANCE.voltage.gain.normal;
      const pts = this.score.onHit(perfect, this.scoreMultiplier, this.voltageTier);
      this.director.registerHit(perfect);
      this.playCursorHit(perfect, pan);
      this.triggerHitStop(perfect ? 0.06 : 0.04);
      this.triggerShake(perfect ? 8 : 4);
      this.spawnParticles(hole.x, hole.y,
        perfect ? '#ffcc00' : (this.cursorDef?.color || '#00f3ff'), perfect ? 16 : 10,
        { streak: ['arc', 'star', 'rainbow', 'ghost'].includes(this.cursorDef?.trail) });
      this.addVoltage(gain * this.voltageMultiplier);
      if (perfect) this.triggerFlash(0.12);
      this.spawnPopup(hole.x, hole.y - 20, perfect ? `+${pts} PERFECT` : `+${pts}`, perfect ? '#ffcc00' : '#00f3ff');
      this.damageBoss(BALANCE.boss.hitPercent);
      if (this.doubleTapChance > 0 && (this.rng || Math.random)() < this.doubleTapChance) {
        const extraPts = Math.round(pts * 0.5 * this.voltageTier);
        this.score.score += extraPts;
        this.spawnPopup(hole.x, hole.y - 42, `+${extraPts} DOBLE`, '#00f3ff');
        this.playCursorHit(true, -pan);
      }
      if (this.loadout.hammer === 'tesla' || this.loadout.chips.includes('chain_master')) this.triggerChainLightning(hole);
    }

    if (hole.core !== CoreType.BOMB && hole.core !== CoreType.NOVA &&
        this.loadout.chips.includes('reflejo') && this.sessionHits % 3 === 0) {
      this.triggerReflejo(hole);
    }

    if (this.score.lastMilestone && this.score.lastMilestone !== this._lastAnnouncedMilestone) {
      this._lastAnnouncedMilestone = this.score.lastMilestone;
      this.announceMilestone(this.score.lastMilestone);
    }

    // QA: latencia real desde el evento de puntero hasta el inicio del SFX
    if (this.pendingInputAt && this.audio.lastSfxAt >= this.pendingInputAt) {
      this.lastAudioLatency = this.audio.lastSfxAt - this.pendingInputAt;
      this.pendingInputAt = 0;
    }
  }

  // Núcleos rojos: tocar castiga; arrastrar ≥60 px los purga sin castigo.
  hitRedCore(hole, pan = 0) {
    if (this.bombIgnoresLeft > 0) {
      this.bombIgnoresLeft--;
      this.bombIgnoreUsed = true;
      this.spawnPopup(hole.x, hole.y - 20, 'ESCUDO', '#ffcc00');
      this.playCursorHit(true, pan);
      this.triggerShake(4);
      this.spawnParticles(hole.x, hole.y, '#ffcc00', 8);
      return;
    }
    if (this.consumeComboShield(hole.x, hole.y)) return;
    this.redTapped++;
    const linked = !!hole.linkId;
    const penalty = linked ? BALANCE.voltage.red.tapComboLinked : BALANCE.voltage.red.tapCombo;
    this.score.reduceCombo(penalty);
    this.score.bombs++;
    this.voltage = Math.max(0, this.voltage - BALANCE.voltage.red.tapPenalty);
    this.director.registerHit(false);
    this.audio.playBomb();
    this.triggerHitStop(0.08);
    this.triggerShake(10);
    this.triggerFlash(0.25);
    this.spawnPopup(hole.x, hole.y - 20, `-${penalty} COMBO · -${BALANCE.voltage.red.tapPenalty} V`, '#ff0033');
    this.spawnParticles(hole.x, hole.y, '#ff0033', 14);
  }

  purgeRed(hole) {
    if (!hole || hole.core !== CoreType.BOMB || hole.state !== HoleState.ACTIVE) return false;
    this.redPurged++;
    const targets = [hole];
    if (hole.linkId) {
      const group = this.links.find(g => g.id === hole.linkId);
      if (group) {
        group.indices.forEach(idx => {
          const other = this.holes[idx];
          if (other && other !== hole && other.core === CoreType.BOMB &&
              (other.state === HoleState.ACTIVE || other.state === HoleState.TELEGRAPH)) targets.push(other);
        });
        group.done = true;
      }
    }
    targets.forEach(h => {
      this.spawnParticles(h.x, h.y, '#ff3355', 18, { streak: true, speed: 1.6 });
      h.reset();
    });
    this.spawnPopup(hole.x, hole.y - 26, `PURGADO ×${targets.length}`, '#00f3ff');
    this.audio.playVoltageFill();
    this.triggerShake(6);
    return true;
  }

  updateDragVisuals(hole, x, y) {
    if (hole) { hole.dragX = x; hole.dragY = y; }
    this._dragHole = hole;
  }

  clearDragVisuals() {
    if (this._dragHole) { this._dragHole.dragX = 0; this._dragHole.dragY = 0; }
    this._dragHole = null;
  }

  announceMilestone(value) {
    this.spawnPopupAtCenter(`COMBO ${value} · ×${comboMultiplier(value)}`, '#ffcc00');
    this.audio.playVoltageFill();
    this.triggerFlash(0.22);
  }

  spawnPopupAtCenter(text, color) {
    const c = this.centerIndex();
    const h = this.holes[c];
    this.spawnPopup(h ? h.x : this.canvasWidth / 2, h ? h.y - 40 : 80, text, color);
  }

  // ---------- Voltaje, Falso Final y Nova ----------

  addVoltage(amt) {
    const before = this.voltage;
    this.voltage = Math.min(BALANCE.voltage.max, this.voltage + amt);
    if (this.voltage >= BALANCE.voltage.max && this.voltageArmed && this.voltageTier < BALANCE.voltage.maxTier) {
      this.voltageTier++;
      this.voltageArmed = false;
      this.run.tier = this.voltageTier;
      // La barra se reinicia con margen de error para no perder la run al subir de tier.
      this.voltage = BALANCE.voltage.max * BALANCE.voltage.tierRefill;
      this.audio.playVoltageFill();
      this.triggerFlash(0.3);
      this.triggerShake(10);
      this.spawnPopupAtCenter(`VOLTAJE ×${this.voltageTier}`, '#00f3ff');
    } else if (this.voltage >= BALANCE.voltage.max && before < BALANCE.voltage.max) {
      this.audio.playVoltageFill();
    }
  }

  startNightmare() {
    if (this.nightmare || this.daily) return;
    this.nightmare = true;
    this.nightmareTimer = BALANCE.voltage.freezeSeconds;
    this.voltageFrozen = BALANCE.voltage.freezeSeconds;
    this.audio.playOverdriveStart();
    this.audio.setMusicOverdrive(true); // FX de Overdrive reutilizados para Pesadilla
    this.triggerFlash(0.4);
    this.triggerShake(14);
    if (typeof document !== 'undefined') document.getElementById('app')?.classList.add('nightmare');
  }

  endNightmare() {
    if (!this.nightmare) return;
    this.nightmare = false;
    this.nightmareTimer = 0;
    this.audio.playOverdriveEnd();
    this.audio.setMusicOverdrive(false);
    if (typeof document !== 'undefined') document.getElementById('app')?.classList.remove('nightmare');
  }

  novaValue(core) {
    const values = BALANCE.nova.coreValues;
    if (core === CoreType.NOVA) return values.nova;
    if (core === CoreType.CRONO) return values.crono;
    if (core === CoreType.BOMB) return values.bomb;
    if (core === CoreType.WHITE) return values.white;
    return values.standard;
  }

  // Nova ya no tiene 3 ondas ni porcentajes: una sola explosión paga los núcleos
  // que elimina, sin crear combo artificial ni limpiar núcleos que aparezcan después.
  detonateNova(origin, perfect, pan) {
    const novaGain = this.novaMult * this.scoreMultiplier;
    const base = this.score.multiplier * (perfect ? 2 : 1) * novaGain * this.voltageTier;
    let raw = 0;
    let cleared = 0;
    this.holes.forEach(h => {
      const alive = h.state === HoleState.TELEGRAPH || h.state === HoleState.ACTIVE ||
        h.state === HoleState.HIT;
      if (!alive || this.isBossHole(h) || h.core === CoreType.WHITE) return;
      raw += this.novaValue(h.core);
      cleared++;
      this.spawnParticles(h.x, h.y, cleared % 2 ? '#ffcc00' : '#ff6a00', 12, { streak: true });
      h.reset();
    });
    const points = Math.round(raw * base);
    this.score.score += points;
    this.novaDetonations++;
    this.novaCoresCleared += cleared;
    this.novaPoints += points;
    this.director.registerHit(!!perfect);
    this.addVoltage(BALANCE.voltage.gain.nova * this.voltageMultiplier);
    if (this.boss && !this.boss.defeated) this.damageBoss(BALANCE.boss.hitPercent);
    this.spawnPopup(origin.x, origin.y - 28, `NOVA +${points} · ${cleared} NÚCLEOS`, '#ffcc00');
    const reach = Math.max(120, ...this.holes.map(h => Math.hypot(h.x - origin.x, h.y - origin.y)));
    this.shockwaves.push({
      x: origin.x, y: origin.y,
      life: this.novaExtraRing ? 0.9 : 0.75,
      maxLife: this.novaExtraRing ? 0.9 : 0.75,
      radius: (reach * 1.3 + 40) * this.novaRadiusMult,
      extraRing: !!this.novaExtraRing
    });
    this.triggerHitStop(BALANCE.nova.hitStop);
    this.triggerShake(BALANCE.nova.shake);
    this.triggerFlash(BALANCE.nova.flash);
    this.audio.playNova(pan || 0);
  }

  addTapRipple(x, y) {
    this.tapRipples.push({ x, y, life: 0.35, maxLife: 0.35 });
    if (this.tapRipples.length > 12) this.tapRipples.shift();
  }

  triggerOverload() {
    const candidates = this.holes.filter(h =>
      h.state === HoleState.ACTIVE && h.core !== CoreType.BOMB && !this.isBossHole(h) &&
      !(this.boss && this.boss.isRowBlocked(Math.floor(h.index / this.cols)))
    );
    if (candidates.length === 0) return;
    const h = candidates[Math.floor((this.rng || Math.random)() * candidates.length)];
    h.core = CoreType.BOMB;
    h.lifetime = Math.max(1.2, h.lifetime * 0.85);
    this.spawnPopup(h.x, h.y - 20, 'SOBRECARGA', '#ff0033');
    this.spawnParticles(h.x, h.y, '#ff0033', 10);
    this.audio.playBomb();
  }

  triggerReflejo(originHole) {
    const row = Math.floor(originHole.index / this.cols);
    const col = originHole.index % this.cols;
    const target = this.holes[row * this.cols + (this.cols - 1 - col)];
    if (!target || target.state !== HoleState.ACTIVE || target.core === CoreType.BOMB || this.isBossHole(target)) return;
    target.hit();
    this.score.onHit(false, 1 + this.reflectBonus, this.voltageTier);
    this.director.registerHit(false);
    this.damageBoss(BALANCE.boss.hitPercent);
    this.spawnParticles(target.x, target.y, '#cc00ff', 8);
    this.spawnPopup(target.x, target.y - 20, '+REFLEJO', '#cc00ff');
    const existing = this.chainLightning && this.chainLightning.from !== originHole.index ? this.chainLightning.to : [];
    this.chainLightning = { from: originHole.index, to: [...existing, target.index], life: 0.25 };
    this.playCursorHit(false, (target.index % this.cols - (this.cols - 1) / 2) * 0.6);
  }

  activateClutchSlowMo() {
    if (this.clutchActive) return;
    this.clutchActive = true;
    this.clutchTimer = 2.5;
    this.timeScale = 0.5;
    this.audio.playSlowMoStart();
    this.triggerFlash(0.15);
  }

  getNeighbors(index, range = 1) {
    const row = Math.floor(index / this.cols);
    const col = index % this.cols;
    const neighbors = [];
    for (let r = Math.max(0, row - range); r <= Math.min(this.rows - 1, row + range); r++) {
      for (let c = Math.max(0, col - range); c <= Math.min(this.cols - 1, col + range); c++) {
        if (r === row && c === col) continue;
        neighbors.push(r * this.cols + c);
      }
    }
    return neighbors;
  }

  triggerChainLightning(originHole) {
    const neighbors = this.getNeighbors(originHole.index, Math.max(1, this.chainRange || 1));
    const targets = neighbors.map(idx => this.holes[idx]).filter(h =>
      h && h.state === HoleState.ACTIVE && h.core !== CoreType.BOMB && !this.isBossHole(h)
    );
    if (!targets.length) return;
    targets.forEach(h => {
      h.hit();
      this.score.onHit(false, this.scoreMultiplier, this.voltageTier);
      this.director.registerHit(false);
      this.damageBoss(BALANCE.boss.hitPercent);
      this.spawnParticles(h.x, h.y, '#00f3ff', 8);
      this.spawnPopup(h.x, h.y - 20, '+CHAIN', '#00f3ff');
    });
    this.chainLightning = { from: originHole.index, to: targets.map(t => t.index), life: 0.25 };
    this.triggerShake(6);
    this.playCursorHit(true, (originHole.index % this.cols - (this.cols - 1) / 2) * 0.6);
    this.addVoltage(4 * this.voltageMultiplier);
  }

  scaleBoss(boss, extra = 0) {
    const mult = 1 + 0.12 * this.ascension + extra;
    boss.maxHp = Math.round(boss.maxHp * mult);
    boss.hp = boss.maxHp;
    return boss;
  }

  spawnEndlessBoss() {
    const wave = Math.max(1, Math.ceil(this.endlessRounds / 3));
    const type = BOSS_ROTATION[(wave - 1) % BOSS_ROTATION.length];
    const level = 1 + Math.floor((wave - 1) / BOSS_ROTATION.length);
    this.boss = this.spawnBoss(type, endlessHpBonus(wave), level);
    this.bossVictoryTimer = 0;
    this.spawnPopupAtCenter(`JEFE ∞ · NV${level} · ${this.boss.name}`, '#ffcc00');
    this.triggerFlash(0.3);
  }

  // Vida del jefe: exactamente el 5 % de la vida máxima por golpe válido (20 golpes).
  // Los bonuses de "Rompejefes" afectan a los puntos, nunca a la barra.
  damageBoss(percent = BALANCE.boss.hitPercent) {
    if (!this.boss || this.boss.defeated || !this.boss.vulnerable) return;
    this.boss.hit(percent);
    if (this.boss.defeated) this.onBossDefeated();
  }

  onBossDefeated() {
    if (this.bossVictoryTimer > 0) return;
    this.bossVictoryTimer = 2.5;
    const bossHole = this.holes[this.boss.holeIndex];
    if (bossHole && bossHole.core === CoreType.BOSS) bossHole.reset();
    this.run.bossesKilled++;
    this.score.score += Math.round(BALANCE.run.bossKillScore * this.score.multiplier * this.voltageTier);
    this.spawnPopupAtCenter(`+${BALANCE.run.bossKillScore.toLocaleString('es-ES')} JEFE`, '#ffcc00');
    this.audio.playVoltageFill();
    this.triggerFlash(0.4);
    this.triggerShake(15);
    if (typeof this.onBossDefeatedCb === 'function') {
      this.onBossDefeatedCb({ sector: this.sector, type: this.boss.type });
    }
  }

  spawnPopup(x, y, text, color) {
    this.popups.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
  }

  updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 30 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  // Instantáneo completo de la run para la tarjeta de resultados.
  getRunReport() {
    const s = this.score;
    const r = this.run || {};
    const closed = this.screen === SCREEN.RESULTS;
    const total = (key, current) => closed ? (r[key] || 0) : (current || 0);
    return {
      score: s.score,
      maxCombo: s.maxCombo,
      combo: s.combo,
      multiplier: s.multiplier,
      perfects: s.perfects,
      hits: s.totalHits,
      misses: s.totalMisses,
      bombs: s.bombs,
      lastMilestone: s.lastMilestone,
      cyclesDone: r.cyclesDone || 0,
      maxCycles: BALANCE.run.maxCycles,
      runScore: r.scoreTotal || 0,
      tier: this.voltageTier,
      voltage: Math.round(this.voltage),
      bossesKilled: r.bossesKilled || 0,
      fakeEndings: this.fakeEndings,
      novaDetonations: total('novaDetonations', this.novaDetonations),
      novaCoresCleared: total('novaCoresCleared', this.novaCoresCleared),
      novaPoints: total('novaPoints', this.novaPoints),
      redTapped: total('redTapped', this.redTapped),
      redPurged: total('redPurged', this.redPurged),
      redEscaped: total('redEscaped', this.redEscaped),
      clustersCleared: total('clustersCleared', this.clustersCleared),
      cycleSeconds: Math.round(this.elapsed),
      runSeconds: Math.round(r.elapsed || 0),
      board: this.boardId,
      boardSize: `${this.cols}×${this.rows}`,
      sector: this.sector,
      daily: !!this.daily,
      dailyDate: this.dailyDate || null,
      dailySeed: this.dailySeedValue || null,
      endless: !!this.endless,
      endlessRounds: this.endlessRounds || 0,
      endlessMistakes: this.endlessMistakes || 0,
      creditsGained: this.creditsGained,
      creditsTotal: this.credits,
      ascension: this.ascension || 0,
      runComplete: !!this.runComplete
    };
  }

  endCycle() {
    if (this.screen === SCREEN.RESULTS) return;
    this.endNightmare();
    this.screen = SCREEN.RESULTS;
    this.audio.stopMusic();
    this.run.cyclesDone++;
    this.run.scoreTotal += this.score.score;
    this.run.tier = this.voltageTier;
    this.run.novaDetonations = (this.run.novaDetonations || 0) + this.novaDetonations;
    this.run.novaCoresCleared = (this.run.novaCoresCleared || 0) + this.novaCoresCleared;
    this.run.novaPoints = (this.run.novaPoints || 0) + this.novaPoints;
    this.run.redTapped = (this.run.redTapped || 0) + this.redTapped;
    this.run.redPurged = (this.run.redPurged || 0) + this.redPurged;
    this.run.redEscaped = (this.run.redEscaped || 0) + this.redEscaped;
    this.run.clustersCleared = (this.run.clustersCleared || 0) + this.clustersCleared;
    if (this.run.cyclesDone >= BALANCE.run.maxCycles) this.runComplete = true;
    if (this.run.cyclesDone % BALANCE.run.bossEvery === 0) this.run.nextBoss = true;
    if (this.endless) {
      const bonus = this.endlessRounds * 50;
      this.score.score += bonus;
      this.run.scoreTotal += bonus;
    }
    const gain = Math.floor(this.score.score * BALANCE.credits.perScore *
      this.creditMultiplier * this.creditAbilityMult);
    this.credits += gain;
    this.creditsGained = gain;
    if (this.onEndCycle) this.onEndCycle(this.getRunReport());
  }

  // ---------- Efectos ----------

  triggerHitStop(dur) { this.hitStopTimer = dur; }
  triggerShake(intensity) { this.shakeIntensity = intensity; }
  triggerFlash(amt) {
    const reduced = typeof window !== 'undefined' && window.__reduceFlash;
    this.flashAmount = reduced ? amt * 0.2 : amt;
  }

  spawnParticles(x, y, color, count, opts = {}) {
    const spread = opts.spread || 6;
    for (let i = 0; i < count; i++) {
      const speed = opts.speed || 1;
      this.particles.push({
        x, y, px: x, py: y,
        vx: (Math.random() - 0.5) * spread * speed,
        vy: (Math.random() - 0.5) * spread * speed - speed,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9, color,
        size: 2 + Math.random() * 3,
        streak: !!opts.streak
      });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  updateParticles(dt) {
    const frames = dt * 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.px = p.x; p.py = p.y;
      p.x += p.vx * frames;
      p.y += p.vy * frames;
      p.vy += 0.05 * frames;
      const drag = Math.pow(0.985, frames);
      p.vx *= drag; p.vy *= drag;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life -= dt;
      if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
    }
    for (let i = this.tapRipples.length - 1; i >= 0; i--) {
      this.tapRipples[i].life -= dt;
      if (this.tapRipples[i].life <= 0) this.tapRipples.splice(i, 1);
    }
  }
}

function coreIsRed(core) { return core === CoreType.BOMB; }
