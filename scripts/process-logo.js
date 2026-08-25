#!/usr/bin/env node
/**
 * Quita fondo negro / spotlight gris del logo → PNG transparente.
 * Usa flood-fill desde los bordes para no tocar anti-aliasing interno del texto.
 */
const path = require('path');
const sharp = require('sharp');

const LOGO = path.join(__dirname, '../docs/assets/tnfg-logo.png');

function isBackgroundPixel(r, g, b, a) {
  if (a < 10) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Negro y sombras muy oscuras del fondo
  if (max < 50) return true;
  // Spotlight gris neutro del fondo original
  if (max < 105 && chroma < 22) return true;
  return false;
}

/** Sombras 3D de las barras y halo negro residual (no conectadas al borde). */
function isStrayBackground(r, g, b, a) {
  if (a < 10) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Halo negro / gris muy oscuro en bordes del logo
  if (max < 42 && chroma < 18) return true;
  // Sombra oscura cyan de las barras (sobre fondo negro original)
  if (max < 60 && r < 45 && b >= g && g > r + 5) return true;
  return false;
}

function floodFillBackground(data, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  let removed = 0;
  for (let idx = 0; idx < total; idx++) {
    if (!visited[idx]) continue;
    const i = idx * 4;
    if (data[i + 3] > 0) {
      data[i + 3] = 0;
      removed += 1;
    }
  }
  return removed;
}

async function processLogoTransparent(inputPath = LOGO) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  floodFillBackground(data, info.width, info.height);

  for (let i = 0; i < data.length; i += 4) {
    if (isStrayBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .trim({ threshold: 1 })
    .toFile(inputPath);

  const meta = await sharp(inputPath).metadata();
  return { width: meta.width, height: meta.height };
}

async function main() {
  const { width, height } = await processLogoTransparent();
  console.log(`✓ Logo transparente: ${LOGO} (${width}×${height})`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { processLogoTransparent, isBackgroundPixel, isStrayBackground, floodFillBackground };
