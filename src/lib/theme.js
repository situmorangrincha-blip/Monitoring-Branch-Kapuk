// Tema warna: satu warna dasar -> seluruh turunannya (aksen, gelap, lembut, garis).
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (a) => `rgb(${a.join(',')})`;
export const PRESETS = [
  { id: 'lilac', name: 'Ungu pastel', hex: '#8b7bd8' },
  { id: 'blue', name: 'Biru', hex: '#4a8fdb' },
  { id: 'sage', name: 'Hijau sage', hex: '#5fa688' },
  { id: 'rose', name: 'Mawar', hex: '#d77a9a' },
  { id: 'teal', name: 'Teal', hex: '#2fa3a8' },
  { id: 'slate', name: 'Slate', hex: '#6b7a99' },
  { id: 'amber', name: 'Amber', hex: '#d9953a' },
];
export function themeVars(h) {
  const c = hex(h);
  if (!c) return undefined;
  return {
    '--ac': css(c), '--ac-d': css(mix(c, [20, 20, 40], 0.45)),
    '--ac-soft': css(mix(c, [255, 255, 255], 0.9)), '--ac-line': css(mix(c, [255, 255, 255], 0.72)),
  };
}
