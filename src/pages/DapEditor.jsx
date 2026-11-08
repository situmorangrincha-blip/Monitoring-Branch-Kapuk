import { useEffect, useMemo, useState } from 'react';
import FocusPicker from '../components/FocusPicker.jsx';
import ViewPrefs from '../components/ViewPrefs.jsx';
import { Cell } from './Dap.jsx';
import { DEFAULT_DAP, buildDap } from '../lib/dapModel.js';
import { autoDapRows } from '../lib/dapAuto.js';
import { BASE_QTY, BASE_RP, IM, L3, buildBlock, catOptions, newBlock, principalsOf, skuOptions } from '../lib/dapBlocks.js';
import { setWeekOffset, weekdayName } from '../lib/calc.js';
import { fmtMoney, useUnit } from '../lib/unit.js';

const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const pad = (n) => String(n).padStart(2, '0');
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const SORTS = { rp: [['tv', 'Target/kunjungan'], ['t', 'Target DAP'], ['a', 'Actual'], ['gap', 'Gap terbesar (kurang)'], ['plan', 'PLAN'], ['itemT', 'Target item pertama'], ['itemA', 'Actual item pertama']], qty: [['qty', 'Qty MTD'], ['itemA', 'Qty item pertama']] };

// Halaman tersendiri untuk mengedit DAP: banyak tabel per halaman, kertas di layar sama dengan hasil cetak
export default function DapEditor({ data: data0, time, mode = 'milestone', holidays, depot, team, day, setDay, onBack }) {
  const unit = useUnit();
  const ckey = `sm_dap_${depot}_${team}`;
  const bkey = `sm_dapb_${depot}_${team}`;
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_DAP, ...(ls(ckey, {}) || {}) }));
  useEffect(() => sv(ckey, cfg), [cfg, ckey]);
  const [blocks, setBlocks] = useState(() => { const pr = ls(bkey + '_presets', {}); const dn = ls(bkey + '_default', ''); return (dn && pr[dn]) || ls(bkey, null) || [newBlock('dap', 'rp')]; });
  useEffect(() => sv(bkey, blocks), [blocks, bkey]);
  const [pname, setPname] = useState(() => ls(bkey + '_default', ''));
  const [menu, setMenu] = useState('');

  // baris DAP: target dari worksheet / hitungan otomatis, sama seperti halaman DAP
  const hasSheet = !!data0.dap?.length && !data0.meta?.dapAuto;
  const useAuto = !hasSheet || cfg.src !== 'sheet';
  const auto = useMemo(() => (useAuto ? autoDapRows(data0, mode) : null), [useAuto, data0, mode]);
  const data = useMemo(() => (auto ? { ...data0, dap: auto.rows } : data0), [auto, data0]);
  const last = new Date(time.y, time.m, 0).getDate();
  const d = Math.min(Math.max(1, day), last);
  const dk = `${time.y}-${pad(time.m)}-${pad(d)}`;
  const wd = new Date(time.y, time.m - 1, d).getDay();
  const wkAuto = Math.ceil(d / 7);
  const wkOff = cfg.week === '13' ? (wkAuto % 2 === 0 ? 1 : 0) : cfg.week === '24' ? (wkAuto % 2 === 1 ? 1 : 0) : 0;
  const hidAll = cfg.hid?.[dk] || {};
  const built = useMemo(() => {
    setWeekOffset(wkOff);
    try { return blocks.map((b) => (b.type === 'on' ? null : buildBlock(data, time, d, holidays, cfg, b, { unit, mode, hidden: hidAll[b.id] || {} }))); } finally { setWeekOffset(0); }
  }, [data, time, d, holidays, cfg, blocks, unit, mode, wkOff]); // eslint-disable-line
  const base0 = useMemo(() => { setWeekOffset(wkOff); try { return buildDap(data, time, d, holidays, { ...cfg, cols: ['t'], skuMain: [], kpick: [], par: { on: false }, unit }); } finally { setWeekOffset(0); } }, [data, time, d, holidays, cfg, unit, wkOff]);
  const skus = useMemo(() => skuOptions(data), [data]);
  const cats = useMemo(() => catOptions(data), [data]);
  const prins = useMemo(() => principalsOf(data), [data]);

  const setEdit = (id, fn) => setCfg((c) => { const ed = { ...(c.edits || {}) }; const dd = { ...(ed[dk] || {}) }; const nx = fn({ ...(dd[id] || {}) }); if (Object.keys(nx).length) dd[id] = nx; else delete dd[id]; if (Object.keys(dd).length) ed[dk] = dd; else delete ed[dk]; return { ...c, edits: ed }; });
  const hide = (bid, id, on) => setCfg((c) => { const h = { ...(c.hid || {}) }; const dd = { ...(h[dk] || {}) }; const bb = { ...(dd[bid] || {}) }; if (on) bb[id] = 1; else delete bb[id]; if (Object.keys(bb).length) dd[bid] = bb; else delete dd[bid]; if (Object.keys(dd).length) h[dk] = dd; else delete h[dk]; return { ...c, hid: h }; });
  const showAll = (bid) => setCfg((c) => { const h = { ...(c.hid || {}) }; const dd = { ...(h[dk] || {}) }; delete dd[bid]; if (Object.keys(dd).length) h[dk] = dd; else delete h[dk]; return { ...c, hid: h }; });
  const patchBlock = (id, f) => setBlocks((a) => a.map((b) => (b.id === id ? { ...b, ...(typeof f === 'function' ? f(b) : f) } : b)));
  const move = (i, dir) => setBlocks((a) => { const j = i + dir; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const dup = (b) => setBlocks((a) => { const i = a.findIndex((x) => x.id === b.id); const n = [...a]; n.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(b)), id: newBlock().id, title: b.title + ' (salinan)' }); return n; });
  const del = (b) => window.confirm(`Hapus tabel "${b.title}"?`) && setBlocks((a) => a.filter((x) => x.id !== b.id));
  const nEditDay = Object.keys(cfg.edits?.[dk] || {}).length;

  const step = (delta) => { let n = d; for (let i = 0; i < 40; i++) { n += delta; if (n < 1 || n > last) return; if (new Date(time.y, time.m - 1, n).getDay() !== 0) { setDay(n); return; } } };
  const savePreset = () => { const name = window.prompt('Nama preset susunan halaman ini:', pname || ''); if (!name) return; sv(bkey + '_presets', { ...ls(bkey + '_presets', {}), [name]: blocks }); setPname(name); setMenu(''); };
  const loadPreset = (name) => { const p = ls(bkey + '_presets', {})[name]; if (p) { setBlocks(JSON.parse(JSON.stringify(p))); setPname(name); } setMenu(''); };
  const delPreset = () => { const p = { ...ls(bkey + '_presets', {}) }; delete p[pname]; sv(bkey + '_presets', p); if (ls(bkey + '_default', '') === pname) sv(bkey + '_default', ''); setPname(''); setMenu(''); };
  const togDefault = () => { sv(bkey + '_default', ls(bkey + '_default', '') === pname ? '' : pname); setMenu(''); };
  const presets = Object.keys(ls(bkey + '_presets', {}));
  const isDef = pname && ls(bkey + '_default', '') === pname;
  const title = `DAP ${data.meta.teamLabel?.toUpperCase() || ''} · ${weekdayName(wd).toUpperCase()} ${d} ${MON[time.m - 1].toUpperCase()} ${time.y}`;

  // sel yang bisa diedit di tabel
  const renderCell = (b, x, c, i) => {
    const v = x.cells[i];
    if (i < 3) return <td key={i} className={i === 1 ? 'l nm' : i === 2 ? 'l mut' : 'c'}>{v}</td>;
    const m = x.meta[i];
    if (!m) return <td key={i}>{v}</td>;
    const ed = x.ed || {};
    const neg = (c.neg && String(v).startsWith('-')) || m.neg;
    const money = !(b.metric === 'qty') && m.k !== 'sisa';
    if (m.kind === 'base') return <Cell key={i} v={v} cls={neg ? 'neg' : ''} num jt={unit === 'jt' && money} edited={ed[m.k] != null} onCommit={(val) => setEdit(x.r.id, (o) => ({ ...o, [m.k]: val }))} onReset={() => setEdit(x.r.id, (o) => { const n = { ...o }; delete n[m.k]; return n; })} />;
    if (m.kind === 'iv') return <Cell key={i} v={v} cls={neg ? 'neg' : ''} num dec={b.metric === 'qty'} jt={unit === 'jt' && b.metric === 'rp'} edited={m.edited} onCommit={(val) => setEdit(x.r.id, (o) => ({ ...o, iv: { ...(o.iv || {}), [m.key]: val } }))} onReset={() => setEdit(x.r.id, (o) => { const iv = { ...(o.iv || {}) }; delete iv[m.key]; const n = { ...o }; if (Object.keys(iv).length) n.iv = iv; else delete n.iv; return n; })} />;
    return <Cell key={i} v={v} cls={neg ? 'neg' : ''} edited={ed.v?.[m.k] != null} onCommit={(val) => setEdit(x.r.id, (o) => ({ ...o, v: { ...(o.v || {}), [m.k]: val } }))} onReset={() => setEdit(x.r.id, (o) => { const vv = { ...(o.v || {}) }; delete vv[m.k]; const n = { ...o }; if (Object.keys(vv).length) n.v = vv; else delete n.v; return n; })} />;
  };

  const togList = (arr, k) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const chip = (on, l, f, key) => <label key={key} className={'tog' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={f} />{l}</label>;

  return (
    <div className="dped">
      <div className="dped-bar noprint">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={onBack}>← Kembali ke web</button>
          <b>Editor DAP</b>
          <span className="mut">{data.meta.teamLabel} · {depot === 'kapuk' ? 'Depo Kapuk' : 'SP Kebayoran'}</span>
          <span style={{ flex: 1 }} />
          <ViewPrefs />
          <button className="btn pri" onClick={() => window.print()} title="Di jendela cetak pilih 'Simpan sebagai PDF'. Hasilnya sama dengan tampilan di layar.">Cetak / Simpan PDF</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button className="btn sm" onClick={() => step(-1)} aria-label="Hari sebelumnya">◀</button>
          <input className="input" style={{ minWidth: 0, width: 150 }} type="date" value={dk} min={`${time.y}-${pad(time.m)}-01`} max={`${time.y}-${pad(time.m)}-${pad(last)}`} onChange={(e) => { const v = e.target.value; if (v) setDay(+v.slice(8)); }} />
          <button className="btn sm" onClick={() => step(1)} aria-label="Hari berikutnya">▶</button>
          <span className="mut">{weekdayName(wd)} · {base0.total} toko</span>
          <span className="mut" style={{ marginLeft: 6 }}>Pekan (JKS)</span>
          <div className="seg">{[['auto', `Otomatis (minggu ke-${wkAuto})`], ['13', 'Pekan 1&3'], ['24', 'Pekan 2&4']].map(([v, l]) => <button key={v} className={(cfg.week || 'auto') === v ? 'on' : ''} onClick={() => setCfg((c) => ({ ...c, week: v }))}>{l}</button>)}</div>
          <span style={{ flex: 1 }} />
          <div className="gt-menu"><button className="btn sm pri" onClick={() => setMenu(menu === 'add' ? '' : 'add')}>+ Tambah tabel</button>
            {menu === 'add' && <div className="gt-pop" style={{ right: 'auto', left: 0, width: 250 }}>
              {[['dap', 'rp', 'Tabel DAP (Rp)'], ['dap', 'qty', 'Tabel DAP (Qty)'], ['top', 'rp', 'Top toko (Rp)'], ['top', 'qty', 'Top toko (Qty)'], ['on', 'rp', 'Program ON faktur']].map(([t, mt, l]) => <button key={l} className="btn sm" onClick={() => { setBlocks((a) => [...a, newBlock(t, mt)]); setMenu(''); }}>{l}</button>)}
            </div>}
          </div>
          <div className="gt-menu"><button className="btn sm" onClick={() => setMenu(menu === 'pre' ? '' : 'pre')}>Preset{pname ? `: ${pname}${isDef ? ' ★' : ''}` : ''}</button>
            {menu === 'pre' && <div className="gt-pop" style={{ minWidth: 230 }}>
              {presets.map((n) => <button key={n} className={'btn sm' + (n === pname ? ' on' : '')} onClick={() => loadPreset(n)}>{n}</button>)}
              {!presets.length && <span className="mut">Belum ada preset.</span>}
              <div className="row" style={{ marginTop: 6, gap: 6, width: '100%' }}><button className="btn sm pri" onClick={savePreset}>Simpan susunan ini</button>{pname && <button className="btn sm" onClick={togDefault}>{isDef ? 'Lepas bawaan' : 'Jadikan bawaan ★'}</button>}{pname && <button className="btn sm" onClick={delPreset}>Hapus</button>}</div>
              <div className="mut" style={{ fontSize: 11 }}>Preset menyimpan tabel, kolom, dan pilihan item. Angka yang diedit tidak ikut, karena terikat tanggal.</div>
            </div>}
          </div>
          {nEditDay > 0 && <button className="btn sm" onClick={() => window.confirm(`Kembalikan ${nEditDay} toko di tanggal ini ke suggest?`) && setCfg((c) => { const ed = { ...(c.edits || {}) }; delete ed[dk]; return { ...c, edits: ed }; })}>Reset {nEditDay} toko yang diubah</button>}
        </div>
        <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>Klik angka mana saja untuk mengubahnya (oranye = diubah, ↺ = kembali ke suggest). × di ujung baris menyembunyikan toko untuk tanggal ini dan totalnya ikut berubah. Satuan dan ukuran huruf ada di kanan atas.</div>
      </div>

      {blocks.map((b, bi) => {
        const B = built[bi];
        const isOn = b.type === 'on';
        const baseList = b.metric === 'qty' ? BASE_QTY : BASE_RP;
        return (
          <section key={b.id} className="dblk">
            <details open className="bset noprint">
              <summary><b>{b.title}</b> <span className="mut">· {isOn ? 'Program ON faktur' : b.type === 'top' ? 'Top toko' : 'Tabel DAP'}{!isOn && (b.metric === 'qty' ? ' · Qty' : ' · Rp')}</span></summary>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                <input className="input" value={b.title} onChange={(e) => patchBlock(b.id, { title: e.target.value })} style={{ width: 220, minWidth: 0 }} aria-label="Judul tabel" />
                {!isOn && <div className="seg">{[['rp', 'Rp'], ['qty', 'Qty']].map(([v, l]) => <button key={v} className={b.metric === v ? 'on' : ''} onClick={() => patchBlock(b.id, (o) => ({ metric: v, cols: (o.cols || []).filter((k) => (v === 'qty' ? BASE_QTY : BASE_RP).some((x) => x[0] === k)), sortBy: v === 'qty' ? 'qty' : 'tv', im: v === 'qty' ? ['a'] : ['t', 'a', 'g', 'p'] }))}>{l}</button>)}</div>}
                <span style={{ flex: 1 }} />
                <button className="btn sm" disabled={bi === 0} onClick={() => move(bi, -1)}>↑</button>
                <button className="btn sm" disabled={bi === blocks.length - 1} onClick={() => move(bi, 1)}>↓</button>
                <button className="btn sm" onClick={() => dup(b)}>Gandakan</button>
                <button className="btn sm" onClick={() => del(b)}>Hapus tabel</button>
              </div>
              {!isOn && (
                <>
                  <div className="mut" style={{ fontSize: 12 }}>Item di tabel ini (SKU, kategori, atau principal): tiap item mendapat kolom Target, Actual, Gap, dan % Ach sesuai pilihan di bawah.</div>
                  <FocusPicker skus={skus} cats={cats} prins={prins} picks={b.picks || []} onToggle={(kind, key) => patchBlock(b.id, (o) => { const cur = o.picks || []; const has = cur.some((p) => p.kind === kind && p.key === key); return { picks: has ? cur.filter((p) => !(p.kind === kind && p.key === key)) : [...cur, { kind, key }] }; })} />
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="lbl">Kolom per item</span>
                    {IM.map(([k, l]) => chip((b.im || []).includes(k), l, () => patchBlock(b.id, (o) => ({ im: togList(o.im || [], k) })), k))}
                    {L3.map(([k, l]) => chip((b.l3 || []).includes(k), l, () => patchBlock(b.id, (o) => ({ l3: togList(o.l3 || [], k) })), k))}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                    <span className="lbl">Kolom dasar</span>
                    {baseList.map(([k, l]) => chip((b.cols || []).includes(k), l, () => patchBlock(b.id, (o) => ({ cols: togList(o.cols || [], k) })), k))}
                  </div>
                  {b.type === 'top' && (
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                      <label className="mut" style={{ fontWeight: 600 }}>Top <input className="input" type="number" min="1" style={{ width: 60, minWidth: 0 }} value={b.topN} onChange={(e) => patchBlock(b.id, { topN: Math.max(1, +e.target.value || 1) })} /> toko</label>
                      <select className="input" value={b.sortBy} onChange={(e) => patchBlock(b.id, { sortBy: e.target.value })}>{SORTS[b.metric === 'qty' ? 'qty' : 'rp'].map(([v, l]) => <option key={v} value={v}>Urut: {l}</option>)}</select>
                      <div className="seg">{[['salesman', 'Per salesman'], ['all', 'Semua salesman']].map(([v, l]) => <button key={v} className={b.scope === v ? 'on' : ''} onClick={() => patchBlock(b.id, { scope: v })}>{l}</button>)}</div>
                    </div>
                  )}
                  {b.metric === 'qty' && <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>Target Qty belum ada di file monitoring, jadi tampil “-” sampai lu isi manual (klik selnya). Gap dan % Ach menghitung sendiri setelah target diisi.</div>}
                  {B?.nHidden > 0 && <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>{B.nHidden} baris disembunyikan di tanggal ini <button className="btn sm" onClick={() => showAll(b.id)}>Tampilkan semua</button></div>}
                </>
              )}
            </details>

            {isOn ? (
              <div className="dpaper">
                <div className="dph"><span>{title}</span><span>{b.title}</span></div>
                <table className="dp">
                  <thead><tr><th className="l">Program</th><th>Min order</th><th>Satuan</th><th>Diskon</th><th>Potongan</th><th>Pengambilan</th><th className="noprint" style={{ width: 22 }} /></tr></thead>
                  <tbody>
                    {(b.on || []).map((x, i) => {
                      const set = (k) => (val) => patchBlock(b.id, (o) => ({ on: o.on.map((y, j) => (j === i ? { ...y, [k]: val } : y)) }));
                      const clr = (k) => () => set(k)(k === 'min' || k === 'pot' ? 0 : '');
                      return (
                        <tr key={i}>
                          <Cell v={x.n || ''} cls="l" onCommit={set('n')} onReset={clr('n')} />
                          <Cell v={x.min ? fmtMoney(x.min, 'rp') : ''} num onCommit={set('min')} onReset={clr('min')} />
                          <Cell v={x.sat || ''} onCommit={set('sat')} onReset={clr('sat')} />
                          <Cell v={x.dis || ''} onCommit={set('dis')} onReset={clr('dis')} />
                          <Cell v={x.pot ? fmtMoney(x.pot, 'rp') : ''} num onCommit={set('pot')} onReset={clr('pot')} />
                          <Cell v={x.ambil || ''} cls="blank" onCommit={set('ambil')} onReset={clr('ambil')} />
                          <td className="noprint"><button className="rst gt-x" style={{ opacity: 1 }} title="Hapus baris" onClick={() => patchBlock(b.id, (o) => ({ on: o.on.filter((_, j) => j !== i) }))}>×</button></td>
                        </tr>
                      );
                    })}
                    {!(b.on || []).length && <tr><td colSpan={7} className="mut" style={{ textAlign: 'center', padding: 10 }}>Belum ada program. Klik “+ tambah program”.</td></tr>}
                  </tbody>
                </table>
                <div className="noprint" style={{ marginTop: 6 }}><button className="btn sm" onClick={() => patchBlock(b.id, (o) => ({ on: [...(o.on || []), { n: '', min: 0, sat: '', dis: '', pot: 0, ambil: '' }] }))}>+ tambah program</button></div>
              </div>
            ) : !B || !B.groups.length ? (
              <div className="dpaper"><div className="mut">Tidak ada toko dijadwalkan di tanggal ini.</div></div>
            ) : B.groups.map((g) => (
              <div key={g.name} className="dpaper">
                <div className="dph"><span>{title}</span><span>{b.title} · {g.name.toUpperCase()}</span></div>
                <table className="dp">
                  <thead>
                    {B.groupsHead && <tr><th className="noprint" />{B.groupsHead.map((h, i) => <th key={i} colSpan={h.span} className="gh">{h.label}</th>)}</tr>}
                    <tr><th className="noprint" />{B.head.map((c, i) => <th key={i} className={i === 1 || i === 2 ? 'l' : ''}>{c.item ? c.ml : c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {g.rows.map((x) => (
                      <tr key={x.r.id + x.r.s}>
                        <td className="noprint"><button className="rst gt-x" style={{ opacity: 1 }} title="Sembunyikan toko ini di tanggal ini" onClick={() => hide(b.id, x.r.id, true)}>×</button></td>
                        {B.head.map((c, i) => renderCell(b, x, c, i))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td className="noprint" />{g.tot.map((t, i) => <td key={i} className={i === 1 ? 'l' : ''}>{t}</td>)}</tr></tfoot>
                </table>
              </div>
            ))}
          </section>
        );
      })}
      {!blocks.length && <div className="note">Belum ada tabel. Klik “+ Tambah tabel”.</div>}
    </div>
  );
}
