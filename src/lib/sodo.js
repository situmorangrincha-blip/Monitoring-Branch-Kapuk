// Monitoring SO-DO: SO (sales order) harus masuk STK (surat tugas kirim) maksimal 2 hari kerja setelah SO. Cocokkan per toko + salesman.
import './polyfill.js';
import * as XLSX from 'xlsx';
import { grid, key, str, toNum } from './table.js';

export const REASONS = ['Plan kirim tanggal lain', 'SO double', 'Lainnya (isi sendiri)'];
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const srcOf = (no) => (/^SAM/i.test(no) ? 'SAM' : /^\d{4}-\d{2}-\d+/.test(no) ? 'Bosnet' : 'BarangKulakan');
export const tok = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const dateOf = (v) => {
  if (v instanceof Date) return iso(v);
  if (typeof v === 'number' && v > 30000) return iso(new Date(Math.round((v - 25569) * 86400000) + 12 * 3600000));
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(v)); return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

export function parseSoFile(wb, fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/^SO[\s_-]*/i, '').trim();
  const out = [];
  for (const n of wb.SheetNames) {
    const g = grid(wb.Sheets[n]);
    const hr = g.findIndex((r) => (r || []).some((v) => key(v) === 'NOSALESORDER'));
    if (hr < 0) continue;
    const H = g[hr].map(key);
    const c = (k) => H.indexOf(k);
    const iNo = c('NOSALESORDER'), iDt = c('TGLPESAN'), iId = c('IDPELANGGAN'), iNm = c('NAMAPELANGGAN'), iAmt = c('JUMLAHSISA'), iQ = c('KUANTITISISA'), iS = c('NAMASALESMAN');
    for (let r = hr + 1; r < g.length; r++) {
      const row = g[r] || [];
      const no = str(row[iNo]); if (!no) continue;
      const sales = iS >= 0 && str(row[iS]) ? str(row[iS]) : base;
      out.push({ no, date: dateOf(row[iDt]), sales, id: str(row[iId]), name: str(row[iNm]), amt: Math.round(toNum(row[iAmt])), qty: toNum(row[iQ]), src: srcOf(no) });
    }
  }
  if (!out.length) throw new Error('Kolom "No. Sales Order" tidak ketemu di file SO ini');
  return out;
}

export function stkDateFromName(name) {
  const m = /(\d{2})(\d{2})(?!\d)/.exec(name.replace(/\.[^.]+$/, ''));
  if (!m) return '';
  const d = +m[1], mo = +m[2];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return '';
  const y = new Date().getFullYear();
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function parseStkFile(wb, fileName) {
  const out = [];
  for (const n of wb.SheetNames) {
    const g = grid(wb.Sheets[n]);
    const hr = g.findIndex((r) => (r || []).some((v) => key(v) === 'NILAIFAKTUR'));
    if (hr < 0) continue;
    const H = g[hr].map(key);
    const iNil = H.indexOf('NILAIFAKTUR'), iSt = H.indexOf('STATUS');
    let iS = H.lastIndexOf('S'); if (iS < 0) iS = H.length - 1;
    const body = g.slice(hr + 1).filter((r) => r && r.some((v) => v != null && v !== ''));
    const idCols = [];
    for (let i = 0; i < H.length; i++) { const hit = body.filter((r) => /^\d{4}-\d{2}-\d{4,}$/.test(str(r[i]))).length; if (hit > body.length * 0.5) idCols.push(i); }
    if (!idCols.length) continue;
    const iId = idCols[0], iFk = idCols[1] ?? -1;
    const iNm = H.findIndex((h, i) => h === 'NAMAPELANGGAN' && i > iId - 1);
    for (const r of body) {
      const id = str(r[iId]); if (!/^\d{4}-/.test(id)) continue;
      out.push({ id, name: str(r[iNm]), sales: str(r[iS]), faktur: iFk >= 0 ? str(r[iFk]) : '', nilai: Math.round(toNum(r[iNil])), status: iSt >= 0 ? str(r[iSt]) : '' });
    }
  }
  if (!out.length) throw new Error('File ini tidak terbaca sebagai STK (butuh kolom NILAI FAKTUR dan ID pelanggan)');
  return out;
}

export function addWorkdays(dateIso, n, isHoliday = () => false) {
  const d = fromIso(dateIso);
  let k = 0;
  while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && !isHoliday(d)) k++; }
  return iso(d);
}

export const gkey = (g) => `${g.date}|${g.sk}|${g.id}`;
export function analyze(slot, isHoliday, todayIso) {
  const so = slot?.so || [], stk = slot?.stk || [];
  const stkDates = [...new Set(stk.map((x) => x.date))].sort();
  const maxStk = stkDates[stkDates.length - 1] || '';
  const groups = new Map();
  for (const x of so) {
    if (!x.date) continue;
    const sk = tok(x.sales)[0] || x.sales;
    const k = `${x.date}|${sk}|${x.id}`;
    const g = groups.get(k) || { date: x.date, sk, sales: x.sales, id: x.id, name: x.name, omset: 0, retur: 0, nos: [], src: new Set() };
    if (x.amt >= 0) g.omset += x.amt; else g.retur += x.amt;
    g.nos.push(x.no); g.src.add(x.src); groups.set(k, g);
  }
  const rows = [];
  for (const g of groups.values()) {
    const due = addWorkdays(g.date, 2, isHoliday);
    const net = g.omset + g.retur;
    const mine = stk.filter((s) => s.id === g.id && s.date >= g.date && s.date <= due && tok(s.sales).includes(g.sk));
    const sum = mine.reduce((a, s) => a + s.nilai, 0);
    let status;
    if (g.omset === 0 && g.retur === 0) status = 'Nol';
    else if (net <= 0) status = 'Retur';
    else if (!sum && (!maxStk || maxStk < due)) status = todayIso && due < todayIso && !maxStk ? 'Belum' : 'Menunggu STK';
    else if (!sum) status = 'Belum';
    else if (sum >= net * 0.95) status = 'Terkirim';
    else status = 'Sebagian';
    rows.push({ ...g, key: `${g.date}|${g.sk}|${g.id}`, src: [...g.src], net, due, stk: sum, status, overdue: !['Terkirim', 'Retur', 'Nol'].includes(status) && todayIso > due });
  }
  return { rows, stkDates, maxStk };
}
