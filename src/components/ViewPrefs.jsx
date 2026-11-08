import { useEffect, useState } from 'react';
import { FS_STEPS, setFs, setUnit, useFs, useUnit } from '../lib/unit.js';
import { FONTS, getFontId, setFont } from '../lib/fonts.js';

// pilihan tampilan di header: satuan angka, font, dan ukuran huruf
export default function ViewPrefs() {
  const u = useUnit();
  const fs = useFs();
  const [fid, setFid] = useState(getFontId);
  useEffect(() => { const f = () => setFid(getFontId()); window.addEventListener('sm-font', f); return () => window.removeEventListener('sm-font', f); }, []);
  return (
    <span className="vprefs">
      <span className="seg" title="Satuan angka di DAP dan Ranking SKU">
        <button className={u === 'rp' ? 'on' : ''} onClick={() => setUnit('rp')}>Rp</button>
        <button className={u === 'jt' ? 'on' : ''} onClick={() => setUnit('jt')}>Juta</button>
      </span>
      <select className="input vfont" value={fid} onChange={(e) => setFont(e.target.value)} title="Jenis huruf">
        {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      <span className="seg" title="Ukuran huruf">
        <button disabled={fs === 0} onClick={() => setFs(Math.max(0, fs - 1))} aria-label="Perkecil huruf">A−</button>
        <button className="vfs" onClick={() => setFs(4)} title="Kembali ke 100%">{Math.round(FS_STEPS[fs] * 100)}%</button>
        <button disabled={fs === FS_STEPS.length - 1} onClick={() => setFs(Math.min(FS_STEPS.length - 1, fs + 1))} aria-label="Perbesar huruf">A+</button>
      </span>
    </span>
  );
}
