import { useMemo, useState } from 'react';
import { Panel } from '../components/ui.jsx';
import GTable, { fm } from '../components/GTable.jsx';
import { matchName } from '../lib/market.js';

const pc = (a, b) => (b ? a / b : null);
const tone = (v) => (v == null ? '' : v >= 1 ? 'ok' : v >= 0.8 ? 'warn' : 'neg');
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function Line({ days, series, w = 760, h = 230 }) {
  const all = series.flatMap((s) => s.v).filter((x) => x != null);
  const max = Math.max(1, ...all) * 1.1, L = 34, B = 24, T = 10, R = 10;
  const x = (i) => L + (i * (w - L - R)) / Math.max(1, days.length - 1);
  const y = (v) => T + (h - T - B) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="grafik harian">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={w - R} y1={y(max * t)} y2={y(max * t)} stroke="var(--line)" /><text x={L - 5} y={y(max * t) + 3} fontSize="10" textAnchor="end" fill="var(--mute)">{Math.round(max * t)}</text></g>)}
      {days.map((d, i) => (i % 2 === 0 ? <text key={d} x={x(i)} y={h - 8} fontSize="10" textAnchor="middle" fill="var(--mute)">{d}</text> : null))}
      {series.map((s) => (s.dash
        ? <line key={s.name} x1={L} x2={w - R} y1={y(s.v[0])} y2={y(s.v[0])} stroke={s.color} strokeWidth="1.5" strokeDasharray="5 4" />
        : <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" points={s.v.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ')} />))}
      {series.filter((s) => !s.dash).map((s) => s.v.map((v, i) => (v == null ? null : <circle key={s.name + i} cx={x(i)} cy={y(v)} r="2.4" fill={s.color} />)))}
    </svg>
  );
}

export default function Market({ data, pv }) {
  const m = pv?.market;
  const [tab, setTab] = useState('sum');
  const [allSales, setAllSales] = useState(false);
  const team = data.salesmen || [];
  const [fs, setFs] = useState('ALL'), [fch, setFch] = useState('ALL'), [onlyT, setOnlyT] = useState(false);
  const [dsal, setDsal] = useState('');
  const nameList = useMemo(() => [...new Set([...team, ...(m?.salesman || []).map((x) => x.name)])], [team, m]);
  const rows = useMemo(() => {
    if (!m) return [];
    const mn = (n) => matchName(n, team.length ? team : nameList);
    return m.salesman.map((x) => {
      const name = mn(x.name);
      const g = m.gs.sales.find((z) => mn(z.name) === name);
      const ms = m.mss.sales.find((z) => mn(z.name) === name);
      const pi = m.picos.find((z) => mn(z.name) === name);
      return { name, inTeam: team.some((t) => t === name), ecT: x.ecT, ecA: x.ecA, acT: x.acT, acA: x.acA, gs: g?.gs ?? 0, ma: ms?.act ?? 0, mt: ms?.tgt ?? 0, pi: pi?.avg ?? null };
    });
  }, [m, nameList, team]);
  const shownRows = rows.filter((r) => allSales || r.inTeam);
  const stores = useMemo(() => {
    if (!m) return [];
    const gs = new Map(m.gs.stores.map((x) => [x.id, x.gs]));
    const ms = new Map(m.mss.stores.map((x) => [x.id, x]));
    return data.stores.filter((s) => gs.has(s.id) || ms.has(s.id)).map((s) => ({ id: s.id, name: s.name, sales: s.sales, ch: s.cc1 && s.cc1 !== '-' ? s.cc1 : '-', size: s.size || '-', gs: gs.get(s.id) ?? 0, ma: ms.get(s.id)?.act ?? 0, mt: ms.get(s.id)?.tgt ?? 0 }));
  }, [m, data.stores]);
  const chans = useMemo(() => [...new Set(stores.map((s) => s.ch))].sort(), [stores]);
  const stFilt = stores.filter((s) => (fs === 'ALL' || s.sales === fs) && (fch === 'ALL' || s.ch === fch) && (!onlyT || s.mt > 0));
  if (!m) return <Panel title="Market Productivity"><div className="mut">Belum ada file Market Productivity. Upload Excel yang berisi sheet MP-Salesman, OLAP EC dan AC, dan OLAP Greenstore.</div></Panel>;
  const k = shownRows;
  const ecP = pc(avg(k.map((r) => r.ecA)), avg(k.map((r) => r.ecT))), acP = pc(avg(k.map((r) => r.acA)), avg(k.map((r) => r.acT)));
  const gsT = k.reduce((a, r) => a + r.gs, 0), maT = k.reduce((a, r) => a + r.ma, 0), mtT = k.reduce((a, r) => a + r.mt, 0);
  const piA = avg(k.filter((r) => r.pi != null).map((r) => r.pi));
  const kpi = [['Effective Call', fm.pc(ecP), `${fm.n1(avg(k.map((r) => r.ecA)))} dari ${fm.n1(avg(k.map((r) => r.ecT)))} per hari`, tone(ecP)], ['Actual Call', fm.pc(acP), `${fm.n1(avg(k.map((r) => r.acA)))} dari ${fm.n1(avg(k.map((r) => r.acT)))} per hari`, tone(acP)], ['GreenStore', fm.n(gsT), 'toko GreenStore', ''], ['MSS', fm.pc(pc(maT, mtT)), `${fm.n(maT)} dari ${fm.n(mtT)}`, tone(pc(maT, mtT))], ['PICOS (display)', fm.n1(piA) + '%', 'rata-rata compliance', '']];
  const dl = (nm, blk) => blk?.rows.find((r) => matchName(r.name, team.length ? team : nameList) === nm);
  const dsel = dsal || (shownRows[0]?.name ?? '');
  const sm = rows.find((r) => r.name === dsel);
  const ecr = dl(dsel, m.ecDaily), acr = dl(dsel, m.acDaily);
  const days = (m.ecDaily || m.acDaily)?.days || [];
  const colsSum = [
    { k: 'name', label: 'Salesman', get: (r) => r.name },
    { k: 'ecT', label: 'EC TGT', num: true, get: (r) => r.ecT, fmt: fm.n1, tot: (rs, v) => avg(rs.map((r) => v(r, 'ecT'))) },
    { k: 'ecA', label: 'EC ACT', num: true, get: (r) => r.ecA, fmt: fm.n1, tot: (rs, v) => avg(rs.map((r) => v(r, 'ecA'))) },
    { k: 'ecP', label: 'EC %', num: true, get: (r) => pc(r.ecA, r.ecT), fmt: fm.pc, cls: tone, tot: (rs, v) => pc(avg(rs.map((r) => v(r, 'ecA'))), avg(rs.map((r) => v(r, 'ecT')))) },
    { k: 'acT', label: 'AC TGT', num: true, get: (r) => r.acT, fmt: fm.n1, tot: (rs, v) => avg(rs.map((r) => v(r, 'acT'))) },
    { k: 'acA', label: 'AC ACT', num: true, get: (r) => r.acA, fmt: fm.n1, tot: (rs, v) => avg(rs.map((r) => v(r, 'acA'))) },
    { k: 'acP', label: 'AC %', num: true, get: (r) => pc(r.acA, r.acT), fmt: fm.pc, cls: tone, tot: (rs, v) => pc(avg(rs.map((r) => v(r, 'acA'))), avg(rs.map((r) => v(r, 'acT')))) },
    { k: 'gs', label: 'GreenStore', num: true, get: (r) => r.gs, fmt: fm.n, sum: true },
    { k: 'ma', label: 'MSS Act', num: true, get: (r) => r.ma, fmt: fm.n, sum: true },
    { k: 'mt', label: 'MSS Tgt', num: true, get: (r) => r.mt, fmt: fm.n, sum: true },
    { k: 'mp', label: 'MSS %', num: true, get: (r) => pc(r.ma, r.mt), fmt: fm.pc, cls: tone, tot: (rs, v) => pc(rs.reduce((a, r) => a + v(r, 'ma'), 0), rs.reduce((a, r) => a + v(r, 'mt'), 0)) },
    { k: 'pi', label: 'PICOS %', num: true, get: (r) => r.pi ?? 0, fmt: fm.n1, tot: (rs, v) => avg(rs.map((r) => v(r, 'pi'))) },
  ];
  const colsSt = [
    { k: 'sales', label: 'Salesman', get: (r) => r.sales }, { k: 'id', label: 'ID', get: (r) => r.id, hide: true }, { k: 'name', label: 'Toko', get: (r) => r.name },
    { k: 'ch', label: 'Channel', get: (r) => r.ch }, { k: 'size', label: 'Ukuran', get: (r) => r.size, hide: true },
    { k: 'gs', label: 'GreenStore', num: true, get: (r) => r.gs, fmt: fm.n, sum: true },
    { k: 'ma', label: 'MSS Act', num: true, get: (r) => r.ma, fmt: fm.n, sum: true }, { k: 'mt', label: 'MSS Tgt', num: true, get: (r) => r.mt, fmt: fm.n, sum: true },
    { k: 'mp', label: 'MSS %', num: true, get: (r) => pc(r.ma, r.mt), fmt: fm.pc, cls: tone, tot: (rs, v) => pc(rs.reduce((a, r) => a + v(r, 'ma'), 0), rs.reduce((a, r) => a + v(r, 'mt'), 0)) },
    { k: 'gap', label: 'Gap MSS', num: true, get: (r) => r.mt - r.ma, fmt: fm.n, sum: true },
  ];
  return (
    <>
      <Panel title={`MARKET PRODUCTIVITY · ${m.period || ''}`} right={`${k.length} salesman`}>
        {m.warnings.map((w) => <div key={w} className="warnbar">{w}</div>)}
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {kpi.map(([l, v, s, t]) => <div key={l} className={'kpi ' + (t || '')}><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
        </div>
        <div className="row" style={{ margin: '10px 0 2px' }}>
          <div className="seg">{[['sum', 'Ringkasan salesman'], ['day', 'EC & AC harian'], ['store', 'GreenStore & MSS per toko']].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
          {tab === 'sum' && <label className="mut" style={{ fontWeight: 600 }}><input type="checkbox" checked={allSales} onChange={(e) => setAllSales(e.target.checked)} /> tampilkan semua salesman di file</label>}
        </div>
      </Panel>
      {tab === 'sum' && <Panel title="Per salesman"><GTable id="mp-sum" cols={colsSum} rows={shownRows} rowKey={(r) => r.name} sub="EC dan AC dalam rata-rata kunjungan per hari" /></Panel>}
      {tab === 'day' && (
        <Panel title="EC & AC per hari" right={<select className="input" value={dsel} onChange={(e) => setDsal(e.target.value)}>{rows.map((r) => <option key={r.name}>{r.name}</option>)}</select>}>
          {!ecr && !acr ? <div className="mut">Data harian untuk salesman ini tidak ada di file.</div> : (
            <>
              <div className="row mut" style={{ gap: 14, fontSize: 12 }}><span><i className="dot" style={{ background: 'var(--ac-d)' }} /> Effective Call</span><span><i className="dot" style={{ background: '#2a9d8f' }} /> Actual Call</span><span>garis putus-putus = target per hari</span></div>
              <Line days={days} series={[...(ecr ? [{ name: 'EC', color: 'var(--ac-d)', v: days.map((d) => ecr.v[d] ?? null) }] : []), ...(acr ? [{ name: 'AC', color: '#2a9d8f', v: days.map((d) => acr.v[d] ?? null) }] : []), ...(sm ? [{ name: 'tEC', dash: true, color: 'var(--ac-d)', v: [sm.ecT] }, { name: 'tAC', dash: true, color: '#2a9d8f', v: [sm.acT] }] : [])]} />
              <div className="mut" style={{ fontSize: 12 }}>Hari tanpa kunjungan (Minggu, libur) tidak ada di file. {m.warnings.some((w) => /periode/.test(w)) ? 'Pivot harian bisa masih periode lama; cek peringatan di atas.' : ''}</div>
            </>
          )}
        </Panel>
      )}
      {tab === 'store' && (
        <Panel title="GreenStore & MSS per toko" right={`${stFilt.length} toko`}>
          <div className="row" style={{ marginBottom: 6 }}>
            <select className="input" value={fs} onChange={(e) => setFs(e.target.value)}><option value="ALL">Semua salesman</option>{team.map((s) => <option key={s}>{s}</option>)}</select>
            <select className="input" value={fch} onChange={(e) => setFch(e.target.value)}><option value="ALL">Semua channel</option>{chans.map((s) => <option key={s}>{s}</option>)}</select>
            <label className="mut" style={{ fontWeight: 600 }}><input type="checkbox" checked={onlyT} onChange={(e) => setOnlyT(e.target.checked)} /> hanya toko dengan target MSS</label>
          </div>
          <GTable id="mp-store" cols={colsSt} rows={stFilt} rowKey={(r) => r.id} topN={50} defaultSort={{ k: 'mt', dir: 'desc' }} />
        </Panel>
      )}
    </>
  );
}
