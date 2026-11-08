// Tabel DAP yang bisa disusun bebas: satu halaman boleh berisi banyak tabel (Rp dan Qty terpisah, Top toko, program ON faktur).
// Tiap tabel punya pilihan item (SKU / kategori / principal) dengan Target, Actual, Gap, % Ach, dan L3M per bulan / per kunjungan.
import { buildDap, catOptions, focusName, focusVal, skuOptions } from './dapModel.js';
import { ctargetIndex, nk } from './ctarget.js';
import { skuView } from './skuBlocks.js';
import { fmtMoney } from './unit.js';

export const IM = [['t', 'Target'], ['a', 'Actual'], ['g', 'Gap'], ['p', '% Ach']];
export const L3 = [['l3', 'L3M / bulan'], ['l3k', 'L3M / kunjungan']];
// kolom dasar yang boleh dipilih: tabel Rp memakai semua, tabel Qty hanya kolom identitas dan qty
export const BASE_RP = [['ch', 'Channel'], ['par', 'Pareto'], ['size', 'Ukuran'], ['t', 'Target DAP'], ['tv', 'Target/Kunj'], ['a', 'Actual'], ['gap', 'Gap'], ['sisa', 'Sisa'], ['plan', 'PLAN'], ['e', 'Estimasi'], ['so', 'Actual SO'], ['qty', 'Qty MTD'], ['lm', 'Bulan lalu'], ['l3m', 'L3M/bln'], ['vsLm', 'vs bulan lalu'], ['ca', 'CA'], ['note', 'Catatan'], ['blank', 'Kolom kosong']];
export const BASE_QTY = [['ch', 'Channel'], ['par', 'Pareto'], ['size', 'Ukuran'], ['sisa', 'Sisa'], ['qty', 'Qty MTD'], ['note', 'Catatan'], ['blank', 'Kolom kosong']];

export const uid = () => 'b' + Math.random().toString(36).slice(2, 8);
export const newBlock = (type = 'dap', metric = 'rp') => ({
  id: uid(), type, metric,
  title: type === 'on' ? 'Program ON faktur' : type === 'top' ? `Top toko (${metric === 'qty' ? 'Qty' : 'Rp'})` : `DAP (${metric === 'qty' ? 'Qty' : 'Rp'})`,
  cols: metric === 'qty' ? ['ch', 'sisa', 'qty', 'note'] : ['ch', 't', 'tv', 'a', 'gap', 'sisa', 'plan', 'note'],
  picks: [], im: metric === 'qty' ? ['a'] : ['t', 'a', 'g', 'p'], l3: [],
  topN: 10, sortBy: metric === 'qty' ? 'qty' : 'tv', scope: 'salesman', on: [],
});

const qf = (n) => (n == null || !Number.isFinite(n) ? '-' : Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 1 }));
const pcf = (v) => (v == null || !Number.isFinite(v) ? '-' : Math.round(v * 100) + '%');
const parts = (s) => String(s ?? '').split('/').map((x) => x.trim().toUpperCase()).filter(Boolean);

// L3M per toko per SKU dari export tiga blok (rata-rata per bulan); dipakai untuk item SKU, kategori, dan principal
const L3_CACHE = new WeakMap();
function l3Index(data) {
  if (L3_CACHE.has(data)) return L3_CACHE.get(data);
  const sv = skuView(data.blocks);
  const by = new Map();
  if (sv) {
    const alias = new Map();
    for (const o of skuOptions(data)) for (const p of parts(o.k)) if (!alias.has(p)) alias.set(p, o);
    for (const r of sv.rows) {
      const o = parts(r.sku).map((p) => alias.get(p)).find(Boolean);
      const cat = o ? o.cat || (o.b && o.b !== '-' ? o.b : '') : '';
      const e = { sku: parts(r.sku), cat, prin: nk(r.prin), o3: r.o3 || 0, q3: r.q3 || 0 };
      if (!by.has(r.id)) by.set(r.id, []);
      by.get(r.id).push(e);
    }
  }
  const idx = { by, has: by.size > 0 };
  L3_CACHE.set(data, idx);
  return idx;
}
function itemL3(idx, id, p, metric) {
  const rows = idx.by.get(id);
  if (!rows) return null;
  let v = 0;
  const kp = parts(p.key);
  for (const r of rows) {
    const hit = p.kind === 'sku' ? r.sku.some((x) => kp.includes(x)) : p.kind === 'kat' ? r.cat === p.key : r.prin === nk(p.key);
    if (hit) v += metric === 'qty' ? r.q3 : r.o3;
  }
  return v;
}
export const itemName = (data, p) => (p.kind === 'sku' ? focusName(data, { t: 'sku', k: p.key }) : p.kind === 'kat' ? 'Kategori ' + p.key : 'Principal ' + p.key);
export const principalsOf = (data) => [...new Set(data.subs.map((sb) => sb.p).filter((p) => p && p !== '-'))].sort();
export { catOptions, skuOptions };

// susun satu tabel untuk satu tanggal. cfg = pengaturan DAP bersama (edits, minOrder, pekan); hidden = {id:1} baris yang disembunyikan di tanggal ini
export function buildBlock(data, time, d, holidays, cfg, block, { unit = 'rp', mode = 'milestone', hidden = {} } = {}) {
  const dk = `${time.y}-${String(time.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isQty = block.metric === 'qty';
  const cols = (block.cols || []).filter((k) => (isQty ? BASE_QTY : BASE_RP).some((x) => x[0] === k));
  const hasT = cols.includes('t'), hasTv = cols.includes('tv');
  const m = buildDap(data, time, d, holidays, { ...cfg, cols, tmode: hasT && hasTv ? 'both' : hasTv ? 'visit' : 'total', skuMain: [], kpick: [], par: { ...(cfg.par || {}), on: false }, unit });
  const ci = ctargetIndex(data, mode);
  const idx = l3Index(data);
  const items = (block.picks || []).map((p) => ({ p, f: { t: p.kind === 'kat' ? 'cat' : p.kind, k: p.key }, name: itemName(data, p) }));
  const metrics = [...IM.filter((x) => (block.im || []).includes(x[0])).map((x) => x[0]), ...L3.filter((x) => (block.l3 || []).includes(x[0])).map((x) => x[0])];
  const mlabel = Object.fromEntries([...IM, ...L3]);
  const tail = (() => { let n = 0; for (let i = m.head.length - 1; i >= 0; i--) { if (m.head[i].k === 'note' || m.head[i].k === 'blank') n++; else break; } return n; })();
  const at = m.head.length - tail;
  const itemCols = items.flatMap((it) => metrics.map((mt) => ({ k: `it:${it.p.kind}:${it.p.key}:${block.metric}:${mt}`, label: `${it.name} ${mlabel[mt]}`, ml: mlabel[mt], kb: `${it.p.kind}:${it.p.key}:${block.metric}`, item: it, mt })));
  const head = [...m.head.slice(0, at), ...itemCols.map((c) => ({ k: c.k, label: c.label, ml: c.ml, kb: c.kb, mt: c.mt, al: 'right', item: true })), ...m.head.slice(at)];
  const groupsHead = items.length && metrics.length ? [{ label: '', span: at }, ...items.map((it) => ({ label: it.name, span: metrics.length })), { label: '', span: tail }].filter((g) => g.span > 0) : null;
  const storeBy = new Map(data.stores.map((s) => [s.id + '|' + s.sales.toUpperCase(), s]));
  const BASE = ['t', 'tv', 'a', 'sisa', 'plan'];

  const mkRow = (x) => {
    const r = x.r, ed = x.ed || {};
    const st = storeBy.get(r.id + '|' + r.s.toUpperCase());
    const vis = Math.max(1, r.nv || 1);
    const vals = {};
    const cells = [...x.cells.slice(0, at)];
    const meta = x.cells.slice(0, at).map((_, i) => (i < 3 ? null : { k: m.head[i].k, kind: BASE.includes(m.head[i].k) ? 'base' : 'v', num: BASE.includes(m.head[i].k) }));
    for (const it of items) {
      const fv = focusVal(data, r.id, it.f, ci);
      const l3v = itemL3(idx, r.id, it.p, block.metric);
      let T = isQty ? null : fv.tgt || null, A = isQty ? fv.qty : fv.act;
      const kb = `${it.p.kind}:${it.p.key}:${block.metric}`;
      if (ed.iv?.[kb + ':t'] != null) T = ed.iv[kb + ':t'];
      if (ed.iv?.[kb + ':a'] != null) A = ed.iv[kb + ':a'];
      const G = T == null ? null : A - T, P = T ? A / T : null;
      const L = l3v == null ? null : l3v, LK = l3v == null ? null : l3v / vis;
      vals[kb + ':t'] = T; vals[kb + ':a'] = A; vals[kb + ':l3'] = L; vals[kb + ':l3k'] = LK;
      for (const mt of metrics) {
        const k = `it:${kb}:${mt}`;
        const money = (n) => (n == null ? '-' : isQty ? qf(n) : fmtMoney(n, unit));
        let txt = mt === 't' ? money(T) : mt === 'a' ? money(A) : mt === 'g' ? money(G) : mt === 'p' ? pcf(P) : mt === 'l3' ? money(L) : money(LK);
        if (mt === 't' && fv.est && T != null && ed.iv?.[kb + ':t'] == null) txt += ' ~';
        const iv = mt === 't' || mt === 'a';
        const edited = iv ? ed.iv?.[kb + ':' + mt] != null : ed.v?.[k] != null;
        if (!iv && ed.v?.[k] != null) txt = ed.v[k];
        cells.push(txt);
        meta.push({ k, kind: iv ? 'iv' : 'v', key: kb + ':' + mt, num: iv, edited, neg: mt === 'g' && G != null && G < 0 });
      }
    }
    for (let i = at; i < x.cells.length; i++) { cells.push(x.cells[i]); meta.push(i < 3 ? null : { k: m.head[i].k, kind: BASE.includes(m.head[i].k) ? 'base' : 'v', num: BASE.includes(m.head[i].k) }); }
    const qty = Object.values(data.qty?.cur?.[r.id] || {}).reduce((a, b) => a + b, 0);
    return { r, ed, cells, meta, vals, qty, st };
  };

  let groups = m.groups.map((g) => ({ name: g.name, rows: g.rows.map(mkRow) }));
  const allRows = groups.flatMap((g) => g.rows);
  const nHidden = allRows.filter((x) => hidden[x.r.id]).length;
  groups = groups.map((g) => ({ ...g, rows: g.rows.filter((x) => !hidden[x.r.id]) }));
  const sortVal = (x) => {
    const k = block.sortBy;
    if (k === 'qty') return x.qty;
    if (k === 'itemA' || k === 'itemT') { const it = items[0]; if (!it) return 0; const kb = `${it.p.kind}:${it.p.key}:${block.metric}`; return x.vals[kb + (k === 'itemA' ? ':a' : ':t')] || 0; }
    if (k === 'gap') return x.r.gap;
    return x.r[k] ?? 0;
  };
  if (block.type === 'top') {
    const asc = block.sortBy === 'gap';
    const pick = (rows) => [...rows].sort((a, b) => (asc ? sortVal(a) - sortVal(b) : sortVal(b) - sortVal(a))).slice(0, Math.max(1, block.topN || 10));
    groups = block.scope === 'all' ? [{ name: 'Semua salesman', rows: pick(groups.flatMap((g) => g.rows)) }] : groups.map((g) => ({ ...g, rows: pick(g.rows) }));
  }
  // total per grup dari baris yang tampil
  const money = (n) => (isQty ? qf(n) : fmtMoney(n, unit));
  groups = groups.map((g) => {
    const R = g.rows;
    const sum = (f) => R.reduce((a, x) => a + (f(x) || 0), 0);
    const tot = head.map((c, i) => {
      if (i === 1) return `Total (${R.length} toko)`;
      if (i < 3) return '';
      if (c.item) {
        const kb = c.kb, mt = c.mt;
        const sT = sum((x) => x.vals[kb + ':t']), sA = sum((x) => x.vals[kb + ':a']);
        const hasTgt = R.some((x) => x.vals[kb + ':t'] != null);
        return mt === 't' ? (hasTgt ? money(sT) : '-') : mt === 'a' ? money(sA) : mt === 'g' ? (hasTgt ? money(sA - sT) : '-') : mt === 'p' ? (hasTgt && sT ? pcf(sA / sT) : '-') : mt === 'l3' ? money(sum((x) => x.vals[kb + ':l3'])) : money(sum((x) => x.vals[kb + ':l3k']));
      }
      const k = c.k;
      return k === 't' ? money(sum((x) => x.r.t)) : k === 'tv' ? money(sum((x) => x.r.tv)) : k === 'a' ? money(sum((x) => x.r.a)) : k === 'gap' ? money(sum((x) => x.r.gap)) : k === 'plan' ? money(sum((x) => x.r.plan)) : k === 'qty' ? qf(sum((x) => x.qty)) : '';
    });
    return { ...g, n: R.length, tot };
  });
  return { head, groupsHead, groups, nHidden, dk, wd: m.wd, total: groups.reduce((a, g) => a + g.rows.length, 0) };
}
