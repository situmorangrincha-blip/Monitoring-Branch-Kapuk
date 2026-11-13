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
// nama SAK bawaan per depo dan tim (bisa diubah di Aturan salesman; isian kosong berarti tanpa SAK)
export const SAK_DEFAULT = { 'kebayoran/arjuna': 'Rincha', 'kebayoran/bima': 'Dezzy', 'kapuk/arjuna': 'Hanson', 'kapuk/bima': 'Mohammad Zia' };
export const sakDefaultFor = (depot, team) => SAK_DEFAULT[`${depot}/${team}`] || '';
export const defaultRulesFor = (depot, team) => {
  const sak = sakDefaultFor(depot, team);
  if (depot === 'kebayoran' && team === 'arjuna') return { ...DEFAULT_RULES, sak, replace: [] };
  return sak ? { seed: true, items: [], sak, replace: [] } : null;
};
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

// ---------------- SAK, salesman pengganti, dan nama di luar JKS ----------------
// Pivot / TGT bisa memuat nama yang tidak ada di JKS (SAK, salesman lama). Namanya diatur di Aturan salesman:
//  - salesman pengganti: omset dan target nama lama dikreditkan ke pengganti
//  - SAK: tampil sebagai baris sendiri (tanpa ranking) dan ikut grand total tim
//  - nama lain yang belum diatur: dikumpulkan di "Lainnya (di luar JKS)" supaya total tim sama dengan pivot
const nrm = (x) => String(x ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const hasTokens = (name, q) => { const t = nrm(q).split(' ').filter(Boolean); if (!t.length) return false; const w = new Set(nrm(name).split(' ')); return t.every((x) => w.has(x)); };
const addPr = (to, from) => { for (const [k, v] of Object.entries(from || {})) to[k] = (to[k] || 0) + (typeof v === 'number' ? v : 0); return to; };
const jt = (n) => Math.round((n || 0) / 1e4) / 100;

export function applyPeople(d, rules, depot, team) {
  d.extraSales = []; d.extraNames = []; d.sakNames = [];
  const ex = d.extra;
  const sak = rules && Object.prototype.hasOwnProperty.call(rules, 'sak') ? String(rules.sak || '') : sakDefaultFor(depot, team);
  d.sakName = sak;
  d.sakNames = (d.salesmen || []).filter((x) => sak && hasTokens(x, sak)); // SAK yang punya toko JKS sendiri
  if (!ex || !Object.keys(ex.pAct || {}).length) return d;
  d.pAct = Object.fromEntries(Object.entries(d.pAct).map(([k, v]) => [k, { ...v }]));
  d.targets = { ...d.targets, milestone: { ...(d.targets.milestone || {}) }, bti: d.targets.bti ? { ...d.targets.bti } : d.targets.bti };
  const repl = new Map((rules?.replace || []).filter((x) => x.from && x.to).map((x) => [nrm(x.from), x.to]));
  const idx = new Map((d.salesmen || []).map((x) => [nrm(x), x]));
  const tgtOf = (md, n) => ex.tgt?.[md]?.[n];
  const others = { name: 'Lainnya (di luar JKS)', kind: 'lain', pAct: {}, tgt: { milestone: null, bti: null }, names: [] };
  const sakRow = {};
  for (const [n, pa] of Object.entries(ex.pAct)) {
    d.extraNames.push({ name: n, act: pa.total || 0 });
    const to = idx.get(nrm(repl.get(nrm(n)) || ''));
    if (to) {
      const dst = (d.pAct[to] ||= { total: 0 }); addPr(dst, pa);
      for (const md of ['milestone', 'bti']) { const t = tgtOf(md, n); if (t && d.targets[md]) d.targets[md][to] = addPr({ ...(d.targets[md][to] || {}) }, t); }
      d.warnings.push(`Info: omset ${n} (Rp ${jt(pa.total)} jt) dikreditkan ke ${to} sebagai salesman pengganti`);
    } else if (sak && hasTokens(n, sak)) {
      const o = (sakRow[n] ||= { name: n, kind: 'sak', pAct: {}, tgt: { milestone: null, bti: null } }); addPr(o.pAct, pa);
      for (const md of ['milestone', 'bti']) { const t = tgtOf(md, n); if (t) o.tgt[md] = t; }
    } else {
      addPr(others.pAct, pa); others.names.push(n);
      for (const md of ['milestone', 'bti']) { const t = tgtOf(md, n); if (t) others.tgt[md] = addPr({ ...(others.tgt[md] || {}) }, t); }
    }
  }
  // SAK yang punya target di TGT tetapi tidak ada omsetnya
  for (const md of ['milestone', 'bti']) for (const [n, t] of Object.entries(ex.tgt?.[md] || {})) if (sak && hasTokens(n, sak) && !sakRow[n] && !ex.pAct[n]) { sakRow[n] = { name: n, kind: 'sak', pAct: { total: 0 }, tgt: { milestone: null, bti: null } }; sakRow[n].tgt[md] = t; }
  for (const o of Object.values(sakRow)) { d.extraSales.push(o); d.sakNames.push(o.name); d.warnings.push(`Info: SAK ${o.name}: omset Rp ${jt(o.pAct.total)} jt, ikut grand total tim`); }
  if (others.names.length) {
    d.extraSales.push(others);
    d.warnings.push(`Nama di pivot yang tidak ada di JKS dan belum diatur (${others.names.join(', ')}): omset Rp ${jt(others.pAct.total)} jt dimasukkan ke "Lainnya (di luar JKS)" supaya total tim sama dengan pivot. Atur salesman pengganti atau nama SAK di Upload > Per slot > Aturan salesman.`);
  }
  return d;
}
