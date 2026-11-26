import { dailyCode, ascensionRuleNames, ASCENSION_RULES } from './game.js';
import { dailyKey as todayKey } from './leaderboard.js';
import { ABILITIES, abilityCost, CHIPS_EXTRA, CURSORS } from './content.js';
import { BALANCE, BOARDS, boardById, comboMultiplier, nextComboMilestone } from './balance.js';

// Precios heredados escalados ×10 con el resto de la tienda.
const LEGACY_PRICES = {
  chain_master: 3000, mirror_core: 5000, reflejo: 7000,
  criogenia: 9000, nucleo: 11000, pulso: 1000, tesla: 1000
};

export class UI {
  constructor({ game, audio, input, renderer, accounts, leaderboard }) {
    this.game = game;
    this.audio = audio;
    this.input = input;
    this.renderer = renderer;
    this.accounts = accounts;
    this.leaderboard = leaderboard;

    this.screens = {
      launcher: document.getElementById('screen-launcher'),
      menu: document.getElementById('screen-menu'),
      prep: document.getElementById('screen-prep'),
      playing: null, // no hay pantalla de juego, es el canvas
      results: document.getElementById('screen-results'),
      settings: document.getElementById('screen-settings'),
      archive: document.getElementById('screen-archive'),
      upgrades: document.getElementById('screen-upgrades'),
      final: document.getElementById('screen-final'),
      leaderboard: document.getElementById('screen-leaderboard')
    };

    this.hud = document.getElementById('hud');
    this.pauseOverlay = document.getElementById('overlay-pause');
    this.hudNodes = {
      score: document.getElementById('hud-score'),
      combo: document.getElementById('hud-combo'),
      comboNext: document.getElementById('hud-combo-next'),
      tier: document.getElementById('hud-tier'),
      cycle: document.getElementById('hud-cycle'),
      voltage: document.getElementById('hud-voltage-value'),
      bar: document.getElementById('voltage-bar'),
      glow: document.getElementById('voltage-glow'),
      demote: document.getElementById('voltage-demote'),
      tiers: [...document.querySelectorAll('#voltage-tiers .voltage-tier')],
      mode: document.getElementById('hud-mode'),
      sector: document.getElementById('hud-sector'),
      cursor: document.getElementById('hud-cursor'),
      boss: document.getElementById('hud-boss'),
      freeze: document.getElementById('hud-freeze'),
      rules: document.getElementById('hud-rules')
    };

    this.selectedHammer = 'pulso';
    this.selectedChips = new Set(['volc_bomb']);
    this.currentAccount = null;
    this.selectedBoard = '3x3';
    this.runState = null; // continuidad de voltaje/ronda dentro de una run
    this.lastOptions = null;
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

    // Cargar progreso persistente. Si ya hay una cuenta activa, se usa su save.
    this.progress = this.defaultProgress();
    if (this.accounts?.canPlay()) {
      this.applyAccount(this.accounts.current, this.accounts.currentSave);
    } else {
      this.game.credits = this.progress.credits || 0;
      this.applySettings();
    }

    this.buildPrepOptions();
    this.bindUI();
    this.showScreen(this.accounts?.canPlay() ? 'menu' : 'launcher');
  }

  defaultProgress() {
    return {
      credits: 0, bestScore: 0, bestCombo: 0, sector: 1,
      upgrades: {}, unlocked: [], bossDefeated: [],
      cycles: 0, ending: false,
      ascension: 0, endingChoice: null,
      dailyBest: {}, dailyRuns: {}, dailyStreak: 0, endingReward: null,
      abilities: {}, ownedCursors: ['pulso'],
      boardId: '3x3', bestScoreByBoard: {}, fakeEndings: 0, bossKills: 0
    };
  }

  loadProgress() {
    const data = this.sanitizeProgress(this.readLegacyProgress());
    return data;
  }

  readLegacyProgress() {
    try {
      const legacy = localStorage.getItem('overclock9_progress');
      if (legacy) return JSON.parse(legacy);
    } catch (e) { /* localStorage no disponible */ }
    return null;
  }

  sanitizeProgress(input) {
    const data = { ...this.defaultProgress(), ...(input || {}) };
    data.upgrades = data.upgrades || {};
    data.unlocked = Array.isArray(data.unlocked) ? data.unlocked : [];
    data.bossDefeated = Array.isArray(data.bossDefeated) ? data.bossDefeated : [];
    data.cycles = Number(data.cycles) || 0;
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
    const data = this.sanitizeProgress({
      ...this.progress,
      credits: this.game.credits
    });
    if (includeScore) {
      data.bestScore = Math.max(data.bestScore || 0, this.game.score.score);
      data.bestCombo = Math.max(data.bestCombo || 0, this.game.score.maxCombo);
      const board = this.game.boardId || '3x3';
      data.bestScoreByBoard = data.bestScoreByBoard || {};
      data.bestScoreByBoard[board] = Math.max(data.bestScoreByBoard[board] || 0, this.game.score.score);
    }
    this.progress = data;
    // Caché de la última sesión; el archivo por usuario se escribe en persist().
    try { localStorage.setItem('overclock9_progress_cache', JSON.stringify(data)); } catch (e) { /* noop */ }
    this.persist();
  }

  /** Guarda progreso + partida en marcha en el archivo del usuario activo. */
  persist() {
    if (!this.accounts?.current) return Promise.resolve(false);
    return this.accounts.saveCurrent({
      progress: this.progress,
      runState: this.runState,
      lastOptions: this.lastOptions,
      sectorCleared: this.sectorCleared
    }).catch(err => {
      this.showToast(`NO SE PUDO GUARDAR: ${err.message}`);
      return false;
    });
  }

  applyAccount(account, save) {
    this.currentAccount = account;
    const source = save?.progress || (this.accounts?.manifest?.accounts.length === 1
      ? this.readLegacyProgress() : null);
    this.progress = this.sanitizeProgress(source);
    this.game.credits = this.progress.credits || 0;
    this.runState = save?.runState || null;
    this.lastOptions = save?.lastOptions || null;
    this.sectorCleared = Number(save?.sectorCleared) || 0;
    this.selectedBoard = this.progress.boardId || '3x3';
    this.selectedHammer = 'pulso';
    this.selectedChips = new Set(['volc_bomb']);
    this.applySettings();
    this.refreshMenuIdentity();
    this.persist();
  }

  async handleAuth(mode, event) {
    event.preventDefault();
    const prefix = mode === 'register' ? 'register' : 'login';
    const nickname = document.getElementById(`${prefix}-nickname`)?.value || '';
    const password = document.getElementById(`${prefix}-password`)?.value || '';
    this.setLauncherError('');
    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const result = mode === 'register'
        ? await this.accounts.register(nickname, password)
        : await this.accounts.login(nickname, password);
      this.applyAccount(result.account, result.save);
      this.showScreen('menu');
      this.showToast(mode === 'register'
        ? `CUENTA CREADA · BIENVENIDA, ${result.account.nickname.toUpperCase()}`
        : `BIENVENIDA, ${result.account.nickname.toUpperCase()}`);
    } catch (err) {
      this.setLauncherError(err?.message || 'No se pudo abrir la cuenta.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async linkFolder() {
    this.setLauncherError('');
    const result = await this.accounts.connectFolder();
    if (!result.ok) { this.setLauncherError(result.error); return; }
    this.refreshLauncher();
    if (this.accounts.canPlay()) {
      this.applyAccount(this.accounts.current, this.accounts.currentSave);
      this.showScreen('menu');
    }
  }

  async grantFolder() {
    this.setLauncherError('');
    const result = await this.accounts.grantFolder();
    if (!result.ok) { this.setLauncherError(result.error); return; }
    this.refreshLauncher();
    if (this.accounts.canPlay()) {
      this.applyAccount(this.accounts.current, this.accounts.currentSave);
      this.showScreen('menu');
    }
  }

  async logoutToLauncher() {
    await this.persist();
    await this.accounts.logout();
    this.currentAccount = null;
    this.runState = null;
    this.lastOptions = null;
    this.sectorCleared = 0;
    this.showScreen('launcher');
  }

  /** Instantánea de la partida actual, lista para escribirse en el datasave. */
  captureRunState() {
    if (!this.game?.run) return null;
    const snapshot = this.game.getResumeState
      ? this.game.getResumeState()
      : { version: 1, run: JSON.parse(JSON.stringify(this.game.run)) };
    snapshot.options = { ...(this.lastOptions || {}), ...(snapshot.options || {}) };
    snapshot.sectorCleared = this.sectorCleared;
    this.runState = snapshot;
    return snapshot;
  }

  /** Pausa y guarda antes de mostrar el overlay: salir en pausa nunca pierde el ciclo. */
  async pauseAndSave() {
    if (this.game.screen !== 'playing' && this.game.screen !== 'paused') return false;
    this.game.pause();
    this.captureRunState();
    this.showPause(true, 'GUARDANDO…');
    const ok = await this.persist();
    this.showPause(true, ok ? 'PARTIDA GUARDADA' : 'NO SE PUDO GUARDAR');
    return ok;
  }

  resumeSavedRun() {
    const snap = this.runState;
    if (!snap) return;
    if (snap.version !== 1) {
      this.startCycle({ ...(this.lastOptions || {}), continueRun: true, run: snap });
      return;
    }
    const options = {
      ...(this.lastOptions || {}),
      ...(snap.options || {}),
      continueRun: true,
      run: snap.run,
      resumeState: snap
    };
    this.startCycle(options, snap.loadout || null);
  }

  setLauncherError(message) {
    const el = document.getElementById('launcher-error');
    if (el) el.textContent = message || '';
  }

  setAuthMode(mode) {
    const isRegister = mode === 'register';
    document.getElementById('form-login')?.classList.toggle('hidden', isRegister);
    document.getElementById('form-register')?.classList.toggle('hidden', !isRegister);
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    loginTab?.classList.toggle('selected', !isRegister);
    registerTab?.classList.toggle('selected', isRegister);
    loginTab?.setAttribute('aria-selected', String(!isRegister));
    registerTab?.setAttribute('aria-selected', String(isRegister));
    this.setLauncherError('');
  }

  selectProfile(id) {
    const account = this.accounts?.manifest?.accounts.find(a => a.id === id);
    if (!account) return;
    const input = document.getElementById('login-nickname');
    if (input) input.value = account.nickname;
    this.setAuthMode('login');
    document.getElementById('login-password')?.focus();
  }

  refreshLauncher() {
    const list = document.getElementById('launcher-profiles');
    const empty = document.getElementById('launcher-empty');
    const accounts = this.accounts?.manifest?.accounts || [];
    if (list) {
      list.innerHTML = '';
      accounts.forEach(account => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profile-card';
        btn.dataset.account = account.id;
        btn.setAttribute('aria-label', `Perfil ${account.nickname}`);
        const initials = account.nickname.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
        const meta = account.lastPlayed
          ? new Date(account.lastPlayed).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
          : 'NUEVO';
        btn.innerHTML = `
          <span class="avatar" style="background:${account.color};box-shadow:0 0 16px ${account.color}66">${initials}</span>
          <span class="profile-name">${this.escapeHtml(account.nickname)}</span>
          <span class="profile-meta">${meta}</span>`;
        list.appendChild(btn);
      });
    }
    if (empty) empty.classList.toggle('hidden', accounts.length > 0);
    const storage = document.getElementById('launcher-storage');
    if (storage) storage.textContent = this.accounts?.storageLabel() || 'DATASAVE · NAVEGADOR';
    const linkFolder = document.getElementById('btn-link-folder');
    if (linkFolder) linkFolder.classList.toggle('hidden', !this.accounts?.supportsFs || !!this.accounts?.directory);
    const grant = document.getElementById('btn-folder-access');
    if (grant) grant.classList.toggle('hidden', !this.accounts?.needsPermission);
    const folderName = document.getElementById('folder-name');
    if (folderName) {
      folderName.textContent = this.accounts?.mode === 'fs' ? `Carpeta: ${this.accounts.directory?.name || 'datasave'}` : '';
      folderName.classList.toggle('hidden', this.accounts?.mode !== 'fs');
    }
  }

  refreshMenuIdentity() {
    const user = document.getElementById('menu-user');
    if (user) user.textContent = this.currentAccount?.nickname || '—';
    const resume = document.getElementById('btn-resume-save');
    if (resume) {
      resume.classList.toggle('hidden', !this.runState);
      if (this.runState) {
        const done = Number(this.runState.run?.cyclesDone ?? this.runState.cyclesDone) || 0;
        resume.textContent = `CONTINUAR · C${Math.min(999, done + 1)}`;
      }
    }
    const campaign = document.getElementById('btn-jugar');
    if (campaign) campaign.textContent = this.runState ? 'NUEVA CAMPAÑA' : 'CAMPAÑA';
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
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
    // Launcher
    document.getElementById('form-login')?.addEventListener('submit', e => this.handleAuth('login', e));
    document.getElementById('form-register')?.addEventListener('submit', e => this.handleAuth('register', e));
    this.onClick('tab-login', () => this.setAuthMode('login'));
    this.onClick('tab-register', () => this.setAuthMode('register'));
    this.onClick('btn-link-folder', () => this.linkFolder());
    this.onClick('btn-folder-access', () => this.grantFolder());
    const profileRoot = document.getElementById('launcher-profiles');
    profileRoot?.addEventListener('click', e => {
      const card = e.target.closest('[data-account]');
      if (card) this.selectProfile(card.dataset.account);
    });

    // Menú
    this.onClick('btn-jugar', () => { this.runState = null; this.lastOptions = null; this.persist(); this.showScreen('prep'); });
    this.onClick('btn-resume-save', () => this.resumeSavedRun());
    this.onClick('btn-cambiar-usuario', () => this.logoutToLauncher());
    this.onClick('btn-daily', () => this.startDaily());
    this.onClick('btn-board', () => this.showScreen('leaderboard'));
    this.onClick('btn-board-back', () => this.showScreen('menu'));
    this.onClick('btn-ascend', () => this.ascend());
    this.onClick('btn-mejoras', () => this.showScreen('upgrades'));
    this.onClick('btn-archivo', () => this.showScreen('archive'));
    this.onClick('btn-volver-archive', () => this.showScreen('menu'));
    this.onClick('btn-ajustes', () => this.showScreen('settings'));

    // Preparación
    this.onClick('btn-iniciar', () => this.startCycle({ sector: this.progress.sector || 1 }));
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
    this.onClick('btn-reintentar', () => {
      if (this.game.daily) { this.showScreen('leaderboard'); return; }
      this.startCycle({
        ...(this.lastOptions || {}), continueRun: true, run: this.runState
      });
    });
    this.onClick('btn-menu-results', () => this.showScreen('menu'));
    this.onClick('btn-final', () => this.showScreen('final'));
    this.onClick('btn-final-accept', () => this.chooseEnding('accept'));
    this.onClick('btn-final-reject', () => this.chooseEnding('reject'));
    this.onClick('btn-ascend-final', () => this.ascend());
    this.onClick('btn-final-menu', () => this.showScreen('menu'));
    this.onClick('btn-final-board', () => this.showScreen('leaderboard'));
    this.onClick('btn-results-board', () => this.showScreen('leaderboard'));
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

    // Pausa: botón del HUD, guardado explícito y salida sin perder la partida.
    this.onClick('btn-pause', () => this.pauseAndSave());
    this.onClick('btn-resume', () => { this.game.resume(); this.showPause(false); });
    this.onClick('btn-save-pause', () => this.pauseAndSave());
    this.onClick('btn-exit-pause', async () => {
      await this.pauseAndSave();
      this.game.startMenu();
      this.showScreen('menu');
    });

    // Tecla ESC para pausa
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.game.screen === 'playing') this.pauseAndSave();
      else if (this.game.screen === 'paused') { this.game.resume(); this.showPause(false); }
    });
  }

  onClick(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('pointerdown', (e) => { e.preventDefault(); cb(); });
  }

  // ---------- Ciclo Diario / Ascensión / Desenlace ----------

  dailyKey() {
    return todayKey();
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

  /** Una sola run oficial por día; una partida pausada de hoy se reanuda. */
  startDaily() {
    const key = this.dailyKey();
    const saved = this.runState;
    if (saved?.options?.daily && saved.options.date === key) {
      this.resumeSavedRun();
      return;
    }
    if (this.progress.dailyRuns?.[key]) {
      this.showToast('YA JUGASTE LA RUN DIARIA · CONSULTA LA TABLA');
      this.showScreen('leaderboard');
      return;
    }
    this.startCycle({ daily: true, seed: this.dailySeed(), date: key, sector: 1, board: '3x3' });
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
    const seed = g.dailySeedValue != null ? g.dailySeedValue : this.dailySeed();
    const prev = runs[g.dailyDate];
    const run = {
      score: g.score.score,
      seed,
      nickname: this.currentAccount?.nickname || null,
      loadout: { hammer: g.loadout.hammer, chips: Array.from(g.loadout.chips || []) },
      code: dailyCode(seed, g.score.score, g.dailyDate),
      ts: Date.now(),
      published: false
    };
    if (prev && (prev.score || 0) >= run.score) return prev;
    runs[g.dailyDate] = run;
    const best = this.progress.dailyBest || (this.progress.dailyBest = {});
    best[g.dailyDate] = Math.max(best[g.dailyDate] || 0, run.score);
    this.progress.dailyStreak = this.computeDailyStreak();
    return run;
  }

  /** Publica la mejor run diaria; sin backend queda encolada para la tabla offline. */
  async publishDailyRun(run) {
    if (!run || run.published || !this.leaderboard) return;
    try {
      const result = await this.leaderboard.submit({
        ...run,
        date: this.game.dailyDate,
        nickname: run.nickname || this.currentAccount?.nickname
      });
      run.published = true;
      run.publishState = result.ok ? 'sent' : (result.reason || 'queued');
      this.writeProgress(false);
    } catch (e) {
      run.published = true;
      run.publishState = 'error';
      this.writeProgress(false);
    }
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
    if (name !== 'launcher' && !this.accounts?.canPlay()) {
      name = 'launcher';
    }
    Object.values(this.screens).forEach(s => {
      if (s) { s.classList.remove('active'); s.classList.add('hidden'); }
    });
    this.pauseOverlay.classList.add('hidden');
    this.hud.classList.add('hidden');

    if (name === 'launcher') {
      this.refreshLauncher();
      this.setAuthMode('login');
      this.screens.launcher?.classList.remove('hidden');
      this.screens.launcher?.classList.add('active');
      this.audio.stopMusic();
      requestAnimationFrame(() => document.getElementById('login-nickname')?.focus());
    } else if (name === 'menu') {
      this.refreshMenuIdentity();
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
      const played = !!this.progress.dailyRuns?.[this.dailyKey()];
      if (dailyBtn) {
        dailyBtn.textContent = played
          ? `RUN DIARIA · YA JUGADA${streak ? ` · RACHA ${streak}` : ''}`
          : `RUN DIARIA${streak ? ` · RACHA ${streak}` : ''}`;
      }
      this.refreshMenuRecords();
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
    } else if (name === 'leaderboard') {
      this.screens.leaderboard.classList.remove('hidden');
      this.screens.leaderboard.classList.add('active');
      this.renderLeaderboard();
      this.leaderboard?.syncPending?.();
    }
  }

  showPause(show, status) {
    this.pauseOverlay.classList.toggle('hidden', !show);
    if (show && status) {
      const el = document.getElementById('pause-save-status');
      if (el) {
        el.textContent = status;
        el.classList.toggle('saved', status === 'PARTIDA GUARDADA');
      }
    }
  }

  refreshMenuRecords() {
    const root = document.getElementById('menu-records');
    if (!root) return;
    const p = this.progress;
    const best = p.bestScore || 0;
    const combo = p.bestCombo || 0;
    const today = p.dailyBest?.[this.dailyKey()] || 0;
    root.innerHTML = `
      <span class="menu-record"><svg class="icon" aria-hidden="true"><use href="#i-trophy"></use></svg>MEJOR <strong>${best.toLocaleString('es-ES')}</strong></span>
      <span class="menu-record"><svg class="icon" aria-hidden="true"><use href="#i-combo"></use></svg>COMBO <strong>×${combo}</strong></span>
      <span class="menu-record"><svg class="icon" aria-hidden="true"><use href="#i-globe"></use></svg>DIARIO <strong>${today.toLocaleString('es-ES')}</strong></span>
    `;
  }

  // ---------- Ciclo ----------

  startCycle(options = {}, loadoutOverride = null) {
    if (options.daily && !options.resumeState) {
      const key = options.date || this.dailyKey();
      if (this.progress.dailyRuns?.[key]) {
        this.showToast('YA JUGASTE LA RUN DIARIA · CONSULTA LA TABLA');
        this.showScreen('leaderboard');
        return false;
      }
    }
    this.audio.init();
    this.sectorCleared = 0;
    this.progress.cycles = (this.progress.cycles || 0) + 1;
    this.writeProgress(false);
    // Cada jefe (uno cada 5 ciclos) desbloquea su chip al caer.
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
    if (options.continueRun) {
      runOptions.continueRun = true;
      runOptions.run = options.run || this.runState?.run || this.runState;
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
    const { resumeState, run, ...storedOptions } = runOptions;
    this.lastOptions = { ...storedOptions, creditMultiplier: 1 };
    const loadout = loadoutOverride || options.resumeState?.loadout || { hammer, chips, upgrades, abilities };
    this.game.startCycle(loadout, gameOptions);
    this.renderer.resize();
    this.game.setCanvasSize(this.renderer.drawW, this.renderer.drawH, this.renderer.board);
    this.hud.classList.remove('hidden');
    // Ocultar todas las pantallas de menú; el juego se dibuja en el canvas
    Object.values(this.screens).forEach(s => { if (s) { s.classList.add('hidden'); s.classList.remove('active'); } });
    this.pauseOverlay.classList.add('hidden');
    return true;
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
    if (this.game.fakeEndings > 0) {
      this.progress.fakeEndings = (this.progress.fakeEndings || 0) + this.game.fakeEndings;
    }
    if (this.game.run && this.game.run.bossesKilled > (this.progress.bossKills || 0)) {
      this.progress.bossKills = this.game.run.bossesKilled;
    }
    const dailyRun = this.recordDailyRun();
    if (dailyRun) this.publishDailyRun(dailyRun);
    if (this.game.daily) {
      this.runState = null; // la run diaria es única: no se puede reanudar tras el desenlace
      this.persist();
    } else {
      this.captureRunState();
    }
    const prevBest = this.progress.bestScore || 0;
    const isRecord = this.game.score.score > prevBest;
    this.saveProgress();
    document.getElementById('res-record').style.display = isRecord ? 'block' : 'none';
    document.getElementById('res-score').textContent = this.game.score.score;
    document.getElementById('res-combo').textContent = this.game.score.maxCombo;
    document.getElementById('res-perfect').textContent = this.game.score.perfects;
    document.getElementById('res-credits').textContent = this.game.credits;

    const up = this.progress.upgrades || {};
    const chips = Array.from(this.game.loadout.chips || []).join(', ') || 'SIN CHIPS';
    const cursorName = (CURSORS.find(c => c.id === this.game.loadout.hammer) || {}).name || 'PULSO';
    const abilityCount = Object.values(this.game.abilities || {}).filter(l => l > 0).length;
    const build = `PULSO NV ${up.pulso || 0} · TESLA NV ${up.tesla || 0} · ${cursorName} · ${abilityCount} HAB · ${chips}`;
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
      `SECTOR ${this.game.sector} · ${this.game.boardId.toUpperCase()} · ${build}` +
      dailyTag + ascTag + runTag +
      (this.sectorCleared ? ` · JEFE ${this.sectorCleared} VENCIDO` : '') +
      (this.game.creditsGained ? ` · +${this.game.creditsGained} CR` : '') +
      (this.game.runComplete ? ' · RUN COMPLETADA' : '');

    const retry = document.getElementById('btn-reintentar');
    const boardBtn = document.getElementById('btn-results-board');
    if (retry) {
      retry.classList.toggle('hidden', !!this.game.daily);
      retry.textContent = this.game.daily ? 'VER TABLA DIARIA' : 'REINTENTAR';
      if (!this.game.daily) retry.classList.remove('hidden');
    }
    if (boardBtn) boardBtn.classList.toggle('hidden', !this.game.daily);

    const continuar = document.getElementById('btn-continuar');
    if (continuar) {
      const canAdvance = !this.game.daily && this.sectorCleared > 0 && this.sectorCleared < 5;
      continuar.style.display = canAdvance ? 'inline-block' : 'none';
      continuar.textContent = canAdvance ? `CONTINUAR A SECTOR ${this.sectorCleared + 1}` : 'CAMPAÑA COMPLETA';
    }
    const finalBtn = document.getElementById('btn-final');
    if (finalBtn) finalBtn.style.display = !this.game.daily && this.sectorCleared === 5 ? 'inline-block' : 'none';

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
      : 'CAMPAÑA · RÉCORDS LOCALES';
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
        <p><strong>Campaña:</strong> mejor ${p.bestScore || 0} pts · combo máx ${p.bestCombo || 0}</p>
        <p><strong>Run diaria:</strong> ${daily}</p>
        <p><strong>Racha diaria:</strong> ${dailyStreak} día${dailyStreak === 1 ? '' : 's'}</p>
        <p><strong>Créditos acumulados:</strong> ${this.game.credits}</p>
        <p><em>EL SISTEMA: "No fue un fallo, fue una decisión creativa."</em></p>
      `;
    } else {
      content.innerHTML = '<p>No hay registros aún. Juega un ciclo para generar logs.</p>';
    }
  }

  // ---------- Tabla de la run diaria ----------

  async renderLeaderboard() {
    const date = this.dailyKey();
    const dateEl = document.getElementById('board-date');
    const onlineEl = document.getElementById('board-online');
    const offlineEl = document.getElementById('board-offline');
    const stateEl = document.getElementById('board-online-state');
    const summaryEl = document.getElementById('board-summary');
    if (dateEl) dateEl.textContent = date;
    const mine = this.progress.dailyBest?.[date] || 0;
    if (summaryEl) {
      summaryEl.innerHTML = `TU MEJOR RUN DE HOY · <strong>${mine.toLocaleString('es-ES')}</strong> PUNTOS`;
    }
    if (!this.leaderboard) {
      if (stateEl) stateEl.textContent = 'SIN SERVICIO';
      if (onlineEl) onlineEl.innerHTML = '<div class="board-empty">Tabla no disponible.</div>';
      if (offlineEl) offlineEl.innerHTML = '<div class="board-empty">Tabla no disponible.</div>';
      return;
    }
    try {
      const data = await this.leaderboard.load(date);
      if (stateEl) stateEl.textContent = data.onlineState || '—';
      const rows = entries => entries.length
        ? entries.slice(0, 20).map((entry, i) => `
            <div class="board-row${i === 0 ? ' top' : ''}">
              <span class="board-rank">${i + 1}</span>
              <span class="board-who">
                <span class="board-name">${this.escapeHtml(entry.nickname)}</span>
                <span class="board-code">${this.escapeHtml(entry.code || '—')}</span>
              </span>
              <span class="board-score">${entry.score.toLocaleString('es-ES')}</span>
            </div>`).join('')
        : '<div class="board-empty">Sin registros para hoy.</div>';
      if (onlineEl) onlineEl.innerHTML = rows(data.online || []);
      if (offlineEl) offlineEl.innerHTML = rows(data.offline || []);
    } catch (e) {
      if (stateEl) stateEl.textContent = 'SIN CONEXIÓN';
      if (onlineEl) onlineEl.innerHTML = '<div class="board-empty">No se pudo cargar la tabla mundial.</div>';
      if (offlineEl) offlineEl.innerHTML = '<div class="board-empty">No se pudo leer el datasave.</div>';
    }
  }

  // ---------- HUD ----------

  updateHUD(dt) {
    if (this.game.screen !== 'playing') return;
    const g = this.game;
    const n = this.hudNodes;
    const cycle = (g.run?.cyclesDone || 0) + 1;

    if (n.score) n.score.textContent = g.score.score.toLocaleString('es-ES');
    if (n.combo) n.combo.textContent = `×${comboMultiplier(g.score.combo)}`;
    if (n.comboNext) {
      const next = nextComboMilestone(g.score.combo);
      n.comboNext.textContent = next ? `SIG. ${next}` : '';
    }
    if (n.tier) n.tier.textContent = `×${g.voltageTier}`;
    if (n.cycle) n.cycle.textContent = `C${cycle}/${BALANCE.run.maxCycles}`;
    if (n.voltage) n.voltage.textContent = `${Math.round(g.voltage)} %`;

    const bar = n.bar;
    const glow = n.glow;
    if (bar) {
      bar.style.width = `${Math.max(0, Math.min(100, g.voltage))}%`;
      bar.classList.toggle('overdrive', !!g.nightmare);
      bar.classList.toggle('voltage-high', g.voltage >= 80);
      bar.classList.toggle('voltage-frozen', g.voltageFrozen > 0);
    }
    if (glow) glow.classList.toggle('active', !!g.nightmare || g.voltageFrozen > 0);

    const showDemote = g.demoteFlash > 0 && g.demoteFromTier > 0;
    if (n.demote) {
      n.demote.classList.toggle('show', showDemote);
      if (showDemote) {
        const label = n.demote.querySelector('span');
        if (label) label.textContent = `×${g.demoteFromTier} → ×${g.voltageTier}`;
      }
    }
    n.tiers?.forEach((el, i) => {
      const tier = i + 1;
      el.classList.toggle('active', tier === g.voltageTier);
      el.classList.toggle('done', tier < g.voltageTier);
    });

    const tokenText = (node, text) => {
      if (!node) return;
      const span = node.querySelector('span');
      if (span) span.textContent = text;
    };
    const daily = !!g.daily;
    if (n.mode) {
      n.mode.querySelector('use')?.setAttribute('href', daily ? '#i-globe' : '#i-trophy');
      tokenText(n.mode, daily ? `DIARIO${g.dailyDate ? ` ${g.dailyDate}` : ''}` : 'CAMPAÑA');
    }
    tokenText(n.sector, `S${g.sector} · ${String(g.boardId || '3x3').toUpperCase()}`);
    const cursorName = (CURSORS.find(c => c.id === g.loadout?.hammer) || {}).name || 'PULSO';
    tokenText(n.cursor, cursorName.toUpperCase());

    const bossActive = !!g.boss && !g.boss.defeated;
    n.boss?.classList.toggle('hidden', !bossActive);
    if (bossActive) {
      const hp = Math.max(0, Math.ceil((g.boss.hp / g.boss.maxHp) * 100));
      tokenText(n.boss, `${g.boss.name} ${hp} %`);
    }
    const frozen = g.voltageFrozen > 0;
    n.freeze?.classList.toggle('hidden', !frozen);
    if (frozen) tokenText(n.freeze, `CRIO ${g.voltageFrozen.toFixed(1)}s`);

    const ruleShorts = ASCENSION_RULES.slice(1, Math.min(g.ascension || 0, ASCENSION_RULES.length - 1) + 1)
      .filter(Boolean).map(r => r.short);
    const rulesText = daily ? 'CARGA FIJA'
      : (g.ascension ? `A${g.ascension}${ruleShorts.length ? ` ${ruleShorts.join('/')}` : ''}` : '');
    n.rules?.classList.toggle('hidden', !rulesText);
    if (rulesText) tokenText(n.rules, rulesText);
  }
}
