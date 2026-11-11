// Isi "Discuss with GERY": tiap scene menyusun panel data dan narasi (berbasis rumus) dari data asli tim.
// Semua angka yang disebut GERY dihitung di sini dari data, bukan ditulis oleh AI.
import { DEFAULT_SCUP, computeScup, keyLabel } from './scup.js';
import { DEFAULT_PCT, buildItgDemo, computeItg2 } from './itg2.js';
import { IND, grade, rapotAll, DEFAULT_W } from './rapot.js';
import { nowTime } from '../pages/ItgV2.jsx';

const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const idn = (n, d = 0) => Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const jt = (n) => (Math.abs(n || 0) >= 1e6 ? idn((n || 0) / 1e6, 2) + ' jt' : 'Rp ' + idn(n));
const pc = (v) => Math.round((v || 0) * 100) + '%';
const tone = (p) => (p >= 1 ? 'ok' : p >= 0.7 ? 'warn' : 'bad');
const sum = (a, f) => a.reduce((x, o) => x + (f(o) || 0), 0);
const short = (s) => String(s || '-').split(' ')[0];
const letter = (i) => String.fromCharCode(65 + (i % 26));
const off = (id, label, why) => ({ id, label, off: why });
// "paham" bahasa percakapan GERY: nama diganti kode kalau mode anonim aktif
function namer(keys, anon, prefix) { const list = [...new Set(keys)]; return (k, real = k) => (anon ? `${prefix} ${letter(list.indexOf(k))}` : real); }

// ---------------------------------------------------------------- ITG SUPERCUP
function sceneScup({ data, time, depot, team, anon }) {
  const id = 'scup', label = 'ITG Supercup';
  if (!data.scup) return off(id, label, 'Belum ada file Target ITG Supercup di tim ini. Upload dulu di menu Upload > Target ITG Supercup.');
  const cfg = { ...DEFAULT_SCUP, ...ls(`sm_scupcfg_${depot}_${team}`, {}) }, edits = ls(`sm_scupedits_${depot}_${team}`, {});
  let C;
  try { C = computeScup({ parsed: data.scup, data, cfg, hist: data.scuphist, edits }); } catch (e) { return off(id, label, 'Gagal menghitung Supercup: ' + (e.message || e)); }
  const rows = C.rows;
  if (!rows.length) return off(id, label, 'Tidak ada outlet Supercup yang cocok dengan JKS tim ini. Upload data utama tim dulu.');
  const ck = C.qMonths.includes(C.curKey) ? C.curKey : C.first;
  const nmO = namer(rows.map((r) => r.id), anon, 'Outlet'), nm = (r) => nmO(r.id, r.name);
  const sn = namer(rows.map((r) => r.sales), anon, 'Salesman');
  const M = (r) => r.mo[ck];
  const TN = sum(rows, (r) => M(r).T), AN = sum(rows, (r) => M(r).A || 0), pctN = TN ? AN / TN : 0;
  const TQ = sum(rows, (r) => r.TQ), AQ = sum(rows, (r) => r.AQ), pctQ = TQ ? AQ / TQ : 0;
  const tg = time?.tg ?? 0.4, dleft = Math.max(1, (time?.total || 22) - (time?.hk || 0));
  const done = rows.filter((r) => (M(r).pct || 0) >= 1).length;
  const monthsBars = C.qMonths.map((k) => { const T = sum(rows, (r) => r.mo[k].T), A = sum(rows, (r) => r.mo[k].A || 0), future = rows.every((r) => r.mo[k].future); return { label: keyLabel(k).split(' ')[0], pct: future || !T ? 0 : A / T, tone: future ? 'mut' : tone(T ? A / T : 0), A, T, future, k }; });
  const rM = sum(rows, (r) => C.qMonths.reduce((a, k) => a + (r.mo[k].potential || 0), 0)), rQ = sum(rows, (r) => r.potQ), rB = sum(rows, (r) => r.rBauto), rTot = rM + rQ + rB;
  const big = sum(rows, (r) => r.bigOm), nBig = rows.filter((r) => r.bigOm > 0).length;
  const risk = rows.filter((r) => M(r).T > 0 && !M(r).future).map((r) => ({ r, gap: Math.max(0, M(r).T - (M(r).A || 0)) })).sort((a, b) => b.gap - a.gap);
  const by = {}; rows.forEach((r) => { const o = (by[r.sales] ||= { s: r.sales, T: 0, A: 0, n: 0 }); o.T += M(r).T; o.A += M(r).A || 0; o.n++; });
  const sales = Object.values(by).sort((a, b) => (b.T ? b.A / b.T : 0) - (a.T ? a.A / a.T : 0));
  const perDay = Math.max(0, TN - AN) / dleft, qLeftMonths = C.qMonths.filter((k) => k > ck).length, perDayQ = Math.max(0, TQ - AQ) / (dleft + qLeftMonths * (time?.total || 22));
  const top2 = risk.slice(0, 2), gapN = Math.max(0, TN - AN);

  const panels = [
    { id: 'cap', side: 'L', title: `Capaian ${keyLabel(ck)}`, kind: 'ring', pct: pctN, big: idn(AN), bigSub: `/ ${idn(TN)} ctn`, sub: `Gap ${idn(gapN)} ctn · ${done} dari ${rows.length} outlet ≥100%`, bar: { label: 'Waktu berjalan', val: pc(tg), pct: tg, tone: 'warn' }, open: ['itg', 'scup'] },
    { id: 'qtr', side: 'L', title: `Quartal ${keyLabel(C.qMonths[0]).split(' ')[0]} – ${keyLabel(C.qMonths[2]).split(' ')[0]}`, kind: 'months', big: pc(pctQ), bigSub: `${idn(AQ)} / ${idn(TQ)} ctn`, pct: pctQ, tone: tone(pctQ), months: monthsBars, foot: `Butuh ${idn(perDayQ)} ctn per hari kerja`, open: ['itg', 'scup'] },
    { id: 'rew', side: 'L', title: 'Reward potensi', kind: 'kv', big: jt(rTot), bigSub: 'kalau semua tercapai', rows: [{ k: `Bulanan (${cfg.r1}%)`, v: jt(rM) }, { k: `Quartal (${cfg.r2}%)`, v: jt(rQ) }, { k: `Big cup (${cfg.r3}%)`, v: jt(rB) }], open: ['itg', 'scup'] },
    { id: 'out', side: 'R', title: 'Outlet perlu perhatian', kind: 'bars', rows: risk.slice(0, 3).map((x) => ({ label: nm(x.r), right: `${idn(x.gap)} ctn`, pct: M(x.r).T ? (M(x.r).A || 0) / M(x.r).T : 0, tone: tone(M(x.r).T ? (M(x.r).A || 0) / M(x.r).T : 0) })), foot: 'Urut dari gap terbesar bulan ini', open: ['itg', 'scup'] },
    { id: 'sal', side: 'R', title: 'Salesman', kind: 'bars', rows: sales.map((x) => ({ label: sn(x.s), right: `${pc(x.T ? x.A / x.T : 0)} · ${idn(x.A)} / ${idn(x.T)} ctn`, pct: x.T ? x.A / x.T : 0, tone: tone(x.T ? x.A / x.T : 0) })), foot: `${rows.length} outlet · ${sales.length} salesman`, open: ['itg', 'scup'] },
    { id: 'big', side: 'R', title: 'Big cup', kind: 'kv', big: jt(big), bigSub: 'omset quartal', rows: [{ k: `Reward ${cfg.r3}%`, v: jt(rB) }, { k: 'Outlet sudah beli', v: `${nBig} dari ${rows.length}` }], bar: { pct: rows.length ? nBig / rows.length : 0, tone: 'ok' }, open: ['itg', 'scup'] },
  ];
  const w0 = risk[0], w1 = risk[1];
  const steps = [
    { pid: null, label: 'Ringkasan', title: 'Halo, gue GERY!', expr: 'happy', tx: `Gue GERY, pemandu data lu. Gue bahas Supercup tim ${data.meta.teamLabel || ''}: ${rows.length} outlet dengan target ${keyLabel(ck)} ${idn(TN)} ctn. Tekan › untuk lanjut. Seret atau klik gue juga boleh.`, sg: 'Mulai dari <b>Capaian</b>, karena itu yang paling mendesak.' },
    { pid: 'cap', label: 'Capaian bulan ini', title: `Capaian ${keyLabel(ck)}`, expr: pctN >= tg ? 'happy' : 'worried', tx: `Baru <b>${idn(AN)}</b> dari ${idn(TN)} ctn (<b>${pc(pctN)}</b>), sementara waktu sudah berjalan ${pc(tg)}. ${pctN >= tg ? 'Capaian di atas ritme waktu.' : `Tertinggal sekitar ${Math.round((tg - pctN) * 100)} poin; butuh ${idn(perDay)} ctn per hari kerja sampai akhir bulan.`}`, sg: top2.length ? `Prioritaskan <b>${nm(top2[0].r)}</b> (gap ${idn(top2[0].gap)} ctn)${top2[1] ? ` dan <b>${nm(top2[1].r)}</b> (gap ${idn(top2[1].gap)} ctn)` : ''}: ${top2.length > 1 ? 'dua outlet itu' : 'outlet itu'} menyumbang ${gapN ? Math.round(sum(top2, (x) => x.gap) / gapN * 100) : 0}% dari total gap.` : 'Semua outlet sudah mencapai target bulan ini.' },
    { pid: 'qtr', label: 'Quartal', title: panels[1].title, expr: pctQ >= 0.5 ? 'happy' : 'worried', tx: `Quartal baru <b>${pc(pctQ)}</b> (${idn(AQ)} dari ${idn(TQ)} ctn). Untuk menutup 100% dibutuhkan rata-rata <b>${idn(perDayQ)} ctn per hari kerja</b> sampai akhir quartal.`, sg: `Bulan yang sudah lewat: ${monthsBars.filter((m) => !m.future).map((m) => `${m.label} ${pc(m.pct)}`).join(', ')}. ${monthsBars.some((m) => m.future) ? 'Bulan berikutnya perlu mengejar selisihnya.' : ''}` },
    { pid: 'rew', label: 'Reward potensi', title: 'Reward potensi', expr: 'happy', tx: `Kalau semua target tercapai, potensi reward <b>${jt(rTot)}</b>: bulanan ${jt(rM)}, quartal ${jt(rQ)}, dan big cup ${jt(rB)}. Rupiah dihitung dari ctn dikali harga rata-rata per ctn di file Omset dan Qty.`, sg: `Reward bulanan hanya cair kalau ≥100% di bulan itu. Saat ini <b>${done} dari ${rows.length}</b> outlet yang mencapainya di bulan berjalan.` },
    { pid: 'out', label: 'Outlet perlu perhatian', title: 'Outlet perlu perhatian', expr: 'alert', tx: risk.length ? `Tiga gap terbesar: ${risk.slice(0, 3).map((x) => `<b>${nm(x.r)}</b> (${idn(x.gap)} ctn)`).join(', ')}.` : 'Tidak ada outlet dengan target bulan ini.', sg: w0 ? `Kalau <b>${nm(w0.r)}</b> dikunjungi 3 kali lagi, butuh sekitar <b>${idn(w0.gap / 3)} ctn per kunjungan</b>.` : '' },
    { pid: 'sal', label: 'Salesman', title: 'Salesman', expr: 'think', tx: sales.length ? sales.map((x) => `<b>${sn(x.s)}</b> ${pc(x.T ? x.A / x.T : 0)} (${x.n} outlet)`).join(' dan ') + '.' : 'Belum ada data salesman.', sg: sales.length > 1 ? `Bantu <b>${sn(sales[sales.length - 1].s)}</b> membuka pesanan pertama: target ${idn(sales[sales.length - 1].T)} ctn per bulan dari ${sales[sales.length - 1].n} outlet.` : '' },
    { pid: 'big', label: 'Big cup', title: 'Big cup', expr: 'happy', tx: `Omset big cup <b>${jt(big)}</b> dari ${nBig} dari ${rows.length} outlet, reward ${cfg.r3}% = ${jt(rB)}. Reward ini <b>berdiri sendiri</b>, tidak perlu target quartal tercapai.`, sg: rows.filter((r) => !r.bigOm).length ? `Tawarkan big cup ke <b>${rows.filter((r) => !r.bigOm).slice(0, 3).map(nm).join(', ')}</b> yang belum pernah beli. Setiap pembelian langsung menambah reward.` : 'Semua outlet sudah membeli big cup.' },
  ];
  return { id, label, panels, steps, period: keyLabel(C.qMonths[0]) + ' – ' + keyLabel(C.qMonths[2]) };
}

// ---------------------------------------------------------------- ITG (Arjuna)
function sceneItg({ data, depot, team, anon }) {
  const id = 'itg', label = 'ITG';
  if (!data.itg2) return off(id, label, 'Belum ada Excel ITG (format baru) untuk tim ini. Upload dulu di menu Upload > Target ITG.');
  let C, time;
  try {
    const demo = buildItgDemo(data), SK = `${depot}_${team}`;
    const settings = { basis: 'visit', pct: 100, classPct: { ...DEFAULT_PCT }, unit: 'jt', show: {}, ...ls(`itgv2_settings_${SK}`, {}) };
    time = nowTime(demo.parsed.months);
    C = computeItg2(demo.parsed, new Map(demo.stores.map((s) => [s.id, s])), time, ls(`itgv2_edits_${SK}`, {}), settings);
  } catch (e) { return off(id, label, 'Gagal menghitung ITG: ' + (e.message || e)); }
  const rows = C.rows.filter((r) => r.T > 0);
  if (!rows.length) return off(id, label, 'Tidak ada toko ITG yang cocok dengan JKS tim ini.');
  const nmS = namer(rows.map((r) => r.id), anon, 'Toko'), nm = (r) => nmS(r.id, r.name), sn = namer(rows.map((r) => r.sales), anon, 'Salesman');
  const T = sum(rows, (r) => r.T), A = sum(rows, (r) => r.A), pct = T ? A / T : 0, tg = time.tg;
  const st = { tercapai: 0, berjalan: 0, gagal: 0 }; rows.forEach((r) => { if (r.status === 'tercapai') st.tercapai++; else if (/gagal/.test(r.status)) st.gagal++; else st.berjalan++; });
  const rew = sum(rows, (r) => r.reward), rewDone = sum(rows.filter((r) => r.status === 'tercapai'), (r) => r.reward);
  const byC = {}; rows.forEach((r) => { const o = (byC[r.cls || '-'] ||= { c: r.cls || '-', T: 0, A: 0, n: 0, rew: 0 }); o.T += r.T; o.A += r.A; o.n++; o.rew += r.reward || 0; });
  const classes = Object.values(byC).sort((a, b) => b.T - a.T);
  const byS = {}; rows.forEach((r) => { const o = (byS[r.sales] ||= { s: r.sales, T: 0, A: 0, n: 0 }); o.T += r.T; o.A += r.A; o.n++; });
  const sales = Object.values(byS).sort((a, b) => (b.T ? b.A / b.T : 0) - (a.T ? a.A / a.T : 0));
  const gaps = rows.filter((r) => r.status !== 'tercapai').map((r) => ({ r, gap: Math.max(0, r.T - r.A) })).sort((a, b) => b.gap - a.gap);
  const top2 = gaps.slice(0, 2), gapT = Math.max(0, T - A), period = data.meta.period?.label || 'periode ini';
  const panels = [
    { id: 'tgt', side: 'L', title: 'Target 2 bulan', kind: 'ring', pct, big: jt(A), bigSub: `/ ${jt(T)}`, sub: `${rows.length} toko ITG · gap ${jt(gapT)}`, bar: { label: 'Waktu berjalan', val: pc(tg), pct: tg, tone: 'warn' }, open: ['itg', 'itg'] },
    { id: 'st', side: 'L', title: 'Status toko', kind: 'kv', big: `${st.tercapai}`, bigSub: `dari ${rows.length} tercapai`, rows: [{ k: 'Berjalan', v: String(st.berjalan) }, { k: 'Gagal syarat', v: String(st.gagal) }], bar: { pct: rows.length ? st.tercapai / rows.length : 0, tone: 'ok' }, open: ['itg', 'itg'] },
    { id: 'rew', side: 'L', title: 'Reward potensi', kind: 'kv', big: jt(rew), bigSub: 'semua toko ITG', rows: [{ k: 'Sudah tercapai', v: jt(rewDone) }, ...classes.slice(0, 2).map((c) => ({ k: `Class ${c.c}`, v: jt(c.rew) }))], open: ['itg', 'itg'] },
    { id: 'gap', side: 'R', title: 'Toko dengan gap terbesar', kind: 'bars', rows: gaps.slice(0, 3).map((x) => ({ label: nm(x.r), right: jt(x.gap), pct: x.r.T ? x.r.A / x.r.T : 0, tone: tone(x.r.T ? x.r.A / x.r.T : 0) })), foot: 'Selisih target dan actual', open: ['itg', 'itg'] },
    { id: 'sal', side: 'R', title: 'Salesman', kind: 'bars', rows: sales.map((x) => ({ label: sn(x.s), right: `${pc(x.T ? x.A / x.T : 0)} · ${x.n} toko`, pct: x.T ? x.A / x.T : 0, tone: tone(x.T ? x.A / x.T : 0) })), foot: `${sales.length} salesman`, open: ['itg', 'itg'] },
    { id: 'cls', side: 'R', title: 'Per class toko', kind: 'bars', rows: classes.map((x) => ({ label: `${x.c} (${x.n})`, right: pc(x.T ? x.A / x.T : 0), pct: x.T ? x.A / x.T : 0, tone: tone(x.T ? x.A / x.T : 0) })), foot: 'Persen actual terhadap target', open: ['itg', 'itg'] },
  ];
  const steps = [
    { pid: null, label: 'Ringkasan', title: 'Halo, gue GERY!', expr: 'happy', tx: `Gue GERY. Kita bahas ITG tim ${data.meta.teamLabel || ''} (${period}): ${rows.length} toko dengan target dua bulan ${jt(T)}. Tekan › untuk lanjut.`, sg: 'Mulai dari <b>Target 2 bulan</b>.' },
    { pid: 'tgt', label: 'Target 2 bulan', title: 'Target 2 bulan', expr: pct >= tg ? 'happy' : 'worried', tx: `Actual <b>${jt(A)}</b> dari target ${jt(T)} (<b>${pc(pct)}</b>), sementara waktu bulan data sudah ${pc(tg)}. ${pct >= tg ? 'Masih sesuai atau di atas ritme.' : `Tertinggal sekitar ${Math.round((tg - pct) * 100)} poin.`}`, sg: top2.length ? `Gap terbesar ada di <b>${nm(top2[0].r)}</b> (${jt(top2[0].gap)})${top2[1] ? ` dan <b>${nm(top2[1].r)}</b> (${jt(top2[1].gap)})` : ''}.` : 'Semua toko sudah mencapai target.' },
    { pid: 'st', label: 'Status toko', title: 'Status toko', expr: st.gagal ? 'alert' : 'happy', tx: `<b>${st.tercapai}</b> toko sudah tercapai, <b>${st.berjalan}</b> masih berjalan, dan <b>${st.gagal}</b> gagal syarat (di bawah minimal).`, sg: st.gagal ? `Cek toko yang gagal syarat lebih dulu: peluang rewardnya paling kecil.` : 'Belum ada toko yang gagal syarat.' },
    { pid: 'rew', label: 'Reward potensi', title: 'Reward potensi', expr: 'happy', tx: `Potensi cashback semua toko ITG <b>${jt(rew)}</b>, dan yang sudah tercapai ${jt(rewDone)}. Angka dari kolom Reward di Excel ITG, atau persen class kalau kolomnya tidak ada.`, sg: classes[0] ? `Class <b>${classes[0].c}</b> menyumbang ${jt(classes[0].rew)} (${rew ? Math.round(classes[0].rew / rew * 100) : 0}%).` : '' },
    { pid: 'gap', label: 'Gap terbesar', title: 'Toko dengan gap terbesar', expr: 'alert', tx: gaps.length ? `Tiga gap terbesar: ${gaps.slice(0, 3).map((x) => `<b>${nm(x.r)}</b> (${jt(x.gap)})`).join(', ')}.` : 'Tidak ada gap.', sg: gaps[0] ? `Kalau <b>${nm(gaps[0].r)}</b> kunjungannya ${gaps[0].r.visits || 4}x, butuh sekitar <b>${jt(gaps[0].gap / (gaps[0].r.visits || 4))} per kunjungan</b>.` : '' },
    { pid: 'sal', label: 'Salesman', title: 'Salesman', expr: 'think', tx: sales.map((x) => `<b>${sn(x.s)}</b> ${pc(x.T ? x.A / x.T : 0)} (${x.n} toko)`).join(', ') + '.', sg: sales.length > 1 ? `Bantu <b>${sn(sales[sales.length - 1].s)}</b>: capaian terendah dari ${sales.length} salesman.` : '' },
    { pid: 'cls', label: 'Per class', title: 'Per class toko', expr: 'think', tx: classes.map((x) => `<b>${x.c}</b> ${pc(x.T ? x.A / x.T : 0)} (${x.n} toko)`).join(', ') + '.', sg: classes.length ? `Class dengan capaian terendah: <b>${[...classes].sort((a, b) => (a.T ? a.A / a.T : 0) - (b.T ? b.A / b.T : 0))[0].c}</b>.` : '' },
  ];
  return { id, label, panels, steps, period };
}

// ---------------------------------------------------------------- RAPOT
function sceneRapot({ data, time, mode, anon }) {
  const id = 'rapot', label = 'Rapot';
  if (!data?.stores?.length) return off(id, label, 'Belum ada data utama tim ini.');
  let R;
  try { R = rapotAll(data, mode, time, { ...DEFAULT_W, ...ls('sm_rapot_w', {}) }); } catch (e) { return off(id, label, 'Gagal menghitung rapot: ' + (e.message || e)); }
  const ranked = R.ranked || []; if (!ranked.length) return off(id, label, 'Belum ada salesman yang bisa diranking.');
  const sn = namer(R.rows.map((r) => r.name), anon, 'Salesman');
  const avg = sum(ranked, (r) => r.total) / ranked.length, best = ranked[0], worst = ranked[ranked.length - 1];
  const act = sum(R.rows, (r) => r.act), tgt = sum(R.rows, (r) => r.tgt), pctO = tgt ? act / tgt : 0, tg = time?.tg ?? 0;
  const indAvg = IND.map((i) => { const v = ranked.map((r) => r.ind?.[i.id]?.score).filter((x) => x != null); return { id: i.id, label: i.label, avg: v.length ? sum(v, (x) => x) / v.length : null, n: v.length }; }).filter((x) => x.avg != null);
  const strong = [...indAvg].sort((a, b) => b.avg - a.avg).slice(0, 3), weak = [...indAvg].sort((a, b) => a.avg - b.avg).slice(0, 3);
  const tn = (v) => (v >= 85 ? 'ok' : v >= 70 ? 'ok' : v >= 55 ? 'warn' : 'bad');
  const low = [...ranked].reverse().slice(0, 3);
  const panels = [
    { id: 'rank', side: 'L', title: 'Peringkat salesman', kind: 'bars', rows: ranked.slice(0, 3).map((r) => ({ label: `${r.rank}. ${sn(r.name)}`, right: `${Math.round(r.total)} · ${grade(r.total)}`, pct: r.total / 100, tone: tn(r.total) })), foot: `${ranked.length} salesman diranking`, open: ['monitor', 'rapot'] },
    { id: 'avg', side: 'L', title: 'Skor tim', kind: 'kv', big: Math.round(avg), bigSub: `rata-rata dari 100 (${grade(avg)})`, rows: [{ k: 'Tertinggi', v: `${Math.round(best.total)} · ${sn(best.name)}` }, { k: 'Terendah', v: `${Math.round(worst.total)} · ${sn(worst.name)}` }], bar: { pct: avg / 100, tone: tn(avg) }, open: ['monitor', 'rapot'] },
    { id: 'omset', side: 'L', title: 'Omset vs target', kind: 'ring', pct: pctO, big: jt(act), bigSub: `/ ${jt(tgt)}`, sub: `Basis ${mode === 'bti' ? 'BTI' : 'Milestone'}`, bar: { label: 'Waktu berjalan', val: pc(tg), pct: tg, tone: 'warn' }, open: ['monitor', 'rapot'] },
    { id: 'strong', side: 'R', title: 'Indikator terkuat', kind: 'bars', rows: strong.map((x) => ({ label: x.label, right: Math.round(x.avg), pct: x.avg / 100, tone: tn(x.avg) })), foot: 'Rata-rata skor tim per indikator', open: ['monitor', 'rapot'] },
    { id: 'weak', side: 'R', title: 'Indikator terlemah', kind: 'bars', rows: weak.map((x) => ({ label: x.label, right: Math.round(x.avg), pct: x.avg / 100, tone: tn(x.avg) })), foot: 'Peluang perbaikan terbesar', open: ['monitor', 'rapot'] },
    { id: 'low', side: 'R', title: 'Perlu pendampingan', kind: 'bars', rows: low.map((r) => ({ label: sn(r.name), right: Math.round(r.total), pct: r.total / 100, tone: tn(r.total) })), foot: '', open: ['monitor', 'rapot'] },
  ];
  panels[5].foot = worst.weak?.label ? `Terlemah di: ${worst.weak.label}` : 'Skor terendah di tim';
  const wk = worst.weak?.label || (weak[0] && weak[0].label) || '-';
  const steps = [
    { pid: null, label: 'Ringkasan', title: 'Halo, gue GERY!', expr: 'happy', tx: `Gue GERY. Kita lihat rapot tim ${data.meta.teamLabel || ''}: ${ranked.length} salesman diranking dengan skor rata-rata <b>${Math.round(avg)}</b> (${grade(avg)}). Tekan › untuk lanjut.`, sg: 'Mulai dari <b>Peringkat</b>.' },
    { pid: 'rank', label: 'Peringkat', title: 'Peringkat salesman', expr: 'happy', tx: `Teratas: ${ranked.slice(0, 3).map((r) => `<b>${sn(r.name)}</b> (${Math.round(r.total)})`).join(', ')}.`, sg: `Selisih skor tertinggi dan terendah <b>${Math.round(best.total - worst.total)} poin</b>${best.total - worst.total > 25 ? ', cukup lebar' : ''}.` },
    { pid: 'avg', label: 'Skor tim', title: 'Skor tim', expr: avg >= 70 ? 'happy' : 'worried', tx: `Skor rata-rata tim <b>${Math.round(avg)}</b> (${grade(avg)}). Tertinggi ${sn(best.name)} ${Math.round(best.total)}, terendah ${sn(worst.name)} ${Math.round(worst.total)}.`, sg: avg >= 70 ? 'Pertahankan ritme, fokus mengangkat yang terendah.' : 'Skor tim di bawah 70, jadi perbaikan perlu menyentuh beberapa indikator sekaligus.' },
    { pid: 'omset', label: 'Omset vs target', title: 'Omset vs target', expr: pctO >= tg ? 'happy' : 'worried', tx: `Omset <b>${jt(act)}</b> dari target ${jt(tgt)} (<b>${pc(pctO)}</b>), sementara waktu sudah ${pc(tg)}.`, sg: pctO >= tg ? 'Omset sesuai atau di atas ritme waktu.' : `Tertinggal ${Math.round((tg - pctO) * 100)} poin dari ritme waktu.` },
    { pid: 'strong', label: 'Terkuat', title: 'Indikator terkuat', expr: 'happy', tx: strong.map((x) => `<b>${x.label}</b> (${Math.round(x.avg)})`).join(', ') + '.', sg: 'Ini kekuatan tim; jadikan contoh saat briefing.' },
    { pid: 'weak', label: 'Terlemah', title: 'Indikator terlemah', expr: 'alert', tx: weak.map((x) => `<b>${x.label}</b> (${Math.round(x.avg)})`).join(', ') + '.', sg: weak[0] ? `Prioritaskan <b>${weak[0].label}</b>: skor rata-rata paling rendah di tim.` : '' },
    { pid: 'low', label: 'Pendampingan', title: 'Perlu pendampingan', expr: 'think', tx: low.map((r) => `<b>${sn(r.name)}</b> (${Math.round(r.total)})`).join(', ') + '.', sg: `Mulai dari <b>${sn(worst.name)}</b>, indikator terlemahnya: ${wk}.` },
  ];
  return { id, label, panels, steps, period: data.meta.period?.label || '' };
}

export function buildScenes(ctx) {
  const list = [sceneScup, sceneItg, sceneRapot];
  return list.map((f) => { try { return f(ctx); } catch (e) { return off(f.name.replace('scene', '').toLowerCase(), f.name.replace('scene', ''), 'Gagal menyusun scene: ' + (e.message || e)); } });
}
