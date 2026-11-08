import { useEffect, useMemo, useRef, useState } from 'react';

const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const idf = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '-');
export const fm = { n: (v) => idf(v, 0), n1: (v) => idf(v, 1), jt: (v) => idf(v / 1e6, 1), pc: (v) => (v == null || !Number.isFinite(v) ? '-' : idf(v * 100, 0) + '%') };

// Tabel yang bisa diatur: pilih kolom, sembunyikan baris, edit angka langsung, urut, Top N, dan preset.
// cols: [{ k, label, get(row), fmt(v), num, sum, tot(rows, val), cls(v,row), hide, w }]
export default function GTable({ id, title, cols, rows, rowKey, defaultSort, topN = 0, sub, empty = 'Tidak ada data.' }) {
  const key = `sm_gt_${id}`;
  const defName = ls(`${key}_default`, '');
  const presets = ls(`${key}_presets`, {});
  const init = (defName && presets[defName]) || {};
  const [hid, setHid] = useState(init.hid || {});
  const [sort, setSort] = useState(init.sort || defaultSort || null);
  const [top, setTop] = useState(init.top ?? topN);
  const [q, setQ] = useState('');
  const [hrows, setHrows] = useState(ls(`${key}_hrows`, {}));
  const [edits, setEdits] = useState(ls(`${key}_edits`, {}));
  const [pname, setPname] = useState(defName);
  const [cur, setCur] = useState(null);
  const inRef = useRef(null);
  useEffect(() => sv(`${key}_hrows`, hrows), [hrows, key]);
  useEffect(() => sv(`${key}_edits`, edits), [edits, key]);
  const isHid = (c) => (hid[c.k] !== undefined ? hid[c.k] : !!c.hide);
  const vis = cols.filter((c) => !isHid(c));
  const val = (r, c) => { const e = edits[rowKey(r)]?.[c.k]; return e !== undefined ? e : c.get(r); };
  const all = useMemo(() => rows.filter((r) => !hrows[rowKey(r)]), [rows, hrows]); // eslint-disable-line
  const filt = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let a = ql ? all.filter((r) => cols.some((c) => !c.num && String(c.get(r) ?? '').toLowerCase().includes(ql))) : all;
    if (sort) { const c = cols.find((x) => x.k === sort.k); if (c) { a = [...a].sort((x, y) => { const A = val(x, c), B = val(y, c); const cmp = typeof A === 'number' && typeof B === 'number' ? A - B : String(A ?? '').localeCompare(String(B ?? '')); return sort.dir === 'asc' ? cmp : -cmp; }); } }
    return a;
  }, [all, q, sort, edits, cols]); // eslint-disable-line
  const shown = top > 0 ? filt.slice(0, top) : filt;
  const nHid = Object.keys(hrows).filter((k) => rows.some((r) => rowKey(r) === k)).length;
  const nEdit = Object.keys(edits).length;
  const commit = (r, c, raw) => {
    setCur(null);
    const t = String(raw).trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(t);
    setEdits((o) => { const rk = rowKey(r); const row = { ...(o[rk] || {}) }; if (raw === '' || !Number.isFinite(n) || n === c.get(r)) delete row[c.k]; else row[c.k] = n; const nx = { ...o }; if (Object.keys(row).length) nx[rk] = row; else delete nx[rk]; return nx; });
  };
  const savePreset = () => {
    const name = window.prompt('Nama preset:', pname || '');
    if (!name) return;
    const p = { ...ls(`${key}_presets`, {}), [name]: { hid, sort, top } };
    sv(`${key}_presets`, p); setPname(name); setCur(null);
  };
  const loadPreset = (name) => { const p = ls(`${key}_presets`, {})[name]; setPname(name); if (p) { setHid(p.hid || {}); setSort(p.sort || defaultSort || null); setTop(p.top ?? topN); } };
  const delPreset = () => { const p = { ...ls(`${key}_presets`, {}) }; delete p[pname]; sv(`${key}_presets`, p); if (ls(`${key}_default`, '') === pname) sv(`${key}_default`, ''); setPname(''); };
  const setDefault = () => sv(`${key}_default`, ls(`${key}_default`, '') === pname ? '' : pname) || setCur((x) => x);
  const names = Object.keys(ls(`${key}_presets`, {}));
  const isDef = pname && ls(`${key}_default`, '') === pname;
  return (
    <div className="gt">
      <div className="gt-bar">
        {title && <b className="gt-title">{title}</b>}
        {sub && <span className="mut">{sub}</span>}
        <span className="grow" />
        <input className="input" placeholder="cari…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 130, minWidth: 0 }} />
        <label className="mut" style={{ fontWeight: 600 }}>Top <input className="input" type="number" min="0" value={top} onChange={(e) => setTop(Math.max(0, +e.target.value || 0))} style={{ width: 58, minWidth: 0 }} /></label>
        <details className="gt-menu"><summary className="btn sm">Kolom</summary><div className="gt-pop">{cols.map((c) => <label key={c.k} className={'tog' + (isHid(c) ? '' : ' on')}><input type="checkbox" checked={!isHid(c)} onChange={() => setHid((o) => ({ ...o, [c.k]: !isHid(c) }))} />{c.label}</label>)}</div></details>
        <details className="gt-menu"><summary className="btn sm">Preset{pname ? `: ${pname}${isDef ? ' ★' : ''}` : ''}</summary>
          <div className="gt-pop" style={{ minWidth: 200 }}>
            {names.map((n) => <button key={n} className={'btn sm' + (n === pname ? ' on' : '')} onClick={() => loadPreset(n)}>{n}</button>)}
            {!names.length && <span className="mut">Belum ada preset.</span>}
            <div className="row" style={{ marginTop: 6, gap: 6 }}><button className="btn sm pri" onClick={savePreset}>Simpan pengaturan ini</button>{pname && <button className="btn sm" onClick={setDefault}>{isDef ? 'Lepas bawaan' : 'Jadikan bawaan ★'}</button>}{pname && <button className="btn sm" onClick={delPreset}>Hapus</button>}</div>
          </div>
        </details>
        {nEdit > 0 && <button className="btn sm" onClick={() => window.confirm(`Kembalikan ${nEdit} baris yang diedit ke asli?`) && setEdits({})}>Reset {nEdit} edit</button>}
      </div>
      <div className="scroll">
        <table className="t">
          <thead><tr><th style={{ width: 22 }} />{vis.map((c) => <th key={c.k} className={c.num ? '' : 'l'} style={{ cursor: 'pointer' }} onClick={() => setSort((s) => (s?.k === c.k ? { k: c.k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k: c.k, dir: c.num ? 'desc' : 'asc' }))}>{c.label}{sort?.k === c.k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => {
              const rk = rowKey(r);
              return (
                <tr key={rk}>
                  <td><button className="rst gt-x" title="Sembunyikan baris ini" onClick={() => setHrows((o) => ({ ...o, [rk]: 1 }))}>×</button></td>
                  {vis.map((c) => {
                    const v = val(r, c);
                    const ed = edits[rk]?.[c.k] !== undefined;
                    const txt = c.fmt ? c.fmt(v, r) : v;
                    const on = cur && cur.rk === rk && cur.k === c.k;
                    const cl = (c.num ? '' : 'l ') + (c.cls ? c.cls(v, r) || '' : '');
                    if (on) return <td key={c.k} className={cl}><input ref={inRef} className="dcell-in" autoFocus defaultValue={String(v ?? '')} onBlur={(e) => commit(r, c, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setCur(null); }} /></td>;
                    return (
                      <td key={c.k} className={cl}>
                        <span className={'dcell' + (ed ? ' chg' : '')} onClick={() => c.num && setCur({ rk, k: c.k })} style={c.num ? undefined : { cursor: 'default' }}>{txt === '' || txt == null ? '\u00a0' : txt}</span>
                        {ed && <button className="rst" title="Kembalikan" onClick={() => commit(r, c, '')}>↺</button>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={vis.length + 1} className="mut" style={{ textAlign: 'center', padding: 14 }}>{empty}</td></tr>}
          </tbody>
          {shown.length > 0 && vis.some((c) => c.sum || c.tot) && (
            <tfoot><tr><td />{vis.map((c, i) => <td key={c.k} className={c.num ? 'tot' : 'l tot'}>{i === 0 ? `Total (${shown.length})` : c.sum ? (c.fmt ? c.fmt(shown.reduce((a, r) => a + (Number(val(r, c)) || 0), 0)) : '') : c.tot ? (c.fmt ? c.fmt(c.tot(shown, (r, k) => val(r, cols.find((x) => x.k === k)))) : '') : ''}</td>)}</tr></tfoot>
          )}
        </table>
      </div>
      {nHid > 0 && <div className="gt-foot mut">{nHid} baris disembunyikan <button className="btn sm" onClick={() => setHrows((o) => { const n = { ...o }; for (const r of rows) delete n[rowKey(r)]; return n; })}>Tampilkan semua</button></div>}
      {top > 0 && filt.length > shown.length && <div className="gt-foot mut">Menampilkan {shown.length} dari {filt.length}. Ubah “Top” untuk lebih banyak (0 = semua).</div>}
    </div>
  );
}
