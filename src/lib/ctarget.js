// Target per kategori / principal, per salesman atau per toko (BTI; milestone = BTI x 110%).
// Target salesman dibagi ke toko memakai kontribusi L3M toko terhadap total L3M salesman (sama dengan target DAP); kalau L3M kosong, memakai porsi omset toko di kategori itu. Estimasi, ditandai ~.
import { grid, key, str, toNum } from './table.js';

export const nk = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const catOf = (sb) => sb.k || (sb.b && sb.b !== '-' ? sb.b : '');
const tokens = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

export function parseCTarget(wb, o = {}) {
  const items = [];
  const warn = [];
  for (const n of wb.SheetNames) {
    const g = grid(wb.Sheets[n]);
    const hr = g.findIndex((r) => { const k = (r || []).map(key); return k.includes('TARGET') && (k.includes('KATEGORI') || k.includes('CATEGORY') || k.includes('PRINCIPAL')); });
    if (hr < 0) continue;
    const H = g[hr].map(key);
    const c = (...names) => names.map((x) => H.indexOf(x)).find((i) => i >= 0) ?? -1;
    const iS = c('SALESMAN', 'NAMASALESMAN'), iId = c('IDPELANGGAN', 'IDTOKO'), iK = c('KATEGORI', 'CATEGORY'), iP = c('PRINCIPAL'), iT = c('TARGET'), iB = c('BASIS');
    for (let r = hr + 1; r < g.length; r++) {
      const row = g[r] || [];
      const t = toNum(row[iT]);
      const kat = iK >= 0 ? str(row[iK]) : '', pr = iP >= 0 ? str(row[iP]) : '';
      const sales = iS >= 0 ? str(row[iS]) : '', id = iId >= 0 ? str(row[iId]) : '';
      if (!t || (!kat && !pr) || (!sales && !id)) continue;
      const mil = iB >= 0 && /MILESTONE/i.test(str(row[iB]));
      const bti = mil ? t / 1.1 : t;
      if (kat) items.push({ s: sales, id, kind: 'kat', key: kat, t: Math.round(bti) });
      if (pr) items.push({ s: sales, id, kind: 'prin', key: pr, t: Math.round(bti) });
    }
  }
  if (!items.length) throw new Error('Tabel target tidak terbaca: butuh kolom Target, Kategori atau Principal, dan Salesman atau ID Pelanggan');
  if (!items.some((x) => x.id) && !items.some((x) => x.s)) warn.push('Tidak ada Salesman maupun ID Pelanggan');
  return { data: { items, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: wb.SheetNames[0], rows: items.length, cols: [] }] } };
}

// indeks hitung: target per toko dan per salesman untuk kind ('kat'|'prin') + key
export function ctargetIndex(data, mode = 'milestone') {
  const items = data?.ctarget?.items || [];
  if (!items.length) return { has: false, storeT: () => ({ t: 0, est: false }), salesT: () => 0, keys: { kat: new Set(), prin: new Set() } };
  const f = mode === 'bti' ? 1 : 1.1;
  const keys = { kat: new Set(), prin: new Set() };
  for (const x of items) keys[x.kind].add(nk(x.key));
  const matchSub = (sb, kind, k) => (kind === 'kat' ? nk(catOf(sb)) === k : nk(sb.p) === k);
  const subIdx = new Map();
  const idxOf = (kind, k) => { const kk = kind + k; if (!subIdx.has(kk)) subIdx.set(kk, data.subs.map((sb, i) => (matchSub(sb, kind, k) ? i : -1)).filter((i) => i >= 0)); return subIdx.get(kk); };
  const valOf = (id, kind, k) => { const cur = data.cat?.cur?.[id]; if (!cur) return 0; let v = 0; for (const i of idxOf(kind, k)) v += cur[i] || 0; return v; };
  const salesOfName = (so) => { const t = tokens(so)[0]; return data.salesmen.find((n) => tokens(n).includes(t)) || so; };
  const storesBy = {};
  for (const s of data.stores) (storesBy[s.sales] ||= []).push(s);
  const l3Cache = new Map();
  const salesL3 = (sales) => { if (!l3Cache.has(sales)) l3Cache.set(sales, (storesBy[sales] || []).reduce((a, s) => a + (s.l3m || 0), 0)); return l3Cache.get(sales); };
  const salesVal = new Map();
  const sv = (sales, kind, k) => { const kk = sales + kind + k; if (!salesVal.has(kk)) salesVal.set(kk, (storesBy[sales] || []).reduce((a, s) => a + valOf(s.id, kind, k), 0)); return salesVal.get(kk); };
  const byStore = new Map(), bySales = new Map();
  for (const x of items) {
    const k = nk(x.key);
    if (x.id) byStore.set(x.id + x.kind + k, (byStore.get(x.id + x.kind + k) || 0) + x.t);
    else bySales.set(salesOfName(x.s) + x.kind + k, (bySales.get(salesOfName(x.s) + x.kind + k) || 0) + x.t);
  }
  const stIdx = new Map(data.stores.map((s) => [s.id, s]));
  return {
    has: true,
    keys,
    storeT(id, kind, key0) {
      const k = nk(key0);
      const ex = byStore.get(id + kind + k);
      if (ex != null) return { t: Math.round(ex * f), est: false };
      const st = stIdx.get(id);
      const tot = st ? bySales.get(st.sales + kind + k) : null;
      if (tot == null) return { t: 0, est: false };
      const l3 = salesL3(st.sales);
      if (l3 > 0) return { t: Math.round((tot * f * (st.l3m || 0)) / l3), est: true };
      const denom = sv(st.sales, kind, k);
      if (denom <= 0) return { t: 0, est: true };
      return { t: Math.round((tot * f * valOf(id, kind, k)) / denom), est: true };
    },
    salesT(name, kind, key0) {
      const k = nk(key0);
      let t = bySales.get(name + kind + k) || 0;
      for (const s of storesBy[name] || []) t += byStore.get(s.id + kind + k) || 0;
      return Math.round(t * f);
    },
  };
}
export const valueOfStore = (data, id, kind, key0) => {
  const k = nk(key0); let v = 0;
  const cur = data.cat?.cur?.[id] || {};
  data.subs.forEach((sb, i) => { if ((kind === 'kat' ? nk(catOf(sb)) === k : nk(sb.p) === k)) v += cur[i] || 0; });
  return v;
};
