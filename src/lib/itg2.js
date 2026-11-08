// ITG v2: semua angka mengikuti Excel ITG yang diupload (target apa adanya, Actual dari kolom Actual atau sheet OLAP),
// nama salesman dari Excel, class dari JKS data monitoring (cadangan: kolom Class). Semua bisa ditimpa manual (edits).
import * as XLSX from 'xlsx';
import { grid, key, str, toNum } from './table.js';
import { visitsInMonth } from './dapAuto.js';
import { parseRoute, visitDays } from './calc.js';

const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGS: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12 };
export const MON_NAME = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const yr = (s) => (s ? (s.length === 2 ? 2000 + +s : +s) : null);
const num = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : toNum(v); return Number.isFinite(n) ? n : null; };

export function parseItg2(wb, o = {}) {
  const warn = [];
  const name = wb.SheetNames.find((n) => key(n) === 'ITG') || wb.SheetNames.find((n) => grid(wb.Sheets[n]).slice(0, 40).some((r) => (r || []).some((v) => key(v) === 'IDPELANGGAN')));
  if (!name) throw new Error('Sheet ITG tidak ketemu (butuh kolom ID Pelanggan dan Target).');
  const g = grid(wb.Sheets[name]);
  let hr = -1;
  for (let r = 0; r < Math.min(g.length, 40); r++) { const k = (g[r] || []).map((v) => key(v)); if (k.includes('IDPELANGGAN') && (k.includes('CLASS') || k.some((x) => x.startsWith('TARGET')))) { hr = r; break; } }
  if (hr < 0) throw new Error('Header ITG tidak ketemu.');
  const H = g[hr].map((v) => str(v));
  const col = (...ks) => H.findIndex((h) => ks.includes(key(h)));
  const iRw = col('REWARD', 'REWARDACTUAL', 'ACTUALREWARD', 'CASHBACK'), iS = col('NAMASALESMAN', 'SALESMAN'), iDepo = col('DEPO'), iId = col('IDPELANGGAN'), iName = col('NAMAPELANGGAN'), iCls = col('CLASS'), iT2 = col('TARGET2BULAN'), iHk = col('HARIKUNJUNGAN', 'HARIKUNJ');
  const tcols = [], acols = [];
  H.forEach((h, i) => {
    let m = /^TARGET\s+([A-Za-z]{3})\w*\s*(\d{2,4})?$/i.exec(h.trim());
    if (m && MON[m[1].toUpperCase()]) tcols.push({ i, m: MON[m[1].toUpperCase()], y: yr(m[2]) });
    m = /^ACTUAL(?:\s+([A-Za-z]{3})\w*\s*(\d{2,4})?)?$/i.exec(h.trim());
    if (m) acols.push({ i, m: m[1] && MON[m[1].toUpperCase()] ? MON[m[1].toUpperCase()] : null });
  });
  if (!tcols.length) throw new Error('Kolom "Target <bulan>" tidak ketemu.');
  const months = tcols.slice(0, 2).map(({ m, y }) => ({ m, y: y || 2026, label: MON_NAME[m] }));
  // kolom Actual: tanpa bulan = bulan pertama; dengan bulan = bulan itu
  const actIdx = months.map((mm, k) => { const hit = acols.find((a) => a.m === mm.m) || (k === 0 ? acols.find((a) => a.m == null) : null); return hit ? hit.i : -1; });
  // OLAP (cadangan)
  let olap = null, olapMeta = {};
  const on = wb.SheetNames.find((n) => key(n) === 'OLAP');
  if (on) {
    const og = grid(wb.Sheets[on]);
    olap = new Map();
    let ih = -1, ii = -1, iv = -1;
    for (let r = 0; r < og.length; r++) {
      const row = og[r] || [];
      const k = row.map((v) => key(v));
      if (ih < 0 && k.includes('SZCUSTID') && k.includes('NETSALESPKD')) { ih = r; ii = k.indexOf('SZCUSTID'); iv = k.indexOf('NETSALESPKD'); continue; }
      if (ih < 0) { const a = k.indexOf('REGION'); if (a >= 0) olapMeta.region = str(row.find((v, j) => j > a && v != null && v !== '')); const b = k.indexOf('PERIODYMWD'); if (b >= 0) olapMeta.period = str(row.find((v, j) => j > b && v != null && v !== '')); continue; }
      const id = str(row[ii]); const v = num(row[iv]);
      if (/^\d{4}-\d{2}-\d+$/.test(id) && v != null) olap.set(id, (olap.get(id) || 0) + v);
    }
  }
  const items = [];
  let fromOlap = 0;
  for (let r = hr + 1; r < g.length; r++) {
    const row = g[r] || [];
    const id = str(row[iId]);
    if (!id) continue;
    const t = months.map((mm, k) => { const c = tcols[k]; return Math.round(num(row[c.i]) ?? 0); });
    const t2 = iT2 >= 0 ? Math.round(num(row[iT2]) ?? 0) : 0;
    const a = actIdx.map((ci, k) => {
      let v = ci >= 0 ? num(row[ci]) : null;
      if (v == null && k === 0 && olap) { v = olap.get(id) ?? 0; fromOlap++; }
      return v == null ? null : Math.round(v);
    });
    items.push({ id, sales: str(row[iS]), depo: iDepo >= 0 ? str(row[iDepo]) : '', name: str(row[iName]) || id, cls: str(row[iCls]), t, t2: t2 || t.reduce((x, y) => x + y, 0), a, rw: iRw >= 0 ? Math.round(num(row[iRw]) ?? 0) : null, hk: iHk >= 0 ? str(row[iHk]) : '' });
  }
  if (!items.length) throw new Error('Tabel ITG terbaca tapi kosong.');
  if (actIdx[0] < 0 && !olap) warn.push('Kolom Actual dan sheet OLAP tidak ada: Actual dianggap 0 (atau diambil dari data omset toko kalau ada).');
  if (fromOlap) warn.push(`${fromOlap} toko memakai Actual dari sheet OLAP karena kolom Actual kosong.`);
  return { v2: true, items, months, meta: { rewardCol: items.some((x) => x.rw != null), depo: items[0]?.depo || '', region: olapMeta.region || '', period: olapMeta.period || '', sheet: name, actualCol: actIdx.map((x) => x >= 0), olap: !!olap }, warnings: warn, fileName: o.fileName || '' };
}

export const classOf = (cc5) => { const u = String(cc5 || '').toUpperCase(); return /SUPER ?BIG/.test(u) ? 'Superbig' : /BIG/.test(u) ? 'Big' : /MEDIUM/.test(u) ? 'Medium' : /SMALL/.test(u) ? 'Small' : ''; };
const normC = (c) => String(c || '').toUpperCase().replace(/\s/g, '');
export const DEFAULT_PCT = { Small: 0, Medium: 1, Big: 1.5, Superbig: 1.75 };
export const freqLabel = (n) => (n >= 4 ? 'mingguan' : n >= 2 ? '2 mingguan' : n === 1 ? 'bulanan' : '-');

// hitung semua baris ITG: edits = penimpaan manual per toko; settings = {basis:'visit'|'bulan'|'dua', pct:100, classPct}
export function computeItg2(parsed, stores, time, edits = {}, settings = {}, holidays = []) {
  const { months } = parsed;
  const basis = settings.basis || 'visit';
  const pct = settings.pct ?? 100;
  const cp = { ...DEFAULT_PCT, ...(settings.classPct || {}) };
  const mi = Math.max(0, months.findIndex((m) => m.m === time.m));
  const rows = parsed.items.map((it) => {
    const st = stores.get(it.id);
    const e = edits[it.id] || {};
    const sales = e.sales ?? it.sales ?? st?.sales ?? '-';
    const jc = st ? classOf(st.cc5 || st.size) : '';
    const cls = e.cls ?? (jc || it.cls || '-');
    const classDiff = !!(jc && it.cls && normC(jc) !== normC(it.cls));
    const route = st?.hk || it.hk || '';
    const vAuto = route ? visitsInMonth(route, time.y, months[mi]?.m || time.m, holidays) : 0;
    const visitsAuto = vAuto > 0 ? vAuto : 4;
    const vdays = route ? visitDays(parseRoute(route), time.y, months[mi]?.m || time.m, holidays) : [];
    const wdays = [...new Set(vdays.map((d) => new Date(time.y, (months[mi]?.m || time.m) - 1, d).getDay()))];
    const visits = Math.max(1, +(e.visits ?? visitsAuto) || visitsAuto);
    const t1 = e.t1 ?? it.t[0] ?? 0, t2 = e.t2 ?? it.t[1] ?? 0;
    const T = e.T ?? (it.t2 || t1 + t2);
    const a1 = e.a1 ?? it.a[0] ?? 0, a2 = e.a2 ?? it.a[1] ?? 0;
    const A = a1 + a2;
    const tMonth = mi === 0 ? t1 : t2;
    const per100 = tMonth / visits;
    const b = e.basis || basis;
    const base = b === 'dua' ? T : b === 'bulan' ? tMonth : per100;
    const pctUse = e.pct ?? pct;
    const minPct = e.minPct ?? settings.minPct ?? 70;
    const tUsedAuto = Math.round((base * pctUse) / 100);
    const tUsed = e.tUsed ?? tUsedAuto;
    const p1 = t1 > 0 ? a1 / t1 : null, p2 = t2 > 0 ? a2 / t2 : null, total = T > 0 ? A / T : null;
    const done1 = months[0] && time.m > months[0].m, done2 = months[1] && time.m > months[1].m;
    let status = 'berjalan';
    if (done2) status = p1 >= 0.7 && p2 >= 0.7 && total >= 1 ? 'tercapai' : 'gagal syarat';
    else if (done1 && p1 < 0.7) status = 'gagal syarat';
    const hasRw = it.rw != null;
    const cpctAuto = hasRw ? (T > 0 ? (it.rw / T) * 100 : 0) : cp[cls] ?? 0;
    const cpct = e.cpct ?? cpctAuto;
    return { id: it.id, hist: { lm: st?.lm ?? null, l3m: st?.l3m ?? null, act: st?.act ?? null }, mi, vdays, wdays, basis: b, name: it.name, sales, cls, classDiff, tplClass: it.cls, jksClass: jc, route, visits, visitsAuto, freq: freqLabel(visitsAuto), t1, t2, T, a1, a2, A, tMonth, per100, per70: Math.round((per100 * minPct) / 100), pctUse, minPct, tUsed, tUsedAuto, p1, p2, total, status, cpct, rewardAuto: hasRw ? it.rw : Math.round((T * cpct) / 100), reward: e.reward ?? (hasRw && e.cpct == null ? it.rw : Math.round((T * cpct) / 100)), fromExcelReward: hasRw, gap: Math.max(0, T - A), auto: { T: it.t2 || t1 + t2, t1: it.t[0] ?? 0, t2: it.t[1] ?? 0, a1: it.a[0] ?? 0, a2: it.a[1] ?? 0, visits: visitsAuto, tUsed: tUsedAuto, cls: jc || it.cls || '-', cpct: cpctAuto }, edited: Object.keys(e).filter((k) => !['dap', 'contract'].includes(k)).length > 0, e };
  });
  return { rows, mi, basis };
}

const MN3 = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DEMO = new WeakMap();
// bahan untuk halaman ITG: ITG terbaca + toko dari data monitoring (class JKS, rute, histori pengambilan)
export function buildItgDemo(data) {
  if (!data?.itg2) return null;
  if (DEMO.has(data)) return DEMO.get(data);
  const pm = data.meta?.period || {};
  const out = {
    parsed: data.itg2,
    stores: data.stores.map((s) => ({ id: s.id, name: s.name, sales: s.sales, hk: s.hk, cc1: s.cc1, cc5: s.cc5, size: s.size, act: Math.round(s.act || 0), lm: Math.round(s.lm || 0), l3m: Math.round(s.l3m || 0) })),
    histMeta: { period: pm.label || '', cur: MN3[pm.month] || '', lm: MN3[((pm.month || 1) + 10) % 12 + 1] || '' },
  };
  DEMO.set(data, out);
  return out;
}
