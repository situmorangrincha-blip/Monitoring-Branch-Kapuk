// Ubah workbook per slot (main / sku / prog / skudb) jadi dataset. Peran sheet dikenali dari judul sheet.
import { parseAll, parsePeriod, autoPareto, sizeOf } from './parse.js';
import { applyRules, defaultRulesFor } from './rules.js';
import { parseProgCat } from './progcat.js';
import { parseItg } from './itg.js';
import { parseItg2 } from './itg2.js';
import { parseMarket } from './market.js';
import { parseScup } from './scup.js';
import { packBlocks, parseSkuBlocks } from './skuBlocks.js';
import * as XLSX from 'xlsx';
import { parseCTarget } from './ctarget.js';
import { FIELDS, SPEC, grpName, isYes, key, readTable, sheetsByRole, str, toNum, describeMap } from './table.js';

export const SLOT_INFO = {
  main: { label: 'Data utama', hint: 'Omset per toko, Sep, L3M, Pareto JKS, target, DAP (sheet dikenali dari judul)' },
  sku: { label: 'Qty per SKU', hint: 'Baris per toko × SKU: ID toko, kode SKU, qty (kolom nilai/omset boleh ikut kalau satu file)' },
  val: { label: 'Omset per SKU', hint: 'Baris per toko × SKU: ID toko, kode SKU, omset / nilai Rp. Disambung ke Qty lewat ID toko + kode SKU' },
  promo: { label: 'Daftar peserta program', hint: 'Hanya untuk file berisi DAFTAR TOKO peserta (Excel atau PDF), dicocokkan lewat ID atau nama. Excel standar program pakai slot Program' },
  ctarget: { label: 'Target kategori / principal', hint: 'Target per salesman atau per toko untuk Kategori atau Principal (BTI; kolom Basis opsional). Muncul di DAP dan Jelajah' },
  rules: { label: 'Aturan salesman', hint: 'Pindahkan toko ke salesman lain' },
  progcat: { label: 'Program (Excel standar)', hint: 'Excel standar program (sheet PROGRAM, STRATA, PESERTA). Toko dicocokkan otomatis dari channel dan ukuran di JKS' },
  itg: { label: 'Target ITG', hint: 'Excel ITG: Nama Salesman, ID Pelanggan, Class, Target <bulan> (2 bulan ganjil-genap), Actual dan Reward (kolom Reward menjadi reward di web)' },
  itgscup: { label: 'Target ITG Supercup', hint: 'Excel target Supercup: Id Pelanggan, Nama Pelanggan, Target per bulan (ctn) di bawah judul grup TARGET, riwayat bulanan. Outlet dicocokkan ke JKS lewat ID toko' },
  market: { label: 'Market Productivity', hint: 'Excel dengan sheet ringkasan EC dan AC per salesman, OLAP EC dan AC harian, dan OLAP GreenStore / MSS / PICOS. Sheet dikenali dari isinya' },
  prog: { label: 'GreenStore / MSS', hint: 'Target, Actual per salesman atau toko' },
  skudb: { label: 'Database SKU', hint: 'Kode SKU + nama SKU (+ brand/kategori). Per depo, jarang diganti' },
};

// periode data = bulan dari tanggal upload (WIB). Tanggal 1 memakai bulan lalu karena data selalu H-1.
const MON_ID3 = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
export function uploadPeriod(now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number);
  let [y, m, d] = f;
  if (d === 1) { m -= 1; if (m === 0) { m = 12; y -= 1; } }
  return { year: y, month: m, label: `${MON_ID3[m - 1]} ${y}` };
}
const LEGACY = (wb) => wb.SheetNames.some((n) => /^OLAPSALES/.test(key(n)) || key(n) === 'JKSSALESMAN');
const rp = (v) => Math.round(toNum(v));
const DAYS = [['SENIN', 1], ['SELASA', 2], ['RABU', 3], ['KAMIS', 4], ['JUMAT', 5], ['SABTU', 6]];
const dayOf = (s) => { const u = String(s || '').toUpperCase(); let d = 0; for (const [n, i] of DAYS) if (u.includes(n)) d = i; return d; };
const nk = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

// --------- util: baca banyak sheet satu jenis ---------
function readKind(wb, names, kind, override, warn, label) {
  const out = [];
  for (const n of names) {
    const t = readTable(wb.Sheets[n], kind, override?.[kind] || {});
    if (!t) { warn.push(`Sheet "${n}" dilewati: kolom ${kind === 'skudb' ? 'Kode SKU' : 'wajib'} untuk ${label} tidak ketemu (judul kolom tidak dikenali). Atur lewat Pemetaan kolom.`); continue; }
    out.push({ sheet: n, ...t });
  }
  return out;
}

export function previewMap(wb, slot, override) {
  if (!SPEC[slot]) return [];
  // untuk layar pemetaan: sheet mana kebaca & kolom mana yang cocok
  const roles = sheetsByRole(wb);
  const pick = slot === 'main' ? [...(roles.main || []), ...(roles.khusus || [])] : slot === 'val' ? [...(roles.val || []), ...(roles.main || [])] : slot === 'sku' ? [...(roles.sku || []), ...(roles.main || [])] : slot === 'prog' ? [...(roles.prog || []), ...(roles.main || [])] : [...(roles.skudb || []), ...(roles.main || [])];
  const kind = slot;
  const found = [];
  for (const n of pick.slice(0, 8)) {
    const t = readTable(wb.Sheets[n], kind, override?.[kind] || {});
    found.push({ sheet: n, ok: !!t, rows: t?.rows.length || 0, cols: describeMap(t, kind), heads: t?.heads?.filter(Boolean) || [] });
  }
  return found;
}

// ====================== SLOT: DATA UTAMA ======================
export function parseMain(wb, o) {
  const { team, fileName, override, period, roster } = o;
  const warn = [];
  if (LEGACY(wb)) {
    const r = parseAll(wb, { fileName, roster });
    const d = r[team];
    if (!d) throw new Error(`Format lama terdeteksi, tapi data tim ${team === 'bima' ? 'Bima' : 'Arjuna'} tidak ada di file ini. ${r.warnings.join(' | ')}`);
    d.warnings = [...r.warnings, ...d.warnings, 'Info: format lama terbaca lewat pembaca khusus (sheet OLAP/JKS)'];
    d.meta.legacy = true;
    const fp = d.meta.period;
    if (period) {
      d.meta.filePeriod = fp;
      d.meta.period = period;
      if (fp && (fp.year !== period.year || fp.month !== period.month)) d.warnings.unshift(`Periode mengikuti tanggal upload (${period.label}), sedangkan pivot utama membaca ${fp.label}. Pastikan pivot sudah ter-refresh ke periode yang sama.`);
    }
    return { data: d, info: { legacy: true } };
  }

  const roles = sheetsByRole(wb);
  const mainSheets = readKind(wb, roles.main || [], 'main', override, warn, 'data utama');
  const khusus = readKind(wb, roles.khusus || [], 'main', override, warn, 'data khusus');
  if (!mainSheets.length && !khusus.length) {
    throw new Error('Tidak ada sheet data yang terbaca. Pastikan ada sheet berisi kolom Salesman dan ID Toko (nama kolom dicocokkan longgar). ' + warn.join(' | '));
  }

  // baris khusus menimpa salesman yang tercantum di sana
  const rows = [];
  const khSales = new Set();
  const khGroup = {};
  for (const t of khusus) for (const r of t.rows) { const s = nk(r.sales); if (s) { khSales.add(s); khGroup[s] = grpName(t.sheet); } }
  for (const t of mainSheets) for (const r of t.rows) if (!khSales.has(nk(r.sales))) rows.push({ ...r });
  for (const t of khusus) for (const r of t.rows) rows.push({ ...r, _g: grpName(t.sheet) });
  if (khusus.length) warn.push(`Info: sheet ${khusus.map((t) => `"${t.sheet}"`).join(', ')} menimpa data ${khSales.size} salesman yang tercantum di dalamnya (baris yang sama di sheet lain diabaikan)`);

  // ---- agregasi per toko ----
  const hasSku = rows.some((r) => str(r.code) || str(r.skuName) || str(r.category));
  const stores = new Map();
  const salesmen = [];
  const sSeen = new Set();
  for (const r of rows) {
    const id = str(r.id);
    const sales = str(r.sales);
    if (!id || !sales) continue;
    if (!sSeen.has(nk(sales))) { sSeen.add(nk(sales)); salesmen.push(sales); }
    const k = id + '|' + nk(sales);
    let s = stores.get(k);
    if (!s) {
      s = { id, name: str(r.name) || id, sales, hk: str(r.route), day: dayOf(r.route), cc1: str(r.channel) || '-', cc2: '-', cc5: str(r.size) || '-', size: sizeOf(r.size), tipe: '', kec: '', kel: '', min: 0, pj: false, ps: false, tgt: 0, act: 0, lm: 0, l3m: 0, grp: r._g || str(r.tim) || '' };
      stores.set(k, s);
    }
    if (!s.hk && str(r.route)) { s.hk = str(r.route); s.day = dayOf(r.route); }
    if (r.pareto != null && isYes(r.pareto)) s.pj = true;
    if (r.paretoSak != null && isYes(r.paretoSak)) s.ps = true;
    s.act += toNum(r.act);
    s.tgt += toNum(r.target);
    if (hasSku) {
      if (!s.lm) s.lm = toNum(r.lm);
      if (!s.l3m) s.l3m = toNum(r.l3m);
    } else { s.lm += toNum(r.lm); s.l3m += toNum(r.l3m); }
    if (!s.min) s.min = toNum(r.min);
  }
  if (!stores.size) throw new Error('Tabel terbaca tapi tidak ada baris dengan Salesman + ID Toko terisi');

  // sheet pareto/LAB
  const par = readKind(wb, roles.pareto || [], 'pareto', override, warn, 'pareto');
  let parHits = 0;
  const byId = new Map();
  for (const s of stores.values()) { const a = byId.get(s.id) || []; a.push(s); byId.set(s.id, a); }
  for (const t of par) {
    for (const r of t.rows) {
      const id = str(r.id);
      const list = (byId.get(id) || []).filter((s) => !str(r.sales) || nk(s.sales) === nk(r.sales));
      for (const s of list) {
        parHits++;
        if (r.pareto == null || isYes(r.pareto)) s.pj = true;
        if (r.paretoSak != null && isYes(r.paretoSak)) s.ps = true;
        if (toNum(r.target)) s.tgt = toNum(r.target);
        if (toNum(r.min)) s.min = toNum(r.min);
      }
    }
  }
  const list = [...stores.values()];
  for (const s of list) { s.act = Math.round(s.act); s.tgt = Math.round(s.tgt); s.lm = Math.round(s.lm); s.l3m = Math.round(s.l3m); if (!s.min) s.min = 200000; }
  const anyPareto = list.some((s) => s.pj);
  if (!anyPareto) {
    autoPareto(list, salesmen);
    warn.push('Info: belum ada kolom/sheet Pareto JKS, Pareto dihitung otomatis (30 toko terbesar per salesman berdasarkan L3M)');
  }
  if (!list.some((s) => s.tgt)) warn.push('Info: target per toko tidak ada (kolom Target kosong)');
  if (!list.some((s) => s.lm)) warn.push('Info: kolom Sep / bulan lalu tidak ketemu, pembanding vs Sep kosong');
  if (!list.some((s) => s.l3m)) warn.push('Info: kolom L3M tidak ketemu, pembanding vs L3M kosong');
  if (!list.some((s) => s.hk)) warn.push('Info: kolom Hari Kunjungan tidak ketemu, DAP dan fokus per hari tidak bisa dipakai');

  // ---- principal & SKU dari baris data ----
  const principalOf = (r) => nk(r.principal || r.brand);
  const pAct = {};
  const principals = new Set();
  for (const r of rows) {
    const sales = str(r.sales);
    if (!sales) continue;
    const t = (pAct[sales] ||= { total: 0 });
    const a = toNum(r.act);
    t.total += a;
    const p = principalOf(r);
    if (p) { t[p] = (t[p] || 0) + a; principals.add(p); }
  }
  // ---- target salesman ----
  const tgtRows = readKind(wb, roles.target || [], 'target', override, warn, 'target');
  const milestone = {};
  for (const t of tgtRows) {
    for (const r of t.rows) {
      const sales = salesmen.find((s) => nk(s) === nk(r.sales));
      if (!sales) continue;
      const o2 = (milestone[sales] ||= { total: 0 });
      const v = toNum(r.target);
      o2.total += v;
      const p = nk(r.principal || r.brand);
      if (p) { o2[p] = (o2[p] || 0) + v; principals.add(p); }
    }
  }
  for (const s of salesmen) {
    if (!milestone[s]) {
      milestone[s] = { total: list.filter((x) => x.sales === s).reduce((a, x) => a + x.tgt, 0) };
      if (!tgtRows.length && s === salesmen[0]) warn.push('Info: sheet Target tidak ada (judul sheet diawali TGT/TARGET), target salesman dijumlah dari target toko');
    }
    pAct[s] ||= { total: 0 };
  }

  // ---- DAP ----
  const dapRows = readKind(wb, roles.dap || [], 'dap', override, warn, 'DAP');
  let dap = [];
  let dapAuto = false;
  const actOf = (id, sales) => stores.get(id + '|' + nk(sales))?.act ?? 0;
  for (const t of dapRows) {
    for (const r of t.rows) {
      const id = str(r.id);
      const sales = str(r.sales);
      if (!id || !sales) continue;
      dap.push({ id, n: str(r.name) || stores.get(id + '|' + nk(sales))?.name || id, s: sales, r: str(r.route), ch: str(r.channel), t: rp(r.target), e: rp(r.est), hp: str(r.hp), par: isYes(r.pareto) ? 'P' : '', so: rp(r.so), m: [0, 0, 0], a: rp(actOf(id, sales)) });
    }
  }
  if (!dap.length) {
    dap = list.filter((s) => s.hk && s.tgt > 0).map((s) => ({ id: s.id, n: s.name, s: s.sales, r: s.hk, ch: s.cc1 === '-' ? '' : s.cc1, t: s.tgt, e: 0, hp: '', par: s.pj ? 'P' : '', so: 0, m: [0, 0, 0], a: s.act }));
    if (dap.length) warn.push('Info: sheet DAP tidak ada, target DAP dihitung otomatis dari kontribusi L3M toko × target salesman');
    dapAuto = true;
  }

  const data = {
    v: 3,
    team,
    meta: { period: period || null, uploadedAt: new Date().toISOString(), fileName: fileName || '', region: '', teamLabel: team === 'bima' ? 'Bima' : 'Arjuna', storeTgt: list.some((s) => s.tgt), autoPareto: !anyPareto, hasBti: false, hasDap: dap.length > 0, dapAuto, flat: true, parHits },
    salesmen,
    principals: [...principals],
    targets: { milestone, bti: null },
    pAct,
    stores: list,
    subs: [], cat: { cur: {}, lm: {}, l3m: {} },
    dap,
    history: [], settings: {},
    warnings: warn,
  };
  if (hasSku) applySku(data, skuFromRows(rows), warn);
  return { data, info: { sheets: [...mainSheets, ...khusus].map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'main') })) } };
}

// ====================== SKU (qty / nilai per toko × SKU) ======================
function skuFromRows(rows) {
  const subs = [];
  const idx = new Map();
  const per = {};
  for (const r of rows) {
    const id = str(r.id);
    if (!id) continue;
    const code = str(r.code);
    const nm = str(r.skuName);
    const cat = str(r.category);
    const kk = code || nm || cat;
    if (!kk) continue;
    if (!idx.has(kk)) { idx.set(kk, subs.length); subs.push({ p: nk(r.principal) || nk(r.brand) || '-', b: str(r.brand) || str(r.principal) || '-', n: nm || cat || code, c: code, k: cat }); }
    const i = idx.get(kk);
    const o = (per[id] ||= {});
    const x = (o[i] ||= [0, 0, 0]);
    x[0] += toNum(r.qty); x[1] += toNum(r.act); x[2] += toNum(r.target);
  }
  return { subs, per };
}

export function parseSku(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  let names = [...(roles.sku || [])];
  if (!names.length) names = [...(roles.main || []), ...(roles.khusus || [])];
  const tabs = readKind(wb, names, 'sku', o.override, warn, 'qty SKU');
  if (!tabs.length) throw new Error('Tidak ada sheet qty yang terbaca: butuh kolom ID Toko dan Qty. ' + warn.join(' | '));
  const rows = tabs.flatMap((t) => t.rows);
  const sk = skuFromRows(rows);
  if (!sk.subs.length) throw new Error('Tabel terbaca tapi tidak ada kolom SKU (kode/nama SKU atau kategori)');
  const per = {};
  for (const [id, o2] of Object.entries(sk.per)) { per[id] = {}; for (const [i, x] of Object.entries(o2)) per[id][i] = [Math.round(x[0] * 100) / 100, Math.round(x[1]), Math.round(x[2])]; }
  return { data: { subs: sk.subs, per, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString(), rows: rows.length }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'sku') })) } };
}

export function parseVal(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  let names = [...(roles.val || [])];
  if (!names.length) names = [...(roles.main || []), ...(roles.khusus || [])];
  const tabs = readKind(wb, names, 'val', o.override, warn, 'omset SKU');
  if (!tabs.length) throw new Error('Tidak ada sheet omset per SKU yang terbaca: butuh kolom ID Toko dan Omset/Nilai/Actual. ' + warn.join(' | '));
  const rows = tabs.flatMap((t) => t.rows);
  const sk = skuFromRows(rows);
  if (!sk.subs.length) throw new Error('Tabel terbaca tapi tidak ada kolom SKU (kode/nama SKU)');
  const per = {};
  for (const [id, o2] of Object.entries(sk.per)) { per[id] = {}; for (const [i, x] of Object.entries(o2)) per[id][i] = [0, Math.round(x[1]), Math.round(x[2])]; }
  return { data: { subs: sk.subs, per, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString(), rows: rows.length }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'val') })) } };
}

// gabung slot Qty dan slot Omset: satu SKU = kode (atau nama kalau tidak ada kode)
export function mergeSku(a, b) {
  if (!a) return b;
  if (!b) return a;
  const subs = a.subs.map((x) => ({ ...x }));
  const idx = new Map(subs.map((x, i) => [x.c || x.n, i]));
  const map = b.subs.map((x) => {
    const k = x.c || x.n;
    if (!idx.has(k)) { idx.set(k, subs.length); subs.push({ ...x }); }
    return idx.get(k);
  });
  const per = {};
  for (const [id, o] of Object.entries(a.per)) { per[id] = {}; for (const [i, x] of Object.entries(o)) per[id][i] = [...x]; }
  for (const [id, o] of Object.entries(b.per)) {
    const t = (per[id] ||= {});
    for (const [i, x] of Object.entries(o)) { const j = map[i]; const y = (t[j] ||= [0, 0, 0]); y[0] += x[0]; y[1] += x[1]; y[2] += x[2]; }
  }
  return { subs, per };
}

// terapkan SKU ke dataset utama: cat.cur = nilai, qty.cur = qty
export function applySku(data, sk, warn = []) {
  const ids = new Set(data.stores.map((s) => s.id));
  data.subs = sk.subs;
  data.cat = { cur: {}, lm: {}, l3m: {} };
  data.qty = { cur: {} };
  data.skuTgt = {};
  let miss = 0;
  for (const [id, o] of Object.entries(sk.per)) {
    if (!ids.has(id)) { miss++; continue; }
    for (const [i, x] of Object.entries(o)) {
      if (x[1]) (data.cat.cur[id] ||= {})[i] = x[1];
      if (x[0]) (data.qty.cur[id] ||= {})[i] = x[0];
      if (x[2]) (data.skuTgt[id] ||= {})[i] = x[2];
    }
  }
  data.hasQty = Object.keys(data.qty.cur).length > 0;
  if (miss) warn.push(`Info: ${miss} ID toko di data SKU tidak ada di data utama (diabaikan)`);
  return data;
}

// ====================== PROGRAM (GreenStore / MSS) ======================
const progName = (sheet, v) => {
  if (str(v)) return str(v);
  const k = key(sheet);
  return k.includes('GREEN') ? 'GreenStore' : k.includes('MSS') ? 'MSS' : str(sheet);
};

export function parseProg(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  let names = [...(roles.prog || [])];
  if (!names.length) names = wb.SheetNames.slice();
  const tabs = readKind(wb, names, 'prog', o.override, warn, 'program');
  if (!tabs.length) throw new Error('Tidak ada sheet program yang terbaca: butuh kolom Target dan Actual. ' + warn.join(' | '));
  const items = [];
  for (const t of tabs) {
    for (const r of t.rows) {
      const s = str(r.sales);
      const id = str(r.id);
      if (!s && !id) continue;
      items.push({ p: progName(t.sheet, r.program), s, id, n: str(r.name), t: Math.round(toNum(r.target)), a: Math.round(toNum(r.act)) });
    }
  }
  if (!items.length) throw new Error('Sheet program terbaca tapi kosong');
  return { data: { items, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'prog') })) } };
}

// ====================== DATABASE SKU ======================
export function parseSkuDb(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  const names = roles.skudb?.length ? roles.skudb : wb.SheetNames.slice();
  const tabs = readKind(wb, names, 'skudb', o.override, warn, 'database SKU');
  if (!tabs.length) throw new Error('Database SKU tidak terbaca: butuh kolom Kode SKU. ' + warn.join(' | '));
  const seen = new Set();
  const items = [];
  for (const t of tabs) {
    for (const r of t.rows) {
      const full = str(r.code);
      const parts = full.split(/[\/,;]+/).map((x) => x.trim()).filter(Boolean);
      const c = parts[0];
      if (!c || seen.has(c)) continue;
      seen.add(c);
      items.push({ c, a: parts, n: str(r.skuName) || c, b: str(r.brand), k: str(r.category), p: str(r.principal), h: toNum(r.price) || 0 });
    }
  }
  return { data: { items, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'skudb') })) } };
}


// export tiga blok (bulan berjalan / L3M / bulan lalu): blok bulan berjalan masuk ke slot lama, seluruh blok disimpan untuk Ranking SKU
const withBlocks = (orig, kind) => (wb, o) => {
  const blk = parseSkuBlocks(wb);
  if (!blk || !blk.rows.length) return orig(wb, o);
  const rows = blk.rows.filter((r) => r.cur);
  if (!rows.length) throw new Error('Blok bulan berjalan di file ini kosong (belum ada transaksi bulan ini).');
  const w = XLSX.utils.book_new();
  const aoa = kind === 'val'
    ? [['ID Pelanggan', 'Kode SKU', 'Nama SKU', 'BRAND', 'SUB BRAND', 'PRINCIPAL', 'OMSET'], ...rows.map((r) => [r.id, r.sku, r.sku, r.sub || r.prin, r.sub || '', r.prin || '', Math.round(r.cur)])]
    : [['ID Pelanggan', 'Kode SKU', 'Nama SKU', 'BRAND', 'SUB BRAND', 'PRINCIPAL', 'QTY'], ...rows.map((r) => [r.id, r.sku, r.sku, r.sub || r.prin, r.sub || '', r.prin || '', Math.round(r.cur * 100) / 100])];
  XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(aoa), kind === 'val' ? 'OMSET PER SKU' : 'QTY PER SKU');
  const res = orig(w, o);
  res.data.blocks = packBlocks(blk);
  return res;
};
const parseScupSlot = (wb, o) => { const p = parseScup(wb, o); return { data: { ...p, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: p.meta.sheet, rows: p.items.length, cols: `${p.items.length} outlet, target ${p.months.map((m) => m.label).join(' + ')}` }] } }; };
const parseMarketSlot = (wb, o) => {
  const m = parseMarket(wb);
  if (!m.salesman.length && !m.gs.stores.length && !m.mss.stores.length) throw new Error('Isi Market Productivity tidak dikenali (butuh NAMA SALESMAN dengan EFFECTIVE CALL / ACTUAL CALL, atau tabel GreenStore / MSS).');
  return { data: { ...m, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: 'Market Productivity', rows: m.salesman.length, cols: `EC/AC ${m.salesman.length} salesman, GreenStore ${m.gs.stores.length} toko, MSS ${m.mss.stores.length} toko` }] } };
};
const parseItgSlot = (wb, o) => { const p = parseItg2(wb, o); return { data: { ...p, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: p.meta.sheet, rows: p.items.length, cols: `${p.items.length} toko${p.meta.rewardCol ? ', kolom Reward ada' : ', kolom Reward tidak ada'}` }] } }; };
export const PARSERS = { ctarget: (wb, o) => parseCTarget(wb, o), progcat: (wb, o) => parseProgCat(wb, o), itg: parseItgSlot, market: parseMarketSlot, itgscup: parseScupSlot, main: parseMain, sku: withBlocks(parseSku, 'sku'), val: withBlocks(parseVal, 'val'), prog: parseProg, skudb: parseSkuDb };

// ====================== GABUNG SLOT -> data siap pakai ======================
const akey = (x) => String(x ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// bulan lalu dan L3M per toko x SKU dari blok file Omset / Qty per SKU (tiga blok): mengisi cat.lm / cat.l3m dan qty.lm / qty.l3m
function applyTrend(d) {
  const key = new Map();
  d.subs.forEach((sb, i) => { for (const p of String(sb.c || '').split(/[\/,;]+/)) { const k = akey(p); if (k && !key.has(k)) key.set(k, i); } });
  const ids = new Set(d.stores.map((s) => s.id));
  d.cat.lm = {}; d.cat.l3m = {}; d.qty.lm = {}; d.qty.l3m = {};
  const put = (pk, lmO, l3O) => {
    if (!pk) return;
    for (const r of pk.rows) {
      const id = pk.dict.id[r[0]];
      if (!ids.has(id)) continue;
      let i;
      for (const p of String(pk.dict.sku[r[1]]).split(/[\/,;]+/)) { const k = akey(p); if (key.has(k)) { i = key.get(k); break; } }
      if (i == null) continue;
      if (r[6]) { const o = (lmO[id] ||= {}); o[i] = (o[i] || 0) + r[6]; }
      if (r[7]) { const o = (l3O[id] ||= {}); o[i] = (o[i] || 0) + r[7]; }
    }
  };
  put(d.blocks.om, d.cat.lm, d.cat.l3m);
  put(d.blocks.qt, d.qty.lm, d.qty.l3m);
  d.hasSkuTrend = Object.keys(d.cat.lm).length > 0 || Object.keys(d.cat.l3m).length > 0;
}
// satu SKU bisa punya beberapa kode (GKAOG8/AJTF8Z): semua kode jadi alias ke kode utama di database SKU
export function aliasMap(items) {
  const m = new Map();
  for (const it of items || []) for (const a of it.a?.length ? it.a : [it.c]) m.set(akey(a), it);
  return m;
}
function canonSku(sk, am) {
  if (!sk || !am.size) return sk;
  const subs = sk.subs.map((x) => {
    const raw = String(x.c || '');
    const hit = am.get(akey(raw)) || raw.split(/[\/,;]+/).map((p) => am.get(akey(p))).find(Boolean) || (x.n && am.get(akey(x.n)));
    return hit ? { ...x, c: hit.c, n: hit.n && (!x.n || x.n === x.c || x.n === raw) ? hit.n : x.n } : x;
  });
  return mergeSku({ subs: [], per: {} }, { subs, per: sk.per });
}
export function buildData(slots, depot, team) {
  const m = slots.main;
  if (!m) return null;
  const d = { ...m, depot, team, warnings: [...(m.warnings || [])] };
  d.stores = m.stores.map((s) => ({ ...s }));
  const am = aliasMap(slots.skudb?.items);
  const skuAll = mergeSku(canonSku(slots.sku, am), canonSku(slots.val, am));
  if (skuAll) { d.cat = { cur: {}, lm: {}, l3m: {} }; applySku(d, skuAll, d.warnings); if (m.meta?.legacy) d.warnings.push('Info: data SKU/qty menggantikan kategori dari format lama'); }
  d.prog = slots.prog?.items || [];
  d.promos = slots.promo?.items || [];
  d.progcat = slots.progcat || null;
  d.itgList = slots.itg || null;
  d.itg2 = slots.itg?.v2 ? slots.itg : null;
  d.market = slots.market || null;
  d.scup = slots.itgscup || null;
  d.scuphist = slots.scuphist || null;
  d.blocks = { om: slots.val?.blocks || null, qt: slots.sku?.blocks || null };
  d.ctarget = slots.ctarget || null;
  d.itgcfg = slots.itgcfg || null;
  d.skudb = slots.skudb?.items || [];
  d.subs = d.subs.map((sb) => ({ ...sb, sub: sb.b })); // sub brand dari file (sebelum brand ditimpa database SKU); dipakai sebagai Kategori
  if (d.skudb.length) {
    const by = am;
    d.subs = d.subs.map((sb) => { const x = sb.c && by.get(akey(sb.c)); return x ? { ...sb, n: x.n || sb.n, b: x.b || sb.b, k: x.k || sb.k } : sb; });
  }
  if (d.skudb.length && skuAll) {
    d.skuMissing = d.subs.filter((sb) => sb.c && !am.has(akey(sb.c))).map((sb) => sb.c);
  } else d.skuMissing = [];
  if (skuAll && (d.blocks.om || d.blocks.qt)) applyTrend(d);
  d.rules = slots.rules || defaultRulesFor(depot, team);
  d.pAct = d.pAct; // dikloning di applyRules bila ada aturan
  applyRules(d, d.rules);
  d.groups = {};
  for (const s of d.stores) if (s.grp) d.groups[s.sales] = s.grp;
  d.hasGroups = new Set(Object.values(d.groups)).size > 0;
  d.meta = { ...d.meta, hasQty: !!d.hasQty, hasCat: !!d.progcat, hasItg: !!d.itgList, hasMarket: !!d.market, hasProg: d.prog.length > 0, hasSkuDb: d.skudb.length > 0 };
  return d;
}

export { FIELDS };
