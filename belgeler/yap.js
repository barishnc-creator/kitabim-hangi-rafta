const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const fs = require('fs');
  for (const [ad, cikti, altyazi] of [['proje.html', 'Kitabim-Hangi-Rafta-Proje-Dokumani.pdf', 'Kitabım Hangi Rafta? · Proje dokümanı'], ['fiyat.html', 'Kitabim-Hangi-Rafta-Fiyat-Notu-IC-KULLANIM.pdf', 'Fiyat ve piyasa notu · iç kullanım']]) {
    if (!fs.existsSync(path.join(__dirname, ad))) continue; // fiyat notu depoda tutulmaz
    await p.goto('file://' + path.join(__dirname, ad), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: path.join(__dirname, cikti), format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font-size:8px;color:#6B7280;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>' + altyazi + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' } });
    console.log(cikti);
  }
  await b.close();
})();
