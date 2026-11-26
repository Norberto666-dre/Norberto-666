// Catálogo ampliado: 20 habilidades, 5 Chips nuevos y 10 Cursores.
// Todos los valores son iniciales y ajustables desde un único sitio.
// Costes escalados ×10 para acompañar la economía créditos = puntuación / 10.

export function abilityCost(def, level) {
  return Math.round(def.cost * Math.pow(def.growth, level));
}

// `how` explica cuándo actúa la mejora, `tip` da una pauta táctica y
// `synergy` señala la combinación natural dentro del árbol.
export const ABILITIES = [
  { id: 'ab_pulso', name: 'Pulso Rápido', cost: 400, growth: 1.6, max: 5,
    desc: '+4% ventana Perfecto / NV',
    how: 'Pasiva: ensancha el margen de tiempo para registrar un golpe Perfecto.',
    tip: 'Golpea en cuanto el núcleo se active; con más ventana, los rápidos dejan de escaparse.',
    synergy: 'Se apila con Umbral Perfecto para encadenar perfectos sin pausa.' },
  { id: 'ab_mira', name: 'Mira Láser', cost: 1200, growth: 1.6, max: 5,
    desc: '+5% puntuación / NV',
    how: 'Pasiva: multiplica los puntos de cada golpe durante toda la run.',
    tip: 'Rinde más cuanto más alto es tu combo: no la compres si vas a jugar a lo seguro.',
    synergy: 'Suma con Núcleo Denso y Sector Abierto.' },
  { id: 'ab_doble', name: 'Doble Toque', cost: 3000, growth: 1.7, max: 3,
    desc: '+8% probabilidad de golpe doble / NV',
    how: 'Pasiva: algunos golpes se registran dos veces y añaden medio valor extra.',
    tip: 'El doble golpe también sube el combo, así que busca núcleos encadenados.',
    synergy: 'Brilla junto a Mira Láser y Cadena.' },
  { id: 'ab_sincronia', name: 'Sincronía', cost: 8000, growth: 1.7, max: 3,
    desc: 'Conserva 10% del combo al fallar / NV',
    how: 'Pasiva: al fallar conservas una fracción del combo en lugar de perderlo entero.',
    tip: 'Clave en tableros grandes, donde un fallo tonto puede costar un multiplicador alto.',
    synergy: 'Con Paso Fantasma puedes fallar una vez por ciclo sin reiniciar el combo.' },
  { id: 'ab_denso', name: 'Núcleo Denso', cost: 600, growth: 1.6, max: 5,
    desc: '+8% valor de golpe / NV',
    how: 'Pasiva: cada núcleo vale más puntos al golpearlo.',
    tip: 'Rinde más con multiplicadores altos: úsala cuando ya sostienes combos.',
    synergy: 'Se apila con Mira Láser para subir el valor base.' },
  { id: 'ab_cadena', name: 'Cadena', cost: 1800, growth: 1.7, max: 3,
    desc: '+1 alcance del rayo / NV',
    how: 'Pasiva: el rayo encadenado salta a más núcleos cercanos al golpear.',
    tip: 'Mantén los núcleos agrupados: el salto solo funciona si hay vecinos cerca.',
    synergy: 'Sinergia con chips de clúster y con el cursor Tesla.' },
  { id: 'ab_sobrecarga', name: 'Sobrecarga', cost: 4500, growth: 1.7, max: 4,
    desc: '+10% voltaje ganado / NV',
    how: 'Pasiva: aumenta todo el voltaje que ganas al golpear núcleos.',
    tip: 'Es la defensa pasiva para sostener tableros grandes sin bajar de nivel.',
    synergy: 'Se multiplica con Sifón de Voltaje y Cronómetro.' },
  { id: 'ab_rompe', name: 'Rompejefes', cost: 12000, growth: 1.8, max: 3,
    desc: '+12% puntos al golpear jefes / NV',
    how: 'Pasiva: solo afecta a los golpes que impactan en el núcleo del jefe.',
    tip: 'Guarda el foco para el jefe: cada impacto vale bastante más.',
    synergy: 'Combina con Resonancia Nova para ráfagas de daño.' },
  { id: 'ab_eco', name: 'Generador de Eco', cost: 1000, growth: 1.6, max: 5,
    desc: '+2% créditos al cerrar ciclo / NV',
    how: 'Pasiva: al cerrar cada ciclo recibes un porcentaje extra de créditos.',
    tip: 'Inversión a largo plazo: se paga sola tras varias runs.',
    synergy: 'Se apila con Núcleo Maestro.' },
  { id: 'ab_memoria', name: 'Memoria Térmica', cost: 3500, growth: 1.7, max: 4,
    desc: '+15 voltaje inicial / NV',
    how: 'Pasiva: empiezas cada ciclo con más voltaje en la barra.',
    tip: 'Da margen para aprender un tablero nuevo o sobrevivir a un jefe agresivo.',
    synergy: 'Con Aegis reduces el desgaste de los primeros segundos.' },
  { id: 'ab_cache', name: 'Caché de Chips', cost: 7000, growth: 1.9, max: 2,
    desc: '+1 slot de Chip / NV',
    how: 'Pasiva: desbloquea una ranura extra para equipar chips en Preparación.',
    tip: 'Más ranuras permiten combinar sinergias en vez de elegir una sola.',
    synergy: 'Rinde con chips de voltaje, clúster y purga.' },
  { id: 'ab_aegis', name: 'Aegis', cost: 1500, growth: 1.6, max: 3,
    desc: 'Ignora 1 núcleo rojo / NV',
    how: 'Pasiva: los primeros núcleos rojos de cada ciclo no te restan voltaje.',
    tip: 'Ideal contra tableros con muchos rojos o contra jefes que los generan.',
    synergy: 'Combina con chips de purga y con Memoria Térmica.' },
  { id: 'ab_cronometro', name: 'Cronómetro', cost: 4000, growth: 1.7, max: 3,
    desc: '+4 voltaje en Crono / NV',
    how: 'Pasiva: cada núcleo Crono golpeado te devuelve voltaje adicional.',
    tip: 'No dejes escapar los Crono: son tu recarga durante la partida.',
    synergy: 'Con Sobrecarga cada Crono vale aún más.' },
  { id: 'ab_escudo_nv', name: 'Escudo Nova', cost: 9000, growth: 1.8, max: 4,
    desc: '+10% pago de Nova / NV',
    how: 'Pasiva: las tres ondas de Nova pagan más por cada núcleo que barren.',
    tip: 'Lanza Nova con la tabla cargada: las ondas premian la densidad de núcleos.',
    synergy: 'Resonancia Nova y Escudo Nova son el combo de limpieza.' },
  { id: 'ab_sector', name: 'Sector Abierto', cost: 25000, growth: 2.0, max: 3,
    desc: '+5% puntuación / NV',
    how: 'Pasiva: multiplica la puntuación de toda la run.',
    tip: 'Cara, pero determinante cuando ya haces runs largas.',
    synergy: 'Se apila con Mira Láser y Núcleo Maestro.' },
  { id: 'ab_fantasma', name: 'Paso Fantasma', cost: 11000, growth: 1.8, max: 2,
    desc: 'Un fallo no rompe el combo por ciclo',
    how: 'Pasiva: el primer fallo de cada ciclo no reinicia el combo.',
    tip: 'Puedes arriesgar golpes rápidos sabiendo que tienes una red de seguridad.',
    synergy: 'Con Sincronía conservas todavía más combo tras el fallo.' },
  { id: 'ab_sifon', name: 'Sifón de Voltaje', cost: 14000, growth: 1.8, max: 3,
    desc: '+15% voltaje de todas las fuentes / NV',
    how: 'Pasiva: multiplica todo el voltaje ganado, no solo el de los golpes.',
    tip: 'La mejor defensa pasiva para tableros grandes y runs profundas.',
    synergy: 'Se apila con Sobrecarga y Cronómetro.' },
  { id: 'ab_umbral', name: 'Umbral Perfecto', cost: 17000, growth: 1.9, max: 3,
    desc: '+20% ventana con combo ≥10 / NV',
    how: 'Pasiva: cuando el combo llega a 10, la ventana Perfecto se ensancha.',
    tip: 'Mantén el combo por encima de 10 para que el efecto no se apague.',
    synergy: 'Con Pulso Rápido y Sincronía aciertas casi todo.' },
  { id: 'ab_resonancia', name: 'Resonancia Nova', cost: 20000, growth: 1.9, max: 3,
    desc: '+15% radio de la explosión / NV; anillo extra en NV 3',
    how: 'Pasiva: las ondas de Nova alcanzan más lejos y en NV 3 añaden un anillo extra.',
    tip: 'En tableros grandes cada onda barre más núcleos: úsala antes de que se llenen.',
    synergy: 'Escudo Nova convierte cada onda en puntos.' },
  { id: 'ab_maestro', name: 'Núcleo Maestro', cost: 32000, growth: 2.0, max: 3,
    desc: '+3% puntuación y +5% créditos / NV',
    how: 'Pasiva: mejora a la vez la puntuación y la economía al cerrar ciclo.',
    tip: 'Compra al final del árbol: el coste es alto, pero el efecto es global.',
    synergy: 'Con Eco y Sector Abierto maximizas el retorno.' }
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
