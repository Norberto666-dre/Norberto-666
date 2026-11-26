# OVERCLOCK 9 · contenedor Android

Proyecto Android Studio real para ejecutar el juego web en el emulador o instalarlo en un teléfono. El código del juego se empaqueta en `app/src/main/assets/web/`; no necesitas SERVER NI RED.

## Abrir

1. Abre Android Studio.
2. `File` → `Open...` y elige:

```text
D:\Mis_apps\juego2dinteracivo\android
```

3. Espera a que Gradle sincronice.
4. Selecciona un dispositivo (emulador Pixel con API 35 o tu móvil por USB) y pulsa **Run** (▶).

Si Android Studio pregunta por `local.properties`, apunta a:

```text
C:\Users\AORUS\AppData\Local\Android\Sdk
```

## Instalar en el móvil

Con el teléfono conectado por USB y depuración activada:

```text
Run → Select Device → tu teléfono → Run
```

O genera el APK y cópialo al móvil:

```bash
cd D:\Mis_apps\juego2dinteracivo\android
.\gradlew assembleDebug
```

El APK queda en:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Para instalarlo por ADB:

```bash
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

## Medir en Android

La app abre automáticamente con `?qa=1`. El panel muestra FPS, latencia y muestras; **COPIAR MÉTRICAS** usa el portapapeles nativo.

La compilación `debug` escribe en logcat el estado real de la página 1,5 s después de cargar:

```bash
adb logcat -s OverclockQA:I
# D/OverclockQA: {"url":"https://overclock9.local/?qa=1","launcher":true,"api":true,"qa":true,"main":true,"mode":"fallback"}
```

Para inspeccionar la web con Chrome DevTools, la compilación `debug` habilita `WebView.setWebContentsDebuggingEnabled(true)`: abre `chrome://inspect` en Chrome de escritorio con el teléfono/emulador conectado.

## Detalles técnicos

- `minSdk 24`, `targetSdk 36`, sin AndroidX ni dependencias externas.
- La WebView sirve los archivos desde `assets` mediante `shouldInterceptRequest` bajo el origen `https://overclock9.local/`. Eso permite cargar módulos ES (`<script type="module">`) y usar `localStorage`, algo que falla con `file:///android_asset/`.
- `showDirectoryPicker` no existe en WebView: el juego usa automáticamente su guardado local (`fallback`), así que las cuentas y partidas funcionan igual.
- `MainActivity` mantiene la WebView viva al girar y permite volver atrás con el botón físico.

## Actualizar el juego web

Desde la raíz del repositorio usa el script único:

```bat
build.bat
```

Ese comando sincroniza `index.html`, `css/` y `js/` a `app/src/main/assets/web/`, ejecuta `assembleDebug` y copia el resultado a `OVERCLOCK9-debug.apk`.

- `build.bat --watch`: detecta cambios en `index.html`, `css/`, `js/` y en el código Android, y reconstruye el APK automáticamente.
- `build.bat --install`: además instala el APK en el teléfono conectado por USB con `adb install -r`.

Si lo haces a mano, tras cambiar archivos web recopia:

```powershell
Copy-Item ..\index.html app\src\main\assets\web\index.html -Force
Copy-Item ..\css,..\js app\src\main\assets\web -Recurse -Force
```

Luego `.\gradlew assembleDebug` otra vez.
