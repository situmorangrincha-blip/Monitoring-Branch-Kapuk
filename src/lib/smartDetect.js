// Upload cerdas: mengenali tiap file Excel termasuk slot data yang mana dari ISINYA (nama sheet dan judul kolom),
// bukan dari nama file. Nama file hanya dipakai sebagai petunjuk tambahan.
import * as XLSX from 'xlsx';
import { FIELDS } from './table.js';

const nk = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const SMART_SLOTS = ['main', 'sku', 'val', 'market', 'itg', 'itgscup', 'ctarget', 'skudb', 'progcat'];

// ringkasan tiap sheet: nama, kumpulan judul kolom (teks) dari baris-baris awal, dan jumlah kolom tanggal
function scan(wb) {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rng = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    let g = [];
    if (rng) {
      const a1 = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.min(rng.e.r, 45), c: Math.min(rng.e.c, 70) } });
      g = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false, range: a1 });
    }
    const heads = new Set(); let dates = 0;
    g.forEach((r) => (r || []).forEach((c) => {
      if (c == null) return;
      if (c instanceof Date) { dates++; return; }
      if (typeof c === 'number') { if (c > 40000 && c < 60000) dates++; return; }
      const k = nk(c); if (k && k.length <= 60) heads.add(k);
    }));
    return { name, key: nk(name), heads, dates, rows: rng ? rng.e.r + 1 : 0 };
  });
}
const hasF = (S, f) => FIELDS[f].some((a) => S.heads.has(a));
const like = (S, ...subs) => [...S.heads].some((h) => subs.some((x) => h.includes(x)));
const starts = (S, p) => [...S.heads].some((h) => h.startsWith(p));

// hasil: daftar kandidat { slot, score (0-99), why } diurutkan dari yang paling mungkin
export function fingerprint(wb, fileName = '') {
  const sheets = scan(wb), names = new Set(sheets.map((s) => s.key)), fn = nk(fileName), out = [];
  const add = (slot, score, why) => { if (score > 0) out.push({ slot, score: Math.min(99, Math.round(score)), why }); };
  const SKIP = /^(PETUNJUK|CATATAN|README|INFO|NOTES|NOTE|PANDUAN|KETERANGAN|HELP|CARAPAKAI)/; // sheet penjelasan tidak dipakai untuk menebak
  const best = (f) => { let b = null; for (const S of sheets) { if (SKIP.test(S.key)) continue; const r = f(S); if (r && (!b || r.score > b.score)) b = { ...r, sheet: S.name }; } return b; };

  // Data utama: sheet TGT / OLAP SALES / JKS SALESMAN / LAB (format baru) atau sheet ARJUNA/BIMA + OLAP (format lama)
  let m = 0; const mw = [];
  for (const [k, w] of [['JKSSALESMAN', 40], ['OLAPSALES1', 20], ['TGT', 10], ['LAB', 10], ['OLAPFOCUSCATEGORY', 10], ['DAPTGTPERTOKO', 10]]) if (names.has(k)) { m += w; mw.push(k); }
  if (!names.has('OLAPSALES1') && [...names].some((n) => n.startsWith('OLAPSALES'))) { m += 15; mw.push('OLAP SALES'); }
  if (!names.has('JKSSALESMAN') && [...names].some((n) => n.startsWith('JKS'))) { m += 10; mw.push('JKS'); }
  if ((names.has('ARJUNA') || names.has('BIMA')) && [...names].some((n) => n.startsWith('OLAP'))) { m += 40; mw.push('format lama'); }
  if (m) add('main', m + (/DATAMONITORING|MONITORING/.test(fn) ? 8 : 0), `sheet ${mw.join(', ')}`);

  // Qty / Omset per SKU: baris per toko x SKU
  const sku = best((S) => {
    // export mentah tiga blok (kode SKU ada di kolom szNickName) atau tabel biasa dengan kolom ID + kode SKU
    const three = S.heads.has('SZCUSTID') && S.heads.has('SZNICKNAME');
    if (!(three || (hasF(S, 'id') && hasF(S, 'code')))) return null;
    // jenis nilai dibaca dari judul kolom yang pendek (judul blok seperti "QTY CTN PER SKU NOVEMBER" tidak ikut dihitung)
    const shortHas = (re, n) => [...S.heads].some((h) => h.length <= n && re.test(h));
    const om = shortHas(/^(OMSET|NETSALES|NILAI|REVENUE)/, 14) || FIELDS.act.some((a) => !['ACTUAL', 'ACT', 'ACH'].includes(a) && S.heads.has(a));
    const qt = shortHas(/^(QTY|QUANTITY|TOTALSALESUNIT|SALESUNIT|KUANTITAS)/, 14);
    return { score: 50 + (hasF(S, 'principal') ? 10 : 0) + (three ? 10 : 0) + (S.heads.has('RATA2PERBULAN') ? 8 : 0), om, qt };
  });
  if (sku) {
    const { om, qt } = sku; const fq = /QTY|QUANTITY|KARTON/.test(fn), fo = /OMSET|SALES/.test(fn) && !fq;
    if (qt && om) { add('sku', sku.score + 28 + (fq ? 8 : 0), `kolom ID, kode SKU, qty dan omset (sheet ${sku.sheet})`); add('val', sku.score + 16 + (fo ? 10 : 0), 'kolom ID, kode SKU, omset'); }
    else if (om) { add('val', sku.score + 30 + (fo ? 8 : 0), `kolom ID, kode SKU, omset (sheet ${sku.sheet})`); add('sku', 30, 'kolom ID, kode SKU'); }
    else if (qt) { add('sku', sku.score + 30 + (fq ? 8 : 0), `kolom ID, kode SKU, qty (sheet ${sku.sheet})`); add('val', 30, 'kolom ID, kode SKU'); }
    else { add('sku', sku.score, `kolom ID dan kode SKU, jenis nilai belum jelas (sheet ${sku.sheet})`); add('val', sku.score - 2, 'kolom ID dan kode SKU'); }
  }

  // Target ITG (punya kolom Class) dan Target ITG Supercup (Id Pelanggan + grup TARGET + riwayat bulanan, tanpa Class)
  const itg = best((S) => (hasF(S, 'id') && S.heads.has('CLASS') && starts(S, 'TARGET') && hasF(S, 'sales')) ? { score: 82 + (S.heads.has('ACTUAL') ? 5 : 0) + (like(S, 'REWARD') ? 4 : 0) } : null);
  if (itg) add('itg', itg.score + (/ITG/.test(fn) ? 5 : 0), `kolom Salesman, ID, Class, Target (sheet ${itg.sheet})`);
  const scup = best((S) => {
    if (S.heads.has('CLASS') || !(hasF(S, 'id') && hasF(S, 'name'))) return null;
    const tg = S.heads.has('TARGET') || starts(S, 'TOTALTARGET') || starts(S, 'TARGET'); if (!tg) return null;
    let sc = 55 + (S.heads.has('POE') ? 12 : 0) + (like(S, 'REGION', 'DEPO') ? 8 : 0) + (S.dates >= 3 ? 12 : 0) + (S.heads.has('TARGET') ? 6 : 0);
    if (hasF(S, 'sales') && !S.dates) sc -= 15; // kemungkinan lebih mirip ITG tanpa Class / target kategori
    return { score: sc };
  });
  if (scup) add('itgscup', scup.score + (/SCUP|SUPERCUP/.test(fn) ? 10 : 0), `Id Pelanggan, target per bulan, riwayat bulanan (sheet ${scup.sheet})`);

  // Market Productivity: beberapa sheet EC / AC / GreenStore / MSS / PICOS
  const mk = ['EC', 'AC', 'GREENSTORE', 'MSS', 'PICOS'].filter((t) => [...names].some((n) => n === t || n.includes('OLAP' + t) || n.startsWith(t) || n.endsWith(t))).length;
  if (mk >= 2) add('market', 70 + mk * 4 + (/MARKET|PRODUCTIVITY/.test(fn) ? 8 : 0), `${mk} sheet EC / AC / GreenStore / MSS / PICOS`);

  // Target kategori / principal: kolom Target + Kategori atau Principal + Salesman atau ID, tanpa kode SKU
  const ct = best((S) => (hasF(S, 'target') && (hasF(S, 'category') || hasF(S, 'principal')) && (hasF(S, 'sales') || hasF(S, 'id')) && !hasF(S, 'code') && !S.heads.has('CLASS')) ? { score: 62 + (/KATEGORI|PRINCIPAL|MILESTONE/.test(fn) ? 10 : 0) } : null);
  if (ct) add('ctarget', ct.score, `kolom Target dan Kategori / Principal (sheet ${ct.sheet})`);

  // Database SKU: kode + nama SKU saja (tanpa ID toko dan tanpa nilai transaksi)
  const db = best((S) => (hasF(S, 'code') && hasF(S, 'skuName') && !hasF(S, 'id') && !hasF(S, 'qty') && !like(S, 'OMSET', 'NETSALES')) ? { score: 78 + (S.key === 'SKU' ? 6 : 0) + (/DATABASE|DB/.test(fn) ? 8 : 0) } : null);
  if (db) add('skudb', db.score, `kolom kode dan nama SKU (sheet ${db.sheet})`);

  // Program (Excel standar): sheet PROGRAM (+ STRATA / PESERTA) atau kolom Kode / Nama Program
  let pr = 0; const pw = [];
  if (names.has('PROGRAM')) { pr += 70; pw.push('PROGRAM'); }
  if (names.has('STRATA')) { pr += 12; pw.push('STRATA'); }
  if (names.has('PESERTA')) { pr += 6; pw.push('PESERTA'); }
  if (!pr && sheets.some((S) => S.heads.has('KODEPROGRAM') && S.heads.has('NAMAPROGRAM'))) { pr = 76; pw.push('kolom Kode & Nama Program'); }
  if (pr) add('progcat', pr + (/PROGRAM/.test(fn) ? 5 : 0), `sheet ${pw.join(', ')}`);

  return out.sort((a, b) => b.score - a.score);
}
export const confLabel = (score, second) => (score >= 80 && score - (second ?? 0) >= 12 ? 'tinggi' : score >= 55 ? 'sedang' : 'rendah');
