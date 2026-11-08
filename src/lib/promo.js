// Baca file program (Excel / PDF) lalu cocokkan ke toko yang ada di database (data utama): lewat ID toko dulu, lalu nama toko.
import './polyfill.js';
import * as XLSX from 'xlsx';
import { readTable, key, str, SPEC } from './table.js';

SPEC.promo = { want: ['id', 'name', 'sales', 'program'], need: [] };
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

function index(stores) {
  const byId = new Map();
  const byName = new Map();
  for (const s of stores) {
    const a = byId.get(s.id) || []; a.push(s); byId.set(s.id, a);
    const n = norm(s.name);
    if (n.length >= 5) { const b = byName.get(n) || []; b.push(s); byName.set(n, b); }
  }
  return { byId, byName };
}

function matcher(stores) {
  const ix = index(stores);
  const hit = new Map(); // storeId -> via
  const add = (list, via) => { for (const s of list) if (!hit.has(s.id)) hit.set(s.id, via); return list.length > 0; };
  return {
    hit,
    byId: (v) => ix.byId.has(str(v)) && add(ix.byId.get(str(v)), 'ID'),
    byName: (v) => { const l = ix.byName.get(norm(v)); return !!l && add(l, 'nama'); },
    ix,
  };
}

// ---------- Excel ----------
function fromExcel(buf, stores, fileName) {
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellStyles: false, sheetRows: 60000 });
  const m = matcher(stores);
  const unmatched = [];
  const progNames = new Set();
  let usedTable = false;
  for (const n of wb.SheetNames) {
    const ws = wb.Sheets[n];
    const t = readTable(ws, 'promo');
    if (t && (t.map.id !== undefined || t.map.name !== undefined)) {
      usedTable = true;
      for (const r of t.rows) {
        const id = str(r.id), nm = str(r.name);
        if (!id && !nm) continue;
        if (r.program) progNames.add(str(r.program));
        const ok = (id && m.byId(id)) || (nm && m.byName(nm));
        if (!ok) unmatched.push(id || nm);
      }
    } else {
      // tanpa header jelas: pindai semua sel
      const g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
      for (const row of g) for (const c of row) { if (c == null) continue; const v = str(c); if (v && (m.byId(v) || m.byName(v))) break; }
    }
  }
  const name = progNames.size === 1 ? [...progNames][0] : wb.SheetNames.length === 1 && !/^sheet\d*$/i.test(wb.SheetNames[0]) ? wb.SheetNames[0] : baseName(fileName);
  return { name, hit: m.hit, unmatched, note: usedTable ? '' : 'Tabel dengan header ID/Nama toko tidak ketemu, jadi seluruh sel dipindai dan dicocokkan ke ID atau nama toko.' };
}

// ---------- PDF ----------
async function pdfLines(buf) {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3);
      (rows.get(y) || rows.set(y, []).get(y)).push({ x: it.transform[4], s: it.str });
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')));
  }
  return { lines, pages: doc.numPages };
}

async function fromPdf(buf, stores, fileName) {
  const { lines, pages } = await pdfLines(buf);
  if (!lines.join('').trim()) throw new Error('PDF ini tidak punya teks (kemungkinan hasil scan/foto). Minta versi Excel atau PDF yang teksnya bisa diseleksi.');
  const m = matcher(stores);
  const unmatched = [];
  const idLike = /\b\d{3,5}-\d{3,}\b/g;
  const tokens = /[A-Za-z0-9][A-Za-z0-9\-_/]{3,}/g;
  for (const ln of lines) {
    let found = false;
    for (const t of ln.match(tokens) || []) if (m.ix.byId.has(t)) { m.byId(t); found = true; }
    const padded = ' ' + norm(ln) + ' ';
    for (const [n, list] of m.ix.byName) if (padded.includes(' ' + n + ' ')) { for (const s of list) if (!m.hit.has(s.id)) m.hit.set(s.id, 'nama'); found = true; }
    if (!found) for (const t of ln.match(idLike) || []) if (!m.ix.byId.has(t)) unmatched.push(t);
  }
  return { name: baseName(fileName), hit: m.hit, unmatched, note: `PDF ${pages} halaman, ${lines.length} baris teks dibaca.` };
}

export async function readPromoFile(file, stores) {
  const buf = await file.arrayBuffer();
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const r = isPdf ? await fromPdf(buf, stores, file.name) : fromExcel(buf, stores, file.name);
  const byId = new Map(stores.map((s) => [s.id, s]));
  const rows = [...r.hit.entries()].map(([id, via]) => ({ id, via, name: byId.get(id)?.name || id, sales: byId.get(id)?.sales || '' }));
  return { kind: isPdf ? 'pdf' : 'excel', name: r.name, rows, unmatched: [...new Set(r.unmatched)], note: r.note, fileName: file.name };
}
export { key };
