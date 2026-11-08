// Target harian dari Excel data utama: dipecah dari target bulanan salesman (TGT).
// - 'visit': jumlah target per kunjungan toko yang dijadwalkan hari itu (sama dengan logika DAP)
// - 'rata' : target bulanan / jumlah hari kerja (Senin-Sabtu, minus libur)
import { autoDapRows } from './dapAuto.js';
import { parseRoute, visitDays } from './calc.js';
import { tok } from './sodo.js';

export function workdaysIn(y, m, hol = []) {
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) if (new Date(y, m - 1, d).getDay() !== 0 && !hol.includes(d)) n++;
  return n;
}

export function buildDayTargeter(data, mode, holFor = () => []) {
  if (!data) return null;
  const rows = autoDapRows(data, mode).rows;
  const names = data.salesmen;
  const match = (so) => { const t = tok(so)[0]; return names.find((n) => tok(n).includes(t)) || null; };
  const cache = new Map();
  const month = (y, m) => {
    const k = `${y}-${m}`;
    if (cache.has(k)) return cache.get(k);
    const hol = holFor(y, m);
    const by = {};
    for (const r of rows) {
      const days = visitDays(parseRoute(r.r), y, m, hol);
      if (!days.length) continue;
      const per = r.t / days.length;
      const o = (by[r.s] ||= {});
      for (const d of days) o[d] = (o[d] || 0) + per;
    }
    cache.set(k, by);
    return by;
  };
  const monthly = (name) => data.targets?.[mode]?.[name]?.total || data.targets?.milestone?.[name]?.total || rows.filter((r) => r.s === name).reduce((a, r) => a + r.t, 0);
  return {
    match,
    targetFor(iso, soName, method = 'visit') {
      const name = match(soName);
      if (!name || method === 'manual') return null;
      const [y, m, d] = iso.split('-').map(Number);
      const hol = holFor(y, m);
      if (method === 'rata') {
        if (new Date(y, m - 1, d).getDay() === 0 || hol.includes(d)) return 0;
        return Math.round(monthly(name) / Math.max(1, workdaysIn(y, m, hol)));
      }
      return Math.round(month(y, m)[name]?.[d] || 0);
    },
  };
}
