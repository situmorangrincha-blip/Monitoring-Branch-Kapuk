import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TABLES, Ed, ProgTablesSettings, ProgTablesView, lsGet, lsSet } from './ItgV2.jsx';
import { TEXT_FIELDS, catalogPrograms, effectiveRows, rowsForTable, storeOwnsPt, wilayahOf } from '../lib/itgProg.js';
import { makeCtx, programsForStore } from '../lib/progcat.js';
import { keyLabel } from '../lib/scup.js';
import { scupContractView } from '../lib/scupContract.js';
import { makeScupContractPdf } from '../lib/contractPdfScup.js';
import './itgv2.css';

// Kontrak ITG Supercup per outlet. Tampilan edit dan template dibuat sama dengan kontrak ITG Arjuna:
// pengaturan umum untuk semua outlet, "Khusus toko ini" untuk pengecualian, dan tabel program dari katalog.
const SHOW_LABEL = [['scup', 'ITG Supercup'], ['on', 'Tabel program'], ['wajib', 'Item wajib'], ['sig', 'Tanda tangan']];
const COLS = {
  scup: [['target', 'Target'], ['actual', 'Actual'], ['pct', '%'], ['gap', 'Gap'], ['benefit', 'Benefit'], ['reward', 'Reward']],
  on: [['min', 'Min order'], ['sat', 'Satuan'], ['dis', 'Diskon'], ['pot', 'Benefit toko'], ['ambil', 'Pengambilan']],
};
const TITLE = { scup: 'Kolom Supercup', on: 'Kolom tabel program' };
const DEF_SHOW = { scup: true, on: true, wajib: false, sig: true };
const rpf = (n) => Math.round(n || 0).toLocaleString('id-ID');
const jtf = (n) => ((n || 0) / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const ctn = (n) => (n == null || !Number.isFinite(n) ? '-' : Number(+n.toFixed(1)).toLocaleString('id-ID', { maximumFractionDigits: 1 }));
const clsOf = (v) => (v == null ? 'mut' : v >= 1 ? 'ok' : v >= 0.7 ? 'mid' : 'low');

// gabungkan katalog beberapa tim (kode program yang sama: yang pertama dipakai)
function mergeCats(list) {
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const rows = [], codes = new Set(), strata = [], sk = new Set(), peserta = [];
  for (const c of list) {
    const mine = new Set();
    for (const r of c.rows || []) { const k = String(r['Kode Program']); if (codes.has(k)) continue; mine.add(k); rows.push(r); }
    for (const k of mine) codes.add(k);
    for (const x of c.strata || []) { const k = `${x.Program}|${x.Wilayah}|${x.Dari}`; if (!sk.has(k)) { sk.add(k); strata.push(x); } }
    for (const x of c.peserta || []) peserta.push(x);
  }
  return { rows, strata, peserta };
}

export default function ScupContractPage({ data, parsed, depot, team, cfg, C, rows, unit, setE, teams = [], loadCatalog, orient = 'portrait' }) {
  const SK = `${depot}_${team}`;
  const kS = `sm_scupk_settings_${SK}`, kE = `sm_scupk_edits_${SK}`, kSel = `sm_scupk_sel_${SK}`;
  const [set, setSet] = useState(() => ({ progTables: DEFAULT_TABLES, ...lsGet(kS, {}) }));
  const [ce, setCe] = useState(() => lsGet(kE, {}));
  const [selId, setSelId] = useState(() => lsGet(kSel, ''));
  const [extra, setExtra] = useState({});
  useEffect(() => lsSet(kS, set), [set]); // eslint-disable-line
  useEffect(() => lsSet(kE, ce), [ce]); // eslint-disable-line
  useEffect(() => lsSet(kSel, selId), [selId]); // eslint-disable-line

  // katalog program: tim ini dan/atau tim lain di depo yang sama (pilihan lu)
  const catTeams = set.catTeams || [team];
  const catKey = catTeams.join('|');
  useEffect(() => {
    for (const t of catTeams) {
      if (t === team || t in extra || !loadCatalog) continue;
      setExtra((o) => ({ ...o, [t]: undefined }));
      loadCatalog(t).then((c) => setExtra((o) => ({ ...o, [t]: c || null }))).catch(() => setExtra((o) => ({ ...o, [t]: null })));
    }
  }, [catKey]); // eslint-disable-line
  const catalog = useMemo(() => mergeCats(catTeams.map((t) => (t === team ? data.progcat : extra[t])).filter(Boolean)), [data.progcat, extra, catKey]); // eslint-disable-line
  const hasCatalog = !!catalog?.rows?.length;
  const ctx = useMemo(() => (hasCatalog ? makeCtx({ itgList: { items: parsed.items.map((i) => ({ id: i.id })) }, progcat: catalog, promos: [] }) : null), [hasCatalog, catalog, parsed]);
  const progList = useMemo(() => catalogPrograms(catalog), [catalog]);
  const wilayah = useMemo(() => wilayahOf(catalog), [catalog]);
  const tables = set.progTables || DEFAULT_TABLES;
  const tpl = set.ptTpl || {};
  const stBy = useMemo(() => new Map(data.stores.map((s) => [s.id, s])), [data.stores]);
  const progCount = useMemo(() => {
    const m = {};
    if (!hasCatalog) return m;
    for (const p of progList) if (p.strata) m[p.code] = rows.length;
    for (const r of rows) { const st = stBy.get(r.id); if (!st) continue; for (const g of programsForStore({ progcat: catalog, itgList: null, promos: [] }, st, ctx)) m[g.code] = (m[g.code] || 0) + 1; }
    return m;
  }, [hasCatalog, catalog, ctx, rows, stBy, progList]);

  const setTables = (fn) => setSet((o) => ({ ...o, progTables: fn(o.progTables || DEFAULT_TABLES) }));
  const setTplFn = (tid, fn) => setSet((o) => ({ ...o, ptTpl: { ...(o.ptTpl || {}), [tid]: fn({ ...((o.ptTpl || {})[tid] || {}) }) } }));
  const setGShow = (fn) => setSet((o) => ({ ...o, show: fn({ ...(o.show || {}) }) }));
  const showOf = (id) => { const e = ce[id] || {}; const sh = { ...DEF_SHOW, ...(set.show || {}), ...(e.show || {}) }; sh.cols = { ...((set.show || {}).cols || {}), ...((e.show || {}).cols || {}) }; return sh; };
  const ptFor = (r) => { const st = stBy.get(r.id); return tables.filter((t) => t.on !== false).map((t) => ({ tbl: t, gen: hasCatalog && st ? rowsForTable(t, catalog, ctx, st) : [] })); };
  const ptEff = (r) => ptFor(r).map((x) => ({ tbl: x.tbl, gen: x.gen, rows: effectiveRows(x.gen, ce[r.id]?.contract?.pt?.[x.tbl.id], tpl[x.tbl.id]) }));
  const wajibOf = (r) => ce[r.id]?.contract?.wajib ?? set.wajib ?? '';
  const periode = `${keyLabel(C.qMonths[0])} - ${keyLabel(C.qMonths[2])}`;

  // jadikan pengaturan dan isi tabel program toko ini sebagai pengaturan umum (benefit dan pengambilan tetap per toko)
  const adoptAll = ({ sh, wajib, storeId, tabs }) => {
    const uid = () => 'e' + Math.random().toString(36).slice(2, 8);
    const keyOf = (gen, k) => { const g = gen.find((x) => x.key === k || x.lkey === k); return g ? g.key : k; };
    const addPerStore = {};
    const nt = { ...(set.ptTpl || {}) };
    for (const { tid, gen, st } of tabs) {
      const t = { ...(nt[tid] || {}) };
      const hide = { ...(t.hide || {}) }; for (const k of Object.keys(st.hide || {})) hide[keyOf(gen, k)] = 1;
      const ov = { ...(t.ov || {}) };
      for (const [k, v] of Object.entries(st.ov || {})) { const tx = {}; for (const f of TEXT_FIELDS) if (f in v) tx[f] = v[f]; if (Object.keys(tx).length) { const kk = keyOf(gen, k); ov[kk] = { ...(ov[kk] || {}), ...tx }; } }
      const extraRows = [...(t.extra || [])];
      for (const x of st.extra || []) { const id = uid(); extraRows.push({ id, n: x.n || '', min: x.min || '', sat: x.sat || '', dis: x.dis || '' }); (addPerStore[tid] ||= {})['x:' + id] = { pot: x.pot ?? '', ambil: x.ambil ?? '' }; }
      nt[tid] = { ...t, hide, ov, extra: extraRows };
    }
    setSet((o) => ({ ...o, show: { ...sh }, wajib, ptTpl: nt }));
    setCe((o) => {
      const n = {};
      for (const [id, e] of Object.entries(o)) {
        const c = { ...e }; delete c.show;
        if (c.contract) {
          const ct = { ...c.contract }; delete ct.wajib;
          if (ct.pt) {
            const pt2 = {};
            for (const [tid, t] of Object.entries(ct.pt)) {
              const ov = {};
              for (const [k, v] of Object.entries(t.ov || {})) { const keep = {}; for (const [f, val] of Object.entries(v)) if (!TEXT_FIELDS.includes(f)) keep[f] = val; if (Object.keys(keep).length) ov[k] = keep; }
              if (id === storeId) for (const [k, v] of Object.entries(addPerStore[tid] || {})) { const keep = {}; if (v.pot !== '' && v.pot != null) keep.pot = v.pot; if (v.ambil !== '' && v.ambil != null) keep.ambil = v.ambil; if (Object.keys(keep).length) ov[k] = keep; }
              if (Object.keys(ov).length) pt2[tid] = { ov };
            }
            if (Object.keys(pt2).length) ct.pt = pt2; else delete ct.pt;
          }
          if (Object.keys(ct).length) c.contract = ct; else delete c.contract;
        }
        if (Object.keys(c).length) n[id] = c;
      }
      return n;
    });
  };

  const cid = rows.some((r) => r.id === selId) ? selId : rows[0]?.id;
  const ci = rows.findIndex((r) => r.id === cid);
  const r = rows[ci];

  const pdfOf = (list, file) => {
    const items = list.map((x) => { const show = showOf(x.id); const pt = ptEff(x); return { r: x, show, pt: pt.map(({ tbl, rows: rr }) => ({ tbl, rows: rr })), wajib: wajibOf(x), v: scupContractView(x, cfg, C.qMonths, ce[x.id], show, pt) }; });
    makeScupContractPdf(items, { unit, periode, depot, team, file, orientation: orient });
  };

  if (!rows.length) return <div className="iv"><div className="card mut" style={{ padding: 14 }}>Tidak ada outlet yang cocok dengan filter. Outlet di file Supercup dicocokkan lewat ID toko ke JKS tim ini.</div></div>;

  const e = ce[r.id] || {};
  const show = showOf(r.id);
  const cv = (g, k) => show.cols?.[g + '.' + k] !== false;
  const ptd = e.contract?.pt || {};
  const ptRows = ptEff(r);
  const V = scupContractView(r, cfg, C.qMonths, e, show, ptRows);
  const own = !!e.show || storeOwnsPt(ptd);
  const patch = (fn) => setCe((o) => { const n = fn({ ...(o[r.id] || {}) }); const m = { ...o }; if (n && Object.keys(n).length) m[r.id] = n; else delete m[r.id]; return m; });
  const setOv = (k) => (x) => patch((c) => { const ct = { ...(c.contract || {}) }; const o = { ...(ct.ov || {}) }; if (x === undefined) delete o[k]; else o[k] = x; if (Object.keys(o).length) ct.ov = o; else delete ct.ov; return { ...c, contract: ct }; });
  const setPt = (tid, fn) => patch((c) => { const ct = { ...(c.contract || {}) }; const all = { ...(ct.pt || {}) }; all[tid] = fn({ ...(all[tid] || {}) }); ct.pt = all; return { ...c, contract: ct }; });
  const setShow = (fn) => (own ? patch((c) => ({ ...c, show: fn({ ...(c.show || {}) }) })) : setGShow(fn));
  const wajibV = wajibOf(r);
  const setWajib = (x) => (own ? patch((c) => ({ ...c, contract: { ...(c.contract || {}), wajib: x ?? '' } })) : setSet((o) => ({ ...o, wajib: x ?? '' })));
  const makeOwn = () => patch((c) => ({ ...c, show: { ...show, cols: { ...(show.cols || {}) } } }));
  const backToGeneral = () => patch((c) => {
    const n = { ...c }; delete n.show;
    if (n.contract) {
      const ct = { ...n.contract }; delete ct.wajib;
      if (ct.pt) { const pt2 = {}; for (const [tid, t] of Object.entries(ct.pt)) { const ov = {}; for (const [k, v] of Object.entries(t.ov || {})) { const keep = {}; for (const [f, val] of Object.entries(v)) if (!TEXT_FIELDS.includes(f)) keep[f] = val; if (Object.keys(keep).length) ov[k] = keep; } if (Object.keys(ov).length) pt2[tid] = { ov }; } if (Object.keys(pt2).length) ct.pt = pt2; else delete ct.pt; }
      if (Object.keys(ct).length) n.contract = ct; else delete n.contract;
    }
    return n;
  });
  const toggleCol = (g, k) => setShow((sh) => ({ ...sh, cols: { ...(sh.cols || {}), [g + '.' + k]: !cv(g, k) } }));
  const U = unit === 'jt' ? 'jt' : 'Rp';
  const money = (v) => (unit === 'jt' ? jtf(v) : rpf(v));
  const nPre = ['target', 'actual', 'pct', 'gap', 'benefit'].filter((k) => cv('scup', k)).length;
  const teamsToggle = (
    <div className="ctl" style={{ margin: '8px 0 0' }}>
      <span className="lbl">Katalog program dari tim</span>
      {teams.map((t) => {
        const on = catTeams.includes(t.id), st = t.id === team ? 'ok' : extra[t.id];
        return (
          <label key={t.id} className={'tog' + (on ? ' on' : '')} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={on} onChange={() => setSet((o) => { const cur = o.catTeams || [team]; const nx = cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]; return { ...o, catTeams: nx.length ? nx : [team] }; })} />
            {t.label}{t.id === team ? ' (tim ini)' : ''}{on && t.id !== team ? (st === undefined ? ' (memuat…)' : st === null ? ' (belum ada katalog)' : '') : ''}
          </label>
        );
      })}
      <span className="mut" style={{ fontSize: 11.5 }}>Pilih katalog program ON faktur dari tim mana yang dipakai. Katalog tim lain terbaca kalau sudah di-upload di depo ini.</span>
    </div>
  );

  return (
    <div className="iv fade">
      <div className="ctl">
        <span className="lbl">Outlet</span>
        <select style={{ maxWidth: 320 }} value={cid || ''} onChange={(ev) => setSelId(ev.target.value)}>{rows.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.sales.split(' ')[0]}{ce[x.id] ? ' ✎' : ''}</option>)}</select>
        <button className="btn sm" disabled={ci <= 0} onClick={() => setSelId(rows[ci - 1].id)}>‹ Sebelumnya</button>
        <button className="btn sm" disabled={ci < 0 || ci >= rows.length - 1} onClick={() => setSelId(rows[ci + 1].id)}>Berikutnya ›</button>
        <span className="mut">{ci + 1} dari {rows.length} outlet (mengikuti filter di tab Tabel). Angka di kertas bisa diklik dan diedit.</span>
        <button className="btn sm coin" onClick={() => pdfOf(rows, 'Kontrak-ITG-Supercup')}>Unduh PDF ({rows.length} kontrak)</button>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="card cset">
          <div className="ctl scopebar" style={{ margin: '0 0 8px' }}>
            {own ? (<>
              <span className="tag y">Khusus toko ini</span>
              <span className="mut" style={{ fontSize: 11.5 }}>Pengaturan toko ini berbeda dari pengaturan umum.</span>
              <button className="btn sm" onClick={backToGeneral}>Kembali ke pengaturan umum</button>
              <button className="btn sm pri" onClick={() => adoptAll({ sh: show, wajib: wajibV, storeId: r.id, tabs: ptRows.map((x) => ({ tid: x.tbl.id, gen: x.gen, st: ptd[x.tbl.id] || {} })) })} title="Pengaturan toko ini menjadi pengaturan umum, pengaturan khusus di toko lain dihapus">Jadikan semua toko seperti ini</button>
            </>) : (<>
              <span className="tag g">Pengaturan umum</span>
              <span className="mut" style={{ fontSize: 11.5 }}>Perubahan di sini otomatis berlaku untuk semua outlet.</span>
              <button className="btn sm" onClick={makeOwn} title="Outlet ini boleh berbeda dari pengaturan umum">Khusus toko ini</button>
            </>)}
          </div>
          <div className="ctl" style={{ margin: 0 }}>
            <span className="lbl">Tampilkan di kontrak</span>
            <span className="chips">{SHOW_LABEL.map(([k, l]) => <label key={k} className={'tog' + (show[k] ? ' on' : '')}><input type="checkbox" checked={!!show[k]} onChange={() => setShow((sh) => ({ ...sh, [k]: !show[k] }))} />{l}</label>)}</span>
          </div>
          {Object.keys(COLS).map((g) => (
            <div key={g} className="ctl" style={{ margin: '6px 0 0' }}>
              <span className="lbl">{TITLE[g]}</span>
              <span className="chips">{COLS[g].map(([k, l]) => <label key={k} className={'tog' + (cv(g, k) ? ' on' : '')}><input type="checkbox" checked={cv(g, k)} onChange={() => toggleCol(g, k)} />{l}</label>)}</span>
            </div>
          ))}
          <ProgTablesSettings tables={tables} setTables={setTables} progList={progList} progCount={progCount} wilayah={wilayah} hasCatalog={hasCatalog} extra={teamsToggle} />
          <div className="ctl" style={{ margin: '8px 0 0' }}>
            <button className="btn sm coin" onClick={() => pdfOf([r], 'Kontrak-ITG-Supercup-' + r.name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 30))}>Unduh PDF toko ini</button>
            <span className="mut" style={{ fontSize: 11 }}>Pengaturan ini tidak ikut tercetak di kertas. Reward di kontrak adalah potensi (kalau target tercapai). Harga per ctn dari Omset ÷ Qty per SKU.</span>
          </div>
        </div>

        <div className="card fade paper" key={r.id}>
          <div className="ph">PACKAGE DEVELOPMENT PROGRAM · ITG SUPERCUP · {periode.toUpperCase()}</div>
          <div className="pb">
            <div className="kv"><span>Pelanggan</span><span>{r.name}</span><span>ID</span><span>{r.id}</span><span>Salesman</span><span>{r.sales}</span><span>Jadwal</span><span>{r.hk || '-'}</span></div>
            {!show.scup && !show.on && <div className="warn">Semua tabel disembunyikan. Aktifkan minimal satu di pengaturan di atas kertas.</div>}
            {show.scup && (<>
              <h4>Program ITG Supercup (OFF faktur)</h4>
              <table>
                <thead><tr><th className="l">Program</th>{cv('scup', 'target') && <th>Target (ctn)</th>}{cv('scup', 'actual') && <th>Actual</th>}{cv('scup', 'pct') && <th>%</th>}{cv('scup', 'gap') && <th>Gap</th>}{cv('scup', 'benefit') && <th>Benefit</th>}{cv('scup', 'reward') && <th title="Potensi: reward kalau target tercapai">Reward (potensi)</th>}</tr></thead>
                <tbody>
                  {V.lines.map((l) => (
                    <tr key={l.key}>
                      <td className="l">{l.label}</td>
                      {cv('scup', 'target') && <td>{l.kind === 'm' ? <Ed v={l.T} auto={l.Tauto} dp={1} unit="ctn" set={(x) => setE(r.id, 'T:' + l.mk, x)} /> : l.T == null ? '-' : ctn(l.T)}</td>}
                      {cv('scup', 'actual') && <td>{l.kind === 'm' ? (l.future ? '-' : <Ed v={l.A ?? 0} auto={l.Aauto ?? 0} dp={1} unit="ctn" set={(x) => setE(r.id, 'A:' + l.mk, x)} />) : l.kind === 'q' ? ctn(l.A) : `Rp ${rpf(l.A)}`}</td>}
                      {cv('scup', 'pct') && <td className={clsOf(l.pct)}>{l.pct == null ? '-' : Math.round(l.pct * 100) + '%'}</td>}
                      {cv('scup', 'gap') && <td>{l.gap == null ? '-' : ctn(l.gap)}</td>}
                      {cv('scup', 'benefit') && <td>{l.benefit}</td>}
                      {cv('scup', 'reward') && <td>{l.reward == null ? <span title="Harga per ctn belum ada. Upload Omset dan Qty per SKU.">-</span> : <Ed v={l.reward} auto={l.rewardAuto ?? 0} unit={U} dec={2} set={setOv(l.rk)} />}</td>}
                    </tr>
                  ))}
                  {cv('scup', 'reward') && (
                    <tr className="tot"><td className="l" colSpan={1 + nPre}><b>Total Benefit ITG Supercup</b></td><td><b>{money(V.sumSc)}</b></td></tr>
                  )}
                </tbody>
              </table>
            </>)}

            {show.on && <ProgTablesView ptRows={ptRows} cv={cv} own={own} tpl={tpl} setTpl={setTplFn} setPt={setPt} ptd={ptd} hasCatalog={hasCatalog} />}

            {(show.scup || show.on) && (
              <table className="sumtbl"><tbody>
                {(show.scup || V.offPotAuto > 0) && <tr><td className="l"><b>Total Benefit OFF Faktur</b></td><td><b><Ed v={V.offTot} auto={V.offTotAuto} unit={U} dec={2} set={setOv('offtot')} /></b></td></tr>}
                {show.on && ptRows.some((x) => x.tbl.jenis !== 'OFF') && <tr><td className="l"><b>Total Benefit ON Faktur</b></td><td><b><Ed v={V.onPot} auto={V.onPotAuto} unit="Rp" set={setOv('onpot')} /></b></td></tr>}
              </tbody></table>
            )}
            {(show.scup || show.on) && (
              <div className="totbar"><span>Estimasi total benefit program</span><b><Ed v={V.totBen} auto={V.totBenAuto} unit="Rp" set={setOv('tot')} /></b></div>
            )}
            {show.wajib && (<><h4>Item unggulan wajib</h4><div style={{ textAlign: 'center' }}><Ed text v={wajibV} auto="" set={setWajib} /></div></>)}
            {show.sig && <div className="sig"><div>Salesman</div><div>SAC</div><div>Branch Head</div><div>{r.name.slice(0, 18)}</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
