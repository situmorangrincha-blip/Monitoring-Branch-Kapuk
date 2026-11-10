// ITG Supercup: target ctn per outlet per bulan (Excel), actual = penjualan principal GBS (Qty per SKU), reward bulanan, quartal, dan big cup.
// Pembaca mengenali kolom dari judulnya (bukan posisi), dan tidak bergantung pada nama depo.
import * as XLSX from 'xlsx';

const s = (v) => (v == null ? '' : String(v).trim());
const num = (v) => { const n = Number(typeof v === 'string' ? v.replace(/\./g, '').replace(',', '.') : v); return Number.isFinite(n) ? n : 0; };
export const nk = (x) => s(x).toUpperCase().replace(/[^A-Z0-9]/g, '');
const parts = (x) => s(x).split(/[\/,;]+/).map(nk).filter(Boolean);
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
export const MON_ID = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const mkey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
export const keyLabel = (k) => { const [y, m] = k.split('-').map(Number); return `${MON_ID[m]} ${String(y).slice(2)}`; };

// sel tanggal di Excel bisa berupa Date, nomor seri, atau teks
function asDate(v) {
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1 };
  if (typeof v === 'number' && v > 30000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }
  const t = s(v);
  let m = t.match(/^(\d{4})-(\d{2})-\d{2}/); if (m) return { y: +m[1], m: +m[2] };
  m = t.toLowerCase().match(/^([a-z]{3})[a-z]*[\s\-']*(\d{2,4})$/); if (m && MON[m[1]]) return { y: m[2].length === 2 ? 2000 + +m[2] : +m[2], m: MON[m[1]] };
  return null;
}
export function keyOfPeriod(label) {
  const m = s(label).toLowerCase().match(/([a-z]{3})[a-z]*\s*(\d{4})/);
  return m && MON[m[1]] ? mkey(+m[2], MON[m[1]]) : null;
}

export function parseScup(wb, o = {}) {
  let best = null;
  for (const name of wb.SheetNames) {
    const g = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const hr = g.findIndex((r, i) => i < 40 && (r || []).some((c) => ['IDPELANGGAN', 'IDTOKO', 'IDOUTLET'].includes(nk(c))));
    if (hr < 0) continue;
    if (!best || g.length > best.g.length) best = { g, hr, name };
  }
  if (!best) throw new Error('Kolom "Id Pelanggan" tidak ketemu di sheet mana pun. File ITG Supercup butuh kolom Id Pelanggan, Nama Pelanggan, dan kolom Target per bulan.');
  const { g, hr, name } = best;
  const head = g[hr] || [], grp = g[hr - 1] || [];
  let cur = '';
  const groupAt = head.map((_, i) => { if (s(grp[i])) cur = nk(grp[i]); return cur; });
  const col = (...ks) => head.findIndex((c) => ks.includes(nk(c)));
  const iId = col('IDPELANGGAN', 'IDTOKO', 'IDOUTLET'), iNm = col('NAMAPELANGGAN', 'NAMATOKO', 'NAMAOUTLET'), iDepo = col('DEPO');
  // riwayat: judul kolom berupa tanggal / bulan
  const hcols = []; let lastH = null;
  head.forEach((c, i) => { if (groupAt[i] === 'TARGET' || /TARGET|TOTAL|LY|L2M/i.test(s(c))) return; const d = asDate(c); if (d && i !== iId) { hcols.push({ i, key: mkey(d.y, d.m) }); if (!lastH || mkey(d.y, d.m) > lastH) lastH = mkey(d.y, d.m); } });
  // target per bulan: kolom di bawah grup TARGET (kecuali Total)
  const tcols = [];
  head.forEach((c, i) => { if (groupAt[i] === 'TARGET' && !/TOTAL/i.test(s(c))) { const d = asDate(c); const m = MON[s(c).toLowerCase().slice(0, 3)]; if (d || m) tcols.push({ i, month: d ? d.m : m, y: d ? d.y : null, label: s(c) }); } });
  if (!tcols.length) throw new Error('Kolom target per bulan tidak ketemu. Beri judul grup "TARGET" di atas kolom bulan (mis. Nov, Dec).');
  // tahun target: berurutan setelah bulan riwayat terakhir
  let [py, pm] = lastH ? lastH.split('-').map(Number) : [o.year || new Date().getFullYear(), (tcols[0].month + 10) % 12 || 12];
  for (const t of tcols) { if (t.y) { py = t.y; pm = t.month; } else { py = t.month > pm ? py : py + 1; pm = t.month; } t.key = mkey(py, pm); }
  const iTot = head.findIndex((c, i) => groupAt[i] === 'TARGET' && /TOTAL/i.test(s(c)));
  const items = new Map(); let dup = 0, rows = 0; const depos = {};
  for (let r = hr + 1; r < g.length; r++) {
    const row = g[r] || [];
    const id = s(row[iId]);
    if (!id || !/\d/.test(id)) continue;
    rows++;
    if (items.has(id)) { dup++; continue; }
    const t = {}; for (const c of tcols) t[c.key] = num(row[c.i]);
    const h = {}; for (const c of hcols) h[c.key] = num(row[c.i]);
    const depo = iDepo >= 0 ? s(row[iDepo]) : '';
    depos[depo || '-'] = (depos[depo || '-'] || 0) + 1;
    items.set(id, { id, name: iNm >= 0 ? s(row[iNm]) : '', depo, t, h, tot: iTot >= 0 ? num(row[iTot]) : Object.values(t).reduce((a, b) => a + b, 0) });
  }
  if (!items.size) throw new Error('Tidak ada baris outlet yang terbaca di bawah kolom Id Pelanggan.');
  return { v: 'scup', items: [...items.values()], months: tcols.map((t) => ({ key: t.key, label: s(t.label) })), hmonths: hcols.map((c) => c.key), meta: { sheet: name, rows, dup, depos, fileName: o.fileName || '' } };
}

export const DEFAULT_SCUP = { principal: 'GBS', big: ['OKJMST20', 'OKJMBL20', 'OKJMJA20', 'OKJMJE20', 'OKJMFL20', 'OKKIOR20', 'JDO1A', 'JDO3A', 'JDO7A', 'JBC4', 'MTB4', 'MTR4'], r1: 0.75, r2: 0.5, r3: 1, fill: 'first' };

// actual per bulan per outlet: ctn (Qty per SKU) dan omset (Omset per SKU) untuk principal yang dipilih, plus omset SKU big cup
export function scupMonthly(data, cfg) {
  const out = {};
  const bigSet = new Set(cfg.big.flatMap(parts));
  const pr = nk(cfg.principal);
  const add = (k, id, f, v) => { if (!k || !v) return; const o = ((out[k] ||= {})[id] ||= { ctn: 0, om: 0, big: 0 }); o[f] += v; };
  const bl = data.blocks;
  if (bl && (bl.qt || bl.om)) {
    const walk = (pk, fn) => { if (!pk) return; const kc = keyOfPeriod(pk.periods?.cur), kl = keyOfPeriod(pk.periods?.lm); for (const r of pk.rows) { const id = pk.dict.id[r[0]], sku = pk.dict.sku[r[1]], prin = pk.dict.prin[r[4]]; fn(kc, id, sku, prin, r[5]); fn(kl, id, sku, prin, r[6]); } };
    walk(bl.qt, (k, id, sku, prin, v) => { if (nk(prin) === pr) add(k, id, 'ctn', v); });
    walk(bl.om, (k, id, sku, prin, v) => { if (nk(prin) === pr) add(k, id, 'om', v); if (parts(sku).some((p) => bigSet.has(p))) add(k, id, 'big', v); });
  } else if (data.cat?.cur && data.subs?.length && data.meta?.period) {
    const k = mkey(data.meta.period.year, data.meta.period.month);
    for (const id of Object.keys(data.cat.cur)) for (const [i, v] of Object.entries(data.cat.cur[id])) { const sb = data.subs[+i]; if (!sb) continue; if (nk(sb.p) === pr) add(k, id, 'om', v); if (parts(sb.c).some((p) => bigSet.has(p))) add(k, id, 'big', v); }
    for (const id of Object.keys(data.qty?.cur || {})) for (const [i, v] of Object.entries(data.qty.cur[id])) { const sb = data.subs[+i]; if (sb && nk(sb.p) === pr) add(k, id, 'ctn', v); }
  }
  return out;
}

// simpan angka bulanan tiap upload, supaya quartal bisa dijumlah walau file hanya memuat bulan berjalan dan bulan lalu
export function mergeHist(hist, monthly, ids) {
  const m = { ...(hist?.m || {}) };
  for (const [k, byId] of Object.entries(monthly)) {
    const cur = {};
    for (const id of ids) { const v = byId[id]; if (v && (v.ctn || v.om || v.big)) cur[id] = { ctn: Math.round(v.ctn * 100) / 100, om: Math.round(v.om), big: Math.round(v.big) }; }
    m[k] = cur;
  }
  return { m };
}

export function computeScup({ parsed, data, cfg, hist, edits = {} }) {
  const monthly = scupMonthly(data, cfg);
  const H = (k, id) => monthly[k]?.[id] || hist?.m?.[k]?.[id] || null;
  const known = (k) => !!(monthly[k] || hist?.m?.[k]);
  const per = data.meta?.period;
  const curKey = per ? mkey(per.year, per.month) : parsed.months[0].key;
  const storeBy = new Map(data.stores.map((x) => [x.id, x]));
  const first = parsed.months[0].key;
  const [fy, fm] = first.split('-').map(Number);
  const qs = Math.floor((fm - 1) / 3) * 3 + 1;
  const qMonths = [0, 1, 2].map((i) => mkey(fy, qs + i));
  // harga rata-rata per ctn per bulan (seluruh toko tim) untuk outlet yang belum punya pembelian
  const avg = {};
  for (const k of qMonths) { let om = 0, c = 0; const src = monthly[k] || hist?.m?.[k] || {}; for (const v of Object.values(src)) { om += v.om || 0; c += v.ctn || 0; } avg[k] = c > 0 && om > 0 ? om / c : null; }
  const avgQ = (() => { let om = 0, c = 0; for (const k of qMonths) { const src = monthly[k] || hist?.m?.[k] || {}; for (const v of Object.values(src)) { om += v.om || 0; c += v.ctn || 0; } } return c > 0 ? om / c : null; })();
  const rows = [];
  let outside = 0;
  for (const it of parsed.items) {
    const st = storeBy.get(it.id);
    if (!st) { outside++; continue; }
    const e = edits[it.id] || {};
    const mo = {};
    for (const k of qMonths) {
      const inFile = it.t[k] != null;
      const Tauto = inFile ? it.t[k] : cfg.fill === 'first' ? it.t[first] || 0 : 0;
      const T = e['T:' + k] ?? Tauto;
      const future = k > curKey;
      const miss = !future && !known(k);
      const h = H(k, it.id);
      const Aauto = future || miss ? null : h?.ctn || 0;
      const A = e['A:' + k] ?? Aauto;
      const price = h && h.ctn > 0 && h.om > 0 ? h.om / h.ctn : avg[k];
      const pct = T > 0 && A != null ? A / T : null;
      const ok = pct != null && pct >= 1;
      const rAuto = ok && price ? (cfg.r1 / 100) * T * price : 0;
      mo[k] = { T, Tauto, assumed: !inFile, A, Aauto, pct, price, ok, future, miss, potential: price ? (cfg.r1 / 100) * T * price : null, reward: e['R:' + k] ?? rAuto, rAuto, big: h?.big || 0, om: h?.om || 0, ctn: h?.ctn || 0 };
    }
    const TQ = qMonths.reduce((a, k) => a + (mo[k].T || 0), 0);
    const AQ = qMonths.reduce((a, k) => a + (mo[k].A || 0), 0);
    const omQ = qMonths.reduce((a, k) => a + mo[k].om, 0), ctnQ = qMonths.reduce((a, k) => a + mo[k].ctn, 0);
    const priceQ = ctnQ > 0 && omQ > 0 ? omQ / ctnQ : avgQ;
    // bulan yang belum punya harga (mis. bulan depan) memakai harga rata-rata quartal supaya potensi reward tetap tampil
    for (const k of qMonths) if (mo[k].price == null && priceQ) { mo[k].potential = (cfg.r1 / 100) * mo[k].T * priceQ; mo[k].priceFb = true; }
    const pctQ = TQ > 0 ? AQ / TQ : null;
    const okQ = pctQ != null && pctQ >= 1;
    const qDone = qMonths.every((k) => k <= curKey);
    const rQauto = okQ && priceQ ? (cfg.r2 / 100) * TQ * priceQ : 0;
    const potQ = priceQ ? (cfg.r2 / 100) * TQ * priceQ : null;
    const bigOm = qMonths.reduce((a, k) => a + mo[k].big, 0);
    const rBauto = bigOm > 0 ? (cfg.r3 / 100) * bigOm : 0;
    const rQ = e.RQ ?? rQauto, rB = e.RB ?? rBauto;
    const total = qMonths.reduce((a, k) => a + (mo[k].reward || 0), 0) + rQ + rB;
    rows.push({ id: it.id, name: st.name || it.name, sales: st.sales || '-', hk: st.hk || '', depo: it.depo, mo, TQ, AQ, pctQ, okQ, qDone, priceQ, potQ, rQ, rQauto, bigOm, rB, rBauto, total, h: it.h, ed: e });
  }
  return { rows, qMonths, curKey, first, outside, nFile: parsed.items.length };
}
