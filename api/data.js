// Vercel Function: simpan/ambil data per depo × tim × slot di Vercel Blob. Tanpa password.
// Env: BLOB_READ_WRITE_TOKEN (otomatis dari Vercel Blob).
import { put, list, del } from '@vercel/blob';

const PREFIX = 'sales-data/';
const TEAMS = ['arjuna', 'bima'];
const DEPOTS = ['kebayoran', 'kapuk'];
const SLOTS = ['main', 'sku', 'val', 'prog', 'promo', 'rules', 'progcat', 'itg', 'sodo', 'ctarget', 'itgcfg', 'market', 'itgscup', 'scuphist'];

export const config = { api: { bodyParser: { sizeLimit: '4.4mb' } } };

// nama file: sales-data/<depo>/<tim>/<slot>-<acak>.json | sales-data/<depo>/skudb-<acak>.json | data lama: sales-data/<tim>-<acak>.json (= Kebayoran, slot main)
function classify(pathname) {
  const p = pathname.replace(PREFIX, '');
  const parts = p.split('/');
  if (parts.length === 3) return { depot: parts[0], team: parts[1], slot: parts[2].split('-')[0].replace('.json', '') };
  if (parts.length === 2 && parts[1].startsWith('skudb')) return { depot: parts[0], team: '*', slot: 'skudb' };
  const legacy = TEAMS.find((t) => parts[0].startsWith(t)) || (parts[0].startsWith('data') ? 'arjuna' : null);
  return legacy ? { depot: 'kebayoran', team: legacy, slot: 'main', legacy: true } : null;
}

const latest = (arr) => [...arr].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  try {
    if (q.action === 'ping') return res.status(200).json({ ok: true });
    const team = String(req.headers['x-team'] || q.team || '');
    const depot = String(q.depot || '');
    if (!TEAMS.includes(team)) return res.status(400).json({ error: 'Tim tidak valid' });
    if (!DEPOTS.includes(depot)) return res.status(400).json({ error: 'Depo tidak valid' });

    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PREFIX });
      const mine = blobs.map((b) => ({ b, c: classify(b.pathname) })).filter((x) => x.c && x.c.depot === depot);
      const out = { main: null, sku: null, val: null, prog: null, promo: null, rules: null, progcat: null, itg: null, sodo: null, ctarget: null, itgcfg: null, market: null, itgscup: null, scuphist: null, skudb: null };
      for (const slot of [...SLOTS, 'skudb']) {
        const cands = mine.filter((x) => x.c.slot === slot && (slot === 'skudb' || x.c.team === team));
        if (!cands.length) continue;
        const r = await fetch(latest(cands.map((x) => x.b)).url, { cache: 'no-store' });
        out[slot] = await r.json();
      }
      return res.status(200).json(out);
    }

    if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
      const slot = String(q.slot || '');
      if (![...SLOTS, 'skudb'].includes(slot)) return res.status(400).json({ error: 'Slot tidak valid' });
      const dir = slot === 'skudb' ? `${PREFIX}${depot}/` : `${PREFIX}${depot}/${team}/`;
      const match = (c) => c && c.depot === depot && c.slot === slot && (slot === 'skudb' || c.team === team);

      if (req.method === 'DELETE') {
        const { blobs } = await list({ prefix: PREFIX });
        const old = blobs.filter((b) => match(classify(b.pathname))).map((b) => b.url);
        if (old.length) await del(old);
        return res.status(200).json({ ok: true });
      }
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!body || body.length < 20) return res.status(400).json({ error: 'Data kosong' });
      const saved = await put(`${dir}${slot}.json`, body, { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
      const { blobs } = await list({ prefix: PREFIX });
      const old = blobs.filter((b) => b.url !== saved.url && match(classify(b.pathname))).map((b) => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ ok: true, bytes: body.length });
    }
    return res.status(405).json({ error: 'Method tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
