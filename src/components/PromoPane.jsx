import { useRef, useState } from 'react';
import { saveSlot } from '../lib/store.js';

const fmtUp = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short' }); } catch { return ''; } };

// Upload program (Excel / PDF) -> toko peserta dicocokkan ke database toko.
export default function PromoPane({ promo, stores, depot, team, storeMode, onDone, setErr, onRedirect }) {
  const input = useRef(null);
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [name, setName] = useState('');
  const [off, setOff] = useState(new Set());
  const items = promo?.items || [];

  async function read(file) {
    if (!file) return;
    setErr(''); setRes(null); setBusy('Membaca file...');
    try {
      if (/\.xls[xm]?$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', bookSheets: true });
        if (wb.SheetNames.some((n) => n.trim().toUpperCase() === 'PROGRAM')) { setBusy(''); onRedirect?.(file); return; }
      }
      if (!stores.length) throw new Error('Data utama belum ada. Upload Data utama dulu supaya toko bisa dicocokkan.');
      const { readPromoFile } = await import('../lib/promo.js');
      const r = await readPromoFile(file, stores);
      setRes(r); setName(r.name); setOff(new Set());
    } catch (e) { setErr(e.message || String(e)); }
    setBusy('');
  }
  async function persist(next) {
    setBusy('Menyimpan...');
    try { const d = { items: next, uploadedAt: new Date().toISOString() }; await saveSlot(storeMode, depot, team, 'promo', d); onDone('promo', d); setRes(null); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy('');
  }
  const save = () => {
    const ids = res.rows.filter((r) => !off.has(r.id)).map((r) => r.id);
    const nm = name.trim() || res.name;
    persist([...items.filter((x) => x.name !== nm), { id: nm.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: nm, file: res.fileName, uploadedAt: new Date().toISOString(), ids, nUnmatched: res.unmatched.length, unmatched: res.unmatched.slice(0, 60) }]);
  };
  const remove = (x) => window.confirm(`Hapus program "${x.name}"?`) && persist(items.filter((y) => y !== x));

  return (
    <div>
      {items.length > 0 && (
        <div className="mini" style={{ marginBottom: 10 }}>
          {items.map((x) => (
            <div key={x.id} className="it">
              <div className="h"><span>{x.name}</span><button className="btn sm" onClick={() => remove(x)}>Hapus</button></div>
              <div className="sub">{x.ids.length} toko peserta · {x.file} · {fmtUp(x.uploadedAt)}{x.nUnmatched ? ` · ${x.nUnmatched} baris tidak ketemu di database` : ''}</div>
            </div>
          ))}
        </div>
      )}
      <div className="drop" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); read(e.dataTransfer.files?.[0]); }}>
        {busy || 'Tarik file program (Excel atau PDF) ke sini atau klik untuk pilih'}
        <input ref={input} type="file" accept=".xlsx,.xlsm,.xls,.pdf" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {res && (
        <div style={{ marginTop: 10 }}>
          <div className="row"><b>{res.fileName}</b><span className="ok">terbaca ({res.kind.toUpperCase()})</span></div>
          <div className="row" style={{ margin: '8px 0' }}>
            <span className="mut">Nama program</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kpis k4">
            <div className="kpi"><div className="l">Toko cocok</div><div className="v">{res.rows.length - off.size}</div><div className="s">dari {stores.length.toLocaleString('id-ID')} toko di database</div></div>
            <div className="kpi"><div className="l">Lewat ID</div><div className="v">{res.rows.filter((r) => r.via === 'ID').length}</div><div className="s">paling pasti</div></div>
            <div className="kpi"><div className="l">Lewat nama</div><div className="v">{res.rows.filter((r) => r.via === 'nama').length}</div><div className="s">cek manual</div></div>
            <div className="kpi"><div className="l">Tidak ketemu</div><div className="v">{res.unmatched.length}</div><div className="s">tidak ada di database</div></div>
          </div>
          {res.note && <div className="warn">{res.note}</div>}
          {res.rows.length === 0 && <div className="warn err">Tidak ada toko di file ini yang cocok dengan database (ID atau nama toko). Cek apakah file berisi ID/nama toko yang sama dengan data utama.</div>}
          {res.rows.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Toko yang cocok (hapus centang kalau salah)</summary>
              <div className="fbox" style={{ maxHeight: 240 }}>
                {res.rows.map((r) => (
                  <label key={r.id} style={{ display: 'flex' }}>
                    <input type="checkbox" checked={!off.has(r.id)} onChange={(e) => { const n = new Set(off); e.target.checked ? n.delete(r.id) : n.add(r.id); setOff(n); }} />
                    <span>{r.name} <span className="mut">{r.id} · {r.sales} · {r.via}</span></span>
                  </label>
                ))}
              </div>
            </details>
          )}
          {res.unmatched.length > 0 && (
            <details style={{ marginTop: 6 }}><summary style={{ cursor: 'pointer' }}>Tidak ketemu di database ({res.unmatched.length})</summary><div className="fbox">{res.unmatched.slice(0, 200).join(', ')}</div></details>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn coin" disabled={!!busy || res.rows.length - off.size === 0} onClick={save}>Simpan program</button>
          </div>
        </div>
      )}
    </div>
  );
}
