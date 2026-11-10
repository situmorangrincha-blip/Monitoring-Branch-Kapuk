// Isi kontrak ITG Supercup per outlet: baris program Supercup (potensi reward) + total benefit bersama tabel program ON/OFF faktur.
import { keyLabel } from './scup.js';

const pc = (x) => String(x).replace('.', ',') + '%';
export const numOnly = (t) => { const x = String(t ?? '').trim(); if (!x || !/^[\d.,\s]+$/.test(x)) return 0; const n = parseFloat(x.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// r: baris hasil computeScup; ce: pengaturan kontrak khusus toko; show: tabel yang tampil; pt: [{ tbl, rows }] baris efektif tabel program
export function scupContractView(r, cfg, qMonths, ce, show, pt = []) {
  const ov = ce?.contract?.ov || {};
  const OV = (k, a) => ov[k] ?? a;
  const lines = [];
  for (const k of qMonths) {
    const m = r.mo[k];
    if (!(m.T > 0) && !(m.A > 0)) continue;
    lines.push({ key: 'm:' + k, kind: 'm', mk: k, label: `ITG Supercup ${keyLabel(k)}${m.assumed ? ' ~' : ''}`, T: m.T, Tauto: m.Tauto, A: m.A, Aauto: m.Aauto, future: m.future, miss: m.miss, pct: m.pct, gap: m.A == null ? null : Math.max(0, m.T - m.A), benefit: pc(cfg.r1), rewardAuto: m.potential, reward: OV('pr:' + k, m.potential), rk: 'pr:' + k });
  }
  lines.push({ key: 'q', kind: 'q', label: `Quartal ${keyLabel(qMonths[0])} - ${keyLabel(qMonths[2])}`, T: r.TQ, A: r.AQ, pct: r.pctQ, gap: Math.max(0, r.TQ - r.AQ), benefit: pc(cfg.r2), rewardAuto: r.potQ, reward: OV('prq', r.potQ), rk: 'prq' });
  lines.push({ key: 'b', kind: 'b', label: 'Big cup (omset quartal)', T: null, A: r.bigOm, pct: null, gap: null, benefit: pc(cfg.r3), rewardAuto: r.rBauto, reward: OV('prb', r.rBauto), rk: 'prb' });
  const sumSc = lines.reduce((a, l) => a + (l.reward || 0), 0);
  const potSum = (f) => pt.filter(f).reduce((a, t) => a + (t.rows || []).reduce((b, x) => b + numOnly(x.pot), 0), 0);
  const offPotAuto = show.on ? potSum((t) => t.tbl.jenis === 'OFF') : 0;
  const onPotAuto = potSum((t) => t.tbl.jenis !== 'OFF');
  const onPot = OV('onpot', onPotAuto);
  const offTotAuto = (show.scup ? sumSc : 0) + offPotAuto;
  const offTot = OV('offtot', offTotAuto);
  const totBenAuto = offTot + (show.on ? onPot : 0);
  const totBen = OV('tot', totBenAuto);
  return { OV, lines, sumSc, offPotAuto, offTotAuto, offTot, onPotAuto, onPot, totBenAuto, totBen, ambil: pt.flatMap((t) => t.rows || []).reduce((a, x) => a + numOnly(x.ambil), 0) };
}
