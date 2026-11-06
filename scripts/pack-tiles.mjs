// Packs the offline map tiles (tiles/{z}/{x}/{y}.pbf, made by scripts/vendor-offline.mjs) into
// tilepacks/{z}/{x>>2}-{y>>2}.bin: 4×4 tiles per file, each tile gzipped. About 600 files instead
// of 7,600 (static hosts limit the file count; EdgeOne Makers counts every deployment's files),
// and tiles arrive compressed even where the host doesn't compress .pbf. Read by js/tile-packs.js.
// File layout: uint32 LE header length, header JSON { "x/y": [offset, length] } (offsets from the
// end of the header), then the gzipped tiles.
// Usage: node scripts/pack-tiles.mjs   (tiles/ itself is not committed: see .gitignore)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tiles');
const OUT = path.join(ROOT, 'tilepacks');
const PACK_SHIFT = 2; // 2^2 = 4 tiles per side; keep in step with js/tile-packs.js

const packs = new Map(); // "z/px-py" → [{ x, y, data }]
for (const z of fs.readdirSync(SRC).filter((d) => /^\d+$/.test(d))) {
  for (const x of fs.readdirSync(path.join(SRC, z))) {
    for (const f of fs.readdirSync(path.join(SRC, z, x)).filter((n) => n.endsWith('.pbf'))) {
      const y = Number(f.slice(0, -4));
      const key = `${z}/${Number(x) >> PACK_SHIFT}-${y >> PACK_SHIFT}`;
      const data = zlib.gzipSync(fs.readFileSync(path.join(SRC, z, x, f)), { level: 9 });
      if (!packs.has(key)) packs.set(key, []);
      packs.get(key).push({ x: Number(x), y, data });
    }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
let tiles = 0;
for (const [key, list] of packs) {
  const header = {};
  let offset = 0;
  for (const t of list) {
    header[`${t.x}/${t.y}`] = [offset, t.data.length];
    offset += t.data.length;
  }
  const json = Buffer.from(JSON.stringify(header));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.length);
  const file = path.join(OUT, `${key}.bin`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([len, json, ...list.map((t) => t.data)]));
  tiles += list.length;
}
fs.copyFileSync(path.join(SRC, 'README.md'), path.join(OUT, 'README.md'));
console.log(`${tiles} tiles → ${packs.size} packs in tilepacks/`);
