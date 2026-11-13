// Rapot salesman: nilai 0-100 per indikator, dirata-rata berbobot (indikator tanpa data dilewati, bobotnya dibagi ke yang ada).
import { matchName } from './market.js';

export const IND = [
  { id: 'omset', label: 'Omset vs target', w: 30, how: 'ACT ÷ (target x timegone), maksimal 100' },
  { id: 'ca', label: 'CA (toko transaksi)', w: 8, how: 'toko dengan ACT >= Rp1 ÷ jumlah toko' },
  { id: 'caprod', label: 'CA Produktif', w: 7, how: 'toko dengan ACT >= minimum ÷ jumlah toko' },
  { id: 'pareto', label: 'Toko Pareto', w: 10, how: 'ACT toko Pareto ÷ (targetnya x timegone), maksimal 100' },
  { id: 'growth', label: 'Pertumbuhan vs LM', w: 5, how: 'ACT ÷ (LM x timegone), maksimal 100' },
  { id: 'ec', label: 'EC (Effective Call)', w: 10, how: 'EC actual ÷ EC target per hari (file Market Productivity), maksimal 100' },
  { id: 'ac', label: 'AC (Actual Call)', w: 5, how: 'AC actual ÷ AC target per hari (file Market Productivity), maksimal 100' },
  { id: 'itg', label: 'ITG', w: 15, how: 'Actual ITG ÷ (target ITG x timegone periode ITG), maksimal 100' },
  { id: 'mss', label: 'MSS', w: 10, how: 'MSS actual ÷ MSS target (file Market Productivity), maksimal 100' },
];
export const DEFAULT_W = Object.fromEntries(IND.map((i) => [i.id, i.w]));
const cap = (v) => Math.max(0, Math.min(100, v));
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
export const grade = (v) => (v >= 85 ? 'Sangat baik' : v >= 70 ? 'Baik' : v >= 55 ? 'Cukup' : 'Perlu perhatian');

export function scoreSalesman(data, name, mode, time, W = DEFAULT_W) {
  const stores = data.stores.filter((s) => s.sales === name);
  const act = sum(stores, (s) => s.act);
  const tgt = data.targets?.[mode]?.[name]?.total || data.targets?.milestone?.[name]?.total || sum(stores, (s) => s.tgt);
  const tg = time.tg;
  const n = stores.length;
  const ind = {};
  ind.omset = tgt > 0 && tg > 0 ? { raw: act / (tgt * tg), score: cap((act / (tgt * tg)) * 100), note: `ACT ${Math.round(act / 1e6)} jt dari target ${Math.round(tgt / 1e6)} jt` } : null;
  ind.ca = n ? { raw: stores.filter((s) => s.act >= 1).length / n, score: cap((stores.filter((s) => s.act >= 1).length / n) * 100), note: `${stores.filter((s) => s.act >= 1).length} dari ${n} toko` } : null;
  ind.caprod = n ? { raw: stores.filter((s) => s.act >= (s.min || 200000)).length / n, score: cap((stores.filter((s) => s.act >= (s.min || 200000)).length / n) * 100), note: `${stores.filter((s) => s.act >= (s.min || 200000)).length} dari ${n} toko` } : null;
  const par = stores.filter((s) => s.pj);
  const pT = sum(par, (s) => (mode === 'bti' && s.tgtBti != null ? s.tgtBti : s.tgt));
  ind.pareto = par.length && pT > 0 && tg > 0 ? { raw: sum(par, (s) => s.act) / (pT * tg), score: cap((sum(par, (s) => s.act) / (pT * tg)) * 100), note: `${par.length} toko Pareto` } : null;
  const lm = sum(stores, (s) => s.lm);
  ind.growth = lm > 0 && tg > 0 ? { raw: act / (lm * tg), score: cap((act / (lm * tg)) * 100), note: `LM ${Math.round(lm / 1e6)} jt` } : null;

  // Market Productivity: EC, AC, MSS
  const mk = data.market;
  const same = (n) => matchName(n, data.salesmen) === name;
  const ms = mk?.salesman?.find((x) => same(x.name));
  ind.ec = ms && ms.ecT > 0 ? { raw: ms.ecA / ms.ecT, score: cap((ms.ecA / ms.ecT) * 100), note: `EC ${ms.ecA.toFixed(1)} dari ${ms.ecT} per hari` } : null;
  ind.ac = ms && ms.acT > 0 ? { raw: ms.acA / ms.acT, score: cap((ms.acA / ms.acT) * 100), note: `AC ${ms.acA.toFixed(1)} dari ${ms.acT} per hari` } : null;
  const mss = mk?.mss?.sales?.find((x) => same(x.name));
  ind.mss = mss && mss.tgt > 0 ? { raw: mss.act / mss.tgt, score: cap((mss.act / mss.tgt) * 100), note: `${mss.act} dari ${mss.tgt} toko` } : null;
  // ITG: actual semua bulan ITG ÷ (target ITG x porsi waktu yang sudah berjalan di periode ITG)
  const itg = data.itg2;
  ind.itg = null;
  if (itg?.items?.length && itg.months?.length) {
    const mine = itg.items.filter((x) => same(x.sales));
    const iT = sum(mine, (x) => x.t2 || 0), iA = sum(mine, (x) => (x.a?.[0] || 0) + (x.a?.[1] || 0));
    const mi = itg.months.findIndex((x) => x.m === time.m);
    const last = itg.months[itg.months.length - 1];
    const pace = mi >= 0 ? (mi + tg) / itg.months.length : time.m > last.m ? 1 : 0;
    if (mine.length && iT > 0 && pace > 0) ind.itg = { raw: iA / (iT * pace), score: cap((iA / (iT * pace)) * 100), note: `${mine.length} toko ITG, actual ${Math.round(iA / 1e6)} jt dari target ${Math.round(iT / 1e6)} jt` };
  }

  let ws = 0, tot = 0;
  for (const i of IND) { const x = ind[i.id]; if (x && W[i.id] > 0) { ws += W[i.id]; tot += W[i.id] * x.score; } }
  const total = ws > 0 ? tot / ws : null;
  const sc = IND.filter((i) => ind[i.id]).map((i) => ({ id: i.id, label: i.label, score: ind[i.id].score }));
  const strong = [...sc].sort((a, b) => b.score - a.score).slice(0, 2);
  const weak = [...sc].sort((a, b) => a.score - b.score).slice(0, 2);
  const withT = stores.filter((s) => s.tgt > 0 && tg > 0).map((s) => ({ s, r: s.act / (s.tgt * tg) }));
  const best = [...stores].sort((a, b) => b.act - a.act).slice(0, 3);
  const worst = withT.sort((a, b) => a.r - b.r).slice(0, 3).map((x) => x.s);
  return { name, act, tgt, n, ind, total, strong, weak, best, worst, skipped: IND.filter((i) => !ind[i.id]).map((i) => i.label) };
}

export function rapotAll(data, mode, time, W = DEFAULT_W) {
  const ruled = new Set((data.rules?.items || []).map((r) => r.sales));
  const rows = data.salesmen.map((nm) => ({ ...scoreSalesman(data, nm, mode, time, W), ranked: !ruled.has(nm) }));
  // SAK dan nama di luar JKS: tampil tanpa ranking, omsetnya tetap masuk total tim
  const tgm = data.targets?.[mode] || data.targets?.milestone || {};
  for (const e of data.extraSales || []) {
    const t = (e.tgt?.[mode] || e.tgt?.milestone)?.total || 0, a = e.pAct?.total || 0;
    rows.push({ name: e.kind === 'sak' ? `${e.name} (SAK)` : e.name, act: a, tgt: t, ind: {}, total: null, strong: [], weak: [], best: [], worst: [], ranked: false, rank: null, kind: e.kind, skipped: true });
  }
  void tgm;
  const rk = rows.filter((r) => r.ranked && r.total != null).sort((a, b) => b.total - a.total);
  rk.forEach((r, i) => { r.rank = i + 1; });
  return { rows, ranked: rk, nRanked: rk.length };
}
