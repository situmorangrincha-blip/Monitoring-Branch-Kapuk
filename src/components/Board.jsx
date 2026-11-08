import { useMemo } from 'react';
import { LABELS, byRouteDay, catAgg, fmt, sizeRows } from '../lib/calc.js';

// Papan ringkas: banyak grafik kecil dalam satu layar (kartu skor, batang mini, kolom mini), tanpa ruang kosong
const COL = { ok: '#2a9d8f', warn: '#e9a23b', bad: '#d9534f', ac: 'var(--ac-d)', soft: 'var(--ac)' };
const tone = (p, tg) => { const r = tg > 0 ? p / tg : p; return r >= 1 ? COL.ok : r >= 0.8 ? COL.warn : COL.bad; };

function Tile({ title, right, children, span }) {
  return (
    <section className="bd-t" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <header><b>{title}</b>{right && <span>{right}</span>}</header>
      {children}
    </section>
  );
}
// satu baris: label | batang | angka. mark = garis timegone (0..1)
function Row({ label, pct, text, color, mark, sub }) {
  const w = Math.max(0, Math.min(1, pct || 0)) * 100;
  return (
    <div className="bd-r" title={`${label}${sub ? ' · ' + sub : ''}`}>
      <span className="bd-l">{label}</span>
      <span className="bd-b"><i style={{ width: w + '%', background: color }} />{mark > 0 && mark < 1 && <u style={{ left: mark * 100 + '%' }} />}</span>
      <span className="bd-n">{text}</span>
    </div>
  );
}
function Cols({ items, h = 46, fmtV }) {
  const max = Math.max(1, ...items.map((x) => x.v));
  return (
    <div className="bd-c" style={{ height: h + 22 }}>
      {items.map((x) => (
        <div key={x.k} className="bd-cc" title={`${x.k}: ${fmtV ? fmtV(x.v) : x.v}`}>
          <em>{fmtV ? fmtV(x.v) : x.v}</em>
          <i style={{ height: Math.max(2, (x.v / max) * h), background: x.color || COL.ac, opacity: x.dim ? 0.45 : 1 }} />
          <span>{x.k}</span>
        </div>
      ))}
    </div>
  );
}

export default function Board({ D, data, time, sal = 'ALL' }) {
  const list = useMemo(() => (sal === 'ALL' ? data.stores : data.stores.filter((s) => s.sales === sal)), [data.stores, sal]);
  const row = sal === 'ALL' ? D.total : D.sales.find((x) => x.name === sal) || D.total;
  const tg = time.tg > 0 && time.tg < 1.5 ? time.tg : 0;
  const act = row.act, tgt = row.tgt, acv = tgt ? act / tgt : 0;
  const ca = list.filter((s) => s.act >= 1).length;
  const sum = (f) => list.reduce((a, s) => a + (f(s) || 0), 0);
  const lm = sum((s) => s.lm), l3 = sum((s) => s.l3m);
  const sizes = useMemo(() => sizeRows(list), [list]);
  const days = useMemo(() => byRouteDay(list), [list]);
  const chan = useMemo(() => { const m = new Map(); for (const s of list) { const k = s.cc1 && s.cc1 !== '-' ? s.cc1 : 'Lainnya'; const e = m.get(k) || { k, act: 0, tgt: 0, n: 0 }; e.act += s.act || 0; e.tgt += s.tgt || 0; e.n++; m.set(k, e); } return [...m.values()].sort((a, b) => b.act - a.act); }, [list]);
  const cats = useMemo(() => { const ids = new Set(list.map((s) => s.id)); void ids; const m = new Map(); for (const r of catAgg(data, list)) { const k = r.k || r.b || '-'; m.set(k, (m.get(k) || 0) + (r.cur || 0)); } return [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 6); }, [data, list]);
  const top = useMemo(() => [...list].sort((a, b) => (b.act || 0) - (a.act || 0)).slice(0, 5), [list]);
  const maxCat = Math.max(1, ...cats.map((x) => x.v)), maxTop = Math.max(1, ...top.map((x) => x.act || 0));
  const totAct = chan.reduce((a, x) => a + x.act, 0) || 1;
  const prs = D.principals.map((p) => ({ p, ...(row.pr?.[p] || { act: 0, tgt: 0, acv: 0 }) })).filter((x) => x.tgt > 0 || x.act > 0);
  const kpi = [
    ['ACT', fmt.jt(act, 1), 'jt', ''], ['Target', fmt.jt(tgt, 1), 'jt', ''], ['% Ach', fmt.pct(acv, 0), '', tg ? tone(acv, tg) : ''],
    ['vs Timegone', tg ? fmt.pct(acv / tg, 0) : '-', '', tg ? tone(acv, tg) : ''], ['Gap', fmt.jt(act - tgt, 1), 'jt', ''], ['CA', `${ca}/${list.length}`, fmt.pct(list.length ? ca / list.length : 0, 0), ''],
  ];
  return (
    <div className="bd">
      <div className="bd-k">{kpi.map(([l, v, u, c]) => <div key={l} className="bd-kc"><span>{l}</span><b style={c ? { color: c } : undefined}>{v}</b>{u && <small>{u}</small>}</div>)}{tg > 0 && <div className="bd-kc"><span>Timegone</span><b>{fmt.pct(tg, 0)}</b></div>}</div>
      <div className="bd-g">
        <Tile title="Salesman" right="% ach · garis = timegone">
          {D.sales.map((s) => <Row key={s.name} label={fmt.short(s.name)} pct={s.acv} text={`${fmt.pct(s.acv, 0)} · ${fmt.jt(s.act, 0)}`} color={tone(s.acv, tg)} mark={tg} />)}
        </Tile>
        <Tile title="Principal" right="% ach">
          {prs.map((x) => <Row key={x.p} label={x.p} pct={x.acv} text={`${fmt.pct(x.acv, 0)} · ${fmt.jt(x.act, 0)}`} color={tone(x.acv, tg)} mark={tg} />)}
          {!prs.length && <div className="mut">Tidak ada data principal.</div>}
        </Tile>
        <Tile title="Ukuran toko" right="% ach · jml toko">
          {sizes.map((s) => <Row key={s.k} label={s.k} pct={s.acv} text={`${fmt.pct(s.acv || 0, 0)} · ${s.n}`} color={tone(s.acv || 0, tg)} mark={tg} />)}
        </Tile>
        <Tile title="Channel" right="porsi ACT">
          {chan.slice(0, 6).map((c) => <Row key={c.k} label={c.k} pct={c.act / totAct} text={`${fmt.pct(c.act / totAct, 0)} · ${c.n}`} color={COL.ac} />)}
        </Tile>
        <Tile title="Hari kunjungan" right="ACT (jt)">
          <Cols items={days.map((d) => ({ k: d.day, v: d.act }))} fmtV={(v) => fmt.jt(v, 0)} />
        </Tile>
        <Tile title="Tren" right="jt">
          <Cols items={[{ k: LABELS.lm, v: lm, dim: true }, { k: 'L3M', v: l3, dim: true }, { k: LABELS.cur, v: act, color: COL.ok }, ...(tg ? [{ k: 'Proyeksi', v: act / tg, color: COL.warn }] : [])]} fmtV={(v) => fmt.jt(v, 0)} />
        </Tile>
        <Tile title="Kategori teratas" right="ACT (jt)">
          {cats.map((c) => <Row key={c.k} label={c.k} pct={c.v / maxCat} text={fmt.jt(c.v, 1)} color={COL.soft} />)}
          {!cats.length && <div className="mut">Belum ada data SKU.</div>}
        </Tile>
        <Tile title="Toko teratas" right="ACT (jt)">
          {top.map((s) => <Row key={s.id} label={s.name} pct={(s.act || 0) / maxTop} text={fmt.jt(s.act, 1)} color={COL.soft} sub={s.sales} />)}
        </Tile>
      </div>
    </div>
  );
}
