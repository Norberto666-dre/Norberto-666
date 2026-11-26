// Genera los iconos de OVERCLOCK 9 por código: PNG, ICO y SVG.
// Sin dependencias ni assets externos. Uso: node tools/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'icons');

// ---------- PNG ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- Dibujo ----------
const CYAN = [0, 243, 255];
const MAGENTA = [255, 0, 255];
const AMBER = [255, 204, 0];
const BG = [5, 5, 10];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Polígono del rayo, en coordenadas 0..1.
const BOLT = [
  [0.560, 0.245], [0.398, 0.560], [0.492, 0.560],
  [0.432, 0.775], [0.618, 0.455], [0.520, 0.455]
];

function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function shapeAt(x, y, scale = 1) {
  // x, y en 0..1 con centro 0.5
  const cx = 0.5 + (x - 0.5) / scale;
  const cy = 0.5 + (y - 0.5) / scale;
  const ringDist = Math.hypot(cx - 0.5, cy - 0.455);
  const ringOuter = 0.262;
  const ringInner = 0.176;
  const ring = smooth(ringOuter, ringOuter - 0.012, ringDist) *
    (1 - smooth(ringInner + 0.012, ringInner, ringDist));
  const boltEdge = 0.006;
  const bolt = inPolygon(cx, cy, BOLT) ? 1 : (
    // suavizado sencillo del borde: muestrear vecinos
    (inPolygon(cx + boltEdge, cy, BOLT) || inPolygon(cx - boltEdge, cy, BOLT) ||
     inPolygon(cx, cy + boltEdge, BOLT) || inPolygon(cx, cy - boltEdge, BOLT)) ? 0.45 : 0
  );
  return { ring, bolt, cx, cy };
}

function renderIcon(size, { maskable = false, rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.78 : 1;
  const radius = size * 0.215;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;

      // Fondo: radial oscuro con un halo central.
      const dist = Math.hypot(x - 0.5, y - 0.46);
      let color = mix(BG, [18, 18, 40], clamp01(1 - dist / 0.72) * 0.85);
      const glow = Math.max(0, 1 - dist / 0.5);
      color = mix(color, [12, 34, 52], glow * 0.55);

      const { ring, bolt } = shapeAt(x, y, scale);

      if (ring > 0) {
        const ringColor = mix(CYAN, [0, 168, 204], clamp01((y - 0.3) / 0.5));
        color = mix(color, ringColor, ring);
        color = mix(color, [220, 255, 255], ring * clamp01(1 - Math.abs(dist - 0.22) / 0.05) * 0.35);
      }

      if (bolt > 0) {
        const boltColor = mix(AMBER, MAGENTA, clamp01((y - 0.28) / 0.5) * 0.55);
        color = mix(color, boltColor, bolt);
      }

      // Rejilla tenue de 3x3 en el fondo, solo visible en tamaños grandes.
      if (size >= 180) {
        const gx = Math.round(x * 3 - 0.5) / 3 + 1 / 6;
        const gy = Math.round(y * 3 - 0.5) / 3 + 1 / 6;
        const d = Math.hypot(x - gx, y - gy);
        const dot = (1 - smooth(0.012, 0.02, d)) * 0.16;
        color = mix(color, [120, 140, 200], dot);
      }

      // Viñeta y esquinas.
      let alpha = 255;
      const edge = Math.min(x, y, 1 - x, 1 - y) * size;
      if (rounded) {
        const qx = Math.max(radius - px, px - (size - radius), 0);
        const qy = Math.max(radius - py, py - (size - radius), 0);
        const corner = Math.hypot(qx, qy);
        alpha = Math.round(255 * (1 - smooth(radius - 1.5, radius + 1.5, corner)));
        if (alpha === 0) {
          rgba[(py * size + px) * 4 + 3] = 0;
          continue;
        }
      }
      const shade = 0.82 + 0.18 * clamp01(edge / (size * 0.08));
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(clamp01(color[0] / 255) * 255 * shade);
      rgba[i + 1] = Math.round(clamp01(color[1] / 255) * 255 * shade);
      rgba[i + 2] = Math.round(clamp01(color[2] / 255) * 255 * shade);
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, size, rgba);
}

function encodeIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#12122a"/>
      <stop offset="1" stop-color="#05050a"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <circle cx="32" cy="29" r="14.5" fill="none" stroke="#00f3ff" stroke-width="5"/>
  <path d="M35 14 24 34h6l-4 14 12-20h-6l4-14z" fill="#ffcc00"/>
</svg>
`;

mkdirSync(outDir, { recursive: true });

const png192 = renderIcon(192);
const png512 = renderIcon(512);
const pngMaskable = renderIcon(512, { maskable: true, rounded: false });
const pngApple = renderIcon(180, { rounded: false });
const png256 = renderIcon(256);

writeFileSync(join(outDir, 'icon-192.png'), png192);
writeFileSync(join(outDir, 'icon-512.png'), png512);
writeFileSync(join(outDir, 'icon-maskable-512.png'), pngMaskable);
writeFileSync(join(outDir, 'apple-touch-icon.png'), pngApple);
writeFileSync(join(outDir, 'icon.png'), png512);
writeFileSync(join(outDir, 'icon.ico'), encodeIco(png256, 256));
writeFileSync(join(outDir, 'favicon.svg'), FAVICON);

console.log('Iconos generados en icons/:');
for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.png', 'icon.ico', 'favicon.svg']) {
  console.log(`  ${name}`);
}
