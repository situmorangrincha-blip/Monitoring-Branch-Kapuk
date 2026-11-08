import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Panel, Seg } from '../components/ui.jsx';
import { PAL, PixelDonut } from '../components/charts.jsx';
import { buildDayTargeter } from '../lib/dayTarget.js';
import { REASONS, analyze, iso, parseSoFile, parseStkFile, stkDateFromName } from '../lib/sodo.js';

const ST = { Nol: 'tag', Terkirim: 'tag g', Sebagian: 'tag y', Belum: 'tag r', 'Menunggu STK': 'tag b', Retur: 'tag' };
const rp = (n) => Math.round(n || 0).toLocaleString('id-ID');
const readWb = async (f) => XLSX.read(await f.arrayBuffer(), { type: 'array', cellFormula: false, cellStyles: false, sheetRows: 20000, cellDates: true });

export default function SoDo({ slot, onSave, holidays = [], time, data, mode = 'milestone' }) {
  const [tab, setTab] = useState('mon');
  const [pend, setPend] = useState({ so: [], stk: [] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [fs, setFs] = useState('ALL');
  const [ft, setFt] = useState('ALL');
  const [fd, setFd] = useState('ALL');
  const [method, setMethod] = useState('visit');
  const so = useRef(null);
  const stk = useRef(null);
  const today = iso(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })));
  const isHol = (d) => holidays.includes(d.getDate()) && (!time || d.getMonth() + 1 === time.m);
  const A = useMemo(() => analyze(slot, isHol, today), [slot, holidays]); // eslint-disable-line
  const holFor = (y, m) => (time && y === time.y && m === time.m ? holidays : []);
  const dt = useMemo(() => buildDayTargeter(data, mode, holFor), [data, mode, holidays]); // eslint-disable-line
  const reasons = slot?.reasons || {};
  const targets = slot?.targets || {};
  const save = (patch) => onSave({ so: slot?.so || [], stk: slot?.stk || [], reasons, targets, ...patch });

  async function pick(kind, files) {
    setErr('');
    try {
      const add = [];
      for (const f of files) {
        const wb = await readWb(f);
        if (kind === 'so') add.push({ name: f.name, rows: parseSoFile(wb, f.name) });
        else add.push({ name: f.name, rows: parseStkFile(wb, f.name), date: stkDateFromName(f.name) });
      }
      setPend((p) => ({ ...p, [kind]: [...p[kind], ...add] }));
    } catch (e) { setErr(e.message || String(e)); }
  }
  async function merge() {
    setBusy(true);
    try {
      const soMap = new Map((slot?.so || []).map((x) => [x.no, x]));
      for (const f of pend.so) for (const x of f.rows) soMap.set(x.no, x);
      const stkMap = new Map((slot?.stk || []).map((x) => [`${x.date}|${x.faktur || x.id + x.nilai}`, x]));
      for (const f of pend.stk) { if (!f.date) throw new Error(`Isi tanggal STK untuk file ${f.name}`); for (const x of f.rows) stkMap.set(`${f.date}|${x.faktur || x.id + x.nilai}`, { ...x, date: f.date }); }
      await save({ so: [...soMap.values()], stk: [...stkMap.values()] });
      setPend({ so: [], stk: [] });
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }
  const setReason = (k, patch) => save({ reasons: { ...reasons, [k]: { ...(reasons[k] || {}), ...patch } } });

  const dates = [...new Set(A.rows.map((r) => r.date))].sort().reverse();
  const sales = [...new Set(A.rows.map((r) => r.sales))];
  const shown = A.rows.filter((r) => (fs === 'ALL' || r.sales === fs) && (ft === 'ALL' ? r.status !== 'Nol' : r.status === ft) && (fd === 'ALL' || r.date === fd)).sort((a, b) => (a.status === 'Terkirim') - (b.status === 'Terkirim') || b.net - a.net);
  const recap = useMemo(() => {
    const by = {};
    for (const r of A.rows) {
      const s = (by[r.sales] ||= { sales: r.sales, so: 0, omset: 0, retur: 0, ok: 0, part: 0, belum: 0, nilaiBelum: 0, wait: 0 });
      s.so += r.nos.length; s.omset += r.omset; s.retur += r.retur;
      if (r.status === 'Terkirim') s.ok++; else if (r.status === 'Sebagian') { s.part++; s.nilaiBelum += Math.max(0, r.net - r.stk); } else if (r.status === 'Belum') { s.belum++; s.nilaiBelum += r.net; } else if (r.status === 'Menunggu STK') s.wait++;
    }
    const src = {}; const why = {};
    for (const x of slot?.so || []) src[x.src] = (src[x.src] || 0) + (x.amt > 0 ? x.amt : 0);
    for (const r of A.rows) if (['Belum', 'Sebagian'].includes(r.status)) { const w = reasons[r.key]?.r || '(belum diisi)'; why[w] = (why[w] || 0) + 1; }
    return { by: Object.values(by), src, why };
  }, [A, slot, reasons]);

  const tgDates = dates.slice(0, 14);
  const has = (slot?.so?.length || 0) > 0;
  return (
    <div className="grid">
      <Panel title="MONITORING SO-DO" right={has ? `${(slot.so || []).length} baris SO · ${(slot.stk || []).length} baris STK · STK sampai ${A.maxStk || '-'}` : 'belum ada data'}>
        <div className="row"><Seg value={tab} onChange={setTab} options={[{ v: 'mon', label: 'Monitoring' }, { v: 'up', label: 'Upload & gabung' }, { v: 'rec', label: 'Rekap' }, { v: 'tgt', label: 'Target harian' }]} />
          <span className="mut">STK harus ada maksimal 2 hari kerja setelah tanggal SO (Sabtu hari kerja, Minggu libur).</span></div>
      </Panel>
      {err && <div className="warn err">{err}</div>}

      {tab === 'up' && (
        <div className="grid g2">
          <Panel title="1 · FILE SO (BANYAK SEKALIGUS)">
            <div className="drop" onClick={() => so.current?.click()}>Pilih file SO (nama file = nama salesman kalau tidak ada kolom salesman)<input ref={so} type="file" accept=".xlsx,.xls" multiple hidden onChange={(e) => { pick('so', [...e.target.files]); e.target.value = ''; }} /></div>
            {pend.so.map((f) => <div key={f.name} className="row" style={{ justifyContent: 'space-between' }}><span>{f.name}</span><span className="mut">{f.rows.length} baris · {[...new Set(f.rows.map((r) => r.sales))].join(', ')}</span></div>)}
          </Panel>
          <Panel title="2 · FILE STK (BANYAK SEKALIGUS)">
            <div className="drop" onClick={() => stk.current?.click()}>Pilih file STK (tanggal diambil dari nama file, mis. STK_3110 = 31 Okt)<input ref={stk} type="file" accept=".xlsx,.xls" multiple hidden onChange={(e) => { pick('stk', [...e.target.files]); e.target.value = ''; }} /></div>
            {pend.stk.map((f, i) => <div key={f.name} className="row" style={{ justifyContent: 'space-between' }}><span>{f.name} <span className="mut">· {f.rows.length} baris</span></span><input className="input" type="date" style={{ minWidth: 0 }} value={f.date} onChange={(e) => setPend((p) => ({ ...p, stk: p.stk.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)) }))} /></div>)}
          </Panel>
          <div className="row" style={{ gridColumn: '1 / -1' }}>
            <button className="btn coin" disabled={busy || (!pend.so.length && !pend.stk.length)} onClick={merge}>{busy ? 'Menyimpan…' : `Gabungkan dan simpan (${pend.so.length} SO, ${pend.stk.length} STK)`}</button>
            {has && <button className="btn" onClick={() => window.confirm('Hapus semua data SO-DO?') && onSave({ so: [], stk: [], reasons: {}, targets })}>Kosongkan data</button>}
          </div>
        </div>
      )}

      {tab === 'mon' && (!has ? (
        <Panel title="MONITORING"><div className="empty"><h2>Belum ada data SO</h2><p className="mut">Buka tab "Upload & gabung" untuk memasukkan file SO dan STK.</p></div></Panel>
      ) : (
        <Panel title="SO VS STK PER TOKO" flush right={`${shown.length} dari ${A.rows.length}`}>
          <div className="row" style={{ padding: '10px 14px' }}>
            <select className="input" style={{ minWidth: 0 }} value={fd} onChange={(e) => setFd(e.target.value)}><option value="ALL">Semua tanggal SO</option>{dates.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <Seg wrap value={fs} onChange={setFs} options={[{ v: 'ALL', label: 'Semua' }, ...sales.map((s) => ({ v: s, label: s.split(' ')[0] }))]} />
            <Seg wrap value={ft} onChange={setFt} options={['ALL', 'Belum', 'Sebagian', 'Menunggu STK', 'Terkirim', 'Retur', 'Nol'].map((v) => ({ v, label: v === 'ALL' ? 'Semua status' : v === 'Nol' ? 'Sisa 0' : v }))} />
          </div>
          <div className="scroll"><table className="t">
            <thead><tr><th>Tgl SO</th><th>Salesman</th><th>Toko</th><th>Sumber</th><th>Omset</th><th>Retur</th><th>Net</th><th>Batas STK</th><th>STK</th><th>Status</th><th className="l">Alasan</th></tr></thead>
            <tbody>{shown.slice(0, 400).map((r) => {
              const rs = reasons[r.key] || {};
              const need = ['Belum', 'Sebagian'].includes(r.status) || r.overdue;
              return (
                <tr key={r.key}>
                  <td>{r.date.slice(5)}</td><td className="l">{r.sales.split(' ')[0]}</td><td className="l nm">{r.name}</td><td className="l">{r.src.join(', ')}</td><td>{rp(r.omset)}</td><td className={r.retur ? 'neg' : ''}>{r.retur ? rp(r.retur) : ''}</td><td>{rp(r.net)}</td><td>{r.due.slice(5)}</td><td>{r.stk ? rp(r.stk) : ''}</td>
                  <td><span className={ST[r.status]}>{r.status}</span>{r.overdue && <span className="tag r" style={{ marginLeft: 4 }}>lewat</span>}</td>
                  <td className="l">{need && (
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <select className="input" style={{ minWidth: 0, padding: '3px 6px' }} value={rs.r || ''} onChange={(e) => setReason(r.key, { r: e.target.value })}><option value="">pilih alasan…</option>{REASONS.map((x) => <option key={x}>{x}</option>)}</select>
                      {rs.r === 'Plan kirim tanggal lain' && <input className="input" type="date" style={{ minWidth: 0 }} value={rs.plan || ''} onChange={(e) => setReason(r.key, { plan: e.target.value })} />}
                      {rs.r === 'Lainnya (isi sendiri)' && <input className="input" style={{ minWidth: 150 }} placeholder="tulis alasan" defaultValue={rs.note || ''} onBlur={(e) => setReason(r.key, { note: e.target.value })} />}
                    </span>
                  )}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <div className="note">Status dicocokkan per toko + salesman: Terkirim (nilai faktur STK ≥ 95% omset), Sebagian, Belum. "Menunggu STK" = file STK sampai batas tanggalnya belum diupload. "Sisa 0" = SO dengan Jumlah Sisa 0 (tidak ada omset), disembunyikan dari daftar utama.</div>
        </Panel>
      ))}

      {tab === 'rec' && has && (
        <>
          <Panel title="REKAP PER SALESMAN" flush>
            <div className="scroll"><table className="t"><thead><tr><th>Salesman</th><th>SO</th><th>Omset</th><th>Retur</th><th>Net</th><th>Terkirim</th><th>Sebagian</th><th>Belum</th><th>Menunggu</th><th>Nilai belum kirim</th></tr></thead>
              <tbody>{recap.by.map((s) => <tr key={s.sales}><td className="l">{s.sales}</td><td>{s.so}</td><td>{rp(s.omset)}</td><td className="neg">{rp(s.retur)}</td><td>{rp(s.omset + s.retur)}</td><td className="ok">{s.ok}</td><td className="mid">{s.part}</td><td className="low">{s.belum}</td><td>{s.wait}</td><td>{rp(s.nilaiBelum)}</td></tr>)}
                <tr className="tot"><td className="l">TOTAL</td><td>{recap.by.reduce((a, s) => a + s.so, 0)}</td><td>{rp(recap.by.reduce((a, s) => a + s.omset, 0))}</td><td>{rp(recap.by.reduce((a, s) => a + s.retur, 0))}</td><td>{rp(recap.by.reduce((a, s) => a + s.omset + s.retur, 0))}</td><td>{recap.by.reduce((a, s) => a + s.ok, 0)}</td><td>{recap.by.reduce((a, s) => a + s.part, 0)}</td><td>{recap.by.reduce((a, s) => a + s.belum, 0)}</td><td>{recap.by.reduce((a, s) => a + s.wait, 0)}</td><td>{rp(recap.by.reduce((a, s) => a + s.nilaiBelum, 0))}</td></tr>
              </tbody></table></div>
          </Panel>
          <div className="grid g2">
            <Panel title="OMSET SO PER SUMBER"><PixelDonut size={170} items={Object.entries(recap.src).map(([k, v], i) => ({ label: k, v, color: PAL[i % PAL.length] }))} center={rp(Object.values(recap.src).reduce((a, b) => a + b, 0) / 1e6)} sub="jt" /></Panel>
            <Panel title="ALASAN BELUM TERKIRIM"><PixelDonut size={170} items={Object.entries(recap.why).map(([k, v], i) => ({ label: k, v, color: PAL[(i + 1) % PAL.length] }))} center={Object.values(recap.why).reduce((a, b) => a + b, 0)} sub="toko" /></Panel>
          </div>
        </>
      )}

      {tab === 'tgt' && (
        <Panel title="TARGET HARIAN" flush right={dt ? `dari target ${mode === 'bti' ? 'BTI' : 'Milestone'} di data utama` : 'data utama belum ada'}>
          <div className="row" style={{ padding: '10px 14px' }}>
            <Seg value={method} onChange={setMethod} options={[{ v: 'visit', label: 'Jadwal kunjungan' }, { v: 'rata', label: 'Rata per hari kerja' }, { v: 'manual', label: 'Manual saja' }]} />
            <span className="mut">{method === 'visit' ? 'Jumlah target per kunjungan toko yang dijadwalkan hari itu (sama dengan DAP).' : method === 'rata' ? 'Target bulanan ÷ hari kerja (Senin-Sabtu, minus libur).' : 'Hanya angka yang lu isi.'} Isian manual selalu menang.</span>
          </div>
          {!dt && <div className="warn" style={{ margin: '0 14px 10px' }}>Buka depo dan tim yang sama, lalu upload Data utama supaya target harian terhitung otomatis. Sementara itu, isi manual.</div>}
          {!has ? <div className="empty"><p className="mut">Upload SO dulu.</p></div> : (
            <div className="scroll"><table className="t"><thead><tr><th>Salesman</th>{tgDates.map((d) => <th key={d}>{d.slice(5)}</th>)}</tr></thead>
              <tbody>{sales.map((s) => (
                <tr key={s}><td className="l">{s}{dt && !dt.match(s) && <div className="tag y">nama tidak cocok dengan data utama</div>}</td>{tgDates.map((d) => {
                  const om = A.rows.filter((r) => r.sales === s && r.date === d).reduce((a, r) => a + r.net, 0);
                  const k = `${d}|${s}`; const man = targets[k];
                  const auto = dt ? dt.targetFor(d, s, method) : null;
                  const eff = man > 0 ? man : auto || 0;
                  return <td key={d}><div>{rp(om)}</div>{auto != null && !man && <div className="mut" style={{ fontSize: 11 }}>target {rp(auto)}</div>}<input className="input" style={{ width: 92, minWidth: 0, padding: '2px 6px', textAlign: 'right' }} type="number" placeholder="manual" defaultValue={man || ''} onBlur={(e) => save({ targets: { ...targets, [k]: +e.target.value || 0 } })} />{eff > 0 && <div className={om >= eff ? 'ok' : 'low'}>{Math.round((om / eff) * 100)}%</div>}</td>;
                })}</tr>
              ))}</tbody></table></div>
          )}
        </Panel>
      )}
    </div>
  );
}
