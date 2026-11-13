import { useRef, useState } from 'react';
import { SLOT_INFO, uploadPeriod } from '../lib/ingest.js';
import { SMART_SLOTS, confLabel, fingerprint } from '../lib/smartDetect.js';
import { deleteSlot, saveSlot } from '../lib/store.js';
import { keyOfPeriod } from '../lib/scup.js';

const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MAXMB = 80;
const idn = (n) => Number(n || 0).toLocaleString('id-ID');
const fmtUp = (iso) => { try { if (!iso || Number.isNaN(new Date(iso).getTime())) return ''; return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// ringkasan satu baris tentang isi hasil baca, per jenis data
function summary(slot, p) {
  if (!p) return '';
  if (slot === 'main') return `${idn(p.stores?.length)} toko · ${p.salesmen?.length || 0} salesman (${(p.salesmen || []).slice(0, 3).join(', ')}${(p.salesmen || []).length > 3 ? '...' : ''}) · periode ${p.meta?.period?.label || '-'}`;
  if (slot === 'sku' || slot === 'val') return `${idn(p.rows)} baris · ${p.subs?.length || 0} SKU${p.blocks ? ' · 3 blok (bulan berjalan, L3M, bulan lalu)' : ''}`;
  if (slot === 'itg') return `${p.items?.length || 0} toko ITG · target ${(p.months || []).map((m) => m.label).join(' + ')}`;
  if (slot === 'itgscup') return `${p.items?.length || 0} outlet · target ${(p.months || []).map((m) => m.label).join(' + ')} (ctn)`;
  if (slot === 'progcat') return `${p.rows?.length || 0} baris program · ${p.strata?.length || 0} baris strata`;
  if (slot === 'skudb') return `${idn(p.items?.length)} SKU`;
  if (slot === 'ctarget') return `${p.items?.length || 0} target`;
  if (slot === 'market') return 'ringkasan EC, AC, GreenStore, MSS, PICOS';
  return '';
}

// peringatan periode: bulan di dalam file dibandingkan dengan periode data yang dipilih
function periodWarn(slot, p, per) {
  const want = `${per.year}-${String(per.month).padStart(2, '0')}`;
  if (slot === 'sku' || slot === 'val') {
    const cur = keyOfPeriod(p?.blocks?.periods?.cur); if (cur && cur !== want) return `Periode di file ${p.blocks.periods.cur} berbeda dengan periode data (${MON[per.month - 1]} ${per.year}).`;
  }
  if (slot === 'main') { const fp = p?.meta?.filePeriod; if (fp && (fp.year !== per.year || fp.month !== per.month)) return `Pivot di file membaca ${fp.label}, sedangkan periode data ${MON[per.month - 1]} ${per.year}. Pastikan pivot sudah di-refresh.`; }
  return '';
}

export default function SmartUpload({ slots, depot, team, storeMode, onBatch }) {
  const [rows, setRows] = useState([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const upl = uploadPeriod();
  const [per, setPer] = useState({ year: upl.year, month: upl.month });
  const [done, setDone] = useState(null); // { saved: [{slot, ok, err}], prev: {slot: data|null} }
  const input = useRef(null), wbs = useRef(new Map());
  const patch = (id, p) => setRows((o) => o.map((r) => (r.id === id ? { ...r, ...p } : r)));

  // baca dan tebak satu file (atau coba ulang dengan slot pilihan lu)
  async function analyze(id, file, forced) {
    try {
      const [{ PARSERS }, XLSX] = await Promise.all([import('../lib/ingest.js'), import('xlsx')]);
      let wb = wbs.current.get(id);
      if (!wb) {
        if (file.size > MAXMB * 1024 * 1024) throw new Error(`File ${Math.round(file.size / 1048576)} MB terlalu besar untuk browser. Kecilkan dulu: hapus baris kosong di bawah data (sheet yang ke-format sampai baris 1.048.576).`);
        await new Promise((r) => setTimeout(r, 30));
        wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellStyles: false, sheetRows: 60000 });
        wbs.current.set(id, wb);
      }
      const cands = fingerprint(wb, file.name);
      const periodObj = { year: per.year, month: per.month, label: `${MON[per.month - 1].slice(0, 3).toUpperCase()} ${per.year}` };
      const order = forced ? [{ slot: forced, score: 0, why: 'dipilih manual' }] : cands.filter((c) => c.score >= 40).slice(0, 3);
      let hit = null, lastErr = '';
      for (const c of order) {
        try { const r = PARSERS[c.slot](wb, { team, fileName: file.name, override: {}, period: c.slot === 'main' ? periodObj : null }); hit = { c, r }; break; } catch (e) { lastErr = e.message || String(e); }
      }
      if (!hit) { patch(id, { state: 'gagal', slot: forced || order[0]?.slot || '', cands, error: order.length ? lastErr : 'Isi file tidak cocok dengan jenis data mana pun. Pilih jenis datanya manual, atau upload lewat tab "Per slot".', parsed: null, info: null }); return; }
      const { c, r } = hit;
      const second = cands.find((x) => x.slot !== c.slot)?.score ?? 0;
      const conf = forced ? 'manual' : confLabel(c.score, second);
      const warns = [...(r.data?.warnings || [])];
      const pw = periodWarn(c.slot, r.data, per); if (pw) warns.unshift(pw);
      patch(id, { state: 'ok', slot: c.slot, conf, why: c.why, cands, parsed: r.data, info: r.info, warns, error: '', use: true });
    } catch (e) { patch(id, { state: 'gagal', parsed: null, error: e.message || String(e) }); }
  }

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter((f) => /\.(xlsx|xlsm|xls)$/i.test(f.name));
    if (!files.length) { setBusy('Tidak ada file Excel (.xlsx / .xlsm / .xls) yang dipilih.'); setTimeout(() => setBusy(''), 2500); return; }
    setDone(null);
    const base = Date.now();
    const add = files.map((f, i) => ({ id: `${base}-${i}`, name: f.name, size: f.size, file: f, state: 'baca', slot: '', conf: '', use: false }));
    setRows((o) => [...o, ...add]);
    for (let i = 0; i < add.length; i++) { setBusy(`Membaca ${i + 1} dari ${add.length}: ${add[i].name}`); await analyze(add[i].id, add[i].file); }
    setBusy('');
  }

  const changeSlot = async (r, slot) => { patch(r.id, { state: 'baca', error: '' }); setBusy(`Membaca ulang ${r.name}...`); await analyze(r.id, r.file, slot); setBusy(''); };
  const remove = (r) => { wbs.current.delete(r.id); setRows((o) => o.filter((x) => x.id !== r.id)); };

  // satu slot hanya boleh dipakai satu file: kalau dobel, yang pertama dicentang dan sisanya menunggu pilihan lu
  const conflict = (r) => r.use && rows.some((x) => x.id !== r.id && x.use && x.state === 'ok' && x.slot === r.slot);
  const chosen = rows.filter((r) => r.state === 'ok' && r.use);
  const bySlot = {}; chosen.forEach((r) => { (bySlot[r.slot] ||= []).push(r); });
  const dup = Object.entries(bySlot).filter(([, v]) => v.length > 1);

  async function saveAll() {
    if (dup.length) return;
    setBusy('Menyimpan...');
    const prev = {}, saved = [], map = {};
    for (const r of chosen) {
      setBusy(`Menyimpan ${SLOT_INFO[r.slot].label}...`);
      try {
        const data = { ...r.parsed };
        if (r.slot === 'main') { data.depot = depot; data.team = team; data.meta = { ...data.meta, uploadedAt: new Date().toISOString() }; }
        prev[r.slot] = slots[r.slot] ?? null;
        await saveSlot(storeMode, depot, team, r.slot, data);
        map[r.slot] = data; saved.push({ slot: r.slot, name: r.name, ok: true });
      } catch (e) { saved.push({ slot: r.slot, name: r.name, ok: false, err: e.message || String(e) }); }
    }
    if (Object.keys(map).length) onBatch(map);
    setDone({ saved, prev });
    setRows((o) => o.filter((r) => !(r.state === 'ok' && r.use && saved.find((s) => s.slot === r.slot && s.ok))));
    setBusy('');
  }

  async function undo() {
    if (!done) return;
    setBusy('Mengembalikan data sebelumnya...');
    const map = {};
    for (const s of done.saved.filter((x) => x.ok)) {
      try {
        const before = done.prev[s.slot];
        if (before) await saveSlot(storeMode, depot, team, s.slot, before); else await deleteSlot(storeMode, depot, team, s.slot);
        map[s.slot] = before || null;
      } catch { /* lanjut ke slot berikutnya */ }
    }
    onBatch(map); setDone({ ...done, undone: true }); setBusy('');
  }

  const hasMain = rows.some((r) => r.state === 'ok' && r.slot === 'main');
  const slotIds = SMART_SLOTS;
  const confCls = (c) => (c === 'tinggi' ? 'ok' : c === 'sedang' ? 'mid' : c === 'manual' ? 'mut' : 'low');

  return (
    <div>
      <div className="mut" style={{ marginBottom: 8 }}>Tarik beberapa file Excel sekaligus. Web membaca <b>isi</b> tiap file (nama sheet dan judul kolom), menebak itu data apa, lalu menunjukkan hasilnya. Tidak ada yang tersimpan sebelum lu menekan <b>Simpan</b>. Semua file masuk ke depo dan tim yang sedang dibuka.</div>
      {hasMain && (
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="mut">Periode data utama</span>
          <select className="input" style={{ minWidth: 0 }} value={per.month} onChange={(e) => setPer({ ...per, month: +e.target.value })}>{MON.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          <input className="input" style={{ minWidth: 0, width: 80 }} type="number" value={per.year} onChange={(e) => setPer({ ...per, year: +e.target.value })} />
          <span className="mut">(mengikuti tanggal upload; tanggal 1 memakai bulan lalu)</span>
        </div>
      )}
      <div className={'drop' + (over ? ' over' : '')} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        {busy || 'Tarik banyak file Excel ke sini, atau klik untuk memilih beberapa file'}
        <input ref={input} type="file" multiple accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {rows.length > 0 && (
        <div className="scroll" style={{ marginTop: 10 }}>
          <table className="t" style={{ width: '100%' }}>
            <thead><tr><th /><th className="l">File</th><th className="l">Terdeteksi sebagai</th><th>Keyakinan</th><th className="l">Isi</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.state === 'gagal' ? { background: 'rgba(212,73,58,.06)' } : undefined}>
                  <td><input type="checkbox" checked={!!r.use} disabled={r.state !== 'ok'} onChange={(e) => patch(r.id, { use: e.target.checked })} aria-label={`Pakai ${r.name}`} /></td>
                  <td className="l nm" title={r.name} style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}<div className="mut" style={{ fontSize: 11 }}>{(r.size / 1048576).toFixed(1)} MB</div></td>
                  <td className="l">
                    {r.state === 'baca' ? <span className="mut">membaca...</span> : (
                      <select className="input" style={{ minWidth: 0, padding: '3px 6px' }} value={r.slot || ''} onChange={(e) => e.target.value && changeSlot(r, e.target.value)}>
                        <option value="">{r.state === 'gagal' ? '-- pilih jenis data --' : '--'}</option>
                        {slotIds.map((s) => <option key={s} value={s}>{SLOT_INFO[s].label}{slots[s] ? ' (menimpa)' : ''}</option>)}
                      </select>
                    )}
                  </td>
                  <td><span className={confCls(r.conf)}>{r.state === 'ok' ? r.conf : r.state === 'gagal' ? 'gagal' : ''}</span></td>
                  <td className="l" style={{ whiteSpace: 'normal', minWidth: 280, maxWidth: 460 }}>
                    {r.state === 'ok' && <div style={{ fontSize: 12 }}>{summary(r.slot, r.parsed)}<div className="mut" style={{ fontSize: 11 }}>dikenali dari {r.why}</div></div>}
                    {r.state === 'gagal' && <div className="low" style={{ fontSize: 12 }}>{r.error}</div>}
                    {(r.warns || []).slice(0, 3).map((w, i) => <div key={i} className="warn" style={{ fontSize: 11.5, margin: '3px 0' }}>{w}</div>)}
                    {conflict(r) && <div className="warn" style={{ fontSize: 11.5 }}>Ada file lain untuk jenis data yang sama. Pilih salah satu saja (hilangkan centangnya).</div>}
                    {r.state === 'ok' && r.use && slots[r.slot] && <div className="mut" style={{ fontSize: 11 }}>menggantikan data yang ada (update {fmtUp(slots[r.slot].meta?.uploadedAt || slots[r.slot].uploadedAt)})</div>}
                  </td>
                  <td><button className="btn sm" onClick={() => remove(r)} title="Buang dari daftar">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <span className="mut">{chosen.length} file dicentang{dup.length ? ' · ada jenis data yang dobel' : ''}</span>
          <div className="row">
            <button className="btn" onClick={() => { wbs.current.clear(); setRows([]); }}>Kosongkan daftar</button>
            <button className="btn coin" disabled={!chosen.length || !!dup.length || !!busy} onClick={saveAll}>{busy && /Menyimpan/.test(busy) ? busy : `Simpan ${chosen.length} file`}</button>
          </div>
        </div>
      )}

      {done && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{done.undone ? 'Upload dibatalkan, data sebelumnya dikembalikan' : `Selesai: ${done.saved.filter((s) => s.ok).length} dari ${done.saved.length} file tersimpan`}</b>
            {!done.undone && done.saved.some((s) => s.ok) && <button className="btn sm" disabled={!!busy} onClick={undo} title="Mengembalikan data yang ditimpa. Hanya berlaku selama jendela upload ini belum ditutup dan halaman belum dimuat ulang">Batalkan upload ini</button>}
          </div>
          {done.saved.map((s, i) => <div key={i} className={s.ok ? 'ok' : 'low'} style={{ fontSize: 12.5, margin: '3px 0' }}>{s.ok ? '✓' : '✗'} {SLOT_INFO[s.slot].label} dari {s.name}{s.ok ? '' : ': ' + s.err}</div>)}
          <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>Data baru langsung dipakai di semua halaman. Tutup jendela ini kalau sudah selesai.</div>
        </div>
      )}
    </div>
  );
}
