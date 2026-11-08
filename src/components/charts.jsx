import { useId } from 'react';

// Grafik gaya infografis: datar, lembut, tanpa garis tepi tebal. Digambar sendiri (tanpa library).
export const PAL = ['#4f94a6', '#f0a77c', '#f2c36b', '#7aa89a', '#d98b6a', '#6f8fa3'];
const INK = '#34495a';
const GRID = '#e7e0d3';
const clamp = (v) => Math.max(0, Math.min(1, v));

function niceMax(max) {
  if (!(max > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const m = max / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return n * p;
}
const wrapLabel = (s, n = 11) => {
  s = String(s ?? '');
  if (s.length <= n) return [s];
  const cut = s.lastIndexOf(' ', n);
  if (cut > 2) { const a = s.slice(0, cut); const b = s.slice(cut + 1); return [a, b.length > n ? b.slice(0, n - 1) + '…' : b]; }
  return [s.slice(0, n - 1) + '…'];
};

export function Legend({ items }) {
  return (<div className="legend">{items.map((x) => (<span key={x.name}><i style={{ background: x.color }} />{x.name}</span>))}</div>);
}

// ---- batang horizontal ----
export function HBars({ rows, max, refv, fmtV = (v) => v, color = 'var(--ac2)', labelW = 128 }) {
  const m = max ?? Math.max(0.0001, ...rows.map((r) => r.v), refv || 0);
  return (
    <div className="hb">
      {rows.map((r) => (
        <div className="hb-row" key={r.label}>
          <span className="hb-l" style={{ width: labelW }} title={r.label}>{r.label}</span>
          <div className="bar"><i style={{ width: clamp(r.v / m) * 100 + '%', backgroundColor: r.color || color }} />{refv != null && <b style={{ left: clamp(refv / m) * 100 + '%' }} />}</div>
          <span className="hb-v">{r.text ?? fmtV(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- batang vertikal berkelompok: ujung atas membulat, tumbuh dari bawah ----
export function GroupedBars({ groups, series, h = 240, fmtV = (v) => v, refv, refLabel, yMax, showVals = true, wide = false }) {
  const W = wide ? 1040 : 520, L = 46, R = 10, T = 16, B = 44;
  const ch = h - T - B, cw = W - L - R;
  const dataMax = Math.max(0, ...groups.flatMap((g) => g.vals.map((v) => v || 0)), refv || 0);
  const Y = yMax ?? niceMax(dataMax);
  const gw = cw / Math.max(1, groups.length);
  const bw = Math.min(wide ? 48 : 34, (gw * 0.74) / series.length);
  const y = (v) => T + ch - clamp(v / Y) * ch;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(Y * t)} y2={y(Y * t)} stroke={GRID} strokeWidth="1" />
          <text x={L - 8} y={y(Y * t) + 4} textAnchor="end" className="ch-t">{fmtV(Y * t)}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const x0 = L + gi * gw + (gw - bw * series.length) / 2;
        const lab = wrapLabel(g.label);
        return (
          <g key={g.label + gi}>
            <title>{g.label}</title>
            {series.map((s, si) => {
              const v = g.vals[si] || 0;
              const bh = Math.max(v > 0 ? 3 : 0, clamp(v / Y) * ch);
              const x = x0 + si * bw;
              return (
                <g key={s.name}>
                  <rect className="barY" style={{ animationDelay: (gi * 40 + si * 60) + 'ms' }} x={x + 2} y={T + ch - bh} width={bw - 4} height={bh} rx={Math.min(7, (bw - 4) / 2)} fill={s.color} />
                  {showVals && v > 0 && series.length <= 3 && groups.length <= 8 && <text x={x + bw / 2} y={y(v) - 6} textAnchor="middle" className="ch-v">{fmtV(v)}</text>}
                </g>
              );
            })}
            {lab.map((l, k) => <text key={k} x={L + gi * gw + gw / 2} y={h - B + 17 + k * 12} textAnchor="middle" className="ch-t">{l}</text>)}
          </g>
        );
      })}
      {refv != null && (
        <g>
          <line x1={L} x2={W - R} y1={y(refv)} y2={y(refv)} stroke="#d9604f" strokeWidth="1.6" strokeDasharray="6 5" />
          {refLabel && <text x={W - R - 2} y={y(refv) - 6} textAnchor="end" className="ch-ref">{refLabel}</text>}
        </g>
      )}
    </svg>
  );
}

// ---- donat halus dengan ujung membulat (tampilan kontribusi) ----
export function PixelDonut({ items, center, sub, size = 190 }) {
  const total = items.reduce((a, x) => a + Math.max(0, x.v), 0) || 1;
  const c = size / 2, r = size * 0.36, sw = size * 0.13, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img">
        <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth={sw} />
        {items.map((x, i) => {
          const frac = Math.max(0, x.v) / total;
          const len = Math.max(0, frac * C - (items.length > 1 ? 4 : 0));
          const off = -acc * C;
          acc += frac;
          return <circle key={x.label} className="arc" style={{ animationDelay: i * 90 + 'ms', '--len': len, '--c': C }} cx={c} cy={c} r={r} fill="none" stroke={x.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${len} ${C}`} strokeDashoffset={off} transform={`rotate(-90 ${c} ${c})`} />;
        })}
        <text x={c} y={c + 6} textAnchor="middle" className="ch-big">{center}</text>
        {sub && <text x={c} y={c + 24} textAnchor="middle" className="ch-t">{sub}</text>}
      </svg>
      <div className="donut-leg">
        {items.map((x) => (<div key={x.label}><i style={{ background: x.color }} /><span>{x.label}</span><b>{(Math.max(0, x.v) / total * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%</b></div>))}
      </div>
    </div>
  );
}

// ---- cincin konsentris: pencapaian per item vs 100% ----
export function Rings({ items, size = 220, center, sub }) {
  const c = size / 2, gap = 6;
  const n = Math.max(1, items.length);
  const sw = Math.min(16, (size / 2 - 26 - gap * (n - 1)) / n);
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" style={{ width: size, height: size }} role="img">
        {items.map((x, i) => {
          const r = size / 2 - 8 - sw / 2 - i * (sw + gap);
          const C = 2 * Math.PI * r;
          const len = Math.max(0.001, clamp(x.v)) * C;
          return (
            <g key={x.label}>
              <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth={sw} />
              <circle className="arc" style={{ animationDelay: i * 110 + 'ms', '--len': len, '--c': C }} cx={c} cy={c} r={r} fill="none" stroke={x.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${len} ${C}`} transform={`rotate(-90 ${c} ${c})`} />
            </g>
          );
        })}
        {center && <text x={c} y={c + 6} textAnchor="middle" className="ch-big">{center}</text>}
        {sub && <text x={c} y={c + 24} textAnchor="middle" className="ch-t">{sub}</text>}
      </svg>
      <div className="donut-leg">
        {items.map((x) => (<div key={x.label}><i style={{ background: x.color }} /><span>{x.label}</span><b>{x.text ?? Math.round(x.v * 100) + '%'}</b></div>))}
      </div>
    </div>
  );
}

// ---- garis lengkung dengan area bawah (tren) ----
export function LineChart({ series, xMax, yMax, h = 240, fmtY = (v) => v, refLine, xLabel = (x) => x, wide = false }) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const W = wide ? 1040 : 520, L = 50, R = 12, T = 14, B = 34;
  const ch = h - T - B, cw = W - L - R;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.pts.map((p) => p[1])), ...(refLine ? refLine.pts.map((p) => p[1]) : []));
  const Y = yMax ?? niceMax(dataMax * 1.05);
  const X = Math.max(1, xMax);
  const x = (v) => L + (v / X) * cw;
  const y = (v) => T + ch - clamp(v / Y) * ch;
  const xs = Array.from({ length: X + 1 }, (_, i) => i).filter((i) => X <= 14 || i % Math.ceil(X / 14) === 0);
  const path = (pts) => pts.map((p, i) => {
    if (i === 0) return `M${x(p[0])},${y(p[1])}`;
    const q = pts[i - 1]; const mx = (x(q[0]) + x(p[0])) / 2;
    return `C${mx},${y(q[1])} ${mx},${y(p[1])} ${x(p[0])},${y(p[1])}`;
  }).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img">
      <defs>{series.map((s, i) => (<linearGradient key={s.name} id={`g${uid}${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".32" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>))}</defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}><line x1={L} x2={W - R} y1={y(Y * t)} y2={y(Y * t)} stroke={GRID} strokeWidth="1" /><text x={L - 8} y={y(Y * t) + 4} textAnchor="end" className="ch-t">{fmtY(Y * t)}</text></g>
      ))}
      {xs.map((i) => <text key={i} x={x(i)} y={h - B + 18} textAnchor="middle" className="ch-t">{xLabel(i)}</text>)}
      {refLine && <path d={path(refLine.pts)} fill="none" stroke="#d9604f" strokeWidth="1.8" strokeDasharray="6 5" />}
      {series.map((s, i) => (
        <g key={s.name}>
          {s.pts.length > 1 && <path d={`${path(s.pts)} L${x(s.pts[s.pts.length - 1][0])},${T + ch} L${x(s.pts[0][0])},${T + ch} Z`} fill={`url(#g${uid}${i})`} />}
          {s.pts.length > 1 && <path className="lineDraw" pathLength="1" d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          {s.pts.map((p, k) => <circle key={k} cx={x(p[0])} cy={y(p[1])} r="3.6" fill="#fff" stroke={s.color} strokeWidth="2.4" />)}
        </g>
      ))}
    </svg>
  );
}

// ---- pita langkah "STEP 01 > 02 > 03" ----
export function Steps({ steps }) {
  const cols = ['#4f94a6', '#f0a77c', '#f2c36b', '#7aa89a'];
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={s.label} className="step" style={{ '--sc': cols[i % cols.length] }}>
          <span className="sn">{String(i + 1).padStart(2, '0')}</span>
          <div><b>{s.label}</b><small>{s.text}</small></div>
        </div>
      ))}
    </div>
  );
}
export const ArrowStat = ({ v, label, up = true }) => (
  <div className="arrowstat"><span className={up ? 'up' : 'dn'}>{up ? '▲' : '▼'}</span><b>{v}</b><small>{label}</small></div>
);
