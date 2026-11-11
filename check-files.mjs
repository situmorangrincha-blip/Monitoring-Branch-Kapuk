// Dijalankan sebelum build. Kalau ada file yang tidak ikut ke-upload ke GitHub,
// log Vercel akan menampilkan daftar file yang benar-benar ada, bukan error Rollup yang membingungkan.
import fs from 'node:fs';
import path from 'node:path';

const need = [
  'index.html', 'vite.config.js',
  'src/main.jsx', 'src/App.jsx', 'src/styles.css', 'src/theme.css',
  'src/lib/parse.js', 'src/lib/table.js', 'src/lib/ingest.js', 'src/lib/calc.js', 'src/lib/store.js', 'src/lib/audio.js', 'src/lib/theme.js', 'src/lib/rules.js', 'src/lib/dapAuto.js', 'src/lib/rapot.js', 'src/lib/rapotPdf.js', 'src/lib/dapModel.js', 'src/lib/dapPdf.js',
  'src/components/Gate.jsx', 'src/components/Backdrop.jsx', 'src/components/Mascot.jsx', 'src/components/MusicDock.jsx', 'src/components/charts.jsx', 'src/components/SnapFrame.jsx', 'src/components/ui.jsx', 'src/components/SalFilter.jsx', 'src/components/StoreModal.jsx', 'src/components/UploadModal.jsx', 'src/components/PromoPane.jsx', 'src/lib/promo.js',
  'src/pages/Explore.jsx', 'src/pages/Itg.jsx', 'src/pages/Programs.jsx', 'src/pages/SoDo.jsx', 'src/components/PreviewPane.jsx', 'src/lib/progcat.js', 'src/lib/itg.js', 'src/lib/contract.js', 'src/lib/contractPdf.js', 'src/lib/sodo.js', 'src/lib/dayTarget.js', 'src/lib/ctarget.js', 'src/lib/contractRec.js', 'src/lib/polyfill.js', 'src/pages/Rapot.jsx', 'src/components/RulesPane.jsx', 'src/pages/Performance.jsx', 'src/pages/Focus.jsx', 'src/pages/Stores.jsx', 'src/pages/Pareto.jsx', 'src/pages/Salesman.jsx', 'src/pages/Charts.jsx', 'src/pages/Dap.jsx',
  'src/pages/Market.jsx', 'src/pages/SkuRank.jsx', 'src/pages/ItgV2.jsx', 'src/pages/itgv2.css', 'src/components/GTable.jsx', 'src/components/FocusPicker.jsx',
  'src/lib/market.js', 'src/lib/itgProg.js', 'src/lib/geryRobot.js', 'src/lib/geryScenes.js', 'src/pages/Gery.jsx', 'src/pages/gery.css', 'src/lib/scupContract.js', 'src/lib/contractPdfScup.js', 'src/pages/ItgScupContract.jsx', 'src/lib/scup.js', 'src/pages/ItgScup.jsx', 'src/lib/fonts.js', 'src/components/Board.jsx', 'src/lib/dapBlocks.js', 'src/pages/DapEditor.jsx', 'src/lib/contractPdf2.js', 'src/lib/unit.js', 'src/components/ViewPrefs.jsx', 'src/lib/skuBlocks.js', 'src/lib/itg2.js', 'src/lib/dapAuto.js', 'src/lib/dapModel.js',
  'api/data.js',
];
const missing = need.filter((f) => !fs.existsSync(f));
if (!missing.length) {
  console.log(`[check-files] OK, ${need.length} file wajib ada.`);
  process.exit(0);
}
const walk = (dir, depth = 0, out = []) => {
  if (depth > 2) return out;
  for (const n of fs.readdirSync(dir).sort()) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = path.join(dir, n);
    out.push('  '.repeat(depth) + n + (fs.statSync(p).isDirectory() ? '/' : ''));
    if (fs.statSync(p).isDirectory()) walk(p, depth + 1, out);
  }
  return out;
};
console.error('\n[check-files] FILE BERIKUT TIDAK ADA DI REPO:');
missing.forEach((f) => console.error('  - ' + f));
console.error('\nIsi folder build (' + process.cwd() + '):\n' + walk('.').join('\n'));
console.error('\nBerarti file/folder di atas belum ke-upload ke GitHub. Upload ulang yang hilang lalu redeploy.\n');
process.exit(1);
