import { dailyCode, ascensionRuleNames, ASCENSION_RULES } from './game.js';
import { ABILITIES, abilityCost, CHIPS_EXTRA, CURSORS } from './content.js';
import { BALANCE, BOARDS, boardById, comboMultiplier, nextComboMilestone } from './balance.js';

// Precios heredados escalados ×10 con el resto de la tienda.
const LEGACY_PRICES = {
  chain_master: 3000, mirror_core: 5000, reflejo: 7000,
  criogenia: 9000, nucleo: 11000, pulso: 1000, tesla: 1000
};

export class UI {
  constructor({ game, audio, input, renderer }) {
    this.game = game;
    this.audio = audio;
    this.input = input;
    this.renderer = renderer;

    this.screens = {
      menu: document.getElementById('screen-menu'),
      prep: document.getElementById('screen-prep'),
      playing: null, // no hay pantalla de juego, es el canvas
      results: document.getElementById('screen-results'),
      settings: document.getElementById('screen-settings'),
      archive: document.getElementById('screen-archive'),
      upgrades: document.getElementById('screen-upgrades'),
      final: document.getElementById('screen-final')
    };

    this.hud = document.getElementById('hud');
    this.pauseOverlay = document.getElementById('overlay-pause');

    this.selectedHammer = 'pulso';
    this.selectedChips = new Set(['volc_bomb']);
    this.selectedBoard = this.progress?.boardId || '3x3';
    this.runState = null; // continuidad de voltaje/ronda dentro de una run
    this.sectorCleared = 0; // último sector cuyo jefe fue derrotado
    this.chipLabels = {
      volc_bomb: 'BOMBAS → VOLTAJE',
      chrono_x3: 'CRONO ×3',
      perfect_window: 'VENTANA ×1.5',
      chain_master: 'RAYO MAESTRO',
      mirror_core: 'ESPEJO',
      reflejo: 'REFLEJO',
      criogenia: 'CRIOGENIA',
      nucleo: 'NÚCLEO',
      combo_guard: 'GUARDIA COMBO',
      nova_surge: 'SURGE NOVA',
      shadow_step: 'PASO UMBRÍO',
      voltage_siphon: 'SIFÓN VOLTAJE',
      chrono_loop: 'BUCLE CRONO'
    };

    // Cargar progreso persistente
    this.progress = this.loadProgress();
    this.selectedBoard = this.progress.boardId || '3x3';
    this.game.credits = this.progress.credits || 0;
    this.applySettings();

    this.buildPrepOptions();
    this.bindUI();
    this.showScreen('menu');
  }

  loadProgress() {
    let data = {
      credits: 0, bestScore: 0, bestCombo: 0, sector: 1,
      upgrades: {}, unlocked: [], bossDefeated: [],
      cycles: 0, endlessBest: 0, ending: false,
      ascension: 0, endingChoice: null,
      dailyBest: {}, dailyRuns: {}, dailyStreak: 0, endingReward: null,
      abilities: {}, ownedCursors: ['pulso'],
      boardId: '3x3', bestScoreByBoard: {}, fakeEndings: 0, bossKills: 0
    };
    try {
      const raw = localStorage.getItem('overclock9_progress');
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch (e) { /* localStorage no disponible */ }
    data.upgrades = data.upgrades || {};
    data.unlocked = Array.isArray(data.unlocked) ? data.unlocked : [];
    data.bossDefeated = Array.isArray(data.bossDefeated) ? data.bossDefeated : [];
    data.cycles = Number(data.cycles) || 0;
    data.endlessBest = Number(data.endlessBest) || 0;
    data.ending = !!data.ending;
    data.ascension = Number(data.ascension) || 0;
    data.endingChoice = data.endingChoice === 'accept' || data.endingChoice === 'reject' ? data.endingChoice : null;
    data.dailyBest = data.dailyBest && typeof data.dailyBest === 'object' ? data.dailyBest : {};
    data.dailyRuns = data.dailyRuns && typeof data.dailyRuns === 'object' ? data.dailyRuns : {};
    data.dailyStreak = Number(data.dailyStreak) || 0;
    data.endingReward = data.endingReward && typeof data.endingReward === 'object' ? data.endingReward : null;
    data.abilities = data.abilities && typeof data.abilities === 'object' ? data.abilities : {};
    data.ownedCursors = Array.isArray(data.ownedCursors) && data.ownedCursors.length
      ? data.ownedCursors : ['pulso'];
    if (!data.ownedCursors.includes('pulso')) data.ownedCursors.unshift('pulso');
    data.bestScoreByBoard = data.bestScoreByBoard && typeof data.bestScoreByBoard === 'object'
      ? data.bestScoreByBoard : {};
    data.boardId = BOARDS.some(b => b.id === data.boardId) ? data.boardId : '3x3';
    data.fakeEndings = Number(data.fakeEndings) || 0;
    data.bossKills = Number(data.bossKills) || 0;
    return data;
  }

  saveProgress() {
    this.writeProgress(true);
  }

  writeProgress(includeScore) {
    try {
      const data = this.loadProgress();
      data.credits = this.game.credits;
      if (includeScore) {
        data.bestScore = Math.max(data.bestScore || 0, this.game.score.score);
        data.bestCombo = Math.max(data.bestCombo || 0, this.game.score.maxCombo);
        const board = this.game.boardId || '3x3';
        data.bestScoreByBoard = data.bestScoreByBoard || {};
        data.bestScoreByBoard[board] = Math.max(data.bestScoreByBoard[board] || 0, this.game.score.score);
      }
      data.upgrades = this.progress.upgrades || {};
      data.unlocked = this.progress.unlocked || [];
      data.settings = this.progress.settings || {};
      data.sector = this.progress.sector || 1;
      data.bossDefeated = this.progress.bossDefeated || [];
      data.cycles = this.progress.cycles || 0;
      data.endlessBest = this.progress.endlessBest || 0;
      data.ending = !!this.progress.ending;
      data.ascension = this.progress.ascension || 0;
      data.endingChoice = this.progress.endingChoice || null;
      data.dailyBest = this.progress.dailyBest || {};
      data.dailyRuns = this.progress.dailyRuns || {};
      data.dailyStreak = this.progress.dailyStreak || 0;
      data.endingReward = this.progress.endingReward || null;
      data.abilities = this.progress.abilities || {};
      data.ownedCursors = this.progress.ownedCursors || ['pulso'];
      data.boardId = this.progress.boardId || '3x3';
      data.bestScoreByBoard = this.progress.bestScoreByBoard || {};
      data.fakeEndings = this.progress.fakeEndings || 0;
      data.bossKills = this.progress.bossKills || 0;
      localStorage.setItem('overclock9_progress', JSON.stringify(data));
      this.progress = data;
    } catch (e) { /* localStorage no disponible */ }
  }

  applySettings() {
    const s = this.progress.settings || {};
    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = value;
    };
    setChecked('setting-audio', s.audio !== false);
    setChecked('setting-haptic', s.haptic !== false);
    setChecked('setting-reduce-flash', !!s.reduceFlash);
    setChecked('setting-colorblind', !!s.colorblind);

    window.__hapticsEnabled = s.haptic !== false;
    window.__reduceFlash = !!s.reduceFlash;
    window.__colorblind = !!s.colorblind;
    this.audio.setEnabled(s.audio !== false);
  }

  setSetting(key, value) {
    this.progress.settings = this.progress.settings || {};
    this.progress.settings[key] = value;
    this.writeProgress(false);
  }

  // Genera las opciones desde el catálogo único (content.js): 10 cursores y 10 chips.
  buildPrepOptions() {
    const hammers = document.getElementById('prep-hammers');
    if (hammers) {
      hammers.innerHTML = '';
      CURSORS.forEach(c => {
        const el = document.createElement('div');
        el.className = 'prep-chip';
        el.dataset.hammer = c.id;
        el.textContent = c.name;
        el.title = `${c.name}: ${c.skill}`;
        el.setAttribute('aria-label', `${c.name}. ${c.skill}`);
        hammers.appendChild(el);
      });
    }
    const chips = document.getElementById('prep-chips');
    if (chips) {
      chips.innerHTML = '';
      Object.entries(this.chipLabels).forEach(([id, label]) => {
        const el = document.createElement('div');
        el.className = 'prep-chip';
        el.dataset.chip = id;
        el.textContent = label;
        chips.appendChild(el);
      });
    }
    const boards = document.getElementById('prep-boards');
    if (boards) {
      boards.innerHTML = '';
      BOARDS.forEach(b => {
        const el = document.createElement('div');
        el.className = 'prep-chip';
        el.dataset.board = b.id;
        el.textContent = b.label;
        el.title = b.unlockScore
          ? `Se desbloquea con ${b.unlockScore.toLocaleString('es-ES')} puntos de mejor puntuación`
          : 'Tablero inicial';
        boards.appendChild(el);
      });
    }
  }

  bestScoreAll() {
    const byBoard = Object.values(this.progress.bestScoreByBoard || {}).map(n => Number(n) || 0);
    return Math.max(Number(this.progress.bestScore) || 0, 0, ...byBoard);
  }

  isBoardUnlocked(id) {
    const def = boardById(id);
    return this.bestScoreAll() >= def.unlockScore;
  }

  selectBoard(id, silent = false) {
    const def = boardById(id);
    if (!this.isBoardUnlocked(def.id)) {
      if (!silent) this.showToast(`${def.label} BLOQUEADO · ${def.unlockScore.toLocaleString('es-ES')} PUNTOS`);
      return;
    }
    this.selectedBoard = def.id;
    this.progress.boardId = def.id;
    this.writeProgress(false);
    this.renderPrep();
  }

  isCursorUnlocked(cursor) {
    if (!cursor || cursor.unlock === 'free') return true;
    if (cursor.unlock === 'shop') return (this.progress.ownedCursors || []).includes(cursor.id);
    if (cursor.unlock === 'boss2') return (this.progress.bossDefeated || []).includes(2);
    if (cursor.unlock === 'boss3') return (this.progress.bossDefeated || []).includes(3);
    if (cursor.unlock === 'boss4') return (this.progress.bossDefeated || []).includes(4);
    if (cursor.unlock === 'prestige') return (this.progress.ascension || 0) > 0;
    return false;
  }

  bindUI() {
    // Menú
    this.onClick('btn-jugar', () => { this.runState = null; this.showScreen('prep'); });
    this.onClick('btn-daily', () => this.startCycle({
      daily: true, seed: this.dailySeed(), date: this.dailyKey(), sector: 1, board: '3x3'
    }));
    this.onClick('btn-endless', () => this.startCycle({ endless: true }));
    this.onClick('btn-ascend', () => this.ascend());
    this.onClick('btn-mejoras', () => this.showScreen('upgrades'));
    this.onClick('btn-archivo', () => this.showScreen('archive'));
    this.onClick('btn-volver-archive', () => this.showScreen('menu'));
    this.onClick('btn-ajustes', () => this.showScreen('settings'));

    // Preparación
    this.onClick('btn-iniciar', () => this.startCycle({ sector: this.progress.sector || 1 }));
    this.onClick('btn-boss', () => this.startCycle({ bossMode: true, sector: this.progress.sector || 1 }));
    this.onClick('btn-volver-menu', () => this.showScreen('menu'));

    // Mejoras
    this.onClick('btn-volver-upgrades', () => this.showScreen('menu'));
    this.onClick('upgrade-unlock-chain', () => this.buyChip('chain_master', LEGACY_PRICES.chain_master));
    this.onClick('upgrade-unlock-mirror', () => this.buyChip('mirror_core', LEGACY_PRICES.mirror_core));
    this.onClick('upgrade-unlock-reflejo', () => this.buyChip('reflejo', LEGACY_PRICES.reflejo));
    this.onClick('upgrade-unlock-crio', () => this.buyChip('criogenia', LEGACY_PRICES.criogenia));
    this.onClick('upgrade-unlock-nucleo', () => this.buyChip('nucleo', LEGACY_PRICES.nucleo));
    this.onClick('upgrade-pulso', () => this.buyUpgrade('pulso', LEGACY_PRICES.pulso));
    this.onClick('upgrade-tesla', () => this.buyUpgrade('tesla', LEGACY_PRICES.tesla));

    // Listas dinámicas del catálogo ampliado
    const delegate = (id, attr, cb) => {
      const root = document.getElementById(id);
      if (!root) return;
      root.addEventListener('pointerdown', e => {
        const btn = e.target.closest(`[data-${attr}]`);
        if (!btn) return;
        e.preventDefault();
        cb(btn.dataset[attr]);
      });
    };
    delegate('upgrade-abilities', 'ability', id => this.buyAbility(id));
    delegate('upgrade-cursors', 'cursor', id => this.buyCursorSkill(id));
    delegate('upgrade-chips-extra', 'chip', id => this.buyChipExtra(id));
    delegate('prep-boards', 'board', id => this.selectBoard(id));

    // Cursores
    document.querySelectorAll('#prep-hammers .prep-chip').forEach(el => {
      el.addEventListener('pointerdown', () => this.selectHammer(el.dataset.hammer));
    });

    // Chips
    document.querySelectorAll('#prep-chips .prep-chip').forEach(el => {
      el.addEventListener('pointerdown', () => this.toggleChip(el.dataset.chip));
    });

    // Teclado: las opciones de carga son controles, no simples texto
    document.querySelectorAll('#prep-hammers .prep-chip, #prep-chips .prep-chip, #prep-boards .prep-chip').forEach(el => {
      el.setAttribute('tabindex', '0');
      if (el.dataset.hammer || el.dataset.board) el.setAttribute('role', 'radio');
      if (el.dataset.chip) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-pressed', el.classList.contains('selected') ? 'true' : 'false');
      }
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        }
      });
    });

    // Resultados
    this.onClick('btn-reintentar', () => this.startCycle({
      ...(this.lastOptions || {}), continueRun: true, run: this.runState
    }));
    this.onClick('btn-menu-results', () => this.showScreen('menu'));
    this.onClick('btn-final', () => this.showScreen('final'));
    this.onClick('btn-final-accept', () => this.chooseEnding('accept'));
    this.onClick('btn-final-reject', () => this.chooseEnding('reject'));
    this.onClick('btn-ascend-final', () => this.ascend());
    this.onClick('btn-final-menu', () => this.showScreen('menu'));
    this.onClick('btn-final-endless', () => this.startCycle({ endless: true }));
    this.onClick('btn-continuar', () => {
      // Avanzar según el jefe derrotado y conservar la run (tier de voltaje y rondas)
      const next = Math.min(5, (this.sectorCleared || this.progress.sector || 1) + 1);
      this.progress.sector = next;
      this.writeProgress(false);
      this.startCycle({
        ...(this.lastOptions || {}), sector: next,
        continueRun: true, run: this.runState
      });
    });

    // Ajustes
    this.onClick('btn-volver-settings', () => this.showScreen('menu'));
    document.getElementById('setting-audio').addEventListener('change', (e) => {
      this.audio.setEnabled(e.target.checked);
      this.setSetting('audio', e.target.checked);
    });
    document.getElementById('setting-haptic').addEventListener('change', (e) => {
      window.__hapticsEnabled = e.target.checked;
      this.setSetting('haptic', e.target.checked);
    });
    document.getElementById('setting-reduce-flash').addEventListener('change', (e) => {
      window.__reduceFlash = e.target.checked;
      this.setSetting('reduceFlash', e.target.checked);
    });
    document.getElementById('setting-colorblind').addEventListener('change', (e) => {
      window.__colorblind = e.target.checked;
      this.setSetting('colorblind', e.target.checked);
    });

    // Pausa
    this.onClick('btn-resume', () => { this.game.resume(); this.showPause(false); });
    this.onClick('btn-exit-pause', () => { this.game.startMenu(); this.showScreen('menu'); });

    // Tecla ESC para pausa
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.game.screen === 'playing') { this.game.pause(); this.showPause(true); }
        else if (this.game.screen === 'paused') { this.game.resume(); this.showPause(false); }
      }
    });
  }

  onClick(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('pointerdown', (e) => { e.preventDefault(); cb(); });
  }

  // ---------- Ciclo Diario / Ascensión / Desenlace ----------

  dailyKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  dailySeed() {
    const key = this.dailyKey();
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  dateShift(key, days) {
    const [y, m, d] = String(key).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  computeDailyStreak() {
    const runs = this.progress.dailyRuns || {};
    let cursor = this.dailyKey();
    if (!runs[cursor]) {
      cursor = this.dateShift(cursor, -1);
      if (!runs[cursor]) return 0;
    }
    let streak = 0;
    while (runs[cursor]) {
      streak++;
      cursor = this.dateShift(cursor, -1);
    }
    return streak;
  }

  recordDailyRun() {
    const g = this.game;
    if (!g.daily || !g.dailyDate) return null;
    const runs = this.progress.dailyRuns || (this.progress.dailyRuns = {});
    const run = {
      score: g.score.score,
      seed: g.dailySeedValue != null ? g.dailySeedValue : this.dailySeed(),
      loadout: { hammer: g.loadout.hammer, chips: Array.from(g.loadout.chips || []) },
      code: dailyCode(g.dailySeedValue != null ? g.dailySeedValue : this.dailySeed(), g.score.score, g.dailyDate),
      ts: Date.now()
    };
    const prev = runs[g.dailyDate];
    if (!prev || run.score >= (prev.score || 0)) runs[g.dailyDate] = run;
    const best = this.progress.dailyBest || (this.progress.dailyBest = {});
    best[g.dailyDate] = Math.max(best[g.dailyDate] || 0, g.score.score);
    this.progress.dailyStreak = this.computeDailyStreak();
    return runs[g.dailyDate];
  }

  ascend() {
    this.progress.ascension = (this.progress.ascension || 0) + 1;
    this.progress.sector = 1;
    this.progress.ending = false;
    this.progress.endingChoice = null;
    this.writeProgress(false);
    const unlockedRule = ascensionRuleNames(this.progress.ascension).pop();
    this.showToast(`ASCENSIÓN NV ${this.progress.ascension} · ${unlockedRule || 'REGLA NUEVA'} · SECTOR 1 REINICIADO`);
    this.showScreen('prep');
  }

  chooseEnding(choice) {
    this.progress.ending = true;
    this.progress.endingChoice = choice;
    this.progress.endingReward = choice === 'accept'
      ? { type: 'credit', value: 0.1, consumed: false }
      : { type: 'chip', chip: 'perfect_window', consumed: false };
    this.writeProgress(false);
    this.renderFinal();
    this.showToast(choice === 'accept'
      ? 'EL SISTEMA TE ACEPTA · +10% CRÉDITOS EN TU PRÓXIMO CICLO'
      : 'EL SISTEMA TE DEJA IR · VENTANA ×1.5 EN TU PRÓXIMO CICLO');
  }

  renderFinal() {
    const content = document.getElementById('final-content');
    if (!content) return;
    const choice = this.progress.endingChoice;
    const common = `
      <p><strong>EL SISTEMA:</strong> "Cinco sectores. Cinco núcleos. Y todavía vuelves."</p>
      <p>El Gólem calla. El Espejo ya no miente. El Prisma deja de reflejar. El Crio se derrite. La Sobrecarga se apaga.</p>`;
    if (choice === 'accept') {
      content.innerHTML = common + `
        <p><strong>ACEPTASTE EL SISTEMA:</strong> la cabina te reconoce como operador. Los núcleos vuelven a girar, ahora a tu ritmo.</p>
        <p><strong>RECOMPENSA:</strong> +10% de créditos en tu próximo ciclo.</p>
        <p><em>REGISTRO SELLADO · ASCENSIÓN DISPONIBLE</em></p>`;
    } else if (choice === 'reject') {
      content.innerHTML = common + `
        <p><strong>RECHAZASTE EL SISTEMA:</strong> apagas la cabina. Antes de cerrarla, el último núcleo guarda tu récord para quien llegue después.</p>
        <p><strong>RECOMPENSA:</strong> VENTANA ×1.5 (temporal) en tu próximo ciclo.</p>
        <p><em>REGISTRO ABIERTO · EL SISTEMA SIGUE APRENDIENDO</em></p>`;
    } else {
      content.innerHTML = common + `
        <p>La cabina espera una respuesta. Aceptar la convierte en tu herramienta; rechazarla la deja atrás.</p>
        <p><em>DECISIÓN PENDIENTE</em></p>`;
    }
    const accept = document.getElementById('btn-final-accept');
    const reject = document.getElementById('btn-final-reject');
    const ascendFinal = document.getElementById('btn-ascend-final');
    if (accept) accept.classList.toggle('hidden', !!choice);
    if (reject) reject.classList.toggle('hidden', !!choice);
    if (ascendFinal) ascendFinal.classList.toggle('hidden', !choice);
  }

  // ---------- Navegación ----------

  showScreen(name) {
    Object.values(this.screens).forEach(s => {
      if (s) { s.classList.remove('active'); s.classList.add('hidden'); }
    });
    this.pauseOverlay.classList.add('hidden');
    this.hud.classList.add('hidden');

    if (name === 'menu') {
      this.screens.menu.classList.remove('hidden');
      this.screens.menu.classList.add('active');
      this.audio.stopMusic();
      const mc = document.getElementById('menu-credits');
      if (mc) mc.textContent = this.game.credits;
      const ms = document.getElementById('menu-sector');
      const asc = this.progress.ascension || 0;
      if (ms) ms.textContent = `Cabina de Reflejos · Sector ${this.progress.sector || 1}${asc ? ` · ASCENSIÓN ${asc}` : ''}`;
      const ascendBtn = document.getElementById('btn-ascend');
      if (ascendBtn) {
        ascendBtn.classList.toggle('hidden', !(asc > 0 || this.progress.ending));
        ascendBtn.textContent = `ASCENDER${asc ? ` · NV ${asc + 1}` : ''}`;
      }
      const dailyBtn = document.getElementById('btn-daily');
      const streak = this.computeDailyStreak();
      if (dailyBtn) dailyBtn.textContent = `CICLO DIARIO${streak ? ` · RACHA ${streak}` : ''}`;
    } else if (name === 'prep') {
      this.renderPrep();
      this.screens.prep.classList.remove('hidden');
      this.screens.prep.classList.add('active');
    } else if (name === 'results') {
      this.renderResults();
      this.screens.results.classList.remove('hidden');
      this.screens.results.classList.add('active');
      this.hud.classList.add('hidden');
    } else if (name === 'archive') {
      this.renderArchive();
      this.screens.archive.classList.remove('hidden');
      this.screens.archive.classList.add('active');
    } else if (name === 'upgrades') {
      this.renderUpgrades();
      this.screens.upgrades.classList.remove('hidden');
      this.screens.upgrades.classList.add('active');
    } else if (name === 'final') {
      this.renderFinal();
      this.screens.final.classList.remove('hidden');
      this.screens.final.classList.add('active');
    } else if (name === 'settings') {
      this.screens.settings.classList.remove('hidden');
      this.screens.settings.classList.add('active');
    }
  }

  showPause(show) {
    this.pauseOverlay.classList.toggle('hidden', !show);
  }

  // ---------- Ciclo ----------

  startCycle(options = {}) {
    this.audio.init();
    this.sectorCleared = 0;
    this.progress.cycles = (this.progress.cycles || 0) + 1;
    this.writeProgress(false);
    // Cada jefe (manual o cada 5 ciclos) desbloquea su chip al caer.
    this.game.onBossDefeatedCb = (info) => {
      const sector = info && info.sector ? info.sector : 1;
      this.sectorCleared = sector;
      this.progress.bossKills = (this.progress.bossKills || 0) + 1;
      this.progress.bossDefeated = this.progress.bossDefeated || [];
      if (!this.progress.bossDefeated.includes(sector)) this.progress.bossDefeated.push(sector);
      if (sector === 1) this.unlockChip('chain_master', 'JEFE DERROTADO · RAYO MAESTRO DESBLOQUEADO');
      if (sector === 2) this.unlockChip('mirror_core', 'ESPEJO DERROTADO · CHIP ESPEJO DESBLOQUEADO');
      if (sector === 3) this.unlockChip('reflejo', 'PRISMA DERROTADO · REFLEJO DESBLOQUEADO');
      if (sector === 4) this.unlockChip('criogenia', 'CRIO DERROTADO · CRIOGENIA DESBLOQUEADA');
      if (sector === 5) {
        this.unlockChip('nucleo', 'SOBRECARGA DERROTADA · NÚCLEO DESBLOQUEADO');
        this.progress.ending = true;
      }
      this.writeProgress(false);
    };
    const board = options.daily ? '3x3' : (options.board || this.selectedBoard);
    const runOptions = { ...options, board, ascension: this.progress.ascension || 0 };
    if (options.continueRun && this.runState) {
      runOptions.continueRun = true;
      runOptions.run = this.runState;
    }
    let hammer = this.selectedHammer;
    let chips = Array.from(this.selectedChips);
    let upgrades = this.progress.upgrades || {};
    let abilities = { ...(this.progress.abilities || {}) };
    // Diario: carga fija para que la semilla sea comparable entre jugadores
    if (options.daily) {
      hammer = 'pulso';
      chips = [];
      upgrades = {};
      abilities = {};
      this.showToast('RETO DIARIO · 3×3 · PULSO / SIN CHIPS / SIN HABILIDADES / SIN JEFE');
    }
    // Consecuencia del desenlace: se consume en el siguiente ciclo
    const reward = this.progress.endingReward;
    const gameOptions = { ...runOptions };
    if (reward && !reward.consumed) {
      if (reward.type === 'credit') {
        gameOptions.creditMultiplier = 1.1;
        this.showToast('ACEPTASTE EL SISTEMA · +10% CRÉDITOS ESTE CICLO');
      } else if (reward.type === 'chip' && reward.chip) {
        if (!chips.includes(reward.chip)) chips.push(reward.chip);
        this.showToast(`RECHAZASTE EL SISTEMA · ${this.chipLabels[reward.chip] || reward.chip} TEMPORAL`);
      }
      reward.consumed = true;
      this.writeProgress(false);
    }
    this.lastOptions = { ...runOptions, creditMultiplier: 1 };
    this.game.startCycle({ hammer, chips, upgrades, abilities }, gameOptions);
    this.renderer.resize();
    this.game.setCanvasSize(this.renderer.drawW, this.renderer.drawH, this.renderer.board);
    this.hud.classList.remove('hidden');
    // Ocultar todas las pantallas de menú; el juego se dibuja en el canvas
    Object.values(this.screens).forEach(s => { if (s) { s.classList.add('hidden'); s.classList.remove('active'); } });
    this.pauseOverlay.classList.add('hidden');
  }

  // ---------- Preparación ----------

  cursorRequirement(cursor) {
    if (cursor.unlock === 'shop') return `${cursor.cost} CR en Mejoras`;
    if (cursor.unlock === 'boss2') return 'derrota al Núcleo Espejo (S2)';
    if (cursor.unlock === 'boss3') return 'derrota al Prisma Óptico (S3)';
    if (cursor.unlock === 'boss4') return 'derrota al Criogenerador (S4)';
    if (cursor.unlock === 'prestige') return 'una Ascensión o Reinicio de Núcleo';
    return 'disponible desde el inicio';
  }

  selectHammer(id, silent = false) {
    const def = CURSORS.find(c => c.id === id);
    if (def && !this.isCursorUnlocked(def)) {
      if (!silent) this.showToast(`${def.name} BLOQUEADO · ${this.cursorRequirement(def)}`);
      id = 'pulso';
    }
    this.selectedHammer = id;
    document.querySelectorAll('#prep-hammers .prep-chip').forEach(el => {
      const selected = el.dataset.hammer === id;
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-checked', selected ? 'true' : 'false');
      const c = CURSORS.find(x => x.id === el.dataset.hammer);
      const locked = c ? !this.isCursorUnlocked(c) : false;
      el.classList.toggle('locked', locked);
      el.setAttribute('aria-disabled', locked ? 'true' : 'false');
      if (c) el.setAttribute('aria-label', `${c.name}. ${c.skill}${locked ? `. ${this.cursorRequirement(c)}` : ''}`);
    });
  }

  toggleChip(id) {
    const el = document.querySelector(`#prep-chips .prep-chip[data-chip="${id}"]`);
    if (el && el.classList.contains('locked')) {
      const requirements = {
        chain_master: `Sector 1 o ${LEGACY_PRICES.chain_master} créditos`,
        mirror_core: `Sector 2 o ${LEGACY_PRICES.mirror_core} créditos`,
        reflejo: `Sector 3 o ${LEGACY_PRICES.reflejo} créditos`,
        criogenia: `Sector 4 o ${LEGACY_PRICES.criogenia} créditos`,
        nucleo: `Sector 5 o ${LEGACY_PRICES.nucleo} créditos`,
        combo_guard: `${CHIPS_EXTRA.find(c => c.id === 'combo_guard').cost} créditos en Mejoras`,
        nova_surge: `${CHIPS_EXTRA.find(c => c.id === 'nova_surge').cost} créditos en Mejoras`,
        shadow_step: `${CHIPS_EXTRA.find(c => c.id === 'shadow_step').cost} créditos en Mejoras`,
        voltage_siphon: `${CHIPS_EXTRA.find(c => c.id === 'voltage_siphon').cost} créditos en Mejoras`,
        chrono_loop: `${CHIPS_EXTRA.find(c => c.id === 'chrono_loop').cost} créditos en Mejoras`
      };
      const requirement = requirements[id] || 'derrota a su jefe o cómpralo en Mejoras';
      this.showToast(`Desbloquea ${this.chipLabels[id] || id}: ${requirement}`);
      return;
    }
    if (this.selectedChips.has(id)) {
      if (this.selectedChips.size > 1) this.selectedChips.delete(id);
    } else {
      const slots = 2 + (this.progress.abilities?.ab_cache || 0);
      if (this.selectedChips.size >= slots) {
        this.showToast(`Máximo ${slots} chips por ciclo · mejora Caché de Chips`);
        return;
      }
      this.selectedChips.add(id);
    }
    document.querySelectorAll('#prep-chips .prep-chip').forEach(el => {
      const selected = this.selectedChips.has(el.dataset.chip);
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  showToast(msg) {
    const app = document.getElementById('app');
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.className = 'sr-only';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      app.appendChild(region);
    }
    region.textContent = msg;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    app.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  renderPrep() {
    if (!this.isBoardUnlocked(this.selectedBoard)) this.selectedBoard = '3x3';
    document.querySelectorAll('#prep-boards .prep-chip').forEach(el => {
      const unlocked = this.isBoardUnlocked(el.dataset.board);
      const selected = el.dataset.board === this.selectedBoard;
      el.classList.toggle('locked', !unlocked);
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-checked', selected ? 'true' : 'false');
      el.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const def = boardById(el.dataset.board);
      el.textContent = unlocked ? def.label : `🔒 ${def.label}`;
    });
    const sector = this.progress.sector || 1;
    const asc = this.progress.ascension || 0;
    document.getElementById('prep-sector').textContent = `SECTOR ${sector}${asc ? ` · ASCENSIÓN ${asc}` : ''}`;
    const rulesEl = document.getElementById('prep-rules');
    if (rulesEl) {
      const rules = ascensionRuleNames(asc);
      rulesEl.textContent = rules.length ? `REGLAS ACTIVAS: ${rules.join(' · ')}` : '';
      rulesEl.classList.toggle('hidden', rules.length === 0);
    }
    const slots = 2 + (this.progress.abilities?.ab_cache || 0);
    const label = document.getElementById('prep-chip-label');
    if (label) label.textContent = `CHIPS (${slots})`;
    this.refreshChipLocks();
    this.selectHammer(this.selectedHammer, true);
    document.querySelectorAll('#prep-chips .prep-chip').forEach(el => {
      el.classList.toggle('selected', this.selectedChips.has(el.dataset.chip));
    });
  }

  refreshChipLocks() {
    const unlocked = this.progress.unlocked || [];
    const baseChips = ['volc_bomb', 'chrono_x3', 'perfect_window'];
    Object.entries(this.chipLabels).forEach(([id, label]) => {
      const el = document.querySelector(`#prep-chips .prep-chip[data-chip="${id}"]`);
      if (!el) return;
      const isUnlocked = baseChips.includes(id) || unlocked.includes(id);
      el.classList.toggle('locked', !isUnlocked);
      el.setAttribute('aria-disabled', isUnlocked ? 'false' : 'true');
      el.textContent = isUnlocked ? label : `🔒 ${label}`;
    });
  }

  // ---------- Mejoras ----------

  renderUpgrades() {
    const credits = this.game.credits;
    const up = this.progress.upgrades || {};
    const unlocked = this.progress.unlocked || [];

    document.getElementById('upgrade-credits').textContent = credits;

    const chainBtn = document.getElementById('upgrade-unlock-chain');
    const hasChain = unlocked.includes('chain_master');
    chainBtn.textContent = hasChain ? 'DESBLOQUEADO' : String(LEGACY_PRICES.chain_master);
    chainBtn.disabled = hasChain || credits < LEGACY_PRICES.chain_master;

    const mirrorBtn = document.getElementById('upgrade-unlock-mirror');
    const hasMirror = unlocked.includes('mirror_core');
    if (mirrorBtn) {
      mirrorBtn.textContent = hasMirror ? 'DESBLOQUEADO' : String(LEGACY_PRICES.mirror_core);
      mirrorBtn.disabled = hasMirror || credits < LEGACY_PRICES.mirror_core;
    }

    const reflejoBtn = document.getElementById('upgrade-unlock-reflejo');
    const hasReflejo = unlocked.includes('reflejo');
    if (reflejoBtn) {
      reflejoBtn.textContent = hasReflejo ? 'DESBLOQUEADO' : String(LEGACY_PRICES.reflejo);
      reflejoBtn.disabled = hasReflejo || credits < LEGACY_PRICES.reflejo;
    }

    const chipButtons = [
      ['upgrade-unlock-crio', 'criogenia', LEGACY_PRICES.criogenia],
      ['upgrade-unlock-nucleo', 'nucleo', LEGACY_PRICES.nucleo]
    ];
    chipButtons.forEach(([id, chip, cost]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const owned = unlocked.includes(chip);
      btn.textContent = owned ? 'DESBLOQUEADO' : String(cost);
      btn.disabled = owned || credits < cost;
    });

    const pulsoLvl = up.pulso || 0;
    const pulsoCost = LEGACY_PRICES.pulso * (pulsoLvl + 1);
    const pulsoBtn = document.getElementById('upgrade-pulso');
    pulsoBtn.textContent = `NV ${pulsoLvl} · ${pulsoCost}`;
    pulsoBtn.disabled = credits < pulsoCost;

    const teslaLvl = up.tesla || 0;
    const teslaCost = LEGACY_PRICES.tesla * (teslaLvl + 1);
    const teslaBtn = document.getElementById('upgrade-tesla');
    teslaBtn.textContent = `NV ${teslaLvl} · ${teslaCost}`;
    teslaBtn.disabled = credits < teslaCost;
    this.renderCatalogUpgrades(credits);
  }

  // ---------- Catálogo ampliado: 20 habilidades, 10 cursores, 5 chips ----------

  addUpgradeRow(root, text, btnText, attrs, disabled) {
    if (!root) return;
    const row = document.createElement('div');
    row.className = 'upgrade-row';
    const span = document.createElement('span');
    span.textContent = text;
    span.title = text;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.textContent = btnText;
    btn.disabled = !!disabled;
    Object.entries(attrs).forEach(([k, v]) => btn.setAttribute(k, v));
    row.append(span, btn);
    root.appendChild(row);
  }

  renderCatalogUpgrades(credits) {
    const abilities = this.progress.abilities || {};
    const abRoot = document.getElementById('upgrade-abilities');
    if (abRoot) {
      abRoot.innerHTML = '';
      ABILITIES.forEach(def => {
        const lvl = abilities[def.id] || 0;
        const cost = abilityCost(def, lvl);
        this.addUpgradeRow(abRoot, `${def.name} · ${def.desc}`,
          lvl >= def.max ? 'MAX' : `NV ${lvl} · ${cost}`,
          { 'data-ability': def.id }, lvl >= def.max || credits < cost);
      });
    }

    const curRoot = document.getElementById('upgrade-cursors');
    if (curRoot) {
      curRoot.innerHTML = '';
      CURSORS.forEach(c => {
        const owned = this.isCursorUnlocked(c);
        const active = this.selectedHammer === c.id;
        const cost = c.unlock === 'shop' ? c.cost : 0;
        const label = owned ? (active ? 'ACTIVO' : 'EQUIPAR')
          : c.unlock === 'shop' ? String(cost)
            : c.unlock === 'free' ? 'INICIAL' : this.cursorRequirement(c).slice(0, 22).toUpperCase();
        this.addUpgradeRow(curRoot, `${c.name} · ${c.skill}`, label,
          { 'data-cursor': c.id }, active || (!owned && (c.unlock !== 'shop' || credits < cost)));
      });
    }

    const chipRoot = document.getElementById('upgrade-chips-extra');
    if (chipRoot) {
      chipRoot.innerHTML = '';
      const unlocked = this.progress.unlocked || [];
      CHIPS_EXTRA.forEach(chip => {
        const owned = unlocked.includes(chip.id);
        this.addUpgradeRow(chipRoot, `${chip.label} · ${chip.desc}`,
          owned ? 'DESBLOQUEADO' : String(chip.cost),
          { 'data-chip': chip.id }, owned || credits < chip.cost);
      });
    }
  }

  buyAbility(id) {
    const def = ABILITIES.find(a => a.id === id);
    if (!def) return;
    const abilities = this.progress.abilities || (this.progress.abilities = {});
    const lvl = abilities[id] || 0;
    if (lvl >= def.max) { this.showToast('Habilidad al nivel máximo'); return; }
    const cost = abilityCost(def, lvl);
    if (this.game.credits < cost) { this.showToast('Créditos insuficientes'); return; }
    this.game.credits -= cost;
    abilities[id] = lvl + 1;
    this.writeProgress(false);
    this.renderUpgrades();
    this.showToast(`${def.name.toUpperCase()} · NV ${lvl + 1}`);
  }

  buyCursorSkill(id) {
    const cursor = CURSORS.find(c => c.id === id);
    if (!cursor) return;
    const owned = this.progress.ownedCursors || (this.progress.ownedCursors = ['pulso']);
    if (owned.includes(id)) {
      this.selectHammer(id);
      this.renderUpgrades();
      return;
    }
    if (cursor.unlock !== 'shop') {
      this.showToast(`${cursor.name} BLOQUEADO · ${this.cursorRequirement(cursor)}`);
      return;
    }
    if (this.game.credits < cursor.cost) { this.showToast('Créditos insuficientes'); return; }
    this.game.credits -= cursor.cost;
    owned.push(id);
    this.selectHammer(id);
    this.writeProgress(false);
    this.renderUpgrades();
    this.showToast(`${cursor.name} ADQUIRIDO · ${cursor.skill}`);
  }

  buyChipExtra(id) {
    const chip = CHIPS_EXTRA.find(c => c.id === id);
    if (chip) this.buyChip(id, chip.cost);
  }

  buyUpgrade(key, baseCost) {
    const up = this.progress.upgrades || (this.progress.upgrades = {});
    const lvl = up[key] || 0;
    const cost = baseCost * (lvl + 1);
    if (this.game.credits < cost) { this.showToast('Créditos insuficientes'); return; }
    this.game.credits -= cost;
    up[key] = lvl + 1;
    this.writeProgress(false);
    this.renderUpgrades();
    this.showToast(`${key.toUpperCase()} MEJORADO · NV ${lvl + 1}`);
  }

  buyChip(id, cost) {
    if ((this.progress.unlocked || []).includes(id)) {
      this.showToast('Ya está desbloqueado');
      return;
    }
    if (this.game.credits < cost) { this.showToast('Créditos insuficientes'); return; }
    this.game.credits -= cost;
    this.unlockChip(id, `${this.chipLabels[id] || id} DESBLOQUEADO`);
    this.renderUpgrades();
  }

  unlockChip(id, message) {
    this.progress.unlocked = this.progress.unlocked || [];
    if (!this.progress.unlocked.includes(id)) this.progress.unlocked.push(id);
    this.writeProgress(false);
    this.refreshChipLocks();
    if (message) this.showToast(message);
  }

  // ---------- Resultados ----------

  renderResults() {
    if (this.game.endless && this.game.endlessRounds > (this.progress.endlessBest || 0)) {
      this.progress.endlessBest = this.game.endlessRounds;
    }
    if (this.game.fakeEndings > 0) {
      this.progress.fakeEndings = (this.progress.fakeEndings || 0) + this.game.fakeEndings;
    }
    if (this.game.run && this.game.run.bossesKilled > (this.progress.bossKills || 0)) {
      this.progress.bossKills = this.game.run.bossesKilled;
    }
    const dailyRun = this.recordDailyRun();
    const prevBest = this.progress.bestScore || 0;
    const isRecord = this.game.score.score > prevBest;
    this.saveProgress();
    document.getElementById('res-record').style.display = isRecord ? 'block' : 'none';
    document.getElementById('res-score').textContent = this.game.score.score;
    document.getElementById('res-combo').textContent = this.game.score.maxCombo;
    document.getElementById('res-perfect').textContent = this.game.score.perfects;
    document.getElementById('res-credits').textContent = this.game.credits;

    const up = this.progress.upgrades || {};
    // Usar la carga real del ciclo: en Diario o desenlace puede diferir de la selección de UI.
    const chips = Array.from(this.game.loadout.chips || []).join(', ') || 'SIN CHIPS';
    const cursorName = (CURSORS.find(c => c.id === this.game.loadout.hammer) || {}).name || 'PULSO';
    const abilityCount = Object.values(this.game.abilities || {}).filter(l => l > 0).length;
    const build = `PULSO NV ${up.pulso || 0} · TESLA NV ${up.tesla || 0} · ${cursorName} · ${abilityCount} HAB · ${chips}`;
    const endlessTag = this.game.endless
      ? ` · ∞ ${this.game.endlessRounds} RONDAS · ${this.game.endlessMistakes} FALLOS`
      : '';
    const dailyTag = dailyRun
      ? ` · DIARIO ${this.game.dailyDate} · RACHA ${this.progress.dailyStreak || 0} · ${dailyRun.code}`
      : '';
    const ascTag = this.game.ascension
      ? ` · ASCENSIÓN ${this.game.ascension}${ascensionRuleNames(this.game.ascension).length
          ? ` [${ascensionRuleNames(this.game.ascension).join(' + ')}]` : ''}`
      : '';
    const runTag = this.game.run
      ? ` · RUN ${this.game.run.cyclesDone}/${BALANCE.run.maxCycles} · V×${this.game.voltageTier}` +
        (this.game.run.bossesKilled ? ` · ${this.game.run.bossesKilled} JEFES` : '')
      : '';
    document.getElementById('res-meta').textContent =
      `SECTOR ${this.game.sector} · ${this.game.boardId.toUpperCase()} · ${build}` + endlessTag +
      dailyTag + ascTag + runTag +
      (this.sectorCleared ? ` · JEFE ${this.sectorCleared} VENCIDO` : '') +
      (this.game.creditsGained ? ` · +${this.game.creditsGained} CR` : '') +
      (this.game.runComplete ? ' · RUN COMPLETADA' : '');

    const continuar = document.getElementById('btn-continuar');
    if (continuar) {
      const canAdvance = this.sectorCleared > 0 && this.sectorCleared < 5;
      continuar.style.display = canAdvance ? 'inline-block' : 'none';
      continuar.textContent = canAdvance ? `CONTINUAR A SECTOR ${this.sectorCleared + 1}` : 'CAMPAÑA COMPLETA';
    }
    const finalBtn = document.getElementById('btn-final');
    if (finalBtn) finalBtn.style.display = this.sectorCleared === 5 ? 'inline-block' : 'none';

    this.renderRunCard();
  }

  /** Tarjeta de resultados con todos los datos disponibles de la run. */
  renderRunCard() {
    const card = document.getElementById('res-run-card');
    if (!card) return;
    const r = this.game.getRunReport ? this.game.getRunReport() : {};
    const n = value => Number(value || 0).toLocaleString('es-ES');
    const secs = value => `${Math.round(value || 0)} s`;
    const dailyCode = this.game.dailyDate
      ? (this.progress.dailyRuns?.[this.game.dailyDate]?.code || '—') : null;
    const mode = r.daily
      ? `DIARIO${r.dailyDate ? ` · ${r.dailyDate}` : ''}${dailyCode ? ` · ${dailyCode}` : ''}${r.dailySeed != null ? ` · SEMILLA ${r.dailySeed}` : ''}`
      : r.endless
        ? `INFINITO · ${n(r.endlessRounds)} RONDAS / ${n(r.endlessMistakes)} FALLOS`
        : 'CAMPAÑA';
    const up = this.progress.upgrades || {};
    const chips = Array.from(this.game.loadout?.chips || []).join(' · ') || 'NINGUNO';
    const cursorName = (CURSORS.find(c => c.id === this.game.loadout?.hammer) || {}).name || 'PULSO';
    const abilityCount = Object.values(this.game.abilities || {}).filter(level => level > 0).length;
    const attempts = (r.hits || 0) + (r.misses || 0);
    const accuracy = attempts ? Math.round((r.hits / attempts) * 100) : 0;
    const perfectRate = r.hits ? Math.round((r.perfects / r.hits) * 100) : 0;
    const rate = r.runSeconds ? Math.round((r.runScore || 0) / r.runSeconds) : 0;

    const groups = [
      ['RUN', [
        ['Modo', mode],
        ['Ciclos', `${n(r.cyclesDone)} / ${n(r.maxCycles)}`],
        ['Puntos del ciclo', n(r.score)],
        ['Puntos de la run', n(r.runScore)],
        ['Tiempo del ciclo', secs(r.cycleSeconds)],
        ['Tiempo de la run', secs(r.runSeconds)],
        ['Puntos / segundo', n(rate)],
        ['Tablero', `${String(r.board || '3x3').toUpperCase()} · ${r.boardSize || '3×3'}`],
        ['Sector', n(r.sector)],
        ['Tier de voltaje', `×${n(r.tier)}`],
        ['Voltaje final', n(r.voltage)],
        ['Run completada', r.runComplete ? 'SÍ' : 'NO']
      ]],
      ['COMBATE', [
        ['Golpes', n(r.hits)],
        ['Perfectos', `${n(r.perfects)} (${perfectRate} %)`],
        ['Fallos', n(r.misses)],
        ['Precisión', `${accuracy} %`],
        ['Combo final / máx.', `${n(r.combo)} / ${n(r.maxCombo)}`],
        ['Multiplicador', `×${n(r.multiplier)}`],
        ['Último hito', n(r.lastMilestone)],
        ['Bombas tocadas', n(r.bombs)],
        ['Jefes eliminados', n(r.bossesKilled)],
        ['Falsos Finales', n(r.fakeEndings)]
      ]],
      ['NOVA', [
        ['Detonaciones', n(r.novaDetonations)],
        ['Núcleos eliminados', n(r.novaCoresCleared)],
        ['Puntos obtenidos', n(r.novaPoints)]
      ]],
      ['ROJOS Y CLÚSTERES', [
        ['Rojos tocados', n(r.redTapped)],
        ['Rojos purgados', n(r.redPurged)],
        ['Rojos escapados', n(r.redEscaped)],
        ['Clústers completados', n(r.clustersCleared)]
      ]],
      ['ECONOMÍA', [
        ['Créditos ganados', n(r.creditsGained)],
        ['Créditos totales', n(r.creditsTotal)],
        ['Ascensión', `NV ${n(r.ascension)}`]
      ]],
      ['CARGA', [
        ['Pulso NV', n(up.pulso || 0)],
        ['Tesla NV', n(up.tesla || 0)],
        ['Cursor', cursorName],
        ['Habilidades', n(abilityCount)],
        ['Chips', chips]
      ]]
    ];

    card.innerHTML = '<div class="run-card-title">INFORME COMPLETO DE LA RUN</div>' +
      groups.map(([title, rows]) => `
        <section class="run-group">
          <div class="run-group-title">${title}</div>
          <div class="run-grid">${rows.map(([key, value]) =>
            `<div class="run-row"><span class="run-key">${key}</span><span class="run-val">${value}</span></div>`
          ).join('')}</div>
        </section>`).join('') +
      '<div class="run-note">Los contadores son acumulativos durante toda la run.</div>';
  }

  renderArchive() {
    const content = document.getElementById('archive-content');
    const p = this.progress;
    const bosses = (p.bossDefeated || []).slice().sort().join(', ') || 'NINGUNO';
    const chips = (p.unlocked || []).map(c => this.chipLabels[c] || c).join(' · ') || 'NINGUNO';
    const ups = p.upgrades || {};
    const upgrades = `PULSO NV ${ups.pulso || 0} · TESLA NV ${ups.tesla || 0}`;
    const ending = !p.ending ? 'PENDIENTE'
      : p.endingChoice === 'accept' ? 'SELLADO · SISTEMA ACEPTADO'
      : p.endingChoice === 'reject' ? 'ABIERTO · SISTEMA RECHAZADO'
      : 'SELLADO · SIN DECISIÓN';
    const runs = Object.entries(p.dailyRuns || {}).sort();
    const dailyEntries = runs.slice(-3);
    const daily = dailyEntries.length
      ? dailyEntries.map(([date, run]) =>
          `${date}: ${run.score || 0} pts · ${run.code || '—'}`).join(' · ')
      : 'NINGUNO';
    const dailyStreak = Number(p.dailyStreak) || 0;
    if (p.cycles > 0 || this.game.credits > 0 || (p.bossDefeated || []).length) {
      content.innerHTML = `
        <p><strong>Ciclos jugados:</strong> ${p.cycles || 0}</p>
        <p><strong>Último ciclo:</strong> ${this.game.score.score} pts · combo máx ${this.game.score.maxCombo} · perfectos ${this.game.score.perfects}</p>
        <p><strong>Sector alcanzado:</strong> ${p.sector || 1} · <strong>Ascensión:</strong> ${p.ascension || 0}</p>
        <p><strong>Jefes vencidos:</strong> ${bosses} · total ${p.bossKills || 0}</p>
        <p><strong>Tablero actual:</strong> ${boardById(this.selectedBoard).label} · mejor por tablero: ${
          BOARDS.map(b => `${b.label} ${(p.bestScoreByBoard || {})[b.id] || 0}`).join(' · ')}</p>
        <p><strong>Falsos Finales:</strong> ${p.fakeEndings || 0}</p>
        <p><strong>Desenlace:</strong> ${ending}</p>
        <p><strong>Chips desbloqueados:</strong> ${chips}</p>
        <p><strong>Mejoras:</strong> ${upgrades}</p>
        <p><strong>Récord infinito:</strong> ${p.endlessBest || 0} rondas</p>
        <p><strong>Ciclo diario:</strong> ${daily}</p>
        <p><strong>Racha diaria:</strong> ${dailyStreak} día${dailyStreak === 1 ? '' : 's'}</p>
        <p><strong>Créditos acumulados:</strong> ${this.game.credits}</p>
        <p><em>EL SISTEMA: "No fue un fallo, fue una decisión creativa."</em></p>
      `;
    } else {
      content.innerHTML = '<p>No hay registros aún. Juega un ciclo para generar logs.</p>';
    }
  }

  // ---------- HUD ----------

  updateHUD(dt) {
    if (this.game.screen !== 'playing') return;

    const cycle = (this.game.run?.cyclesDone || 0) + 1;
    const timer = document.getElementById('hud-time');
    timer.textContent = `V×${this.game.voltageTier} · C${cycle}/${BALANCE.run.maxCycles}`;
    timer.setAttribute('aria-label', `Nivel de voltaje ${this.game.voltageTier}, ciclo ${cycle} de ${BALANCE.run.maxCycles}`);
    document.getElementById('hud-score').textContent = this.game.score.score.toString();
    const milestone = nextComboMilestone(this.game.score.combo);
    document.getElementById('hud-combo').textContent =
      `COMBO ${this.game.score.combo} · ×${comboMultiplier(this.game.score.combo)}` +
      (milestone ? ` → ${milestone}` : '');

    const bar = document.getElementById('voltage-bar');
    const glow = document.getElementById('voltage-glow');
    bar.style.width = `${Math.max(0, Math.min(100, this.game.voltage))}%`;
    const nightmare = !!this.game.nightmare;
    bar.classList.toggle('overdrive', nightmare);
    glow.classList.toggle('active', nightmare || this.game.voltageFrozen > 0);
    bar.classList.toggle('voltage-high', this.game.voltage >= 80);
    bar.classList.toggle('voltage-frozen', this.game.voltageFrozen > 0);

    const chipNames = {
      volc_bomb: 'BOMBAS→VOLTAJE',
      chrono_x3: 'CRONO×3',
      perfect_window: 'VENTANA×1.5',
      chain_master: 'RAYO MAESTRO',
      mirror_core: 'ESPEJO',
      reflejo: 'REFLEJO',
      criogenia: 'CRIOGENIA(h≤1s)',
      nucleo: 'NÚCLEO(+20%)'
    };
    const endlessTag = this.game.endless ? ` · ∞ R${this.game.endlessRounds}` : '';
    const ruleShorts = ASCENSION_RULES.slice(1, Math.min(this.game.ascension || 0, ASCENSION_RULES.length - 1) + 1)
      .filter(Boolean).map(r => r.short);
    const modeTag = this.game.daily
      ? ` · DIARIO R${this.progress.dailyStreak || 0}`
      : (this.game.ascension ? ` · A${this.game.ascension}${ruleShorts.length ? `[${ruleShorts.join('/')}]` : ''}` : '');
    const chipsLabel = Array.from(this.game.loadout.chips || []).map(c => chipNames[c] || c).join(' · ') || 'SIN CHIPS';
    const bossTag = this.game.boss ? ` · ${this.game.boss.name}` : '';
    const freezeTag = this.game.voltageFrozen > 0 ? ` · PESADILLA ${this.game.voltageFrozen.toFixed(1)}s` : '';
    document.getElementById('hud-loadout').textContent =
      `S${this.game.sector} · ${this.game.boardId.toUpperCase()} · ${(this.game.loadout.hammer || 'pulso').toUpperCase()} · ${chipsLabel}${bossTag}${endlessTag}${modeTag}${freezeTag}`;
  }
}
