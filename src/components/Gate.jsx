import { DEPOTS, TEAMS, depotLabel } from '../lib/store.js';

const Head = ({ title, sub }) => (
  <div className="home-head">
    <h1>{title}</h1>
    {sub && <p>{sub}</p>}
    <div className="ribbon"><i /><i /><i /></div>
  </div>
);

export function DepotPick({ onPick }) {
  return (
    <div className="home phase">
      <Head title={<>Sales <span>Monitor</span></>} sub="Pilih depo" />
      <div className="depots">
        {DEPOTS.map((d) => (
          <button key={d.id} className={'depot ' + d.id} onClick={() => onPick(d.id)}>
            <span className="disc">{d.id === 'kapuk' ? 'K' : 'KB'}</span>
            <b>{d.short}</b>
            <small>{d.id === 'kapuk' ? 'Depo Kapuk' : 'SP Kebayoran'}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// kartu section: Monitoring Sales aktif; Rute dan Audit membuka project Vercel; sisanya menyusul
export const SECTIONS = [
  { id: 'monitor', n: '01', title: 'Monitoring Sales', desc: 'Jelajah, DAP, Rapot, Performa, dan Pareto per tim.', live: true },
  { id: 'itg', n: '02', title: 'ITG', desc: 'Target 2 bulan per toko, achievement, dan kontrak.', live: true },
  { id: 'program', n: '03', title: 'Program', desc: 'Katalog program, toko peserta, dan program per toko.', live: true },
  { id: 'sodo', n: '04', title: 'Monitoring SO-DO', desc: 'SO vs STK, alasan belum terkirim, dan rekap.', live: true },
  { id: 'market', n: '05', title: 'Market Productivity', desc: 'EC, AC, GreenStore, MSS, dan PICOS per salesman dan toko.', live: true },
  { id: 'skurank', n: '06', title: 'Ranking SKU', desc: 'Peringkat SKU per salesman, channel, atau outlet dari omset dan qty.', live: true },
  { id: 'gery', n: '07', title: 'Discuss with GERY', desc: 'Pemandu data 3D: GERY menjelaskan angka tim lu dan memberi saran.', live: true, badge: 'baru' },
  { id: 'rute', n: '08', title: 'Rute Kunjungan', desc: 'Peta dan penyusun rute kunjungan salesman.', url: 'https://mapsnyrinchamilenio.vercel.app/' },
  { id: 'audit', n: '09', title: 'Audit Rute', desc: 'Temuan kejanggalan dari Report Route Feedback.', url: 'https://rutefeedback.vercel.app/' },
];

export function SectionPick({ depot, onPick, onBack }) {
  return (
    <div className="home phase" data-depot={depot}>
      <Head title={depotLabel(depot)} sub="Pilih section" />
      <div className="secgrid">
        {SECTIONS.map((s) => (
          <button key={s.id} className={'sec' + (s.id === 'gery' ? ' gery' : '')} disabled={!!s.soon} onClick={() => (s.url ? window.open(s.url, '_blank', 'noopener') : onPick(s.id, s.title))}>
            {s.url && <span className="secbadge ext">buka ↗</span>}
            {s.soon && <span className="secbadge">segera</span>}
            {s.badge && <span className="secbadge">{s.badge}</span>}
            <div className="secnum">{s.n}</div>
            <div className="sectitle">{s.title}</div>
            <div className="secdesc">{s.desc}</div>
          </button>
        ))}
      </div>
      <div className="back"><button className="btn ghost" onClick={onBack}>← Ganti depo</button></div>
    </div>
  );
}

export function TeamPick({ depot, onPick, onBack, section = 'Monitoring Sales' }) {
  return (
    <div className="home phase" data-depot={depot}>
      <Head title="Pilih tim" sub={depotLabel(depot) + ' · ' + section} />
      <div className="depots">
        {TEAMS.map((t) => (
          <button key={t.id} className={'depot ' + depot} onClick={() => onPick(t.id)}>
            <span className="disc">{t.label[0]}</span>
            <b>{t.label}</b>
            <small>{t.desc}</small>
          </button>
        ))}
      </div>
      <div className="back"><button className="btn ghost" onClick={onBack}>← Kembali</button></div>
    </div>
  );
}
