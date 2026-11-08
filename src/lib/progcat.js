// Katalog program (dari Excel standar) dan kecocokannya ke toko berdasarkan JKS (channel, ukuran, ITG) + daftar peserta.
import * as XLSX from 'xlsx';
import { key, str } from './table.js';

export function parseProgCat(wb, o = {}) {
  const need = (n) => wb.SheetNames.find((x) => key(x) === n);
  const sp = need('PROGRAM');
  if (!sp) throw new Error('Sheet bernama PROGRAM tidak ketemu. Pakai Excel standar program (sheet PROGRAM, STRATA, PESERTA).');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sp], { defval: '' }).filter((r) => str(r['Kode Program']));
  if (!rows.length) throw new Error('Sheet PROGRAM kosong');
  const ss = need('STRATA');
  const sd = need('PESERTA');
  const strata = ss ? XLSX.utils.sheet_to_json(wb.Sheets[ss], { defval: '' }).filter((r) => str(r.Program)) : [];
  const peserta = sd ? XLSX.utils.sheet_to_json(wb.Sheets[sd], { defval: '' }).filter((r) => /^\d{3,}/.test(str(r['ID Pelanggan'])) || /-/.test(str(r['ID Pelanggan']))) : [];
  const codes = new Set(rows.map((r) => r['Kode Program']));
  return { data: { rows, strata, peserta, warnings: [], fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: [{ sheet: sp, rows: rows.length, cols: [] }], codes: codes.size } };
}

export const storeAttr = (s) => {
  const cc1 = String(s.cc1 || '').toUpperCase();
  const cc5 = String(s.cc5 || '').toUpperCase();
  return {
    ws: cc1.includes('WHOLES') || cc5.startsWith('WS'),
    rtl: cc1.includes('RETAIL') || cc5.startsWith('RTL'),
    size: cc5.includes('SUPERBIG') ? 'SUPERBIG' : cc5.includes('BIG') ? 'BIG' : cc5.includes('MEDIUM') ? 'MEDIUM' : cc5.includes('SMALL') ? 'SMALL' : '',
    cc2: String(s.cc2 || '').toUpperCase(),
    cc3: String(s.cc3 || '').toUpperCase(),
    cc6: String(s.cc6 || '').toUpperCase(),
  };
};
const sizesOf = (kelas) => {
  const k = String(kelas || '').toUpperCase();
  const out = [];
  if (/SUPER ?BIG/.test(k)) out.push('SUPERBIG');
  const k2 = k.replace(/SUPER ?BIG\+?/g, '');
  if (k2.includes('BIG')) out.push('BIG');
  if (k2.includes('MEDIUM')) out.push('MEDIUM');
  if (k2.includes('SMALL')) out.push('SMALL');
  return out;
};

// ctx: { itg: Map(id -> {cls}), members: Map(code -> Set(id)) }
export function rowEligible(row, st, ctx) {
  const a = storeAttr(st);
  const ch = String(row.Channel || '').toUpperCase();
  const grosir = ch.includes('GROSIR');
  const retail = ch.includes('RETAIL');
  if (grosir && !retail && !a.ws) return 'tidak';
  if (retail && !grosir && !a.rtl) return 'tidak';
  const dRaw = String(row['Butuh Daftar Peserta'] || '').toUpperCase();
  const code = row['Kode Program'];
  const opsional = dRaw.startsWith('OPSIONAL');
  const daftar = dRaw.startsWith('YA') || (opsional && ctx.members?.get(code)?.size > 0);
  const inItg = ctx.itg?.has(st.id);
  if (/^ITG-GG/.test(code)) {
    if (!inItg) return 'tidak';
    const want = String(row['Kelas / Jenis Toko'] || '').toUpperCase();
    const cls = String(ctx.itg.get(st.id)?.cls || '').toUpperCase();
    if (want && want !== 'SEMUA KELAS' && cls && want.replace('+', '') !== cls.replace('+', '')) return 'tidak';
    return 'ya';
  }
  if (daftar) return ctx.members?.get(code)?.has(st.id) || (/^ITG/.test(code) && inItg) ? 'ya' : 'perlu daftar';
  const sizes = sizesOf(row['Kelas / Jenis Toko']);
  if (sizes.length && (!a.size || !sizes.includes(a.size))) return 'tidak';
  // jenis toko / lokasi / produk dari JKS (CC2, CC3, CC6): salah satu kata (dipisah ; atau |) harus ada di nilai toko
  const has = (cell, val) => { const t = String(cell || '').toUpperCase().split(/[;|]/).map((x) => x.trim()).filter(Boolean); return !t.length || t.some((x) => val.includes(x)); };
  if (!has(row['Jenis Toko (CC2)'], a.cc2) || !has(row['Lokasi (CC3)'], a.cc3) || !has(row['Produk (CC6)'], a.cc6)) return 'tidak';
  // peserta ITG ditentukan HANYA dari file ITG yang diupload (bukan penanda ITG di CC5)
  const syarat = String(row['Syarat ITG'] || '').toUpperCase();
  if (syarat.includes('NON ITG') && inItg) return 'tidak';
  return 'ya';
}

export function makeCtx(data) {
  const itg = new Map((data.itgList?.items || []).map((x) => [x.id, x]));
  const members = new Map();
  for (const r of data.progcat?.peserta || []) { const c = String(r['Kode Program']); if (!members.has(c)) members.set(c, new Set()); members.get(c).add(String(r['ID Pelanggan'])); }
  for (const p of data.promos || []) { const c = String(p.name); if (!members.has(c)) members.set(c, new Set()); for (const id of p.ids) members.get(c).add(id); }
  return { itg, members };
}

// program yang berlaku untuk satu toko, dikelompokkan per kode program
export function programsForStore(data, st, ctx = makeCtx(data), only = null) {
  const by = new Map();
  for (const r of data.progcat?.rows || []) {
    const code = r['Kode Program'];
    if (only && !only.has(code)) continue;
    const e = rowEligible(r, st, ctx);
    if (e === 'tidak') continue;
    const g = by.get(code) || { code, nama: r['Nama Program'], jenis: r.Jenis, rows: [], status: e };
    g.rows.push(r);
    if (e === 'ya') g.status = 'ya';
    by.set(code, g);
  }
  return [...by.values()];
}

// ringkasan kecocokan program ke toko (untuk layar upload): berapa toko cocok per program
export function summarize(rows, stores, itgItems = []) {
  const ctx = { itg: new Map(itgItems.map((x) => [x.id, x])), members: new Map() };
  const by = new Map();
  for (const r of rows) { const c = r['Kode Program']; if (!by.has(c)) by.set(c, { code: c, nama: r['Nama Program'], jenis: r.Jenis, rows: [], ya: 0, daftar: 0 }); by.get(c).rows.push(r); }
  for (const g of by.values()) {
    for (const st of stores) {
      let best = 'tidak';
      for (const r of g.rows) { const e = rowEligible(r, st, ctx); if (e === 'ya') { best = 'ya'; break; } if (e === 'perlu daftar') best = 'perlu daftar'; }
      if (best === 'ya') g.ya++; else if (best === 'perlu daftar') g.daftar++;
    }
  }
  return [...by.values()].sort((a, b) => b.ya - a.ya);
}

export const progCodes = (data) => {
  const m = new Map();
  for (const r of data.progcat?.rows || []) if (!m.has(r['Kode Program'])) m.set(r['Kode Program'], { code: r['Kode Program'], nama: r['Nama Program'], jenis: r.Jenis, brand: r['Brand / Principal'], daftar: String(r['Butuh Daftar Peserta']).toUpperCase().startsWith('YA'), rows: 0 });
  for (const r of data.progcat?.rows || []) m.get(r['Kode Program']).rows++;
  return [...m.values()];
};
