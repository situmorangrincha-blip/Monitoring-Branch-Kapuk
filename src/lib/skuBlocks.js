import * as XLSX from 'xlsx';
// Pembaca export Omset per SKU / Qty per SKU yang berisi tiga blok berdampingan:
// bulan berjalan, L3M (ada kolom RATA2 PER BULAN), dan bulan lalu. Blok dikenali dari isi, bukan dari posisi atau nama bulan.
const s = (v) => (v == null ? '' : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const monthKey = (t) => { const m = s(t).toLowerCase().match(/([a-z]{3})[a-z]*\s*(\d{4})/); return m && MON[m[1]] ? Number(m[2]) * 12 + MON[m[1]] : null; };

export function parseSkuBlocks(a, b) {
  const wb = b || a;
  let best = null;
  for (const name of wb.SheetNames) {
    const g = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const hr = g.findIndex((r) => (r || []).some((c) => s(c) === 'szName') && (r || []).some((c) => s(c) === 'SzCustId'));
    if (hr < 0) continue;
    if (!best || g.length > best.g.length) best = { g, hr, name };
  }
  if (!best) return null;
  const { g, hr } = best;
  const head = g[hr];
  const starts = []; head.forEach((c, i) => { if (s(c) === 'szName') starts.push(i); });
  const blocks = starts.map((ci, bi) => {
    const end = starts[bi + 1] ?? head.length;
    const col = {};
    for (let k = ci; k < end; k++) { const t = s(head[k]); if (t) col[t.toUpperCase()] = k; }
    let period = '';
    for (let r = 0; r < hr; r++) { if (/^PERIOD/i.test(s((g[r] || [])[ci]))) { period = s(g[r][ci + 1]); break; } }
    const iVal = col['NETSALESPKD'] ?? col['TOTAL SALESUNIT'] ?? [...Object.entries(col)].find(([k]) => /SALES|OMSET|QTY|UNIT/.test(k) && !/RATA/.test(k))?.[1];
    const kind = col['NETSALESPKD'] != null ? 'omset' : /UNIT|QTY/.test(Object.keys(col).join(' ')) ? 'qty' : 'omset';
    const rows = [];
    for (let r = hr + 1; r < g.length; r++) {
      const row = g[r] || [];
      const sales = s(row[ci]);
      if (!sales) continue;
      if (/GRAND TOTAL/i.test(sales) || /GRAND TOTAL/i.test(s(row[ci + 1]))) break;
      const id = s(row[col['SZCUSTID']]);
      const sku = s(row[col['SZNICKNAME']]);
      if (!id || !sku) continue;
      rows.push({ sales, id, sku, sub: s(row[col['SUBBRAND']]), prin: s(row[col['PRINCIPAL']]), v: num(row[iVal]), avg: col['RATA2 PER BULAN'] != null ? num(row[col['RATA2 PER BULAN']]) : null });
    }
    return { period, mk: monthKey(period), hasAvg: col['RATA2 PER BULAN'] != null, kind, rows };
  });
  const l3 = blocks.find((b) => b.hasAvg);
  const rest = blocks.filter((b) => b !== l3).sort((a, b) => (b.mk || 0) - (a.mk || 0));
  const roles = { cur: rest[0] || null, lm: rest[1] || null, l3m: l3 || null };
  const kind = blocks[0]?.kind || 'omset';
  const map = new Map();
  const put = (role, b) => {
    if (!b) return;
    for (const r of b.rows) {
      const k = r.id + '|' + r.sku;
      const e = map.get(k) || { id: r.id, sales: r.sales, sku: r.sku, sub: r.sub, prin: r.prin, cur: 0, lm: 0, l3: 0 };
      if (role === 'l3m') e.l3 += r.avg != null ? r.avg : r.v / 3; else e[role] += r.v;
      map.set(k, e);
    }
  };
  put('cur', roles.cur); put('lm', roles.lm); put('l3m', roles.l3m);
  const periods = { cur: roles.cur?.period || '', lm: roles.lm?.period || '', l3m: roles.l3m?.period || '' };
  const sums = { cur: roles.cur?.rows.reduce((a, r) => a + r.v, 0) || 0, lm: roles.lm?.rows.reduce((a, r) => a + r.v, 0) || 0, l3m: roles.l3m?.rows.reduce((a, r) => a + (r.avg ?? r.v / 3), 0) || 0 };
  return { kind, periods, sums, rows: [...map.values()] };
}

// gabungkan omset dan qty (kunci: ID pelanggan + kode SKU)
export function mergeSku(om, qt) {
  const m = new Map();
  for (const r of om?.rows || []) m.set(r.id + '|' + r.sku, { id: r.id, sales: r.sales, sku: r.sku, sub: r.sub, prin: r.prin, oc: r.cur, ol: r.lm, o3: r.l3, qc: 0, ql: 0, q3: 0 });
  for (const r of qt?.rows || []) {
    const k = r.id + '|' + r.sku;
    const e = m.get(k) || { id: r.id, sales: r.sales, sku: r.sku, sub: r.sub, prin: r.prin, oc: 0, ol: 0, o3: 0, qc: 0, ql: 0, q3: 0 };
    e.qc = r.cur; e.ql = r.lm; e.q3 = r.l3;
    m.set(k, e);
  }
  return [...m.values()];
}

// bentuk ringkas untuk disimpan di slot (kamus string + baris angka)
export function packBlocks(res) {
  const D = { id: [], sku: [], sales: [], sub: [], prin: [] };
  const X = { id: new Map(), sku: new Map(), sales: new Map(), sub: new Map(), prin: new Map() };
  const ix = (k, v) => { if (!X[k].has(v)) { X[k].set(v, D[k].length); D[k].push(v); } return X[k].get(v); };
  const r1 = (n) => Math.round(n * 10) / 10;
  return { kind: res.kind, periods: res.periods, dict: D, rows: res.rows.map((r) => [ix('id', r.id), ix('sku', r.sku), ix('sales', r.sales), ix('sub', r.sub), ix('prin', r.prin), r1(r.cur), r1(r.lm), r1(r.l3)]) };
}
// gabungkan omset dan qty (bentuk ringkas) jadi baris siap pakai halaman Ranking SKU
export function mergePacked(om, qt) {
  const m = new Map();
  const add = (pk, kind) => {
    if (!pk) return;
    for (const r of pk.rows) {
      const id = pk.dict.id[r[0]], sku = pk.dict.sku[r[1]], k = id + '|' + sku;
      const e = m.get(k) || { id, sku, sales: pk.dict.sales[r[2]], sub: pk.dict.sub[r[3]], prin: pk.dict.prin[r[4]], oc: 0, ol: 0, o3: 0, qc: 0, ql: 0, q3: 0 };
      if (kind === 'om') { e.oc = r[5]; e.ol = r[6]; e.o3 = r[7]; } else { e.qc = r[5]; e.ql = r[6]; e.q3 = r[7]; }
      m.set(k, e);
    }
  };
  add(om, 'om'); add(qt, 'qt');
  return { periods: om?.periods || qt?.periods || {}, qperiods: qt?.periods || om?.periods || {}, rows: [...m.values()] };
}
const CACHE = new WeakMap();
export function skuView(blocks) {
  if (!blocks || (!blocks.om && !blocks.qt)) return null;
  if (!CACHE.has(blocks)) CACHE.set(blocks, mergePacked(blocks.om, blocks.qt));
  return CACHE.get(blocks);
}
