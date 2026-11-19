const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const h = []; p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.evaluate(tohum); await p.evaluate(() => localStorage.removeItem('kitabim-hangi-rafta:gecmis'));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(300);
  // raf ekle
  await p.click('#sek-raflar'); await p.fill('#raf-etiket', 'Hikâye'); await p.fill('#raf-bolme', '2'); await p.click('#raf-ekle-dugme');
  // kitap ekle (çalışan rolüyle ayrı sekmede)
  const c = await ctx.newPage(); c.on('pageerror', (e) => h.push('çalışan: ' + e.message));
  await c.goto(K + 'yonetim.html?yerel=1&rol=calisan'); await c.waitForTimeout(300);
  await c.click('.ust-cubuk [data-is=kitap-yeni]'); await c.fill('#f-ad', 'Suç ve Ceza'); await c.selectOption('#f-raf', { label: '3. Raf · Roman ve hikâye' }); await c.click('#f-kaydet'); await c.waitForTimeout(150); await c.keyboard.press('Escape');
  // kitap taşı (Simyacı 3.2 → 3.3)
  await c.click('#sek-kitaplar'); await c.fill('#liste-ara', 'simyacı');
  await c.click('#tum-kitaplar [data-is=kitap-duzenle]'); await c.selectOption('#f-bolme', { label: '3.3' }); await c.click('#f-kaydet'); await c.waitForTimeout(150); await c.keyboard.press('Escape');
  // fiyat güncelle, sonra sil
  await c.fill('#liste-ara', 'sözlük');
  await c.click('#tum-kitaplar [data-is=kitap-duzenle]'); await c.fill('#f-fiyat', '475'); await c.click('#f-kaydet'); await c.waitForTimeout(150); await c.keyboard.press('Escape');
  await c.click('#tum-kitaplar [data-is=kitap-sil]'); await c.click('.pencere button[type=submit]'); await c.waitForTimeout(150);
  console.log('çalışan geçmiş sekmesini görüyor mu:', await c.isVisible('#sek-gecmis'));
  // ayar
  await p.reload(); await p.waitForTimeout(300);
  await p.click('#sek-ayarlar'); await p.uncheck('#ayar-fiyat'); await p.waitForTimeout(150);
  await p.click('#sek-gecmis'); await p.waitForTimeout(200);
  const satirlar = await p.$$eval('#gecmis-liste li:not(.gun)', (x) => x.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  console.log(satirlar.join('\n'));
  await p.selectOption('#gecmis-konu', 'kitap');
  console.log('yalnız kitaplar:', await p.$$eval('#gecmis-liste li:not(.gun)', (x) => x.length));
  await p.selectOption('#gecmis-konu', '');
  await p.screenshot({ path: OUT + '/gecmis-panel.png' });
  const r = await ctx.newPage(); await r.goto(K + 'yonetim.html?yerel=1&rol=revizeci'); await r.waitForTimeout(300);
  console.log('revize veren görüyor mu:', await r.isVisible('#sek-gecmis'));
  console.log('hatalar:', h);
  await b.close();
})();
