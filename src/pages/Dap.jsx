import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, weekdayName } from '../lib/calc.js';
import { COLS, DEFAULT_DAP, colFor, promoCols, buildDap, catOptions, progNames, skuOptions, skusOfCat } from '../lib/dapModel.js';
import { Panel } from '../components/ui.jsx';
import { autoDapRows } from '../lib/dapAuto.js';
import { catOf, ctargetIndex, nk } from '../lib/ctarget.js';
import FocusPicker from '../components/FocusPicker.jsx';
import { setWeekOffset } from '../lib/calc.js';
import { fmtMoney, useUnit } from '../lib/unit.js';

const pad = (n) => String(n).padStart(2, '0');
const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const IND = [['tgt', 'Target'], ['act', 'Actual Rp'], ['qty', 'Qty'], ['gap', 'Gap'], ['ach', '% Ach'], ['ca', 'Sudah beli?']];
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

export function defaultDapDate(time, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = f.format(now).split('-').map(Number);
  let day = y === time.y && m === time.m ? d : 1;
  const last = new Date(time.y, time.m, 0).getDate();
  if (new Date(time.y, time.m - 1, day).getDay() === 0 && day < last) day += 1; // hari Minggu tidak ada kunjungan: mulai dari Senin
  return day;
}

// sel DAP yang bisa diklik dan diketik (oranye = diubah, ↺ = kembali ke suggest)
function Cell({ v, edited, num, jt, onCommit, onReset, cls, title }) {
  const [on, setOn] = useState(false);
  const commit = (raw) => { setOn(false); const t = String(raw).trim(); if (num) { const n = jt ? parseFloat(t.replace(',', '.')) * 1e6 : parseFloat(t.replace(/\./g, '').replace(',', '.')); if (Number.isFinite(n)) onCommit(Math.round(n)); } else onCommit(t); };
  if (on) return <td className={cls}><input className="dcell-in" autoFocus defaultValue={num ? (jt ? String(v) : String(v).replace(/[^\d-]/g, '')) : v} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setOn(false); }} /></td>;
  return <td className={cls} title={title}><span className={'dcell' + (edited ? ' chg' : '')} onClick={() => setOn(true)}>{v === '' ? '\u00a0\u00a0\u00a0' : v}</span>{edited && <button className="rst" title="Kembalikan ke suggest" onClick={onReset}>↺</button>}</td>;
}

export default function Dap({ data: data0, mode = 'milestone', time, day, setDay, holidays, setHolidays, depot, team, openPreview, previewOpen = false, editor = false, onEditor }) {
  const unit = useUnit();
  const ckey = `sm_dap_${depot}_${team}`;
  const hasSheet = !!data0.dap?.length && !data0.meta?.dapAuto;
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_DAP, ...(load(ckey) || {}), par: { ...DEFAULT_DAP.par, ...(load(ckey)?.par || {}) } }));
  const [busy, setBusy] = useState('');
  const [holTxt, setHolTxt] = useState(holidays.join(', '));
  const [skuQ, setSkuQ] = useState('');
  const [skuQ2, setSkuQ2] = useState('');
  const [openCards, setOpenCards] = useState(null);
  useEffect(() => { localStorage.setItem(ckey, JSON.stringify(cfg)); }, [cfg, ckey]);
  const setPar = (p) => setCfg((c) => ({ ...c, par: { ...c.par, ...p } }));

  const last = new Date(time.y, time.m, 0).getDate();
  const d = Math.min(Math.max(1, day), last);
  const dateKey = `${time.y}-${String(time.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const setEdit = (id, fn) => setCfg((c) => { const ed = { ...(c.edits || {}) }; const dd = { ...(ed[dateKey] || {}) }; const nx = fn({ ...(dd[id] || {}) }); if (Object.keys(nx).length) dd[id] = nx; else delete dd[id]; if (Object.keys(dd).length) ed[dateKey] = dd; else delete ed[dateKey]; return { ...c, edits: ed }; });
  const nEditDay = Object.keys(cfg.edits?.[dateKey] || {}).length;
  const wd = new Date(time.y, time.m - 1, d).getDay();
  const iso = `${time.y}-${pad(time.m)}-${pad(d)}`;
  const useAuto = !hasSheet || cfg.src !== 'sheet';
  const auto = useMemo(() => (useAuto ? autoDapRows(data0, mode) : null), [useAuto, data0, mode]);
  const data = useMemo(() => (auto ? { ...data0, dap: auto.rows } : data0), [auto, data0]);
  const wkAuto = Math.ceil(d / 7);
  const wkOff = cfg.week === '13' ? (wkAuto % 2 === 0 ? 1 : 0) : cfg.week === '24' ? (wkAuto % 2 === 1 ? 1 : 0) : 0;
  const model = useMemo(() => { setWeekOffset(wkOff); try { return buildDap(data, time, d, holidays, { ...cfg, mode, unit }); } finally { setWeekOffset(0); } }, [data, time, d, holidays, cfg, mode, wkOff, unit]);
  // preview PDF yang sedang terbuka ikut diperbarui saat isi DAP berubah (angka, tanggal, pekan, satuan); pemicunya tanda isi, bukan objek model
  const sig = useMemo(() => JSON.stringify([cfg, d, wkOff, unit, mode, time.m]), [cfg, d, wkOff, unit, mode, time.m]);
  const lastSig = useRef(null);
  useEffect(() => {
    if (!previewOpen || !openPreview || !model.total) { if (!previewOpen) lastSig.current = null; return undefined; }
    if (sig === lastSig.current) return undefined;
    const t = setTimeout(() => { lastSig.current = sig; openPreview(buildPv()); }, 700);
    return () => clearTimeout(t);
  }, [sig, previewOpen]); // eslint-disable-line
  const stale = d > (time.dataDay || 0) + 1;
  const tot = model.groups.reduce((a, g) => ({ t: a.t + g.target, a: a.a + g.actual, p: a.p + g.plan, c: a.c + (g.pareto?.rows.length || 0) }), { t: 0, a: 0, p: 0, c: 0 });

  const skus = useMemo(() => skuOptions(data), [data]);
  const cats = useMemo(() => catOptions(data), [data]);
  const filt = (arr, q) => arr.filter((x) => !q || `${x.n} ${x.k} ${x.b}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80);

  const move = (delta) => {
    let n = d;
    for (let i = 0; i < 40; i++) { n += delta; if (n < 1 || n > last) return; if (new Date(time.y, time.m - 1, n).getDay() !== 0) { setDay(n); return; } }
  };
  const saveHol = () => {
    const arr = [...new Set(holTxt.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= last))].sort((a, b) => a - b);
    setHolidays(arr); setHolTxt(arr.join(', '));
  };

  const colMove = (k, dir) => setCfg((c) => {
    const a = [...c.cols]; const i = a.indexOf(k); const j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return c;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...c, cols: a };
  });
  const toggleCol = (k) => setCfg((c) => ({ ...c, cols: c.cols.includes(k) ? c.cols.filter((x) => x !== k) : [...c.cols, k] }));
  const skuPicks = cfg.skuPicks || cfg.skuMain.map((k) => ({ kind: 'sku', key: k }));
  const skuOfPrin = useMemo(() => { const m = new Map(); for (const sb of data.subs) { const k = sb.c || sb.n; if (sb.p && sb.p !== '-') { if (!m.has(sb.p)) m.set(sb.p, []); m.get(sb.p).push(k); } } return m; }, [data.subs]);
  const toggleSkuPick = (kind, key) => setCfg((c) => {
    const cur = c.skuPicks || c.skuMain.map((k) => ({ kind: 'sku', key: k }));
    const next = cur.some((p) => p.kind === kind && p.key === key) ? cur.filter((p) => !(p.kind === kind && p.key === key)) : [...cur, { kind, key }];
    const keys = new Set();
    for (const p of next) { if (p.kind === 'sku') keys.add(p.key); else if (p.kind === 'kat') skusOfCat(data, p.key).forEach((x) => keys.add(x.k)); else (skuOfPrin.get(p.key) || []).forEach((k) => keys.add(k)); }
    return { ...c, skuPicks: next, skuMain: [...keys] };
  });
  const toggleSkuMain = (k) => setCfg((c) => ({ ...c, skuMain: c.skuMain.includes(k) ? c.skuMain.filter((x) => x !== k) : [...c.skuMain, k] }));
  const toggleFocus = (t, k) => setPar({ focus: cfg.par.focus.some((f) => f.t === t && f.k === k) ? cfg.par.focus.filter((f) => !(f.t === t && f.k === k)) : [...cfg.par.focus, { t, k }] });

  const addCatMain = (cat) => setCfg((c) => ({ ...c, skuMain: [...new Set([...c.skuMain, ...skusOfCat(data, cat).map((x) => x.k)])] }));
  const addCatFocus = (cat) => setPar({ focus: [...cfg.par.focus.filter((f) => !(f.t === 'sku' && skusOfCat(data, cat).some((x) => x.k === f.k))), ...skusOfCat(data, cat).map((x) => ({ t: 'sku', k: x.k, g: cat }))] });
  const pnames = useMemo(() => progNames(data), [data]);
  const togP = (p) => setCfg((c) => ({ ...c, progpick: (c.progpick || []).includes(p) ? c.progpick.filter((x) => x !== p) : [...(c.progpick || []), p] }));
  const togPM = (m) => setCfg((c) => ({ ...c, pmetrics: (c.pmetrics || ['t', 'a', 'p']).includes(m) ? c.pmetrics.filter((x) => x !== m) : [...(c.pmetrics || ['t', 'a', 'p']), m] }));
  const ci = useMemo(() => ctargetIndex(data, mode), [data, mode]);
  const prins = useMemo(() => [...new Set(data.subs.map((sb) => sb.p).filter((p) => p && p !== '-'))].sort(), [data.subs]);
  const kcat = useMemo(() => [...new Set(data.subs.map(catOf).filter(Boolean))].sort(), [data.subs]);
  const togK = (kind, key) => setCfg((c) => ({ ...c, kpick: (c.kpick || []).some((p) => p.kind === kind && p.key === key) ? c.kpick.filter((p) => !(p.kind === kind && p.key === key)) : [...(c.kpick || []), { kind, key }] }));
  const togKC = (m) => setCfg((c) => ({ ...c, kcols: (c.kcols || ['act', 'tgt', 'ach']).includes(m) ? c.kcols.filter((x) => x !== m) : [...(c.kcols || ['act', 'tgt', 'ach']), m] }));
  const nCols = model.head.length;
  async function pdf(only) {
    setBusy('Menyusun PDF...');
    try {
      const { makeDapPdf } = await import('../lib/dapPdf.js');
      await makeDapPdf({ data, model, only, y: time.y, m: time.m, d, cfg, asOf: time.asOf, depot });
    } catch (e) { alert('Gagal membuat PDF: ' + (e?.message || e)); }
    setBusy('');
  }

  if (!data.dap?.length) {
    return (
      <Panel title="DAP (DAILY ACCOUNT PLAN)">
        <div className="empty">
          <h2>Belum ada data DAP</h2>
          <p className="mut">Tidak ada sheet DAP dan tidak ada toko dengan target + hari kunjungan di data utama. Tambahkan sheet berjudul DAP … (kolom: Salesman, Hari/Rute, ID Pelanggan, Nama, Target) lalu upload ulang.</p>
        </div>
      </Panel>
    );
  }


  function buildPv() {
    return { kind: 'dap', title: `DAP ${data0.meta.teamLabel || ''} · ${d} ${MON[time.m - 1]}`, file: `DAP-${depot}-${team}-${time.y}-${pad(time.m)}-${pad(d)}`, make: async () => { const { makeDapPdf } = await import('../lib/dapPdf.js'); return makeDapPdf({ data, model, only: null, y: time.y, m: time.m, d, cfg, asOf: time.asOf, depot, output: 'blob' }); } };
  }

  return (
    <div className="grid">
      <Panel title={`DAP ${data.meta.teamLabel?.toUpperCase() || ''} · ${weekdayName(wd).toUpperCase()} ${d} ${MON[time.m - 1].toUpperCase()} ${time.y}`} right={`${model.total} toko · ${model.groups.length} salesman`}>
        <div className="row">
          <button className="btn sm" onClick={() => move(-1)} aria-label="Hari sebelumnya">◀</button>
          <input className="input" style={{ minWidth: 0, width: 160 }} type="date" value={iso} min={`${time.y}-${pad(time.m)}-01`} max={`${time.y}-${pad(time.m)}-${pad(last)}`} onChange={(e) => { const v = e.target.value; if (v) setDay(parseInt(v.slice(8, 10), 10)); }} />
          <button className="btn sm" onClick={() => move(1)} aria-label="Hari berikutnya">▶</button>
          <span className="mut">{weekdayName(wd)}</span>
          <span style={{ flex: 1 }} />
          {openPreview && !editor && <button className="btn" disabled={!model.total} onClick={() => { lastSig.current = sig; openPreview(buildPv()); }}>Preview</button>}
          {editor ? <button className="btn" onClick={() => onEditor && onEditor()}>← DAP biasa</button> : <button className="btn" onClick={() => onEditor && onEditor()} title="Halaman layar penuh untuk mengedit DAP">Buka Editor DAP</button>}
          <button className="btn coin" disabled={!model.total || !!busy} onClick={() => pdf(null)}>{busy || 'Unduh PDF (semua salesman)'}</button>
        </div>
        {wd === 0 && <div className="warn">Hari Minggu tidak ada kunjungan.</div>}
        {stale && <div className="warn">Actual s/d {time.asOf} (data H-1). Kunjungan antara tanggal itu dan {d} belum terhitung.</div>}
        <div className="kpis k4" style={{ marginTop: 10 }}>
          <div className="kpi"><div className="l">Toko dikunjungi</div><div className="v">{model.total}</div><div className="s">{model.groups.length} salesman</div></div>
          <div className="kpi"><div className="l">Target DAP</div><div className="v">{fmt.jt(tot.t)}<small>jt</small></div><div className="s">toko hari ini</div></div>
          <div className="kpi"><div className="l">Actual MTD</div><div className="v">{fmt.jt(tot.a)}<small>jt</small></div><div className="s">gap {fmt.jt(tot.a - tot.t)} jt</div></div>
          <div className="kpi hero"><div className="l">PLAN hari ini</div><div className="v">{fmt.jt(tot.p)}<small>jt</small></div><div className="s">{cfg.par.on ? `${tot.c} toko di halaman Top toko` : 'minimal target kunjungan'}</div></div>
        </div>
        <div className="row" style={{ margin: '6px 0' }}>
          <span className="mut">Pekan (JKS)</span>
          <div className="seg">{[['auto', `Otomatis (minggu ke-${wkAuto})`], ['13', 'Pekan 1&3'], ['24', 'Pekan 2&4']].map(([v, l]) => <button key={v} className={(cfg.week || 'auto') === v ? 'on' : ''} onClick={() => setCfg((c) => ({ ...c, week: v }))}>{l}</button>)}</div>
          <span className="mut" style={{ fontSize: 12 }}>Toko bertanda Minggu 1&3 atau 2&4 di JKS mengikuti pilihan ini; toko mingguan selalu ikut.</span>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer' }}>Tanggal libur (opsional)</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ minWidth: 0, width: 200 }} placeholder="mis. 17, 20" value={holTxt} onChange={(e) => setHolTxt(e.target.value)} />
            <button className="btn sm" onClick={saveHol}>Simpan</button>
          </div>
        </details>
      </Panel>

      {editor ? (
        <>
          <div className="note">Mode editor: klik angka mana saja di tabel untuk mengubahnya (oranye = diubah, ↺ = kembali ke suggest). Perubahan langsung tersimpan dan ikut ke PDF. Satuan Rp / Juta dan ukuran huruf ada di header.</div>
          <details className="panel" style={{ padding: '8px 14px' }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Pengaturan isi DAP (kolom, SKU, minimum order, Top toko)</summary>
      <Panel title="ATUR ISI DAP" right={nCols > 14 ? <span className="low">{nCols} kolom: font PDF mengecil</span> : `${nCols} kolom`}>
        {data.skuMissing?.length > 0 && <div className="warn" style={{ marginBottom: 8 }}>{data.skuMissing.length} kode SKU di data Qty tidak ada di Database SKU ({data.skuMissing.slice(0, 5).join(', ')}{data.skuMissing.length > 5 ? '…' : ''}). Nama dan kategorinya diambil dari file Qty.</div>}
        <div className="opt-row">
          <b>Target DAP</b>
          <div className="seg">{[['total', 'Total'], ['visit', 'Per kunjungan'], ['both', 'Keduanya']].map(([v, l]) => <button key={v} className={(cfg.tmode || 'both') === v ? 'on' : ''} onClick={() => setCfg({ ...cfg, tmode: v })}>{l}</button>)}</div>
          {hasSheet && <><span className="mut">Sumber</span><div className="seg"><button className={useAuto ? 'on' : ''} onClick={() => setCfg({ ...cfg, src: 'auto' })}>Kontribusi L3M</button><button className={!useAuto ? 'on' : ''} onClick={() => setCfg({ ...cfg, src: 'sheet' })}>Sheet DAP</button></div></>}
          {!auto?.sheet && <span className="mut">Basis: {mode === 'bti' ? 'BTI' : 'Milestone'} (ikut pilihan di Performa)</span>}
        </div>
        {auto?.sheet && (
          <div className="note" style={{ marginBottom: 8 }}>
            Target DAP dari worksheet <b>{auto.sheet.name}</b> ({auto.sheet.n.toLocaleString('id-ID')} toko), tanpa hitungan otomatis. {auto.sheet.noTarget > 0 && <>{auto.sheet.noTarget} toko belum punya target di worksheet (target 0, PLAN = minimum order). </>}{auto.sheet.outside > 0 && <>{auto.sheet.outside} toko di worksheet tidak ada di JKS (total target {fmt.jt(auto.sheet.outsideT)} jt) dan tidak masuk DAP. </>}{auto.sheet.dup > 0 && <>{auto.sheet.dup} toko tercatat lebih dari satu baris; targetnya dihitung sekali.</>}
          </div>
        )}
        {useAuto && auto?.notes?.some((n) => n.over > 1000) && <div className="warn" style={{ marginBottom: 8 }}>Batas minimum retail/grosir membuat total target toko melebihi target salesman: {auto.notes.filter((n) => n.over > 1000).map((n) => `${n.sales.split(' ')[0]} +${fmt.jt(n.over, 2)} jt`).join(', ')}.</div>}
        <b>Kolom tabel DAP</b> <span className="mut">(No, Nama Toko, ID selalu ada)</span>
        <div className="cols-pick">
          {[...COLS.filter((c) => c.k !== 'blank' && c.k !== 'tv'), ...promoCols(data).map((k) => colFor(k, data))].map((c) => (
            <label key={c.k} className={cfg.cols.includes(c.k) ? 'on' : ''}>
              <input type="checkbox" checked={cfg.cols.includes(c.k)} onChange={() => toggleCol(c.k)} />{c.label}
            </label>
          ))}
          <label className={cfg.cols.includes('blank') ? 'on' : ''}><input type="checkbox" checked={cfg.cols.includes('blank')} onChange={() => toggleCol('blank')} />Kolom kosong</label>
        </div>
        <div className="row" style={{ margin: '4px 0 8px' }}>
          <span className="mut">Urutan:</span>
          {cfg.cols.map((k) => (
            <span key={k} className="pill">{colFor(k, data)?.label || 'Kosong'}<span className="ordr"><button onClick={() => colMove(k, -1)}>◀</button><button onClick={() => colMove(k, 1)}>▶</button></span></span>
          ))}
        </div>
        <div className="row" style={{ margin: '10px 0 4px' }}>
          <b>Minimum order PLAN</b>
          <span className="mut">PLAN = gap ÷ sisa kunjungan, dan tidak pernah di bawah minimum order (target sudah tercapai pun PLAN = minimum order)</span>
        </div>
        <div className="opt-row">
          <label className="mut" style={{ fontWeight: 600 }}>Wholesaler <input className="input" type="number" step="50000" style={{ width: 120, minWidth: 0 }} value={cfg.minOrder?.ws ?? 1000000} onChange={(e) => setCfg((c) => ({ ...c, minOrder: { ...(c.minOrder || { ws: 1000000, rt: 200000 }), ws: +e.target.value || 0 } }))} /></label>
          <label className="mut" style={{ fontWeight: 600 }}>Retail <input className="input" type="number" step="50000" style={{ width: 120, minWidth: 0 }} value={cfg.minOrder?.rt ?? 200000} onChange={(e) => setCfg((c) => ({ ...c, minOrder: { ...(c.minOrder || { ws: 1000000, rt: 200000 }), rt: +e.target.value || 0 } }))} /></label>
          <span className="mut">Klik angka mana saja di tabel DAP untuk mengubahnya (oranye = diubah, ↺ = kembali ke suggest). Perubahan berlaku untuk tanggal DAP ini dan ikut ke PDF.</span>
          {nEditDay > 0 && <button className="btn sm" onClick={() => window.confirm(`Kembalikan ${nEditDay} toko di tanggal ini ke suggest?`) && setCfg((c) => { const ed = { ...(c.edits || {}) }; delete ed[dateKey]; return { ...c, edits: ed }; })}>Reset {nEditDay} toko yang diubah</button>}
        </div>

        <div className="row" style={{ margin: '10px 0 4px' }}>
          <b>SKU fokus di tabel DAP</b>
          <span className="mut">{skus.length ? `${skus.length} SKU tersedia${data.skudb?.length ? ' (database SKU)' : ' (dari data qty)'}` : 'belum ada database SKU / data qty'}</span>
          <span style={{ flex: 1 }} />
          <span className="mut">Isi kolom:</span>
          <div className="seg"><button className={cfg.skuMetric === 'qty' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'qty' })}>Qty</button><button className={cfg.skuMetric === 'rp' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'rp' })}>Rp</button><button className={cfg.skuMetric === 'both' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'both' })}>Keduanya</button></div>
        </div>
        {skus.length > 0 ? (
          <>
            <FocusPicker skus={skus} cats={cats} prins={prins} picks={skuPicks} onToggle={toggleSkuPick} />
            {cfg.skuMain.length > 0 && <div className="mut" style={{ fontSize: 12 }}>{cfg.skuMain.length} SKU jadi kolom di tabel DAP.</div>}
          </>
        ) : <div className="mut">Belum ada database SKU atau data qty.</div>}

        <div className="row" style={{ margin: '14px 0 4px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <b>Kategori / principal di tabel DAP</b>
          <span className="mut">{ci.has ? 'target dari slot "Target kategori / principal" (~ = estimasi: target salesman dibagi ke toko menurut kontribusi L3M toko)' : 'upload slot "Target kategori / principal" untuk menampilkan target; tanpa itu hanya Actual'}</span>
        </div>
        {(kcat.length > 0 || prins.length > 0) ? (
          <>
            <FocusPicker kinds={['kat', 'prin']} cats={kcat} prins={prins} picks={cfg.kpick || []} onToggle={togK} marks={(k, key) => ci.keys[k === 'kat' ? 'kat' : 'prin'].has(nk(key))} />
            <div className="opt-row"><span className="mut">Isi kolom</span>{[['act', 'Actual'], ['tgt', 'Target'], ['ach', '% Ach']].map(([m, l]) => <label key={m} className={'btn sm tog' + ((cfg.kcols || ['act', 'tgt', 'ach']).includes(m) ? ' on' : '')} style={{ cursor: 'pointer' }}><input type="checkbox" hidden checked={(cfg.kcols || ['act', 'tgt', 'ach']).includes(m)} onChange={() => togKC(m)} />{l}</label>)}</div>
          </>
        ) : <div className="mut">Belum ada data SKU: upload Omset per SKU dan Database SKU dulu.</div>}

        <div className="row" style={{ margin: '14px 0 4px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <b>Halaman Top toko</b>
          <label className="row" style={{ gap: 5 }}><input type="checkbox" checked={cfg.par.on} onChange={(e) => setPar({ on: e.target.checked })} />ikut di PDF dan preview</label>
        </div>
        {cfg.par.on && (
          <>
            <div className="mut" style={{ marginBottom: 6 }}>Satu halaman per salesman (setelah tabel DAP-nya): toko yang dikunjungi di tanggal ini, diurutkan dari Target DAP per kunjungan tertinggi. Kategori, principal, dan SKU fokus di bawah menjadi kolom.</div>
            <div className="opt-row">
              <span className="mut">Jumlah toko</span>
              <div className="seg">{[5, 10, 15, 20].map((v) => <button key={v} className={(cfg.par.top || 10) === v ? 'on' : ''} onClick={() => setPar({ top: v })}>{v}</button>)}</div>
              <span className="mut">Isi kolom fokus</span>
              {[['act', 'Actual'], ['qty', 'Qty'], ['tgt', 'Target'], ['ach', '% Ach']].map(([m, l]) => <label key={m} className={'btn sm tog' + ((cfg.par.fm || ['act', 'tgt', 'ach']).includes(m) ? ' on' : '')} style={{ cursor: 'pointer' }}><input type="checkbox" hidden checked={(cfg.par.fm || ['act', 'tgt', 'ach']).includes(m)} onChange={() => setPar({ fm: (cfg.par.fm || ['act', 'tgt', 'ach']).includes(m) ? cfg.par.fm.filter((x) => x !== m) : [...(cfg.par.fm || ['act', 'tgt', 'ach']), m] })} />{l}</label>)}
            </div>
            <div className="cols-pick">
              {[['blank', 'Kolom Order kosong'], ['notes', 'Kolom Catatan']].map(([k, l]) => (
                <label key={k} className={cfg.par[k] ? 'on' : ''}><input type="checkbox" checked={!!cfg.par[k]} onChange={(e) => setPar({ [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <div className="mut" style={{ fontSize: 12 }}>Target hanya ada untuk kategori dan principal (slot "Target kategori / principal"). SKU satuan hanya punya Actual dan Qty, kecuali file Omset per SKU memuat kolom Target.</div>
            <b>Kolom fokus</b>
            <FocusPicker skus={skus} cats={kcat} prins={prins} picks={cfg.par.focus.map((f) => ({ kind: f.t === 'sku' ? 'sku' : f.t === 'cat' ? 'kat' : 'prin', key: f.k }))} onToggle={(kind, key) => toggleFocus(kind === 'sku' ? 'sku' : kind === 'kat' ? 'cat' : 'prin', key)} marks={(k, key) => k !== 'sku' && ci.keys[k === 'kat' ? 'kat' : 'prin'].has(nk(key))} />
            {!cfg.par.focus.length && <div className="mut">Belum ada kolom fokus: halaman Top toko hanya berisi target per kunjungan dan actual toko.</div>}
          </>
        )}
      </Panel>
          </details>
        </>
      ) : (
      <Panel title="ATUR ISI DAP" right={nCols > 14 ? <span className="low">{nCols} kolom: font PDF mengecil</span> : `${nCols} kolom`}>
        {data.skuMissing?.length > 0 && <div className="warn" style={{ marginBottom: 8 }}>{data.skuMissing.length} kode SKU di data Qty tidak ada di Database SKU ({data.skuMissing.slice(0, 5).join(', ')}{data.skuMissing.length > 5 ? '…' : ''}). Nama dan kategorinya diambil dari file Qty.</div>}
        <div className="opt-row">
          <b>Target DAP</b>
          <div className="seg">{[['total', 'Total'], ['visit', 'Per kunjungan'], ['both', 'Keduanya']].map(([v, l]) => <button key={v} className={(cfg.tmode || 'both') === v ? 'on' : ''} onClick={() => setCfg({ ...cfg, tmode: v })}>{l}</button>)}</div>
          {hasSheet && <><span className="mut">Sumber</span><div className="seg"><button className={useAuto ? 'on' : ''} onClick={() => setCfg({ ...cfg, src: 'auto' })}>Kontribusi L3M</button><button className={!useAuto ? 'on' : ''} onClick={() => setCfg({ ...cfg, src: 'sheet' })}>Sheet DAP</button></div></>}
          {!auto?.sheet && <span className="mut">Basis: {mode === 'bti' ? 'BTI' : 'Milestone'} (ikut pilihan di Performa)</span>}
        </div>
        {auto?.sheet && (
          <div className="note" style={{ marginBottom: 8 }}>
            Target DAP dari worksheet <b>{auto.sheet.name}</b> ({auto.sheet.n.toLocaleString('id-ID')} toko), tanpa hitungan otomatis. {auto.sheet.noTarget > 0 && <>{auto.sheet.noTarget} toko belum punya target di worksheet (target 0, PLAN = minimum order). </>}{auto.sheet.outside > 0 && <>{auto.sheet.outside} toko di worksheet tidak ada di JKS (total target {fmt.jt(auto.sheet.outsideT)} jt) dan tidak masuk DAP. </>}{auto.sheet.dup > 0 && <>{auto.sheet.dup} toko tercatat lebih dari satu baris; targetnya dihitung sekali.</>}
          </div>
        )}
        {useAuto && auto?.notes?.some((n) => n.over > 1000) && <div className="warn" style={{ marginBottom: 8 }}>Batas minimum retail/grosir membuat total target toko melebihi target salesman: {auto.notes.filter((n) => n.over > 1000).map((n) => `${n.sales.split(' ')[0]} +${fmt.jt(n.over, 2)} jt`).join(', ')}.</div>}
        <b>Kolom tabel DAP</b> <span className="mut">(No, Nama Toko, ID selalu ada)</span>
        <div className="cols-pick">
          {[...COLS.filter((c) => c.k !== 'blank' && c.k !== 'tv'), ...promoCols(data).map((k) => colFor(k, data))].map((c) => (
            <label key={c.k} className={cfg.cols.includes(c.k) ? 'on' : ''}>
              <input type="checkbox" checked={cfg.cols.includes(c.k)} onChange={() => toggleCol(c.k)} />{c.label}
            </label>
          ))}
          <label className={cfg.cols.includes('blank') ? 'on' : ''}><input type="checkbox" checked={cfg.cols.includes('blank')} onChange={() => toggleCol('blank')} />Kolom kosong</label>
        </div>
        <div className="row" style={{ margin: '4px 0 8px' }}>
          <span className="mut">Urutan:</span>
          {cfg.cols.map((k) => (
            <span key={k} className="pill">{colFor(k, data)?.label || 'Kosong'}<span className="ordr"><button onClick={() => colMove(k, -1)}>◀</button><button onClick={() => colMove(k, 1)}>▶</button></span></span>
          ))}
        </div>
        <div className="row" style={{ margin: '10px 0 4px' }}>
          <b>Minimum order PLAN</b>
          <span className="mut">PLAN = gap ÷ sisa kunjungan, dan tidak pernah di bawah minimum order (target sudah tercapai pun PLAN = minimum order)</span>
        </div>
        <div className="opt-row">
          <label className="mut" style={{ fontWeight: 600 }}>Wholesaler <input className="input" type="number" step="50000" style={{ width: 120, minWidth: 0 }} value={cfg.minOrder?.ws ?? 1000000} onChange={(e) => setCfg((c) => ({ ...c, minOrder: { ...(c.minOrder || { ws: 1000000, rt: 200000 }), ws: +e.target.value || 0 } }))} /></label>
          <label className="mut" style={{ fontWeight: 600 }}>Retail <input className="input" type="number" step="50000" style={{ width: 120, minWidth: 0 }} value={cfg.minOrder?.rt ?? 200000} onChange={(e) => setCfg((c) => ({ ...c, minOrder: { ...(c.minOrder || { ws: 1000000, rt: 200000 }), rt: +e.target.value || 0 } }))} /></label>
          <span className="mut">Klik angka mana saja di tabel DAP untuk mengubahnya (oranye = diubah, ↺ = kembali ke suggest). Perubahan berlaku untuk tanggal DAP ini dan ikut ke PDF.</span>
          {nEditDay > 0 && <button className="btn sm" onClick={() => window.confirm(`Kembalikan ${nEditDay} toko di tanggal ini ke suggest?`) && setCfg((c) => { const ed = { ...(c.edits || {}) }; delete ed[dateKey]; return { ...c, edits: ed }; })}>Reset {nEditDay} toko yang diubah</button>}
        </div>

        <div className="row" style={{ margin: '10px 0 4px' }}>
          <b>SKU fokus di tabel DAP</b>
          <span className="mut">{skus.length ? `${skus.length} SKU tersedia${data.skudb?.length ? ' (database SKU)' : ' (dari data qty)'}` : 'belum ada database SKU / data qty'}</span>
          <span style={{ flex: 1 }} />
          <span className="mut">Isi kolom:</span>
          <div className="seg"><button className={cfg.skuMetric === 'qty' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'qty' })}>Qty</button><button className={cfg.skuMetric === 'rp' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'rp' })}>Rp</button><button className={cfg.skuMetric === 'both' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'both' })}>Keduanya</button></div>
        </div>
        {skus.length > 0 ? (
          <>
            <FocusPicker skus={skus} cats={cats} prins={prins} picks={skuPicks} onToggle={toggleSkuPick} />
            {cfg.skuMain.length > 0 && <div className="mut" style={{ fontSize: 12 }}>{cfg.skuMain.length} SKU jadi kolom di tabel DAP.</div>}
          </>
        ) : <div className="mut">Belum ada database SKU atau data qty.</div>}

        <div className="row" style={{ margin: '14px 0 4px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <b>Kategori / principal di tabel DAP</b>
          <span className="mut">{ci.has ? 'target dari slot "Target kategori / principal" (~ = estimasi: target salesman dibagi ke toko menurut kontribusi L3M toko)' : 'upload slot "Target kategori / principal" untuk menampilkan target; tanpa itu hanya Actual'}</span>
        </div>
        {(kcat.length > 0 || prins.length > 0) ? (
          <>
            <FocusPicker kinds={['kat', 'prin']} cats={kcat} prins={prins} picks={cfg.kpick || []} onToggle={togK} marks={(k, key) => ci.keys[k === 'kat' ? 'kat' : 'prin'].has(nk(key))} />
            <div className="opt-row"><span className="mut">Isi kolom</span>{[['act', 'Actual'], ['tgt', 'Target'], ['ach', '% Ach']].map(([m, l]) => <label key={m} className={'btn sm tog' + ((cfg.kcols || ['act', 'tgt', 'ach']).includes(m) ? ' on' : '')} style={{ cursor: 'pointer' }}><input type="checkbox" hidden checked={(cfg.kcols || ['act', 'tgt', 'ach']).includes(m)} onChange={() => togKC(m)} />{l}</label>)}</div>
          </>
        ) : <div className="mut">Belum ada data SKU: upload Omset per SKU dan Database SKU dulu.</div>}

        <div className="row" style={{ margin: '14px 0 4px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <b>Halaman Top toko</b>
          <label className="row" style={{ gap: 5 }}><input type="checkbox" checked={cfg.par.on} onChange={(e) => setPar({ on: e.target.checked })} />ikut di PDF dan preview</label>
        </div>
        {cfg.par.on && (
          <>
            <div className="mut" style={{ marginBottom: 6 }}>Satu halaman per salesman (setelah tabel DAP-nya): toko yang dikunjungi di tanggal ini, diurutkan dari Target DAP per kunjungan tertinggi. Kategori, principal, dan SKU fokus di bawah menjadi kolom.</div>
            <div className="opt-row">
              <span className="mut">Jumlah toko</span>
              <div className="seg">{[5, 10, 15, 20].map((v) => <button key={v} className={(cfg.par.top || 10) === v ? 'on' : ''} onClick={() => setPar({ top: v })}>{v}</button>)}</div>
              <span className="mut">Isi kolom fokus</span>
              {[['act', 'Actual'], ['qty', 'Qty'], ['tgt', 'Target'], ['ach', '% Ach']].map(([m, l]) => <label key={m} className={'btn sm tog' + ((cfg.par.fm || ['act', 'tgt', 'ach']).includes(m) ? ' on' : '')} style={{ cursor: 'pointer' }}><input type="checkbox" hidden checked={(cfg.par.fm || ['act', 'tgt', 'ach']).includes(m)} onChange={() => setPar({ fm: (cfg.par.fm || ['act', 'tgt', 'ach']).includes(m) ? cfg.par.fm.filter((x) => x !== m) : [...(cfg.par.fm || ['act', 'tgt', 'ach']), m] })} />{l}</label>)}
            </div>
            <div className="cols-pick">
              {[['blank', 'Kolom Order kosong'], ['notes', 'Kolom Catatan']].map(([k, l]) => (
                <label key={k} className={cfg.par[k] ? 'on' : ''}><input type="checkbox" checked={!!cfg.par[k]} onChange={(e) => setPar({ [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <div className="mut" style={{ fontSize: 12 }}>Target hanya ada untuk kategori dan principal (slot "Target kategori / principal"). SKU satuan hanya punya Actual dan Qty, kecuali file Omset per SKU memuat kolom Target.</div>
            <b>Kolom fokus</b>
            <FocusPicker skus={skus} cats={kcat} prins={prins} picks={cfg.par.focus.map((f) => ({ kind: f.t === 'sku' ? 'sku' : f.t === 'cat' ? 'kat' : 'prin', key: f.k }))} onToggle={(kind, key) => toggleFocus(kind === 'sku' ? 'sku' : kind === 'kat' ? 'cat' : 'prin', key)} marks={(k, key) => k !== 'sku' && ci.keys[k === 'kat' ? 'kat' : 'prin'].has(nk(key))} />
            {!cfg.par.focus.length && <div className="mut">Belum ada kolom fokus: halaman Top toko hanya berisi target per kunjungan dan actual toko.</div>}
          </>
        )}
      </Panel>
      )}

      {model.groups.map((g) => (
        <Panel key={g.name} title={g.name.toUpperCase()} right={<><span>{g.n} toko · PLAN {fmt.jt(g.plan, 2)} jt </span><button className="btn sm" style={{ marginLeft: 6 }} onClick={() => pdf(g.name)}>PDF</button></>} flush>
          <div className="scroll">
            <table className="t">
              <thead><tr>{model.head.map((c, i) => <th key={i} className={i === 1 || i === 2 ? 'l' : ''}>{c.label}</th>)}</tr></thead>
              <tbody>
                {g.rows.map((x) => (
                  <tr key={x.r.id + x.r.s}>
                    {x.cells.map((v, i) => {
                      if (i < 3) return <td key={i} className={i === 1 ? 'l nm' : i === 2 ? 'l mut' : ''}>{v}</td>;
                      const k = model.head[i].k;
                      const BASE = ['t', 'tv', 'a', 'sisa', 'plan'];
                      const base = BASE.includes(k);
                      const edited = base ? x.ed?.[k] != null : x.ed?.v?.[k] != null;
                      const cls = model.head[i].neg && String(v).startsWith('-') ? 'neg' : '';
                      const sA = x.r.auto?.[k];
                      return (
                        <Cell key={i} v={v} cls={cls} num={base} jt={unit === 'jt'} edited={edited} title={edited && base ? `Suggest: ${['t', 'tv', 'a', 'plan'].includes(k) ? fmtMoney(sA, unit) : sA}` : ''}
                          onCommit={(val) => setEdit(x.r.id, (c) => (base ? { ...c, [k]: val } : { ...c, v: { ...(c.v || {}), [k]: val } }))}
                          onReset={() => setEdit(x.r.id, (c) => { const n = { ...c }; if (base) delete n[k]; else { const vv = { ...(n.v || {}) }; delete vv[k]; if (Object.keys(vv).length) n.v = vv; else delete n.v; } return n; })} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cfg.par.on && (
            <div className="note">
              <div className="row">
                <b>Top {g.pareto?.n || 0} toko hari ini</b>
                {g.pareto?.rows.length > 0 && <button className="btn sm" onClick={() => setOpenCards(openCards === g.name ? null : g.name)}>{openCards === g.name ? 'Tutup preview' : 'Lihat preview'}</button>}
                {!g.pareto?.rows.length && <span className="mut">tidak ada toko hari ini</span>}
              </div>
              {openCards === g.name && g.pareto && (
                <div className="scroll" style={{ marginTop: 6 }}><table className="t">
                  <thead><tr>{g.pareto.cols.map((cc, j) => <th key={j} className={j === 1 ? 'l' : ''}>{cc.label}</th>)}</tr></thead>
                  <tbody>{g.pareto.rows.map((r, i) => <tr key={i}>{r.map((v, j) => (j < 3 ? <td key={j} className={j === 1 ? 'l' : ''}>{v}</td> : <Cell key={j} v={v} edited={g.pareto.edList?.[i]?.pv?.[j] != null} onCommit={(val) => setEdit(g.pareto.ids[i], (c) => ({ ...c, pv: { ...(c.pv || {}), [j]: val } }))} onReset={() => setEdit(g.pareto.ids[i], (c) => { const pv = { ...(c.pv || {}) }; delete pv[j]; const n = { ...c }; if (Object.keys(pv).length) n.pv = pv; else delete n.pv; return n; })} />))}</tr>)}</tbody>
                </table></div>
              )}
            </div>
          )}
        </Panel>
      ))}
      {!model.groups.length && <Panel title="TIDAK ADA KUNJUNGAN"><div className="empty"><p className="mut">Tidak ada toko yang dijadwalkan di tanggal ini.</p></div></Panel>}
    </div>
  );
}
