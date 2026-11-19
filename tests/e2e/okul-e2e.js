const { chromium, devices } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const h = []; p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.evaluate(tohum);
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(300); await p.click('#sek-okul');
  console.log('sekme başlığı:', await p.textContent('#sayfa-baslik'));
  await p.fill('#okul-ad', 'Örnek Ortaokulu');
  await p.fill('#okul-sinif', '7-A');
  await p.fill('#okul-metin', '1- 7. Sınıf Matematik Soru Bankası\n2- 7. sinif fen bilimleri konu anlatimi\n3- 7. sınıf türkçe soru bankası\n4- İngilizce Workbook 7. sınıf\n5- Kurk Mantolu Madona - Sabahattin Ali\n6- Küçük Prens\n7- Sefiller (çocuk klasikleri)');
  await p.click('#okul-eslestir');
  console.log('özet:', await p.textContent('#okul-ozet'));
  await p.screenshot({ path: OUT + '/okul-panel.png', fullPage: true });
  await p.click('#okul-form button[type=submit]');
  await p.waitForTimeout(200);
  console.log('kayıt:', await p.textContent('#okul-mesaj'), '|', await p.textContent('#okul-listeler'));
  // aynı okul+sınıf ikinci kez
  await p.click('#okul-yeni');
  await p.fill('#okul-ad', 'örnek ortaokulu'); await p.fill('#okul-sinif', '7-a'); await p.fill('#okul-metin', 'Simyacı');
  await p.click('#okul-form button[type=submit]'); await p.waitForTimeout(200);
  console.log('mükerrer:', await p.textContent('#okul-mesaj'));
  await p.fill('#okul-sinif', '8-A'); await p.fill('#okul-metin', '8. Sınıf LGS Deneme Seti\nSimyacı');
  await p.click('#okul-form button[type=submit]'); await p.waitForTimeout(200);
  // "Kitap ekle" ile eksik kitap
  await p.click('[data-okul]:has-text("7-A")');
  await p.click('[data-kalem-ekle]');
  console.log('çekmece açık, ad:', await p.inputValue('#f-ad'));
  await p.keyboard.press('Escape');
  // kiosk
  const k = await ctx.newPage(); k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.waitForTimeout(300);
  console.log('kiosk okul düğmesi:', await k.textContent('#okul-gezin'));
  await k.click('#okul-gezin [data-okul-ad]');
  await k.click('[data-liste]:has-text("7-A")');
  await k.waitForTimeout(200);
  console.log('liste satırı:', await k.$$eval('.liste-satir', (x) => x.length), '| durum:', await k.textContent('.ilerleme + p'));
  console.log('talep düğmesi:', await k.textContent('[data-talep-liste]'));
  await k.screenshot({ path: OUT + '/okul-kiosk.png', fullPage: true });
  await k.click('.liste-satir[data-kitap="k6"]');
  console.log('satıra tıklayınca:', await k.textContent('.k-yer strong'));
  // telefon
  const lid = await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).okulListeleri.find((l) => l.sinif === '7-A').id);
  const t = await ctx.newPage(); await t.setViewportSize({ width: 390, height: 844 });
  await t.goto(K + 'index.html?yerel=1&liste=' + lid); await t.waitForTimeout(300);
  console.log('telefon:', await t.textContent('#sonuc h2'), '| geri yok:', !(await t.isVisible('[data-is=ana]')), '| taşma:', await t.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await t.screenshot({ path: OUT + '/okul-telefon.png', fullPage: true });
  console.log('hatalar:', h);
  await b.close();
})();
