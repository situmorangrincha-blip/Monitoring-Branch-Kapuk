// Pembaca Market Productivity: EC (Effective Call), AC (Actual Call), GreenStore, MSS, PICOS.
// Semua sheet dan tabel dikenali dari isinya (judul kolom), bukan dari nama sheet atau posisi baris.
const s = (v) => (v == null ? '' : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const U = (v) => s(v).toUpperCase();

import * as XLSX from 'xlsx';

export function parseMarket(a, b) {
  const wb = b || a;
  const out = { period: '', salesman: [], ecDaily: null, acDaily: null, gs: { sales: [], stores: [] }, mss: { sales: [], stores: [] }, picos: [], warnings: [] };
  const periods = new Set();
  const grids = wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true })]);
  for (const [name, g] of grids) {
    const flat = (r) => (g[r] || []).map(U);
    const has = (txt) => g.some((r) => (r || []).some((c) => U(c) === txt));
    // 1) ringkasan per salesman: EFFECTIVE CALL / ACTUAL CALL (TGT, ACT, %)
    if (has('EFFECTIVE CALL') && has('ACTUAL CALL') && has('NAMA SALESMAN')) {
      const hr = g.findIndex((r) => (r || []).some((c) => U(c) === 'NAMA SALESMAN'));
      const nc = flat(hr).indexOf('NAMA SALESMAN');
      for (let r = hr + 1; r < g.length; r++) {
        const row = g[r] || [];
        const nm = s(row[nc]);
        if (!nm) continue;
        if (/GRAND TOTAL/i.test(nm)) break;
        out.salesman.push({ name: nm, ecT: num(row[nc + 1]), ecA: num(row[nc + 2]), acT: num(row[nc + 4]), acA: num(row[nc + 5]) });
      }
    }
    // 2) harian: blok yang header-nya szName diikuti angka hari (1,2,3...)
    g.forEach((row, r) => {
      (row || []).forEach((c, ci) => {
        if (s(c) !== 'szName') return;
        const days = [];
        for (let k = ci + 1; k < ci + 40; k++) { const v = row[k]; const dv = typeof v === 'number' ? v : /^\d{1,2}$/.test(s(v)) ? Number(s(v)) : null; if (dv && dv >= 1 && dv <= 31) days.push([k, dv]); else if (v != null && !/grand/i.test(s(v))) break; }
        if (days.length < 5) return;
        const above = [r - 1, r - 2, r - 3].map((x) => (g[x] || []).slice(Math.max(0, ci - 3), ci + 6).map(U).join(' ')).join(' ');
        const type = /TOTAL ACT|ACTUAL CALL|\bAC\b/.test(above) && !/EFFECTIVE CALL/.test((g[r - 1] || []).slice(Math.max(0, ci - 3), ci + 6).map(U).join(' ')) ? 'ac' : 'ec';
        const rows = [];
        for (let q = r + 1; q < g.length; q++) {
          const rr = g[q] || [];
          const nm = s(rr[ci]);
          if (!nm) break;
          if (/GRAND TOTAL/i.test(nm) || /GRAND TOTAL/i.test(s(rr[ci - 1]))) break;
          rows.push({ name: nm, v: Object.fromEntries(days.map(([k, d]) => [d, num(rr[k])])) });
        }
        const key = type === 'ac' ? 'acDaily' : 'ecDaily';
        if (!out[key] && rows.length) out[key] = { days: days.map((d) => d[1]), rows };
      });
    });
    // 3) periode (Period YMWD): kumpulkan semua, karena pivot di satu file bisa berbeda bulan
    for (const r of g.slice(0, 120)) (r || []).forEach((c, i) => { if (/^PERIOD/i.test(s(c)) && s(r[i + 1]) && !/MULTIPLE/i.test(s(r[i + 1]))) periods.add(s(r[i + 1])); });
    // 4) GreenStore / MSS / PICOS: tabel yang diawali kolom "Nama Salesman"
    g.forEach((row, r) => {
      const idx = []; (row || []).forEach((c, ci) => { if (U(c) === 'NAMA SALESMAN') idx.push(ci); });
      if (!idx.length) return;
      idx.forEach((ci, gi) => {
        const end = idx[gi + 1] ?? (row || []).length;
        const hdr = {}; for (let k = ci; k < end; k++) if (s(row[k])) hdr[U(row[k])] = k;
        const iId = hdr['ID CUSTOMER'], iNm = hdr['NAMA CUSTOMER'];
        const kind = hdr['TOTAL_GREEN_STORE'] != null ? 'gs' : hdr['TOTAL_ACTUAL_MSS'] != null ? 'mss' : hdr['AVG_DISPLAY_COMPLIANCE'] != null ? 'picos' : null;
        if (!kind) return;
        for (let q = r + 1; q < g.length; q++) {
          const rr = g[q] || [];
          const sales = s(rr[ci]);
          if (!sales) break;
          if (/GRAND TOTAL/i.test(sales)) break;
          if (kind === 'picos') { out.picos.push({ name: sales, avg: num(rr[hdr['AVG_DISPLAY_COMPLIANCE']]) }); continue; }
          if (iId != null) {
            const id = s(rr[iId]);
            if (!id) continue;
            if (kind === 'gs') out.gs.stores.push({ sales, id, name: s(rr[iNm]), gs: num(rr[hdr['TOTAL_GREEN_STORE']]) });
            else out.mss.stores.push({ sales, id, name: s(rr[iNm]), act: num(rr[hdr['TOTAL_ACTUAL_MSS']]), tgt: num(rr[hdr['TOTAL_TARGET_MSS']]) });
          } else if (kind === 'gs') out.gs.sales.push({ name: sales, gs: num(rr[hdr['TOTAL_GREEN_STORE']]) });
          else out.mss.sales.push({ name: sales, act: num(rr[hdr['TOTAL_ACTUAL_MSS']]), tgt: num(rr[hdr['TOTAL_TARGET_MSS']]) });
        }
      });
    });
  }
  out.periods = [...periods];
  out.period = out.periods[out.periods.length - 1] || '';
  if (out.periods.length > 1) out.warnings.push('Pivot di file ini berbeda periode: ' + out.periods.join(', ') + '. Cek bahwa semua pivot sudah di-refresh ke bulan yang sama.');
  if (!out.salesman.length) out.warnings.push('Ringkasan EC/AC per salesman tidak ditemukan (butuh kolom NAMA SALESMAN, EFFECTIVE CALL, ACTUAL CALL)');
  if (!out.gs.stores.length && !out.mss.stores.length) out.warnings.push('Tabel GreenStore / MSS per toko tidak ditemukan');
  return out;
}

// cocokkan nama dari file (sering terpotong) ke nama salesman di data monitoring
export function matchName(name, list) {
  const n = s(name).toLowerCase();
  if (!n) return '';
  const hit = list.find((x) => x.toLowerCase() === n) || list.find((x) => x.toLowerCase().startsWith(n) || n.startsWith(x.toLowerCase())) || list.find((x) => x.toLowerCase().split(' ')[0] === n.split(' ')[0]);
  return hit || name;
}
