// PDF DAP: per salesman -> halaman DAP utama, lalu (opsional) halaman Fokus Pareto (satu toko = satu kartu). A4 landscape.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { weekdayName } from './dapModel.js';

const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rp = (n) => Math.round(n || 0).toLocaleString('id-ID');
const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
const PURPLE = [139, 123, 216];
const BLUE = [74, 143, 219];

function colStyles(cols, usable) {
  const fixed = cols.reduce((a, c) => a + (c.w || 0), 0);
  const autoMin = cols.some((c) => !c.w) ? 24 : 0;
  const scale = fixed > usable - autoMin ? (usable - autoMin) / fixed : 1;
  const out = {};
  cols.forEach((c, i) => {
    out[i] = { halign: c.al || 'left', ...(c.w ? { cellWidth: c.w * scale } : { cellWidth: 'auto' }), ...(c.bold ? { fontStyle: 'bold' } : {}) };
  });
  return { styles: out, scale };
}

export async function makeDapPdf({ data, model, only, y, m, d, cfg, asOf, depot, output = 'save' }) {
  const groups = only ? model.groups.filter((g) => g.name === only) : model.groups;
  if (!groups.length) throw new Error('Tidak ada toko untuk dicetak');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const accent = depot === 'kapuk' ? BLUE : PURPLE;
  const tgl = `${weekdayName(model.wd)}, ${d} ${MON[m - 1]} ${y}`;
  const team = data.meta.teamLabel || '';
  let first = true;
  const newPage = () => { if (!first) doc.addPage(); first = false; };

  const header = (title, sub, rTop, rSub) => {
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(clean(title), 10, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(clean(sub), 10, 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(clean(rTop), W - 10, 8, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(clean(rSub), W - 10, 14, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  for (const g of groups) {
    // ===== DAP utama =====
    newPage();
    header(`DAP ${team.toUpperCase()} - ${g.name}`, `${tgl}  |  ${g.n} toko  |  Actual s/d ${asOf}${g.progSum ? '  |  ' + g.progSum : ''}`, `Total PLAN: Rp ${rp(g.plan)}`, `Target DAP: Rp ${rp(g.target)}  |  Actual: Rp ${rp(g.actual)}`);
    const { styles, scale } = colStyles(model.head, W - 16);
    const fs = Math.max(5.5, 7.5 * Math.min(1, scale + 0.15));
    autoTable(doc, {
      startY: 22,
      margin: { left: 8, right: 8, top: 22, bottom: 12 },
      styles: { fontSize: fs, cellPadding: 1.3, lineColor: [215, 215, 232], lineWidth: 0.15, valign: 'middle', overflow: 'ellipsize' },
      headStyles: { fillColor: accent, textColor: 255, fontSize: fs, halign: 'center', overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [247, 246, 252] },
      head: [model.head.map((c) => c.label)],
      body: g.rows.map((x) => x.cells.map((v) => (typeof v === 'string' ? clean(v) : v))),
      columnStyles: styles,
      didParseCell: (h) => {
        const c = model.head[h.column.index];
        if (h.section === 'body' && c?.neg && String(h.cell.raw).startsWith('-')) h.cell.styles.textColor = [200, 40, 60];
        if (h.section === 'body' && h.cell.raw === 'tercapai') h.cell.styles.textColor = [30, 140, 80];
      },
      didDrawPage: () => {
        doc.setFontSize(7); doc.setTextColor(120, 120, 150);
        doc.text(clean(`${g.name} - ${tgl}`), 8, H - 5);
        doc.text(`Halaman ${doc.getNumberOfPages()}`, W - 8, H - 5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      },
    });

    // ===== Top N toko harian: satu halaman per salesman, fokus jadi kolom =====
    if (g.pareto && g.pareto.rows.length) {
      newPage();
      header(`TOP ${g.pareto.n} TOKO - ${g.name}`, `${tgl}  |  toko yang dikunjungi hari ini, urut Target DAP per kunjungan`, 'Top toko', `${team}`);
      const { styles: cs, scale } = colStyles(g.pareto.cols, W - 16);
      const fs2 = Math.max(5.5, 8.5 * Math.min(1, scale + 0.2));
      autoTable(doc, {
        startY: 22,
        margin: { left: 8, right: 8, bottom: 12 },
        styles: { fontSize: fs2, cellPadding: 1.8, lineColor: [215, 215, 232], lineWidth: 0.15, valign: 'middle', overflow: 'ellipsize', minCellHeight: 9 },
        headStyles: { fillColor: [235, 232, 250], textColor: [60, 50, 120], fontSize: fs2, halign: 'center', overflow: 'linebreak' },
        alternateRowStyles: { fillColor: [250, 249, 254] },
        head: [g.pareto.cols.map((c) => c.label)],
        body: g.pareto.rows.map((r) => r.map((v) => (typeof v === 'string' ? clean(v) : v))),
        columnStyles: cs,
      });
      doc.setFontSize(7); doc.setTextColor(120, 120, 150);
      doc.text(clean(`Top toko - ${g.name} - ${tgl}`), 8, H - 5);
      doc.setTextColor(0, 0, 0);
    }
  }
  if (output === 'blob') return doc.output('blob');
  const tag = only ? only.split(' ')[0] : 'semua-salesman';
  doc.save(`DAP-${depot}-${team}-${tag}-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}.pdf`);
}
