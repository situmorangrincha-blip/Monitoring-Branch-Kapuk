import { useMemo, useState } from 'react';
import { Panel } from '../components/ui.jsx';
import GTable, { fm } from '../components/GTable.jsx';
import { skuOptions } from '../lib/dapModel.js';
import { visitsInMonth } from '../lib/dapAuto.js';

const GROUPS = [['sku', 'SKU'], ['sub', 'Sub brand'], ['prin', 'Principal'], ['sales', 'Salesman'], ['ch', 'Channel'], ['size', 'Ukuran toko'], ['outlet', 'Outlet']];
const pcg = (a, b) => (b ? a / b - 1 : null);
const gcls = (v) => (v == null ? '' : v >= 0 ? 'ok' : 'neg');

export default function SkuRank({ data, pv, time }) {
  const sk = pv?.sku;
  const [grp, setGrp] = useState('sku');
  const [met, setMet] = useState('rp');
  const [src, setSrc] = useState('jks');
  const [fs, setFs] = useState('ALL'), [fc, setFc] = useState('ALL'), [fz, setFz] = useState('ALL'), [fp, setFp] = useState('ALL');
  const [qs, setQs] = useState('');
  const [cmp, setCmp] = useState('pace');
  const tg = time?.tg > 0 && time?.tg < 1 ? time.tg : 1;
  const base = (v) => (cmp === 'pace' ? v * tg : v);
  const names = useMemo(() => { const m = new Map(); for (const o of skuOptions(data)) { m.set(o.k, o); for (const part of String(o.k).split('/')) if (!m.has(part)) m.set(part, o); } return m; }, [data]);
  const storeBy = useMemo(() => new Map(data.stores.map((s) => [s.id, s])), [data.stores]);
  const rows = useMemo(() => {
    if (!sk) return [];
    return sk.rows.map((r) => {
      const st = storeBy.get(r.id);
      const o = names.get(r.sku) || r.sku.split('/').map((x) => names.get(x)).find(Boolean);
      const visits = Math.max(1, st?.hk ? visitsInMonth(st.hk, time.y, time.m, []) : 4);
      return { ...r, skuName: o?.n || r.sku, cat: o?.cat || '', storeName: st?.name || r.id, salesJ: st?.sales || r.sales, ch: st && st.cc1 && st.cc1 !== '-' ? st.cc1 : '-', size: st?.size || '-', inJks: !!st, visits };
    });
  }, [sk, storeBy, names, time]);
  const sal = (r) => (src === 'jks' ? r.salesJ : r.sales);
  const opts = (f) => [...new Set(rows.map(f))].filter(Boolean).sort();
  const filt = rows.filter((r) => (fs === 'ALL' || sal(r) === fs) && (fc === 'ALL' || r.ch === fc) && (fz === 'ALL' || r.size === fz) && (fp === 'ALL' || r.prin === fp) && (!qs || `${r.skuName} ${r.sku} ${r.storeName} ${r.id}`.toLowerCase().includes(qs.toLowerCase())));
  const V = met === 'rp' ? ['oc', 'ol', 'o3'] : ['qc', 'ql', 'q3'];
  const grouped = useMemo(() => {
    const kf = { sku: (r) => r.sku, sub: (r) => r.sub || '-', prin: (r) => r.prin || '-', sales: (r) => sal(r) || '-', ch: (r) => r.ch, size: (r) => r.size, outlet: (r) => r.id }[grp];
    const m = new Map();
    for (const r of filt) {
      const k = kf(r);
      const e = m.get(k) || { key: k, name: grp === 'sku' ? r.skuName : grp === 'outlet' ? r.storeName : k, info: grp === 'sku' ? [r.sub, r.cat].filter(Boolean).join(' · ') : grp === 'outlet' ? [sal(r), r.ch, r.size].filter((x) => x && x !== '-').join(' · ') : '', cur: 0, lm: 0, l3: 0, l3k: 0, stores: new Set(), skus: new Set() };
      e.cur += r[V[0]]; e.lm += r[V[1]]; e.l3 += r[V[2]]; e.l3k += r[V[2]] / r.visits; e.stores.add(r.id); e.skus.add(r.sku);
      m.set(k, e);
    }
    const tot = [...m.values()].reduce((a, x) => a + x.cur, 0);
    return [...m.values()].map((e) => ({ ...e, n: e.stores.size, nk: e.skus.size, share: tot ? e.cur / tot : 0 })).sort((a, b) => b.cur - a.cur).map((e, i) => ({ ...e, rank: i + 1 }));
  }, [filt, grp, met, src]); // eslint-disable-line
  if (!sk) return <Panel title="Ranking SKU"><div className="mut">Belum ada data. Upload Omset per SKU dan Qty per SKU (export dengan tiga blok: bulan berjalan, L3M, bulan lalu).</div></Panel>;
  const P = met === 'rp' ? sk.periods : sk.qperiods;
  const fv = met === 'rp' ? fm.jt : fm.n;
  const unit = met === 'rp' ? 'jt' : 'ctn';
  const cols = [
    { k: 'rank', label: '#', num: true, get: (r) => r.rank, fmt: (v) => v },
    { k: 'name', label: GROUPS.find((g) => g[0] === grp)[1], get: (r) => r.name },
    { k: 'info', label: 'Keterangan', get: (r) => r.info, hide: grp !== 'sku' && grp !== 'outlet' },
    { k: 'cur', label: `${P.cur || 'Bulan ini'} (${unit})`, num: true, get: (r) => r.cur, fmt: fv, sum: true },
    { k: 'lm', label: `${P.lm || 'Bulan lalu'} (${unit})`, num: true, get: (r) => r.lm, fmt: fv, sum: true },
    { k: 'l3', label: `L3M / bulan (${unit})`, num: true, get: (r) => r.l3, fmt: fv, sum: true },
    { k: 'l3k', label: `L3M / kunjungan (${unit})`, num: true, get: (r) => r.l3k, fmt: met === 'rp' ? (v) => fm.n1(v / 1e6 * 1000) + ' rb' : fm.n1, sum: true, hide: grp !== 'outlet' },
    { k: 'vl3', label: 'vs L3M', num: true, get: (r) => pcg(r.cur, base(r.l3)), fmt: (v) => (v == null ? '-' : (v >= 0 ? '+' : '') + fm.pc(v)), cls: gcls, tot: (rs, v) => pcg(rs.reduce((a, r) => a + v(r, 'cur'), 0), base(rs.reduce((a, r) => a + v(r, 'l3'), 0))) },
    { k: 'vlm', label: 'vs bulan lalu', num: true, get: (r) => pcg(r.cur, base(r.lm)), fmt: (v) => (v == null ? '-' : (v >= 0 ? '+' : '') + fm.pc(v)), cls: gcls, hide: true, tot: (rs, v) => pcg(rs.reduce((a, r) => a + v(r, 'cur'), 0), base(rs.reduce((a, r) => a + v(r, 'lm'), 0))) },
    { k: 'n', label: 'Toko', num: true, get: (r) => r.n, fmt: fm.n },
    { k: 'nk', label: 'SKU', num: true, get: (r) => r.nk, fmt: fm.n, hide: grp === 'sku' },
    { k: 'share', label: 'Share', num: true, get: (r) => r.share, fmt: fm.pc, tot: () => 1 },
  ];
  const nOut = new Set(filt.filter((r) => !r.inJks).map((r) => r.id)).size;
  const nCode = new Set(filt.filter((r) => r.skuName === r.sku).map((r) => r.sku)).size;
  return (
    <>
      <Panel title={`RANKING SKU · ${P.cur || ''}`} right={`${grouped.length} ${GROUPS.find((g) => g[0] === grp)[1].toLowerCase()}`}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="mut">Lihat per</span><div className="seg">{GROUPS.map(([v, l]) => <button key={v} className={grp === v ? 'on' : ''} onClick={() => setGrp(v)}>{l}</button>)}</div>
          <span className="mut">Pembanding</span><div className="seg">{[['pace', 'Timegone sama'], ['full', 'Sebulan penuh']].map(([v, l]) => <button key={v} className={cmp === v ? 'on' : ''} onClick={() => setCmp(v)}>{l}</button>)}</div>
          <span className="mut">Angka</span><div className="seg">{[['rp', 'Rp'], ['qty', 'Qty (ctn)']].map(([v, l]) => <button key={v} className={met === v ? 'on' : ''} onClick={() => setMet(v)}>{l}</button>)}</div>
        </div>
        <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={fs} onChange={(e) => setFs(e.target.value)}><option value="ALL">Semua salesman</option>{opts(sal).map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input" value={fc} onChange={(e) => setFc(e.target.value)}><option value="ALL">Semua channel</option>{opts((r) => r.ch).map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input" value={fz} onChange={(e) => setFz(e.target.value)}><option value="ALL">Semua ukuran</option>{opts((r) => r.size).map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input" value={fp} onChange={(e) => setFp(e.target.value)}><option value="ALL">Semua principal</option>{opts((r) => r.prin).map((s) => <option key={s}>{s}</option>)}</select>
          <input className="input" placeholder="cari SKU atau outlet…" value={qs} onChange={(e) => setQs(e.target.value)} style={{ width: 170, minWidth: 0 }} />
          <span className="mut">Salesman menurut</span><div className="seg">{[['jks', 'JKS (sekarang)'], ['file', 'Isi file']].map(([v, l]) => <button key={v} className={src === v ? 'on' : ''} onClick={() => setSrc(v)}>{l}</button>)}</div>
        </div>
        {cmp === 'pace' && tg < 1 && <div className="mut" style={{ fontSize: 12, marginTop: 6 }}>vs L3M dan vs bulan lalu dibandingkan pada timegone yang sama ({Math.round(tg * 100)}% bulan berjalan), supaya tidak membandingkan sebagian bulan dengan bulan penuh.</div>}
        {nCode > 0 && <div className="mut" style={{ fontSize: 12, marginTop: 6 }}>{nCode} kode SKU belum ada di Database SKU, jadi tampil sebagai kode.</div>}
        {nOut > 0 && <div className="mut" style={{ fontSize: 12, marginTop: 6 }}>{nOut} outlet di file tidak ada di JKS (channel dan ukuran tampil “-”).</div>}
      </Panel>
      <Panel title="Ranking">
        <GTable key={grp + met + cmp} id={`sku-${grp}-${met}`} cols={cols} rows={grouped} rowKey={(r) => r.key} topN={25} sub={`urut menurut ${P.cur || 'bulan ini'}; klik judul kolom untuk urut lain`} />
      </Panel>
    </>
  );
}
