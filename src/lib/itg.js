// ITG: target per toko untuk 2 bulan (ganjil-genap). Tiap bulan min 70%, total 2 bulan min 100%. Cashback potensi = % class x target 2 bulan.
import * as XLSX from 'xlsx';
import { grid, key, str, toNum } from './table.js';

export const CLASS_PCT = { MEDIUM: 1.0, BIG: 1.5, SUPERBIG: 1.75, 'SUPERBIG+': 2.0 };
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGS: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12 };
export const monthPair = (m) => { const a = m % 2 === 1 ? m : m - 1; return [a, a + 1]; };

export function parseItg(wb, o = {}) {
  const warn = [];
  const ws = wb.Sheets[wb.SheetNames.find((n) => key(n) === 'ITG') || wb.SheetNames[0]];
  const g = grid(ws);
  let hr = -1;
  for (let r = 0; r < Math.min(g.length, 40); r++) {
    const up = (g[r] || []).map((v) => key(v));
    if (up.includes('IDPELANGGAN') && (up.some((x) => x.startsWith('TARGET')) || up.includes('CLASS'))) { hr = r; break; }
  }
  if (hr < 0) throw new Error('Header ITG tidak ketemu (butuh kolom ID Pelanggan dan Target <bulan>).');
  const H = g[hr].map((v) => str(v));
  const col = (re) => H.findIndex((h) => re.test(key(h)));
  const iId = col(/^IDPELANGGAN$/), iSales = col(/^NAMASALESMAN$|^SALESMAN$/), iName = col(/^NAMAPELANGGAN$/), iCls = col(/^CLASS$/), iL2 = col(/^TOTALL2M$|^TOTALL3M$/), iFb = col(/^FEEDBACK$/);
  const tcols = [];
  H.forEach((h, i) => { const m = /^TARGET\s+([A-Za-z]{3})\w*\s*(\d{2,4})?/i.exec(h.trim()); if (m && MON[m[1].toUpperCase()]) tcols.push({ i, m: MON[m[1].toUpperCase()], y: m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : null, label: m[1].toUpperCase() }); });
  if (tcols.length < 1) throw new Error('Kolom "Target <bulan>" tidak ketemu');
  const months = tcols.slice(0, 2);
  const items = [];
  for (let r = hr + 1; r < g.length; r++) {
    const row = g[r] || [];
    const id = str(row[iId]);
    if (!id) continue;
    items.push({ id, sales: str(row[iSales]), name: str(row[iName]) || id, cls: str(row[iCls]) || 'Medium', l2m: toNum(row[iL2]), t: months.map((c) => Math.round(toNum(row[c.i]))), fb: iFb >= 0 ? str(row[iFb]) : '' });
  }
  if (!items.length) throw new Error('Tabel ITG terbaca tapi kosong');
  if (months.length < 2) warn.push('Info: hanya satu kolom target bulan yang ditemukan');
  return { data: { items, months: months.map(({ m, y, label }) => ({ m, y, label })), warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: wb.SheetNames[0], rows: items.length, cols: [] }] } };
}

const clsKey = (c) => String(c || '').toUpperCase().replace(/\s/g, '');
export function itgCompute(data, mode, time) {
  const itg = data.itgList;
  if (!itg) return null;
  const factor = mode === 'bti' ? 1 : 1.1;
  const [m1, m2] = itg.months.length === 2 ? [itg.months[0].m, itg.months[1].m] : monthPair(time.m);
  const stores = new Map(data.stores.map((s) => [s.id, s]));
  const salesAct = {};
  for (const s of data.stores) salesAct[s.sales] = (salesAct[s.sales] || 0) + s.act;
  const rows = itg.items.map((x) => {
    const st = stores.get(x.id);
    const t1 = Math.round((x.t[0] || 0) * factor), t2 = Math.round((x.t[1] || 0) * factor);
    // bulan berjalan = time.m; bulan sebelumnya = LM toko
    let a1 = 0, a2 = 0, know1 = false, know2 = false;
    if (st) {
      if (time.m === m1) { a1 = st.act; know1 = true; }
      else if (time.m === m2) { a1 = st.lm; a2 = st.act; know1 = true; know2 = true; }
    }
    const p1 = t1 > 0 ? a1 / t1 : null, p2 = t2 > 0 ? a2 / t2 : null;
    const T = t1 + t2, A = a1 + a2;
    const total = T > 0 ? A / T : null;
    const done2 = time.m === m2;
    const pass1 = p1 != null && p1 >= 0.7, pass2 = p2 != null && p2 >= 0.7;
    let status = 'berjalan';
    if (done2) status = pass1 && pass2 && total >= 1 ? 'tercapai' : (!pass1 || (p2 != null && p2 < 0.7 && time.tg >= 1)) ? 'gagal syarat' : 'berjalan';
    const pct = CLASS_PCT[clsKey(x.cls)] ?? CLASS_PCT.MEDIUM;
    return { ...x, sales: st?.sales || x.sales, store: st, t1, t2, T, a1, a2, A, p1, p2, total, pass1, pass2, status, pct, reward: Math.round((T * pct) / 100), gap: Math.max(0, T - A), know1, know2 };
  });
  const byCls = {};
  const bySales = {};
  for (const r of rows) {
    const c = (byCls[r.cls] ||= { cls: r.cls, n: 0, T: 0, A: 0, ok: 0 });
    c.n++; c.T += r.T; c.A += r.A; if (r.status === 'tercapai') c.ok++;
    const s = (bySales[r.sales] ||= { sales: r.sales, n: 0, T: 0, A: 0, act: 0, ok: 0 });
    s.n++; s.T += r.T; s.A += r.A; s.act += r.store?.act || 0; if (r.status === 'tercapai') s.ok++;
  }
  for (const s of Object.values(bySales)) { s.salesAct = salesAct[s.sales] || 0; s.share = s.salesAct ? s.act / s.salesAct : 0; }
  return { rows, byCls: Object.values(byCls), bySales: Object.values(bySales), months: [m1, m2], factor };
}

// rekomendasi: kontribusi SKU / kategori terbesar toko itu
export function topSkus(data, id, n = 3) {
  const cur = data.cat?.cur?.[id] || {};
  const tot = Object.values(cur).reduce((a, b) => a + b, 0) || 0;
  return Object.entries(cur).map(([i, v]) => ({ i: +i, sb: data.subs[i], v, share: tot ? v / tot : 0 })).sort((a, b) => b.v - a.v).slice(0, n);
}
