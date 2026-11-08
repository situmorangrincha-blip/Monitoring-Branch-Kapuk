import { useEffect, useRef } from 'react';

// Maskot chibi orisinal (SVG), beberapa pilihan karakter. Mata mengikuti kursor, berjalan pelan mengikuti, melompat saat klik, tidur kalau diam.
export const KINDS = [
  { id: 'sales', name: 'Sales' }, { id: 'cat', name: 'Kucing' }, { id: 'bear', name: 'Beruang' },
  { id: 'fox', name: 'Rubah' }, { id: 'robot', name: 'Robot' }, { id: 'panda', name: 'Panda' },
  { id: 'rabbit', name: 'Kelinci' }, { id: 'dog', name: 'Anjing' }, { id: 'owl', name: 'Burung hantu' }, { id: 'penguin', name: 'Pinguin' },
  { id: 'frog', name: 'Katak' }, { id: 'lion', name: 'Singa' }, { id: 'pig', name: 'Babi' }, { id: 'koala', name: 'Koala' },
  { id: 'hamster', name: 'Hamster' }, { id: 'dino', name: 'Dino' }, { id: 'chick', name: 'Anak ayam' }, { id: 'bee', name: 'Lebah' },
];
export const EXTRA_KINDS = [{ id: 'custom', name: 'Buatan lu' }, { id: 'image', name: 'Gambar lu' }];
export const DEFAULT_CUSTOM = { skin: '#ffe3d0', hair: 'short', hairC: '#3b2f4a', acc: 'none', outfit: '' };
const AN = {
  rabbit: { skin: '#f3efe9', ear: 'long', inner: '#f6b8c4', nose: '#e58fa0' },
  dog: { skin: '#e3c196', ear: 'floppy', earC: '#8a5a3b', patch: '#8a5a3b', nose: '#3a3f4a' },
  owl: { skin: '#b78a5e', ear: 'tuft', ring: '#f4e6c8', beak: '#f2b04a' },
  penguin: { skin: '#2d3445', face: '#ffffff', beak: '#f2b04a' },
  frog: { skin: '#8fcf8a', ear: 'bulge' },
  lion: { skin: '#f0b865', mane: '#c9833b', ear: 'round', nose: '#7a4b3a' },
  pig: { skin: '#f6b8c4', ear: 'point', snout: '#f0a1b1' },
  koala: { skin: '#b9c0c8', ear: 'biground', inner: '#f4f1ee', nose: '#3a3f4a' },
  hamster: { skin: '#f1cf9b', ear: 'round', cheeks: '#f8dfc0', nose: '#e58fa0' },
  dino: { skin: '#8fd1b0', spikes: '#4f9a86' },
  chick: { skin: '#f7dc6f', beak: '#f2994a', tuft: true },
  bee: { skin: '#f6cf4a', antenna: true, stripes: '#3b2f4a' },
};
const SKIN = { sales: '#ffe3d0', cat: '#ffe2bd', bear: '#b98558', fox: '#f4994a', robot: '#c4cadd', panda: '#fbfbfd', ...Object.fromEntries(Object.entries(AN).map(([k, v]) => [k, v.skin])) };

function AnimalHead({ kind, pupL, pupR }) {
  const p = AN[kind];
  return (
    <g className="mhead">
      {p.mane && <circle cx="50" cy="40" r="40" fill={p.mane} />}
      {p.ear === 'long' && (<><ellipse cx="36" cy="-2" rx="8" ry="21" fill={p.skin} /><ellipse cx="64" cy="-2" rx="8" ry="21" fill={p.skin} /><ellipse cx="36" cy="0" rx="4" ry="15" fill={p.inner} /><ellipse cx="64" cy="0" rx="4" ry="15" fill={p.inner} /></>)}
      {p.ear === 'floppy' && (<><ellipse cx="19" cy="36" rx="10" ry="19" fill={p.earC} transform="rotate(14 19 36)" /><ellipse cx="81" cy="36" rx="10" ry="19" fill={p.earC} transform="rotate(-14 81 36)" /></>)}
      {p.ear === 'tuft' && (<><path d="M22 20 26 -2 42 12z" fill={p.skin} /><path d="M78 20 74 -2 58 12z" fill={p.skin} /></>)}
      {p.ear === 'bulge' && (<><circle cx="28" cy="14" r="13" fill={p.skin} /><circle cx="72" cy="14" r="13" fill={p.skin} /></>)}
      {p.ear === 'round' && (<><circle cx="24" cy="15" r="10" fill={p.skin} /><circle cx="76" cy="15" r="10" fill={p.skin} /></>)}
      {p.ear === 'biground' && (<><circle cx="20" cy="18" r="15" fill={p.skin} /><circle cx="80" cy="18" r="15" fill={p.skin} /><circle cx="20" cy="18" r="8" fill={p.inner} /><circle cx="80" cy="18" r="8" fill={p.inner} /></>)}
      {p.ear === 'point' && (<><path d="M20 24 24 4 42 14z" fill={p.skin} /><path d="M80 24 76 4 58 14z" fill={p.skin} /></>)}
      {p.spikes && [34, 50, 66].map((x) => <path key={x} d={`M${x - 7} 12 ${x} -4 ${x + 7} 12z`} fill={p.spikes} />)}
      {p.antenna && (<><path d="M38 12 32 -4M62 12 68 -4" stroke="#3b2f4a" strokeWidth="2.5" strokeLinecap="round" /><circle cx="32" cy="-5" r="4" fill="#3b2f4a" /><circle cx="68" cy="-5" r="4" fill="#3b2f4a" /></>)}
      <circle cx="50" cy="40" r="32" fill={p.skin} />
      {p.stripes && (<><path d="M20 30q30 8 60 0" fill="none" stroke={p.stripes} strokeWidth="5" opacity=".85" /><path d="M19 44q31 8 62 0" fill="none" stroke={p.stripes} strokeWidth="5" opacity=".85" /></>)}
      {p.patch && <ellipse cx="68" cy="38" rx="12" ry="15" fill={p.patch} opacity=".9" />}
      {p.face && <ellipse cx="50" cy="48" rx="23" ry="23" fill={p.face} />}
      {p.cheeks && (<><circle cx="30" cy="52" r="10" fill={p.cheeks} /><circle cx="70" cy="52" r="10" fill={p.cheeks} /></>)}
      {p.tuft && <path d="M44 8q6-10 6 0M50 8q8-9 8 1" fill="none" stroke={p.skin} strokeWidth="3.4" strokeLinecap="round" />}
      {p.ring && (<><circle cx="38" cy="42" r="13" fill={p.ring} /><circle cx="62" cy="42" r="13" fill={p.ring} /></>)}
      <Eyes pupL={pupL} pupR={pupR} />
      {p.snout && (<><ellipse cx="50" cy="54" rx="12" ry="8.5" fill={p.snout} /><circle cx="46" cy="54" r="1.7" fill="#a85a6c" /><circle cx="54" cy="54" r="1.7" fill="#a85a6c" /></>)}
      {p.beak && <path d="M44 50 56 50 50 59z" fill={p.beak} />}
      {p.nose && <ellipse cx="50" cy="50" rx="4.2" ry="3" fill={p.nose} />}
      {!p.beak && !p.snout && <Mouth y={56} />}
    </g>
  );
}

function CustomHead({ c, pupL, pupR }) {
  const hair = c.hairC;
  return (
    <g className="mhead">
      {c.hair === 'long' && <path d="M16 38c0-24 14-34 34-34s34 10 34 34v34H70V40H30v32H16z" fill={hair} />}
      {c.hair === 'bun' && <circle cx="50" cy="3" r="11" fill={hair} />}
      <circle cx="50" cy="40" r="32" fill={c.skin} />
      {c.hair !== 'none' && <path d="M17 38c0-20 14-30 33-30s33 10 33 30c-6-9-12-13-20-15-9 5-22 6-33 3-5 3-9 7-13 12z" fill={hair} />}
      <circle cx="33" cy="50" r="5" fill="#ff9fb0" opacity=".5" /><circle cx="67" cy="50" r="5" fill="#ff9fb0" opacity=".5" />
      <Eyes pupL={pupL} pupR={pupR} /><Mouth y={55} />
      {c.acc === 'glasses' && (<><circle cx="38" cy="42" r="11" fill="none" stroke="#2b2440" strokeWidth="2.4" /><circle cx="62" cy="42" r="11" fill="none" stroke="#2b2440" strokeWidth="2.4" /><path d="M49 42h2" stroke="#2b2440" strokeWidth="2.4" /></>)}
      {c.acc === 'bow' && <path d="M66 8 82 0V16zM66 8 52 0V16z" fill="var(--ac)" />}
      {c.acc === 'phones' && (<><path d="M14 40C14 14 30 4 50 4s36 10 36 36" fill="none" stroke="#3b4358" strokeWidth="5" /><rect x="8" y="36" width="10" height="18" rx="5" fill="var(--ac)" /><rect x="82" y="36" width="10" height="18" rx="5" fill="var(--ac)" /></>)}
      {c.acc === 'hat' && (<><path d="M18 22C20 4 80 4 82 22z" fill="var(--ac-d)" /><path d="M16 22H96" stroke="var(--ac-d)" strokeWidth="6" strokeLinecap="round" /></>)}
    </g>
  );
}
const SIZES = { sm: 64, md: 84, lg: 110 };
const DIST = { near: [46, 34], mid: [90, 60], far: [160, 100] };

function Eyes({ pupL, pupR, white = '#fff', pupil = '#2b2440', y = 42 }) {
  return (
    <>
      <g className="meyes">
        <ellipse cx="38" cy={y} rx="6.5" ry="8" fill={white} /><ellipse cx="62" cy={y} rx="6.5" ry="8" fill={white} />
        <g ref={pupL}><circle cx="38" cy={y + 1} r="4.6" fill={pupil} /><circle cx="36.5" cy={y - 1} r="1.5" fill="#fff" /></g>
        <g ref={pupR}><circle cx="62" cy={y + 1} r="4.6" fill={pupil} /><circle cx="60.5" cy={y - 1} r="1.5" fill="#fff" /></g>
      </g>
      <g className="mclosed"><path d={`M32 ${y + 1}q6 5 12 0M56 ${y + 1}q6 5 12 0`} fill="none" stroke="#2b2440" strokeWidth="2.4" strokeLinecap="round" /></g>
    </>
  );
}
const Mouth = ({ y = 55, c = '#7a4b4b' }) => (
  <>
    <path className="msmile" d={`M44 ${y}q6 6 12 0`} fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
    <ellipse className="mo" cx="50" cy={y + 2} rx="3.4" ry="4" fill={c} />
  </>
);
const Cheeks = () => (<><circle cx="32" cy="50" r="5" fill="#ff9fb0" opacity=".5" /><circle cx="68" cy="50" r="5" fill="#ff9fb0" opacity=".5" /></>);

function Head({ kind, pupL, pupR, custom }) {
  if (AN[kind]) return <AnimalHead kind={kind} pupL={pupL} pupR={pupR} />;
  if (kind === 'custom') return <CustomHead c={{ ...DEFAULT_CUSTOM, ...(custom || {}) }} pupL={pupL} pupR={pupR} />;
  switch (kind) {
    case 'cat': return (
      <g className="mhead">
        <path d="M21 22 25 -2 44 12z" fill="#f0a35e" /><path d="M79 22 75 -2 56 12z" fill="#f0a35e" />
        <path d="M26 17 28 5 38 13z" fill="#ffb6c1" /><path d="M74 17 72 5 62 13z" fill="#ffb6c1" />
        <circle cx="50" cy="40" r="32" fill="#ffe2bd" />
        <path d="M50 9v9M42 10l2 8M58 10l-2 8" stroke="#f0a35e" strokeWidth="3" strokeLinecap="round" />
        <Cheeks /><Eyes pupL={pupL} pupR={pupR} />
        <path d="M47 50l3 3 3-3z" fill="#e57a8a" /><Mouth y={55} />
        <path d="M22 50h-10M22 55l-9 3M78 50h10M78 55l9 3" stroke="#b9987a" strokeWidth="1.4" strokeLinecap="round" />
      </g>);
    case 'bear': return (
      <g className="mhead">
        <circle cx="24" cy="15" r="11" fill="#9b6b43" /><circle cx="76" cy="15" r="11" fill="#9b6b43" />
        <circle cx="24" cy="15" r="5.5" fill="#d9a77a" /><circle cx="76" cy="15" r="5.5" fill="#d9a77a" />
        <circle cx="50" cy="40" r="32" fill="#b98558" />
        <ellipse cx="50" cy="53" rx="13" ry="10" fill="#ecd2b0" />
        <Cheeks /><Eyes pupL={pupL} pupR={pupR} /><ellipse cx="50" cy="49" rx="4.2" ry="3" fill="#4a3426" /><Mouth y={55} c="#4a3426" />
      </g>);
    case 'fox': return (
      <g className="mhead">
        <path d="M18 26 22 -4 46 14z" fill="#f08a3c" /><path d="M82 26 78 -4 54 14z" fill="#f08a3c" />
        <path d="M22 -4 25.5 6 18 8z" fill="#3b2a22" /><path d="M78 -4 74.5 6 82 8z" fill="#3b2a22" />
        <circle cx="50" cy="40" r="32" fill="#f4994a" />
        <path d="M18 46c12 2 22 8 32 16 10-8 20-14 32-16-2 14-14 26-32 26S20 60 18 46z" fill="#fff4e6" />
        <Cheeks /><Eyes pupL={pupL} pupR={pupR} /><ellipse cx="50" cy="52" rx="4" ry="3" fill="#3b2a22" /><Mouth y={56} c="#3b2a22" />
      </g>);
    case 'panda': return (
      <g className="mhead">
        <circle cx="24" cy="14" r="11" fill="#2b2b36" /><circle cx="76" cy="14" r="11" fill="#2b2b36" />
        <circle cx="50" cy="40" r="32" fill="#fbfbfd" />
        <ellipse cx="37" cy="43" rx="10" ry="12" fill="#2b2b36" transform="rotate(18 37 43)" /><ellipse cx="63" cy="43" rx="10" ry="12" fill="#2b2b36" transform="rotate(-18 63 43)" />
        <Eyes pupL={pupL} pupR={pupR} pupil="#14141c" /><ellipse cx="50" cy="51" rx="4" ry="3" fill="#2b2b36" /><Mouth y={56} c="#2b2b36" />
        <circle cx="30" cy="54" r="4.5" fill="#ffb4c0" opacity=".55" /><circle cx="70" cy="54" r="4.5" fill="#ffb4c0" opacity=".55" />
      </g>);
    case 'robot': return (
      <g className="mhead">
        <path d="M50 8V-2" stroke="#8a93ad" strokeWidth="3" /><circle cx="50" cy="-4" r="4.5" fill="var(--ac)" />
        <rect x="19" y="10" width="62" height="56" rx="18" fill="#e4e8f4" stroke="#c4cadd" strokeWidth="1.5" />
        <rect x="26" y="24" width="48" height="32" rx="12" fill="#2a2f45" />
        <g className="meyes"><g ref={pupL}><circle cx="38" cy="40" r="6" fill="#7ee7ff" /><circle cx="36.5" cy="38" r="1.8" fill="#fff" /></g><g ref={pupR}><circle cx="62" cy="40" r="6" fill="#7ee7ff" /><circle cx="60.5" cy="38" r="1.8" fill="#fff" /></g></g>
        <g className="mclosed"><path d="M32 41h12M56 41h12" stroke="#7ee7ff" strokeWidth="3" strokeLinecap="round" /></g>
        <path className="msmile" d="M44 52q6 4 12 0" fill="none" stroke="#7ee7ff" strokeWidth="2" strokeLinecap="round" /><ellipse className="mo" cx="50" cy="52" rx="3" ry="3.2" fill="#7ee7ff" />
        <circle cx="19" cy="38" r="4" fill="#c4cadd" /><circle cx="81" cy="38" r="4" fill="#c4cadd" />
      </g>);
    default: return (
      <g className="mhead">
        <circle cx="50" cy="40" r="32" fill="#ffe3d0" />
        <path d="M17 38c0-20 14-30 33-30s33 10 33 30c-6-9-12-13-20-15-9 5-22 6-33 3-5 3-9 7-13 12z" fill="#3b2f4a" />
        <path d="M62 10c10 1 16 8 14 16" fill="none" stroke="var(--ac)" strokeWidth="6" strokeLinecap="round" />
        <Cheeks /><Eyes pupL={pupL} pupR={pupR} /><Mouth y={55} />
      </g>);
  }
}

export function CharSvg({ kind = 'sales', width = 84, pupL, pupR, custom, img }) {
  if (kind === 'image') return img ? <img className="mimg" src={img} width={width} alt="" draggable={false} /> : <svg viewBox="0 0 10 10" width={width} height={width}><circle cx="5" cy="5" r="4" fill="#ddd" /></svg>;
  const robot = kind === 'robot';
  const cu = { ...DEFAULT_CUSTOM, ...(custom || {}) };
  const armC = kind === 'custom' ? cu.skin : SKIN[kind];
  const outfit = kind === 'custom' && cu.outfit ? cu.outfit : 'var(--ac)';
  return (
    <svg viewBox="-4 -12 108 128" width={width} height={width * 1.19} overflow="visible">
      <ellipse className="msh" cx="50" cy="106" rx="24" ry="4.5" fill="rgba(35,36,58,.18)" />
      <g className="mbody">
        <g className="mleg l"><rect x="38" y="84" width="9" height="18" rx="4.5" fill="#5b5f83" /><ellipse cx="42" cy="103" rx="8" ry="4" fill="#fff" stroke="#d4d6e6" /></g>
        <g className="mleg r"><rect x="53" y="84" width="9" height="18" rx="4.5" fill="#5b5f83" /><ellipse cx="58" cy="103" rx="8" ry="4" fill="#fff" stroke="#d4d6e6" /></g>
        <rect x="31" y="62" width="38" height="30" rx="14" fill={outfit} />
        <rect x="44" y="66" width="12" height="14" rx="3" fill="#fff" opacity=".92" /><rect x="46.5" y="69" width="7" height="2" rx="1" fill="var(--ac)" /><rect x="46.5" y="73" width="5" height="2" rx="1" fill="var(--ac-line)" />
        <circle className="marm l" cx="28" cy="76" r="6" fill={armC} />
        <circle className="marm r" cx="72" cy="76" r="6" fill={armC} />
        <Head kind={kind} pupL={pupL} pupR={pupR} custom={custom} />
      </g>
      <text className="mz" x="76" y="6" fontSize="14" fill="var(--ac-d)" fontWeight="700">z</text>
      <text className="mz z2" x="86" y="-4" fontSize="10" fill="var(--ac-d)" fontWeight="700">z</text>
    </svg>
  );
}

export default function Mascot({ kind = 'sales', size = 'md', dist = 'mid', custom, img }) {
  const root = useRef(null);
  const pupL = useRef(null);
  const pupR = useRef(null);
  const cfg = useRef({ W: SIZES.md, off: DIST.mid });
  cfg.current = { W: SIZES[size] || SIZES.md, off: DIST[dist] || DIST.mid };
  const st = useRef({ x: 40, y: 0, tx: 40, ty: 0, face: 1, idle: 0, sleep: false, hop: 0, blink: 0, wander: 0 });

  useEffect(() => {
    const el = root.current;
    const s = st.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    s.x = 24; s.y = window.innerHeight - cfg.current.W * 1.2 - 20; s.tx = s.x; s.ty = s.y;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2, last = performance.now(), raf;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const wake = () => { s.idle = 0; if (s.sleep) { s.sleep = false; el.classList.remove('sleep'); } };
    const move = (e) => { mx = e.clientX; my = e.clientY; wake(); s.wander = 0; };
    const click = (e) => { mx = e.clientX; my = e.clientY; wake(); if (!s.hop) { s.hop = 1; el.classList.add('hop'); setTimeout(() => { s.hop = 0; el.classList.remove('hop'); }, 520); } };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', click, true);
    const tick = (now) => {
      const { W, off } = cfg.current;
      const H = W * 1.2;
      const dt = Math.min(64, now - last); last = now;
      s.idle += dt;
      if (!s.sleep && s.idle > 90000) { s.sleep = true; el.classList.add('sleep'); }
      if (!s.sleep) {
        const gx = clamp(mx + off[0], 8, window.innerWidth - W - 8);
        const gy = clamp(my + off[1], 8, window.innerHeight - H - 8);
        const dist2 = Math.hypot(gx - s.x, gy - s.y);
        if (s.idle > 9000 && dist2 < 140) {
          s.wander -= dt;
          if (s.wander <= 0) { s.tx = clamp(s.x + (Math.random() - 0.5) * 300, 8, window.innerWidth - W - 8); s.ty = clamp(window.innerHeight - H - 16 - Math.random() * 60, 8, window.innerHeight - H - 8); s.wander = 4000 + Math.random() * 3000; }
        } else { s.tx = gx; s.ty = gy; }
        if (!reduce) { s.x += (s.tx - s.x) * Math.min(1, dt * 0.0022); s.y += (s.ty - s.y) * Math.min(1, dt * 0.0022); } else { s.x = s.tx; s.y = s.ty; }
        const speed = Math.hypot(s.tx - s.x, s.ty - s.y);
        if (Math.abs(s.tx - s.x) > 6) s.face = s.tx > s.x ? 1 : -1;
        el.classList.toggle('walk', speed > 14 && !reduce);
      } else el.classList.remove('walk');
      el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      el.firstChild.style.transform = `scaleX(${s.face})`;
      const cx = s.x + W / 2, cy = s.y + W * 0.45;
      const a = Math.atan2(my - cy, mx - cx);
      const d = s.sleep ? 0 : 2.2;
      const ox = Math.cos(a) * d * (s.face === 1 ? 1 : -1), oy = Math.sin(a) * d;
      pupL.current?.setAttribute('transform', `translate(${ox} ${oy})`);
      pupR.current?.setAttribute('transform', `translate(${ox} ${oy})`);
      s.blink -= dt;
      if (s.blink <= 0) { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 140); s.blink = 2500 + Math.random() * 3500; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); document.removeEventListener('pointerdown', click, true); };
  }, []);

  const W = SIZES[size] || SIZES.md;
  return (
    <div className="mascot" ref={root} aria-hidden="true" style={{ width: W }}>
      <div className="mflip"><CharSvg kind={kind} width={W} pupL={pupL} pupR={pupR} custom={custom} img={img} /></div>
    </div>
  );
}
