import { useEffect, useMemo, useState } from 'react';
import { fmt } from '../lib/calc.js';
import { Panel, Seg } from '../components/ui.jsx';
import { PAL, Rings, Steps } from '../components/charts.jsx';
import { autoDapRows } from '../lib/dapAuto.js';
import { DEFAULT_DAP, buildDap } from '../lib/dapModel.js';
import { buildContract } from '../lib/contract.js';
import { itgCompute, topSkus } from '../lib/itg.js';
import { eff, emptyCfg, recommend } from '../lib/contractRec.js';
import { makeCtx, progCodes, programsForStore } from '../lib/progcat.js';
import { defaultDapDate } from './Dap.jsx';

const MONF = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ST = { tercapai: 'tag g', 'gagal syarat': 'tag r', berjalan: 'tag y' };
const jt = (v) => fmt.jt(v, 1);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };

export default function Itg({ data, time, mode, depot, team, holidays, openPreview, onUpload, onSaveCfg }) {
  const C = useMemo(() => itgCompute(data, mode, time), [data, mode, time]);
  const codes = useMemo(() => progCodes(data), [data]);
  const pkey = `sm_itg_${depot}_${team}`;
  const [st, setSt] = useState(() => load(pkey, { progs: null, wajib: '' }));
  const [fs, setFs] = useState('ALL');
  const [fc, setFc] = useState('ALL');
  const [ft, setFt] = useState('ALL');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const [cfg, setCfgL] = useState(() => data.itgcfg || emptyCfg());
  const commit = (next) => { setCfgL(next); onSaveCfg?.(next); };
  const [sel, setSel] = useState(() => new Set());
  const patchMany = (ids, fn) => { const stores = { ...cfg.stores }; for (const id of ids) { const nx = fn({ ...(stores[id] || {}) }); if (Object.keys(nx).length) stores[id] = nx; else delete stores[id]; } commit({ ...cfg, stores }); };
  const patchStore = (id, fn) => patchMany([id], fn);
  const _unused = (id, fn) => { const cur = cfg.stores[id] || {}; const nx = fn({ ...cur }); const stores = { ...cfg.stores }; if (Object.keys(nx).length) stores[id] = nx; else delete stores[id]; commit({ ...cfg, stores }); };
  const setDef = (p) => commit({ ...cfg, defaults: { ...cfg.defaults, ...p } });
  useEffect(() => { localStorage.setItem(pkey, JSON.stringify(st)); }, [st, pkey]);
  const selProgs = st.progs || codes.filter((c) => c.jenis !== 'INSENTIF').map((c) => c.code);
  const ctx = useMemo(() => makeCtx(data), [data]);
  const insOff = useMemo(() => Object.fromEntries(codes.filter((c) => c.jenis === 'INSENTIF').map((c) => ['off:' + c.code, false])), [codes]);
  const cfgEff = useMemo(() => ({ ...cfg, defaults: { ...cfg.defaults, diskon: { ...insOff, ...(cfg.defaults.diskon || {}) } } }), [cfg, insOff]);
  const dlist = useMemo(() => [
    { key: 'off:ITG', label: 'Cashback ITG (OFF faktur)' },
    ...codes.filter((c) => !/^ITG-GG/.test(c.code)).map((c) => ({ key: (c.jenis === 'ON FAKTUR' ? 'on:' : 'off:') + c.code, label: `${c.nama.length > 34 ? c.nama.slice(0, 33) + '…' : c.nama} (${c.jenis === 'ON FAKTUR' ? 'ON' : 'OFF'})` })),
    ...[...new Set((data.progcat?.strata || []).map((r) => r.Program))].filter((p) => /Garuda|Chocolatos|Dilan/i.test(p) && !/range|small|bundling/i.test(p)).map((p) => ({ key: 'strata:' + p, label: p + ' (diskon ON per brand)' })),
  ], [codes, data.progcat]);

  if (!data.itgList) {
    return (
      <Panel title="ITG">
        <div className="empty"><h2>Target ITG belum diupload</h2><p className="mut">Upload Excel ITG (kolom Nama Salesman, ID Pelanggan, Class, Target &lt;bulan&gt; untuk 2 bulan) di menu Upload, slot "Target ITG".</p><button className="btn coin" onClick={onUpload}>Upload target ITG</button></div>
      </Panel>
    );
  }
  const salesOpts = [...new Set(C.rows.map((r) => r.sales))];
  const clsOpts = [...new Set(C.rows.map((r) => r.cls))];
  const rows = C.rows.filter((r) => (fs === 'ALL' || r.sales === fs) && (fc === 'ALL' || r.cls === fc) && (ft === 'ALL' || r.status === ft)).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const env = { time, holidays, m1: C.months[0] };
  const recs = new Map(C.rows.map((r) => [r.id, r.store ? recommend(data, r, env, cfgEff) : null]));
  const T = C.rows.reduce((a, r) => a + r.T, 0), A = C.rows.reduce((a, r) => a + r.A, 0);
  const ok = C.rows.filter((r) => r.status === 'tercapai').length;
  const reward = C.rows.reduce((a, r) => a + r.reward, 0);
  const [m1, m2] = C.months;
  const periode = `${MONF[m1 - 1]} - ${MONF[m2 - 1]} ${time.y}`;
  const miss = C.rows.filter((r) => !r.store).length;

  const contracts = () => rows.filter((r) => r.store).map((r) => buildContract(data, r.store, { eff: eff(cfgEff, r.id), itg: C, rec: recs.get(r.id), wajib: st.wajib.split(',').map((x) => x.trim()).filter(Boolean), periode: `${MONF[time.m - 1]} ${time.y}` }));
  const contractPreview = () => openPreview({ title: `Kontrak ITG · ${rows.length} toko`, file: `Kontrak-ITG-${depot}-${team}`, make: async () => { const { makeContractPdf } = await import('../lib/contractPdf.js'); return makeContractPdf(contracts(), { depot, team: data.meta.teamLabel, periode: `${MONF[time.m - 1]} ${time.y}`, output: 'blob' }); } });
  const contractSave = async () => { setBusy('Menyusun kontrak…'); try { const { makeContractPdf } = await import('../lib/contractPdf.js'); makeContractPdf(contracts(), { depot, team: data.meta.teamLabel, periode: `${MONF[time.m - 1]} ${time.y}` }); } catch (e) { alert(e.message); } setBusy(''); };
  const dapModel = () => { const d = defaultDapDate(time); const ids = new Set(C.rows.map((r) => r.id)); const dd = { ...data, dap: autoDapRows(data, mode).rows.filter((r) => ids.has(r.id)) }; return { dd, d, model: buildDap(dd, time, d, holidays, DEFAULT_DAP) }; };
  const dapPreview = () => openPreview({ title: 'DAP ITG', file: `DAP-ITG-${depot}-${team}`, make: async () => { const { makeDapPdf } = await import('../lib/dapPdf.js'); const { dd, d, model } = dapModel(); return makeDapPdf({ data: dd, model, only: null, y: time.y, m: time.m, d, cfg: DEFAULT_DAP, asOf: time.asOf, depot, output: 'blob' }); } });
  const dapSave = async () => { setBusy('Menyusun DAP…'); try { const { makeDapPdf } = await import('../lib/dapPdf.js'); const { dd, d, model } = dapModel(); await makeDapPdf({ data: dd, model, only: null, y: time.y, m: time.m, d, cfg: DEFAULT_DAP, asOf: time.asOf, depot }); } catch (e) { alert(e.message); } setBusy(''); };
  const togProg = (c) => setSt({ ...st, progs: selProgs.includes(c) ? selProgs.filter((x) => x !== c) : [...selProgs, c] });

  return (
    <div className="grid">
      <Panel title={`ITG ${data.meta.teamLabel?.toUpperCase() || ''} · ${periode.toUpperCase()}`} right={`${C.rows.length} toko · basis ${mode === 'bti' ? 'BTI' : 'Milestone (BTI × 110%)'}`}>
        <Steps steps={[{ label: `${MONF[m1 - 1].slice(0, 3)} ≥ 70%`, text: 'bulan pertama' }, { label: `${MONF[m2 - 1].slice(0, 3)} ≥ 70%`, text: 'bulan kedua' }, { label: 'Total ≥ 100%', text: 'dua bulan' }, { label: 'Cashback', text: '% class × target 2 bulan' }]} />
        <div className="kpis k4" style={{ marginTop: 14 }}>
          <div className="kpi"><div className="l">Toko ITG</div><div className="v">{C.rows.length}</div><div className="s">{ok} tercapai · {C.rows.filter((r) => r.status === 'berjalan').length} berjalan</div></div>
          <div className="kpi"><div className="l">Target 2 bulan</div><div className="v">{jt(T)}<small>jt</small></div><div className="s">actual {jt(A)} jt</div></div>
          <div className="kpi hero"><div className="l">Achievement total</div><div className="v">{T ? fmt.pct(A / T, 0) : '-'}</div><div className="s">gap {jt(Math.max(0, T - A))} jt</div></div>
          <div className="kpi"><div className="l">Potensi cashback</div><div className="v">{jt(reward)}<small>jt</small></div><div className="s">jika semua syarat tercapai</div></div>
        </div>
        {miss > 0 && <div className="warn">{miss} toko di file ITG tidak ada di data utama (ID tidak cocok), actual-nya dihitung 0.</div>}
        {time.m !== m1 && time.m !== m2 && <div className="warn">Periode data ({MONF[time.m - 1]}) di luar periode ITG ({periode}); actual dihitung 0.</div>}
      </Panel>

      <div className="grid g2">
        <Panel title="PERSEN PER CLASS VS TARGET 100%">
          <Rings size={190} items={C.byCls.map((c, i) => ({ label: `${c.cls} (${c.n} toko)`, v: c.T ? c.A / c.T : 0, color: PAL[i % PAL.length] }))} center={T ? fmt.pct(A / T, 0) : '-'} sub="total" />
        </Panel>
        <Panel title="PER SALESMAN" flush>
          <div className="scroll"><table className="t"><thead><tr><th>Salesman</th><th>Toko</th><th>Target</th><th>Actual</th><th>%</th><th>Tercapai</th><th title="Omset toko ITG dibanding total omset salesman">% omset</th></tr></thead>
            <tbody>{C.bySales.map((s) => (<tr key={s.sales}><td className="l">{s.sales}</td><td>{s.n}</td><td>{jt(s.T)}</td><td>{jt(s.A)}</td><td className={s.T && s.A / s.T >= 1 ? 'ok' : 'mid'}>{s.T ? fmt.pct(s.A / s.T, 0) : '-'}</td><td>{s.ok}/{s.n}</td><td>{fmt.pct(s.share, 0)}</td></tr>))}</tbody></table></div>
          <div className="note">"% omset" = omset toko ITG dibanding total omset salesman itu.</div>
        </Panel>
      </div>

      <Panel title="KONTRAK DAN DAP ITG">
        <div className="row">
          <button className="btn" disabled={!rows.length} onClick={contractPreview}>Preview kontrak</button>
          <button className="btn coin" disabled={!rows.length || !!busy} onClick={contractSave}>{busy.startsWith('Menyusun kontrak') ? busy : `Unduh kontrak (${rows.length} toko)`}</button>
          <button className="btn" onClick={dapPreview}>Preview DAP ITG</button>
          <button className="btn" disabled={!!busy} onClick={dapSave}>Unduh DAP ITG</button>
          <span className="mut">Mengikuti filter di tabel bawah.</span>
        </div>
        <div className="opt-row" style={{ marginTop: 10 }}>
          <span className="mut">Kontrak untuk semua toko:</span>
          <span className="mut">basis target / kunjungan</span>
          <div className="seg">{[100, 90, 80, 70].map((v) => <button key={v} className={(cfg.defaults.basis ?? 100) === v ? 'on' : ''} onClick={() => setDef({ basis: v })}>{v}%</button>)}</div>
          <span className="mut">kunjungan / bulan</span>
          <input className="input" type="number" min="1" max="31" style={{ width: 80, minWidth: 0 }} placeholder="dari JKS" defaultValue={cfg.defaults.visits || ''} onBlur={(e) => setDef({ visits: +e.target.value || null })} />
          <button className="btn sm" onClick={() => window.confirm('Kembalikan SEMUA toko ke rekomendasi?') && commit(emptyCfg())}>Kembalikan semua ke rekomendasi</button>
        </div>
        <div className="mut" style={{ fontSize: 12 }}>Rekomendasi: minimal order per kunjungan = target bulan ÷ jumlah kunjungan, dengan komposisi SKU menurut kontribusi toko dan diskon strata ON faktur yang kebuka. Klik baris toko untuk mengubah angkanya; toko yang diubah bertanda "custom" dan tidak ketimpa pengaturan massal.</div>
        <div className="opt-row" style={{ marginTop: 10 }}>
          <span className="mut">Item unggulan wajib order</span>
          <input className="input" style={{ width: 380 }} placeholder="mis. Garuda Rosta 2000, Malkist Keju 1000" value={st.wajib} onChange={(e) => setSt({ ...st, wajib: e.target.value })} />
        </div>
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer' }}>Pengaturan umum kontrak: tabel dan diskon yang tercetak (berlaku untuk semua toko kecuali yang dikustom)</summary>
          <div className="cols-pick" style={{ marginTop: 8 }}>
            {TBL.map(([t, l]) => { const on = cfgEff.defaults.tables?.[t] !== false; return <label key={t} className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={() => setDef({ tables: { ...(cfg.defaults.tables || {}), [t]: !on } })} />{l}</label>; })}
          </div>
          <div className="cols-pick">
            {dlist.map((d) => { const on = cfgEff.defaults.diskon[d.key] !== false; return <label key={d.key} className={on ? 'on' : ''}><input type="checkbox" checked={on} onChange={() => setDef({ diskon: { ...(cfg.defaults.diskon || {}), [d.key]: !on } })} />{d.label}</label>; })}
          </div>
        </details>
        {!codes.length && <div className="mut" style={{ marginTop: 8 }}>Katalog program belum diupload: kontrak hanya berisi baris ITG.</div>}
        {!codes.length && <div className="mut" style={{ marginTop: 8 }}>Katalog program belum diupload: kontrak hanya berisi baris ITG.</div>}
      </Panel>

      <Panel title="TOKO ITG" flush right={<span>{rows.length} toko</span>}>
        <div className="row" style={{ padding: '10px 14px' }}>
          <Seg wrap value={fs} onChange={setFs} options={[{ v: 'ALL', label: 'Semua salesman' }, ...salesOpts.map((s) => ({ v: s, label: s.split(' ')[0] }))]} />
          <Seg value={fc} onChange={setFc} options={[{ v: 'ALL', label: 'Semua class' }, ...clsOpts.map((c) => ({ v: c, label: c }))]} />
          <Seg value={ft} onChange={setFt} options={[{ v: 'ALL', label: 'Semua status' }, { v: 'tercapai', label: 'Tercapai' }, { v: 'berjalan', label: 'Berjalan' }, { v: 'gagal syarat', label: 'Gagal' }]} />
        </div>
        <div className="row" style={{ padding: '0 14px 8px' }}>
          <button className="btn sm" onClick={() => setSel(new Set(rows.filter((r) => r.store).map((r) => r.id)))}>Pilih semua yang tampil ({rows.length})</button>
          {sel.size > 0 && <button className="btn sm" onClick={() => setSel(new Set())}>Kosongkan pilihan</button>}
          <span className="mut">{sel.size} toko dipilih untuk dikustom</span>
        </div>
        {sel.size > 0 && <SelPanel ids={[...sel]} cfg={cfgEff} dlist={dlist} patchMany={patchMany} clear={() => setSel(new Set())} />}
        <div className="scroll"><table className="t">
          <thead><tr><th><input type="checkbox" checked={rows.length > 0 && rows.every((r) => sel.has(r.id))} onChange={(e) => setSel(e.target.checked ? new Set(rows.filter((r) => r.store).map((r) => r.id)) : new Set())} /></th><th>Toko</th><th>Salesman</th><th>Class</th><th>Target {MONF[m1 - 1].slice(0, 3)}</th><th>Target {MONF[m2 - 1].slice(0, 3)}</th><th>Actual {MONF[m1 - 1].slice(0, 3)}</th><th>%</th><th>Actual {MONF[m2 - 1].slice(0, 3)}</th><th>%</th><th>Total %</th><th>Status</th><th>Cashback</th><th title="Minimal order per kunjungan (rekomendasi)">Order / kunj</th></tr></thead>
          <tbody>{rows.map((r) => (
            <>
              <tr key={r.id} className="clickable" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((o) => { const n = new Set(o); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                <td className="l nm">{r.name}</td><td className="l">{r.sales.split(' ')[0]}</td><td>{r.cls}</td><td>{jt(r.t1)}</td><td>{jt(r.t2)}</td><td>{jt(r.a1)}</td>
                <td className={r.pass1 ? 'ok' : 'low'}>{r.p1 == null ? '-' : fmt.pct(r.p1, 0)}</td><td>{jt(r.a2)}</td><td className={r.pass2 ? 'ok' : r.know2 ? 'low' : 'mut'}>{r.p2 == null || !r.know2 ? '-' : fmt.pct(r.p2, 0)}</td>
                <td className={r.total >= 1 ? 'ok' : 'mid'}>{r.total == null ? '-' : fmt.pct(r.total, 0)}</td><td><span className={ST[r.status]}>{r.status}</span></td><td>{jt(r.reward)}</td><td>{recs.get(r.id) ? <>{fmt.jt(recs.get(r.id).perVisit, 2)}{recs.get(r.id).custom && <span className="tag y" style={{ marginLeft: 4 }}>custom</span>}</> : '-'}</td>
              </tr>
              {open === r.id && (
                <tr key={r.id + 'x'}><td colSpan={14} style={{ background: 'var(--paper2)' }}>
                  {recs.get(r.id) && <RecEditor rec={recs.get(r.id)} data={data} patch={(fn) => patchStore(r.id, fn)} />}
                  <div className="grid g2" style={{ padding: 8 }}>
                    <div>
                      <b>Kontribusi SKU terbesar toko ini</b>
                      {topSkus(data, r.id).length ? topSkus(data, r.id).map((x) => <div key={x.i} className="row" style={{ justifyContent: 'space-between' }}><span>{x.sb?.n}</span><span className="mut">{jt(x.v)} jt · {fmt.pct(x.share, 0)}</span></div>) : <div className="mut">Data omset per SKU belum diupload.</div>}
                      {r.fb && <div className="mut" style={{ marginTop: 6 }}>Feedback: {r.fb}</div>}
                    </div>
                    <div>
                      <b>Program yang cocok</b>
                      {r.store && programsForStore(data, r.store, ctx).filter((g) => g.status === 'ya' && !/^ITG-GG/.test(g.code)).slice(0, 6).map((g) => <div key={g.code} className="row" style={{ justifyContent: 'space-between' }}><span>{g.nama}</span><span className={J2[g.jenis] || 'tag'}>{g.jenis}</span></div>)}
                      {!data.progcat && <div className="mut">Katalog program belum diupload.</div>}
                    </div>
                  </div>
                </td></tr>
              )}
            </>
          ))}</tbody>
        </table></div>
        <div className="note">Cashback = % class (Medium 1%, Big 1,5%, Superbig 1,75%) × target 2 bulan. Estimasi: batas maksimal (caps) dan SKU WCG4/Pilus 500 belum dihitung. Klik baris untuk melihat SKU dan program yang cocok.</div>
      </Panel>
    </div>
  );
}
const TBL = [['off', 'Tabel OFF faktur'], ['rec', 'Tabel Rekomendasi order'], ['on', 'Tabel ON faktur']];
const J2 = { 'OFF FAKTUR': 'tag b', 'ON FAKTUR': 'tag g', INSENTIF: 'tag y', VISIBILITY: 'tag', 'BONUS BARANG': 'tag r' };

function RecEditor({ rec, data, patch }) {
  const [add, setAdd] = useState('');
  const subs = useMemo(() => data.subs.map((sb) => ({ k: sb.c || sb.n, n: sb.n })).filter((x) => x.k && !rec.lines.some((l) => l.key === x.k)).slice(0, 400), [data.subs, rec.lines]);
  const num = (e) => +String(e.target.value).replace(',', '.');
  return (
    <div style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 12, background: '#fff', marginBottom: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>Rekomendasi kontrak per kunjungan {rec.custom && <span className="tag y">custom</span>}</b>
        {rec.custom && <button className="btn sm" onClick={() => patch(() => ({}))}>Kembalikan ke rekomendasi</button>}
      </div>
      <div className="opt-row">
        <span className="mut">Target bulan</span><b>{Math.round(rec.monthTarget).toLocaleString('id-ID')}</b>
        <span className="mut">Kunjungan / bulan (JKS {rec.autoVisits || '-'})</span>
        <input className="input" type="number" min="1" style={{ width: 70, minWidth: 0 }} defaultValue={rec.visits} key={'v' + rec.visits} onBlur={(e) => patch((c) => { const v = num(e); if (v > 0 && v !== rec.autoVisits) c.visits = v; else delete c.visits; return c; })} />
        <span className="mut">Basis</span>
        <div className="seg">{[100, 90, 80, 70].map((v) => <button key={v} className={rec.basis === v && !rec.perVisitManual ? 'on' : ''} onClick={() => patch((c) => { c.basis = v; delete c.perVisit; return c; })}>{v}%</button>)}</div>
        <span className="mut">Target / kunjungan</span>
        <input className="input" type="number" style={{ width: 120, minWidth: 0 }} defaultValue={rec.perVisit} key={'p' + rec.perVisit} onBlur={(e) => patch((c) => { const v = num(e); if (v > 0 && v !== rec.perVisit) c.perVisit = v; return c; })} />
        <span className="mut">(100% = {Math.round(rec.perVisit100).toLocaleString('id-ID')} · min 70% = {rec.perVisit70.toLocaleString('id-ID')})</span>
      </div>
      {!rec.hasSku && <div className="warn">Data omset per SKU toko ini belum ada, jadi komposisi order tidak bisa direkomendasikan. Upload Omset per SKU, atau tambahkan SKU manual di bawah.</div>}
      {rec.noPrice.length > 0 && <div className="warn">Harga dus belum ada di Database SKU untuk: {rec.noPrice.slice(0, 4).join(', ')}{rec.noPrice.length > 4 ? '…' : ''}. Nilai order dan potongan SKU itu belum terhitung.</div>}
      <div className="scroll"><table className="t">
        <thead><tr><th className="l">SKU</th><th>Karton</th><th>Harga / dus</th><th>Nilai</th><th>Diskon</th><th>Potongan</th><th /></tr></thead>
        <tbody>
          {rec.lines.map((l) => (
            <tr key={l.key}>
              <td className="l nm">{l.name} <span className="mut">{l.strata ? l.strata.replace('Strata ', '') : ''}</span></td>
              {l.pseudo ? <td colSpan={1} className="mut">-</td> : <td><input className="input" type="number" min="0" style={{ width: 70, minWidth: 0, textAlign: 'right' }} defaultValue={l.cartons ?? ''} key={l.key + l.cartons} onBlur={(e) => patch((c) => { const v = num(e); c.cartons = { ...(c.cartons || {}), [l.key]: v }; if (l.added) c.added = (c.added || []).map((a) => (a.key === l.key ? { ...a, cartons: v } : a)); return c; })} />{l.manual && <span className="tag y" style={{ marginLeft: 3 }}>manual</span>}</td>}
              <td>{l.price ? l.price.toLocaleString('id-ID') : '-'}</td><td>{l.value ? l.value.toLocaleString('id-ID') : '-'}</td><td>{l.pct ? l.pct + '%' : '-'}</td><td>{l.potongan ? l.potongan.toLocaleString('id-ID') : '-'}</td>
 <td>{!l.pseudo && <button className="btn sm" title="Hapus baris" onClick={() => patch((c) => { c.removed = [...new Set([...(c.removed || []), l.key])]; c.added = (c.added || []).filter((a) => a.key !== l.key); return c; })}>×</button>}</td>
            </tr>
          ))}
          <tr className="tot"><td className="l">Total per kunjungan</td><td /><td /><td>{rec.orderValue.toLocaleString('id-ID')}{rec.vsTarget != null && <span className="mut"> ({Math.round(rec.vsTarget * 100)}% target)</span>}</td><td>{rec.orderValue ? (rec.effPct * 100).toFixed(1) + '%' : ''}</td><td>{rec.potonganVisit.toLocaleString('id-ID')}</td><td /></tr>
          <tr className="tot"><td className="l">Total per bulan ({rec.visits}×)</td><td /><td /><td>{(rec.orderValue * rec.visits).toLocaleString('id-ID')}</td><td /><td>{rec.potonganBulan.toLocaleString('id-ID')}</td><td /></tr>
        </tbody>
      </table></div>
      {rec.groups.map((g) => (
        <div key={g.prog} className="row" style={{ fontSize: 12.5 }}>
          <b>{g.prog.replace('Strata ', '')}</b><span className="mut">{g.cartons} karton per kunjungan → diskon</span>
          <input className="input" type="number" step="0.5" style={{ width: 64, minWidth: 0 }} defaultValue={g.pct} key={g.prog + g.pct} onBlur={(e) => patch((c) => { const v = num(e); if (v === g.autoPct) { const p = { ...(c.pct || {}) }; delete p[g.prog]; c.pct = p; } else c.pct = { ...(c.pct || {}), [g.prog]: v }; return c; })} />%
          {g.manualPct && <span className="tag y">manual (rekomendasi {g.autoPct}%)</span>}
          <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={!g.off} onChange={() => patch((c) => { c.diskon = { ...(c.diskon || {}), ['strata:' + g.prog]: g.off }; return c; })} />diskon aktif</label>
          {g.next && <span className="mut">tambah {g.next.need} karton untuk {g.next.pct}%</span>}
        </div>
      ))}
      {rec.extras.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <b style={{ fontSize: 12.5 }}>Program ON faktur lain (1× kelipatan per kunjungan)</b>
          {rec.extras.map((e, i) => <label key={e.code + i} className="row" style={{ fontSize: 12.5 }}><input type="checkbox" checked={!e.off} onChange={() => patch((c) => { c.diskon = { ...(c.diskon || {}), ['on:' + e.code]: e.off }; return c; })} />{e.nama}<span className="mut">min {String(e.min)} {e.satuan} · {e.reward}{e.potongan ? ` · potongan ${e.potongan.toLocaleString('id-ID')}` : ''}</span></label>)}
        </div>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        <select className="input" style={{ minWidth: 0, maxWidth: 260 }} value={add} onChange={(e) => setAdd(e.target.value)}><option value="">+ tambah SKU…</option>{subs.map((x) => <option key={x.k} value={x.k}>{x.n}</option>)}</select>
        <button className="btn sm" disabled={!add} onClick={() => { patch((c) => { c.added = [...(c.added || []), { key: add, cartons: 1 }]; c.removed = (c.removed || []).filter((k) => k !== add); return c; }); setAdd(''); }}>Tambah</button>
      </div>
    </div>
  );
}

function SelPanel({ ids, cfg, dlist, patchMany, clear }) {
  const effs = ids.map((id) => eff(cfg, id));
  const all = (f) => effs.every(f);
  const some = (f) => effs.some(f);
  const num = (e) => +String(e.target.value).replace(',', '.');
  return (
    <div style={{ margin: '0 14px 10px', padding: 10, border: '1px solid var(--ac-line)', borderRadius: 12, background: 'var(--ac-soft)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>Atur kontrak untuk {ids.length} toko terpilih</b>
        <span className="row"><button className="btn sm" onClick={() => window.confirm(`Kembalikan ${ids.length} toko ke pengaturan umum?`) && patchMany(ids, () => ({}))}>Kembalikan ke umum</button><button className="btn sm" onClick={clear}>Tutup</button></span>
      </div>
      <div className="mut" style={{ fontSize: 12 }}>Hanya bagian yang lu ubah di sini yang menimpa pengaturan umum. Centang abu-abu = campuran antar toko terpilih.</div>
      <div className="cols-pick" style={{ marginTop: 6 }}>
        {TBL.map(([t, l]) => { const a = all((e) => e.tables[t]), s2 = some((e) => e.tables[t]); return <label key={t} className={a ? 'on' : s2 ? 'mix' : ''}><input type="checkbox" checked={a} ref={(el) => { if (el) el.indeterminate = !a && s2; }} onChange={() => patchMany(ids, (c) => { c.tables = { ...(c.tables || {}), [t]: !a }; return c; })} />{l}</label>; })}
      </div>
      <div className="cols-pick">
        {dlist.map((d) => { const a = all((e) => e.dis(d.key)), s2 = some((e) => e.dis(d.key)); return <label key={d.key} className={a ? 'on' : s2 ? 'mix' : ''}><input type="checkbox" checked={a} ref={(el) => { if (el) el.indeterminate = !a && s2; }} onChange={() => patchMany(ids, (c) => { c.diskon = { ...(c.diskon || {}), [d.key]: !a }; return c; })} />{d.label}</label>; })}
      </div>
      <div className="opt-row">
        <span className="mut">Basis target / kunjungan</span>
        <div className="seg">{[100, 90, 80, 70].map((v) => <button key={v} onClick={() => patchMany(ids, (c) => { c.basis = v; delete c.perVisit; return c; })}>{v}%</button>)}</div>
        <span className="mut">Kunjungan / bulan</span>
        <input className="input" type="number" min="1" style={{ width: 80, minWidth: 0 }} placeholder="JKS" onBlur={(e) => { const v = num(e); if (v > 0) patchMany(ids, (c) => { c.visits = v; return c; }); e.target.value = ''; }} />
      </div>
    </div>
  );
}
