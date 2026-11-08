import { useMemo, useState } from 'react';
import { Panel, Seg } from '../components/ui.jsx';
import { makeCtx, progCodes, programsForStore, rowEligible } from '../lib/progcat.js';

const J = { 'OFF FAKTUR': 'tag b', 'ON FAKTUR': 'tag g', INSENTIF: 'tag y', VISIBILITY: 'tag', 'BONUS BARANG': 'tag r' };
const cut = (s, n = 70) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export default function Programs({ data, onUpload }) {
  const [tab, setTab] = useState('katalog');
  const [jenis, setJenis] = useState('ALL');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [sq, setSq] = useState('');
  const [pick, setPick] = useState(null);
  const ctx = useMemo(() => makeCtx(data), [data]);
  const codes = useMemo(() => progCodes(data), [data]);
  const counts = useMemo(() => {
    const m = {};
    for (const c of codes) m[c.code] = { ya: 0, daftar: 0 };
    const rowsBy = {};
    for (const r of data.progcat?.rows || []) (rowsBy[r['Kode Program']] ||= []).push(r);
    for (const st of data.stores) {
      for (const [code, rows] of Object.entries(rowsBy)) {
        let best = 'tidak';
        for (const r of rows) { const e = rowEligible(r, st, ctx); if (e === 'ya') { best = 'ya'; break; } if (e === 'perlu daftar') best = 'perlu daftar'; }
        if (best === 'ya') m[code].ya++; else if (best === 'perlu daftar') m[code].daftar++;
      }
    }
    return m;
  }, [data, codes, ctx]);

  if (!data.progcat) {
    return (
      <Panel title="PROGRAM">
        <div className="empty"><h2>Katalog program belum diupload</h2><p className="mut">Upload Excel standar program (sheet PROGRAM, STRATA, PESERTA) di menu Upload, slot "Katalog program".</p><button className="btn coin" onClick={onUpload}>Upload katalog program</button></div>
      </Panel>
    );
  }
  const jenisList = ['ALL', ...new Set(codes.map((c) => c.jenis))];
  const shown = codes.filter((c) => (jenis === 'ALL' || c.jenis === jenis) && (!q || `${c.nama} ${c.code} ${c.brand}`.toLowerCase().includes(q.toLowerCase())));
  const stHits = sq.trim().length < 2 ? [] : data.stores.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(sq.toLowerCase())).slice(0, 8);
  const forStore = pick ? programsForStore(data, pick, ctx) : [];

  return (
    <div className="grid">
      <Panel title="PROGRAM" right={`${codes.length} program · ${data.progcat.rows.length} baris · Jatakalbar / Area 2`}>
        <div className="row">
          <Seg value={tab} onChange={setTab} options={[{ v: 'katalog', label: 'Katalog' }, { v: 'toko', label: 'Per toko' }, { v: 'strata', label: 'Strata diskon' }]} />
          <span className="mut">Kecocokan toko dihitung dari channel, ukuran, dan penanda ITG di JKS (CC5) serta daftar peserta. Program berdaftar tanpa daftar peserta ditandai "perlu daftar".</span>
        </div>
      </Panel>

      {!data.itgList && data.progcat.rows.some((r) => /NON ITG/i.test(r['Syarat ITG'])) && <div className="warn">File ITG belum diupload: program "Non ITG" belum bisa memisahkan toko ITG (peserta ITG hanya dibaca dari file ITG, bukan dari CC5 di JKS).</div>}
      {tab === 'katalog' && (
        <Panel title="KATALOG PROGRAM" flush right={<><input className="input" style={{ width: 190, minWidth: 0 }} placeholder="cari program / brand" value={q} onChange={(e) => setQ(e.target.value)} /></>}>
          <div className="row" style={{ padding: '10px 14px' }}><Seg wrap value={jenis} onChange={setJenis} options={jenisList.map((j) => ({ v: j, label: j === 'ALL' ? 'Semua' : j }))} /></div>
          <div className="scroll">
            <table className="t">
              <thead><tr><th>Program</th><th>Jenis</th><th>Brand</th><th>Toko cocok</th><th>Perlu daftar</th><th>Baris</th></tr></thead>
              <tbody>
                {shown.map((c) => (
                  <>
                    <tr key={c.code} className="clickable" onClick={() => setOpen(open === c.code ? null : c.code)}>
                      <td className="l nm">{c.nama}</td><td><span className={J[c.jenis] || 'tag'}>{c.jenis}</span></td><td className="l">{c.brand}</td>
                      <td className="ok">{counts[c.code]?.ya || 0}</td><td className="mut">{counts[c.code]?.daftar || 0}</td><td>{c.rows}</td>
                    </tr>
                    {open === c.code && (
                      <tr key={c.code + 'd'}><td colSpan={6} style={{ background: 'var(--paper2)', padding: 0 }}>
                        <div className="scroll"><table className="t"><thead><tr><th className="l">Channel</th><th className="l">Kelas</th><th className="l">SKU</th><th>Min order</th><th>Reward</th><th className="l">Syarat</th><th className="l">FPP</th></tr></thead>
                          <tbody>{data.progcat.rows.filter((r) => r['Kode Program'] === c.code).map((r, i) => (
                            <tr key={i}><td className="l">{r.Channel}</td><td className="l">{cut(r['Kelas / Jenis Toko'], 34)}</td><td className="l">{cut(r['Kode SKU'] || r['Keterangan SKU'], 40)}</td><td>{String(r['Min Order'])} {r.Satuan}</td><td>{String(r['Nilai Reward'])} {r['Satuan Reward']}</td><td className="l" title={r['Syarat Tambahan']}>{cut(r['Syarat Tambahan'], 80)}</td><td className="l mut">{cut(r['No FPP'], 30)}</td></tr>
                          ))}</tbody></table></div>
                      </td></tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'toko' && (
        <Panel title="PROGRAM PER TOKO">
          <div className="row"><input className="input" style={{ width: 300 }} placeholder="cari toko (nama atau ID)" value={sq} onChange={(e) => setSq(e.target.value)} /></div>
          {stHits.length > 0 && <div className="fbox">{stHits.map((s) => <div key={s.id + s.sales}><button className="btn sm" style={{ margin: 2 }} onClick={() => { setPick(s); setSq(''); }}>{s.name}</button> <span className="mut">{s.id} · {s.sales} · {s.cc5}</span></div>)}</div>}
          {pick && (
            <div style={{ marginTop: 10 }}>
              <b>{pick.name}</b> <span className="mut">{pick.id} · {pick.sales} · {pick.cc1} {pick.cc5}{ctx.itg.has(pick.id) ? ' · peserta ITG' : ''}</span>
              <div className="scroll"><table className="t" style={{ marginTop: 8 }}>
                <thead><tr><th>Program</th><th>Jenis</th><th>Status</th><th className="l">Benefit</th></tr></thead>
                <tbody>{forStore.map((g) => (
                  <tr key={g.code}><td className="l nm">{g.nama}</td><td><span className={J[g.jenis] || 'tag'}>{g.jenis}</span></td><td className={g.status === 'ya' ? 'ok' : 'mid'}>{g.status === 'ya' ? 'berlaku' : 'perlu daftar'}</td><td className="l">{cut(g.rows.map((r) => `${r['Nilai Reward']} ${r['Satuan Reward']}`.trim()).filter(Boolean).slice(0, 3).join(' · '), 80)}</td></tr>
                ))}</tbody>
              </table></div>
              {!forStore.length && <div className="warn">Tidak ada program yang cocok untuk toko ini.</div>}
            </div>
          )}
          {!pick && <div className="mut" style={{ marginTop: 10 }}>Cari toko untuk melihat semua program yang berlaku untuknya.</div>}
        </Panel>
      )}

      {tab === 'strata' && (
        <Panel title="STRATA DISKON" flush>
          <div className="scroll"><table className="t"><thead><tr><th className="l">Program</th><th className="l">Wilayah</th><th>Dari</th><th>Sampai</th><th className="l">Satuan</th><th>Diskon %</th><th className="l">FPP</th></tr></thead>
            <tbody>{data.progcat.strata.map((r, i) => <tr key={i}><td className="l">{r.Program}</td><td className="l">{r.Wilayah}</td><td>{r.Dari}</td><td>{r.Sampai || 'UP'}</td><td className="l">{cut(r.Satuan, 40)}</td><td>{r['Diskon %']}</td><td className="l mut">{cut(r['No FPP'], 40)}</td></tr>)}</tbody></table></div>
          <div className="note">SP Kebayoran memakai strata wilayah Jawa.</div>
        </Panel>
      )}
    </div>
  );
}
