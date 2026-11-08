import { useState } from 'react';
import { DEFAULT_RULES, defaultRulesFor } from '../lib/rules.js';
import { saveSlot } from '../lib/store.js';

const rp = (n) => Math.round(n || 0).toLocaleString('id-ID');

// Aturan salesman khusus: toko tertentu dipindah ke salesman lain. Berlaku otomatis di setiap upload.
export default function RulesPane({ rules, stores, depot, team, storeMode, onDone, setErr }) {
  const base = rules || defaultRulesFor(depot, team) || { items: [] };
  const [items, setItems] = useState(() => JSON.parse(JSON.stringify(base.items)));
  const [q, setQ] = useState('');
  const [who, setWho] = useState(0);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const isSeed = !rules && !!defaultRulesFor(depot, team);

  const hits = q.trim().length < 2 ? [] : stores.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const upd = (ri, fn) => setItems((o) => o.map((r, i) => (i === ri ? fn(r) : r)));
  const add = (ri, s) => upd(ri, (r) => (r.stores.some((x) => x.id === s.id) ? r : { ...r, stores: [...r.stores, { id: s.id, name: s.name, bti: s.tgt ? Math.round(s.tgt / 1.1) : 0, pr: {} }] }));

  async function save() {
    setBusy(true); setErr('');
    try { const d = { items: items.filter((r) => r.sales.trim() && r.stores.length) }; await saveSlot(storeMode, depot, team, 'rules', d); onDone('rules', d); } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }

  return (
    <div>
      <div className="mut" style={{ marginBottom: 8 }}>
        Toko di bawah ini dipindah ke salesman yang ditentukan: actual, L3M, dan target ikut pindah, dan dikeluarkan dari salesman asalnya. Target per toko adalah angka <b>BTI</b>; milestone otomatis BTI × 110%. Aturan disimpan di web, jadi tiap upload baru langsung kena.
        {isSeed && <span className="tag y" style={{ marginLeft: 6 }}>bawaan: Vini 6 toko (belum disimpan)</span>}
      </div>
      {items.map((r, ri) => (
        <div key={ri} className="it" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginBottom: 10, background: '#fff' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{r.sales}</b>
            <span className="mut">{r.stores.length} toko · BTI {rp(r.stores.reduce((a, x) => a + (+x.bti || 0), 0))} · milestone {rp(r.stores.reduce((a, x) => a + (+x.bti || 0), 0) * (r.factor || 1.1))}</span>
            <button className="btn sm" onClick={() => setItems(items.filter((_, i) => i !== ri))}>Hapus aturan</button>
          </div>
          <div className="scroll">
            <table className="t">
              <thead><tr><th>Toko</th><th>ID</th><th>Target BTI</th><th /></tr></thead>
              <tbody>
                {r.stores.map((x) => (
                  <tr key={x.id}>
                    <td className="l">{x.name}</td><td className="l mut">{x.id}</td>
                    <td><input className="input" style={{ width: 130, minWidth: 0, textAlign: 'right' }} type="number" value={x.bti} onChange={(e) => upd(ri, (rr) => ({ ...rr, stores: rr.stores.map((y) => (y.id === x.id ? { ...y, bti: +e.target.value } : y)) }))} /></td>
                    <td><button className="btn sm ghost" onClick={() => upd(ri, (rr) => ({ ...rr, stores: rr.stores.filter((y) => y.id !== x.id) }))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="row">
        <input className="input" placeholder="cari toko (nama atau ID) untuk ditambahkan" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} />
        {items.length > 1 && <select className="input" style={{ minWidth: 0 }} value={who} onChange={(e) => setWho(+e.target.value)}>{items.map((r, i) => <option key={i} value={i}>ke {r.sales}</option>)}</select>}
      </div>
      {hits.length > 0 && <div className="fbox">{hits.map((s) => <div key={s.id + s.sales}><button className="btn sm" style={{ margin: 2 }} onClick={() => items.length && add(who, s)}>+ {s.name}</button> <span className="mut">{s.id} · sekarang di {s.sales}</span></div>)}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input" placeholder="atau buat aturan baru: nama salesman" style={{ width: 240 }} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn sm" disabled={!newName.trim()} onClick={() => { setItems([...items, { sales: newName.trim(), factor: 1.1, stores: [] }]); setNewName(''); setWho(items.length); }}>Tambah aturan</button>
        <span style={{ flex: 1 }} />
        {rules && <button className="btn" onClick={async () => { setBusy(true); try { await saveSlot(storeMode, depot, team, 'rules', { items: [] }); onDone('rules', { items: [] }); } catch (e) { setErr(e.message); } setBusy(false); }}>Kosongkan semua</button>}
        <button className="btn coin" disabled={busy} onClick={save}>Simpan aturan</button>
      </div>
    </div>
  );
}
export { DEFAULT_RULES };
