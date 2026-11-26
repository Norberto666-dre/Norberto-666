# OVERCLOCK 9

Arcade de reflejos y progresión roguelite, con **app nativa de Windows** (Electron) y **versión web instalable** (PWA). Diseño code-only: Canvas 2D + Web Audio API, sin imágenes ni audio externo. El contenedor Android quedó archivado y se retomará en una fase posterior.

## Cómo jugar

- **Clic/tap** en un núcleo activo para golpearlo.
- **Arrastra** un núcleo rojo hacia un borde (~60 px) para purgarlo y sumar **+1 V** (si está enlazado, también al compañero); tocarlo resta combo y voltaje.
- El **voltaje es la vida**: drena con el tiempo; golpear recarga. Al llegar a 0 se cierra el ciclo y se liquidan créditos (`floor(puntuación / 10)`).
- Llenar la barra sube un peldaño de multiplicador (`×1…×5`) y la barra vuelve al **15 %**. Si se vacía, el multiplicador baja un peldaño y la barra se recarga al **15 %** (`×3 → ×2 → ×1 → 0`); la run termina solo al vaciarse en `×0`.
- Cada núcleo paga **20 puntos base** como mínimo (Crono 40, Nova 60, blanco 100). Los combos y jefes siguen siendo el multiplicador dominante.
- **Nova** (estrella dorada) es una sola explosión que paga el valor real de los núcleos que elimina.
- **Falso Final** (núcleo blanco): una vez por ciclo, congela el voltaje 5 s y activa Pesadilla.
- **Jefes**: uno cada 5 ciclos, sin botón manual. Son 10 tipos en rotación (Gólem, Espejo, Prisma, Crio, Sobrecarga, Sifón, Taquígrafo, Enjambre, Apagón y Cerrojo); cada vuelta completa sube su nivel. Cada golpe quita el **5 %** de la vida máxima, así que hacen falta 20 impactos.

Los núcleos aparecen cada vez más rápido: de `2.2 s` a `0.35 s` entre núcleos a lo largo de 180 s de run.

## PC: ejecutable y compilación

`OVERCLOCK9.exe` en la raíz es la app portátil de Windows: **doble clic y a jugar**, sin instalar ni abrir un navegador. En `dist/` también se generan `OVERCLOCK9-portable.exe` (idéntico) y `OVERCLOCK9-setup.exe` (instalador NSIS).

```bat
build.bat
```

Esa única orden verifica los archivos y la sintaxis, empaqueta el juego con Electron y copia el portable a la raíz. Vuelve a ejecutarla después de cualquier cambio en `index.html`, `css/` o `js/`: el `.exe` se regenera con la versión actual.

| Orden | Qué hace |
|---|---|
| `build.bat` | Genera `OVERCLOCK9.exe`, `dist\OVERCLOCK9-portable.exe` y `dist\OVERCLOCK9-setup.exe`. |
| `build.bat --dev` | Abre la app desde el código fuente sin empaquetar. `Ctrl+R` recarga. |
| `build.bat --watch` | Como `--dev`, pero recarga sola al guardar cambios en `index.html`, `css/` o `js/`. |
| `build.bat --check` | Prueba de humo: arranca el juego, vigila errores de consola y falla si aparece alguno. |
| `build.bat --serve` | Servidor local `http://localhost:3000/` para probar la versión navegador. |
| `build.bat --dir` | Empaquetado rápido en `dist\win-unpacked\`, sin instaladores. |

Requisitos: Node.js 18 o superior en el `PATH`. La primera compilación instala `electron` y `electron-builder` en `node_modules/` (caché local en `.cache/npm`); las siguientes reutilizan lo ya descargado.

El ejecutable **no está firmado digitalmente**: Windows SmartScreen puede avisar la primera vez. Pulsa *Más información → Ejecutar de todos modos*. Para distribuirlo sin avisos hace falta un certificado de código firmado.

### Atajos y ventana

- `F11` o `F` alternan pantalla completa; `M` silencia/activa el audio; `Esc` pausa y guarda.
- Al perder el foco (por ejemplo, con `Alt+Tab`) la partida en curso se pausa y se guarda sola.
- El tamaño, la posición y el estado de maximizado se recuerdan entre sesiones.
- El menú nativo ofrece **Recargar**, zoom, **Abrir carpeta de datos** y **Acerca de**.
- La app usa un esquema propio `app://overclock9/` con `contextIsolation`, `sandbox` y sin `nodeIntegration`; bloquea navegaciones externas y abre los enlaces web en el navegador del sistema.

## Navegador y PWA

```bat
build.bat --serve
```

Abre `http://localhost:3000/` en Chrome o Edge. El botón **INSTALAR APP** (menú y launcher) instala OVERCLOCK 9 como aplicación independiente cuando el navegador lo permite; en Safari/iOS se abre una guía de *Añadir a pantalla de inicio*. Hay un aviso de **nueva versión** con botón **RECARGAR** cuando el service worker encuentra una actualización. Para QA, `?nosw=1` desregistra el service worker y borra sus cachés.

La PWA funciona solo en origen seguro (`https://` o `localhost`), precarga todo el juego para jugar sin conexión y no almacena respuestas de dominios externos (la tabla online sigue siendo opcional).

## Cuentas y partidas

El juego abre en un **launcher** con los perfiles ya vinculados. Solo se piden **nombre/nickname y contraseña**; la contraseña se guarda como hash PBKDF2-SHA256 con salt, nunca en texto plano. El alta puede incluir **foto de perfil** opcional.

- En la **app de Windows**, cuentas, ajustes y partidas viven en la carpeta de datos del usuario (`%APPDATA%\overclock9`). El panel **Ajustes → DATASAVE DEL EQUIPO** permite **EXPORTAR**, **IMPORTAR** y **ABRIR CARPETA** con diálogos nativos.
- En **navegador**, pulsa **ELEGIR CARPETA DATASAVE** una vez para guardar `accounts.json` y un `u_<id>.json` por jugador (Chrome/Edge sobre `localhost` o HTTPS). En navegadores sin esa API se usa un *datasave virtual* en almacenamiento local, con el mismo formato.
- El acceso a la carpeta se recuerda; si el navegador vuelve a pedir permiso, aparece **CONECTAR DATASAVE**.
- **CAMBIAR USUARIO** guarda la partida y vuelve al launcher; **CONTINUAR** reanuda la run guardada de ese perfil.
- **CRUD de cuentas**: en cada tarjeta del launcher puedes entrar, **editar** (nombre, color, foto y contraseña nueva) o **eliminar**. Guardar/borrar exige la contraseña actual y borrar necesita una segunda confirmación.
- La foto se recorta a `192×192`, se guarda como JPEG embebido (máx. `96 KB` decodificados) y nunca se sube a un servidor.
- El botón **PAUSA** del HUD (o `Esc`) congela la partida, guarda una instantánea real del ciclo y permite **GUARDAR AHORA**, **CONTINUAR** o **GUARDAR Y SALIR**.
- La barra de voltaje lleva una escalera `×1…×5` con icono: el peldaño activo se ilumina y los anteriores quedan marcados. Al vaciarse, se muestra llena 0,6 s con el multiplicador perdido (`×3 → ×2`) antes de volver al 15 %.
- El menú agrupa **CAMPAÑA/CONTINUAR** y **RUN DIARIA** y una fila de accesos rápidos (**TABLA, MEJORAS, ARCHIVO, AJUSTES, USUARIO**).

## Diseño responsive

- La interfaz usa `100dvh`, unidades fluidas y `env(safe-area-inset-*)`; los cambios de escritorio son aditivos (`@media (min-width: 900px)`, `(hover: hover)` y ventana baja), por lo que el layout móvil verificado no se toca.
- Controles con objetivo táctil mínimo de `44×44 px`; las pantallas crecen con scroll cuando el contenido no cabe.
- `Renderer.computeBoard()` mide el borde real del HUD y limita el tamaño de celda en pantallas grandes, de modo que el tablero queda centrado y el HUD nunca se superpone a los hoyos.
- `resize`, `orientationchange` y `visualViewport` mantienen el canvas y el hit-test alineados. Con ratón hay hover sobre el hoyo objetivo y solo responde el botón primario.
- Teclado: `Enter`/`Espacio` activan controles, `Esc` cierra diálogos y gestiona la pausa, y un único anuncio accesible informa de hitos sin leer el marcador cada frame.
- Fuentes 100 % offline: sin `@import` ni `preload` a Google Fonts; se usan copias locales si están instaladas y una pila del sistema como respaldo.

## Campaña, run diaria y tabla

- **CAMPAÑA** es el modo local: avanza por sectores y acumula récords personales antes del reto diario.
- **RUN DIARIA** es una sola partida por fecha con carga fija: `3×3`, `PULSO`, sin chips, sin mejoras, sin habilidades, sin jefe y sin núcleo blanco. La semilla depende de la fecha. Al terminar se publica la puntuación y se abre la tabla.
- **TABLA DIARIA** muestra `MUNDO · ONLINE` y `ESTE DISPOSITIVO · OFFLINE`. Sin conexión se usa la caché local y las run pendientes se reenvían al volver a abrir la tabla.
- El endpoint es configurable en `js/online-config.js` o en `localStorage` con la clave `overclock9_online_config`:
  ```json
  { "leaderboardUrl": "https://tu-servicio/daily", "token": "opcional", "timeoutMs": 5000 }
  ```
  Sin URL no sale nada del dispositivo: solo tabla offline.

## Tableros

| Tablero | Desbloqueo |
|---|---|
| `3×3` | Inicial (obligatorio en Diario) |
| `4×3` | 100 000 puntos |
| `5×4` | 1 000 000 puntos |

## Pruebas y QA

```bash
npm test
build.bat --check
```

La suite (97 pruebas) cubre voltaje, peldaños, purga de rojos, combos, tableros, jefes y estrés NV3, economía, CRUD de cuentas, tabla online/offline, empaquetado Electron, seguridad del proceso principal, PWA y datasave. `build.bat --check` añade una prueba de humo real con captura de errores de consola.

`?qa=1` muestra un panel opcional con FPS, latencia y muestras; **COPIAR MÉTRICAS** exporta el resultado. Las guías de QA de escritorio están en `tests/qa/` y las capturas en `docs/qa/`.

## Estructura

- `electron/` — proceso principal, preload seguro y persistencia de ventana.
- `tools/build.mjs`, `build.bat` — empaquetado, modo desarrollo, vigilancia y QA.
- `icons/`, `manifest.webmanifest`, `sw.js`, `js/pwa.js`, `js/desktop.js` — iconos, PWA e integración nativa.
- `js/balance.js` — constantes de balance.
- `js/accounts.js` — launcher, perfiles y datasave.
- `js/leaderboard.js`, `js/online-config.js` — tabla diaria online/offline.
- `js/game.js` — motor: voltaje, spawns, jefes, Nova y pausa.
- `js/render.js`, `js/input.js`, `js/ui.js`, `js/main.js`, `js/audio.js` — presentación e interacción.
- `js/content.js` — catálogo de habilidades, chips y cursores.
- `tests/` — suite Node, servidor estático y guiones de QA.
- `docs/INCREMENTAL_DESIGN.md` — diseño incremental, fórmulas, ritmo y QA.
- `docs/qa/` — capturas de verificación (Ciclos 11 y 13).

Sin IAP ni multijugador. El contenedor Android se conserva en el tag `android-webview-v1` para cuando se retome.
