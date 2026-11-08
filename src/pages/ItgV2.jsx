import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { DEFAULT_PCT, MON_NAME, computeItg2, parseItg2 } from '../lib/itg2.js';
import { parseRoute, visitDays } from '../lib/calc.js';
import './itgv2.css';

const rpf = (n) => Math.round(n || 0).toLocaleString('id-ID');
const jtf = (n, d = 1) => ((n || 0) / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d });
const pcf = (r) => (r == null ? '-' : Math.round(r * 100) + '%');
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage tidak tersedia */ } };
const pad = (n) => String(n).padStart(2, '0');
const workdays = (y, m, upto) => { let c = 0; for (let d = 1; d <= upto; d++) if (new Date(y, m - 1, d).getDay() !== 0) c++; return c; };
const cls = (v) => (v == null ? 'mut' : v >= 1 ? 'ok' : v >= 0.7 ? 'mid' : 'low');
// warna menurut laju: pencapaian dibanding porsi target yang seharusnya sudah tercapai (timegone)
const pace = (v, exp) => (v == null ? 'mut' : exp <= 0 ? 'ok' : v / exp >= 1 ? 'ok' : v / exp >= 0.7 ? 'mid' : 'low');

function nowTime(months) {
  const n = new Date();
  let y = n.getFullYear(), m = n.getMonth() + 1, d = n.getDate();
  if (!months.some((x) => x.m === m)) { y = months[0].y; m = months[0].m; d = 8; }
  const last = new Date(y, m, 0).getDate();
  const tg = workdays(y, m, Math.min(d - 1, last)) / workdays(y, m, last);
  return { y, m, d, tg, last };
}

// sel angka yang bisa diklik dan diketik; berwarna oranye kalau berbeda dari suggest
function Ed({ v, auto, set, unit, dec = 1, int = false, text = false, pct = false, dash = false }) {
  const [on, setOn] = useState(false);
  const changed = text ? v !== auto : pct ? Math.abs(v - auto) > 1e-9 : auto != null && Math.round(v) !== Math.round(auto);
  const shown = dash && !v ? '-' : text ? v || '-' : pct ? String(+v.toFixed(2)).replace('.', ',') : int ? String(Math.round(v)) : unit === 'jt' ? jtf(v, dec) : rpf(v);
  const commit = (raw) => {
    setOn(false);
    if (text) { set(raw.trim() === (auto ?? '') ? undefined : raw.trim()); return; }
    if (pct) { const x = parseFloat(String(raw).replace(',', '.')); if (Number.isFinite(x)) set(Math.abs(x - auto) < 1e-9 ? undefined : x); return; }
    let x = int ? parseInt(raw, 10) : unit === 'jt' ? parseFloat(String(raw).replace(',', '.')) * 1e6 : parseFloat(String(raw).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(x)) return;
    x = Math.round(x);
    set(Math.round(auto) === x ? undefined : x);
  };
  if (on) return <input className={'cell' + (text ? ' w' : '')} autoFocus type="text" defaultValue={text ? v || '' : pct ? String(+v.toFixed(2)).replace('.', ',') : int ? Math.round(v) : unit === 'jt' ? String(+(v / 1e6).toFixed(3)).replace('.', ',') : Math.round(v)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setOn(false); }} />;
  return (
    <span>
      <span className={'ed' + (changed ? ' chg' : '')} title={changed ? 'Diubah. Suggest: ' + (text ? auto || '-' : pct ? auto : int ? auto : unit === 'jt' ? jtf(auto, 2) : rpf(auto)) : 'Klik untuk mengubah'} onClick={() => setOn(true)}>{shown}</span>
      {changed && <button className="rst" title="Kembalikan ke suggest" onClick={() => set(undefined)}>↺</button>}
    </span>
  );
}

const SHOW_LABEL = [['off', 'OFF faktur'], ['hist', 'Histori pengambilan'], ['rec', 'Rekomendasi order'], ['on', 'ON faktur'], ['kes', 'Kesimpulan pengambilan'], ['wajib', 'Item wajib'], ['sig', 'Tanda tangan']];
// kolom yang bisa ditampilkan atau disembunyikan per tabel di kertas
const COLS = {
  off: [['target', 'Target'], ['actual', 'Actual'], ['pct', '%'], ['gap', 'Gap'], ['benefit', 'Benefit'], ['reward', 'Reward']],
  rec: [['karton', 'Karton'], ['harga', 'Harga/dus'], ['nilai', 'Nilai'], ['disk', 'Disk %'], ['pot', 'Potongan']],
  on: [['min', 'Min order'], ['sat', 'Satuan'], ['dis', 'Diskon'], ['pot', 'Potongan'], ['ambil', 'Pengambilan']],
};
const TITLE = { off: 'Kolom OFF faktur', rec: 'Kolom rekomendasi', on: 'Kolom ON faktur' };
const HSRC = [['l3m', 'Rata-rata 3 bulan'], ['lm', 'Bulan lalu'], ['act', 'Bulan data']];
const numOnly = (t) => { const x = String(t ?? '').trim(); if (!x || !/^[\d.,\s]+$/.test(x)) return 0; const n = parseFloat(x.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function Contract({ r, unit, patch, months, onClose, show, setGlobalShow, applyShow, nFilter, hm, tg = 1, onPdf }) {
  const e = r.e;
  const cv = (g, k) => show.cols?.[g + '.' + k] !== false;
  const ov = e.contract?.ov || {};
  const OV = (k, auto) => ov[k] ?? auto;
  const setOv = (k) => (x) => patch((c) => { const ct = { ...(c.contract || {}) }; const o = { ...(ct.ov || {}) }; if (x === undefined) delete o[k]; else o[k] = x; if (Object.keys(o).length) ct.ov = o; else delete ct.ov; return { ...c, contract: ct }; });
  const lines = e.contract?.lines || [];
  const setLines = (fn) => patch((c) => ({ ...c, contract: { ...(c.contract || {}), lines: fn([...lines]) } }));
  const onRows = e.contract?.on || [];
  const setOn = (fn) => patch((c) => ({ ...c, contract: { ...(c.contract || {}), on: fn([...onRows]) } }));
  const setLine = (i, k) => (x) => setLines((a) => { const l = { ...a[i] }; if (x === undefined) delete l[k]; else l[k] = x; a[i] = l; return a; });
  const nilai = (l) => l.nv ?? (l.k || 0) * (l.h || 0);
  const potL = (l) => l.pv ?? Math.round((nilai(l) * (l.d || 0)) / 100);
  const valAuto = lines.reduce((a, l) => a + nilai(l), 0), potAuto = lines.reduce((a, l) => a + potL(l), 0);
  const val = OV('val', valAuto), pot = OV('pot', potAuto);
  const onPotAuto = onRows.reduce((a, x) => a + (x.pot || 0), 0), onPot = OV('onpot', onPotAuto);
  const per = r.tUsed;
  const label = r.basis === 'visit' ? 'per kunjungan' : r.basis === 'bulan' ? 'sebulan' : 'dua bulan';
  const mm = months.map((m) => m.label).join(' – ');
  const A0 = r.auto.a1 + r.auto.a2;
  // dasar target (per kunjungan / sebulan / dua bulan) menggerakkan tabel OFF faktur; reward tetap mengikuti ITG dua bulan
  const bs = r.basis;
  const mAct = r.mi === 0 ? r.a1 : r.a2;
  const doneV = Math.max(1, Math.round(r.visits * (tg || 1)));
  const BT = bs === 'bulan' ? r.tMonth : r.per100;
  const BA = bs === 'bulan' ? mAct : Math.round(mAct / doneV);
  const sT = bs === 'dua' ? r.T : OV('bT_' + bs, BT), sA = bs === 'dua' ? r.A : OV('bA_' + bs, BA);
  const sP = sT > 0 ? sA / sT : null;
  const setActual = (x) => patch((c) => { const n = { ...c }; const v = x - r.a2; if (Math.round(v) === Math.round(r.auto.a1)) delete n.a1; else n.a1 = Math.max(0, Math.round(v)); return n; });
  const setPct = (x) => setActual(((x ?? 0) / 100) * r.T);
  const totBenAuto = (show.off ? r.reward : 0) + (show.rec && lines.length ? pot * r.visits : 0) + (show.on ? onPot : 0);
  const totBen = OV('tot', totBenAuto);
  const nShown = SHOW_LABEL.filter(([k]) => show[k]).length;
  const toggleCol = (g, k) => patch((c) => ({ ...c, show: { ...(c.show || {}), cols: { ...((c.show || {}).cols || {}), [g + '.' + k]: !cv(g, k) } } }));
  const hsrc = show.hsrc || 'l3m';
  const hmode = show.hmode || 'bulan';
  const hf = hmode === 'visit' ? r.visits : 1;
  // kesimpulan pengambilan di kunjungan
  const ambilAuto = onRows.reduce((a, x) => a + numOnly(x.ambil), 0);
  const ambil = OV('ambil', ambilAuto);
  const kTgt = OV('k_tgt', r.per100), kMin = OV('k_min', r.per70);
  const status = ambil <= 0 ? ['belum diisi', 'mut'] : ambil >= kTgt ? ['capai target', 'g'] : ambil >= kMin ? ['lolos minimal', 'b'] : ['di bawah minimal', 'r'];
  return (
    <>
      <div className="card cset">
        <div className="ctl" style={{ margin: 0 }}>
          <span className="lbl">Tampilkan di kontrak</span>
          <span className="chips">{SHOW_LABEL.map(([k, l]) => <label key={k} className={'tog' + (show[k] ? ' on' : '')}><input type="checkbox" checked={!!show[k]} onChange={() => patch((c) => { const sh = { ...(c.show || {}) }; sh[k] = !show[k]; return { ...c, show: sh }; })} />{l}</label>)}</span>
        </div>
        <div className="ctl" style={{ margin: '6px 0 0' }}>
          <span className="lbl">Histori</span>
          <div className="seg">{[['bulan', 'Per bulan'], ['visit', 'Per kunjungan']].map(([v, l]) => <button key={v} className={hmode === v ? 'on' : ''} onClick={() => patch((c) => ({ ...c, show: { ...(c.show || {}), hmode: v } }))}>{l}</button>)}</div>
          <div className="seg">{HSRC.map(([v, l]) => <button key={v} className={hsrc === v ? 'on' : ''} onClick={() => patch((c) => ({ ...c, show: { ...(c.show || {}), hsrc: v } }))}>{l}</button>)}</div>
        </div>
        <div className="ctl" style={{ margin: '6px 0 0' }}>
          <span className="lbl">Target kontrak</span>
          <div className="seg">{[['visit', 'Per kunjungan'], ['bulan', 'Sebulan'], ['dua', 'Dua bulan']].map(([v, l]) => <button key={v} className={r.basis === v ? 'on' : ''} onClick={() => patch((c) => { const n = { ...c, basis: v }; delete n.tUsed; return n; })}>{l}</button>)}</div>
          <span className="lbl">Basis</span>
          <div className="seg">{[100, 90, 80, 70].map((v) => <button key={v} className={r.pctUse === v ? 'on' : ''} onClick={() => patch((c) => { const n = { ...c, pct: v }; delete n.tUsed; return n; })}>{v}%</button>)}</div>
          <label className="mut" style={{ fontWeight: 600 }}>Minimal <input type="number" style={{ width: 54 }} defaultValue={r.minPct} key={'mp' + r.minPct} onBlur={(ev) => { const v = parseFloat(ev.target.value); if (Number.isFinite(v) && v > 0) patch((c) => ({ ...c, minPct: v })); }} />%</label>
          <label className="mut" style={{ fontWeight: 600 }}>Kunjungan <input type="number" style={{ width: 50 }} defaultValue={r.visits} key={'vv' + r.visits} onBlur={(ev) => { const v = parseInt(ev.target.value, 10); if (v > 0) patch((c) => ({ ...c, visits: v })); }} />×</label>
        </div>
        {Object.keys(COLS).map((g) => (
          <div key={g} className="ctl" style={{ margin: '6px 0 0' }}>
            <span className="lbl">{TITLE[g]}</span>
            <span className="chips">{COLS[g].map(([k, l]) => <label key={k} className={'tog' + (cv(g, k) ? ' on' : '')}><input type="checkbox" checked={cv(g, k)} onChange={() => toggleCol(g, k)} />{l}</label>)}</span>
          </div>
        ))}
        <div className="ctl" style={{ margin: '8px 0 0' }}>
          <button className="btn sm" onClick={() => setGlobalShow(show)} title="Jadikan pengaturan tampilan ini sebagai bawaan untuk semua toko">Jadikan bawaan semua toko</button>
          <button className="btn sm" onClick={() => applyShow(show)} title="Terapkan pengaturan tampilan ini ke toko yang sesuai filter">Terapkan ke {nFilter} toko (filter)</button>
          {onPdf && <button className="btn sm coin" onClick={onPdf}>Unduh PDF toko ini</button>}
          <span className="mut" style={{ fontSize: 11 }}>Pengaturan ini tidak ikut tercetak di kertas. Isi tabelnya tetap bisa diklik dan diedit di kertas.</span>
        </div>
      </div>

      <div className="card fade paper" key={r.id}>
        <div className="ph">PACKAGE DEVELOPMENT PROGRAM · {mm.toUpperCase()} 2026{onClose && <button className="x" onClick={onClose}>× Tutup</button>}</div>
        <div className="pb">
          <div className="kv">
            <span>Pelanggan</span><span>{r.name}</span><span>ID</span><span>{r.id}</span><span>Salesman</span><span>{r.sales}</span><span>Class</span><span>{r.cls}</span><span>Jadwal</span><span>{r.route || '-'} · {r.visits}× / bulan ({r.freq})</span>
          </div>
          {nShown === 0 && <div className="warn">Semua tabel disembunyikan. Aktifkan minimal satu di pengaturan di atas kertas.</div>}

          {show.off && (<>
            <h4>Program OFF faktur</h4>
            <table>
              <thead><tr><th className="l">Program</th>{cv('off', 'target') && <th>Target</th>}{cv('off', 'actual') && <th>Actual</th>}{cv('off', 'pct') && <th>%</th>}{cv('off', 'gap') && <th>Gap</th>}{cv('off', 'benefit') && <th>Benefit</th>}{cv('off', 'reward') && <th>Reward</th>}</tr></thead>
              <tbody><tr>
                <td className="l">{bs === 'dua' ? `ITG ${months.length === 2 ? `${months[0].label}–${months[1].label}` : ''}` : bs === 'bulan' ? `ITG ${months[r.mi]?.label || ''}` : `ITG per kunjungan (${months[r.mi]?.label || ''})`}</td>
                {cv('off', 'target') && <td><Ed v={bs === 'dua' ? r.T : OV('bT_' + bs, BT)} auto={bs === 'dua' ? r.auto.T : BT} unit={unit} dec={2} set={bs === 'dua' ? (x) => patch((c) => ({ ...c, T: x })) : setOv('bT_' + bs)} /></td>}
                {cv('off', 'actual') && <td><Ed v={bs === 'dua' ? r.A : OV('bA_' + bs, BA)} auto={bs === 'dua' ? A0 : BA} unit={unit} dec={2} set={bs === 'dua' ? (x) => setActual(x ?? A0) : setOv('bA_' + bs)} /></td>}
                {cv('off', 'pct') && (bs === 'dua'
                  ? <td className={cls(r.total)}><Ed pct v={Math.round((r.total || 0) * 1000) / 10} auto={Math.round(((A0 / (r.auto.T || 1)) || 0) * 1000) / 10} set={(x) => setPct(x ?? ((A0 / (r.auto.T || 1)) * 100))} />%</td>
                  : <td className={cls(sP)}>{pcf(sP)}</td>)}
                {cv('off', 'gap') && <td><Ed v={bs === 'dua' ? OV('gap', r.gap) : OV('bG_' + bs, Math.max(0, sT - sA))} auto={bs === 'dua' ? Math.max(0, r.T - r.A) : Math.max(0, sT - sA)} unit={unit} dec={2} set={bs === 'dua' ? setOv('gap') : setOv('bG_' + bs)} /></td>}
                {cv('off', 'benefit') && <td><Ed pct v={r.cpct} auto={r.auto.cpct} set={(x) => patch((c) => ({ ...c, cpct: x }))} />%</td>}
                {cv('off', 'reward') && <td><b><Ed v={r.reward} auto={r.rewardAuto} unit="Rp" set={(x) => patch((c) => ({ ...c, reward: x }))} /></b></td>}
              </tr></tbody>
            </table>
          </>)}

          {show.hist && (() => {
            const base0 = r.hist[hsrc];
            const mv = OV('h_' + hsrc, base0);
            return (
              <div className="hrow">
                <span>{hsrc === 'l3m' ? 'Rata-rata pengambilan' : hsrc === 'lm' ? `Pengambilan bulan lalu${hm?.lm ? ` (${hm.lm})` : ''}` : `Pengambilan bulan data${hm?.cur ? ` (${hm.cur})` : ''}`} per {hmode === 'visit' ? 'kunjungan' : 'bulan'}</span>
                <b>{mv == null ? '-' : <Ed dash v={mv / hf} auto={(base0 ?? 0) / hf} unit={unit} dec={2} set={(x) => setOv('h_' + hsrc)(x === undefined ? undefined : x * hf)} />}</b>
              </div>
            );
          })()}

          {show.rec && (<>
            <h4>Rekomendasi order per kunjungan</h4>
            <div className="mut" style={{ textAlign: 'center', marginBottom: 4, fontWeight: 600 }}>
              Target bulan <Ed v={r.tMonth} auto={r.mi === 0 ? r.auto.t1 : r.auto.t2} unit={unit} dec={2} set={(x) => patch((c) => ({ ...c, [r.mi === 0 ? 't1' : 't2']: x }))} /> jt ÷ <Ed int v={r.visits} auto={r.visitsAuto} unit={unit} set={(x) => patch((c) => ({ ...c, visits: x }))} /> kunjungan = <Ed v={OV('per100', r.per100)} auto={r.per100} unit={unit} dec={2} set={setOv('per100')} /> jt · minimal {r.minPct}% = <Ed v={OV('per70', r.per70)} auto={r.per70} unit={unit} dec={2} set={setOv('per70')} /> jt
            </div>
            <div className="ctl" style={{ justifyContent: 'center' }}>
              <span className="lbl">Dipakai ({label}, {r.pctUse}%)</span><b><Ed v={per} auto={r.tUsedAuto} unit={unit} dec={2} set={(x) => patch((c) => ({ ...c, tUsed: x }))} /></b>
            </div>
            <table>
              <thead><tr><th className="l">SKU</th>{cv('rec', 'karton') && <th>Karton</th>}{cv('rec', 'harga') && <th>Harga/dus</th>}{cv('rec', 'nilai') && <th>Nilai</th>}{cv('rec', 'disk') && <th>Disk %</th>}{cv('rec', 'pot') && <th>Potongan</th>}<th /></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="l"><Ed text v={l.n} auto="" set={(x) => setLine(i, 'n')(x ?? '')} /></td>
                    {cv('rec', 'karton') && <td><Ed int v={l.k || 0} auto={1} unit={unit} set={(x) => setLine(i, 'k')(x ?? 1)} /></td>}
                    {cv('rec', 'harga') && <td><Ed v={l.h || 0} auto={0} unit="Rp" set={(x) => setLine(i, 'h')(x ?? 0)} /></td>}
                    {cv('rec', 'nilai') && <td><Ed v={nilai(l)} auto={(l.k || 0) * (l.h || 0)} unit="Rp" set={setLine(i, 'nv')} /></td>}
                    {cv('rec', 'disk') && <td><Ed pct v={l.d || 0} auto={0} set={(x) => setLine(i, 'd')(x ?? 0)} />%</td>}
                    {cv('rec', 'pot') && <td><Ed v={potL(l)} auto={Math.round((nilai(l) * (l.d || 0)) / 100)} unit="Rp" set={setLine(i, 'pv')} /></td>}
                    <td><button className="rst" title="Hapus baris" onClick={() => setLines((a) => a.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                ))}
                {!lines.length && <tr><td className="l mut" colSpan={7}>Belum ada rincian SKU. Tambahkan baris, atau upload Omset per SKU supaya komposisinya disarankan otomatis.</td></tr>}
                <tr><td className="l"><b>Total per kunjungan</b></td>{cv('rec', 'karton') && <td />}{cv('rec', 'harga') && <td />}{cv('rec', 'nilai') && <td><b><Ed v={val} auto={valAuto} unit="Rp" set={setOv('val')} /></b>{r.per100 > 0 && val > 0 && <small> ({Math.round((val / r.per100) * 100)}%)</small>}</td>}{cv('rec', 'disk') && <td>{val ? ((pot / val) * 100).toFixed(1) + '%' : ''}</td>}{cv('rec', 'pot') && <td><b><Ed v={pot} auto={potAuto} unit="Rp" set={setOv('pot')} /></b></td>}<td /></tr>
                <tr><td className="l">Per bulan ({r.visits}×)</td>{cv('rec', 'karton') && <td />}{cv('rec', 'harga') && <td />}{cv('rec', 'nilai') && <td><Ed v={OV('mval', val * r.visits)} auto={val * r.visits} unit="Rp" set={setOv('mval')} /></td>}{cv('rec', 'disk') && <td />}{cv('rec', 'pot') && <td><Ed v={OV('mpot', pot * r.visits)} auto={pot * r.visits} unit="Rp" set={setOv('mpot')} /></td>}<td /></tr>
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 6 }}><button className="btn sm" onClick={() => setLines((a) => [...a, { n: '', k: 1, h: 0, d: 0 }])}>+ tambah SKU</button></div>
          </>)}

          {show.on && (<>
            <h4>Program ON faktur</h4>
            <table>
              <thead><tr><th className="l">Program</th>{cv('on', 'min') && <th>Min order</th>}{cv('on', 'sat') && <th>Satuan</th>}{cv('on', 'dis') && <th>Diskon</th>}{cv('on', 'pot') && <th>Potongan</th>}{cv('on', 'ambil') && <th title="Isi: berapa karton atau nilai yang diambil toko dari program ini">Pengambilan</th>}<th /></tr></thead>
              <tbody>
                {onRows.map((x, i) => {
                  const sx = (k) => (v) => setOn((a) => { const o = { ...a[i] }; if (v === undefined) delete o[k]; else o[k] = v; a[i] = o; return a; });
                  return (<tr key={i}>
                    <td className="l"><Ed text v={x.n || ''} auto="" set={(v) => sx('n')(v ?? '')} /></td>
                    {cv('on', 'min') && <td><Ed v={x.min || 0} auto={0} unit="Rp" dec={2} set={(v) => sx('min')(v ?? 0)} /></td>}
                    {cv('on', 'sat') && <td><Ed text v={x.sat || ''} auto="" set={(v) => sx('sat')(v ?? '')} /></td>}
                    {cv('on', 'dis') && <td><Ed text v={x.dis || ''} auto="" set={(v) => sx('dis')(v ?? '')} /></td>}
                    {cv('on', 'pot') && <td><Ed v={x.pot || 0} auto={0} unit="Rp" set={(v) => sx('pot')(v ?? 0)} /></td>}
                    {cv('on', 'ambil') && <td className="blank"><Ed text v={x.ambil || ''} auto="" set={(v) => sx('ambil')(v ?? '')} /></td>}
                    <td><button className="rst" title="Hapus baris" onClick={() => setOn((a) => a.filter((_, j) => j !== i))}>×</button></td></tr>);
                })}
                {!onRows.length && <tr><td className="l mut" colSpan={7}>Belum ada program ON faktur. Di web asli diisi otomatis dari Excel program; di sini tambahkan manual.</td></tr>}
                <tr><td className="l"><b>Total benefit ON faktur</b></td>{cv('on', 'min') && <td />}{cv('on', 'sat') && <td />}{cv('on', 'dis') && <td />}{cv('on', 'pot') && <td><b><Ed v={onPot} auto={onPotAuto} unit="Rp" set={setOv('onpot')} /></b></td>}{cv('on', 'ambil') && <td />}<td /></tr>
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 6 }}><button className="btn sm" onClick={() => setOn((a) => [...a, { n: '', min: 0, sat: '', dis: '', pot: 0, ambil: '' }])}>+ tambah program ON</button></div>
          </>)}

          {show.kes && (<>
            <h4>Kesimpulan pengambilan kunjungan</h4>
            <table>
              <tbody>
                <tr><td className="l">Target per kunjungan</td><td><Ed v={kTgt} auto={r.per100} unit={unit} dec={2} set={setOv('k_tgt')} /></td></tr>
                <tr><td className="l">Minimal rekomendasi ({r.minPct}%)</td><td><Ed v={kMin} auto={r.per70} unit={unit} dec={2} set={setOv('k_min')} /></td></tr>
                <tr><td className="l"><b>Total pengambilan di kunjungan ini</b></td><td className="blank"><b><Ed v={ambil} auto={ambilAuto} unit={unit} dec={2} set={setOv('ambil')} /></b></td></tr>
                <tr><td className="l">Selisih terhadap minimal</td><td className={ambil > 0 ? (ambil >= kMin ? 'ok' : 'low') : 'mut'}>{ambil > 0 ? (ambil - kMin >= 0 ? '+' : '') + jtf(ambil - kMin, 2) : '-'}</td></tr>
                <tr><td className="l">Status</td><td><span className={'tag ' + (status[1] === 'mut' ? 'y' : status[1])}>{status[0]}</span></td></tr>
              </tbody>
            </table>
          </>)}

          {nShown > 0 && (show.off || show.rec || show.on) && (
            <div className="totbar"><span>Estimasi total benefit program</span><b><Ed v={totBen} auto={totBenAuto} unit="Rp" set={setOv('tot')} /></b></div>
          )}
          {show.wajib && (<><h4>Item unggulan wajib</h4><div style={{ textAlign: 'center' }}><Ed text v={e.contract?.wajib || ''} auto="" set={(x) => patch((c) => ({ ...c, contract: { ...(c.contract || {}), wajib: x ?? '' } }))} /></div></>)}
          {show.sig && <div className="sig"><div>Salesman</div><div>SAC</div><div>Branch Head</div><div>{r.name.slice(0, 18)}</div></div>}
          {r.edited && <div style={{ textAlign: 'center', marginTop: 8 }}><button className="btn sm" onClick={() => patch(() => ({}))}>Kembalikan toko ini ke suggest</button></div>}
        </div>
      </div>
    </>
  );
}

export default function ItgV2({ demo }) {
  const [parsed, setParsed] = useState(demo.parsed);
  const [stores, setStores] = useState(() => new Map(demo.stores.map((s) => [s.id, s])));
  const [edits, setEdits] = useState(() => lsGet('itgv2_edits', {}));
  const [settings, setSettings] = useState(() => lsGet('itgv2_settings', { basis: 'visit', pct: 100, classPct: { ...DEFAULT_PCT }, unit: 'jt', show: {} }));
  const [fs, setFs] = useState('ALL'), [fc, setFc] = useState('ALL'), [ft, setFt] = useState('ALL'), [fd, setFd] = useState('ALL'), [fdt, setFdt] = useState('');
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('toko');
  const [err, setErr] = useState('');
  const time = useMemo(() => nowTime(parsed.months), [parsed]);
  const [date, setDate] = useState(() => `${time.y}-${pad(time.m)}-${pad(Math.min(time.d, time.last))}`);
  const fileRef = useRef(null);
  useEffect(() => lsSet('itgv2_edits', edits), [edits]);
  useEffect(() => lsSet('itgv2_settings', settings), [settings]);
  const unit = settings.unit || 'jt';
  const tc = (k) => settings.tcols?.[k] !== false;
  const C = useMemo(() => computeItg2(parsed, stores, time, edits, settings), [parsed, stores, time, edits, settings]);
  const patchOf = (id) => (fn) => setEdits((o) => { const nx = fn({ ...(o[id] || {}) }); const n = { ...o }; if (Object.keys(nx).length) n[id] = nx; else delete n[id]; return n; });
  const setS = (p) => setSettings((o) => ({ ...o, ...p }));
  const [m1, m2] = parsed.months;

  const rows = C.rows.filter((r) => (fs === 'ALL' || r.sales === fs) && (fc === 'ALL' || r.cls === fc) && (ft === 'ALL' || r.status === ft) && (fd === 'ALL' || r.wdays.includes(+fd)) && (!fdt || r.vdays.includes(+fdt.slice(8)))).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const T = C.rows.reduce((a, r) => a + r.T, 0), A = C.rows.reduce((a, r) => a + r.A, 0), RW = C.rows.reduce((a, r) => a + r.reward, 0);
  const salesList = [...new Set(C.rows.map((r) => r.sales))], clsList = [...new Set(C.rows.map((r) => r.cls))];
  const byCls = clsList.map((c) => { const x = C.rows.filter((r) => r.cls === c); return { c, n: x.length, T: x.reduce((a, r) => a + r.T, 0), A: x.reduce((a, r) => a + r.A, 0) }; });
  const bySales = salesList.map((s) => { const x = C.rows.filter((r) => r.sales === s); return { s, n: x.length, T: x.reduce((a, r) => a + r.T, 0), A: x.reduce((a, r) => a + r.A, 0), ok: x.filter((r) => r.status === 'tercapai').length }; });
  const nEdit = Object.keys(edits).length;
  const showOf = (r) => ({ off: true, hist: true, rec: true, on: true, kes: true, wajib: true, sig: true, ...(settings.show || {}), ...(r.e.show || {}), cols: { ...((settings.show || {}).cols || {}), ...((r.e.show || {}).cols || {}) } });
  const setGlobalShow = (sh) => setS({ show: { ...sh } });
  const applyShow = (sh) => setEdits((o) => { const n = { ...o }; for (const r of rows) { const cur = { ...(n[r.id] || {}) }; cur.show = { ...sh }; n[r.id] = cur; } return n; });
  const [pdfBusy, setPdfBusy] = useState('');
  const downloadPdf = async (list, name) => {
    setPdfBusy('Menyusun PDF...');
    try {
      const { makeItgContractPdf } = await import('../lib/contractPdf2.js');
      makeItgContractPdf(list.map((r) => ({ r, show: showOf(r) })), { unit, months: parsed.months, tg: time.tg, depot: parsed.meta?.depo || '', file: name || `Kontrak-ITG-${list.length}-toko`, orientation: settings.paper === 'landscape' ? 'landscape' : 'portrait' });
    } catch (e) { window.alert('Gagal membuat PDF: ' + (e?.message || e)); }
    setPdfBusy('');
  };
  const selRow = C.rows.find((r) => r.id === sel);
  const mi = C.mi;
  const classDiff = C.rows.filter((r) => r.classDiff).length;

  async function onFile(f) {
    setErr('');
    try { const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellFormula: false }); setParsed(parseItg2(wb, { fileName: f.name })); setSel(null); } catch (e) { setErr(e.message || String(e)); }
  }

  // DAP ITG: toko yang dikunjungi di tanggal itu, dikelompokkan per salesman
  const dapDay = +date.slice(8);
  const dap = useMemo(() => {
    const [yy, mm] = date.split('-').map(Number);
    const by = {};
    for (const r of C.rows) {
      const days = r.route ? visitDays(parseRoute(r.route), yy, mm, []) : [];
      if (!days.includes(dapDay)) continue;
      const rem = Math.max(1, days.filter((d) => d >= dapDay).length);
      const act = mi === 0 ? r.a1 : r.a2;
      (by[r.sales] ||= []).push({ r, rem, act, tgtAuto: Math.round((r.per100 * (settings.pct ?? 100)) / 100), planAuto: Math.max(0, Math.round((r.tMonth - act) / rem)) });
    }
    return Object.entries(by).map(([s, list]) => ({ s, list: list.sort((a, b) => b.tgtAuto - a.tgtAuto) }));
  }, [C, date, dapDay, mi, settings.pct]);

  return (
    <div className="iv" data-theme={undefined}>
      <div className="top">
        <div className="logo">IT</div>
        <div><h1>ITG · {parsed.meta.depo || 'Depo'} · {m1.label}–{m2?.label} {m1.y}</h1><div className="sub">{parsed.items.length} toko · file {parsed.fileName || 'Excel ITG'}{parsed.meta.period ? ` · OLAP ${parsed.meta.period}` : ''} · data sampai H-1</div></div>
        <div className="grow" />
        <div className="seg">{['jt', 'Rp'].map((u) => <button key={u} className={unit === u ? 'on' : ''} onClick={() => setS({ unit: u })}>{u}</button>)}</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
        <div className="seg" title="Arah kertas PDF kontrak">{[['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([v, l]) => <button key={v} className={(settings.paper || 'portrait') === v ? 'on' : ''} onClick={() => setS({ paper: v })}>{l}</button>)}</div>
        <button className="btn coin" disabled={!rows.length || !!pdfBusy} onClick={() => downloadPdf(rows)}>{pdfBusy || `Unduh PDF (${rows.length} kontrak)`}</button>
        <button className="btn pri" onClick={() => fileRef.current?.click()}>Upload Excel ITG</button>
        {nEdit > 0 && <button className="btn" onClick={() => window.confirm('Kembalikan semua angka ke suggest?') && setEdits({})}>Reset {nEdit} toko yang diubah</button>}
      </div>
      {err && <div className="warn">{err}</div>}
      {parsed.warnings.map((w) => <div key={w} className="warn">{w}</div>)}
      {classDiff > 0 && <div className="warn">{classDiff} toko punya class di JKS yang berbeda dari kolom Class di Excel ITG. Class dari JKS yang dipakai (bisa diubah di tabel).</div>}

      <div className="kpis">
        <div className="kpi" style={{ '--k': '#4f94a6' }}><div className="l">Toko ITG</div><div className="v">{C.rows.length}</div><div className="s">{C.rows.filter((r) => r.status === 'tercapai').length} tercapai · {C.rows.filter((r) => r.status === 'berjalan').length} berjalan</div></div>
        <div className="kpi" style={{ '--k': '#f0a77c' }}><div className="l">Target 2 bulan</div><div className="v">{jtf(T)}<small>jt</small></div><div className="s">persis dari Excel ITG</div></div>
        <div className="kpi" style={{ '--k': '#7aa89a' }}><div className="l">Actual {m1.label}{m2 && C.rows.some((r) => r.a2) ? ` + ${m2.label}` : ''}</div><div className="v">{jtf(A)}<small>jt</small></div><div className="s">dari kolom Actual{parsed.meta.olap ? ' / OLAP' : ''}</div></div>
        <div className="kpi" style={{ '--k': 'var(--ac)' }}><div className="l">Achievement</div><div className="v">{T ? pcf(A / T) : '-'}</div><div className="s">timegone {pcf(time.tg)} · gap {jtf(Math.max(0, T - A))} jt</div><div className="bar"><i style={{ width: Math.min(100, (T ? A / T : 0) * 100) + '%' }} /></div></div>
        <div className="kpi" style={{ '--k': '#d98b6a' }}><div className="l">{parsed.meta?.rewardCol ? `Reward ${(settings.rwMode || 'dua') === 'bulan' ? 'sebulan' : 'total 2 bulan'}` : 'Potensi cashback'}</div><div className="v">{jtf(RW, 1)}<small>jt</small></div><div className="s">Rp {rpf(RW)} {parsed.meta?.rewardCol ? '· kolom Reward di Excel ITG' : '· % class × target 2 bulan'}</div></div>
      </div>

      <div className="ctl">
        <span className="lbl">Dasar target</span>
        <div className="seg">{[['visit', 'Per kunjungan'], ['bulan', 'Sebulan'], ['dua', 'Dua bulan']].map(([v, l]) => <button key={v} className={settings.basis === v ? 'on' : ''} onClick={() => setS({ basis: v })}>{l}</button>)}</div>
        <span className="lbl">Basis</span>
        <div className="seg">{[100, 90, 80, 70].map((v) => <button key={v} className={(settings.pct ?? 100) === v ? 'on' : ''} onClick={() => setS({ pct: v })}>{v}%</button>)}</div>
        <label className="mut" style={{ fontWeight: 600 }}>Minimal <input type="number" style={{ width: 54 }} value={settings.minPct ?? 70} onChange={(e) => setS({ minPct: +e.target.value || 70 })} />%</label>
        {parsed.meta?.rewardCol && (<>
          <span className="lbl">Reward</span>
          <div className="seg">{[['dua', 'Total 2 bulan', parsed.meta.rewardCols?.two], ['bulan', 'Sebulan', parsed.meta.rewardCols?.one]].map(([v, l, ok]) => <button key={v} disabled={!ok} title={ok ? '' : 'Kolom ini tidak ada di Excel ITG'} className={(settings.rwMode || 'dua') === v ? 'on' : ''} onClick={() => setS({ rwMode: v })}>{l}</button>)}</div>
        </>)}
        <span className="lbl">Cashback</span>
        {Object.keys(DEFAULT_PCT).filter((c) => c !== 'Small').map((c) => <label key={c} className="mut" style={{ fontWeight: 600 }}>{c} <input type="number" step="0.25" style={{ width: 56 }} value={settings.classPct?.[c] ?? DEFAULT_PCT[c]} onChange={(e) => setS({ classPct: { ...(settings.classPct || {}), [c]: +e.target.value } })} />%</label>)}
        <div className="grow" />
        <div className="seg">{[['toko', 'Toko ITG'], ['kontrak', 'Kontrak'], ['dap', 'DAP ITG'], ['rekap', 'Rekap']].map(([v, l]) => <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
      </div>

      {(tab === 'toko' || tab === 'kontrak') && (
        <div className="ctl">
          <span className="lbl">Filter</span>
          <select value={fs} onChange={(e) => setFs(e.target.value)}><option value="ALL">Semua salesman</option>{salesList.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={fd} onChange={(e) => { setFd(e.target.value); setFdt(''); }}><option value="ALL">Semua hari kunjungan</option>{['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((h, i) => <option key={h} value={i + 1}>{h}</option>)}</select>
          <label className="mut" style={{ fontWeight: 600 }}>atau tanggal <input type="date" value={fdt} onChange={(e) => { setFdt(e.target.value); setFd('ALL'); }} /></label>
          <select value={fc} onChange={(e) => setFc(e.target.value)}><option value="ALL">Semua class</option>{clsList.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={ft} onChange={(e) => setFt(e.target.value)}><option value="ALL">Semua status</option><option>tercapai</option><option>berjalan</option><option>gagal syarat</option></select>
          {(fs !== 'ALL' || fd !== 'ALL' || fdt || fc !== 'ALL' || ft !== 'ALL') && <button className="btn sm" onClick={() => { setFs('ALL'); setFd('ALL'); setFdt(''); setFc('ALL'); setFt('ALL'); }}>Hapus filter</button>}
          <span className="grow" />
          <span className="tag b">{rows.length} kontrak sesuai filter</span>
        </div>
      )}

      {tab === 'toko' && (
        <div className={'work' + (selRow ? ' open' : '')}>
          <div className="card fade">
            <div className="h">Toko ITG · {rows.length}{fd !== 'ALL' ? ` · hari ${['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][+fd]}` : ''}
            </div>
            <details className="cols" style={{ padding: '4px 12px 6px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 11.5, color: 'var(--mute)' }}>Kolom tabel ini (pilih yang tampil)</summary>
              <span className="chips" style={{ marginTop: 6 }}>{[['sales', 'Salesman'], ['cls', 'Class'], ['visits', 'Kunjungan'], ['T', 'Target 2 bln'], ['t1', `Target ${m1.label}`], ['t2', `Target ${m2?.label}`], ['a1', `Act ${m1.label}`], ['a2', `Act ${m2?.label}`], ['p1', `% ${m1.label}`], ['p2', `% ${m2?.label}`], ['pt', '% Total'], ['status', 'Status'], ['tUsed', 'Target dipakai'], ['cb', 'Cashback']].map(([k, l]) => <label key={k} className={'tog' + (tc(k) ? ' on' : '')}><input type="checkbox" checked={tc(k)} onChange={() => setS({ tcols: { ...(settings.tcols || {}), [k]: !tc(k) } })} />{l}</label>)}</span>
            </details>
            <div className="scroll"><table>
              <thead><tr><th className="l">Toko</th>{tc('sales') && <th className="l">Salesman</th>}{tc('cls') && <th className="l">Class</th>}{tc('visits') && <th title="Kunjungan per bulan (dari JKS)">Kunj</th>}{tc('T') && <th>Target 2 bln</th>}{tc('t1') && <th>Target {m1.label}</th>}{tc('t2') && <th>Target {m2?.label}</th>}{tc('a1') && <th>Act {m1.label}</th>}{tc('a2') && <th>Act {m2?.label}</th>}{tc('p1') && <th>% {m1.label}</th>}{tc('p2') && <th>% {m2?.label}</th>}{tc('pt') && <th>% Total</th>}{tc('status') && <th className="l">Status</th>}{tc('tUsed') && <th title="Target sesuai pilihan Dasar target">Target dipakai</th>}{tc('cb') && <th title="% class × target 2 bulan">{parsed.meta?.rewardCol ? ((settings.rwMode || 'dua') === 'bulan' ? 'Reward 1 bln (Rp)' : 'Reward 2 bln (Rp)') : 'Cashback (Rp)'}</th>}<th /></tr></thead>
              <tbody>{rows.map((r) => {
                const p = patchOf(r.id);
                return (
                  <tr key={r.id} className={r.id === sel ? 'sel' : ''} onClick={() => setSel(r.id === sel ? null : r.id)}>
                    <td className="l nm" title={r.name + ' · ' + r.id}>{r.name}<br /><small>{r.id}</small></td>
                    {tc('sales') && (<td className="l" onClick={(e) => e.stopPropagation()}><Ed text v={r.sales} auto={r.e.sales === undefined ? r.sales : (parsed.items.find((i) => i.id === r.id)?.sales || '')} set={(x) => p((c) => { if (x === undefined) { const n = { ...c }; delete n.sales; return n; } return { ...c, sales: x }; })} /></td>)}
                    {tc('cls') && (<td className="l" onClick={(e) => e.stopPropagation()}><select value={r.cls} onChange={(e) => p((c) => ({ ...c, cls: e.target.value }))}>{[...new Set([r.cls, 'Small', 'Medium', 'Big', 'Superbig'])].map((x) => <option key={x}>{x}</option>)}</select>{r.classDiff && <span className="tag y" title={`Excel ITG: ${r.tplClass}`}>≠</span>}</td>)}
                    {tc('visits') && (<td onClick={(e) => e.stopPropagation()}><Ed int v={r.visits} auto={r.auto.visits} unit={unit} set={(x) => p((c) => ({ ...c, visits: x }))} /><small> {r.freq === 'mingguan' ? 'w' : r.freq === '2 mingguan' ? '2w' : ''}</small></td>)}
                    {tc('T') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.T} auto={r.auto.T} unit={unit} set={(x) => p((c) => ({ ...c, T: x }))} /></td>)}
                    {tc('t1') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.t1} auto={r.auto.t1} unit={unit} set={(x) => p((c) => ({ ...c, t1: x }))} /></td>)}
                    {tc('t2') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.t2} auto={r.auto.t2} unit={unit} set={(x) => p((c) => ({ ...c, t2: x }))} /></td>)}
                    {tc('a1') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.a1} auto={r.auto.a1} unit={unit} set={(x) => p((c) => ({ ...c, a1: x }))} /></td>)}
                    {tc('a2') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.a2} auto={r.auto.a2} unit={unit} set={(x) => p((c) => ({ ...c, a2: x }))} /></td>)}
                    {tc('p1') && (<td className={pace(r.p1, mi === 0 ? time.tg : 1)} onClick={(e) => e.stopPropagation()}><Ed pct v={Math.round((r.p1 || 0) * 1000) / 10} auto={Math.round(((r.auto.a1 / (r.auto.t1 || 1)) || 0) * 1000) / 10} set={(x) => p((c) => { const n = { ...c }; if (x === undefined) delete n.a1; else n.a1 = Math.round((x / 100) * r.t1); return n; })} />%</td>)}
                    {tc('p2') && (<td className={pace(r.p2, mi === 1 ? time.tg : 0)} onClick={(e) => e.stopPropagation()}>{r.a2 || r.t2 ? <><Ed pct v={Math.round((r.p2 || 0) * 1000) / 10} auto={Math.round(((r.auto.a2 / (r.auto.t2 || 1)) || 0) * 1000) / 10} set={(x) => p((c) => { const n = { ...c }; if (x === undefined) delete n.a2; else n.a2 = Math.round((x / 100) * r.t2); return n; })} />%</> : '-'}</td>)}
                    {tc('pt') && (<td className={pace(r.total, (mi + time.tg) / parsed.months.length)}>{pcf(r.total)}</td>)}
                    {tc('status') && (<td className="l"><span className={'tag ' + (r.status === 'tercapai' ? 'g' : r.status === 'gagal syarat' ? 'r' : 'y')}>{r.status}</span></td>)}
                    {tc('tUsed') && (<td onClick={(e) => e.stopPropagation()}><Ed v={r.tUsed} auto={r.tUsedAuto} unit={unit} dec={2} set={(x) => p((c) => ({ ...c, tUsed: x }))} /></td>)}
                    {tc('cb') && (<td onClick={(e) => e.stopPropagation()}><b><Ed v={r.reward} auto={r.rewardAuto} unit="Rp" set={(x) => p((c) => ({ ...c, reward: x }))} /></b><br /><small><Ed pct v={r.cpct} auto={r.auto.cpct} set={(x) => p((c) => ({ ...c, cpct: x }))} />% × target 2 bln</small></td>)}
                    <td><button className="btn sm pri" onClick={(e) => { e.stopPropagation(); setSel(r.id); }}>Kontrak ›</button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            <div className="mut" style={{ padding: '6px 12px', fontSize: 11.5 }}>Klik angka untuk mengubah (oranye = diubah, ↺ = kembali ke suggest). Klik “Kontrak ›” (atau barisnya) untuk melihat dan mengedit kontrak toko; tab “Kontrak” menampilkan satu toko penuh dengan tombol sebelumnya / berikutnya. Warna persen: hijau = sesuai atau di atas laju timegone, kuning = sampai 70% dari laju, merah = di bawahnya.</div>
          </div>
          {selRow && <div className="pw"><Contract r={selRow} onPdf={() => downloadPdf([selRow], `Kontrak-ITG-${selRow.id}`)} unit={unit} months={parsed.months} patch={patchOf(selRow.id)} onClose={() => setSel(null)} show={showOf(selRow)} setGlobalShow={setGlobalShow} applyShow={applyShow} nFilter={rows.length} hm={demo.histMeta} tg={time.tg} /></div>}
        </div>
      )}

      {tab === 'kontrak' && (() => {
        const cid = rows.some((r) => r.id === sel) ? sel : rows[0]?.id;
        const ci = rows.findIndex((r) => r.id === cid);
        const cr = rows[ci];
        return (
          <div className="fade">
            <div className="ctl">
              <span className="lbl">Toko</span>
              <select style={{ maxWidth: 320 }} value={cid || ''} onChange={(e) => setSel(e.target.value)}>{rows.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.sales.split(' ')[0]}{r.edited ? ' ✎' : ''}</option>)}</select>
              <button className="btn sm" disabled={ci <= 0} onClick={() => setSel(rows[ci - 1].id)}>‹ Sebelumnya</button>
              <button className="btn sm" disabled={ci < 0 || ci >= rows.length - 1} onClick={() => setSel(rows[ci + 1].id)}>Berikutnya ›</button>
              <span className="mut">{ci + 1} dari {rows.length} toko (mengikuti filter di atas: salesman, hari kunjungan, tanggal). Semua angka di kertas bisa diklik dan diedit.</span>
            </div>
            {cr ? <div style={{ maxWidth: 760, margin: '0 auto' }}><Contract r={cr} onPdf={() => downloadPdf([cr], `Kontrak-ITG-${cr.id}`)} unit={unit} months={parsed.months} patch={patchOf(cr.id)} show={showOf(cr)} setGlobalShow={setGlobalShow} applyShow={applyShow} nFilter={rows.length} hm={demo.histMeta} tg={time.tg} /></div> : <div className="warn">Tidak ada toko.</div>}
          </div>
        );
      })()}

      {tab === 'rekap' && (
        <div className="two fade">
          <div className="card"><div className="h">Per class</div><table><thead><tr><th className="l">Class</th><th>Toko</th><th>Target</th><th>Actual</th><th>% vs target</th></tr></thead><tbody>{byCls.map((x) => <tr key={x.c}><td className="l"><b>{x.c}</b></td><td>{x.n}</td><td>{jtf(x.T)}</td><td>{jtf(x.A)}</td><td className={cls(x.T ? x.A / x.T : null)}>{pcf(x.T ? x.A / x.T : null)}<div className="bar"><i style={{ width: Math.min(100, (x.T ? x.A / x.T : 0) * 100) + '%' }} /></div></td></tr>)}</tbody></table></div>
          <div className="card"><div className="h">Per salesman (nama dari Excel ITG)</div><table><thead><tr><th className="l">Salesman</th><th>Toko</th><th>Target</th><th>Actual</th><th>%</th><th>Tercapai</th></tr></thead><tbody>{bySales.map((x) => <tr key={x.s}><td className="l"><b>{x.s}</b></td><td>{x.n}</td><td>{jtf(x.T)}</td><td>{jtf(x.A)}</td><td className={cls(x.T ? x.A / x.T : null)}>{pcf(x.T ? x.A / x.T : null)}</td><td>{x.ok}/{x.n}</td></tr>)}</tbody></table></div>
        </div>
      )}

      {tab === 'dap' && (
        <div className="fade">
          <div className="ctl"><span className="lbl">Tanggal DAP</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><span className="mut">Toko ITG yang dijadwalkan dikunjungi di tanggal ini (dari JKS). Semua kolom bisa diedit; suggest = target ÷ kunjungan.</span></div>
          {!dap.length && <div className="warn">Tidak ada toko ITG yang dijadwalkan di tanggal ini.</div>}
          {dap.map(({ s, list }) => (
            <div className="card" key={s} style={{ marginBottom: 10 }}>
              <div className="h">DAP {s} · {list.length} toko ITG · Target {jtf(list.reduce((a, x) => a + (x.r.e.dap?.[date]?.tgt ?? x.tgtAuto), 0), 2)} jt</div>
              <div className="scroll"><table>
                <thead><tr><th className="l">#</th><th className="l">Toko</th><th className="l">Class</th><th>Target / kunj</th><th>Actual MTD</th><th>% Ach</th><th>Sisa kunj</th><th>PLAN</th><th className="l">Promo</th><th className="l">Order</th><th className="l">Catatan</th></tr></thead>
                <tbody>{list.map(({ r, rem, act, tgtAuto, planAuto }, i) => {
                  const d = r.e.dap?.[date] || {};
                  const setD = (k) => (x) => patchOf(r.id)((c) => { const dd = { ...(c.dap || {}) }; const cur = { ...(dd[date] || {}) }; if (x === undefined) delete cur[k]; else cur[k] = x; if (Object.keys(cur).length) dd[date] = cur; else delete dd[date]; const n = { ...c, dap: dd }; if (!Object.keys(dd).length) delete n.dap; return n; });
                  return (
                    <tr key={r.id}><td className="l">{i + 1}</td><td className="l nm" title={r.name}>{r.name}</td><td className="l">{r.cls}</td>
                      <td><Ed v={d.tgt ?? tgtAuto} auto={tgtAuto} unit={unit} dec={2} set={setD('tgt')} /></td><td><Ed v={act} auto={mi === 0 ? r.auto.a1 : r.auto.a2} unit={unit} dec={2} set={(x) => patchOf(r.id)((c) => { const n = { ...c }; const k = mi === 0 ? 'a1' : 'a2'; if (x === undefined) delete n[k]; else n[k] = x; return n; })} /></td><td className={pace(r.tMonth ? act / r.tMonth : null, time.tg)}>{pcf(r.tMonth ? act / r.tMonth : null)}</td><td><Ed int v={d.rem ?? rem} auto={rem} unit={unit} set={setD('rem')} /></td>
                      <td><Ed v={d.plan ?? planAuto} auto={planAuto} unit={unit} dec={2} set={setD('plan')} /></td>
                      <td className="l"><Ed text v={d.promo ?? ''} auto="" set={setD('promo')} /></td><td className="l"><Ed text v={d.order ?? ''} auto="" set={setD('order')} /></td><td className="l"><Ed text v={d.note ?? ''} auto="" set={setD('note')} /></td></tr>
                  );
                })}</tbody>
              </table></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
