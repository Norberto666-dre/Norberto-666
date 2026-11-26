// Herramienta única de OVERCLOCK 9 para escritorio.
//   node tools/build.mjs             empaqueta el .exe (portable + instalador)
//   node tools/build.mjs --dev       abre la app desde el código fuente
//   node tools/build.mjs --check     arranca el juego, mide y falla si hay errores
//   node tools/build.mjs --serve     servidor local para probar en navegador
//   node tools/build.mjs --dir       empaquetado rápido sin instaladores
//   node tools/build.mjs --no-install  no instala dependencias si faltan

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electronExe = join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const builderCli = join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
const npmCache = join(root, '.cache', 'npm');

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const mode = has('--dev') ? 'dev'
  : has('--watch') ? 'watch'
    : has('--check') ? 'check'
      : has('--serve') ? 'serve'
        : 'dist';
const fastDir = has('--dir');
const skipInstall = has('--no-install');

const log = (message) => console.log(`\n[build] ${message}`);

function fail(message) {
  console.error(`\n[build] ERROR: ${message}`);
  process.exit(1);
}

function human(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function installDependencies() {
  if (existsSync(electronExe)) return;
  if (skipInstall) fail('Faltan las dependencias y se pidió --no-install.');
  log('Instalando dependencias (electron + electron-builder)…');
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--cache', npmCache], {
    cwd: root,
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0 || !existsSync(electronExe)) {
    fail('No se pudieron instalar las dependencias. Revisa la conexión e inténtalo de nuevo.');
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const REQUIRED = [
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/game.js',
  'js/render.js',
  'js/ui.js',
  'js/accounts.js',
  'js/audio.js',
  'js/input.js',
  'js/balance.js',
  'js/content.js',
  'js/leaderboard.js',
  'js/online-config.js',
  'js/pwa.js',
  'js/desktop.js',
  'electron/main.cjs',
  'electron/preload.cjs',
  'electron/store.cjs',
  'manifest.webmanifest',
  'sw.js',
  'icons/icon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

function verifyProject() {
  const missing = REQUIRED.filter((file) => !existsSync(join(root, file)));
  if (missing.length) fail(`Faltan archivos del juego: ${missing.join(', ')}`);
  for (const file of walk(join(root, 'js')).concat(walk(join(root, 'electron')))) {
    if (!/\.(js|mjs|cjs)$/.test(file)) continue;
    const check = spawnSync(process.execPath, ['--check', file], { stdio: 'pipe', encoding: 'utf8' });
    if (check.status !== 0) fail(`Error de sintaxis en ${relative(root, file)}:\n${check.stderr}`);
  }
}

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
  child.on('error', (error) => fail(error.message));
  child.on('exit', (code) => process.exit(code ?? 0));
  return child;
}

if (mode === 'serve') {
  log('Servidor web en http://localhost:3000/ (Ctrl+C para detener)');
  start(process.execPath, [join(root, 'tests', 'serve.mjs')]);
} else {
  installDependencies();
  verifyProject();

  if (mode === 'dev' || mode === 'watch') {
    log(mode === 'watch'
      ? 'Modo vigilancia: los cambios en index.html, css/ y js/ recargan la app al guardar.'
      : 'Abriendo OVERCLOCK 9 desde el código fuente…');
    start(electronExe, ['.'], {
      OVERCLOCK_DEV: '1',
      OVERCLOCK_WATCH: mode === 'watch' ? '1' : '0'
    });
  } else if (mode === 'check') {
    log('Prueba de humo: arrancando el juego y vigilando la consola…');
    // Rutas absolutas: el .exe portable extrae la app en una carpeta temporal y cambia el cwd.
    const smokeEnv = { ...process.env, OVERCLOCK_SMOKE: '1' };
    if (smokeEnv.OVERCLOCK_SHOT) smokeEnv.OVERCLOCK_SHOT = resolve(smokeEnv.OVERCLOCK_SHOT);
    if (smokeEnv.OVERCLOCK_QA_SCRIPT) smokeEnv.OVERCLOCK_QA_SCRIPT = resolve(smokeEnv.OVERCLOCK_QA_SCRIPT);
    const result = spawnSync(electronExe, ['.'], {
      cwd: root,
      stdio: 'inherit',
      env: smokeEnv
    });
    if (result.status !== 0) fail('La prueba de humo detectó errores en la consola del juego.');
    log('Prueba de humo superada: el juego arranca sin errores.');
  } else {
    log('Empaquetando la aplicación de Windows…');
    const builderArgs = [builderCli];
    if (fastDir) {
      builderArgs.push('--dir');
    } else {
      builderArgs.push('--win', 'portable', 'nsis');
    }
    const result = spawnSync(process.execPath, builderArgs, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
    });
    if (result.status !== 0) fail('electron-builder falló. Revisa el mensaje anterior.');

    const portable = join(root, 'dist', 'OVERCLOCK9-portable.exe');
    const setup = join(root, 'dist', 'OVERCLOCK9-setup.exe');
    const target = join(root, 'OVERCLOCK9.exe');

    if (existsSync(portable)) {
      copyFileSync(portable, target);
      log(`Ejecutable listo: ${target} (${human(statSync(target).size)})`);
    }
    if (existsSync(setup)) {
      log(`Instalador listo: ${setup} (${human(statSync(setup).size)})`);
    }
    if (!existsSync(target) && !existsSync(setup)) fail('No se generó ningún ejecutable en dist/.');
    if (fastDir) log('Empaquetado rápido en dist/win-unpacked/ (sin instaladores).');
  }
}
