// pilihan font web: dimuat hanya saat dipilih (tidak membebani halaman awal)
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const mk = (id, label, family, pkg, kind = 'sans') => ({ id, label, kind, css: `'${family}', ${kind === 'serif' ? 'Georgia, serif' : kind === 'mono' ? 'ui-monospace, Menlo, monospace' : SANS}`, load: () => Promise.all([import(`../../node_modules/@fontsource/${pkg}/latin-500.css`), import(`../../node_modules/@fontsource/${pkg}/latin-700.css`)]) });
export const FONTS = [
  { id: 'quicksand', label: 'Quicksand (bawaan)', kind: 'sans', css: `'Quicksand', ${SANS}`, load: () => Promise.resolve() },
  mk('nunito', 'Nunito', 'Nunito', 'nunito'),
  mk('inter', 'Inter', 'Inter', 'inter'),
  mk('poppins', 'Poppins', 'Poppins', 'poppins'),
  mk('lexend', 'Lexend', 'Lexend', 'lexend'),
  mk('dm-sans', 'DM Sans', 'DM Sans', 'dm-sans'),
  mk('manrope', 'Manrope', 'Manrope', 'manrope'),
  mk('montserrat', 'Montserrat', 'Montserrat', 'montserrat'),
  mk('roboto', 'Roboto', 'Roboto', 'roboto'),
  mk('open-sans', 'Open Sans', 'Open Sans', 'open-sans'),
  mk('source-sans-3', 'Source Sans 3', 'Source Sans 3', 'source-sans-3'),
  mk('ibm-plex-sans', 'IBM Plex Sans', 'IBM Plex Sans', 'ibm-plex-sans'),
  mk('plus-jakarta-sans', 'Plus Jakarta Sans', 'Plus Jakarta Sans', 'plus-jakarta-sans'),
  mk('work-sans', 'Work Sans', 'Work Sans', 'work-sans'),
  mk('raleway', 'Raleway', 'Raleway', 'raleway'),
  mk('fira-sans', 'Fira Sans', 'Fira Sans', 'fira-sans'),
  mk('noto-sans', 'Noto Sans', 'Noto Sans', 'noto-sans'),
  mk('comfortaa', 'Comfortaa (bulat)', 'Comfortaa', 'comfortaa'),
  mk('space-grotesk', 'Space Grotesk', 'Space Grotesk', 'space-grotesk'),
  mk('lora', 'Lora (serif)', 'Lora', 'lora', 'serif'),
  mk('merriweather', 'Merriweather (serif)', 'Merriweather', 'merriweather', 'serif'),
  mk('jetbrains-mono', 'JetBrains Mono (mono)', 'JetBrains Mono', 'jetbrains-mono', 'mono'),
  { id: 'system', label: 'Font sistem', kind: 'sans', css: SANS, load: () => Promise.resolve() },
];
const K = 'sm_font';
export const getFontId = () => { try { return localStorage.getItem(K) || 'quicksand'; } catch { return 'quicksand'; } };
export async function applyFont(id = getFontId()) {
  const f = FONTS.find((x) => x.id === id) || FONTS[0];
  try { await f.load(); } catch { /* font gagal dimuat: pakai font cadangan */ }
  const r = document.documentElement;
  r.style.setProperty('--ui', f.css);
  r.style.setProperty('--head', f.css);
  return f;
}
export function setFont(id) { try { localStorage.setItem(K, id); } catch { /* abaikan */ } window.dispatchEvent(new Event('sm-font')); return applyFont(id); }
