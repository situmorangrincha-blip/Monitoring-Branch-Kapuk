import { useEffect, useMemo, useState } from 'react';
import { derive, setLabels, timeInfo } from './lib/calc.js';
import { music, sfx } from './lib/audio.js';
import Backdrop from './components/Backdrop.jsx';
import Mascot from './components/Mascot.jsx';
import { themeVars } from './lib/theme.js';
import MusicDock from './components/MusicDock.jsx';
import { buildData } from './lib/ingest.js';
import { DEPOTS, clearAuth, depotLabel, loadAll, probe, saveSlot, setAuth, teamLabel } from './lib/store.js';
import UploadModal from './components/UploadModal.jsx';
import StoreModal from './components/StoreModal.jsx';
import { DepotPick, SectionPick, TeamPick } from './components/Gate.jsx';
import { Panel } from './components/ui.jsx';
import Explore from './pages/Explore.jsx';
import Performance from './pages/Performance.jsx';
import Focus from './pages/Focus.jsx';
import Stores from './pages/Stores.jsx';
import Pareto from './pages/Pareto.jsx';
import Salesman from './pages/Salesman.jsx';
import Charts from './pages/Charts.jsx';
import Dap, { defaultDapDate } from './pages/Dap.jsx';
import Rapot from './pages/Rapot.jsx';
import Programs from './pages/Programs.jsx';
import SoDo from './pages/SoDo.jsx';
import Market from './pages/Market.jsx';
import ViewPrefs from './components/ViewPrefs.jsx';
import DapEditor from './pages/DapEditor.jsx';
import ItgScup from './pages/ItgScup.jsx';
import Board from './components/Board.jsx';
import SkuRank from './pages/SkuRank.jsx';
import ItgV2 from './pages/ItgV2.jsx';
import { skuView } from './lib/skuBlocks.js';
import { buildItgDemo } from './lib/itg2.js';
import PreviewPane from './components/PreviewPane.jsx';

const PAGES = [
  { id: 'itg', label: 'ITG' },
  { id: 'program', label: 'Program' },
  { id: 'sodo', label: 'SO-DO' },
  { id: 'market', label: 'Market Productivity' },
  { id: 'skurank', label: 'Ranking SKU' },
  { id: 'explore', label: 'Jelajah' },
  { id: 'dap', label: 'DAP' },
  { id: 'scup', label: 'ITG Supercup' },
  { id: 'rapot', label: 'Rapot' },
  { id: 'perf', label: 'Performa' },
  { id: 'pareto', label: 'Pareto & CA' },
  { id: 'stores', label: 'Toko' },
  { id: 'sales', label: 'Salesman' },
  { id: 'focus', label: 'Fokus' },
  { id: 'chart', label: 'Grafik' },
];
const NAV = {
  monitor: ['explore', 'dap', 'rapot', 'perf', 'pareto', 'stores', 'sales', 'focus', 'chart'],
  itg: ['itg', 'scup', 'dap'],
  program: ['program'],
  sodo: ['sodo'],
  market: ['market'],
  skurank: ['skurank'],
};
const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const fmtUp = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const EMPTY = { main: null, sku: null, val: null, prog: null, promo: null, rules: null, progcat: null, itg: null, sodo: null, ctarget: null, itgcfg: null, market: null, itgscup: null, scuphist: null, skudb: null };

export default function App() {
  const [phase, setPhase] = useState('probe'); // probe | depot | section | team | loading | ready | error
  const PREVIEW = typeof window !== 'undefined' && !!window.__PREVIEW__;
  const readRoute = () => { const h = (typeof window !== 'undefined' && window.location.hash) || ''; if (!h.startsWith('#/dap')) return null; const q = new URLSearchParams(h.split('?')[1] || ''); return { depot: q.get('depot'), team: q.get('team'), date: q.get('date') }; };
  const [route, setRoute] = useState(readRoute);
  const [storeMode, setStoreMode] = useState(PREVIEW ? 'local' : 'cloud');
  const [depot, setDepot] = useState(null);
  const [team, setTeam] = useState(null);
  const [section, setSection] = useState('monitor');
  const [preview, setPreview] = useState(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [slots, setSlots] = useState(EMPTY);
  const [bootErr, setBootErr] = useState('');
  const [page, setPage] = useState('explore');
  const [subs, setSubs] = useState({ focus: 'principal', pareto: 'pj', chart: 'perf' });
  const [cmpDim, setCmpDim] = useState('sales');
  const [dapDay, setDapDay] = useState(null);
  const [holMap, setHolMap] = useState(() => loadJson('sm_hol', {}));
  const [mode, setMode] = useState('milestone');
  const [sal, setSal] = useState('ALL');
  const [up, setUp] = useState(false);
  const [store, setStore] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [toast, setToast] = useState('');
  const [look, setLookState] = useState(() => { try { return { bg: 'soft', mascot: true, kind: 'sales', size: 'md', dist: 'mid', color: null, anim: 'full', custom: null, img: null, ...JSON.parse(localStorage.getItem('sm_look') || '{}') }; } catch { return { bg: 'soft', mascot: true, kind: 'sales', size: 'md', dist: 'mid', color: null, anim: 'full' }; } });
  const setLook = (p) => setLookState((o) => { const n = { ...o, ...p }; localStorage.setItem('sm_look', JSON.stringify(n)); return n; });
  const tv = themeVars(look.color);
  const [timeOv, setTimeOvState] = useState(() => loadJson('sm_time', null));

  const setTimeOv = (v) => { setTimeOvState(v); if (v) localStorage.setItem('sm_time', JSON.stringify(v)); else localStorage.removeItem('sm_time'); };
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const goEditor = (r, modeOv) => {
    if (!r?.depot || !r?.team) return;
    setDepot(r.depot); setTeam(r.team); setSection('monitor'); setAuth({ team: r.team });
    enter(r.depot, r.team, 'monitor', modeOv).then(() => { setPage('dapeditor'); if (r.date) setDapDay(parseInt(r.date.slice(8), 10) || null); });
  };
  useEffect(() => {
    if (PREVIEW) { setDepot('kebayoran'); if (route?.depot && route?.team) { goEditor(route, 'local'); return; } setPhase('section'); return; }
    probe().then((r) => { setStoreMode(r.mode); if (route?.depot && route?.team) { goEditor(route, r.mode); return; } setPhase('depot'); });
  }, []); // eslint-disable-line
  // pindah halaman lewat alamat (#/dap...) tanpa memuat ulang
  useEffect(() => {
    const f = () => setRoute(readRoute());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []); // eslint-disable-line
  useEffect(() => {
    if (phase !== 'ready') return;
    if (route) { if (page !== 'dapeditor') { setPage('dapeditor'); if (route.date) setDapDay(parseInt(route.date.slice(8), 10) || null); } } else if (page === 'dapeditor') setPage('dap');
  }, [route, phase]); // eslint-disable-line
  const editorUrl = (date) => `${window.location.origin}${window.location.pathname}#/dap?depot=${depot}&team=${team}${date ? `&date=${date}` : ''}`;
  const openEditor = ({ date } = {}) => { const w = window.open(editorUrl(date), '_blank'); if (!w) window.location.hash = editorUrl(date).split('#')[1]; };
  const closeEditor = () => { if (window.history.length > 1 && !window.opener) window.location.hash = ''; else window.location.hash = ''; setRoute(null); setPage('dap'); };
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => {
    const h = (e) => {
      const el = e.target.closest?.('button, .score, .vchip, .pick, summary, .zone .x, label.on, .cols-pick label');
      if (!el || el.disabled || el.classList.contains('ytvol')) return;
      sfx.play(el.closest('.nav') ? 'nav' : el.matches('.btn.coin, .pick') ? 'main' : 'tap');
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-depot', depot || 'kebayoran'); }, [depot]);
  useEffect(() => { document.documentElement.setAttribute('data-anim', look.anim || 'full'); }, [look.anim]);

  const ready = phase === 'ready';
  const data = useMemo(() => (ready ? buildData(slots, depot, team) : null), [ready, slots, depot, team]);
  const time = useMemo(() => { const t = data ? timeInfo(data.meta.period, timeOv) : null; if (t) setLabels(t.y, t.m); return t; }, [data, timeOv]);
  const effMode = mode === 'bti' && !data?.meta.hasBti ? 'milestone' : mode;
  const D = useMemo(() => (data ? derive(data, effMode, time) : null), [data, effMode, time]);
  const holKey = time ? `${time.y}-${time.m}` : '';
  const holidays = holMap[holKey] || [];
  const setHolidays = (arr) => { const m = { ...holMap, [holKey]: arr }; setHolMap(m); localStorage.setItem('sm_hol', JSON.stringify(m)); };
  const autoTime = useMemo(() => (data ? timeInfo(data.meta.period, null) : { auto: 0, total: 27 }), [data]);

  async function enter(d, t, sec = section, modeOv) {
    setPhase('loading'); setPreview(null);
    setSal('ALL'); setPage(NAV[sec][0]); setDapDay(null);
    try {
      const r = await loadAll(modeOv || storeMode, d, t);
      setSlots({ ...EMPTY, ...r });
      setPhase('ready');
    } catch (e) { setBootErr(e?.message || 'Gagal memuat data'); setPhase('error'); }
  }
  const logout = () => { music.stop();  clearAuth(); setDepot(null); setTeam(null); setSlots(EMPTY); setPhase('depot'); };

  async function saveFocus(cats) {
    const main = { ...slots.main, settings: { ...(slots.main.settings || {}), focusCats: cats } };
    setSlots({ ...slots, main });
    try { await saveSlot(storeMode, depot, team, 'main', main); say('Kategori fokus disimpan'); } catch (e) { say('Gagal simpan: ' + (e?.message || e)); }
  }

  async function snap() {
    setSnapping(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const { toPng } = await import('html-to-image');
      const el = document.getElementById('snap-out');
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, filter: (n) => !(n.dataset && 'nosnap' in n.dataset) });
      const blob = await (await fetch(dataUrl)).blob();
      const name = `${page === 'chart' ? 'grafik' : 'performa'}-${depot}-${team}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Performa' }).catch(() => {});
      else { const a = document.createElement('a'); a.href = dataUrl; a.download = name; a.click(); }
      say('Screenshot tersimpan');
    } catch (e) { say('Gagal bikin gambar: ' + (e?.message || e)); }
    setSnapping(false);
  }
  const canSnap = page === 'perf' || page === 'chart';
  const setSub = (v) => setSubs({ ...subs, [page]: v });

  const bgEl = <><Backdrop level={look.bg} depot={depot || 'kebayoran'} />{look.mascot && <Mascot kind={look.kind} size={look.size} dist={look.dist} custom={look.custom} img={look.img} />}</>;
  if (phase === 'probe') return <div className="app"><div className="gate"><p>Memuat…</p></div></div>;
  if (phase === 'depot') return <div className="app" style={tv}>{bgEl}<DepotPick onPick={(d) => { setDepot(d); setPhase('section'); }} /></div>;
  if (phase === 'section') return <div className="app" data-depot={depot} style={tv}>{bgEl}<SectionPick depot={depot} onPick={(id) => { setSection(id); setPhase('team'); }} onBack={() => setPhase('depot')} /></div>;
  if (phase === 'team') return <div className="app" data-depot={depot} style={tv}>{bgEl}<TeamPick depot={depot} section={{ monitor: 'Monitoring Sales', itg: 'ITG', program: 'Program', sodo: 'Monitoring SO-DO', market: 'Market Productivity', skurank: 'Ranking SKU' }[section]} onPick={(t) => { setTeam(t); setAuth({ team: t }); enter(depot, t, section); }} onBack={() => setPhase('section')} /></div>;
  if (phase === 'loading') return <div className="app"><div className="gate"><p>Memuat data…</p></div></div>;
  if (phase === 'error') return (
    <div className="app"><div className="gate"><Panel title="Gagal memuat"><div className="empty"><p>{bootErr}</p><div className="row" style={{ justifyContent: 'center' }}><button className="btn coin" onClick={() => enter(depot, team)}>Coba lagi</button><button className="btn" onClick={logout}>Keluar</button></div></div></Panel></div></div>
  );

  async function saveItgCfg(c) { setSlots((o) => ({ ...o, itgcfg: c })); try { await saveSlot(storeMode, depot, team, 'itgcfg', c); } catch (e) { say('Gagal simpan pengaturan kontrak: ' + (e?.message || e)); } }
  async function saveScupHist(h) { setSlots((o) => ({ ...o, scuphist: h })); try { await saveSlot(storeMode, depot, team, 'scuphist', h); } catch (e) { say('Gagal simpan riwayat Supercup: ' + (e?.message || e)); } }
  async function saveSodo(d) { setSlots((o) => ({ ...o, sodo: d })); try { await saveSlot(storeMode, depot, team, 'sodo', d); } catch (e) { say('Gagal simpan SO-DO: ' + (e?.message || e)); } }
  const common = { D, data, time };
  const body = D && {
    explore: <Explore mode={effMode} data={data} time={time} depot={depot} team={team} board={<Board D={D} data={data} time={time} sal={sal} />} />,
    perf: <Performance {...common} mode={mode} setMode={setMode} snapping={snapping} snapBg={null} both={null} />,
    focus: <Focus {...common} mode={mode} sub={subs.focus} setSub={setSub} sal={sal} setSal={setSal} onSaveFocus={saveFocus} holidays={holidays} />,
    stores: <Stores data={data} time={time} sal={sal} setSal={setSal} onStore={setStore} />,
    pareto: <Pareto {...common} sub={subs.pareto} setSub={setSub} sal={sal} setSal={setSal} onStore={setStore} />,
    sales: <Salesman {...common} sal={sal} setSal={setSal} onStore={setStore} />,
    chart: <Charts {...common} mode={mode} setMode={setMode} sub={subs.chart} setSub={setSub} sal={sal} setSal={setSal} snapping={snapping} snapBg={null} cmpDim={cmpDim} setCmpDim={setCmpDim} />,
    rapot: <Rapot data={data} time={time} mode={effMode} depot={depot} team={team} />,
    scup: data.scup ? <ItgScup data={data} depot={depot} team={team} onSaveHist={saveScupHist} /> : <Panel title="ITG Supercup"><div className="mut" style={{ marginBottom: 8 }}>Belum ada file target ITG Supercup untuk tim ini. Upload Excel target (Id Pelanggan, Target per bulan dalam ctn).</div><button className="btn pri" onClick={() => setUp(true)}>Upload Target ITG Supercup</button></Panel>,
    market: <Market data={data} pv={{ market: data.market }} />,
    skurank: <SkuRank data={data} pv={{ sku: skuView(data.blocks) }} time={time} />,
    itg: data.itg2 ? <ItgV2 key={(data.itg2.fileName || 'itg') + depot + team} demo={buildItgDemo(data)} depot={depot} team={team} /> : <Panel title="ITG"><div className="mut" style={{ marginBottom: 8 }}>Belum ada Excel ITG untuk tim ini (format baru: Target per bulan, Actual, Reward).</div><button className="btn pri" onClick={() => setUp(true)}>Upload Excel ITG</button></Panel>,
    program: <Programs data={data} onUpload={() => setUp(true)} />,
    dapeditor: <DapEditor data={data} time={time} mode={effMode} holidays={holidays} depot={depot} team={team} day={dapDay ?? defaultDapDate(time)} setDay={setDapDay} onBack={closeEditor} />,
    dap: <Dap previewOpen={preview?.kind === 'dap'} onEditor={openEditor} openPreview={setPreview} data={data} mode={effMode} time={time} day={dapDay ?? defaultDapDate(time)} setDay={setDapDay} holidays={holidays} setHolidays={setHolidays} depot={depot} team={team} />,
  }[page];

  if (route && ready && page === 'dapeditor') return <div className="app standalone" data-depot={depot} style={tv}>{body}</div>;
  return (
    <div className="app" data-depot={depot} style={tv}>
      {bgEl}
      <header className="top">
        <div className="logo">
          <i>{depot === 'kapuk' ? 'K' : 'KB'}</i>
          <div><b>Sales Monitor</b><small>{depotLabel(depot)} · Tim {teamLabel(team)}{data?.meta.period ? ' · ' + data.meta.period.label : ''}</small></div>
        </div>
        {data && (data.warnings || []).filter((w) => !/^Info/.test(w)).length > 0 && <button className="btn sm" onClick={() => setWarnOpen(true)} title="Peringatan dari file yang diupload">⚠ {(data.warnings || []).filter((w) => !/^Info/.test(w)).length} peringatan</button>}
        {data && <span className="chip" title="Waktu upload data utama terakhir">update {fmtUp(data.meta.uploadedAt)}</span>}
        <MusicDock depot={depot || 'kebayoran'} look={look} setLook={setLook} themeStyle={tv} />
        {data && canSnap && <button className="btn sm" onClick={snap}>Simpan PNG</button>}
        <ViewPrefs />
        <button className="btn coin sm" onClick={() => setUp(true)}>Upload</button>
        <button className="btn sm" onClick={() => { setPhase('section'); setSlots(EMPTY); }}>Beranda</button>
        <button className="btn sm" onClick={logout}>Keluar</button>
      </header>

      <nav className="nav" aria-label="Halaman">
        {PAGES.filter((p) => NAV[section].includes(p.id)).map((p) => <button key={p.id} className={'btn' + (p.id === page ? ' on' : '')} aria-current={p.id === page ? 'page' : undefined} onClick={() => setPage(p.id)}>{p.label}</button>)}
      </nav>

      <div className={'ws' + (preview ? ' split' : '')}>
      <div className="ws-main">
      {section === 'sodo' ? (
        <div className="screen" key="sodo"><SoDo slot={slots.sodo} onSave={saveSodo} holidays={holidays} time={time} data={data} mode={effMode} /></div>
      ) : !data ? (
        <Panel title="Belum ada data">
          <div className="empty">
            <h2>Belum ada data {depotLabel(depot)} · Tim {teamLabel(team)}</h2>
            <p className="mut">Upload data utama dulu. Qty, Market Productivity (GreenStore dan MSS), dan database SKU bisa menyusul di slot masing-masing.</p>
            <button className="btn coin" onClick={() => setUp(true)}>Upload data</button>
          </div>
        </Panel>
      ) : (
        <div className="screen" key={page}>{body}</div>
      )}

      {data && (
        <div className="foot">
          {data.meta.fileName || 'data'} · hari kerja {time.hk}/{time.total}{time.overridden ? ' (manual)' : ''} · timegone {Math.round(time.tg * 100)}%
          {slots.sku ? ' · qty ✓' : ''}{slots.val ? ' · omset SKU ✓' : ''}{slots.promo?.items?.length ? ` · ${slots.promo.items.length} program ✓` : ''}{slots.skudb ? ' · database SKU ✓' : ''}
        </div>
      )}

      </div>
      <PreviewPane pv={preview} onClose={() => setPreview(null)} />
      </div>

      {up && (
        <UploadModal
          stores={data?.stores || []} slots={{ main: slots.main, sku: slots.sku, val: slots.val, market: slots.market, prog: slots.prog, promo: slots.promo, rules: slots.rules, progcat: slots.progcat, itg: slots.itg, ctarget: slots.ctarget, itgcfg: slots.itgcfg, skudb: slots.skudb }}
          depot={depot} team={team} storeMode={storeMode} timeOv={timeOv} setTimeOv={setTimeOv} auto={autoTime} period={data?.meta.period}
          onClose={() => setUp(false)}
          onDone={(slot, d) => { setSlots((o) => ({ ...o, [slot]: d })); setUp(false); say(d ? 'Data tersimpan' : 'Slot dihapus'); }}
        />
      )}
      {warnOpen && data && (
        <div className="veil" onClick={() => setWarnOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <Panel title="PERINGATAN DATA" right={<button className="btn sm" onClick={() => setWarnOpen(false)}>Tutup</button>}>
              <div className="mut" style={{ marginBottom: 8 }}>Hal-hal yang ditemukan saat membaca file. Salesman baru tampil dari JKS; kalau angkanya kosong, biasanya namanya belum ada di pivot OLAP atau sheet TGT.</div>
              {(data.warnings || []).map((w, i) => <div key={i} className={/^Info/.test(w) ? 'mut' : 'warn'} style={{ margin: '4px 0' }}>{w}</div>)}
            </Panel>
          </div>
        </div>
      )}
      {store && data && <StoreModal s={store} data={data} time={time} onClose={() => setStore(null)} />}
      {snapping && <div className="veil"><div className="modal"><Panel title="Menyimpan"><div className="empty"><p>Membuat gambar…</p></div></Panel></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
