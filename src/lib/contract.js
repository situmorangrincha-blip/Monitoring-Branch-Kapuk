// Kontrak toko ("Package Development Program"): struktur sama dengan kertas contoh, isinya dari program yang berlaku untuk toko itu.
import { aliasMap } from './ingest.js';
import { CLASS_PCT } from './itg.js';
import { makeCtx, programsForStore } from './progcat.js';

const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0);
const rp = (n) => Math.round(n || 0).toLocaleString('id-ID');

function priceOf(data, codesStr, am) {
  for (const part of String(codesStr || '').split(/[;,]/)) {
    for (const c of part.split('/')) { const it = am.get(String(c).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')); if (it?.h) return it.h; }
  }
  return 0;
}

// potongan per kelipatan minimum: % x qty x harga dus, atau nominal Rp
function potongan(row, price) {
  const t = String(row['Tipe Reward'] || '').toLowerCase();
  const v = row['Nilai Reward'];
  const unit = String(row.Satuan || '').toLowerCase();
  const q = num(row['Min Order']) || 1;
  const isNum = typeof v === 'number' && isFinite(v);
  if (typeof v === 'string' && /potongan\s*rp\s*([\d.]+)/i.test(v)) return num(/potongan\s*rp\s*([\d.]+)/i.exec(v)[1]);
  if (/potongan rp/.test(t) && isNum) return v;
  if (/diskon %|diskon langsung/.test(t) && isNum && price && /ctn|karton|dus|carton/.test(unit)) return Math.round((v / 100) * q * price);
  return 0;
}

export function buildContract(data, st, opts = {}) {
  const ctx = makeCtx(data);
  const am = aliasMap(data.skudb);
  const sel = opts.programs ? new Set(opts.programs) : null;
  const progs = programsForStore(data, st, ctx, sel).filter((g) => g.status === 'ya' || opts.includeDaftar);
  const itg = opts.itg?.rows?.find((r) => r.id === st.id);
  const off = [];
  const on = [];
  if (itg) {
    off.push({ key: 'off:ITG', nama: 'ITG ' + (data.meta.teamLabel || ''), target: itg.T, actual: itg.A, pct: itg.total, gap: itg.T - itg.A, benefit: (CLASS_PCT[String(itg.cls).toUpperCase().replace(/\s/g, '')] ?? 1).toFixed(2) + '%', reward: itg.reward });
  }
  for (const g of progs) {
    if (/^ITG-GG/.test(g.code)) continue;
    if (g.jenis === 'ON FAKTUR') {
      for (const r of g.rows) {
        const pr = priceOf(data, r['Kode SKU'], am);
        const pot = potongan(r, pr);
        on.push({ key: 'on:' + g.code, nama: g.nama + (r['Keterangan SKU'] ? ' - ' + String(r['Keterangan SKU']).slice(0, 46) : ''), min: r['Min Order'] || '-', satuan: r.Satuan || '', diskon: r['Tipe Reward'] ? `${r['Nilai Reward'] || ''} ${r['Satuan Reward'] || ''}`.trim() : '', potongan: pot });
      }
    } else if (!on.concat(off).length || true) {
      const r = g.rows[0];
      off.push({ key: 'off:' + g.code, nama: g.nama, target: null, actual: null, pct: null, gap: null, benefit: `${r['Nilai Reward'] || ''} ${r['Satuan Reward'] || ''}`.trim() || r['Tipe Reward'] || '', reward: 0, ket: r['Tipe Reward'] });
    }
  }
  // on/off tabel dan diskon (umum + per toko); total mengikuti apa yang tercetak
  const e = opts.eff || { tables: { off: true, rec: true, on: true }, dis: () => true };
  const offF = e.tables.off ? off.filter((x) => e.dis(x.key)) : [];
  const onF = e.tables.on ? on.filter((x) => e.dis(x.key)) : [];
  const rec = e.tables.rec ? opts.rec || null : null;
  const totOff = offF.reduce((a, x) => a + (x.reward || 0), 0);
  // rekomendasi tampil: potongan ON faktur = potongan per kunjungan x jumlah kunjungan; kalau tidak, jumlah kolom potongan tabel ON faktur
  const totOn = rec && rec.lines.length ? rec.potonganBulan : onF.reduce((a, x) => a + (x.potongan || 0), 0);
  return { st, off: offF, on: onF, rec, tables: e.tables, totOff, totOn, total: totOff + totOn, wajib: opts.wajib || [], periode: opts.periode || '' };
}
