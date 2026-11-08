// Rekomendasi kontrak toko ITG: minimal order per kunjungan dari target, dan breakdown diskon ON faktur (strata) untuk mencapainya.
// Semua angka bisa dikustom per toko (cfg) atau massal (defaults); tanpa kustom = rekomendasi.
import { aliasMap } from './ingest.js';
import { visitsInMonth } from './dapAuto.js';
import { makeCtx, programsForStore } from './progcat.js';

const STRATA = (sb) => {
  const b = `${sb.b || ''} ${sb.n || ''}`.toUpperCase();
  if (b.includes('GARUDA')) return 'Strata Garuda';
  if (b.includes('CHOCOLATOS') || b.includes('GERY')) return 'Strata Chocolatos & Gery';
  if (b.includes('DILAN')) return 'Strata Dilan (volume)';
  return null;
};
const skey = (sb) => sb.c || sb.n;

// pengaturan efektif toko: pengaturan umum (defaults) ditimpa hanya pada bagian yang diubah di toko itu
export const eff = (cfg, id) => {
  const d = cfg?.defaults || {}; const s = cfg?.stores?.[id] || {};
  return {
    tables: { off: true, rec: true, on: true, ...(d.tables || {}), ...(s.tables || {}) },
    dis: (k) => { if (s.diskon && s.diskon[k] != null) return !!s.diskon[k]; if (d.diskon && d.diskon[k] != null) return !!d.diskon[k]; return true; },
  };
};
export function emptyCfg() { return { defaults: { basis: 100, visits: null }, stores: {} }; }
export const storeCustom = (cfg, id) => (cfg?.stores?.[id] && Object.keys(cfg.stores[id]).length ? cfg.stores[id] : null);

export function recommend(data, row, env, cfg) {
  const { time, holidays } = env;
  const custom = cfg?.stores?.[row.id] || {};
  const e = eff(cfg, row.id);
  const def = cfg?.defaults || {};
  const st = row.store;
  const monthTarget = time.m === (env.m1 ?? time.m) ? row.t1 : row.t2;
  const autoVisits = st ? visitsInMonth(st.hk, time.y, time.m, holidays) : 0;
  const visits = Math.max(1, +(custom.visits ?? def.visits ?? autoVisits) || 4);
  const basis = +(custom.basis ?? def.basis ?? 100);
  const perVisit100 = monthTarget / visits;
  const perVisit = custom.perVisit > 0 ? +custom.perVisit : Math.round((perVisit100 * basis) / 100);
  const am = aliasMap(data.skudb);
  const price = (sb) => { const it = am.get(String(sb.c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')); return it?.h || 0; };
  // komposisi dasar = kontribusi omset SKU toko bulan ini
  const cur = data.cat?.cur?.[row.id] || {};
  const comp = Object.entries(cur).map(([i, v]) => ({ i: +i, sb: data.subs[i], v })).filter((x) => x.sb && x.v > 0).sort((a, b) => b.v - a.v);
  const tot = comp.reduce((a, x) => a + x.v, 0);
  const removed = new Set(custom.removed || []);
  let lines = [];
  for (const x of comp.slice(0, 8)) {
    const k = skey(x.sb);
    if (removed.has(k)) continue;
    const p = price(x.sb);
    const val = perVisit * (x.v / tot);
    let cartons = p > 0 ? Math.max(1, Math.round(val / p)) : null;
    if (custom.cartons?.[k] != null) cartons = +custom.cartons[k];
    lines.push({ key: k, name: x.sb.n, brand: x.sb.b, strata: STRATA(x.sb), price: p, cartons, share: x.v / tot, manual: custom.cartons?.[k] != null });
  }
  for (const a of custom.added || []) {
    if (lines.some((l) => l.key === a.key)) continue;
    const sb = data.subs.find((s) => skey(s) === a.key);
    if (sb) lines.push({ key: a.key, name: sb.n, brand: sb.b, strata: STRATA(sb), price: price(sb), cartons: +a.cartons || 1, share: 0, manual: true, added: true });
  }
  for (const l of lines) l.value = l.cartons != null && l.price ? Math.round(l.cartons * l.price) : 0;
  // tanpa komposisi SKU: tetap tampilkan minimal order per kunjungan (tanpa rincian diskon)
  if (!lines.length) lines.push({ key: '_total', name: 'Total order per kunjungan (tambah SKU untuk rincian diskon)', brand: '', strata: null, price: 0, cartons: null, value: perVisit, share: 1, pseudo: true });
  // strata diskon per kelompok brand (volume karton per kunjungan)
  const rows = data.progcat?.strata || [];
  const groups = {};
  for (const l of lines) if (l.strata && l.cartons) (groups[l.strata] ||= { prog: l.strata, cartons: 0 }).cartons += l.cartons;
  for (const g of Object.values(groups)) {
    const tiers = rows.filter((r) => r.Program === g.prog && /JAWA|SEMUA/i.test(String(r.Wilayah))).map((r) => ({ a: +r.Dari || 0, b: r.Sampai === '' || r.Sampai == null ? Infinity : +r.Sampai, pct: +r['Diskon %'] || 0 })).sort((x, y) => x.a - y.a);
    const hit = tiers.find((t) => g.cartons >= t.a && g.cartons <= t.b);
    const next = tiers.find((t) => t.a > g.cartons);
    g.autoPct = hit ? hit.pct : 0;
    g.pct = custom.pct?.[g.prog] != null ? +custom.pct[g.prog] : g.autoPct;
    g.manualPct = custom.pct?.[g.prog] != null;
    g.next = next ? { need: next.a - g.cartons, pct: next.pct } : null;
    g.hasTiers = tiers.length > 0;
    g.off = !e.dis('strata:' + g.prog);
    if (g.off) g.pct = 0;
  }
  for (const l of lines) { l.pct = l.strata && groups[l.strata] ? groups[l.strata].pct : 0; l.potongan = Math.round((l.value * l.pct) / 100); }
  // program ON faktur lain (non-strata) yang berlaku untuk toko ITG: satu kali kelipatan per kunjungan
  const ctx = makeCtx(data);
  const xoff = new Set(custom.xoff || []);
  const extras = [];
  for (const g of programsForStore(data, st, ctx).filter((q) => q.status === 'ya' && q.jenis === 'ON FAKTUR' && !/^ITG-GG/.test(q.code))) {
    for (const r of g.rows) {
      const v = r['Nilai Reward'];
      let pot = 0;
      if (typeof v === 'string' && /potongan\s*rp\s*([\d.]+)/i.test(v)) pot = +/potongan\s*rp\s*([\d.]+)/i.exec(v)[1].replace(/\./g, '');
      else if (/potongan rp/i.test(r['Tipe Reward']) && typeof v === 'number') pot = v;
      extras.push({ code: g.code, nama: g.nama, min: r['Min Order'], satuan: r.Satuan, reward: `${v} ${r['Satuan Reward'] || ''}`.trim(), potongan: pot, off: xoff.has(g.code) || !e.dis('on:' + g.code) });
    }
  }
  const orderValue = lines.reduce((a, l) => a + l.value, 0);
  const potStrata = lines.reduce((a, l) => a + l.potongan, 0);
  const potExtra = extras.filter((e) => !e.off).reduce((a, e) => a + e.potongan, 0);
  const potonganVisit = potStrata + potExtra;
  return {
    id: row.id, visits, autoVisits, basis, monthTarget, perVisit100, perVisit70: Math.round(perVisit100 * 0.7), perVisit, perVisitManual: custom.perVisit > 0,
    lines, groups: Object.values(groups), extras, orderValue, potStrata, potExtra, potonganVisit, potonganBulan: potonganVisit * visits,
    effPct: orderValue ? potonganVisit / orderValue : 0, hasSku: comp.length > 0, noPrice: lines.filter((l) => !l.pseudo && l.cartons != null && !l.price).map((l) => l.name),
    custom: !!(Object.keys(custom).length), vsTarget: perVisit ? orderValue / perVisit : null,
  };
}
