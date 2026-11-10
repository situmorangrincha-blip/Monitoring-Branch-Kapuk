import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numOnly } from './scupContract.js';

// PDF kontrak ITG Supercup: satu halaman per outlet, isinya sama dengan kertas di layar.
const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
const idf = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');

// items: [{ r, show, pt, wajib, v }] (v = hasil scupContractView)
export function makeScupContractPdf(items, { unit = 'jt', periode = '', depot = '', team = '', output = 'save', file = 'Kontrak-ITG-Supercup', orientation = 'portrait' } = {}) {
  if (!items.length) throw new Error('Tidak ada kontrak untuk dicetak');
  const RP = (v) => idf(v || 0, 0);
  const R = (v) => (v == null ? '-' : RP(v));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation === 'landscape' ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const acc = depot && /kapuk/i.test(depot) ? [79, 148, 166] : [201, 104, 59];
  const base = { margin: { left: 12, right: 12 }, styles: { fontSize: 8.5, cellPadding: 1.7, lineColor: [200, 205, 215], lineWidth: 0.2, overflow: 'linebreak' }, headStyles: { fillColor: acc, textColor: 255, halign: 'center' }, theme: 'grid' };
  items.forEach(({ r, show, pt, wajib, v }, idx) => {
    if (idx) doc.addPage();
    const cv = (g, k) => show.cols?.[g + '.' + k] !== false;
    doc.setFillColor(...acc); doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(clean(`PACKAGE DEVELOPMENT PROGRAM - ITG SUPERCUP${periode ? ' - ' + periode.toUpperCase() : ''}`), W / 2, 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean([depot, team && `Tim ${team}`].filter(Boolean).join(' | ')), W / 2, 17, { align: 'center' });
    doc.setTextColor(30, 40, 50); doc.setFontSize(9.5);
    const info = [['Pelanggan', r.name], ['ID Pelanggan', r.id], ['Salesman', r.sales], ['Jadwal', r.hk || '-']];
    let y = 30;
    for (const [k, val] of info) { doc.setFont('helvetica', 'bold'); doc.text(k, 14, y); doc.setFont('helvetica', 'normal'); doc.text(': ' + clean(val), 44, y); y += 5.2; }
    let cur = y + 2;
    const heading = (t) => { if (cur > H - 50) { doc.addPage(); cur = 16; } doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 40, 50); doc.text(t, W / 2, cur + 3, { align: 'center' }); cur += 5; };
    const table = (opts) => { autoTable(doc, { ...base, startY: cur, ...opts }); cur = doc.lastAutoTable.finalY + 3; };
    if (!show.scup && !show.on) { doc.setFontSize(9); doc.text('Semua tabel disembunyikan.', W / 2, cur + 6, { align: 'center' }); }
    if (show.scup) {
      heading('PROGRAM ITG SUPERCUP (OFF FAKTUR)');
      const cols = [['n', 'Program'], ['target', 'Target (ctn)'], ['actual', 'Actual'], ['pct', '%'], ['gap', 'Gap'], ['benefit', 'Benefit'], ['reward', 'Reward (potensi)']];
      const use = cols.filter((c) => c[0] === 'n' || cv('scup', c[0]));
      const cell = (l, k) => {
        if (k === 'n') return clean(l.label);
        if (k === 'target') return l.T == null ? '-' : idf(l.T, 1);
        if (k === 'actual') return l.kind === 'b' ? 'Rp ' + RP(l.A) : l.future ? '-' : l.A == null ? '-' : idf(l.A, 1);
        if (k === 'pct') return l.pct == null ? '-' : Math.round(l.pct * 100) + '%';
        if (k === 'gap') return l.gap == null ? '-' : idf(l.gap, 1);
        if (k === 'benefit') return l.benefit;
        return R(l.reward);
      };
      const body = v.lines.map((l) => use.map((c) => cell(l, c[0])));
      const ri = use.findIndex((c) => c[0] === 'reward');
      if (ri > 0) { const tr = use.map(() => ''); tr[0] = 'Total Benefit ITG Supercup'; tr[ri] = RP(v.sumSc); body.push(tr); }
      table({ head: [use.map((c) => c[1])], body, columnStyles: { 0: { halign: 'left' } }, bodyStyles: { halign: 'right' }, didParseCell: (d) => { if (d.section === 'body' && String(d.row.raw?.[0] || '').startsWith('Total Benefit')) d.cell.styles.fontStyle = 'bold'; } });
    }
    if (show.on) {
      for (const t of pt || []) {
        heading(clean(t.tbl.title).toUpperCase());
        const cols = [['n', 'Program'], ['min', 'Min order'], ['sat', 'Satuan'], ['dis', 'Diskon / reward'], ['pot', 'Benefit toko'], ['ambil', 'Pengambilan']];
        const use = cols.filter((c) => c[0] === 'n' || cv('on', c[0]));
        const cell = (x, k) => (k === 'pot' ? (numOnly(x.pot) ? RP(numOnly(x.pot)) : '') : clean(x[k] ?? ''));
        const body = t.rows.map((x) => use.map((c) => cell(x, c[0])));
        if (!body.length) body.push(use.map((c, i) => (i === 0 ? 'Tidak ada program terpilih yang berlaku untuk outlet ini' : '')));
        const potI = use.findIndex((c) => c[0] === 'pot');
        if (potI > 0 && t.rows.length) { const tr = use.map(() => ''); tr[0] = `Total Benefit ${t.tbl.jenis === 'OFF' ? 'OFF ' : t.tbl.jenis === 'ON' ? 'ON ' : ''}Faktur`; tr[potI] = RP(t.rows.reduce((a, x) => a + numOnly(x.pot), 0)); body.push(tr); }
        table({ head: [use.map((c) => c[1])], body, columnStyles: { 0: { halign: 'left' } }, bodyStyles: { halign: 'right', minCellHeight: 7 }, didParseCell: (d) => { if (d.section === 'body' && String(d.row.raw?.[0] || '').startsWith('Total Benefit')) d.cell.styles.fontStyle = 'bold'; } });
      }
    }
    if (show.scup || show.on) {
      const sum = [];
      if (show.scup || v.offPotAuto > 0) sum.push(['Total Benefit OFF Faktur', 'Rp ' + RP(v.offTot)]);
      if (show.on && (pt || []).some((t) => t.tbl.jenis !== 'OFF')) sum.push(['Total Benefit ON Faktur', 'Rp ' + RP(v.onPot)]);
      if (sum.length) table({ body: sum, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } } });
      if (cur > H - 36) { doc.addPage(); cur = 16; }
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
