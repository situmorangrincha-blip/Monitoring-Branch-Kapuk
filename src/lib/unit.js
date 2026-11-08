import { useEffect, useState } from 'react';

// satuan angka (Rp penuh atau juta) dan ukuran huruf, tersimpan di browser dan berlaku di seluruh web
const KU = 'sm_unit', KF = 'sm_fs2';
export const FS_STEPS = [0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4];
const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export const getUnit = () => (get(KU, 'rp') === 'jt' ? 'jt' : 'rp');
export function setUnit(u) { try { localStorage.setItem(KU, u); } catch { /* abaikan */ } window.dispatchEvent(new Event('sm-unit')); }
export function useUnit() {
  const [u, setU] = useState(getUnit);
  useEffect(() => { const f = () => setU(getUnit()); window.addEventListener('sm-unit', f); return () => window.removeEventListener('sm-unit', f); }, []);
  return u;
}
export const fmtMoney = (n, u = getUnit()) => {
  const v = Number(n) || 0;
  return u === 'jt' ? (v / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('id-ID');
};
export const unitLabel = (u = getUnit()) => (u === 'jt' ? 'jt' : 'Rp');

export const getFs = () => { const v = parseFloat(get(KF, '1')); let b = 4, d = 9; FS_STEPS.forEach((x, i) => { if (Math.abs(x - v) < d) { d = Math.abs(x - v); b = i; } }); return b; };
export function applyFs(i = getFs()) { const r = typeof document !== 'undefined' && document.getElementById('root'); if (r) r.style.zoom = String(FS_STEPS[i]); }
export function setFs(i) { try { localStorage.setItem(KF, String(FS_STEPS[i])); } catch { /* abaikan */ } applyFs(i); window.dispatchEvent(new Event('sm-fs')); }
export function useFs() {
  const [i, setI] = useState(getFs);
  useEffect(() => { const f = () => setI(getFs()); window.addEventListener('sm-fs', f); return () => window.removeEventListener('sm-fs', f); }, []);
  return i;
}
