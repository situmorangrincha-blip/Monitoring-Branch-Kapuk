// Tabel program di kontrak ITG: dipilih dari katalog program (Excel program yang di-upload), hanya yang berlaku untuk toko itu.
import { programsForStore } from './progcat.js';

export const jenisOf = (j) => { const t = String(j || '').toUpperCase(); return /\bOFF\b/.test(t) ? 'OFF' : /\bON\b/.test(t) ? 'ON' : 'LAIN'; };
export const wilayahOf = (catalog) => [...new Set((catalog?.strata || []).map((x) => String(x.Wilayah || '').trim()).filter(Boolean))];

// semua program di katalog (satu baris per kode program) untuk daftar pilihan
export function catalogPrograms(catalog) {
  const m = new Map();
  for (const r of catalog?.rows || []) {
    const c = String(r['Kode Program'] || '');
    if (!c) continue;
    if (!m.has(c)) m.set(c, { code: c, nama: String(r['Nama Program'] || c), jenis: jenisOf(r.Jenis), brand: String(r['Brand / Principal'] || ''), kind: String(r.Jenis || '') });
  }
  // skema strata diskon (ON faktur) dari sheet STRATA: satu pilihan per nama skema
  for (const x of catalog?.strata || []) {
    const n = String(x.Program || '').trim();
    if (!n || m.has('S:' + n)) continue;
    m.set('S:' + n, { code: 'S:' + n, nama: n, jenis: 'ON', brand: String(x.Brand || ''), kind: 'STRATA (diskon bertingkat)', strata: true });
  }
  return [...m.values()];
}

const rewardText = (r) => {
  const t = String(r['Tipe Reward'] || '').trim(), v = String(r['Nilai Reward'] ?? '').trim(), s = String(r['Satuan Reward'] || '').trim(), b = String(r['Barang Bonus'] || '').trim();
  if (b) return b;
  if (v) return `${v}${s === '%' ? '%' : s ? ' ' + s : ''}${t ? ' · ' + t : ''}`;
  return t;
};

// benefit toko (Rp) per baris program: "Potongan Rp N" di Nilai Reward, atau Nilai Reward angka bila Tipe Reward = potongan Rp. Persen / harga khusus tidak dihitung (isi manual).
export function potOf(r) {
  const v = r['Nilai Reward'];
  if (typeof v === 'string' && /potongan\s*rp\s*([\d.]+)/i.test(v)) return +/potongan\s*rp\s*([\d.]+)/i.exec(v)[1].replace(/\./g, '') || 0;
  if (/potongan\s*rp/i.test(String(r['Tipe Reward'] || '')) && typeof v === 'number') return v;
  return 0;
}

// baris tabel untuk satu toko. Skema strata: satu baris per tingkat. Program biasa: satu baris per baris program yang berlaku untuk toko itu.
export function rowsForTable(tbl, catalog, ctx, st) {
  const picks = tbl.picks || [];
  if (!catalog || !picks.length || !st) return [];
  const only = new Set(picks.filter((c) => !String(c).startsWith('S:')));
  const groups = only.size ? programsForStore({ progcat: catalog, itgList: null, promos: [] }, st, ctx, only) : [];
  const out = [];
  for (const c of picks.filter((x) => String(x).startsWith('S:'))) {
    if (tbl.jenis === 'OFF') continue;
    const nm = String(c).slice(2);
    const multiWil = new Set((catalog.strata || []).filter((x) => String(x.Program).trim() === nm).map((x) => String(x.Wilayah).trim())).size > 1;
    let rows = (catalog.strata || [])
      .filter((x) => String(x.Program).trim() === nm && (!tbl.wilayah || tbl.wilayah === 'ALL' || String(x.Wilayah).trim() === tbl.wilayah))
      .map((x, i) => ({ key: `${c}|s${i}`, code: c, n: nm + (!tbl.wilayah || tbl.wilayah === 'ALL' ? (multiWil ? ' · ' + String(x.Wilayah).trim() : '') : ''), min: `${x.Dari}${x.Sampai === '' || x.Sampai == null ? '+' : '-' + x.Sampai}`, up: Number(x.Dari) || 0, sat: String(x.Satuan || ''), dis: x['Diskon %'] === '' ? '' : `${x['Diskon %']}%` }));
    if (tbl.tiers === 'top' && rows.length) rows = [rows.reduce((a, b) => (b.up > a.up ? b : a))];
    out.push(...rows);
  }
  for (const g of groups) {
    if (tbl.jenis && tbl.jenis !== 'ALL' && jenisOf(g.jenis) !== tbl.jenis) continue;
    const nama = g.nama + (g.status === 'perlu daftar' ? ' (perlu daftar)' : '');
    g.rows.forEach((r, i) => out.push({ key: `${g.code}|p${i}`, code: g.code, n: nama, min: r['Min Order'] === '' || r['Min Order'] == null ? '' : String(r['Min Order']), sat: String(r.Satuan || ''), dis: rewardText(r), pot: potOf(r) }));
  }
  return tbl.potOnly ? out.filter((r) => r.pot > 0) : out;
}

// gabungkan baris hasil katalog dengan hasil edit per toko: { hide:{key:1}, ov:{key:{n,min,sat,dis,pot,ambil}}, extra:[...] }
export function effectiveRows(gen, st) {
  const hide = st?.hide || {}, ov = st?.ov || {};
  const rows = gen.filter((x) => !hide[x.key]).map((x) => ({ ...x, ...(ov[x.key] || {}), auto: x, gen: true }));
  const extra = (st?.extra || []).map((x, i) => ({ key: 'x' + i, n: '', min: '', sat: '', dis: '', pot: '', ambil: '', ...x, extra: true, idx: i }));
  return [...rows, ...extra];
}
