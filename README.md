# OVERCLOCK 9

Arcade de reflejos y progresión roguelite, jugable en navegador y Android. Diseño code-only: Canvas 2D + Web Audio API, sin imágenes ni audio externo.

## Cómo jugar

- **Tap** en un núcleo activo para golpearlo.
- **Arrastra** un núcleo rojo hacia un borde (~60 px) para purgarlo sin castigo; tocarlo resta combo y voltaje.
- El **voltaje es la vida**: drena con el tiempo; golpear recarga. Al llegar a 0 se cierra el ciclo y se liquidan créditos (`floor(puntuación / 10)`).
- Llenar la barra sube un peldaño de multiplicador (`×1…×5`) y la barra vuelve al **15 %**. Si se vacía, el multiplicador baja un peldaño y la barra se recarga al **15 %** (`×3 → ×2 → ×1 → 0`); la run termina solo al vaciarse en `×0`.
- Cada núcleo paga **20 puntos base** como mínimo (Crono 40, Nova 60, blanco 100). Los combos y jefes siguen siendo el multiplicador dominante.
- **Nova** (estrella dorada) es una sola explosión que paga el valor real de los núcleos que elimina.
- **Falso Final** (núcleo blanco): una vez por ciclo, congela el voltaje 5 s y activa Pesadilla.
- **Jefes**: uno cada 5 ciclos, sin botón manual. Son 10 tipos en rotación (Gólem, Espejo, Prisma, Crio, Sobrecarga, Sifón, Taquígrafo, Enjambre, Apagón y Cerrojo); cada vuelta completa sube su nivel. Cada golpe quita el **5 %** de la vida máxima, así que hacen falta 20 impactos.

Los núcleos aparecen cada vez más rápido: de `2.2 s` a `0.35 s` entre núcleos a lo largo de 180 s de run.

## Cuentas y partidas

El juego abre en un **launcher** con los perfiles ya vinculados. Solo se piden **nombre/nickname y contraseña**; la contraseña se guarda como hash PBKDF2-SHA256 con salt, nunca en texto plano.

- En **Escritorio** (Chrome/Edge sobre `localhost` o HTTPS), pulsa **ELEGIR CARPETA DATASAVE** una vez. Se crean `accounts.json` y un `u_<id>.json` por jugador con su progreso, partida en curso y ajustes.
- El acceso a la carpeta se recuerda; si el navegador vuelve a pedir permiso, aparece **CONECTAR DATASAVE**.
- En **Android/Firefox**, donde no existe la API de carpetas, el mismo formato se guarda en un *datasave virtual* dentro del almacenamiento del navegador.
- **CAMBIAR USUARIO** guarda la partida y vuelve al launcher; **CONTINUAR PARTIDA** reanuda la run guardada de ese perfil.

## Ejecutar

```bash
python -m http.server 3000
# abre http://localhost:3000/index.html
```

> La carpeta local requiere origen seguro. `http://localhost` cuenta como seguro; si abres el HTML con `file://`, se usa el datasave del navegador.

## Tableros

| Tablero | Desbloqueo |
|---|---|
| `3×3` | Inicial (obligatorio en Diario) |
| `4×3` | 100 000 puntos |
| `5×4` | 1 000 000 puntos |

## Pruebas

```bash
node --check js/balance.js   # y los otros módulos
node --test tests/game.test.mjs tests/accounts.test.mjs
```

La suite (64 pruebas) cubre voltaje, subida y desincrementación de peldaños, escalones de combo, tableros, rojos, clústers, rotación de 10 jefes y sus efectos de entorno, Diario, Nova de una explosión, ritmo de aparición, economía y cuentas/guardado por perfil.

## Estructura

- `js/balance.js` — todas las constantes iniciales y funciones de balance.
- `js/accounts.js` — launcher: perfiles vinculados, hash de contraseña y guardado por usuario en `datasave`.
- `js/game.js` — motor: voltaje, spawns, jefes, Nova, puntuación e informe de run.
- `js/render.js`, `js/input.js`, `js/ui.js`, `js/main.js`, `js/audio.js` — capa de presentación e interacción.
- `js/content.js` — catálogo de 20 habilidades, 5 chips y 10 cursores.
- `tests/` — suite Node y harness de viewport móvil `390×844`.
- `docs/INCREMENTAL_DESIGN.md` — diseño incremental, fórmulas, ritmo y QA.
- `kotlin-skeleton/` — esqueleto Kotlin/Jetpack Compose (minSdk 24) alineado con las reglas v2.

Sin IAP ni multijugador.
