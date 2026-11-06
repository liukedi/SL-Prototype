// Map tiles from tile packs (tilepacks/{z}/{x>>2}-{y>>2}.bin, made by scripts/pack-tiles.mjs):
// the style asks for packed://{z}/{x}/{y}; the pack holding the tile is fetched once and kept,
// and the tile is un-gzipped here. A tile that isn't in the offline copy comes back empty.
const PACK_SHIFT = 2; // keep in step with scripts/pack-tiles.mjs

const packs = new Map(); // "z/px-py" → Promise<{ header, body } | null>

function loadPack(z, px, py) {
  const key = `${z}/${px}-${py}`;
  if (!packs.has(key)) {
    const url = new URL(`tilepacks/${key}.bin`, document.baseURI);
    packs.set(key, fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf) return null;
        const len = new DataView(buf).getUint32(0, true);
        const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
        return { header, body: new Uint8Array(buf, 4 + len) };
      })
      .catch(() => { packs.delete(key); return null; })); // a network error may be retried
  }
  return packs.get(key);
}

const gunzip = (bytes) =>
  new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();

export function registerTilePacks(maplibregl) {
  maplibregl.addProtocol('packed', async ({ url }) => {
    const [z, x, y] = url.slice('packed://'.length).split('/').map(Number);
    const pack = await loadPack(z, x >> PACK_SHIFT, y >> PACK_SHIFT);
    const entry = pack?.header[`${x}/${y}`];
    if (!entry) return { data: new ArrayBuffer(0) };
    return { data: await gunzip(pack.body.subarray(entry[0], entry[0] + entry[1])) };
  });
}
