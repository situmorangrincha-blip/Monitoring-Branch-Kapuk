import { useMemo, useState } from 'react';

const TAB = { sku: 'SKU', kat: 'Kategori', prin: 'Principal' };
const PRE = { kat: 'Kategori ', prin: 'Principal ' };

// Pilih SKU / kategori / principal lewat pencarian (tanpa deretan tombol). picks = [{kind, key}]
export default function FocusPicker({ kinds = ['sku', 'kat', 'prin'], skus = [], cats = [], prins = [], picks = [], onToggle, marks, placeholder }) {
  const [kind, setKind] = useState(kinds[0]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const skuName = useMemo(() => new Map(skus.map((s) => [s.k, s.n])), [skus]);
  const list = useMemo(() => {
    const src = kind === 'sku' ? skus.map((s) => ({ key: s.k, label: s.n, meta: [s.k !== s.n ? s.k : '', s.b, s.cat].filter(Boolean).join(' · ') })) : kind === 'kat' ? cats.map((c) => ({ key: c, label: c, meta: '' })) : prins.map((p) => ({ key: p, label: p, meta: '' }));
    const ql = q.trim().toLowerCase();
    return ql ? src.filter((x) => `${x.label} ${x.meta}`.toLowerCase().includes(ql)) : src;
  }, [kind, q, skus, cats, prins]);
  const has = (k, key) => picks.some((p) => p.kind === k && p.key === key);
  const count = (k) => picks.filter((p) => p.kind === k).length;
  return (
    <div className="fp">
      {picks.length > 0 && (
        <div className="fp-pills">
          {picks.map((p) => (
            <span key={p.kind + p.key} className="pill">{PRE[p.kind] || ''}{p.kind === 'sku' ? skuName.get(p.key) || p.key : p.key}<button className="x" onClick={() => onToggle(p.kind, p.key)} aria-label="hapus">×</button></span>
          ))}
        </div>
      )}
      <div className="fp-bar">
        {kinds.length > 1 && (
          <div className="seg">{kinds.map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setQ(''); }}>{TAB[k]}{count(k) ? ` · ${count(k)}` : ''}</button>)}</div>
        )}
        <input className="input" value={q} placeholder={placeholder || `cari ${TAB[kind].toLowerCase()}…`} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 250)} />
        <span className="mut fp-n">{list.length} {TAB[kind].toLowerCase()}</span>
      </div>
      {(open || q) && (
        <div className="fp-list" onMouseDown={(e) => e.preventDefault()}>
          {list.slice(0, 60).map((x) => {
            const on = has(kind, x.key);
            return (
              <button key={x.key} className={'fp-row' + (on ? ' on' : '')} onClick={() => onToggle(kind, x.key)}>
                <span className="fp-ck">{on ? '✓' : '+'}</span><b>{x.label}</b>{marks?.(kind, x.key) && <span className="tag g" title="punya target">target</span>}<span className="mut">{x.meta}</span>
              </button>
            );
          })}
          {!list.length && <div className="mut" style={{ padding: 8 }}>Tidak ada yang cocok.</div>}
          {list.length > 60 && <div className="mut" style={{ padding: 6, fontSize: 12 }}>Menampilkan 60 pertama. Ketik untuk mempersempit.</div>}
        </div>
      )}
    </div>
  );
}
