// Model DAP: kolom bebas pilih, SKU fokus dari database SKU, halaman Fokus Pareto (satu toko = satu kartu).
import { LABELS, dapForDate, parseRoute, roundUp, visitDays, weekdayName } from './calc.js';
import { visitsInMonth } from './dapAuto.js';
import { ctargetIndex, nk, valueOfStore } from './ctarget.js';

let UNIT = 'rp';
const rp = (n) => (UNIT === 'jt' ? ((n || 0) / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n || 0).toLocaleString('id-ID'));
const qf = (n) => (Number.isInteger(n) ? n.toLocaleString('id-ID') : (n || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 }));
const pc = (r) => (r == null ? '-' : Math.round(r * 100) + '%');

export const sbKey = (sb) => sb.c || sb.n;

// kolom identitas selalu ada: No, Nama Toko, ID
export const COLS = [
  { k: 'ch', label: 'Channel', w: 30, get: (r) => r.ch },
  { k: 'par', label: 'Pareto', w: 14, get: (r, c) => (c.store?.pj ? 'P' : '') },
  { k: 'size', label: 'Ukuran', w: 17, get: (r, c) => (c.store?.size && c.store.size !== 'LAINNYA' ? c.store.size : '') },
  { k: 't', label: 'Target DAP', w: 22, al: 'right', get: (r) => rp(r.t) },
  { k: 'tv', label: 'Target/Kunj', w: 22, al: 'right', get: (r) => rp(r.tv) },
  { k: 'a', label: 'Actual', w: 20, al: 'right', get: (r) => rp(r.a) },
  { k: 'gap', label: 'Gap', w: 22, al: 'right', neg: true, get: (r) => rp(r.gap) },
  { k: 'sisa', label: 'Sisa', w: 10, al: 'center', get: (r) => `${r.sisa}x` },
  { k: 'plan', label: 'PLAN', w: 22, al: 'right', bold: true, get: (r) => rp(r.plan) },
  { k: 'e', label: 'Estimasi', w: 20, al: 'right', get: (r) => (r.e ? rp(r.e) : '') },
  { k: 'so', label: 'Actual SO', w: 18, al: 'right', get: (r) => (r.so ? rp(r.so) : '') },
  { k: 'qty', label: 'Qty MTD', w: 17, al: 'right', get: (r, c) => (c.qty ? qf(c.qty) : '') },
  { k: 'lm', get label() { return LABELS.lm; }, w: 19, al: 'right', get: (r, c) => (c.store?.lm ? rp(c.store.lm) : '') },
  { k: 'l3m', label: 'L3M/bln', w: 19, al: 'right', get: (r, c) => (c.store?.l3m ? rp(c.store.l3m) : '') },
  { k: 'vsLm', get label() { return 'vs ' + LABELS.lm; }, w: 14, al: 'right', get: (r, c) => (c.store?.lm && c.tg > 0 ? pc(c.store.act / (c.store.lm * c.tg)) : '') },
  { k: 'ca', label: 'CA', w: 12, al: 'center', get: (r, c) => (c.store ? (c.store.act >= 1 ? 'Ya' : 'Belum') : '') },
  { k: 'note', label: 'Catatan', w: 0, get: () => '' },
  { k: 'blank', label: '', w: 22, get: () => '' },
];
export const COL_BY = Object.fromEntries(COLS.map((c) => [c.k, c]));

export function colFor(k, data) {
  if (COL_BY[k]) return COL_BY[k];
  if (k.startsWith('promo:')) {
    const p = (data.promos || []).find((x) => 'promo:' + x.id === k);
    if (!p) return null;
    const set = new Set(p.ids);
    return { k, label: p.name, w: Math.min(26, Math.max(14, Math.ceil(p.name.length * 1.6))), al: 'center', get: (r) => (set.has(r.id) ? 'Ya' : '') };
  }
  return null;
}
export const promoCols = (data) => (data.promos || []).map((p) => 'promo:' + p.id);

export const DEFAULT_DAP = {
  cols: ['ch', 't', 'a', 'gap', 'sisa', 'plan', 'e', 'so', 'note'], tmode: 'both', src: 'auto',
  skuMain: [], skuMetric: 'qty', kpick: [], kcols: ['act', 'tgt', 'ach'],
  par: { on: false, top: 10, focus: [], fm: ['act', 'tgt', 'ach'], blank: true, notes: true },
  progpick: [], pmetrics: ['t', 'a', 'p'],
  edits: {}, minOrder: { ws: 1000000, rt: 200000 },
};

// SKU yang bisa dipilih: database SKU (kode, nama, brand, kategori) + SKU yang muncul di data qty
export function skuOptions(data) {
  const m = new Map();
  for (const x of data.skudb || []) m.set(x.c, { k: x.c, n: x.n, b: x.b || '', cat: x.k || '', inData: false });
  for (const sb of data.subs) {
    const k = sbKey(sb);
    const o = m.get(k) || { k, n: sb.n, b: sb.b || '', cat: sb.k || '', inData: false };
    o.sub = sb.sub || o.sub || '';
    o.inData = true; o.n = o.n || sb.n; o.b = o.b || sb.b; o.cat = o.cat || sb.k || '';
    m.set(k, o);
  }
  return [...m.values()].sort((a, b) => a.n.localeCompare(b.n));
}
const catOf = (o) => o.sub || o.cat || (o.b && o.b !== '-' ? o.b : '');
export function catOptions(data) {
  return [...new Set(skuOptions(data).map(catOf).filter(Boolean))].sort();
}
// semua SKU dalam satu kategori (kalau database tidak punya kolom kategori, dipakai brand)
export const skusOfCat = (data, cat) => skuOptions(data).filter((o) => catOf(o) === cat);

// nilai satu toko untuk satu item fokus ({t:'sku'|'cat', k})
export function focusVal(data, id, f, ci) {
  let act = 0, qty = 0, tgt = 0, est = false;
  data.subs.forEach((sb, i) => {
    const hit = f.t === 'sku' ? sbKey(sb) === f.k : f.t === 'prin' ? nk(sb.p) === nk(f.k) : (sb.sub || sb.k || sb.b) === f.k || sb.k === f.k;
    if (!hit) return;
    act += data.cat?.cur?.[id]?.[i] || 0;
    qty += data.qty?.cur?.[id]?.[i] || 0;
    tgt += data.skuTgt?.[id]?.[i] || 0;
  });
  if ((f.t === 'cat' || f.t === 'prin') && ci?.has) { const r = ci.storeT(id, f.t === 'cat' ? 'kat' : 'prin', f.k); if (r.t) { tgt = r.t; est = r.est; } }
  return { act, qty, tgt, est };
}
export const progNames = (data) => [...new Set((data.prog || []).map((x) => x.p).filter(Boolean))];
export const focusName = (data, f) => (f.t === 'sku' ? (skuOptions(data).find((x) => x.k === f.k)?.n || f.k) : f.t === 'prin' ? 'Principal ' + f.k : f.t === 'cat' ? 'Kategori ' + f.k : f.k);

function storeProg(data, s) {
  const o = {};
  for (const x of data.prog || []) {
    if (x.id === s.id && x.t) o[x.p] = `${x.a}/${x.t}`;
  }
  return o;
}

// susun seluruh isi DAP satu tanggal
export function buildDap(data, time, d, holidays, cfg) {
  UNIT = cfg.unit === 'jt' ? 'jt' : 'rp';
  cfg = { ...cfg, progpick: [] }; // GreenStore dan MSS sekarang ada di section Market Productivity
  const res = dapForDate(data, time.y, time.m, d, holidays);
  const byKey = new Map(data.stores.map((s) => [s.id + '|' + s.sales.toUpperCase(), s]));
  let keys = cfg.cols.filter((k) => k !== 'tv');
  const tm = cfg.tmode || 'both';
  if (tm !== 'total') { const i = keys.indexOf('t'); if (tm === 'visit') { if (i >= 0) keys[i] = 'tv'; else keys.unshift('tv'); } else { if (i >= 0) keys.splice(i + 1, 0, 'tv'); else keys.unshift('t', 'tv'); } }
  const colDefs = keys.map((k) => colFor(k, data)).filter(Boolean);
  const metrics = cfg.skuMetric === 'both' ? ['qty', 'rp'] : [cfg.skuMetric === 'rp' ? 'rp' : 'qty'];
  const skuCols = cfg.skuMain.flatMap((k) => metrics.map((mt) => {
    const nm = focusName(data, { t: 'sku', k });
    const label = metrics.length > 1 ? `${nm} (${mt === 'qty' ? 'Qty' : 'Rp'})` : nm;
    return { k: 'sku:' + k + ':' + mt, label, w: Math.min(30, Math.max(mt === 'rp' ? 20 : 15, Math.ceil(label.length * 1.5))), al: 'right', sku: k, metric: mt };
  }));
  const head = [{ label: 'No', w: 9, al: 'center' }, { label: 'Nama Toko', w: 52 }, { label: 'ID Pelanggan', w: 28 }, ...colDefs.filter((c) => c.k !== 'note' && c.k !== 'blank'), ...skuCols, ...colDefs.filter((c) => c.k === 'note' || c.k === 'blank')];
  const ci = ctargetIndex(data, cfg.mode || 'milestone');
  const kcols = (cfg.kpick || []).flatMap((p) => (cfg.kcols || ['act', 'tgt', 'ach']).map((m) => ({ k: 'kp:' + p.kind + p.key + m, label: `${p.key} ${m === 'act' ? 'Act' : m === 'tgt' ? 'Tgt' : '%Ach'}`, w: m === 'ach' ? 15 : 20, al: 'right', kp: p, km: m })));
  const PM = { t: 'Tgt', a: 'Act', p: '%Ach', g: 'Gap' };
  const pcols = (cfg.progpick || []).flatMap((p) => (cfg.pmetrics || ['t', 'a', 'p']).map((m) => ({ k: 'pg:' + p + m, label: `${p} ${PM[m]}`, w: m === 'p' ? 15 : 17, al: 'right', pg: p, pm: m })));
  head.splice(head.length - colDefs.filter((c) => c.k === 'note' || c.k === 'blank').length, 0, ...kcols, ...pcols);
  const wd = new Date(time.y, time.m - 1, d).getDay();
  const dk = `${time.y}-${String(time.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const qtyOfStore = (id) => Object.values(data.qty?.cur?.[id] || {}).reduce((a, b) => a + b, 0);
  const groups = res.groups.map((g) => {
    g.list.forEach((r) => {
      const st = byKey.get(r.id + '|' + r.s.toUpperCase());
      const n = visitsInMonth(st?.hk || r.r, time.y, time.m, holidays);
      r.nv = n; r.tv = n ? Math.round(r.t / n) : 0;
      // PLAN = gap / sisa kunjungan, tidak pernah di bawah minimum order (wholesaler dan retail); target sudah tercapai pun PLAN = minimum order
      const ws = /WHOLES|GROSIR/i.test(`${st?.cc1 || ''} ${r.ch || ''}`);
      r.mo = ws ? (cfg.minOrder?.ws ?? 1000000) : (cfg.minOrder?.rt ?? 200000);
      const planOf = (x) => Math.max(x.sisa > 0 ? roundUp(Math.max(0, -x.gap) / x.sisa) : 0, x.mo);
      r.auto = { t: r.t, tv: r.tv, a: r.a, sisa: r.sisa, plan: planOf({ sisa: r.sisa, gap: r.a - r.t, mo: r.mo }) };
      const ed = cfg.edits?.[dk]?.[r.id] || {};
      r.ed = ed;
      if (ed.t != null) { r.t = ed.t; r.tv = n ? Math.round(r.t / n) : 0; }
      if (ed.tv != null) r.tv = ed.tv;
      if (ed.a != null) r.a = ed.a;
      if (ed.sisa != null) r.sisa = ed.sisa;
      r.gap = r.a - r.t; r.done = r.gap >= 0;
      r.plan = ed.plan != null ? ed.plan : planOf(r);
    });
    g.target = g.list.reduce((a, r) => a + r.t, 0); g.actual = g.list.reduce((a, r) => a + r.a, 0); g.plan = g.list.reduce((a, r) => a + r.plan, 0);
    const rows = g.list.map((r, i) => {
      const store = byKey.get(r.id + '|' + r.s.toUpperCase());
      const ctx = { store, tg: time.tg, qty: store ? qtyOfStore(store.id) : 0, prog: store ? storeProg(data, store) : {} };
      const cells = head.map((c, cn) => {
        if (cn === 0) return i + 1;
        if (cn === 1) return r.n;
        if (cn === 2) return r.id;
        if (c.pg) { const x = (data.prog || []).find((y) => y.id === r.id && y.p === c.pg); if (!x || !x.t) return ''; return c.pm === 't' ? x.t : c.pm === 'a' ? x.a : c.pm === 'g' ? Math.max(0, x.t - x.a) : pc(x.a / x.t); }
        if (c.kp) { const act = valueOfStore(data, r.id, c.kp.kind, c.kp.key); const tt = ci.storeT(r.id, c.kp.kind, c.kp.key); return c.km === 'act' ? rp(act) : c.km === 'tgt' ? (tt.t ? (tt.est ? '~' : '') + rp(tt.t) : '') : (tt.t ? pc(act / tt.t) : ''); }
        if (c.sku) { const v = focusVal(data, r.id, { t: 'sku', k: c.sku }); return c.metric === 'qty' ? qf(v.qty) : rp(v.act); }
        return c.get(r, ctx);
      });
      const ed = r.ed || {};
      head.forEach((c, cn) => { if (cn >= 3 && c.k && ed.v?.[c.k] != null) cells[cn] = ed.v[c.k]; });
      return { r, cells, ed };
    });
    // halaman Fokus Pareto: toko Pareto JKS salesman ini yang jadwalnya jatuh di tanggal DAP
    // Top N toko Pareto JKS yang dikunjungi hari ini, urut Target DAP per kunjungan tertinggi; fokus (kategori / principal / SKU) jadi kolom
    let pareto = null;
    if (cfg.par.on) {
      const N = cfg.par.top || 10;
      const fm = cfg.par.fm || ['act', 'tgt', 'ach'];
      const hasSkuT = !!data.skuTgt && Object.keys(data.skuTgt).length > 0;
      // top N toko yang dikunjungi salesman ini di tanggal DAP (bukan hanya Pareto JKS), urut Target DAP per kunjungan tertinggi
      const list = g.list
        .map((dr) => ({ s: byKey.get(dr.id + '|' + dr.s.toUpperCase()) || { id: dr.id, name: dr.n, act: dr.a }, dr, tv: dr.tv || 0, t: dr.t || 0 }))
        .sort((a, b) => b.tv - a.tv || b.t - a.t).slice(0, N);
      const cols = [{ label: 'No', w: 9, al: 'center' }, { label: 'Nama Toko', w: 56 }, { label: 'ID Pelanggan', w: 30 }, { label: 'Target / Kunj', w: 24, al: 'right' }, { label: 'Actual MTD', w: 24, al: 'right' }];
      const fcol = [];
      for (const f of cfg.par.focus) {
        const nm = f.t === 'sku' ? focusName(data, f) : f.k;
        const canT = f.t !== 'sku' || hasSkuT;
        if (fm.includes('act')) fcol.push({ f, m: 'act', label: nm + ' Act' });
        if (fm.includes('qty') && data.hasQty) fcol.push({ f, m: 'qty', label: nm + ' Qty' });
        if (fm.includes('tgt') && canT) fcol.push({ f, m: 'tgt', label: nm + ' Tgt' });
        if (fm.includes('ach') && canT) fcol.push({ f, m: 'ach', label: nm + ' %Ach' });
      }
      fcol.forEach((c) => cols.push({ label: c.label, w: c.m === 'ach' ? 16 : 22, al: 'right' }));
      if (cfg.par.blank) cols.push({ label: 'Order', w: 24 });
      if (cfg.par.notes) cols.push({ label: 'Catatan', w: 0 });
      const rows = list.map((x, i) => {
        const base = [i + 1, x.s.name, x.s.id, x.tv ? rp(x.tv) : '', rp(x.dr ? x.dr.a : x.s.act)];
        const fv = new Map();
        const val = (f) => { const k = f.t + f.k; if (!fv.has(k)) fv.set(k, focusVal(data, x.s.id, f, ci)); return fv.get(k); };
        const fc = fcol.map((c) => { const v = val(c.f); return c.m === 'act' ? rp(v.act) : c.m === 'qty' ? qf(v.qty) : c.m === 'tgt' ? (v.tgt ? (v.est ? '~' : '') + rp(v.tgt) : '') : v.tgt ? pc(v.act / v.tgt) : ''; });
        const arr = [...base, ...fc, ...(cfg.par.blank ? [''] : []), ...(cfg.par.notes ? [''] : [])];
        const pv = x.dr.ed?.pv;
        if (pv) Object.keys(pv).forEach((j) => { if (+j >= 3 && +j < arr.length) arr[+j] = pv[j]; });
        return arr;
      });
      pareto = { cols, rows, n: list.length, ids: list.map((x) => x.s.id), edList: list.map((x) => x.dr.ed || {}) };
    }
    const progSum = (cfg.progpick || []).map((p) => { const it = (data.prog || []).filter((y) => !y.id && y.p === p && y.s && y.s.toUpperCase() === g.name.toUpperCase()); const t = it.reduce((a2, y) => a2 + y.t, 0), a2 = it.reduce((q, y) => q + y.a, 0); return t ? `${p} ${a2}/${t} (${pc(a2 / t)})` : null; }).filter(Boolean).join('  |  ');
    return { name: g.name, n: g.n, target: g.target, actual: g.actual, plan: g.plan, rows, pareto, progSum };
  });
  const hasTgt = false;
  return { head, groups, wd, hasTgt, total: res.total, unparsed: res.unparsed };
}

// kolom tabel kartu Pareto sesuai indikator terpilih
export function cardColumns(par, hasTgt = true) {
  const cols = [{ k: 'name', label: 'Fokus', w: 70 }];
  const showQty = par.unit !== 'rp';
  const showRp = par.unit !== 'qty';
  const I = new Set(par.inds);
  if (I.has('tgt') && hasTgt) cols.push({ k: 'tgt', label: 'Target', al: 'right', w: 24 });
  if (I.has('act') && showRp) cols.push({ k: 'act', label: 'Actual (Rp)', al: 'right', w: 28 });
  if (I.has('qty') && showQty) cols.push({ k: 'qty', label: 'Qty', al: 'right', w: 18 });
  if (I.has('gap') && hasTgt) cols.push({ k: 'gap', label: 'Gap', al: 'right', w: 24 });
  if (I.has('ach') && hasTgt) cols.push({ k: 'ach', label: '% Ach', al: 'right', w: 16 });
  if (I.has('ca')) cols.push({ k: 'ca', label: 'Sudah beli?', al: 'center', w: 22 });
  if (par.blank) cols.push({ k: 'order', label: 'Order', w: 26 });
  if (par.notes) cols.push({ k: 'note', label: 'Catatan', w: 0 });
  return cols;
}
export function cardRows(card, cols) {
  const rows = [];
  const bold = new Set();
  const sumOf = (list) => list.reduce((a, x) => ({ act: a.act + x.act, qty: a.qty + x.qty, tgt: a.tgt + x.tgt }), { act: 0, qty: 0, tgt: 0 });
  const line = (it) => cols.map((c) => {
    switch (c.k) {
      case 'name': return it.name;
      case 'tgt': return it.tgt ? rp(it.tgt) : '';
      case 'act': return rp(it.act);
      case 'qty': return qf(it.qty);
      case 'gap': return it.tgt ? rp(it.act - it.tgt) : '';
      case 'ach': return it.tgt ? pc(it.act / it.tgt) : '';
      case 'ca': return it.act > 0 || it.qty > 0 ? 'Ya' : 'Belum';
      default: return '';
    }
  });
  const total = (label, list) => line({ name: label, ...sumOf(list), act: sumOf(list).act, qty: sumOf(list).qty, tgt: sumOf(list).tgt }).map((v, i) => (cols[i].k === 'ca' ? '' : v));
  let i = 0;
  while (i < card.items.length) {
    const g = card.items[i].g;
    let j = i;
    while (j < card.items.length && card.items[j].g === g) j++;
    const grp = card.items.slice(i, j);
    grp.forEach((it) => rows.push(line(it)));
    if (g && grp.length > 1) { bold.add(rows.length); rows.push(total('Total ' + g, grp)); }
    i = j;
  }
  const groups = new Set(card.items.map((x) => x.g));
  if (card.items.length > 1 && (groups.size > 1 || groups.has(''))) { bold.add(rows.length); rows.push(total('Total fokus', card.items)); }
  rows.bold = bold;
  return rows;
}
export const cardHeadLine = (card) => {
  const s = card.s;
  const bits = [`${LABELS.lm} ${rp(s.lm)}`, `L3M/bln ${rp(s.l3m)}`, '(level toko)'];
  const totAct = card.items.reduce((a, x) => a + x.act, 0);
  if (card.items.length && s.l3m > 0) bits.push(`Fokus = ${pc(totAct / s.l3m)} dari rata-rata L3M toko`);
  for (const [p, v] of Object.entries(card.prog)) bits.push(`${p} ${v}`);
  if (card.programs?.length) bits.push(`Program: ${card.programs.join(', ')}`);
  return bits.join('  |  ');
};
export { weekdayName };
