import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IND, grade } from './rapot.js';

const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
const acc = (d) => (d === 'kapuk' ? [74, 143, 219] : [139, 123, 216]);
const col = (v) => (v >= 70 ? [47, 179, 109] : v >= 55 ? [242, 182, 50] : [229, 72, 77]);

export async function makeRapotPdf({ data, R, only, W, mode, time, depot, team }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const Wd = doc.internal.pageSize.getWidth();
  const a = acc(depot);
  const head = (t, s) => { doc.setFillColor(...a); doc.rect(0, 0, Wd, 20, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(clean(t), 12, 10); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(clean(s), 12, 16); doc.setTextColor(0); };
  const sub = `${data.meta.teamLabel || team} | ${mode === 'bti' ? 'BTI' : 'Milestone'} | timegone ${Math.round(time.tg * 100)}% | s/d ${time.asOf}`;
  const rows = only ? R.rows.filter((r) => r.name === only) : null;
  let first = true;
  if (!only) {
    head('RAPOT SALESMAN - PERINGKAT', sub);
    const ord = [...R.ranked, ...R.rows.filter((r) => !r.ranked || r.total == null)];
    autoTable(doc, { startY: 26, margin: { left: 10, right: 10 }, styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: a },
      head: [['#', 'Salesman', 'Nilai', 'Predikat', ...IND.map((i) => i.label.split(' ')[0])]],
      body: ord.map((r) => [r.ranked && r.rank ? r.rank : '-', clean(r.name) + (r.ranked ? '' : ' *'), r.total == null ? '-' : r.total.toFixed(1), r.total == null ? '-' : grade(r.total), ...IND.map((i) => (r.ind[i.id] ? Math.round(r.ind[i.id].score) : '-'))]) });
    doc.setFontSize(8); doc.setTextColor(110); doc.text('* dinilai terpisah, tidak masuk peringkat. Bobot: ' + IND.map((i) => `${i.label.split(' ')[0]} ${W[i.id]}`).join(', '), 10, doc.lastAutoTable.finalY + 6); doc.setTextColor(0);
    first = false;
  }
  for (const r of rows || R.rows) {
    if (!first) doc.addPage(); first = false;
    head('RAPOT - ' + r.name, sub);
    doc.setFontSize(30); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(r.total == null ? [120, 120, 120] : col(r.total)));
    doc.text(r.total == null ? '-' : r.total.toFixed(1), 12, 40);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
    doc.text(`${r.total == null ? '' : grade(r.total)}${r.ranked && r.rank ? `  |  Peringkat ${r.rank} dari ${R.nRanked}` : '  |  tidak diranking'}`, 12, 47);
    doc.setTextColor(0);
    let y = 56;
    for (const i of IND) {
      const x = r.ind[i.id];
      doc.setFontSize(9.5); doc.text(`${i.label}  (bobot ${W[i.id]})`, 12, y);
      doc.setFont('helvetica', 'bold'); doc.text(x ? String(Math.round(x.score)) : '-', Wd - 12, y, { align: 'right' }); doc.setFont('helvetica', 'normal');
      doc.setFillColor(238, 238, 245); doc.roundedRect(12, y + 2, Wd - 24, 4, 2, 2, 'F');
      if (x) { doc.setFillColor(...col(x.score)); doc.roundedRect(12, y + 2, Math.max(1, ((Wd - 24) * x.score) / 100), 4, 2, 2, 'F'); }
      doc.setFontSize(8); doc.setTextColor(110); doc.text(clean(x ? x.note : 'belum ada data'), 12, y + 10); doc.setTextColor(0);
      y += 17;
    }
    doc.setFontSize(9.5);
    doc.text(clean(`Kuat: ${r.strong.map((x) => x.label).join(', ') || '-'}`), 12, y + 2);
    doc.text(clean(`Perlu ditingkatkan: ${r.weak.map((x) => x.label).join(', ') || '-'}`), 12, y + 8);
    if (r.worst.length) doc.text(clean(`Toko paling tertinggal: ${r.worst.map((s) => s.name).join(', ')}`), 12, y + 14);
  }
  doc.save(`Rapot-${depot}-${team}-${only ? only.split(' ')[0] : 'semua'}-${time.y}-${String(time.m).padStart(2, '0')}.pdf`);
}
