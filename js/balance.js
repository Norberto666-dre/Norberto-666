// Valores iniciales del nuevo bucle. Fuente única de verdad; ajustables sin tocar la lógica.
export const BALANCE = {
  voltage: {
    max: 100,
    start: 100,
    drainPerSec: 3.0,
    drainPerSector: 0.4,
    bossDrainMult: 0.8,
    rearmBelow: 95,
    maxTier: 5,
    gain: { normal: 2, perfect: 3, connected: 4, boss: 0, crono: 4, nova: 6 },
    red: { drainPerSec: 5, tapPenalty: 8, escapePenalty: 10, tapCombo: 1, tapComboLinked: 2, dragThresholdPx: 60 },
    freezeSeconds: 5
  },
  credits: { perScore: 0.1 },
  run: { maxCycles: 999, bossEvery: 5, bossKillScore: 5000 },
  boss: {
    hp: { golem: 300, mirror: 260, prisma: 240, crio: 220, sobrecarga: 280 },
    damagePerHit: 30,
    teleportEvery: 3,
    vanishSeconds: 0.25,
    arriveSeconds: 0.4,
    novaDamage: 60
  },
  links: {
    clusterChanceBase: 0.34,
    clusterChancePerSector: 0.03,
    maxSize: 3,
    trapWindow: 1.2,
    trappedLifeBonus: 0.6,
    comboPerExtra: 1,
    bonusPerCore: 60
  },
  nova: {
    // Nova es una sola explosión: paga el valor real de los núcleos que elimina.
    coreValues: { standard: 100, crono: 200, bomb: 50, nova: 300, white: 500 },
    hitStop: 0.12,
    shake: 18,
    flash: 0.55
  },
  spawn: {
    // Aparición progresiva: de un núcleo lento a varios rápidos a lo largo de la run.
    startInterval: 2.2,
    minInterval: 0.35,
    rampSeconds: 180
  },
  whiteCore: {
    minCombo: 5,
    maxVoltage: 60,
    scoreBonus: 500
  },
  comboMilestones: [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500,
    600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
};

// Multiplicador por hitos de combo. El primer golpe vale ×1; los hitos son escalones.
export function comboMultiplier(combo) {
  const c = Math.max(0, Math.floor(Number(combo) || 0));
  if (c < 5) return 1;
  if (c < 10) return 1.5;
  if (c < 20) return 2;
  if (c < 30) return 3;
  if (c < 40) return 4;
  if (c < 50) return 5;
  if (c < 100) return 5 + Math.floor((c - 40) / 10) * 0.5;
  if (c < 1000) return 8 + Math.floor((c - 100) / 100) * 5;
  if (c < 10000) return 55 + Math.floor((c - 1000) / 1000) * 10;
  return 145 + Math.floor((c - 10000) / 1000) * 10;
}

// Siguiente hito para el HUD (o null si ya se alcanzó el máximo).
export function nextComboMilestone(combo) {
  return BALANCE.comboMilestones.find(m => m > combo) || null;
}

export const BOARDS = [
  { id: '3x3', cols: 3, rows: 3, unlockScore: 0, label: '3×3' },
  { id: '4x3', cols: 4, rows: 3, unlockScore: 100000, label: '4×3' },
  { id: '5x4', cols: 5, rows: 4, unlockScore: 1000000, label: '5×4' }
];

export function boardById(id) {
  return BOARDS.find(b => b.id === id) || BOARDS[0];
}
