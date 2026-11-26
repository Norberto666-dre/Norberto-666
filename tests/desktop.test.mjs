import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('package.json describe la app de escritorio', () => {
  assert.equal(pkg.name, 'overclock9');
  assert.equal(pkg.productName, 'OVERCLOCK 9');
  assert.equal(pkg.main, 'electron/main.cjs');
  assert.ok(existsSync(join(root, pkg.main)));
  assert.equal(pkg.build.appId, 'com.overclock9.desktop');
  assert.equal(pkg.build.productName, 'OVERCLOCK 9');
  assert.equal(pkg.build.win.icon, 'icons/icon.ico');
  const targets = pkg.build.win.target.map((entry) => entry.target);
  assert.ok(targets.includes('portable'), 'debe generar un .exe portable');
  assert.ok(targets.includes('nsis'), 'debe generar un instalador');
});

test('el empaquetado incluye todos los archivos del juego', () => {
  const patterns = pkg.build.files;
  assert.ok(patterns.includes('index.html'));
  assert.ok(patterns.includes('css/**/*'));
  assert.ok(patterns.includes('js/**/*'));
  assert.ok(patterns.includes('icons/**/*'));
  assert.ok(patterns.includes('electron/**/*'));
  assert.ok(patterns.includes('manifest.webmanifest'));
  assert.ok(existsSync(join(root, 'icons', 'icon.ico')), 'falta el icono .ico de Windows');
  const ico = readFileSync(join(root, 'icons', 'icon.ico'));
  assert.equal(ico.readUInt16LE(0), 0, 'cabecera ICO reservada');
  assert.equal(ico.readUInt16LE(2), 1, 'el archivo debe ser un icono');
  assert.equal(ico.readUInt16LE(4), 1, 'debe contener un icono');
});

test('el proceso principal es seguro y sirve el juego con origen propio', () => {
  const main = read('electron/main.cjs');
  assert.match(main, /protocol\.registerSchemesAsPrivileged/);
  assert.match(main, /standard: true/);
  assert.match(main, /secure: true/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /will-navigate/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /minWidth: 960/);
  assert.match(main, /minHeight: 640/);
  assert.match(main, /readWindowState/);
  assert.match(main, /writeWindowState/);
  assert.ok(!/nodeIntegration: true/.test(main));
  assert.ok(!/webSecurity: false/.test(main));
});

test('el preload expone solo la API necesaria', () => {
  const preload = read('electron/preload.cjs');
  assert.match(preload, /contextBridge\.exposeInMainWorld\('overclock'/);
  assert.match(preload, /isDesktop: true/);
  for (const api of ['copyMetrics', 'exportDatasave', 'importDatasave', 'revealDatasave', 'setFullscreen']) {
    assert.ok(preload.includes(api), `falta ${api}`);
  }
  assert.ok(!/require\('node:fs'\)/.test(preload), 'el preload no debe tocar el sistema de archivos');
});

test('los archivos de Electron tienen sintaxis válida', () => {
  for (const file of ['electron/main.cjs', 'electron/preload.cjs', 'electron/store.cjs', 'tools/build.mjs']) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('el datasave de escritorio se exporta e importa con diálogos nativos', () => {
  const html = read('index.html');
  for (const id of ['desktop-datasave', 'btn-datasave-export', 'btn-datasave-import', 'btn-datasave-reveal']) {
    assert.ok(html.includes(`id="${id}"`), `falta #${id}`);
  }
  const desktop = read('js/desktop.js');
  assert.match(desktop, /if \(!bridge\?\.isDesktop\) return;/);
  assert.match(desktop, /localStorage\.clear\(\)/);
  assert.match(desktop, /parsed\.app !== 'overclock9'/);
  assert.match(desktop, /ui\.pauseAndSave\(\)/, 'debe pausar al perder el foco');
  assert.match(desktop, /setFullscreen/);
});

test('build.bat genera el ejecutable con una sola orden', () => {
  const bat = read('build.bat');
  assert.match(bat, /tools\\build\.mjs/);
  assert.match(bat, /--watch/);
  assert.match(bat, /--check/);
  assert.match(bat, /--serve/);
});

test('el juego no depende de recursos externos', () => {
  const html = read('index.html');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html));
  assert.ok(!/https?:\/\/[^"']+\.(js|css|png|woff2?)/.test(html));
  assert.ok(!/file:\/\//.test(read('js/main.js')));
});
