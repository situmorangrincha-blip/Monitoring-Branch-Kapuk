import { FS_STEPS, setFs, setUnit, useFs, useUnit } from '../lib/unit.js';

// pilihan tampilan di header: satuan angka dan ukuran huruf
export default function ViewPrefs() {
  const u = useUnit();
  const fs = useFs();
  return (
    <span className="vprefs">
      <span className="seg" title="Satuan angka di DAP dan Ranking SKU">
        <button className={u === 'rp' ? 'on' : ''} onClick={() => setUnit('rp')}>Rp</button>
        <button className={u === 'jt' ? 'on' : ''} onClick={() => setUnit('jt')}>Juta</button>
      </span>
      <span className="seg" title="Ukuran huruf">
        <button disabled={fs === 0} onClick={() => setFs(Math.max(0, fs - 1))} aria-label="Perkecil huruf">A−</button>
        <button disabled={fs === FS_STEPS.length - 1} onClick={() => setFs(Math.min(FS_STEPS.length - 1, fs + 1))} aria-label="Perbesar huruf">A+</button>
      </span>
    </span>
  );
}
