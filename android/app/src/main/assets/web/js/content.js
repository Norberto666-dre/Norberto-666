// Catálogo ampliado: 20 habilidades, 5 Chips nuevos y 10 Cursores.
// Todos los valores son iniciales y ajustables desde un único sitio.
// Costes escalados ×10 para acompañar la economía créditos = puntuación / 10.

export function abilityCost(def, level) {
  return Math.round(def.cost * Math.pow(def.growth, level));
}

export const ABILITIES = [
  { id: 'ab_pulso', name: 'Pulso Rápido', cost: 400, growth: 1.6, max: 5, desc: '+4% ventana Perfecto / NV' },
  { id: 'ab_mira', name: 'Mira Láser', cost: 1200, growth: 1.6, max: 5, desc: '+5% puntuación / NV' },
  { id: 'ab_doble', name: 'Doble Toque', cost: 3000, growth: 1.7, max: 3, desc: '+8% probabilidad de golpe doble / NV' },
  { id: 'ab_sincronia', name: 'Sincronía', cost: 8000, growth: 1.7, max: 3, desc: 'Conserva 10% del combo al fallar / NV' },
  { id: 'ab_denso', name: 'Núcleo Denso', cost: 600, growth: 1.6, max: 5, desc: '+8% valor de golpe / NV' },
  { id: 'ab_cadena', name: 'Cadena', cost: 1800, growth: 1.7, max: 3, desc: '+1 alcance del rayo / NV' },
  { id: 'ab_sobrecarga', name: 'Sobrecarga', cost: 4500, growth: 1.7, max: 4, desc: '+10% voltaje ganado / NV' },
  { id: 'ab_rompe', name: 'Rompejefes', cost: 12000, growth: 1.8, max: 3, desc: '+12% puntos al golpear jefes / NV' },
  { id: 'ab_eco', name: 'Generador de Eco', cost: 1000, growth: 1.6, max: 5, desc: '+2% créditos al cerrar ciclo / NV' },
  { id: 'ab_memoria', name: 'Memoria Térmica', cost: 3500, growth: 1.7, max: 4, desc: '+15 voltaje inicial / NV' },
  { id: 'ab_cache', name: 'Caché de Chips', cost: 7000, growth: 1.9, max: 2, desc: '+1 slot de Chip / NV' },
  { id: 'ab_aegis', name: 'Aegis', cost: 1500, growth: 1.6, max: 3, desc: 'Ignora 1 núcleo rojo / NV' },
  { id: 'ab_cronometro', name: 'Cronómetro', cost: 4000, growth: 1.7, max: 3, desc: '+4 voltaje en Crono / NV' },
  { id: 'ab_escudo_nv', name: 'Escudo Nova', cost: 9000, growth: 1.8, max: 4, desc: '+10% pago de Nova / NV' },
  { id: 'ab_sector', name: 'Sector Abierto', cost: 25000, growth: 2.0, max: 3, desc: '+5% puntuación / NV' },
  { id: 'ab_fantasma', name: 'Paso Fantasma', cost: 11000, growth: 1.8, max: 2, desc: 'Un fallo no rompe el combo por ciclo' },
  { id: 'ab_sifon', name: 'Sifón de Voltaje', cost: 14000, growth: 1.8, max: 3, desc: '+15% voltaje de todas las fuentes / NV' },
  { id: 'ab_umbral', name: 'Umbral Perfecto', cost: 17000, growth: 1.9, max: 3, desc: '+20% ventana con combo ≥10 / NV' },
  { id: 'ab_resonancia', name: 'Resonancia Nova', cost: 20000, growth: 1.9, max: 3, desc: '+15% radio de la explosión / NV; anillo extra en NV 3' },
  { id: 'ab_maestro', name: 'Núcleo Maestro', cost: 32000, growth: 2.0, max: 3, desc: '+3% puntuación y +5% créditos / NV' }
];

// Cada habilidad muta el modificador correspondiente del Game.
export const ABILITY_EFFECTS = {
  ab_pulso: (g, l) => { g.perfectWindow *= 1 + 0.04 * l; },
  ab_mira: (g, l) => { g.scoreMultiplier += 0.05 * l; },
  ab_doble: (g, l) => { g.doubleTapChance += 0.08 * l; },
  ab_sincronia: (g, l) => { g.comboKeep += 0.10 * l; },
  ab_denso: (g, l) => { g.scoreMultiplier += 0.08 * l; },
  ab_cadena: (g, l) => { g.chainRange += l; },
  ab_sobrecarga: (g, l) => { g.voltageMultiplier *= 1 + 0.10 * l; },
  ab_rompe: (g, l) => { g.bossDamageMultiplier *= 1 + 0.12 * l; },
  ab_eco: (g, l) => { g.creditAbilityMult += 0.02 * l; },
  ab_memoria: (g, l) => { g.startVoltage += 15 * l; },
  ab_cache: (g, l) => { g.chipSlots += l; },
  ab_aegis: (g, l) => { g.bombIgnoresLeft += l; },
  ab_cronometro: (g, l) => { g.cronoBonus += 0.5 * l; },
  ab_escudo_nv: (g, l) => { g.novaMult += 0.10 * l; },
  ab_sector: (g, l) => { g.scoreMultiplier += 0.05 * l; },
  ab_fantasma: (g, l) => { if (l > 0) g.comboShields += 1; },
  ab_sifon: (g, l) => { g.voltageMultiplier *= 1 + 0.15 * l; },
  ab_umbral: (g, l) => { g.umbralBonus += 0.20 * l; },
  ab_resonancia: (g, l) => { g.novaRadiusMult += 0.15 * l; if (l >= 3) g.novaExtraRing = true; },
  ab_maestro: (g, l) => { g.scoreMultiplier += 0.03 * l; g.creditAbilityMult += 0.05 * l; }
};

export const CHIPS_EXTRA = [
  { id: 'combo_guard', label: 'GUARDIA COMBO', cost: 13000, desc: 'Un fallo no rompe el combo' },
  { id: 'nova_surge', label: 'SURGE NOVA', cost: 16000, desc: '+25% pago Nova y anillo extra' },
  { id: 'shadow_step', label: 'PASO UMBRÍO', cost: 19000, desc: '+25% ventana con combo ≥10' },
  { id: 'voltage_siphon', label: 'SIFÓN VOLTAJE', cost: 22000, desc: '+15% voltaje de todas las fuentes' },
  { id: 'chrono_loop', label: 'BUCLE CRONO', cost: 26000, desc: '+1.5 s y +10% puntos Crono' }
];

export const CHIP_EFFECTS = {
  combo_guard: g => { g.comboShields += 1; },
  nova_surge: g => { g.novaMult += 0.25; g.novaExtraRing = true; },
  shadow_step: g => { g.umbralBonus += 0.25; },
  voltage_siphon: g => { g.voltageMultiplier *= 1.15; },
  chrono_loop: g => { g.cronoBonus += 1.5; g.cronoScoreMult += 0.10; }
};

export const CURSORS = [
  { id: 'pulso', name: 'PULSO', color: '#00f3ff', trail: 'ring', cost: 0, unlock: 'free', skill: 'Ventana Perfecto ×1.5' },
  { id: 'tesla', name: 'TESLA', color: '#cc00ff', trail: 'arc', cost: 8000, unlock: 'shop', skill: 'Rayo de 2º anillo + voltaje ×1.5' },
  { id: 'aegis', name: 'AEGIS', color: '#ffcc00', trail: 'shield', cost: 15000, unlock: 'shop', skill: 'Ignora el primer núcleo rojo' },
  { id: 'cronos', name: 'CRONOS', color: '#b066ff', trail: 'clock', cost: 22000, unlock: 'shop', skill: '+1 s en núcleos Crono' },
  { id: 'nova', name: 'NOVA', color: '#ff8a00', trail: 'star', cost: 0, unlock: 'boss2', skill: '+10% pago Nova' },
  { id: 'prisma', name: 'PRISMA', color: '#ff40d0', trail: 'mirror', cost: 0, unlock: 'boss3', skill: '+8% en golpes reflejados' },
  { id: 'criogenico', name: 'CRIOGÉNICO', color: '#8ff6ff', trail: 'frost', cost: 0, unlock: 'boss4', skill: 'Hielo 25% más corto' },
  { id: 'nucleo', name: 'NÚCLEO', color: '#ffffff', trail: 'halo', cost: 0, unlock: 'prestige', skill: '+20% puntos al golpear jefes' },
  { id: 'fantasma', name: 'FANTASMA', color: '#7b8cff', trail: 'ghost', cost: 32000, unlock: 'shop', skill: 'Un fallo no rompe el combo' },
  { id: 'overclock', name: 'OVERCLOCK', color: '#ff3355', trail: 'rainbow', cost: 50000, unlock: 'shop', skill: '+10% duración de núcleos, −10% telegrafía' }
];

export const CURSOR_EFFECTS = {
  pulso: g => { g.perfectWindow *= 1.5; },
  tesla: g => { g.voltageMultiplier *= 1.5; g.chainRange = Math.max(g.chainRange, 2); },
  aegis: g => { g.bombIgnoresLeft += 1; },
  cronos: g => { g.cronoBonus += 1; },
  nova: g => { g.novaMult += 0.10; },
  prisma: g => { g.reflectBonus += 0.08; },
  criogenico: g => { g.freezeReduction = true; },
  nucleo: g => { g.bossDamageMultiplier *= 1.2; },
  fantasma: g => { g.comboShields += 1; },
  overclock: g => { g.holeLifetimeMult *= 1.10; g.telegraphScale *= 0.90; }
};

export function cursorById(id) {
  return CURSORS.find(c => c.id === id) || CURSORS[0];
}
