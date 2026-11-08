import { useMemo } from 'react';

// Latar bergerak: gradasi + objek melayang yang terlihat jelas (jumlah mengikuti tingkat: soft / mid / lively).
const COUNT = { soft: 6, mid: 11, lively: 18 };
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export default function Backdrop({ level = 'mid', depot = 'kebayoran' }) {
  const shapes = useMemo(() => {
    const r = rnd(depot === 'kapuk' ? 91 : 37);
    const kinds = depot === 'kapuk' ? ['sq', 'hex', 'tri', 'ring'] : ['leaf', 'dia', 'dot', 'ring'];
    return Array.from({ length: 18 }, (_, i) => ({
      k: kinds[i % kinds.length], x: Math.round(r() * 96), s: 26 + Math.round(r() * 58), d: 26 + Math.round(r() * 34), delay: -Math.round(r() * 50), rot: r() < 0.5 ? 1 : -1, o: 0.35 + r() * 0.35,
    }));
  }, [depot]);
  const n = level === 'off' ? 0 : COUNT[level] || COUNT.mid;
  return (
    <div className="backdrop" aria-hidden="true" data-level={level}>
      <i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" />
      {shapes.slice(0, n).map((p, i) => (
        <span key={i} className={'shp ' + p.k} style={{ left: p.x + 'vw', width: p.s, height: p.s, animationDuration: p.d + 's', animationDelay: p.delay + 's', '--rot': p.rot * 360 + 'deg', opacity: p.o }} />
      ))}
    </div>
  );
}
