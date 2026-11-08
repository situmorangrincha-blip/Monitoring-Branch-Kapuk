import { useEffect, useRef, useState } from 'react';
import '../lib/polyfill.js';

// Preview PDF tanpa unduh: halaman dirender dengan pdf.js jadi gambar (jalan juga di HP).
export default function PreviewPane({ pv, onClose }) {
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const blobRef = useRef(null);

  useEffect(() => {
    if (!pv) return undefined;
    let dead = false;
    setPages([]); setErr(''); setBusy(true);
    (async () => {
      try {
        const blob = await pv.make();
        blobRef.current = blob;
        const buf = await blob.arrayBuffer();
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        const imgs = [];
        for (let p = 1; p <= Math.min(doc.numPages, 60); p++) {
          const page = await doc.getPage(p);
          const vp = page.getViewport({ scale: 1.5 });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          imgs.push(cv.toDataURL('image/jpeg', 0.85));
          if (dead) return;
          setPages([...imgs]);
        }
        setPages(imgs);
        if (doc.numPages > 60) setErr(`Preview menampilkan 60 halaman pertama dari ${doc.numPages}. Unduh PDF untuk semuanya.`);
      } catch (e) { if (!dead) setErr(e?.message || String(e)); }
      if (!dead) setBusy(false);
    })();
    return () => { dead = true; };
  }, [pv]);

  const download = () => { if (!blobRef.current) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blobRef.current); a.download = (pv.file || 'preview') + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  return (
    <aside className={'ws-pv' + (pv ? ' on' : '')} aria-hidden={!pv}>
      {pv && (
        <div className="pv-in">
          <div className="pv-head">
            <b>{pv.title}</b>
            <span className="mut">{busy ? 'menyusun…' : `${pages.length} halaman`}</span>
            <span style={{ flex: 1 }} />
            <button className="btn sm" onClick={download} disabled={busy}>Unduh PDF</button>
            <button className="btn sm" onClick={onClose}>Tutup</button>
          </div>
          <div className="pv-body">
            {err && <div className="warn err">{err}</div>}
            {pages.map((src, i) => <img key={i} className="pv-page" src={src} alt={`Halaman ${i + 1}`} style={{ animationDelay: Math.min(i, 6) * 60 + 'ms' }} />)}
            {busy && !pages.length && <div className="empty"><p className="mut">Menyusun preview…</p></div>}
          </div>
        </div>
      )}
    </aside>
  );
}
