import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { AccountManager } from './accounts.js';
import { BALANCE } from './balance.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const audio = new AudioManager();
const input = new InputManager(canvas);

// Renderer primero (sin game aún para evitar referencia circular)
const renderer = new Renderer(canvas, ctx, { audio, input, game: null });
const game = new Game({ audio, input, renderer });
renderer.game = game;

const accounts = new AccountManager();
await accounts.init();
const ui = new UI({ game, audio, input, renderer, accounts });

// Garantizar que el AudioContext se resume en la primera interacción de usuario
// Solo un evento confiable habilita háptica/audio: los eventos sintéticos no cuentan
// como interacción humana (anti-automatización y evita avisos de navigator.vibrate).
const ensureAudio = (e) => {
  window.__userInteracted = e && typeof e.isTrusted === 'boolean' ? e.isTrusted : false;
  if (window.__userInteracted) audio.init();
};
document.addEventListener('pointerdown', ensureAudio, { once: true });
document.addEventListener('keydown', ensureAudio, { once: true });

// Pantalla de carga inicial (arranque diegético: parpadeo antes del menú)
const loading = document.createElement('div');
loading.id = 'screen-loading';
loading.className = 'screen active';
loading.innerHTML = `
  <div class="screen-glitch" style="font-size: clamp(32px, 14vw, 70px);">OVERCLOCK<span class="blink">9</span></div>
  <div style="font-size: 14px; letter-spacing: 3px; color: var(--magenta); text-transform: uppercase; margin-top: 16px; opacity: 0.8;">INICIALIZANDO CABINA…</div>
`;
document.getElementById('app').insertBefore(loading, document.getElementById('app').firstChild);

setTimeout(() => {
  loading.classList.remove('active');
  loading.classList.add('hidden');
  ui.showScreen(accounts.canPlay() ? 'menu' : 'launcher');
}, 900);

// Métricas ligeras de QA (FPS y latencia evento→procesamiento)
const metrics = { fps: [], latency: [], audio: [] };
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// Conectar input con hit-test del renderizador.
// Los núcleos rojos esperan al pointerup: si se arrastran ≥60 px se purgan sin castigo.
const pendingRed = new Map();
const recordLatency = () => {
  if (game.lastInputLatency) metrics.latency.push(game.lastInputLatency);
  if (game.lastAudioLatency > 0 && game.lastAudioLatency < 1000) {
    metrics.audio.push(game.lastAudioLatency);
    if (metrics.audio.length > 120) metrics.audio.shift();
  }
};

input.onPointer = (x, y, phase, info = {}) => {
  if (phase === 'down') game.addTapRipple(x, y);
  if (game.screen !== 'playing') return;
  const id = info.id;

  if (phase === 'down') {
    const hole = renderer.hitTest(x, y);
    if (!hole) return;
    const isRed = hole.core === 'bomb' &&
      (hole.state === 'active' || hole.state === 2 || hole.state === 'telegraph' || hole.state === 1);
    if (isRed) {
      pendingRed.set(id, { hole, purged: false });
      game.updateDragVisuals(hole, x, y);
      return;
    }
    game.handlePointerHole(hole);
    recordLatency();
    return;
  }

  const pending = pendingRed.get(id);
  if (!pending) return;

  if (phase === 'move' && !pending.purged &&
      info.distance >= BALANCE.voltage.red.dragThresholdPx) {
    pending.purged = true;
    game.clearDragVisuals();
    if (game.purgeRed(pending.hole)) recordLatency();
    return;
  }

  if (phase === 'move' && !pending.purged) {
    game.updateDragVisuals(pending.hole, x, y);
    return;
  }

  if (phase === 'up') {
    game.clearDragVisuals();
    if (!pending.purged && info.distance < BALANCE.voltage.red.dragThresholdPx) {
      game.handlePointerHole(pending.hole);
      recordLatency();
    }
    pendingRed.delete(id);
  }
};

game.onEndCycle = () => {
  ui.runState = { ...game.run };
  ui.showScreen('results');
};

window.addEventListener('resize', () => renderer.resize());
renderer.resize();

let lastTime = performance.now();
let fpsFrames = 0;
let fpsAccum = 0;
function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 1) {
    metrics.fps.push(Math.round(fpsFrames / fpsAccum));
    fpsFrames = 0;
    fpsAccum = 0;
    if (metrics.fps.length > 120) metrics.fps.shift();
  }
  game.update(dt);
  ui.updateHUD(dt);
  renderer.render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Exponer para debug y QA
window.__OVERCLOCK = {
  game, audio, input, renderer, ui, accounts, metrics, balance: BALANCE,
  getMetrics: () => ({
    board: game.boardId,
    voltage: Math.round(game.voltage),
    voltageTier: game.voltageTier,
    combo: game.score.combo,
    avgFps: +avg(metrics.fps).toFixed(1),
    minFps: metrics.fps.length ? Math.min(...metrics.fps) : 0,
    avgLatencyMs: +avg(metrics.latency).toFixed(1),
    avgAudioLatencyMs: +avg(metrics.audio).toFixed(1),
    maxAudioLatencyMs: metrics.audio.length ? +Math.max(...metrics.audio).toFixed(1) : 0,
    samples: { fps: metrics.fps.length, latency: metrics.latency.length, audio: metrics.audio.length }
  })
};
