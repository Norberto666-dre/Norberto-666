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

// ============================================================================
// 10 HABILIDADES ADICIONALES (ab_11 a ab_20)
// ============================================================================

const MORE_ABILITIES = [
  { id: 'ab_overdrive', name: 'Sobrecarga Térmica', cost: 40000, growth: 2.0, max: 3,
    desc: '+15% daño a jefes y +10% voltaje por golpe / NV',
    how: 'Pasiva: aumenta el daño infligido a jefes y el voltaje ganado al golpear cualquier núcleo.',
    tip: 'Ideal para runs largas contra jefes de sector alto.',
    synergy: 'Se apila con Rompejefes y Escudo Nova.' },
  { id: 'ab_echo', name: 'Eco Resonante', cost: 35000, growth: 2.0, max: 3,
    desc: '+10% créditos por ciclo y +1 slot de chip pasivo / NV',
    how: 'Pasiva: mejora la economía al cerrar cada ciclo y amplía la capacidad de chips.',
    tip: 'Compra temprano para amortizar el coste a lo largo de la campaña.',
    synergy: 'Combina con Generador de Eco y Caché de Chips.' },
  { id: 'ab_foco', name: 'Foco Láser', cost: 28000, growth: 1.9, max: 3,
    desc: '+30% ventana Perfecto con combo ≥20 / NV',
    how: 'Pasiva: cuando el combo supera 20, la ventana de golpe Perfecto se ensancha notablemente.',
    tip: 'Mantén el combo alto para activar el beneficio constante.',
    synergy: 'Suma con Pulso Rápido y Umbral Perfecto.' },
  { id: 'ab_estasis', name: 'Estasis Crono', cost: 30000, growth: 1.9, max: 3,
    desc: '+2 s de duración en núcleos Crono y +15% puntos / NV',
    how: 'Pasiva: los núcleos Crono permanecen más activos y otorgan más puntos.',
    tip: 'Prioriza golpear Crono antes que expiren.',
    synergy: 'Con Bucle Crono y Cronómetro maximizas el control del tiempo.' },
  { id: 'ab_aura', name: 'Aura de Voltaje', cost: 45000, growth: 2.0, max: 3,
    desc: '+20% voltaje inicial y regeneración pasiva +0.3 V/s / NV',
    how: 'Pasiva: empieza cada ciclo con más voltaje y lo regenera lentamente con el tiempo.',
    tip: 'Da margen de error contra jefes agresivos y tableros con muchos rojos.',
    synergy: 'Con Memoria Térmica y Sifón de Voltaje eres casi inmortal al drenaje.' },
  { id: 'ab_rifle', name: 'Rifle de Precisión', cost: 25000, growth: 1.8, max: 4,
    desc: '+6% puntuación por golpe perfecto encadenado / NV',
    how: 'Pasiva: cada Perfecto consecutivo aumenta el valor del siguiente golpe.',
    tip: 'Encadena perfectos sin fallar para ver crecer el multiplicador.',
    synergy: 'Con Foco Láser y Pulso Rápido es devastador.' },
  { id: 'ab_orbit', name: 'Órbita de Chips', cost: 50000, growth: 2.1, max: 2,
    desc: 'Los chips activos aplican su efecto dos veces por ciclo / NV',
    how: 'Pasiva: duplicar la activación de efectos de chips equipados durante una run.',
    tip: 'Equipa chips de voltaje o Nova para aprovechar el doble efecto.',
    synergy: 'Con Sifón Voltaje y Surge Nova multiplica el beneficio.' },
  { id: 'ab_furia', name: 'Furia de Combo', cost: 22000, growth: 1.8, max: 4,
    desc: '+1% multiplicador de combo por cada 10 de combo / NV',
    how: 'Pasiva: el multiplicador de combo crece ligeramente más rápido a medida que sube el combo.',
    tip: 'Cuanto más alto el combo, más vale cada golpe siguiente.',
    synergy: 'Con Paso Fantasma y Sincronía proteges el combo alto.' },
  { id: 'ab_void', name: 'Vacío Estelar', cost: 60000, growth: 2.2, max: 2,
    desc: 'Nova elimina también rojos sin penalizar combo y paga ×1.5 / NV',
    how: 'Pasiva: las ondas de Nova purgan núcleos rojos como si fueran normales y pagan más.',
    tip: 'Úsala en tableros llenos de rojos para limpiar sin romper el combo.',
    synergy: 'Con Escudo Nova y Surge Nova es el combo de limpieza definitiva.' },
  { id: 'ab_prisma', name: 'Prisma Reflejo', cost: 38000, growth: 1.9, max: 3,
    desc: '+12% puntos en golpes reflejados y +1 objetivo de rayo / NV',
    how: 'Pasiva: mejora los golpes que rebotan y extiende el alcance del rayo encadenado.',
    tip: 'Ideal con el cursor Prisma y chips de cadena.',
    synergy: 'Con Cadena y Doble Toque crea reacciones en cadena masivas.' }
];

ABILITIES.push(...MORE_ABILITIES);

MORE_ABILITIES.forEach(def => {
  ABILITY_EFFECTS[def.id] = (g, l) => {
    switch (def.id) {
      case 'ab_overdrive':
        g.bossDamageMultiplier *= 1 + 0.15 * l;
        g.voltageMultiplier *= 1 + 0.10 * l;
        break;
      case 'ab_echo':
        g.creditAbilityMult += 0.10 * l;
        g.chipSlots += l;
        break;
      case 'ab_foco':
        g.umbralBonus += 0.30 * l;
        break;
      case 'ab_estasis':
        g.cronoBonus += 2 * l;
        g.cronoScoreMult += 0.15 * l;
        break;
      case 'ab_aura':
        g.startVoltage += 20 * l;
        g.voltageRegen += 0.3 * l;
        break;
      case 'ab_rifle':
        g.perfectChainBonus += 0.06 * l;
        break;
      case 'ab_orbit':
        g.chipDoubleProc += l;
        break;
      case 'ab_furia':
        g.comboGrowthBonus += 0.01 * l;
        break;
      case 'ab_void':
        g.novaClearsBombs = true;
        g.novaBombMult = 1.5;
        break;
      case 'ab_prisma':
        g.reflectBonus += 0.12 * l;
        g.chainRange += l;
        break;
    }
  };
});

// ============================================================================
// 10 CHIPS ADICIONALES (en CHIPS_EXTRA)
// ============================================================================

const MORE_CHIPS = [
  { id: 'chip_overdrive', label: 'OVERDRIVE CHIP', cost: 30000, desc: '+20% daño a jefe, +10% voltaje' },
  { id: 'chip_echo', label: 'ECO CHIP', cost: 28000, desc: '+12% créditos por ciclo' },
  { id: 'chip_foco', label: 'FOCO CHIP', cost: 24000, desc: '+25% ventana con combo ≥20' },
  { id: 'chip_estasis', label: 'ESTASIS CHIP', cost: 26000, desc: '+1.5 s Crono, +12% puntos' },
  { id: 'chip_aura', label: 'AURA CHIP', cost: 34000, desc: '+15% voltaje inicial' },
  { id: 'chip_rifle', label: 'RIFLE CHIP', cost: 20000, desc: '+5% puntuación por Perfecto encadenado' },
  { id: 'chip_orbit', label: 'ÓRBITA CHIP', cost: 40000, desc: 'Chips activan dos veces por ciclo' },
  { id: 'chip_furia', label: 'FURIA CHIP', cost: 18000, desc: 'Combo crece más rápido' },
  { id: 'chip_void', label: 'VACÍO CHIP', cost: 50000, desc: 'Nova purga rojos sin romper combo' },
  { id: 'chip_prisma', label: 'PRISMA CHIP', cost: 30000, desc: '+10% golpes reflejados, +1 rayo' }
];

CHIPS_EXTRA.push(...MORE_CHIPS);

MORE_CHIPS.forEach(chip => {
  CHIP_EFFECTS[chip.id] = g => {
    switch (chip.id) {
      case 'chip_overdrive': g.bossDamageMultiplier *= 1.20; g.voltageMultiplier *= 1.10; break;
      case 'chip_echo': g.creditAbilityMult += 0.12; break;
      case 'chip_foco': g.umbralBonus += 0.25; break;
      case 'chip_estasis': g.cronoBonus += 1.5; g.cronoScoreMult += 0.12; break;
      case 'chip_aura': g.startVoltage += 15; break;
      case 'chip_rifle': g.perfectChainBonus += 0.05; break;
      case 'chip_orbit': g.chipDoubleProc += 1; break;
      case 'chip_furia': g.comboGrowthBonus += 0.01; break;
      case 'chip_void': g.novaClearsBombs = true; g.novaBombMult = 1.5; break;
      case 'chip_prisma': g.reflectBonus += 0.10; g.chainRange += 1; break;
    }
  };
});

// ============================================================================
// 10 CURSORES ADICIONALES (en CURSORS)
// ============================================================================

const MORE_CURSORS = [
  { id: 'cursor_overdrive', name: 'OVERDRIVE', color: '#ff3355', trail: 'blaze', cost: 40000, unlock: 'shop', skill: 'Daño a jefe +15%, voltaje +10%' },
  { id: 'cursor_echo', name: 'ECO', color: '#00ff9d', trail: 'leaf', cost: 35000, unlock: 'shop', skill: 'Créditos +12% por ciclo' },
  { id: 'cursor_foco', name: 'FOCO', color: '#7b8cff', trail: 'lens', cost: 28000, unlock: 'shop', skill: 'Ventana Perfecto +25% con combo ≥20' },
  { id: 'cursor_estasis', name: 'ESTASIS', color: '#b066ff', trail: 'hourglass', cost: 30000, unlock: 'shop', skill: 'Crono +1.5 s, puntos +12%' },
  { id: 'cursor_aura', name: 'AURA', color: '#ffcc00', trail: 'halo', cost: 38000, unlock: 'shop', skill: 'Voltaje inicial +15%' },
  { id: 'cursor_rifle', name: 'RIFLE', color: '#00f3ff', trail: 'crosshair', cost: 25000, unlock: 'shop', skill: 'Puntuación por Perfecto encadenado +5%' },
  { id: 'cursor_orbit', name: 'ÓRBITA', color: '#ff40d0', trail: 'ring', cost: 45000, unlock: 'shop', skill: 'Chips activan dos veces por ciclo' },
  { id: 'cursor_furia', name: 'FURIA', color: '#ff6a00', trail: 'ember', cost: 22000, unlock: 'shop', skill: 'Combo crece más rápido' },
  { id: 'cursor_void', name: 'VACÍO', color: '#4a148c', trail: 'void', cost: 55000, unlock: 'shop', skill: 'Nova purga rojos sin romper combo' },
  { id: 'cursor_prisma', name: 'PRISMA X', color: '#00ff9d', trail: 'prism', cost: 32000, unlock: 'shop', skill: 'Reflejos +10%, rayo +1 objetivo' }
];

CURSORS.push(...MORE_CURSORS);

MORE_CURSORS.forEach(cursor => {
  CURSOR_EFFECTS[cursor.id] = g => {
    switch (cursor.id) {
      case 'cursor_overdrive': g.bossDamageMultiplier *= 1.15; g.voltageMultiplier *= 1.10; break;
      case 'cursor_echo': g.creditAbilityMult += 0.12; break;
      case 'cursor_foco': g.umbralBonus += 0.25; break;
      case 'cursor_estasis': g.cronoBonus += 1.5; g.cronoScoreMult += 0.12; break;
      case 'cursor_aura': g.startVoltage += 15; break;
      case 'cursor_rifle': g.perfectChainBonus += 0.05; break;
      case 'cursor_orbit': g.chipDoubleProc += 1; break;
      case 'cursor_furia': g.comboGrowthBonus += 0.01; break;
      case 'cursor_void': g.novaClearsBombs = true; g.novaBombMult = 1.5; break;
      case 'cursor_prisma': g.reflectBonus += 0.10; g.chainRange += 1; break;
    }
  };
});

// ============================================================================
// ICONOS SVG POR CÓDIGO PARA CADA CHIP
// Genera un glifo SVG único basado en el id del chip, sin depender de assets externos.
// ============================================================================

const CHIP_ICON_MAP = {
  combo_guard: 'shield',
  nova_surge: 'star-burst',
  shadow_step: 'door',
  voltage_siphon: 'drop',
  chrono_loop: 'cycle',
  chip_overdrive: 'blaze',
  chip_echo: 'leaf',
  chip_foco: 'lens',
  chip_estasis: 'hourglass',
  chip_aura: 'halo',
  chip_rifle: 'crosshair',
  chip_orbit: 'orbit',
  chip_furia: 'ember',
  chip_void: 'void',
  chip_prisma: 'prism'
};

export function chipIcon(id) {
  const shape = CHIP_ICON_MAP[id] || 'chip';
  return `<svg class="chip-icon chip-icon-${id}" viewBox="0 0 24 24" aria-hidden="true">${chipShape(shape)}</svg>`;
}

function chipShape(shape) {
  const common = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  switch (shape) {
    case 'shield': return `<path d="M12 2L3 7v5a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6V7z" ${common}/>`;
    case 'star-burst': return `<path d="M12 3L15 9H9L12 15zM3 12l6 3V21l6-3V3L3 12z" ${common}/>`;
    case 'door': return `<path d="M12 3v18M5 21h14V3H5z" ${common}/>`;
    case 'drop': return `<path d="M12 22c-4 0-7-3-7-7a7 7 0 0 1 14 0c0 4-3 7-7 7z" ${common}/>`;
    case 'cycle': return `<circle cx="12" cy="12" r="9" ${common}/><path d="M12 3v9l3 3" ${common}/>`;
    case 'blaze': return `<path d="M12 2L8 8l4 4L16 8l-4-6z" ${common}/>`;
    case 'leaf': return `<path d="M12 2s-4 4-4 10c0 6 8 10 8-10s4-6 4-10" ${common}/>`;
    case 'lens': return `<circle cx="12" cy="12" r="8" ${common}/><circle cx="12" cy="12" r="4" ${common} stroke-width="1"/>`;
    case 'hourglass': return `<path d="M3 3v6h18V3M3 15v6h18v-6" ${common}/>`;
    case 'halo': return `<circle cx="12" cy="12" r="7" ${common} stroke-width="1.5"/><circle cx="12" cy="5" r="2" ${common} stroke-width="1"/>`;
    case 'crosshair': return `<path d="M12 3v18M3 12h18M18.4 5.6a1.94 1.94 0 0 1 0 2.75L12 14.75l-6.4-6.4a1.94 1.94 0 0 1 0-2.75L12 2.75z" ${common}/>`;
    case 'orbit': return `<circle cx="12" cy="12" r="7" ${common} stroke-width="1"/><path d="M5 12a7 7 0 1 0 14 0z" ${common} stroke-width="0.5"/>`;
    case 'ember': return `<path d="M12 2L15 7H9zM12 22L9 17H15zM2 12l5 3V9L2 12zM22 12l-5 3V9L22 12z" ${common}/>`;
    case 'void': return `<circle cx="12" cy="12" r="7" ${common} stroke-width="3"/><circle cx="12" cy="12" r="3" ${common} stroke-width="1"/>`;
    case 'prism': return `<path d="M12 2L20 12L12 22L4 12z" ${common}/><path d="M12 2V22M4 12H20" ${common} stroke-width="1"/>`;
    default: return `<rect x="9" y="9" width="6" height="6" rx="2" ${common}/>`;
  }
}

