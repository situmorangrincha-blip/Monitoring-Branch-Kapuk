import { useEffect, useMemo, useRef, useState } from 'react';
import { createGery, webglOk } from '../lib/geryRobot.js';
import { buildScenes } from '../lib/geryScenes.js';
import './gery.css';

const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const GREET = ['Halo, gue GERY! Klik panel mana pun, nanti gue jelasin.', 'Geli, hehe. Coba tekan › untuk lanjut ke bagian berikutnya.', 'Gue baca angka dari data lu, jadi aman. Ayo kita bahas.'];

// teks narasi hanya boleh memakai <b>; selain itu semuanya ditampilkan sebagai teks biasa (aman dari karakter aneh di nama toko)
function segs(html) { const out = []; let bold = false; String(html || '').split(/(<\/?b>)/).forEach((t) => { if (t === '<b>') bold = true; else if (t === '</b>') bold = false; else if (t) out.push({ b: bold, t }); }); return out; }
function Rich({ html, upTo = Infinity }) {
  let left = upTo;
  return segs(html).map((s, i) => { if (left <= 0) return null; const t = s.t.slice(0, left); left -= t.length; return s.b ? <b key={i}>{t}</b> : <span key={i}>{t}</span>; });
}
const plainLen = (html) => segs(html).reduce((a, s) => a + s.t.length, 0);

function Ring({ pct, big }) { const r = 34, c = 2 * Math.PI * r; return (<svg className="gy-ring" viewBox="0 0 84 84"><circle className="tr" cx="42" cy="42" r={r} /><circle className="pg" cx="42" cy="42" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(pct || 0, 0), 1))} transform="rotate(-90 42 42)" /><text x="42" y="48" textAnchor="middle">{big}</text></svg>); }
const Bar = ({ pct, tone = '' }) => <div className={'gy-bar2 ' + tone}><span style={{ width: `${Math.max(2, Math.min(100, (pct || 0) * 100))}%` }} /></div>;

function PanelBody({ p }) {
  if (p.kind === 'ring') return (<>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Ring pct={p.pct} big={Math.round((p.pct || 0) * 100) + '%'} /><div><div className="gy-big">{p.big}<small>{p.bigSub}</small></div><div className="gy-mut">{p.sub}</div></div></div>
    {p.bar && <><div className="gy-row"><span className="gy-mut">{p.bar.label}</span><b>{p.bar.val}</b></div><Bar pct={p.bar.pct} tone={p.bar.tone} /></>}
  </>);
  if (p.kind === 'months') return (<>
    <div className="gy-big">{p.big}<small>{p.bigSub}</small></div><Bar pct={p.pct} tone={p.tone} />
    <div className="gy-seg3">{p.months.map((m) => <div key={m.k}><small>{m.label}</small><Bar pct={m.pct} tone={m.tone} /></div>)}</div>
    <div className="gy-mut">{p.foot}</div>
  </>);
  if (p.kind === 'kv') return (<>
    <div className="gy-big">{p.big}<small>{p.bigSub}</small></div>
    <div className="gy-rows">{p.rows.map((r, i) => <div key={i} className="gy-row"><span className="gy-mut">{r.k}</span><b>{r.v}</b></div>)}</div>
    {p.bar && <Bar pct={p.bar.pct} tone={p.bar.tone} />}
  </>);
  return (<>
    <div className="gy-rows">{p.rows.map((r, i) => <div key={i}><div className="gy-row"><b>{r.label}</b><span className="gy-chip">{r.right}</span></div><Bar pct={r.pct} tone={r.tone} /></div>)}</div>
    {p.foot && <div className="gy-mut">{p.foot}</div>}
  </>);
}

function Card({ p, focus, tilt, onPick, onOpen }) {
  const ref = useRef(null);
  const move = (e) => { if (!tilt) return; const el = ref.current, r = el.getBoundingClientRect(); el.classList.add('hov'); el.style.setProperty('--ty', (((e.clientX - r.left) / r.width) - 0.5) * 10 + 'deg'); el.style.setProperty('--tx', (-(((e.clientY - r.top) / r.height) - 0.5)) * 8 + 'deg'); };
  const leave = () => { const el = ref.current; el.classList.remove('hov'); el.style.setProperty('--ty', '0deg'); el.style.setProperty('--tx', '0deg'); };
  return (
    <article ref={ref} className={'gy-card' + (focus ? ' focus' : '')} data-pid={p.id} onClick={onPick} onPointerMove={move} onPointerLeave={leave}>
      <h3>{p.title}<i /></h3>
      <PanelBody p={p} />
      <button type="button" className="gy-more" onClick={(e) => { e.stopPropagation(); onOpen(p); }}>Buka detail ›</button>
    </article>
  );
}

export default function Gery({ data, time, mode, depot, team, onOpen }) {
  const [anon, setAnon] = useState(false);
  const scenes = useMemo(() => buildScenes({ data, time, mode, depot, team, anon }), [data, time, mode, depot, team, anon]);
  const firstOk = scenes.find((s) => !s.off);
  const [sid, setSid] = useState(() => { const v = ls('sm_gery_scene', ''); return scenes.some((s) => s.id === v && !s.off) ? v : firstOk?.id; });
  const scene = scenes.find((s) => s.id === sid && !s.off) || firstOk;
  const steps = scene?.steps || [];
  const [step, setStep] = useState(0);
  const [vm, setVm] = useState(() => { const v = ls('sm_gery_view', ''); return v || (window.innerWidth < 760 ? 'lite' : webglOk() ? '3d' : 'std'); });
  const [dark, setDark] = useState(() => ls('sm_gery_dark', false));
  const [auto, setAuto] = useState(false);
  const [fps, setFps] = useState('');
  const [ready, setReady] = useState(0);
  const [over, setOver] = useState(null);
  const [typed, setTyped] = useState({ n: 0, done: false });
  const rootRef = useRef(null), canvasRef = useRef(null), boardRef = useRef(null), pathRef = useRef(null), d1 = useRef(null), d2 = useRef(null), gRef = useRef(null), greetI = useRef(0), tRef = useRef(null);
  const cur = steps[Math.min(step, Math.max(0, steps.length - 1))];

  useEffect(() => sv('sm_gery_scene', scene?.id || ''), [scene?.id]);
  useEffect(() => sv('sm_gery_view', vm), [vm]);
  useEffect(() => sv('sm_gery_dark', dark), [dark]);
  useEffect(() => { setStep(0); setOver(null); }, [scene?.id]);

  // robot 3D (dibuat ulang tiap mode berubah)
  const robotOn = vm !== 'std' && !!scene;
  useEffect(() => {
    if (!robotOn) return undefined;
    let g = null, ro = null, dead = false;
    // dibuat setelah layar selesai digambar, supaya pindah mode tidak terasa macet
    const t = setTimeout(() => {
      if (dead || !canvasRef.current || !boardRef.current) return;
      g = createGery({
        canvas: canvasRef.current, board: boardRef.current, link: { path: pathRef.current, dot: d1.current, dot2: d2.current },
        getAccent: () => getComputedStyle(rootRef.current).getPropertyValue('--gy-acc').trim() || '#c9683b',
        onFps: (f, deg) => setFps(`${f} fps${deg ? ' · hemat' : ''}`),
        onGreet: () => { setOver({ title: 'GERY', tx: GREET[greetI.current++ % GREET.length] }); },
      });
      if (!g) { setVm('std'); return; }
      gRef.current = g; g.setMode(vm === 'lite' ? 'lite' : '3d'); g.setTheme(dark);
      ro = new ResizeObserver(() => g.resize()); ro.observe(boardRef.current); setReady((n) => n + 1);
    }, 40);
    return () => { dead = true; clearTimeout(t); if (ro) ro.disconnect(); if (g) { g.destroy(); } gRef.current = null; };
  }, [robotOn, vm]); // eslint-disable-line
  useEffect(() => { gRef.current?.setTheme(dark); }, [dark]);

  // fokus robot mengikuti langkah
  useEffect(() => {
    const g = gRef.current; if (!g || !cur) return;
    const el = cur.pid && boardRef.current ? boardRef.current.querySelector(`[data-pid="${cur.pid}"]`) : null;
    const p = scene.panels.find((x) => x.id === cur.pid);
    g.setFocus(vm === 'lite' ? null : el, p ? (p.side === 'L' ? -1 : 1) : 0); g.setExpr(cur.expr);
    setOver(null);
  }, [cur, scene, vm, robotOn, ready]);

  // GERY "mengetik": mulut bergerak selama teks muncul
  const text = over ? over.tx : cur?.tx || '';
  useEffect(() => {
    clearInterval(tRef.current); const total = plainLen(text); let n = 0; setTyped({ n: 0, done: false }); gRef.current?.setSpeaking(true);
    tRef.current = setInterval(() => { n += 3; if (n >= total) { clearInterval(tRef.current); setTyped({ n: total, done: true }); gRef.current?.setSpeaking(false); } else setTyped({ n, done: false }); }, 16);
    return () => { clearInterval(tRef.current); gRef.current?.setSpeaking(false); };
  }, [text, robotOn]);

  const go = (i) => { if (!steps.length) return; setStep((i + steps.length) % steps.length); };
  useEffect(() => {
    const k = (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') go(step + 1); if (e.key === 'ArrowLeft') go(step - 1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line
  useEffect(() => { if (!auto) return undefined; const t = setInterval(() => setStep((s) => (s + 1) % Math.max(1, steps.length)), 9000); return () => clearInterval(t); }, [auto, steps.length]);
  const fullscreen = () => { try { const el = rootRef.current; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen(); } catch { /* abaikan */ } };
  const open = (p) => { if (p.open && onOpen) onOpen(...p.open); };
  const pick = (id) => { const i = steps.findIndex((s) => s.pid === id); if (i >= 0) go(i); };
  useEffect(() => { if (vm === 'lite') { const c = boardRef.current?.parentElement?.querySelector('.gy-scroll .gy-card.focus'); if (c) c.parentElement.scrollTo({ left: c.offsetLeft - 16, behavior: 'smooth' }); } }, [cur, vm]);

  const note = vm === '3d' ? 'Mode Presentasi 3D: GERY di tengah, panel data mengelilingi. Panah keyboard untuk lanjut · seret GERY untuk memutar · klik GERY untuk menyapa.' : vm === 'std' ? 'Mode Standar: tanpa 3D, paling ringan. Wawasan yang sama dalam bentuk daftar.' : 'Mode Ringan (HP/tab): GERY kecil di atas, bubble di bawahnya, panel digeser ke samping.';
  const left = scene?.panels.filter((p) => p.side === 'L') || [], right = scene?.panels.filter((p) => p.side === 'R') || [];
  const has = !!cur?.pid && vm === '3d';
  const bubble = (
    <div className="gy-bubble">
      <div className="hd"><span className="gy-av">G</span><b>{over ? over.title : cur?.title}</b><span className="gy-chip">Rumus ✓</span></div>
      <div className="gy-tx">{typed.done ? <Rich html={text} /> : <Rich html={text} upTo={typed.n} />}</div>
      <div className="gy-sg">{!over && typed.done && cur?.sg ? <Rich html={'Saran: ' + cur.sg} /> : null}</div>
      <div className="gy-act"><label className="gy-tog"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Anonimkan nama (untuk presentasi)</label><span className="gy-mut">Angka dihitung dari data tim lu. Penjelasan AI belum diaktifkan.</span></div>
    </div>
  );

  return (
    <div ref={rootRef} className={'gy gy-' + vm + (dark ? ' dark' : '')}>
      <div className="gy-bar">
        <span className="gy-lab">TOPIK</span>
        <div className="seg">{scenes.map((s) => <button key={s.id} className={scene?.id === s.id ? 'on' : ''} disabled={!!s.off} title={s.off || ''} onClick={() => setSid(s.id)}>{s.label}</button>)}</div>
        <span className="gy-lab">MODE</span>
        <div className="seg">{[['3d', 'Presentasi 3D'], ['std', 'Standar'], ['lite', 'Ringan (HP)']].map(([v, l]) => <button key={v} className={vm === v ? 'on' : ''} onClick={() => setVm(v)}>{l}</button>)}</div>
        <span className="gy-lab">TEMA</span>
        <div className="seg">{[[false, 'Terang'], [true, 'Gelap']].map(([v, l]) => <button key={l} className={dark === v ? 'on' : ''} onClick={() => setDark(v)}>{l}</button>)}</div>
        <span className="gy-fps">{vm !== 'std' ? fps : ''}</span>
      </div>
      <div className="gy-note">{note}</div>
      <div className="gy-shell">
        {!scene ? (
          <div className="gy-off"><h3>GERY belum punya data untuk dibahas</h3><div className="gy-mut">{scenes.map((s) => <div key={s.id}><b>{s.label}:</b> {s.off}</div>)}</div></div>
        ) : (
          <div className={'gy-stage' + (has ? ' gy-has' : '')}>
            {vm === 'std' ? (
              <>
                <div className="gy-grid">{scene.panels.map((p) => <Card key={p.id} p={p} tilt={false} focus={false} onPick={() => {}} onOpen={open} />)}</div>
                <div className="gy-insights"><h4>Wawasan GERY ({scene.label})</h4><ul style={{ margin: 0, paddingLeft: 18 }}>{steps.slice(1).map((s) => <li key={s.pid}><b>{s.title}:</b> <Rich html={s.tx} /> <i style={{ color: 'var(--gy-mut)' }}>Saran: <Rich html={s.sg} /></i></li>)}</ul></div>
              </>
            ) : (
              <>
                <div className="gy-board" ref={boardRef}>
                  <canvas className="gy-gl" ref={canvasRef} />
                  <svg className="gy-link"><path ref={pathRef} d="" /><circle ref={d1} r="5" /><circle ref={d2} className="d2" r="4" /></svg>
                  {vm === '3d' ? (<>
                    <section className="gy-col l">{left.map((p) => <Card key={p.id} p={p} tilt focus={cur?.pid === p.id} onPick={() => pick(p.id)} onOpen={open} />)}</section>
                    <div className="gy-sp" />
                    <section className="gy-col r">{right.map((p) => <Card key={p.id} p={p} tilt focus={cur?.pid === p.id} onPick={() => pick(p.id)} onOpen={open} />)}</section>
                  </>) : null}
                </div>
                {vm === 'lite' ? <div className="gy-scroll">{scene.panels.map((p) => <Card key={p.id} p={p} tilt={false} focus={cur?.pid === p.id} onPick={() => pick(p.id)} onOpen={open} />)}</div> : null}
                {bubble}
              </>
            )}
          </div>
        )}
      </div>
      {scene && vm !== 'std' && (
        <div className="gy-steps">
          <button className="btn sm" onClick={() => setAuto((a) => !a)} title="Putar otomatis untuk presentasi">{auto ? '⏸ Jeda' : '▶ Auto'}</button>
          <button className="btn sm" onClick={() => go(step - 1)}>‹</button>
          <div className="gy-dots">{steps.map((s, i) => <button key={i} className={i === step ? 'on' : ''} title={s.label} onClick={() => go(i)} />)}</div>
          <div className="gy-slab">{step + 1}/{steps.length} · {cur?.label}</div>
          <button className="btn sm coin" onClick={() => go(step + 1)}>›</button>
          <button className="btn sm" onClick={fullscreen} title="Layar penuh">⛶</button>
        </div>
      )}
    </div>
  );
}
