import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CoreType, HoleState, SCREEN } from '../js/game.js';
import { BALANCE } from '../js/balance.js';

const audioStub = new Proxy({}, { get: () => () => {} });
const makeGame = () => {
  const g = new Game({ audio: audioStub, input: {}, renderer: {} });
  g.setCanvasSize(390, 844);
  return g;
};
const active = (hole, core = CoreType.STANDARD, linkId = 0) => {
  hole.reset();
  hole.state = HoleState.ACTIVE;
  hole.core = core;
  hole.timer = 0;
  hole.lifetime = 10;
  hole.telegraphTime = 0.3;
  hole.linkId = linkId;
  return hole;
};
const advance = (g, seconds, step = 0.05) => {
  for (let t = 0; t < seconds - 1e-9; t += step) g.update(Math.min(step, seconds - t));
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Ordinal 22 => rotación[1] = mirror; bossEvery = 5 => 110 ciclos; nivel 3 al completar dos vueltas.
const startMirrorNv3 = () => {
  const g = makeGame();
  const run = {
    ...g.freshRun(),
    tier: 3,
    cyclesDone: 22 * BALANCE.run.bossEvery,
    nextBoss: true
  };
  g.startCycle({}, {
    board: '5x4',
    continueRun: true,
    run,
    bossType: 'mirror',
    sector: 2
  });
  g.holes.forEach(h => { if (h.index !== g.boss.holeIndex) h.reset(); });
  g.links = [];
  g.linkSeq = 0;
  g.spawnTimer = 10;
  return g;
};

test('Estrés A3: 5×4 con Espejo NV3 mantiene 20 hoyos y estado consistente', () => {
  const g = startMirrorNv3();
  assert.equal(g.screen, SCREEN.PLAYING);
  assert.equal(g.boardId, '5x4');
  assert.equal(g.holes.length, 20);
  assert.equal(g.centerIndex(), 12);
  assert.equal(g.boss.type, 'mirror');
  assert.equal(g.boss.level, 3);
  assert.equal(
    g.boss.maxHp,
    Math.round(BALANCE.boss.hp.mirror * (1 + 2 * BALANCE.boss.levelHpStep))
  );
  assert.equal(g.holes[g.boss.holeIndex].core, CoreType.BOSS);

  const snap = g.getResumeState();
  assert.equal(snap.options.bossType, 'mirror');
  assert.equal(snap.boss.level, 3);
  assert.equal(snap.holes.length, 20);
  advance(g, 2);
  near(g.elapsed, 2);
});

test('Estrés A3: inversión del Espejo genera rojos y responde al chip espejo', () => {
  const g = startMirrorNv3();
  g.boss.invertTimer = 0;
  g.update(0.05);
  assert.equal(g.boss.invertJustStarted, true);
  assert.equal(g.boss.invertRemaining, 3);

  g.rng = () => 0;
  g.trySpawn();
  assert.ok(g.holes.some(h => h.core === CoreType.BOMB && h.state !== HoleState.EMPTY));

  // El chip espejo neutraliza el efecto en render, sin alterar la lógica de spawns.
  g.loadout = { ...g.loadout, chips: ['mirror_core'] };
  g.trySpawn();
  assert.equal(g.boss.type, 'mirror');
  assert.ok(g.boss.invertRemaining > 0);
});

test('Estrés A3: clúster, rojo y subida de peldaño coexisten sin perder el jefe', () => {
  const g = startMirrorNv3();
  const primary = active(g.holes[1], CoreType.STANDARD);
  g.spawnLinkedCluster(primary, 1.4, 0.3);
  assert.equal(g.links.length, 1);
  const group = g.links[0];
  assert.ok(group.indices.length >= 2);
  assert.equal(g.holes[group.indices[1]].linkId, group.id);

  const red = active(g.holes[3], CoreType.BOMB);
  g.purgeRed(red);
  assert.ok(g.voltage > 0);

  g.voltage = 50;
  g.voltageArmed = true;
  g.addVoltage(50);
  assert.equal(g.voltageTier, 4);
  assert.equal(g.voltageArmed, false);
  near(g.voltage, BALANCE.voltage.max * BALANCE.voltage.tierRefill);
  assert.equal(g.holes[g.boss.holeIndex].core, CoreType.BOSS);
});

test('Estrés A3: la instantánea restaura jefe NV3, inversión y 20 hoyos', () => {
  const g = startMirrorNv3();
  g.boss.invertTimer = 0;
  g.update(0.05);
  const snap = g.getResumeState();

  const restored = makeGame();
  // applyResumeState necesita el tablero preparado: no cambia cols/rows por sí solo.
  restored.setBoard('5x4');
  restored.applyResumeState(snap);
  assert.equal(restored.boss.type, 'mirror');
  assert.equal(restored.boss.level, 3);
  assert.equal(restored.boss.invertRemaining, g.boss.invertRemaining);
  assert.equal(restored.holes.length, 20);
  assert.equal(restored.holes[restored.boss.holeIndex].core, CoreType.BOSS);
});
