// Genera el APK de OVERCLOCK 9 y, con --watch, lo reconstruye cuando cambia el juego.
// Uso: node tools/build-apk.mjs [--watch] [--install]
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
const assetsDir = join(androidDir, 'app', 'src', 'main', 'assets', 'web');
const builtApk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const apk = join(root, 'OVERCLOCK9-debug.apk');
const adb = process.env.ADB || 'C:\\Users\\AORUS\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';

const watch = process.argv.includes('--watch');
const install = process.argv.includes('--install');

const log = (message) => console.log(`[${new Date().toLocaleTimeString('es-ES')}] ${message}`);

function filesIn(target) {
  if (!existsSync(target)) return [];
  if (!statSync(target).isDirectory()) return [target];
  return readdirSync(target, { withFileTypes: true }).flatMap(entry => {
    const full = join(target, entry.name);
    if (entry.isDirectory()) return filesIn(full);
    return [full];
  });
}

function sourceFiles() {
  return [
    join(root, 'index.html'),
    ...filesIn(join(root, 'css')),
    ...filesIn(join(root, 'js')),
    join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml'),
    ...filesIn(join(androidDir, 'app', 'src', 'main', 'java')),
    ...filesIn(join(androidDir, 'app', 'src', 'main', 'res')),
    join(androidDir, 'app', 'build.gradle.kts'),
    join(androidDir, 'build.gradle.kts'),
    join(androidDir, 'settings.gradle.kts'),
    join(androidDir, 'gradle.properties')
  ].filter(existsSync);
}

function snapshot() {
  const map = new Map();
  for (const file of sourceFiles()) {
    try {
      const { mtimeMs, size } = statSync(file);
      map.set(file, `${mtimeMs}:${size}`);
    } catch { /* el archivo puede haberse borrado mientras se vigila */ }
  }
  return map;
}

let previous = snapshot();
let building = false;
let pending = false;

function syncWeb() {
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
  copyFileSync(join(root, 'index.html'), join(assetsDir, 'index.html'));
  for (const folder of ['css', 'js']) {
    const from = join(root, folder);
    if (existsSync(from)) {
      const to = join(assetsDir, folder);
      mkdirSync(to, { recursive: true });
      for (const file of filesIn(from)) {
        const relative = file.slice(from.length + 1);
        const target = join(to, relative);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(file, target);
      }
    }
  }
}

function build() {
  log('Sincronizando juego web → assets…');
  syncWeb();
  log('Compilando APK de depuración…');
  const gradlew = join(androidDir, 'gradlew.bat');
  const result = spawnSync(`"${gradlew}" assembleDebug --no-daemon`, {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) throw new Error(`Gradle falló con código ${result.status}`);
  if (!existsSync(builtApk)) throw new Error('No se generó app-debug.apk');
  copyFileSync(builtApk, apk);
  log(`APK listo: ${apk}`);
  if (install && existsSync(adb)) {
    log('Instalando en el dispositivo conectado…');
    const installed = spawnSync(adb, ['install', '-r', apk], { stdio: 'inherit' });
    log(installed.status === 0 ? 'Instalado en el dispositivo.' : 'No se pudo instalar (¿dispositivo conectado?).');
  }
  previous = snapshot();
}

function run() {
  if (building) { pending = true; return; }
  building = true;
  try {
    build();
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      setTimeout(run, 400);
    }
  }
}

run();

if (watch) {
  log('Vigilando cambios en index.html, css/, js/ y código Android… (Ctrl+C para salir)');
  setInterval(() => {
    if (building) return;
    const current = snapshot();
    const changed = [...current].some(([file, value]) => previous.get(file) !== value)
      || previous.size !== current.size;
    if (changed) {
      previous = current;
      log('Cambio detectado; reconstruyendo…');
      run();
    }
  }, 1000);
}
