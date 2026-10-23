#!/usr/bin/env node
// Generates the two test entry pages from the shared index.html:
//   a/index.html  → version A (baseline)   https://<user>.github.io/<repo>/a/
//   b/index.html  → version B (redesign)   https://<user>.github.io/<repo>/b/
// Both load the same code from the project root (via <base href="../">); only the
// data-variant flag differs. Re-run after editing index.html:
//   node scripts/make-entries.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = await readFile(path.join(root, 'index.html'), 'utf8');
if (!src.includes('data-variant="a"')) throw new Error('index.html must contain <html … data-variant="a">');

for (const variant of ['a', 'b']) {
  const html = src
    .replace('data-variant="a"', `data-variant="${variant}"`)
    .replace(
      '<head>',
      `<head>\n  <!-- GENERATED from ../index.html by scripts/make-entries.mjs. Edit index.html, then re-run. -->\n  <base href="../">`
    );
  await mkdir(path.join(root, variant), { recursive: true });
  await writeFile(path.join(root, variant, 'index.html'), html);
  console.log(`Wrote ${variant}/index.html`);
}
