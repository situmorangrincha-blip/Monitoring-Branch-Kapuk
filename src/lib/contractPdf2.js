import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// PDF kontrak ITG: satu halaman per toko, isinya sama dengan kertas di layar (tabel yang tampil, kolom, angka yang diedit).
const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
const idf = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');
const numOnly = (t) => { const x = String(t ?? '').trim(); if (!x || !/^[\d.,\s]+$/.test(x)) return 0; const n = parseFloat(x.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function view(r, show, tg, pt) {
  const e = r.e || {};
  const ov = e.contract?.ov || {};
  const OV = (k, a) => ov[k] ?? a;
  const lines = e.contract?.lines || [], on = (pt || []).flatMap((x) => x.rows || []);
  const nilai = (l) => l.nv ?? (l.k || 0) * (l.h || 0);
  const potL = (l) => l.pv ?? Math.round((nilai(l) * (l.d || 0)) / 100);
  const val = OV('val', lines.reduce((a, l) => a + nilai(l), 0)), pot = OV('pot', lines.reduce((a, l) => a + potL(l), 0));
  const potSum = (f) => (pt || []).filter(f).reduce((a, t) => a + (t.rows || []).reduce((b, x) => b + numOnly(x.pot), 0), 0);
  const offPot = show.on ? potSum((t) => t.tbl.jenis === 'OFF') : 0;
  const onPot = OV('onpot', potSum((t) => t.tbl.jenis !== 'OFF'));
  const bs = r.basis;
  const mAct = r.mi === 0 ? r.a1 : r.a2;
  const doneV = Math.max(1, Math.round(r.visits * (tg || 1)));
  const BT = bs === 'bulan' ? r.tMonth : r.per100;
  const BA = bs === 'bulan' ? mAct : Math.round(mAct / doneV);
  const sT = bs === 'dua' ? r.T : OV('bT_' + bs, BT), sA = bs === 'dua' ? r.A : OV('bA_' + bs, BA);
  const gap = bs === 'dua' ? OV('gap', r.gap) : OV('bG_' + bs, Math.max(0, sT - sA));
  const pct = bs === 'dua' ? r.total : sT > 0 ? sA / sT : null;
  const kTgt = OV('k_tgt', r.per100), kMin = OV('k_min', r.per70);
  const ambil = OV('ambil', on.reduce((a, x) => a + numOnly(x.ambil), 0));
  const status = ambil <= 0 ? 'belum diisi' : ambil >= kTgt ? 'capai target' : ambil >= kMin ? 'lolos minimal' : 'di bawah minimal';
  const offTot = OV('offtot', (show.off ? r.reward : 0) + offPot);
  const recBen = show.rec && lines.length ? pot * r.visits : 0;
  const totBen = OV('tot', offTot + recBen + (show.on ? onPot : 0));
  return { e, OV, lines, on, nilai, potL, val, pot, onPot, offPot, offTot, recBen, bs, sT, sA, gap, pct, kTgt, kMin, ambil, status, totBen };
}

// items: [{ r, show }] ; output: 'save' | 'blob'
export function makeItgContractPdf(items, { unit = 'jt', months = [], tg = 1, depot = '', team = '', output = 'save', file = 'Kontrak-ITG', orientation = 'portrait' } = {}) {
  if (!items.length) throw new Error('Tidak ada kontrak untuk dicetak');
  const M = (v, d = 2) => (unit === 'jt' ? idf((v || 0) / 1e6, d) : idf(v || 0, 0));
  const RP = (v) => idf(v || 0, 0);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation === 'landscape' ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const acc = depot && /kapuk/i.test(depot) ? [79, 148, 166] : [201, 104, 59];
  const mm = months.map((m) => m.label).join(' - ');
  const base = { margin: { left: 12, right: 12 }, styles: { fontSize: 8.5, cellPadding: 1.7, lineColor: [200, 205, 215], lineWidth: 0.2, overflow: 'linebreak' }, headStyles: { fillColor: acc, textColor: 255, halign: 'center' }, theme: 'grid' };
  items.forEach(({ r, show, pt, wajib }, idx) => {
    if (idx) doc.addPage();
    const v = view(r, show, tg, pt);
    const cv = (g, k) => show.cols?.[g + '.' + k] !== false;
    doc.setFillColor(...acc); doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(clean(`PACKAGE DEVELOPMENT PROGRAM${mm ? ' - ' + mm.toUpperCase() : ''}`), W / 2, 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean([depot, team && `Tim ${team}`].filter(Boolean).join(' | ')), W / 2, 17, { align: 'center' });
    doc.setTextColor(30, 40, 50); doc.setFontSize(9.5);
    const info = [['Pelanggan', r.name], ['ID Pelanggan', r.id], ['Salesman', r.sales], ['Class', r.cls], ['Jadwal', `${r.route || '-'} | ${r.visits}x / bulan (${r.freq})`]];
    let y = 30;
    for (const [k, val] of info) { doc.setFont('helvetica', 'bold'); doc.text(k, 14, y); doc.setFont('helvetica', 'normal'); doc.text(': ' + clean(val), 44, y); y += 5.2; }
    let cur = y + 2;
    const heading = (t) => { if (cur > H - 50) { doc.addPage(); cur = 16; } doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 40, 50); doc.text(t, W / 2, cur + 3, { align: 'center' }); cur += 5; };
    const table = (opts) => { autoTable(doc, { ...base, startY: cur, ...opts }); cur = doc.lastAutoTable.finalY + 3; };
    if (!Object.values({ a: show.off, b: show.rec, c: show.on, d: show.kes }).some(Boolean)) { doc.setFontSize(9); doc.text('Semua tabel disembunyikan.', W / 2, cur + 6, { align: 'center' }); }

    if (show.off) {
      heading('PROGRAM OFF FAKTUR');
      const lab = v.bs === 'dua' ? `ITG ${mm}` : v.bs === 'bulan' ? `ITG ${months[r.mi]?.label || ''}` : `ITG per kunjungan (${months[r.mi]?.label || ''})`;
      const cols = [['Program', lab], ['target', 'Target', M(v.sT)], ['actual', 'Actual', M(v.sA)], ['pct', '%', v.pct == null ? '-' : Math.round(v.pct * 100) + '%'], ['gap', 'Gap', M(v.gap)], ['benefit', 'Benefit', idf(r.cpct, 2) + '%'], ['reward', 'Reward', RP(r.reward)]];
      const use = cols.filter((c, i) => i === 0 || cv('off', c[0]));
      table({ head: [use.map((c) => (c.length === 2 ? c[0] : c[1]))], body: [use.map((c) => (c.length === 2 ? c[1] : c[2]))], columnStyles: { 0: { halign: 'left' } }, bodyStyles: { halign: 'right' } });
    }
    if (show.hist) {
      const hsrc = show.hsrc || 'l3m', hmode = show.hmode || 'bulan';
      const f = hmode === 'visit' ? r.visits : 1;
      const base0 = r.hist?.[hsrc];
      const mv = v.OV('h_' + hsrc, base0);
      const lbl = hsrc === 'l3m' ? 'Rata-rata pengambilan' : hsrc === 'lm' ? 'Pengambilan bulan lalu' : 'Pengambilan bulan data';
      table({ body: [[`${lbl} per ${hmode === 'visit' ? 'kunjungan' : 'bulan'}`, mv == null || mv === 0 ? '-' : M(mv / f) + (unit === 'jt' ? ' jt' : '')]], columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'right' } }, showHead: false });
    }
    if (show.rec) {
      heading('REKOMENDASI ORDER PER KUNJUNGAN');
      const per100 = v.OV('per100', r.per100), per70 = v.OV('per70', r.per70);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(clean(`Target bulan ${M(r.tMonth)} / ${r.visits} kunjungan = ${M(per100)} | minimal ${r.minPct}% = ${M(per70)}${unit === 'jt' ? ' (jt)' : ''}`), W / 2, cur + 2, { align: 'center' }); cur += 5;
      const cols = [['sku', 'SKU'], ['karton', 'Karton'], ['harga', 'Harga/dus'], ['nilai', 'Nilai'], ['disk', 'Disk %'], ['pot', 'Potongan']];
      const row = (l) => ({ sku: clean(l.n), karton: idf(l.k || 0), harga: RP(l.h), nilai: RP(v.nilai(l)), disk: idf(l.d || 0, 1) + '%', pot: RP(v.potL(l)) });
      const use = cols.filter((c) => c[0] === 'sku' || cv('rec', c[0]));
      const body = v.lines.map((l) => use.map((c) => row(l)[c[0]]));
      body.push(use.map((c) => ({ sku: 'Total per kunjungan', nilai: RP(v.val), disk: v.val ? idf((v.pot / v.val) * 100, 1) + '%' : '', pot: RP(v.pot) }[c[0]] ?? '')));
      body.push(use.map((c) => ({ sku: `Per bulan (${r.visits}x)`, nilai: RP(v.OV('mval', v.val * r.visits)), pot: RP(v.OV('mpot', v.pot * r.visits)) }[c[0]] ?? '')));
      table({ head: [use.map((c) => c[1])], body, columnStyles: { 0: { halign: 'left' } }, bodyStyles: { halign: 'right' } });
    }
    if (show.on) {
      for (const t of pt || []) {
        heading(clean(t.tbl.title).toUpperCase());
        const cols = [['n', 'Program'], ['min', 'Min order'], ['sat', 'Satuan'], ['dis', 'Diskon / reward'], ['pot', 'Benefit toko'], ['ambil', 'Pengambilan']];
        const use = cols.filter((c) => c[0] === 'n' || cv('on', c[0]));
        const cell = (x, k) => (k === 'pot' ? (numOnly(x.pot) ? RP(numOnly(x.pot)) : '') : clean(x[k] ?? ''));
        const body = t.rows.map((x) => use.map((c) => cell(x, c[0])));
        if (!body.length) body.push(use.map((c, i) => (i === 0 ? 'Tidak ada program terpilih yang berlaku untuk toko ini' : '')));
        const potI = use.findIndex((c) => c[0] === 'pot');
        if (potI > 0 && t.rows.length) {
          const tot = t.rows.reduce((a, x) => a + numOnly(x.pot), 0);
          const tr = use.map(() => ''); tr[0] = `Total Benefit ${t.tbl.jenis === 'OFF' ? 'OFF ' : t.tbl.jenis === 'ON' ? 'ON ' : ''}Faktur`; tr[potI] = RP(tot);
          body.push(tr);
        }
        table({ head: [use.map((c) => c[1])], body, columnStyles: { 0: { halign: 'left' } }, bodyStyles: { halign: 'right', minCellHeight: 7 }, didParseCell: (d) => { if (d.section === 'body' && String(d.row.raw?.[0] || '').startsWith('Total Benefit')) d.cell.styles.fontStyle = 'bold'; } });
      }
    }
    if (show.kes) {
      heading('KESIMPULAN PENGAMBILAN KUNJUNGAN');
      table({ body: [['Target per kunjungan', M(v.kTgt)], [`Minimal rekomendasi (${r.minPct}%)`, M(v.kMin)], ['Total pengambilan di kunjungan ini', v.ambil > 0 ? M(v.ambil) : ''], ['Selisih terhadap minimal', v.ambil > 0 ? (v.ambil - v.kMin >= 0 ? '+' : '') + M(v.ambil - v.kMin) : '-'], ['Status', v.status]], columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'right', minCellHeight: 7 } }, showHead: false });
    }
    if (show.off || show.rec || show.on) {
      const sum = [];
      if (show.off || v.offPot > 0) sum.push(['Total Benefit OFF Faktur', 'Rp ' + RP(v.offTot)]);
      if (v.recBen > 0) sum.push([`Potongan strata dari rekomendasi order (${r.visits} kunjungan)`, 'Rp ' + RP(v.recBen)]);
      if (show.on && (pt || []).some((t) => t.tbl.jenis !== 'OFF')) sum.push(['Total Benefit ON Faktur', 'Rp ' + RP(v.onPot)]);
      if (sum.length) table({ body: sum, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } } });
      doc.setFillColor(...acc); doc.roundedRect(12, cur, W - 24, 8, 2, 2, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Estimasi total benefit program', 16, cur + 5.4); doc.text('Rp ' + RP(v.totBen), W - 16, cur + 5.4, { align: 'right' }); doc.setTextColor(30, 40, 50); cur += 12;
    }
    if (show.wajib && wajib) { heading('ITEM UNGGULAN WAJIB'); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean(wajib), W / 2, cur + 2, { align: 'center', maxWidth: W - 30 }); cur += 8; }
    if (show.sig) {
      let top = Math.max(cur + 6, H - 40);
      if (top > H - 28) { doc.addPage(); top = 24; }
      const labs = ['Salesman', 'SAC', 'Branch Head', clean(r.name).slice(0, 18)];
      const bw = (W - 24) / 4;
      labs.forEach((l, i) => { doc.setDrawColor(150); doc.line(12 + i * bw + 3, top + 18, 12 + (i + 1) * bw - 3, top + 18); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.text(l, 12 + i * bw + bw / 2, top + 22, { align: 'center' }); });
    }
  });
  if (output === 'blob') return doc.output('blob');
  doc.save(`${file}.pdf`);
  return null;
}
