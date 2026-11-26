import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

function pngSize(file) {
  const bytes = readFileSync(join(root, file));
  assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${file} no es un PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('el manifest declara una PWA instalable en español', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'OVERCLOCK 9');
  assert.equal(manifest.short_name, 'OVERCLOCK 9');
  assert.equal(manifest.lang, 'es');
  assert.equal(manifest.start_url, './?source=pwa');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#05050a');
  assert.ok(manifest.categories.includes('games'));
  assert.ok(manifest.icons.length >= 3);
});

test('los iconos del manifest existen y miden lo que declaran', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const icon of manifest.icons) {
    const file = icon.src.replace(/^\.\//, '');
    assert.ok(existsSync(join(root, file)), `falta ${file}`);
    assert.equal(pngSize(file), icon.sizes, `${file} no coincide con ${icon.sizes}`);
    assert.match(icon.type, /^image\/png$/);
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'any' && icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'any' && icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512'));
  assert.equal(pngSize('icons/apple-touch-icon.png'), '180x180');
  assert.ok(existsSync(join(root, 'icons/favicon.svg')));
});

test('el service worker precarga todo el juego y nada externo', () => {
  const sw = read('sw.js');
  const block = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(block, 'no se encontró PRECACHE en sw.js');
  const list = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

  const modules = readdirSync(join(root, 'js'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => `js/${file}`);
  const expected = [
    './',
    './index.html',
    './css/style.css',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    ...modules.map((file) => `./${file}`)
  ];
  for (const item of expected) assert.ok(list.includes(item), `el precache no incluye ${item}`);
  for (const item of list) {
    if (item === './') continue;
    const file = item.replace(/^\.\//, '');
    assert.ok(existsSync(join(root, file)), `el precache apunta a un archivo inexistente: ${item}`);
  }
  assert.ok(!/https?:\/\//.test(list.join(' ')), 'el precache no debe incluir URLs externas');
  assert.match(sw, /const VERSION = 'overclock9-v\d+';/);
  assert.match(sw, /request\.mode === 'navigate'/, 'la navegación debe ser network-first');
  assert.match(sw, /url\.origin !== self\.location\.origin/, 'el ranking externo no debe cachearse');
  assert.match(sw, /caches\.delete\(key\)/, 'debe limpiar cachés antiguas');
});

test('el service worker y el módulo PWA tienen sintaxis válida', () => {
  for (const file of ['sw.js', 'js/pwa.js']) {
    const result = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('la página enlaza el manifest y los iconos, y no registra SW en escritorio', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /<meta name="theme-color" content="#05050a"/);
  assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
  assert.match(html, /id="btn-install-app"/);
  assert.match(html, /id="btn-install-launcher"/);
  assert.match(html, /class="btn btn-secondary install-btn hidden"/);

  const pwa = read('js/pwa.js');
  assert.match(pwa, /if \(isDesktop\(\)\) return;/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /Añadir a pantalla de inicio/);
  assert.match(pwa, /skip-waiting/);
});

test('no quedan restos del contenedor Android en el código web', () => {
  const html = read('index.html');
  assert.ok(!/OverclockAndroid/.test(html));
  assert.ok(!/Android/.test(read('js/main.js')));
  for (const file of ['js/main.js', 'js/pwa.js', 'js/desktop.js', 'sw.js']) {
    assert.ok(!/\.apk|android\.webview/i.test(read(file)), `${file} menciona Android`);
  }
});
