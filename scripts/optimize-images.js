#!/usr/bin/env node
// scripts/optimize-images.js — Convierte a WebP real y redimensiona las imágenes de img/.
// Uso: npm install && npm run images
// · Archivos .png/.jpg/.jpeg → se crea el .webp equivalente (el original se deja para que lo borres tú).
// · Archivos .webp que en realidad son PNG/JPG, o más anchos de MAX_WIDTH → se recodifican en su sitio.

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'img');
const MAX_WIDTH = 1600;
const QUALITY = 82;
const KEEP_AS_IS = new Set(['PimpoliDev.png']); // imagen para redes sociales (Open Graph)

(async () => {
  for (const name of fs.readdirSync(DIR)) {
    const ext = path.extname(name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || KEEP_AS_IS.has(name)) continue;

    const file = path.join(DIR, name);
    const meta = await sharp(file).metadata();
    const needsResize = meta.width > MAX_WIDTH;
    const isFakeWebp = ext === '.webp' && meta.format !== 'webp';
    if (ext === '.webp' && !isFakeWebp && !needsResize) continue;

    const out = ext === '.webp' ? file : file.slice(0, -ext.length) + '.webp';
    const before = fs.statSync(file).size;
    const buf = await sharp(file)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer();
    fs.writeFileSync(out, buf);
    console.log(`${name} (${meta.format} ${meta.width}px, ${Math.round(before / 1024)} KB) → ${path.basename(out)} ${Math.round(buf.length / 1024)} KB`);
  }
})();
