/**
 * Generates the SabiPass brand assets.
 *
 *   node scripts/make-brand-assets.mjs
 *
 * The mark is an answer-sheet bubble row: four options, one filled. It is
 * generated rather than drawn so it stays reproducible and tweakable — change a
 * constant, re-run, review the diff. A binary nobody can edit is worse than a
 * script anyone can.
 *
 * Legibility at 48px drove the layout. A single row of four bubbles in a square
 * canvas leaves each one too small to read once scaled down, so this uses a 2x2
 * grid: same "four options, one chosen" idea, roughly double the diameter.
 *
 * Written with a minimal PNG encoder (zlib is in Node) to avoid pulling in an
 * image library for four files.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'assets', 'images');

// Straight from src/theme.ts — the mark must not drift from the app palette.
const INK = [0x0e, 0x0c, 0x0a];
const OCHRE = [0xe0, 0x90, 0x2f];
const PAPER = [0xe9, 0xe2, 0xd5];

// ---------------------------------------------------------------- PNG encoder

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 = compression, filter, interlace — all 0

  // Each scanline is prefixed with its filter type. 0 (None) is plenty here:
  // the artwork is flat colour, so deflate handles it well regardless.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- drawing

function canvas(size, bg) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = bg ? bg[0] : 0;
    buf[i * 4 + 1] = bg ? bg[1] : 0;
    buf[i * 4 + 2] = bg ? bg[2] : 0;
    buf[i * 4 + 3] = bg ? 255 : 0;
  }
  return buf;
}

/** Composites a colour over a pixel at the given coverage (0..1). */
function blend(buf, size, x, y, colour, coverage) {
  if (coverage <= 0 || x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const a = Math.min(1, coverage);
  const dstA = buf[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  for (let k = 0; k < 3; k++) {
    buf[i + k] = Math.round(
      (colour[k] * a + buf[i + k] * dstA * (1 - a)) / (outA || 1),
    );
  }
  buf[i + 3] = Math.round(outA * 255);
}

/**
 * Draws a filled disc, or an annulus when innerR > 0.
 * 4x4 supersampling — cheap, and these are static assets.
 */
function disc(buf, size, cx, cy, outerR, innerR, colour) {
  const S = 4;
  const x0 = Math.max(0, Math.floor(cx - outerR - 1));
  const x1 = Math.min(size - 1, Math.ceil(cx + outerR + 1));
  const y0 = Math.max(0, Math.floor(cy - outerR - 1));
  const y1 = Math.min(size - 1, Math.ceil(cy + outerR + 1));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px = x + (sx + 0.5) / S;
          const py = y + (sy + 0.5) / S;
          const d = Math.hypot(px - cx, py - cy);
          if (d <= outerR && d >= innerR) hits++;
        }
      }
      blend(buf, size, x, y, colour, hits / (S * S));
    }
  }
}

/**
 * The mark: four bubbles in a 2x2 grid, one filled.
 *
 * `scale` is the fraction of the canvas the whole mark occupies. Android
 * adaptive icons crop to a circle and mask aggressively, so the foreground
 * layer needs a much smaller scale to survive inside the safe zone.
 */
function drawMark(buf, size, { scale, ring, fill }) {
  const span = size * scale;
  const gap = span * 0.12;
  const r = (span - gap) / 4;
  const stroke = Math.max(2, r * 0.22);
  const c0 = size / 2 - r - gap / 2;
  const c1 = size / 2 + r + gap / 2;

  const centres = [
    [c0, c0],
    [c1, c0],
    [c0, c1],
    [c1, c1],
  ];

  centres.forEach(([cx, cy], i) => {
    // Bottom-right is the chosen answer. Filled, so at a glance the mark reads
    // as "one of four selected" rather than as a decorative dot pattern.
    if (i === 3) disc(buf, size, cx, cy, r, 0, fill);
    else disc(buf, size, cx, cy, r, r - stroke, ring);
  });
}

// -------------------------------------------------------------------- outputs

function write(name, size, bg, opts) {
  const buf = canvas(size, bg);
  drawMark(buf, size, opts);
  const path = join(OUT, name);
  writeFileSync(path, encodePng(size, size, buf));
  return `${name}  ${size}x${size}`;
}

mkdirSync(OUT, { recursive: true });

const written = [
  // iOS / store icon: opaque, mark fills most of the tile.
  write('icon.png', 1024, INK, { scale: 0.62, ring: OCHRE, fill: OCHRE }),

  // Android adaptive foreground: transparent, and much smaller — the launcher
  // crops to a circle and can mask up to a third of the layer away.
  write('android-icon-foreground.png', 1024, null, {
    scale: 0.42,
    ring: OCHRE,
    fill: OCHRE,
  }),

  // Splash: transparent mark, tinted by the plugin's backgroundColor per theme.
  write('splash-icon.png', 512, null, { scale: 0.72, ring: OCHRE, fill: OCHRE }),

  // Light-theme splash needs the darker accent for contrast on paper.
  write('splash-icon-light.png', 512, null, {
    scale: 0.72,
    ring: [0x96, 0x59, 0x0b],
    fill: [0x96, 0x59, 0x0b],
  }),

  // Web favicon.
  write('favicon.png', 96, INK, { scale: 0.66, ring: OCHRE, fill: OCHRE }),
];

// Solid ink behind the adaptive foreground; the bubbles carry the colour.
writeFileSync(
  join(OUT, 'android-icon-background.png'),
  encodePng(1024, 1024, canvas(1024, INK)),
);

// Monochrome layer for Android 13+ themed icons: silhouette only, no colour.
{
  const buf = canvas(1024, null);
  drawMark(buf, 1024, {
    scale: 0.42,
    ring: [255, 255, 255],
    fill: [255, 255, 255],
  });
  writeFileSync(join(OUT, 'android-icon-monochrome.png'), encodePng(1024, 1024, buf));
}

console.log('wrote:');
for (const w of written) console.log('  ' + w);
console.log('  android-icon-background.png  1024x1024');
console.log('  android-icon-monochrome.png  1024x1024');
console.log(`\npalette: ink ${PAPER && ''}#0E0C0A · ochre #E0902F · light accent #96590B`);
