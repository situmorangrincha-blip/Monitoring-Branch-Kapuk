import { useMemo, useState } from 'react';
import { fmt } from '../lib/calc.js';
import { DEFAULT_W, IND, grade, rapotAll } from '../lib/rapot.js';
import { Panel } from '../components/ui.jsx';

const KEY = 'sm_rapot_w';
const load = () => { try { return { ...DEFAULT_W, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT_W; } };
const tone = (v) => (v == null ? '' : v >= 85 ? 'ok' : v >= 70 ? 'ok' : v >= 55 ? 'mid' : 'low');
const bgc = (v) => (v >= 70 ? 'bg-ok' : v >= 55 ? 'bg-mid' : 'bg-low');

export default function Rapot({ data, time, mode, depot, team }) {
  const [W, setW] = useState(load);
  const [busy, setBusy] = useState('');
  const R = useMemo(() => rapotAll(data, mode, time, W), [data, mode, time, W]);
  const setWeight = (id, v) => { const n = { ...W, [id]: Math.max(0, Math.min(100, +v || 0)) }; setW(n); localStorage.setItem(KEY, JSON.stringify(n)); };
  const sumW = IND.reduce((a, i) => a + (W[i.id] || 0), 0);
  const order = [...R.ranked, ...R.rows.filter((r) => !r.ranked || r.total == null)];

  async function pdf(only) {
    setBusy('Menyusun PDF...');
    try { const { makeRapotPdf } = await import('../lib/rapotPdf.js'); await makeRapotPdf({ data, R, only, W, mode, time, depot, team }); } catch (e) { alert('Gagal membuat PDF: ' + (e?.message || e)); }
    setBusy('');
  }

  return (
    <div className="grid">
      <Panel title={`RAPOT SALESMAN · ${data.meta.teamLabel?.toUpperCase() || ''}`} right={`${R.nRanked} salesman diranking · basis ${mode === 'bti' ? 'BTI' : 'Milestone'} · timegone ${fmt.pct(time.tg, 0)}`}>
        <div className="row">
          <span className="mut">Nilai 0-100 dari indikator berbobot. Indikator tanpa data dilewati dan bobotnya dibagi ke yang ada.</span>
          <span style={{ flex: 1 }} />
          <button className="btn coin" disabled={!!busy} onClick={() => pdf(null)}>{busy || 'Unduh PDF (semua rapot)'}</button>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer' }}>Bobot indikator (total {sumW}, bisa diubah)</summary>
          <div className="scroll"><table className="t" style={{ marginTop: 6 }}>
            <thead><tr><th>Indikator</th><th>Bobot</th><th className="l">Cara hitung</th></tr></thead>
            <tbody>{IND.map((i) => <tr key={i.id}><td className="l">{i.label}</td><td><input className="input" style={{ width: 70, minWidth: 0, textAlign: 'right' }} type="number" value={W[i.id]} onChange={(e) => setWeight(i.id, e.target.value)} /></td><td className="l mut">{i.how}</td></tr>)}</tbody>
          </table></div>
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { setW(DEFAULT_W); localStorage.removeItem(KEY); }}>Kembalikan bawaan</button>
        </details>
      </Panel>

      <Panel title="PERINGKAT" flush>
        <div className="scroll">
          <table className="t">
            <thead><tr><th>#</th><th>Salesman</th><th>Nilai</th>{IND.map((i) => <th key={i.id}>{i.label.split(' ')[0]}</th>)}<th /></tr></thead>
            <tbody>
              {order.map((r) => (
                <tr key={r.name}>
                  <td><span className={'rank' + (r.ranked ? '' : ' n')}>{r.ranked && r.rank ? r.rank : '–'}</span></td>
                  <td className="l">{r.name}{!r.ranked && <span className="tag y" style={{ marginLeft: 6 }}>tidak diranking</span>}</td>
                  <td className="bc"><span className="barlbl"><span className="bar"><i className={bgc(r.total)} style={{ width: (r.total || 0) + '%' }} /></span><span className={'ach ' + tone(r.total)}>{r.total == null ? '-' : r.total.toFixed(1)}</span></span></td>
                  {IND.map((i) => <td key={i.id} className={tone(r.ind[i.id]?.score)}>{r.ind[i.id] ? Math.round(r.ind[i.id].score) : '–'}</td>)}
                  <td><button className="btn sm" onClick={() => pdf(r.name)}>PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note">Salesman dengan aturan khusus (toko dipindahkan, mis. Vini) dinilai terpisah dan tidak masuk peringkat. Strip "–" berarti datanya belum ada.</div>
      </Panel>

      <div className="grid g2">
        {order.map((r) => (
          <Panel key={r.name} title={r.name.toUpperCase()} right={r.total == null ? '-' : `${r.total.toFixed(1)} · ${grade(r.total)}${r.ranked && r.rank ? ` · #${r.rank} dari ${R.nRanked}` : ''}`}>
            <div className="mini">
              {IND.map((i) => { const x = r.ind[i.id]; return (
                <div key={i.id} className="it">
                  <div className="h"><span>{i.label} <span className="mut">· bobot {W[i.id]}</span></span><span className={tone(x?.score)}>{x ? Math.round(x.score) : '–'}</span></div>
                  <div className="bar"><i className={x ? bgc(x.score) : ''} style={{ width: (x?.score || 0) + '%' }} /></div>
                  <div className="sub">{x ? x.note : 'belum ada data'}</div>
                </div>); })}
            </div>
            {r.strong.length > 0 && <div className="note" style={{ marginTop: 10, padding: '8px 0 0' }}><b className="ok">Kuat:</b> {r.strong.map((x) => `${x.label} (${Math.round(x.score)})`).join(', ')} · <b className="low">Lemah:</b> {r.weak.map((x) => `${x.label} (${Math.round(x.score)})`).join(', ')}</div>}
            {r.worst.length > 0 && <div className="note" style={{ padding: '4px 0 0', border: 0 }}>Toko paling tertinggal: {r.worst.map((s) => s.name).join(', ')}</div>}
          </Panel>
        ))}
      </div>
    </div>
  );
}
