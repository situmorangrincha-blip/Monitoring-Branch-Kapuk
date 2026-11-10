import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../components/ui.jsx';
import ViewPrefs from '../components/ViewPrefs.jsx';
import { Cell } from './Dap.jsx';
import { DEFAULT_SCUP, computeScup, keyLabel, mergeHist, scupMonthly } from '../lib/scup.js';
import { parseRoute, weekdayName } from '../lib/calc.js';
import { fmtMoney, useUnit } from '../lib/unit.js';
import ScupContractPage from './ItgScupContract.jsx';

const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const qf = (n) => (n == null || !Number.isFinite(n) ? '-' : Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 1 }));
const pf = (v) => (v == null || !Number.isFinite(v) ? '-' : Math.round(v * 100) + '%');
const tone = (v) => (v == null ? '' : v >= 1 ? 'ok' : v >= 0.8 ? 'warn' : 'neg');

// ITG Supercup: target ctn per outlet, actual = penjualan principal GBS, reward bulanan / quartal / big cup
export default function ItgScup({ data, depot, team, onSaveHist, teams = [], loadCatalog }) {
  const unit = useUnit();
  const parsed = data.scup;
  const hist = data.scuphist || null;
  const kc = `sm_scupcfg_${depot}_${team}`, ke = `sm_scupedits_${depot}_${team}`, kh = `sm_scuphid_${depot}_${team}`, kv = `sm_scupview_${depot}_${team}`;
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_SCUP, ...(ls(kc, {}) || {}) }));
  const [edits, setEdits] = useState(() => ls(ke, {}));
  const [hid, setHid] = useState(() => ls(kh, {}));
  const [view, setView] = useState(() => ({ orient: 'landscape', grp: { riwayat: false }, sales: 'ALL', day: 'ALL', st: 'ALL', q: '', ...(ls(kv, {}) || {}) }));
  useEffect(() => sv(kc, cfg), [cfg, kc]);
  useEffect(() => sv(ke, edits), [edits, ke]);
  useEffect(() => sv(kh, hid), [hid, kh]);
  useEffect(() => sv(kv, view), [view, kv]);
  const setV = (p) => setView((o) => ({ ...o, ...p }));

  // simpan angka bulanan tiap data berubah (quartal butuh bulan-bulan sebelumnya)
  const ids = useMemo(() => { const s = new Set(data.stores.map((x) => x.id)); return parsed.items.filter((i) => s.has(i.id)).map((i) => i.id); }, [data.stores, parsed]);
  useEffect(() => {
    if (!onSaveHist) return;
    const merged = mergeHist(hist, scupMonthly(data, cfg), ids);
    if (JSON.stringify(merged) !== JSON.stringify(hist || { m: {} })) onSaveHist(merged);
  }, [data, cfg]); // eslint-disable-line

  const C = useMemo(() => computeScup({ parsed, data, cfg, hist, edits }), [parsed, data, cfg, hist, edits]);
  const salesList = useMemo(() => [...new Set(C.rows.map((r) => r.sales))].sort(), [C.rows]);
  const curK = C.curKey;
  const rows = C.rows.filter((r) => !hid[r.id] && (view.sales === 'ALL' || r.sales === view.sales) && (view.day === 'ALL' || parseRoute(r.hk).wd === +view.day) && (!view.q || `${r.name} ${r.id}`.toLowerCase().includes(view.q.toLowerCase())) && (view.st === 'ALL' || (view.st === 'ok' ? r.mo[curK]?.ok : !r.mo[curK]?.ok)));
  const nHid = C.rows.filter((r) => hid[r.id]).length;
  const setE = (id, k, v) => setEdits((o) => { const e = { ...(o[id] || {}) }; if (v === undefined) delete e[k]; else e[k] = v; const n = { ...o }; if (Object.keys(e).length) n[id] = e; else delete n[id]; return n; });
  const money = (v) => (v == null ? '-' : fmtMoney(v, unit));
  const sum = (f) => rows.reduce((a, r) => a + (f(r) || 0), 0);

  const mk = C.qMonths;
  const cm = C.qMonths.includes(curK) ? curK : C.first;
  const tCur = sum((r) => r.mo[cm]?.T), aCur = sum((r) => r.mo[cm]?.A), okCur = rows.filter((r) => r.mo[cm]?.ok).length;
  const tQ = sum((r) => r.TQ), aQ = sum((r) => r.AQ);
  const rM = sum((r) => mk.reduce((a, k) => a + (r.mo[k].reward || 0), 0)), rQ = sum((r) => r.rQ), rB = sum((r) => r.rB), bigOm = sum((r) => r.bigOm);
  const kpi = [
    ['Outlet', `${rows.length}`, `di tim, dari ${C.nFile} di file`], [`Target ${keyLabel(cm)}`, qf(tCur), 'ctn'], [`Actual ${keyLabel(cm)}`, qf(aCur), `ctn · ${pf(tCur ? aCur / tCur : null)}`],
    ['Outlet ≥100% bulan ini', `${okCur}`, `dari ${rows.length}`], ['Reward bulanan', money(rM), unit === 'jt' ? 'jt' : 'Rp'],
    ['Quartal', pf(tQ ? aQ / tQ : null), `${qf(aQ)} dari ${qf(tQ)} ctn`], ['Reward quartal', money(rQ), unit === 'jt' ? 'jt' : 'Rp'], ['Reward big cup', money(rB), `omset big cup ${money(bigOm)}`], ['Total reward', money(sum((r) => r.total)), unit === 'jt' ? 'jt' : 'Rp'],
  ];
  const gShow = view.grp || {};
  const on = (k) => gShow[k] !== false && !(k === 'riwayat' && !gShow.riwayat);
  const num = (v, scale = 1) => (v == null ? '' : v);

  const tab = view.tab === 'kontrak' ? 'kontrak' : 'tabel';
  return (
    <>
      <div className="iv noprint" style={{ marginBottom: 6 }}><div className="ctl" style={{ margin: 0 }}><div className="seg">{[['tabel', 'Tabel'], ['kontrak', 'Kontrak']].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setV({ tab: v })}>{l}</button>)}</div><span className="mut" style={{ fontSize: 12 }}>{tab === 'kontrak' ? 'Kontrak per outlet: program Supercup + tabel program ON faktur dari katalog, dengan template untuk semua outlet.' : 'Tabel semua outlet.'}</span></div></div>
      <style>{`@media print { @page { size: A4 ${view.orient}; margin: 8mm; } }`}</style>
      <Panel title={`ITG SUPERCUP · ${keyLabel(C.qMonths[0])} – ${keyLabel(C.qMonths[2])}`} right={`${C.rows.length} outlet di tim${C.outside ? ` · ${C.outside} outlet di file bukan milik tim ini` : ''}`}>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
          {kpi.map(([l, v, s]) => <div key={l} className="kpi"><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
        </div>
        <div className="note" style={{ marginTop: 8, fontSize: 12 }}>
          Actual = penjualan principal <b>{cfg.principal}</b> (ctn) dari Qty per SKU. Reward bulanan {cfg.r1}% × target bulan jika ≥100%; quartal {cfg.r2}% × target quartal jika ≥100%; big cup {cfg.r3}% × omset {cfg.big.length} SKU big cup. Rupiah = ctn × harga per ctn (omset ÷ qty bulan itu).
          {C.rows.some((r) => C.qMonths.some((k) => r.mo[k].assumed)) && <> Bulan bertanda <b>~</b> tidak ada di file target: dianggap sama dengan {keyLabel(C.first)} (bisa diedit).</>}
        </div>
      </Panel>

      <details className="panel" style={{ padding: '8px 14px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Pengaturan program (principal, SKU big cup, persentase)</summary>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <label className="mut" style={{ fontWeight: 600 }}>Principal actual <input className="input" style={{ width: 90, minWidth: 0 }} value={cfg.principal} onChange={(e) => setCfg((c) => ({ ...c, principal: e.target.value.trim() }))} /></label>
          {[['r1', 'Bulanan %'], ['r2', 'Quartal %'], ['r3', 'Big cup %']].map(([k, l]) => <label key={k} className="mut" style={{ fontWeight: 600 }}>{l} <input className="input" type="number" step="0.05" style={{ width: 72, minWidth: 0 }} value={cfg[k]} onChange={(e) => setCfg((c) => ({ ...c, [k]: +e.target.value || 0 }))} /></label>)}
          <div className="seg" title="Target bulan yang tidak ada di file (mis. Oktober)">{[['first', `Samakan dengan ${keyLabel(C.first)}`], ['zero', 'Kosongkan']].map(([v, l]) => <button key={v} className={cfg.fill === v ? 'on' : ''} onClick={() => setCfg((c) => ({ ...c, fill: v }))}>{l}</button>)}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="mut" style={{ fontSize: 12 }}>Kode SKU big cup (pisahkan dengan koma atau baris baru)</div>
          <textarea className="input" rows={3} style={{ width: '100%', maxWidth: 700 }} value={cfg.big.join(', ')} onChange={(e) => setCfg((c) => ({ ...c, big: e.target.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) }))} />
          <button className="btn sm" onClick={() => setCfg(DEFAULT_SCUP)}>Kembalikan ke bawaan</button>
        </div>
      </details>

      <div className="card noprint" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={view.sales} onChange={(e) => setV({ sales: e.target.value })}><option value="ALL">Semua salesman</option>{salesList.map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input" value={view.day} onChange={(e) => setV({ day: e.target.value })}><option value="ALL">Semua hari JKS</option>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{weekdayName(n)}</option>)}</select>
          <select className="input" value={view.st} onChange={(e) => setV({ st: e.target.value })}><option value="ALL">Semua status</option><option value="ok">≥100% bulan ini</option><option value="no">Belum 100% bulan ini</option></select>
          <input className="input" placeholder="cari toko / ID…" value={view.q} onChange={(e) => setV({ q: e.target.value })} style={{ width: 160, minWidth: 0 }} />
          {[['riwayat', 'Riwayat (L2M)']].map(([k, l]) => <label key={k} className={'tog' + (gShow[k] ? ' on' : '')} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!gShow[k]} onChange={() => setV({ grp: { ...gShow, [k]: !gShow[k] } })} />{l}</label>)}
          <span style={{ flex: 1 }} />
          <ViewPrefs />
          <div className="seg">{[['landscape', 'Landscape'], ['portrait', 'Portrait']].map(([v, l]) => <button key={v} className={view.orient === v ? 'on' : ''} onClick={() => setV({ orient: v })}>{l}</button>)}</div>
          <button className="btn pri" onClick={() => window.print()}>Cetak / Simpan PDF</button>
          {Object.keys(edits).length > 0 && <button className="btn sm" onClick={() => window.confirm('Kembalikan semua angka yang diedit?') && setEdits({})}>Reset {Object.keys(edits).length} edit</button>}
        </div>
        {nHid > 0 && <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>{nHid} outlet disembunyikan <button className="btn sm" onClick={() => setHid({})}>Tampilkan semua</button></div>}
        <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>Klik angka Target, Actual, atau Reward untuk mengubahnya (oranye = diubah, ↺ = kembali). × menyembunyikan outlet.</div>
      </div>

      {tab === 'kontrak' ? <ScupContractPage data={data} parsed={parsed} depot={depot} team={team} cfg={cfg} C={C} rows={rows} unit={unit} setE={setE} teams={teams} loadCatalog={loadCatalog} orient={view.orient} /> : <div className="dpaper">
        <div className="dph"><span>ITG SUPERCUP · {data.meta.teamLabel?.toUpperCase()}</span><span>{keyLabel(C.qMonths[0])} – {keyLabel(C.qMonths[2])} · ctn</span></div>
        <table className="dp">
          <thead>
            <tr><th className="noprint" /><th colSpan={3} className="gh" />{mk.map((k) => <th key={k} colSpan={4} className="gh">{keyLabel(k)}{k === curK ? ' (berjalan)' : ''}</th>)}<th colSpan={4} className="gh">Quartal</th><th colSpan={2} className="gh">Big cup</th><th className="gh" />{on('riwayat') && <th colSpan={2} className="gh">Riwayat</th>}</tr>
            <tr><th className="noprint" /><th className="l">Toko</th><th className="l">Salesman</th><th>Hari</th>
              {mk.map((k) => [<th key={k + 't'}>Target</th>, <th key={k + 'a'}>Actual</th>, <th key={k + 'p'}>%</th>, <th key={k + 'r'}>Reward</th>])}
              <th>Target</th><th>Actual</th><th>%</th><th>Reward</th><th>Omset</th><th>Reward</th><th>Total reward</th>
              {on('riwayat') && <><th>L2M'25</th><th>L2M'26</th></>}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const E = r.ed || {};
              return (
                <tr key={r.id}>
                  <td className="noprint"><button className="rst gt-x" style={{ opacity: 1 }} title="Sembunyikan outlet" onClick={() => setHid((o) => ({ ...o, [r.id]: 1 }))}>×</button></td>
                  <td className="l nm" title={r.id}>{r.name}</td><td className="l">{r.sales}</td><td className="c">{weekdayName(parseRoute(r.hk).wd).slice(0, 3)}</td>
                  {mk.map((k) => { const m = r.mo[k]; return [
                    <Cell key={k + 't'} v={qf(m.T) + (m.assumed && E['T:' + k] == null ? ' ~' : '')} num dec edited={E['T:' + k] != null} onCommit={(v) => setE(r.id, 'T:' + k, v)} onReset={() => setE(r.id, 'T:' + k)} />,
                    <Cell key={k + 'a'} v={m.future ? '-' : m.miss ? 'tdk ada data' : qf(m.A)} num dec edited={E['A:' + k] != null} onCommit={(v) => setE(r.id, 'A:' + k, v)} onReset={() => setE(r.id, 'A:' + k)} />,
                    <td key={k + 'p'} className={tone(m.pct)}>{pf(m.pct)}</td>,
                    <Cell key={k + 'r'} v={m.reward ? money(m.reward) : '-'} num jt={unit === 'jt'} edited={E['R:' + k] != null} onCommit={(v) => setE(r.id, 'R:' + k, v)} onReset={() => setE(r.id, 'R:' + k)} />,
                  ]; })}
                  <td>{qf(r.TQ)}</td><td>{qf(r.AQ)}</td><td className={tone(r.pctQ)}>{pf(r.pctQ)}{!r.qDone && r.pctQ != null ? '*' : ''}</td>
                  <Cell v={r.rQ ? money(r.rQ) : '-'} num jt={unit === 'jt'} edited={E.RQ != null} onCommit={(v) => setE(r.id, 'RQ', v)} onReset={() => setE(r.id, 'RQ')} />
                  <td>{r.bigOm ? money(r.bigOm) : '-'}</td>
                  <Cell v={r.rB ? money(r.rB) : '-'} num jt={unit === 'jt'} edited={E.RB != null} onCommit={(v) => setE(r.id, 'RB', v)} onReset={() => setE(r.id, 'RB')} />
                  <td><b>{r.total ? money(r.total) : '-'}</b></td>
                  {on('riwayat') && <><td>{qf(Object.entries(r.h).filter(([k]) => k.startsWith('2025')).reduce((a, [, v]) => a + v, 0))}</td><td>{qf(['2026-09', '2026-10'].reduce((a, k) => a + (r.h[k] || 0), 0))}</td></>}
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={20} className="mut" style={{ textAlign: 'center', padding: 14 }}>Tidak ada outlet yang cocok. Outlet di file dicocokkan lewat ID toko ke JKS tim ini.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td className="noprint" /><td className="l">Total ({rows.length})</td><td /><td />
              {mk.map((k) => { const t = sum((r) => r.mo[k].T), a = sum((r) => r.mo[k].A); return [<td key={k + 't'}>{qf(t)}</td>, <td key={k + 'a'}>{qf(a)}</td>, <td key={k + 'p'}>{pf(t ? a / t : null)}</td>, <td key={k + 'r'}>{money(sum((r) => r.mo[k].reward))}</td>]; })}
              <td>{qf(tQ)}</td><td>{qf(aQ)}</td><td>{pf(tQ ? aQ / tQ : null)}</td><td>{money(rQ)}</td><td>{money(bigOm)}</td><td>{money(rB)}</td><td>{money(sum((r) => r.total))}</td>
              {on('riwayat') && <><td /><td /></>}</tr></tfoot>
          )}
        </table>
        <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>* quartal belum berakhir: persentase masih progres. Actual bulan yang sudah lewat diambil dari riwayat yang tersimpan tiap upload.</div>
      </div>}
    </>
  );
}
