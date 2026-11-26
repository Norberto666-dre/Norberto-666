import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, Boss, BOSS_BY_SECTOR, BOSS_STYLE, Hole, ScoreManager, Director,
  HoleState, CoreType, makeRng, dailyCode, endlessHpBonus, ascensionRuleNames,
  comboMultiplier, nextComboMilestone
} from '../js/game.js';
import {
  ABILITIES, ABILITY_EFFECTS, CHIPS_EXTRA, CHIP_EFFECTS,
  CURSORS, CURSOR_EFFECTS, abilityCost
} from '../js/content.js';
import { BALANCE, BOARDS, boardById } from '../js/balance.js';

const audioStub = new Proxy({}, { get: () => () => {} });
const makeGame = () => {
  const g = new Game({ audio: audioStub, input: {}, renderer: {} });
  g.setCanvasSize(390, 844);
  return g;
};
const start = (g, loadout = {}, options = {}) => {
  g.startCycle({ hammer: 'pulso', chips: [], ...loadout }, { board: '3x3', ...options });
  // En modo jefe el núcleo del jefe ya ocupa un hoyo real; resetearlo rompería la escena.
  if (!g.boss) g.holes.forEach(h => h.reset());
  // startCycle puede generar un clúster antes del reset: limpiar también su estado.
  g.links = [];
  g.linkSeq = 0;
  return g;
};
const tap = (g, h) => { g.hitStopTimer = 0; g.handlePointerHole(h); };
// update() limita dt a 0.1 s por frame: avanzar en pasos reales para los tests de tiempo.
const advance = (g, seconds, step = 0.05) => {
  for (let t = 0; t < seconds - 1e-9; t += step) g.update(Math.min(step, seconds - t));
};
const active = (h, core = CoreType.STANDARD, linkId = 0) => {
  h.reset();
  h.state = HoleState.ACTIVE;
  h.core = core;
  h.timer = 0;
  h.lifetime = 10;
  h.telegraphTime = 0.3;
  h.linkId = linkId;
  return h;
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// ---------- Núcleo, PRNG y utilidades ----------

test('ScoreManager: golpes, perfectos, fallos y reinicio', () => {
  const s = new ScoreManager();
  s.onHit(true);
  assert.equal(s.score, 200);
  assert.equal(s.combo, 1);
  assert.equal(s.perfects, 1);
  s.onMiss();
  assert.equal(s.combo, 0);
  assert.equal(s.multiplier, 1);
  s.reset();
  assert.equal(s.score, 0);
  assert.equal(s.maxCombo, 0);
});

test('Hitos de combo: escalones 5/10/20/30/40/100/1000/10000', () => {
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(4), 1);
  assert.equal(comboMultiplier(5), 1.5);
  assert.equal(comboMultiplier(10), 2);
  assert.equal(comboMultiplier(20), 3);
  assert.equal(comboMultiplier(30), 4);
  assert.equal(comboMultiplier(40), 5);
  assert.equal(comboMultiplier(100), 8);
  assert.equal(comboMultiplier(1000), 55);
  assert.equal(comboMultiplier(10000), 145);
  assert.equal(nextComboMilestone(4), 5);
  assert.equal(nextComboMilestone(5), 10);
  assert.equal(nextComboMilestone(10000), null);
});

test('ScoreManager: el golpe que alcanza el hito ya usa el nuevo multiplicador', () => {
  const s = new ScoreManager();
  for (let i = 0; i < 4; i++) s.onHit(false);
  assert.equal(s.multiplier, 1);
  const gained = s.onHit(false);
  assert.equal(gained, 150);
  assert.equal(s.lastMilestone, 5);
  assert.equal(s.multiplier, 1.5);
});

test('Hole: ciclo telegrafía → activo → golpe → reinicio', () => {
  const h = new Hole(0);
  h.spawn(CoreType.STANDARD, 1, 7);
  assert.equal(h.state, HoleState.TELEGRAPH);
  assert.equal(h.linkId, 7);
  h.timer = 0.3;
  h.state = HoleState.ACTIVE;
  assert.equal(h.hit(), true);
  assert.equal(h.state, HoleState.HIT);
  h.reset();
  assert.equal(h.state, HoleState.EMPTY);
  assert.equal(h.linkId, 0);
});

test('Director: Jackpot nunca genera bombas y limita el historial', () => {
  const d = new Director();
  const holes = Array.from({ length: 9 }, (_, i) => new Hole(i));
  for (let i = 0; i < 10; i++) {
    const pick = d.pick(holes, i, 3, true, () => 0.01, 0.5);
    assert.equal(pick.core, CoreType.STANDARD);
  }
  assert.ok(d.recentHistory.length <= d.maxHistory);
});

test('Director: presión alta aumenta probabilidad de bomba', () => {
  const d = new Director();
  const holes = Array.from({ length: 9 }, (_, i) => new Hole(i));
  const pick = d.pick(holes, 0, 3, false, () => 0.1, 0.3);
  assert.equal(pick.core, CoreType.BOMB);
});

test('PRNG diario, código compartible y curva del infinito', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  assert.equal(a(), b());
  assert.equal(a(), b());
  assert.match(dailyCode(12345, 5000, '2026-11-25'), /^O9-261125-\w+-\w+$/);
  assert.ok(endlessHpBonus(1) < endlessHpBonus(10));
  assert.ok(endlessHpBonus(100) <= 1.5);
  assert.deepEqual(ascensionRuleNames(2), ['DOBLE BOMBA', 'NÚCLEOS PARTIDOS']);
});

test('Tableros iniciales: 3×3, 4×3 y 5×4 con umbrales centralizados', () => {
  assert.deepEqual(BOARDS.map(b => b.id), ['3x3', '4x3', '5x4']);
  assert.equal(boardById('4x3').cols * boardById('4x3').rows, 12);
  assert.equal(boardById('5x4').cols * boardById('5x4').rows, 20);
  assert.equal(boardById('4x3').unlockScore, 100000);
  assert.equal(boardById('5x4').unlockScore, 1000000);
  assert.equal(boardById('inexistente').id, '3x3');
});

// ---------- Voltaje como vida ----------

test('startCycle inicializa voltaje, sin temporizador y con tier de la run', () => {
  const g = makeGame();
  g.run.tier = 3;
  g.startCycle({}, { continueRun: true, run: g.run, board: '3x3' });
  assert.equal(g.voltage, BALANCE.voltage.start);
  assert.equal(g.voltageTier, 3);
  assert.equal(g.timeRemaining, undefined);
  assert.equal(g.screen, 'playing');
});

test('Golpes normal, Perfecto y enlazado suman 2/3/4 de voltaje', () => {
  const g = start(makeGame());
  g.voltage = 40;
  const slow = active(g.holes[0], CoreType.STANDARD);
  slow.timer = 0.5; // fuera de la ventana Perfecto
  tap(g, slow);
  near(g.voltage, 42);
  tap(g, active(g.holes[1], CoreType.STANDARD));
  near(g.voltage, 45);
  const linked = active(g.holes[2], CoreType.STANDARD, 9);
  linked.timer = 0.5;
  tap(g, linked);
  near(g.voltage, 49);
});

test('Voltaje drena con el tiempo y los núcleos rojos drenan más', () => {
  const g = start(makeGame());
  g.spawnTimer = 10; // aislar el drenaje de spawns aleatorios
  g.voltage = 100;
  advance(g, 0.5);
  near(g.voltage, 100 - BALANCE.voltage.drainPerSec * 0.5);
  g.voltage = 100;
  active(g.holes[0], CoreType.BOMB);
  advance(g, 0.5);
  near(g.voltage, 100 - (BALANCE.voltage.drainPerSec + BALANCE.voltage.red.drainPerSec) * 0.5);
});

test('Llenar la barra sube un nivel de voltaje una sola vez y respeta el tope ×5', () => {
  const g = start(makeGame());
  g.voltage = 94;
  g.voltageArmed = true;
  g.addVoltage(6);
  assert.equal(g.voltageTier, 2);
  assert.equal(g.voltageArmed, false);
  g.addVoltage(10);
  assert.equal(g.voltageTier, 2);
  for (let i = 0; i < 10; i++) {
    g.voltage = 94;
    g.voltageArmed = true;
    g.addVoltage(6);
  }
  assert.equal(g.voltageTier, BALANCE.voltage.maxTier);
});

test('Llegar a 0 voltaje cierra el ciclo y liquida floor(score/10)', () => {
  const g = start(makeGame());
  let callbacks = 0;
  g.onEndCycle = () => callbacks++;
  g.score.score = 50000;
  g.voltage = 0.001;
  g.update(0.1);
  assert.equal(g.voltage, 0);
  assert.equal(g.screen, 'results');
  assert.equal(g.credits, 5000);
  assert.equal(g.creditsGained, 5000);
  assert.equal(callbacks, 1);
  g.endCycle();
  assert.equal(callbacks, 1);
});

test('Falso Final congela el voltaje 5 s y termina la Pesadilla', () => {
  const g = start(makeGame());
  g.startNightmare();
  assert.equal(g.nightmare, true);
  near(g.voltageFrozen, 5);
  const v = g.voltage;
  advance(g, 0.5);
  near(g.voltage, v);
  advance(g, 4.6);
  assert.equal(g.nightmare, false);
  assert.equal(g.voltageFrozen, 0);
});

test('Núcleo blanco: una vez por ciclo, out of Diario, activa Pesadilla y paga bonus', () => {
  const g = start(makeGame());
  g.score.combo = 5;
  g.update(0.016);
  const whites = g.holes.filter(h => h.core === CoreType.WHITE);
  assert.equal(whites.length, 1);
  g.update(0.1);
  assert.equal(g.holes.filter(h => h.core === CoreType.WHITE).length, 1);
  const before = g.score.score;
  g.handlePointerHole(active(whites[0], CoreType.WHITE));
  assert.equal(g.fakeEndings, 1);
  assert.equal(g.nightmare, true);
  assert.ok(g.score.score >= before + BALANCE.whiteCore.scoreBonus);
});

test('Núcleo blanco: un segundo núcleo no repite el Falso Final en el mismo ciclo', () => {
  const g = start(makeGame());
  g.score.combo = 5;
  g.update(0.016);
  const first = g.holes.find(h => h.core === CoreType.WHITE);
  tap(g, active(first, CoreType.WHITE));
  const scoreAfterFirst = g.score.score;
  const second = g.holes.find(h => h !== first);
  tap(g, active(second, CoreType.WHITE));
  assert.equal(g.fakeEndings, 1);
  assert.equal(g.score.score, scoreAfterFirst);
  assert.equal(second.state, HoleState.EMPTY);
});

test('Diario fuerza 3×3, sin jefe, sin núcleo blanco y con carga fija', () => {
  const g = makeGame();
  g.setBoard('5x4');
  g.startCycle({ hammer: 'tesla', chips: ['volc_bomb', 'chrono_x3'] },
    { daily: true, board: '3x3', seed: 7, date: '2026-11-25' });
  assert.equal(g.holes.length, 9);
  assert.equal(g.boss, null);
  assert.equal(g.loadout.hammer, 'pulso');
  assert.equal(g.loadout.chips.length, 0);
  advance(g, 5);
  assert.equal(g.fakeEndings, 0);
});

// ---------- Tableros dinámicos ----------

test('setBoard redimensiona hoyos y centro según columnas/filas', () => {
  const g = makeGame();
  g.setBoard('4x3');
  assert.equal(g.holes.length, 12);
  assert.equal(g.centerIndex(), 6);
  g.setBoard('5x4');
  assert.equal(g.holes.length, 20);
  assert.equal(g.centerIndex(), 12);
  const last = g.holes[19];
  assert.ok(last.x > 0 && last.y > 0);
});

test('Vecindad respeta bordes en tableros ampliados', () => {
  const g = makeGame();
  g.setBoard('4x3');
  assert.equal(g.getNeighbors(0, 1).length, 3);
  assert.equal(g.getNeighbors(6, 1).length, 8);
  g.setBoard('5x4');
  assert.equal(g.getNeighbors(0, 1).length, 3);
  assert.equal(g.getNeighbors(12, 1).length, 8);
  // 5×4: desde el centro (fila 2, col 2) y rango 2 caben 4 filas × 5 columnas − 1.
  assert.equal(g.getNeighbors(12, 2).length, 19);
});

test('Nova limpia los 20 hoyos de 5×4 sin índice fuera de rango', () => {
  const g = start(makeGame(), {}, { board: '5x4' });
  assert.equal(g.holes.length, 20);
  g.holes.forEach((h, i) => active(h, i % 2 ? CoreType.BOMB : CoreType.STANDARD));
  g.detonateNova(g.holes[19], false, 0);
  assert.equal(g.holes.filter(h => h.state === HoleState.ACTIVE).length, 0);
});

// ---------- Núcleos rojos: tap vs arrastre ----------

test('Tocar un núcleo rojo resta 1 combo y 8 de voltaje', () => {
  const g = start(makeGame());
  g.score.combo = 4;
  g.voltage = 50;
  g.handlePointerHole(active(g.holes[0], CoreType.BOMB));
  assert.equal(g.score.combo, 3);
  near(g.voltage, 42);
  assert.equal(g.score.bombs, 1);
});

test('Tocar un rojo enlazado resta 2 de combo', () => {
  const g = start(makeGame());
  g.score.combo = 5;
  g.links = [{ id: 7, indices: [0, 1], timer: 1, trapped: false, done: false }];
  active(g.holes[0], CoreType.BOMB, 7);
  active(g.holes[1], CoreType.BOMB, 7);
  g.handlePointerHole(g.holes[0]);
  assert.equal(g.score.combo, 3);
});

test('Purgar arrastrando no castiga y limpia también el rojo enlazado', () => {
  const g = start(makeGame());
  g.score.combo = 5;
  g.voltage = 50;
  active(g.holes[0], CoreType.BOMB, 7);
  active(g.holes[1], CoreType.BOMB, 7);
  g.links = [{ id: 7, indices: [0, 1], timer: 1, trapped: false, done: false }];
  assert.equal(g.purgeRed(g.holes[0]), true);
  assert.equal(g.holes[0].state, HoleState.EMPTY);
  assert.equal(g.holes[1].state, HoleState.EMPTY);
  assert.equal(g.score.combo, 5);
  near(g.voltage, 50);
  assert.equal(g.links[0].done, true);
});

test('Dejar escapar un rojo cuesta 10 de voltaje pero no rompe el combo', () => {
  const g = start(makeGame());
  g.score.combo = 3;
  g.voltage = 50;
  const h = active(g.holes[0], CoreType.BOMB);
  h.lifetime = 0.01;
  g.updateHole(h, 0.02);
  assert.equal(g.score.combo, 3);
  near(g.voltage, 40);
});

test('Aegis absorbe el primer núcleo rojo sin castigo', () => {
  const g = start(makeGame(), { hammer: 'aegis' });
  g.score.combo = 3;
  g.voltage = 50;
  g.handlePointerHole(active(g.holes[0], CoreType.BOMB));
  assert.equal(g.score.combo, 3);
  near(g.voltage, 50);
  assert.equal(g.bombIgnoresLeft, 0);
});

test('Umbral de arrastre centralizado en ~60 px', () => {
  assert.equal(BALANCE.voltage.red.dragThresholdPx, 60);
});

// ---------- Clústeres e hitos ----------

test('Clúster: spawn enlaza núcleos vecinos y crea grupo', () => {
  const g = start(makeGame());
  const primary = active(g.holes[4], CoreType.STANDARD);
  g.spawnLinkedCluster(primary, 1.4, 0.3);
  assert.equal(g.links.length, 1);
  const group = g.links[0];
  assert.ok(group.indices.length >= 2);
  assert.equal(g.holes[group.indices[1]].linkId, group.id);
});

test('Clúster: primer golpe atrapa la ventana y amplía vida de los demás', () => {
  const g = start(makeGame());
  const primary = active(g.holes[4], CoreType.STANDARD);
  g.spawnLinkedCluster(primary, 1.4, 0.3);
  const group = g.links[0];
  const other = g.holes[group.indices[1]];
  const before = other.lifetime;
  g.registerLinkHit(primary);
  assert.equal(group.trapped, true);
  near(group.timer, BALANCE.links.trapWindow);
  assert.ok(other.lifetime > before);
});

test('Clúster: limpiar todos los núcleos suma combo, puntos y voltaje conectado', () => {
  const g = start(makeGame());
  const primary = active(g.holes[4], CoreType.STANDARD);
  g.spawnLinkedCluster(primary, 1.4, 0.3);
  const group = g.links[0];
  group.indices.forEach(i => { g.holes[i].state = HoleState.HIT; });
  const combo = g.score.combo;
  g.voltage = 60; // evitar el techo de 100 para observar la ganancia conectada
  const voltage = g.voltage;
  const score = g.score.score;
  g.registerLinkHit(primary);
  assert.equal(group.done, true);
  assert.equal(g.score.combo, combo + (group.indices.length - 1) * BALANCE.links.comboPerExtra);
  assert.ok(g.score.score > score);
  assert.ok(g.voltage > voltage);
});

test('Clúster: expira la trampa y libera los núcleos', () => {
  const g = start(makeGame());
  const group = { id: 1, indices: [4, 5], timer: 0.01, trapped: true, done: false };
  g.links = [group];
  g.holes[4].trapped = true;
  g.holes[5].trapped = true;
  g.update(0.02);
  assert.equal(group.done, true);
  assert.equal(g.holes[4].trapped, false);
  assert.equal(g.holes[5].trapped, false);
});

// ---------- Jefes móviles ----------

test('Jefe: color y glifo propios por tipo', () => {
  assert.equal(BOSS_STYLE.golem.color, '#ff6a00');
  assert.equal(BOSS_STYLE.mirror.glyph, 'diamond');
  assert.equal(BOSS_BY_SECTOR[5], 'sobrecarga');
  assert.ok(BOSS_STYLE.crio.color !== BOSS_STYLE.prisma.color);
});

test('Jefe: fases y vida partida en dos mitades', () => {
  const b = new Boss('golem');
  b.hit(100);
  assert.equal(b.getPhase(), 1);
  b.hit(60);
  assert.equal(b.getPhase(), 2);
  b.hit(110);
  assert.equal(b.getPhase(), 3);
  assert.deepEqual(b.halves, [15, 15]);
  b.hit(10);
  assert.equal(b.hp, 20);
});

test('Jefe: ocupa un hoyo real y el golpe no da voltaje', () => {
  const g = start(makeGame(), {}, { bossMode: true });
  const hole = g.holes[g.boss.holeIndex];
  assert.equal(hole.core, CoreType.BOSS);
  assert.equal(hole.state, HoleState.ACTIVE);
  g.voltage = 50;
  const hp = g.boss.hp;
  g.handlePointerHole(hole);
  assert.ok(g.boss.hp < hp);
  near(g.voltage, 50);
});

test('Jefe: teletransporte limpia el hoyo anterior y aparece en otro', () => {
  const g = start(makeGame(), {}, { bossMode: true });
  const oldIndex = g.boss.holeIndex;
  g.spawnTimer = 10; // aislar el teletransporte de spawns aleatorios
  g.boss.teleport();
  g.boss.vanishing = 0;
  g.update(0.016);
  assert.notEqual(g.boss.holeIndex, oldIndex);
  assert.equal(g.holes[oldIndex].state, HoleState.EMPTY);
  assert.equal(g.holes[g.boss.holeIndex].core, CoreType.BOSS);
});

test('Jefe: derrota paga 5.000 puntos y notifica una sola vez', () => {
  const g = start(makeGame(), {}, { bossMode: true });
  let calls = 0;
  g.onBossDefeatedCb = () => calls++;
  g.boss.hp = 1;
  g.damageBoss(10);
  assert.equal(g.boss.defeated, true);
  assert.ok(g.score.score >= BALANCE.run.bossKillScore);
  assert.equal(calls, 1);
  g.damageBoss(10);
  assert.equal(calls, 1);
});

test('Jefe: aparece cada 5 ciclos y se conserva en la run', () => {
  const g = start(makeGame());
  g.run.cyclesDone = 4;
  g.endCycle();
  assert.equal(g.run.nextBoss, true);
  const run = { ...g.run };
  g.startCycle({}, { continueRun: true, run, board: '3x3' });
  assert.ok(g.boss);
  assert.equal(g.voltageTier, run.tier);
});

test('Jefe: una fila aplastada bloquea spawns normales', () => {
  const g = start(makeGame(), {}, { bossMode: true });
  g.holes.forEach(h => h.reset());
  g.boss.slammedRows = [{ row: 0, timer: 2, half: 0 }];
  g.trySpawn();
  const spawned = g.holes.filter(h => h.index < g.cols && h.state !== HoleState.EMPTY);
  assert.equal(spawned.length, 0);
});

// ---------- Resonancia Nova ----------

test('Nova: una sola explosión paga el valor real de los núcleos eliminados', () => {
  const g = start(makeGame());
  active(g.holes[0], CoreType.NOVA);
  active(g.holes[1], CoreType.CRONO);
  active(g.holes[2], CoreType.BOMB);
  g.detonateNova(g.holes[0], false, 0);
  assert.equal(g.novaDetonations, 1);
  assert.equal(g.novaCoresCleared, 3);
  const expected = BALANCE.nova.coreValues.nova + BALANCE.nova.coreValues.crono +
    BALANCE.nova.coreValues.bomb;
  assert.equal(g.novaPoints, expected);
  assert.equal(g.score.bombs, 0);
});

test('Nova: no limpia núcleos que aparecen después de la explosión', () => {
  const g = start(makeGame());
  active(g.holes[0], CoreType.NOVA);
  g.detonateNova(g.holes[0], false, 0);
  active(g.holes[1], CoreType.STANDARD);
  g.update(0.05);
  assert.notEqual(g.holes[1].state, HoleState.EMPTY);
  assert.equal(g.novaDetonations, 1);
});

test('Aparición progresiva: empieza muy lenta y acelera hasta el intervalo mínimo', () => {
  const g = start(makeGame());
  near(g.currentSpawnInterval(), BALANCE.spawn.startInterval);
  assert.ok(g.currentSpawnInterval() > 1, 'el primer núcleo debe tardar más de 1 s');
  g.run.elapsed = BALANCE.spawn.rampSeconds / 2;
  const mid = g.currentSpawnInterval();
  assert.ok(mid < BALANCE.spawn.startInterval && mid > BALANCE.spawn.minInterval);
  g.run.elapsed = BALANCE.spawn.rampSeconds;
  near(g.currentSpawnInterval(), BALANCE.spawn.minInterval);
  assert.ok(BALANCE.spawn.minInterval < 0.5, 'el ritmo final debe ser rápido');
});

test('Nova: daña al jefe sin otorgar voltaje por el golpe de jefe', () => {
  const g = start(makeGame(), {}, { bossMode: true });
  const hp = g.boss.hp;
  g.damageBoss(BALANCE.boss.novaDamage);
  assert.equal(g.boss.hp, hp - BALANCE.boss.novaDamage * g.bossDamageMultiplier);
  const v = g.voltage;
  g.handlePointerHole(g.holes[g.boss.holeIndex]);
  near(g.voltage, v);
});

// ---------- Economía y catálogo ----------

test('Economía: créditos = floor(score/10) y costes base escalados ×10', () => {
  const g = start(makeGame());
  g.score.score = 5000;
  g.endCycle();
  assert.equal(g.creditsGained, 500);
  assert.equal(ABILITIES[0].cost, 400);
  assert.equal(CHIPS_EXTRA[0].cost, 13000);
  assert.equal(CURSORS.find(c => c.id === 'tesla').cost, 8000);
  near(abilityCost(ABILITIES[0], 0), 400);
  near(abilityCost(ABILITIES[0], 1), 640);
});

test('Créditos: multiplicadores de desenlace y habilidad se aplican al cierre', () => {
  const g = start(makeGame(), { abilities: { ab_eco: 1, ab_maestro: 1 } },
    { creditMultiplier: 1.1 });
  g.score.score = 1000;
  g.endCycle();
  assert.equal(g.creditsGained, 117); // 1000/10 * 1.1 * 1.02 * 1.05
});

test('Catálogo: 20 habilidades, 5 chips y 10 cursores con efectos únicos', () => {
  assert.equal(ABILITIES.length, 20);
  assert.equal(CHIPS_EXTRA.length, 5);
  assert.equal(CURSORS.length, 10);
  assert.equal(new Set(ABILITIES.map(a => a.id)).size, 20);
  assert.equal(Object.keys(ABILITY_EFFECTS).length, 20);
  assert.equal(Object.keys(CHIP_EFFECTS).length, 5);
  assert.equal(Object.keys(CURSOR_EFFECTS).length, 10);
  assert.ok(CURSORS.every(c => c.skill && c.color));
});

test('20 habilidades: cada modificador se aplica en el ciclo', () => {
  const g = start(makeGame(), {
    abilities: Object.fromEntries(ABILITIES.map(a => [a.id, 1]))
  });
  assert.ok(g.perfectWindow > 0.15);
  assert.ok(g.scoreMultiplier > 1);
  assert.ok(g.voltageMultiplier > 1);
  assert.ok(g.bossDamageMultiplier > 1);
  assert.ok(g.creditAbilityMult > 1);
  assert.ok(g.novaMult > 1);
  assert.ok(g.novaRadiusMult > 1);
});

test('5 chips nuevos: efectos propios sin duplicar IDs', () => {
  const g = start(makeGame(), { chips: CHIPS_EXTRA.map(c => c.id) });
  assert.ok(g.comboShields > 0);
  assert.ok(g.novaMult > 1);
  assert.ok(g.umbralBonus > 0);
  assert.ok(g.voltageMultiplier > 1);
  assert.ok(g.cronoBonus > 0);
});

test('10 cursores: cada uno cambia su modificador de skill', () => {
  for (const c of CURSORS) {
    const g = start(makeGame(), { hammer: c.id, chips: [] });
    assert.equal(g.cursorDef.id, c.id);
    if (c.id !== 'pulso') assert.notEqual(g.perfectWindow, 0.225);
  }
});

test('Modificadores no se filtran entre ciclos', () => {
  const g = start(makeGame(), { chips: ['perfect_window'] });
  const boosted = g.perfectWindow;
  assert.ok(boosted > 0.225);
  g.startCycle({ hammer: 'pulso', chips: [] }, { board: '3x3' });
  near(g.perfectWindow, 0.225);
});

test('Sincronía conserva fracción del combo, pero no lo crea desde cero', () => {
  const s = new ScoreManager();
  s.addCombo(10);
  s.onMiss(0.1);
  assert.equal(s.combo, 1);
  const t = new ScoreManager();
  t.onMiss(0.1);
  assert.equal(t.combo, 0);
});

test('Doble Toque usa el PRNG y suma una réplica de medio valor', () => {
  const g = start(makeGame(), { abilities: { ab_doble: 3 } });
  g.rng = () => 0;
  const h = active(g.holes[0], CoreType.STANDARD);
  g.handlePointerHole(h);
  assert.ok(g.popups.some(p => p.text.includes('DOBLE')));
});

test('Instrumentación: latencia input → inicio del SFX se registra', () => {
  const g = start(makeGame());
  g.input = { lastEventLatency: 0, lastPointerTime: 100 };
  g.audio = new Proxy({ lastSfxAt: 100.7 }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  g.handlePointerHole(active(g.holes[0], CoreType.STANDARD));
  near(g.lastAudioLatency, 0.7);
  assert.ok(g.lastAudioLatency < 100);
});
