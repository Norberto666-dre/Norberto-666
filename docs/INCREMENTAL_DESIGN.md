# OVERCLOCK 9 — Capa incremental y bomba Nova

**Estado:** propuesta de diseño v2 (refactorización de voltaje-vida, tableros ampliados, Falso Final y jefes móviles). Todos los números son **iniciales** y deben ajustarse con telemetría real (Android gama media + navegador). La fuente única de verdad es `js/balance.js`; este documento explica la intención, no duplica constantes.
**Principio rector:** la habilidad del jugador (Golpes Perfectos, hitos de combo, jefes) es el multiplicador dominante. La capa incremental acorta el camino, nunca lo sustituye.

---

## 1. Bucle y economía

### 1.1 Monedas

| Moneda | Origen | Uso | Persistencia |
|---|---|---|---|
| Créditos (CR) | Cada ciclo arcade | Nodos, Chips, Cursores | Se borra al prestigiar |
| Fragmentos de Núcleo (FN) | Reinicio de Núcleo | Multiplicadores permanentes, ramas nuevas, Sectores | Permanente (empieza en **0**) |
| Chips | Botín de jefes, ciclo diario, hitos | Loadout de 2 (inicial) | Se borra al prestigiar |

### 1.2 Fórmulas base (iniciales, build v2)

**Valor de un golpe**

```
hitValue      = floor(100 × comboStep(combo) × (perfecto ? 2 : 1)
                      × chipMult × cursorMult × voltageTier)
comboStep     = 1 (<5), 1.5 (5–9), 2 (10–19), 3 (20–29), 4 (30–39),
                5 (40–49), 5 + 0.5×floor((combo−40)/10) (50–99), …
voltageTier   = 1…5, se gana llenando la barra y se conserva hasta el final de la run
```

El escalón se calcula **después** de sumar el golpe: el primero vale ×1 y el golpe que alcanza 5 ya vale ×1.5. Los hitos de combo son `5, 10, 20, 30, 40 … 10000` (`BALANCE.comboMilestones`); desde 100 el salto es +5 por centena y desde 1000, +10 por mil. Un fallo reinicia el combo; `Fantasma` y `Sincronía` solo conservan una fracción.

**Voltaje-vida**

```
drena/s       = (3.0 + 0.4×(sector−1)) × (jefeVivo ? 0.8 : 1)
                + 5 × núcleosRojosActivos
ganancia      = normal 2 / Perfecto 3 / enlazado 4 / rojo 0 / jefe 0
subirTier     = Voltage=100 y rearmado por debajo de 95 (una vez por llenado)
                → Voltage=15 (15 % de margen) y tier++ hasta ×5
vaciarse      = Voltage=0 → tier-- y Voltage=15 (margen): ×3→×2→×1→0
fin           = Voltage=0 en ×0 → cierra ciclo o run y liquida puntos
congelación   = Falso Final: 5 s sin drenaje
```

No hay temporizador: el voltaje es simultáneamente recurso, vida y medida de presión. Llenar la barra no reinicia el ciclo; sube un peldaño de multiplicador que se aplica también al botín del jefe. Al subir de peldaño la barra vuelve a `15`, no a `100`. Al vaciarse la barra **no termina de inmediato**: el multiplicador se desincrementa y la barra se recarga al mismo `15 %` de margen (`×3 → ×2 → ×1 → 0`); solo al vaciarse en `×0` termina el ciclo o la run y se liquidan los puntos.

**Cierre de ciclo y run**

```
hitValue    = 20 (estándar/rojo/jefe) · 40 (Crono) · 60 (Nova) · 100 (blanco) × multiplicadores
cycleScore  = Σ hitValue + bonoJefe + bonoNova + bonoFalsoFinal
bonoJefe    = 5000 × comboStep × voltageTier        // un jefe cada 5 ciclos, dentro de 999
bonoNova    = Σ valor real de los núcleos eliminados por una sola explosión
bonoBlanco  = 100 × comboStep × voltageTier         // una vez por ciclo

creditos    = floor(cycleScore × 0.1)
            × nodeCreditMult
            × (desenlaceAceptado ? 1.10 : 1)
            × (1 + 0.08 × fragmentos)
```

**Tableros y comparabilidad**

| Tablero | Desbloqueo (mejor score global en una run) | Uso previsto |
|---|---:|---|
| `3×3` | 0 | Diario forzado; menguante y comparación pura |
| `4×3` | 100 000 | Preferido en teléfono/Android |
| `5×4` | 1 000 000 | Máxima visibilidad en móvil; Nova y clústers lucen aquí |

El Diario además fuerza `pulso / sin chips / sin mejoras / sin habilidades`, sin jefe y sin núcleo blanco, con semilla derivada de la fecha. Es **una sola run oficial por fecha**: al terminar se publica la puntuación y el botón de reintento se sustituye por la tabla. La campaña queda como espacio de práctica y récords locales; no hay modo infinito.

### 1.3 HUD, pausa y tabla diaria

| Elemento | Intención | Criterio de salida |
|---|---|---|
| HUD diegético | Cabina/terminal: `puntos → combo → voltaje → contexto`. Iconos SVG inline para reducir texto; la barra incluye la escalera `×1…×5` con el peldaño activo iluminado. Chips/jefe/congelación/reglas aparecen solo cuando aplican. | En `390×844` y escritorio se leen los cuatro bloques sin solapes; el botón de pausa es alcanzable con el pulgar. |
| Desincrementación legible | Al vaciarse, la barra se llena durante `0,6 s` con el multiplicador perdido (`×3 → ×2`) y después vuelve al margen del 15 %. Es un flash visual: la economía y la regla `×3 → ×2 → ×1 → 0` no cambian. | Se ve el peldaño anterior antes de que la barra vuelva al 15 % y la run sigue viva hasta vaciarse en `×0`. |
| Menú compacto | Dos acciones principales y una fila de cinco accesos rápidos con icono; `CONTINUAR` sustituye a `CAMPAÑA` cuando hay partida guardada, que pasa a ser `NUEVA CAMPAÑA`. | Todas las funciones siguen accesibles con el mismo número de toques o menos, sin desbordamiento en `390×844`. |
| Pausa con guardado | `Esc` o el botón del HUD capturan `Game.getResumeState()` (run, ciclo, voltaje, hoyos, jefe, carga y opciones) y lo escriben en el datasave antes de mostrar el overlay. | Salir en pausa y pulsar **CONTINUAR PARTIDA** restaura el mismo ciclo, no una run nueva. |
| Tabla diaria | `datasave` para la columna offline; endpoint configurable con token para la columna mundial. Sin red se sirve caché y se encola la publicación. | La mejor run de cualquier usuario se muestra sin backend real; al configurar la URL se publica y sincroniza la cola. |
| CRUD de cuentas | Alta con foto opcional; lectura en tarjetas del launcher; edición de nombre/color/foto/contraseña; baja con doble confirmación. Toda mutación exige la contraseña actual. | Editar una cuenta cambia su tarjeta y su save sin afectar a otras; eliminar borra manifest, archivo, cachés y sesión activa. |
| Foto de perfil | Se recorta a `192×192` en canvas y se embebe como JPEG (≤`96 KB`) en el manifest; se validan MIME, firma binaria y tamaño antes de persistir. | La foto se ve en launcher y menú; un data URL inválido o demasiado grande se descarta sin romper el manifest. |

**Resonancia Nova (bomba de recompensa)**

| Parámetro | Valor inicial | Nota |
|---|---|---|
| Disparo | Una sola explosión | No hay 3 ondas ni pagos `100/60/40 %` |
| Objetivo | Los núcleos vivos en el instante de la explosión | Paga su valor real; no limpia núcleos que aparezcan después |
| Valores iniciales | estándar 20 · crono 40 · rojo 20 · Nova 60 · blanco 100 | Centralizados en `BALANCE.core` y reutilizados por `BALANCE.nova.coreValues` |
| Interacción | No cuenta como bomba, no rompe combo | Carga voltaje y quita el `5 %` de vida al jefe sin dar voltaje por golpe de jefe |
| Efectos | Un anillo con subanillo, destello y estelas | Reutiliza FX del antiguo Overdrive |

**Ritmo de aparición de núcleos**

| Parámetro | Valor inicial | Nota |
|---|---|---|
| Intervalo inicial | `2.2 s` | Muy lento al empezar la run |
| Intervalo mínimo | `0.35 s` | Muy rápido al final de la rampa |
| Rampa | `180 s` | Progreso lineal de la run; se detiene en el mínimo |
Los valores viven en `BALANCE.spawn` (`kotlin-skeleton/Balance.kt` → `Balance.Spawn`). El objetivo es que la presión suba de forma continua, no que aparezcan muchos núcleos de golpe. Los clústers siguen su propia probabilidad y no se limitan por esta rampa.

**Costes**

```
costeNodo(nivel n)  = base × 1.6^n        (nivel máx. 5)
costeChip(nivel n)  = base × 1.8^n        (nivel máx. 3)
costeCursor(n)      = base × 2^n          (mejora repetible, máx. 4)
fragmentos(prestigio) = floor( sqrt(creditosLifetime / 10000) ) + bonusJefe
bonusJefe = 1 si se batió jefe de sector ≥2 en el ciclo previo
```

**Eco (único ingreso pasivo, deliberadamente débil)**

```
ecoPorSegundo = 0.05 × mejorCicloCR / 30        // 5 % del ritmo activo
ecoOffline    = ecoPorSegundo × min(horas, 4) × 0.50 × eficienciaMemoria
requisito     = nodo Eco I + partida activa en las últimas 24 h
```

Un jugador activo obtiene ≈120 ciclos/hora; el Eco aporta ≈6×mejorCiclo/hora (≈5 %). La habilidad sigue mandando.

### 1.3 Ritmo (recalcibrado con voltaje-vida)

| Horizonte | Estado esperado | Hitos |
|---|---|---|
| Primeros 15 s | Menú → selector de tablero → primer núcleo cian | HUD diegético `V×1 · C1/999`, barra de voltaje visible, texto de arrastre rojo |
| Primera hora | Sectores 1–2, 8–12 ciclos, `V×2`–`V×3` | 4×3 desbloqueado a 100 000, primer jefe móvil, primer Falso Final |
| Primer día | Sector 3, jefe de Espejo batido, 4×3 cómodo | 5×4 desbloqueado a 1 000 000, Nova vista, Eco I |
| Primera semana | Sector 5, Ascensión NV1, run larga hacia 999 | Duelo de sobrecarga, `V×5`, clústers de 3, hitos ≥100 de combo |

El jugador experto, no el incremental, decide cuánto dura la run: cada ciclo drena voltaje y solo los golpes precisos lo reponen.

---

## 2. Árbol de mejoras — 15 nodos (inicial)

| # | ID | Nombre | Rama | Coste base | Máx. | Efecto por nivel | Prerrequisito |
|---|---|---|---|---:|---:|---|---|
| 1 | `pulso_rapido` | Pulso Rápido | Pulso | 40 | 5 | +4 % ventana Perfecto | — |
| 2 | `mira_laser` | Mira Láser | Pulso | 120 | 5 | +5 % puntuación | — |
| 3 | `doble_toque` | Doble Toque | Pulso | 300 | 3 | +8 % de golpe doble | `mira_laser` 3 |
| 4 | `sincronia` | Sincronía | Pulso | 800 | 3 | −10 % decaimiento de combo | `doble_toque` 1 |
| 5 | `nucleo_denso` | Núcleo Denso | Núcleo | 60 | 5 | +8 % valor de golpe | — |
| 6 | `cadena` | Cadena | Núcleo | 180 | 3 | +1 objetivo de rayo | `nucleo_denso` 2 |
| 7 | `sobrecarga` | Sobrecarga | Núcleo | 450 | 4 | +10 % voltaje ganado | `cadena` 1 |
| 8 | `rompejefes` | Rompejefes | Núcleo | 1200 | 3 | +12 % daño a jefe | `sobrecarga` 2 |
| 9 | `eco_1` | Generador de Eco | Eco | 100 | 5 | +1 % del mejor ciclo / 30 s | — |
| 10 | `memoria_termica` | Memoria Térmica | Eco | 350 | 4 | +10 % eficiencia offline | `eco_1` 2 |
| 11 | `cache_chips` | Caché de Chips | Eco | 700 | 2 | +1 slot de Chip | `eco_1` 3 |
| 12 | `aegis` | Aegis | Supervivencia | 150 | 3 | Ignora 1 bomba por ciclo | — |
| 13 | `cronometro` | Cronómetro | Supervivencia | 400 | 3 | +0.5 s en Crono | `aegis` 1 |
| 14 | `escudo_nv` | Escudo NV | Supervivencia | 900 | 4 | +10 % pago de Nova | `cronometro` 2 |
| 15 | `sector_abierto` | Sector Abierto | Progresión | 2500 | 5 | +5 % multiplicador de sector | Jefe sector actual batido |

**Sinergias clave:** `pulso_rapido` + `veloz` (ventana ≈1.65×); `cadena` + `chain_master` (4 objetivos); `escudo_nv` + `nova_echo` (explosión ×1.55); `eco_1` + `eco_core` (pasivo ×1.25).

---

## 3. Chips — 15 (inicial)

Rareza multiplica el efecto: Común ×1, Raro ×1.5, Épico ×2, Legendario ×3.

| # | Chip | Rareza | Niveles | Efecto base | Sinergia | Obtención |
|---|---|---|---:|---|---|---|
| 1 | `veloz` | Común | 3 | +6 % ventana Perfecto | Pulso Rápido | Inicial |
| 2 | `mirada` | Común | 3 | +5 % puntuación | Mira Láser | Inicial |
| 3 | `volc_bomb` | Raro | 3 | Bomba → +20 voltaje | Sobrecarga | Ciclo 3 |
| 4 | `chrono_x3` | Raro | 3 | Crono +3 s | Cronómetro | Ciclo 5 |
| 5 | `perfect_window` | Raro | 3 | Ventana ×1.5 | `veloz` | Desenlace rechazado |
| 6 | `chain_master` | Épico | 3 | +2 objetivos de rayo | Cadena | Jefe sector 2 |
| 7 | `mirror_core` | Épico | 3 | Anula inversión del espejo | Jefe Espejo | Jefe sector 2 (sin fallos) |
| 8 | `reflejo` | Épico | 3 | Cada 3.º golpe replica al simétrico | Doble Toque | Ciclo diario ×3 |
| 9 | `criogenia` | Épico | 3 | Hielo −25 % duración | Sector 4 | Jefe sector 4 |
| 10 | `nucleo` | Épico | 3 | +15 % daño a jefe | Rompejefes | Jefe sector 5 |
| 11 | `nova_echo` | Épico | 3 | +15 % pago Nova | Escudo NV | Nova ×10 |
| 12 | `eco_core` | Legendario | 3 | +25 % Eco | Memoria Térmica | 5 h de juego activo |
| 13 | `doble_nucleo` | Legendario | 2 | Núcleos partidos valen ×2 | Ascensión NV2 | Ascensión NV2 |
| 14 | `resonancia` | Legendario | 2 | +10 % FN al prestigiar | — | 1.er prestigio |
| 15 | `racha_flash` | Legendario | 3 | +20 % CR con racha ≥10 | Sincronía | 7 días de racha diaria |

---

## 4. Cursores — 8 (inicial)

Reemplazan a los Martillos. Todos tienen estela, partículas y SFX propios; ninguno se compra con dinero real.

| # | Cursor | Diseño visual | Habilidad | Coste | Obtención |
|---|---|---|---|---|---|
| 1 | Pulso | Punto cian, estela circular corta | Equilibrado (baseline) | Gratis | Inicial |
| 2 | Tesla | Arco violeta, chispas zigzag | +1 objetivo de cadena | 800 CR | Tienda |
| 3 | Aegis | Escudo dorado, anillo al impactar | Ignora 1 bomba / ciclo | 1500 CR | Tienda (nodo `aegis` 1) |
| 4 | Crono | Reloj morado, estela de manecillas | +1 s en Crono | 2200 CR | Tienda |
| 5 | Nova | Estrella dorada, cola de chispas cálidas | +10 % pago Nova | — | Jefe sector 2 |
| 6 | Prisma | Rombo magenta, reflejo especular | +8 % golpe reflejado | — | Jefe sector 3 |
| 7 | Criogénico | Copo azul, escarcha al toque | −20 % hielo | — | Jefe sector 4 |
| 8 | Núcleo | Core blanco/dorado, halo pul-sante | +15 % todo, multiplicador final | 10 FN | Prestigio (no vendible por CR) |

---

## 5. Prestigio — «Reinicio de Núcleo»

1. **Requisitos iniciales:** jefe de sector ≥2 batido y `creditosLifetime ≥ 10 000`.
2. **Cálculo:** `FN ganados = floor(sqrt(creditosLifetime / 10000)) + (bonusJefe ? 1 : 0)`.
3. **Se conserva:** FN, historial de Sectores, Chips Legendarios desbloqueados, racha diaria, Archivo.
4. **Se reinicia:** Créditos, nodos, Chips comunes/raros/épicos, Cursores comprados, mejoras básicas.
5. **Se endurece:** cada prestigio suma `+0.12` al multiplicador de vida de jefes y `−0.03 s` a la telegrafía (suelo 0.55 s), como la Ascensión acumulativa actual.
6. **Narrativa:** la cabina se apaga; el núcleo se reinicia con fragmentos de la máquina anterior. Cada FN es un «recuerdo» que hace más rápida la siguiente lectura, no más lenta la máquina.
7. **Criterio de salida:** el prestigio nunca puede ejecutarse en pausa, durante un jefe vivo ni con automatización detectada.

---

## 6. Reglas anti-automatización

| Riesgo | Regla |
|---|---|
| Auto-tap / macro | Solo eventos `PointerEvent.isTrusted`; intervals <80 ms o desviación <5 ms se ignoran y muestran aviso |
| Bot de lectura perfecta | La ventana Perfecto depende del tiempo de reacción humano; se exige variabilidad mínima entre 5 toques |
| Eco offline | Tope 4 h, 50 % de eficiencia y requisito de partida activa en 24 h |
| Jefe pereza | Los jefes solo bajan vida con impactos válidos; Nova quita un `5 %`, nunca remata |
| Multi-cuenta | Sin IAP ni multijugador; el diario publica una sola run por fecha y usa firma `O9-...`; el servidor es opcional y configurable |
| Compra de ventaja | Cursores son cosmetic+mecánica, pero todos se obtienen jugando o con FN |

---

## 7. Revisión de balance (inicial)

| Palanca | Riesgo | Ajuste sugerido |
|---|---|---|
| Probabilidad Nova 3.5–11 % | Puede volver el cierre automático | Bajar a 2–7 % si >15 % de ciclos terminan con Nova |
| Pago Nova con tablero `5×4` | Inflación de CR | Reducir `BALANCE.core` / `BALANCE.nova.coreValues` (p. ej. 15/30/15) |
| Eco 5 % del ritmo activo | Juego idle | Mantener ≤5 % y cortar a 4 h offline |
| Fragmentos √escala | Prestigio demasiado rápido | Subir divisor 10 000 → 25 000 si <40 min por FN |
| Rareza Legendario ×3 | Rompe curva | Limitar a 2 copias y slots de Chip |
| Cursores de jefe | Pay-to-win percibido | Ningún cursor otorga ventaja exclusiva de jefe; solo estética+defensa |

**Criterios de salida del incremento:** 60 FPS estables en gama media, input→SFX <100 ms, nuevo jugador entiende Nova en <15 s (glifo de estrella + explosión visible), y la contribución pasiva nunca supera el 10 % de los CR totales en una sesión de 10 minutos.

---

## 8. Efectos avanzados implementados en la build web

| Efecto | Implementación | Coste estimado |
|---|---|---|
| Explosión Nova | 2 anillos desfasados con `lighter`, destello central, 0.75 s | 2 arcs/frame |
| Hit-stop | `hitStopTimer` congela `dt` 0.12 s | 0 |
| Screen shake | Intensidad 18 con decaimiento ×0.85 | 0 |
| Ripple de toque | 12 máx., 0.35 s, cian tenue | ≤12 arcs/frame |
| Partículas con estela | `px/py`, gravedad ligera, drag, tope 260 | 260 líneas máx. |
| Banda de escaneo Pesadilla | Rectángulo translúcido reutilizado del antiguo Overdrive; 5 s tras el Falso Final | 1 fill/frame |

`Overdrive` ya no existe como mecánica: su banda, destello y halo han abandonado el bucle y ahora pertenecen al Falso Final. Todos los efectos respetan `__reduceFlash` y el modo daltónico usa forma (estrella/diamante/copo) además de color.

---

## 9. Catálogo ampliado en la build web (20 / 5 / 10)

Las secciones 2–4 describen el diseño incremental original (15 nodos, 15 Chips, 8 Cursores). La build web incorpora además un catálogo jugable ampliado. **La fuente única de verdad es `js/content.js`; todos sus valores son iniciales y ajustables.**

| Bloque | Cantidad | Dónde se compra/equipa | Persistencia |
|---|---|---|---|
| Habilidades | 20 (`ABILITIES`) | Pantalla Mejoras → «20 HABILIDADES · ÁRBOL DE REFLEJOS» | `progress.abilities[id] = nivel` |
| Chips nuevos | 5 (`CHIPS_EXTRA`) | Pantalla Mejoras → «5 CHIPS NUEVOS» | `progress.unlocked[]` |
| Cursores | 10 (`CURSORS`) | Mejoras → «10 CURSORES» y prep → «CURSOR» | `progress.ownedCursors[]`, `selectedHammer` |

**Reglas de integridad**

- `resetModifiers()` + `applyModifiers()` se ejecutan en cada `startCycle()`: ningún modificador se filtra entre ciclos.
- El Ciclo Diario fuerza `pulso / sin chips / sin mejoras / sin habilidades`, preservando la comparabilidad por semilla.
- Caché de Chips (`ab_cache`) amplía los slots de 2 a 3/4; la UI lo refleja en `CHIPS (n)` y lo valida al seleccionar.
- Los Cursores no son pay-to-win: los de tienda se compran con CR, los de jefe exigen derrotar al Núcleo Espejo/Prisma/Criogenerador y el de prestigio exige una Ascensión.
- Cada Cursor tiene glifo/estela propia en `js/render.js`, timbre propio en `CURSOR_SOUND` (`js/audio.js`) y una habilidad mecánica distinta en `CURSOR_EFFECTS`.
- El combo es el multiplicador dominante: `1 + min(combo,50)·0.04`, aplicado **después** de puntuar cada golpe (primer golpe ×1). `Sincronía` conserva una fracción del combo, pero nunca lo crea desde cero.
- Nova sigue siendo recompensa: rara, nunca en Jackpot, limpia solo los núcleos presentes en la explosión, paga su valor real, no cuenta como bomba y conserva el combo. `SURGE NOVA` / `Resonancia Nova` aumentan pago y radio y añaden un tercer anillo visual.

**Criterio de salida del catálogo:** 83/83 tests (`game` + `accounts` + `leaderboard` + `mirror-nv3`), `node --check` limpio en todos los módulos, 0 errores de consola en navegador, compras y persistencia verificadas tras recarga, listas visibles y desplazables a 390×844, cuentas separadas por perfil en `datasave`, CRUD con foto validada y borrado de save/caché, layout fluido sin reglas por modelo, HUD separado del tablero en portrait/landscape/escritorio, desincrementación `×3→×2→×1→0` verificada en motor y HUD, purga de rojo con `+1 V`, y latencia input→SFX < 100 ms con evento humano confiable.

---

## 10. Refactorización v2 — reglas jugables y valores iniciales

La implementación reside en `js/balance.js` (constantes), `js/game.js` (motor y fuente de verdad), `js/render.js` (hit-test y FX), `js/input.js` (fases de puntero) y `js/main.js` (cableado tap/arrastre).

### 10.1 Voltaje como vida

| Regla | Valor inicial | Criterio de salida |
|---|---:|---|
| Voltaje máximo/inicial | `100 / 100` | El HUD muestra barra, escalera `×1…×5` y `Cn/999`, nunca un cronómetro |
| Drenaje base | `3.0/s + 0.4/s por sector` | Un ciclo sin golpes termina en ~33 s (menos en sectores altos) |
| Drenaje con jefe | `×0.8` | El jefe no castiga doblemente por ocupar un hoyo |
| Ganancia | normal `+2`, Perfecto `+3`, enlazado `+4`, jefe `0` | Golpear al jefe jamás recarga la barra |
| Subida de tier | al `100`, solo si se rearmó por debajo de `95` | Un llenado = un tier; tope `×5` |
| Reinicio de barra al subir | `100 × 0.15 = 15` | Margen de error antes del siguiente llenado; `0` sigue siendo derrota |
| Persistencia del tier | toda la run (hasta 999 ciclos) | `V×3` sigue vivo tras continuar desde resultados |
| Fin de run | voltaje `0` | Liquida `floor(score/10)` CR y muestra resultados |

### 10.2 Núcleos rojos y clústers

- Tocar un rojo: `−1` combo (`−2` si enlazado), `−8` V y RNG de error; **no** crea combo.
- Arrastrar `≥60 px` hacia un borde: purga y suma `+1 V`; si está enlazado, purga también al compañero con el mismo bonus.
- Dejar escapar un rojo: `−10` V, pero **no** rompe el combo.
- Clúster: ventana de `1.2 s`; el primer golpe trampa y amplía `+0.6 s` la vida de los demás; limpiarlos suma `+1` combo por extra, `+20` puntos por núcleo y conexión visual.
- Aegis absorbe el primer rojo del ciclo sin penalización.

### 10.3 Falso Final y Pesadilla

- Núcleo blanco neón: aparece como máximo una vez por ciclo, con combo ≥5 o voltaje ≤60; fuera del Diario.
- Al tocarlo: `+100 × comboStep × tier`, congela el voltaje `5 s`, activa skin/anuncio de Pesadilla y reutiliza los FX del antiguo Overdrive.
- Se consume en el momento del golpe (`fakeEndings` por ciclo), de modo que un segundo núcleo blanco inesperado no puede volver a activarlo.

### 10.4 Jefes móviles

- Un jefe cada `5` ciclos, dentro de una run de hasta `999`; `5000 × comboStep × tier` al caer. No hay botón de "Modo Jefe" en preparación.
- Rotación de **10 jefes**: Gólem, Espejo, Prisma, Criogenerador, Sobrecarga, Sifón, Taquígrafo, Enjambre, Apagón y Cerrojo. Cada vuelta completa sube el nivel del jefe (`NV1 → NV2 → …`) y endurece su efecto.
- Cada golpe válido quita exactamente `5 %` de la vida máxima (`BALANCE.boss.hitPercent`): 20 impactos lo derrotan. La barra muestra `NV · FASE · %` y baja en escalones constantes. Nova también quita un `5 %`.
- Efectos de entorno por tipo: Gólem aplasta filas; Espejo invierte la lectura; Prisma refleja golpes; Crio congela filas; Sobrecarga vuelve rojos los núcleos; Sifón drena voltaje extra por nivel; Taquígrafo acorta vida y telegrafía; Enjambre acelera los spawns; Apagón oscurece el tablero y acorta la telegrafía; Cerrojo bloquea columnas (2 a partir de NV3).
- Teletransporte cada `3 s` o tras `5` impactos: `0.25 s` desvanecimiento, `0.4 s` llegada, hoyo anterior limpio. Siempre exige juego activo: aparece en un hoyo real y tiene color/glifo propios; golpear al jefe nunca recarga voltaje.

### 10.5 QA de la refactorización

| Verificación | Resultado |
|---|---|
| `node --check` en 9 módulos | Limpio |
| `node --test tests/game.test.mjs tests/accounts.test.mjs` | 64/64 |
| Vaciado de barra | `×3 → ×2 → ×1 → 0` con recarga al 15 %; fin solo en `×0`; reinicio en `×1` |
| Viewport `390×844` (iframe real) | Launcher sin desbordamiento y tablero `5×4` centrado, 20 hoyos, HUD sin solapamiento, 0 errores de consola |
| Cuentas | Launcher con perfiles vinculados; registro/login con hash PBKDF2, sin contraseña en texto plano; dos perfiles con progreso y run independientes |
| Selector de tablero | Los tres `div[data-board]` responden a `pointerdown`; `boardId` persiste en `localStorage` |
| Tap / arrastre rojo | Tap resta combo y V; arrastre `70 px` purga y suma `+1 V`, también en clúster |
| Falso Final | Congela 5 s, activa Pesadilla, termina solo y **no** se dispara dos veces |
| Jefe | Golpe sin voltaje, teletransporte real, derrota notifica una vez, `5 %` por golpe y 20 impactos |
| Rotación de jefes | 10 tipos únicos; el ordinal 11 vuelve a Gólem en `NV2` |
| Entornos de jefe | Sifón drena extra, Taquígrafo/Enjambre aceleran, Apagón acorta telegrafía, Cerrojo bloquea columnas |
| Barra al subir tier | Reinicia en `15` (15 %); tope `×5` y `0` sigue cerrando la run |
| Valor de núcleos | Base mínima `20`; Crono `40`, Nova `60`, blanco `100`; clúster `+20` por núcleo |
| Preparación | Sin botón "MODO JEFE"; el jefe aparece solo cada 5 ciclos |
| Nova | Una explosión que paga el valor real de los núcleos eliminados; no limpia núcleos posteriores |
| Ritmo de aparición | `2.2 s → 0.35 s` entre núcleos a lo largo de 180 s |
| Resultados | Sin replay del error; tarjeta con informe completo de la run |
| Diario | `3×3`, sin jefe, sin blanco, `pulso` y carga vacía |

### 10.6 Responsive fluido y HUD sin solape

| Decisión | Implementación | Criterio |
|---|---|---|
| Viewport y zonas seguras | `100dvh` + `viewport-fit=cover` + `env(safe-area-inset-*)` en pantallas, overlay, editor y aviso flotante. | El contenido respeta marcas/notch sin recortar botones ni el inicio de listas. |
| Objetivos táctiles | Mínimo `44×44 px` en botones, pestañas de acceso, enlaces de carpeta y selector de foto. | Ningún control medible queda por debajo de `44 px` en `320×568`. |
| Tablero HUD-aware | `Renderer.computeBoard()` mide `hud.getBoundingClientRect().bottom` y reserva además una franja inferior; `ResizeObserver`, `resize`, `orientationchange` y `visualViewport` recalculan. | Separación HUD→tablero ≥ `40 px` y separación tablero→borde inferior ≥ `40 px` en los tamaños verificados. |
| Sin ajustes por modelo | Se eliminó el bloque por `max-height: 560px` que ocultaba el contexto del HUD y movía diversas pantallas; el layout crece con scroll y `justify-content: safe center`. | Los mismos estilos sirven para móvil estrecho, landscape y escritorio; no se recolocan pantallas completas. |

| Viewport | HUD | Tablero | Separación superior / inferior |
|---|---|---|---|
| `320×568` | 167 px | 285 px | 52 / 64 px |
| `390×844` | 170 px | 367 px | 141 / 165 px |
| `844×390` (landscape) | 193 px | 110 px | 45 / 42 px |
| `1280×720` | 193 px | 389 px | 57 / 81 px |

### 10.7 Ciclo 11: verificación ampliada

| Verificación | Severidad | Causa / reproducción | Corrección o evidencia | Criterio de salida |
|---|---|---|---|---|
| Medición en Android real (FPS y latencia) | **Alto** · pendiente de hardware | Sin dispositivo Android ni `kotlinc` en este entorno; Chromium headless no representa la GPU ni el audio de un móvil. | Panel opcional `?qa=1`: muestra FPS medio/mínimo, latencia evento→procesamiento, latencia audio y número de muestras; botón **COPIAR MÉTRICAS** y `window.__OVERCLOCK.getMetrics()`. En Chromium dio 143,9 FPS y 16 muestras de latencia: válido solo como comprobación del instrumento. | En gama media real: FPS medio ≥ 55, mínimo ≥ 45 y `p95` de input→SFX < 100 ms durante 3 min con jefe activo. |
| Revisión humana de capturas | **Medio** · pendiente de persona | El modelo de QA no puede interpretar píxeles; solo puede medir geometría y consola. | Capturas guardadas en `docs/qa/`: `c11-launcher.jpeg`, `c11-prep.jpeg`, `c11-playing.jpeg`, `c11-pause.jpeg` y `c11-320x568.jpeg`. | Una persona confirma legibilidad del HUD, jerarquía visual, ausencia de solapes y coherencia neón/metal en las cinco capturas. |
| Prueba con lector de pantalla / teclado | **Alto** · corregido | `onClick` y los delegados escuchaban solo `pointerdown`: Enter/Espacio no activaban botones y `preventDefault()` impedía el foco táctil. Los toasts duplicaban el texto en dos-regiones vivas. | `click` en botones nativos; región única `#a11y-live` con `announce()`; anuncios solo de hitos (tier, jefe, pausa, resultados, errores); foco al cambiar pantalla y al cerrar diálogos; `role=radiogroup/tabpanel/group`, `aria-label` en compras y `trapFocus` + Escape en editor y pausa. Lighthouse accesibilidad **1,00** con 0 audits fallidos; Enter en pestañas, submit y `CAMPAÑA`; Espacio en chips; Escape→Tab→Escape en pausa verificado. | Recorrido completo launcher→prep→ciclo→pausa→reanudar usando solo teclado, sin foco perdido y con anuncios no saturados. TalkBack real sigue pendiente. |
| Estrés A3 + Espejo | **Medio** · verificado | Caso límite: tablero `5×4`, jefe Espejo NV3, inversión, rojos, clúster y subida de peldaño a la vez; la instantánea no restaura `cols/rows` por sí sola. | `tests/mirror-nv3.test.mjs` prepara el tablero antes de `applyResumeState`. 4 pruebas nuevas cubren 20 hoyos, HP NV3, inversión→rojo, clúster+purga+peldaño y restauración. | Los 4 casos pasan y el jefe sigue en un hoyo real tras restaurar; suite total **83/83**. |
| Fuentes offline | **Medio** · corregido | `css/style.css` importaba Orbitron/Rajdhani desde Google Fonts y `index.html` tenía un `preload` al mismo dominio: el juego dependía de red pese a ser code-only. | Se eliminaron `@import` y `preload`; las variables `--font-display` y `--font-ui` usan copias locales si existen y una pila del sistema si no. | 0 peticiones a `fonts.googleapis.com`/`fonts.gstatic.com` tras recarga con caché ignorada; `node --check` y suite en verde. |
| Decisiones de alcance | **Bajo** · documentado | El canvas era enfocable como imagen pero no ofrecía control por teclado; la tabla y el selector de carpeta nativa dependen de gesto humano. | Se quitó `tabindex="0"` del canvas y el estado se anuncia por `#a11y-live`; no se simula el selector de carpetas. | Sin regresiones de foco; el selector nativo se valida manualmente en Android. |

**Supuestos pendientes:** medición de FPS y audio en Android físico (sin dispositivo ni `kotlinc` en este entorno); validación visual humana de las cinco capturas; latencia acústica extremo a extremo con evento `isTrusted` y dispositivo real; ejecución de TalkBack en Android; el selector nativo de carpeta requiere un gesto humano y no se puede automatizar en QA, pero el botón y el fallback se verificaron en navegador. El selector de tablero se corrigió durante la QA anterior: el delegado buscaba `button[data-board]` y las opciones son `div`.

### 10.8 Ciclo 12: contenedor Android para emulate e instalación

| Elemento | Severidad | Causa / reproducción | Corrección o evidencia | Criterio de salida |
|---|---|---|---|---|
| Abrir el juego en Android Studio | **Alto** · resuelto y verificado | El repositorio solo tenía `index.html`, `js/` y `kotlin-skeleton/` sin `settings.gradle.kts`: Android Studio lo abría como carpeta y no había botón **Run**. | Proyecto Gradle real en `android/`: AGP `8.13.1`, Kotlin `2.4.0`, `minSdk 24`, `targetSdk 36`, Java 17, sin AndroidX. `MainActivity.kt` crea una WebView a pantalla completa. | `.\gradlew assembleDebug` → `BUILD SUCCESSFUL`; `adb install -r` → `Success` y `am start` abre `com.overclock9.app/.MainActivity` en emulador Pixel Fold API 35. |
| Módulos ES dentro de la APK | **Alto** · resuelto y verificado | Cargar `file:///android_asset/index.html` bloquea `<script type="module">` por CORS y deja la pantalla de carga congelada. | `shouldInterceptRequest` sirve `assets/web/` bajo `https://overclock9.local/`, con MIME `application/javascript` para `.js`, `Cache-Control: no-store` y sin tráfico de red. | Logcat `OverclockQA` en el emulador: `{"url":"https://overclock9.local/?qa=1","launcher":true,"api":true,"qa":true,"main":true,"mode":"fallback"}`. Sin errores JS en consola; captura `docs/qa/c12-emulador-inicio.png`. |
| Guardado sin API de carpetas | **Medio** · resuelto por diseño | `window.showDirectoryPicker` no existe en WebView, así que el botón **ELEGIR CARPETA DATASAVE** no tendría sentido. | `AccountManager.supportsFs` es `false` y el delegado oculta el botón; el juego usa el datasave virtual en almacenamiento local, con el mismo formato de cuentas y partidas. | El propio logcat confirma `mode: "fallback"` dentro de la WebView; el botón de carpeta queda oculto por `supportsFs=false`. |
| Copiar métricas en el móvil | **Medio** · resuelto | `navigator.clipboard.writeText` depende de permisos del navegador; dentro de una WebView puede fallar. | Puente `@JavascriptInterface OverclockAndroid.copyMetrics()` usa `ClipboardManager` nativo; `js/main.js` lo prefiere y mantiene el portapapeles web como respaldo. | El botón **COPIAR MÉTRICAS** del panel `?qa=1` muestra `COPIADO` y el JSON queda en el portapapeles de Android. |
| Actualización del juego web | **Bajo** · documentado | La APK lleva una copia de los archivos web; editar `js/` en la raíz no la actualiza solo. | `android/README.md` indica cómo recopiar `index.html`, `css/` y `js/` a `app/src/main/assets/web/` y reconstruir. | Tras cualquier cambio web se recopia y se ejecuta `assembleDebug` antes de medir. |

**Supuestos pendientes del Ciclo 12:** la validación en emulador Pixel Fold API 35 usa SwiftShader y registró hasta 318 frames omitidos por el compositor, así que sus FPS no sustituyen a un dispositivo físico; TalkBack y la latencia acústica real siguen pendientes; el botón **COPIAR MÉTRICAS** del puente nativo y el selector de carpeta (inexistente en WebView) requieren prueba con gesto humano; el APK de depuración no está firmado para publicación, hace falta un `signingConfig` y `assembleRelease` para distribuir.
