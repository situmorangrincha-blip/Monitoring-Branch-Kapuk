// Aturan salesman khusus: toko tertentu dipindah ke salesman lain (actual, target, L3M ikut pindah), mis. Vini memegang 6 toko.
// Disimpan terpisah dari data harian (slot "rules"), jadi tiap upload baru otomatis kena aturan ini.
const MILESTONE_FACTOR = 1.1; // milestone = BTI × 110%

// seed bawaan untuk SP Kebayoran · Arjuna (target BTI per toko dari tabel Vini)
export const DEFAULT_RULES = {
  seed: true,
  items: [{
    sales: 'Vini', factor: MILESTONE_FACTOR,
    stores: [
      { id: '0007-20-000022701', name: 'AS TOKO', bti: 42016000, pr: { GPPJ: 35013000, GEN: 4031000, GBS: 1170000 } },
      { id: '0005-19-000020256', name: 'Baru Tk', bti: 99267000, pr: { GPPJ: 90978000, GEN: 4490000, GBS: 1605000 } },
      { id: '0005-23-000022042', name: 'BERKAH MAKMUR', bti: 34532000, pr: { GPPJ: 30904000, GEN: 1871000, GBS: 1413000 } },
      { id: '0005-04-000003151', name: 'HAYATI', bti: 48419000, pr: { GPPJ: 43810000, GEN: 1714000, GBS: 1012000 } },
      { id: '0007-20-000023062', name: 'KOP KARYA BERSAMA', bti: 100376000, pr: { GPPJ: 82285000, GEN: 7470000, GBS: 3681000 } },
      { id: '0005-99-000000731', name: 'TOKO MASPRI', bti: 107355000, pr: { GPPJ: 92865000, GEN: 9536000, GBS: 740000 } },
    ],
  }],
};
export const defaultRulesFor = (depot, team) => (depot === 'kebayoran' && team === 'arjuna' ? DEFAULT_RULES : null);
export const ruleTarget = (store, mode, factor = MILESTONE_FACTOR) => (mode === 'bti' ? store.bti : Math.round(store.bti * factor));

// pindahkan toko, hitung ulang pAct dan target salesman tujuan. d = dataset (sudah dikloning oleh pemanggil)
export function applyRules(d, rules) {
  const items = rules?.items || [];
  if (!items.length) return d;
  d.pAct = Object.fromEntries(Object.entries(d.pAct).map(([k, v]) => [k, { ...v }]));
  d.targets = { ...d.targets, milestone: { ...(d.targets.milestone || {}) }, bti: d.targets.bti ? { ...d.targets.bti } : d.targets.bti };
  d.ruleInfo = [];
  for (const r of items) {
    const byId = new Map(r.stores.map((x) => [x.id, x]));
    const moved = d.stores.filter((s) => byId.has(s.id));
    if (!moved.length) { d.warnings.push(`Aturan ${r.sales}: tidak satu pun tokonya ada di data ini, dilewati`); continue; }
    const to = (d.pAct[r.sales] ||= { total: 0 });
    let clamped = false;
    for (const s of moved) {
      const from = s.sales;
      const src = d.pAct[from];
      const per = {};
      for (const [i, v] of Object.entries(d.cat?.cur?.[s.id] || {})) { const p = d.subs[i]?.p; if (p) per[p] = (per[p] || 0) + v; }
      if (src) {
        if (src.total < s.act) clamped = true;
        src.total = Math.max(0, (src.total || 0) - s.act);
        for (const [p, v] of Object.entries(per)) if (p in src) src[p] = Math.max(0, src[p] - v);
      }
      to.total = (to.total || 0) + s.act;
      for (const [p, v] of Object.entries(per)) to[p] = (to[p] || 0) + v;
      const x = byId.get(s.id);
      s.from = from; s.sales = r.sales; s.rule = r.sales; s.tgtBti = x.bti; s.tgt = Math.round(x.bti * (r.factor || MILESTONE_FACTOR));
    }
    if (!d.salesmen.includes(r.sales)) d.salesmen = [...d.salesmen, r.sales];
    const sumBti = moved.reduce((a, s) => a + s.tgtBti, 0);
    const prSum = (k) => moved.reduce((a, s) => a + (byId.get(s.id).pr?.[k] || 0), 0);
    const mk = (f) => { const o = { total: Math.round(sumBti * f) }; for (const p of d.principals) { const v = prSum(p); if (v) o[p] = Math.round(v * f); } return o; };
    d.targets.milestone[r.sales] = mk(r.factor || MILESTONE_FACTOR);
    if (d.targets.bti) d.targets.bti[r.sales] = mk(1);
    d.ruleInfo.push({ sales: r.sales, n: moved.length, of: r.stores.length, bti: sumBti });
    d.warnings.push(`Aturan ${r.sales}: ${moved.length} dari ${r.stores.length} toko dipindah ke ${r.sales} (actual, L3M, dan target BTI ${Math.round(sumBti).toLocaleString('id-ID')}; milestone = BTI × ${r.factor || MILESTONE_FACTOR})`);
    if (clamped) d.warnings.push(`Info: pivot salesman asal lebih kecil dari ACT toko yang dipindah (pivot belum ter-refresh ke periode yang sama?), jadi total asalnya dinolkan`);
  }
  return d;
}
