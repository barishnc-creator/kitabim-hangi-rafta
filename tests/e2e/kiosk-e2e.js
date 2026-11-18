const { chromium } = require('playwright');
const OUT = process.argv[2] || require('os').tmpdir();
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  // Örnek veri: paneldeki CSV içe aktarmayla
  await p.goto('http://localhost:8765/yonetim.html?yerel=1');
  for (const [e, n] of [['Okul kitapları', 4], ['Test kitapları', 4], ['Roman ve hikâye', 3], ['Sözlük ve atlas', 2]]) {
    await p.click('#sek-raflar');
    await p.fill('#raf-etiket', e); await p.fill('#raf-bolme', String(n)); await p.click('#raf-ekle-dugme');
  }
  const csv = ['Kitap adı;Yazar;Yayınevi;Barkod;Raf/Bölme;Fiyat;Stok',
    '7. Sınıf Matematik Soru Bankası;Örnek Yazar;Örnek Yayınları;9780306406157;2.3;249,90;5',
    '8. Sınıf LGS Deneme Seti;Örnek Yazar;Örnek Yayınları;;2.1;310;0',
    'Kürk Mantolu Madonna;Sabahattin Ali;Yapı Kredi Yayınları;;3.1;125;2',
    'Simyacı;Paulo Coelho;Can Yayınları;;3.2;160;4',
    'Türkçe Sözlük;TDK;TDK Yayınları;;4.1;450;2',
    '5. Sınıf Fen Bilimleri;Örnek Yazar;Örnek Yayınları;;1.2;180;7',
    '7. Sınıf Matematik Konu Anlatımı;Örnek Yazar;Örnek Yayınları;;2.3;199;3'].join('\n');
  await p.click('#sek-kitaplar');
  await p.setInputFiles('#csv-yukle', { name: 'k.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await p.waitForTimeout(200);
  await p.click('.pencere button[type=submit]');
  await p.click('#sek-ayarlar');
  await p.fill('#ayar-magaza', 'Deniz Kırtasiye');
  await p.click('#magaza-form button[type=submit]');
  await p.evaluate(() => localStorage.removeItem('kitabim-hangi-rafta:aramalar'));

  const k = await ctx.newPage();
  k.on('pageerror', (e) => hatalar.push('kiosk: ' + e.message));
  await k.goto('http://localhost:8765/index.html?yerel=1&kiosk=1');
  await k.waitForTimeout(300);
  console.log('başlık:', await k.textContent('#magaza-adi'), '| raf düğmesi:', await k.$$eval('.k-raf-dugme', (x) => x.length), '| yeniler:', await k.$$eval('#yeniler .k-kart', (x) => x.length));
  await k.screenshot({ path: OUT + '/k-karsilama.png', fullPage: true });
  // ekran klavyesiyle yaz
  await k.click('#secim-yaz');
  console.log('klavye açık:', await k.isVisible('.klavye'));
  for (const h of ['k', 'ü', 'r', 'k']) await k.click(`.klavye [data-tus="${h}"]`);
  await k.waitForTimeout(400);
  await k.screenshot({ path: OUT + '/k-klavye.png' });
  console.log('yazılan:', await k.inputValue('#sorgu'), '| yer:', await k.textContent('.k-yer strong'));
  await k.click('.klavye [data-islem=ara]');
  await k.waitForTimeout(300);
  console.log('stok rozeti:', await k.textContent('.k-rozetler'), '| telefon QR:', await k.isVisible('.k-telefon svg'));
  await k.waitForTimeout(3700);
  await k.screenshot({ path: OUT + '/k-sonuc.png', fullPage: true });
  // çok sonuçlu
  await k.fill('#sorgu', 'matematik');
  await k.press('#sorgu', 'Enter');
  console.log('çoklu:', await k.textContent('.k-liste-baslik'));
  // raf QR
  await k.fill('#sorgu', 'RAF:2.3');
  await k.press('#sorgu', 'Enter');
  console.log('raf QR:', (await k.textContent('#sonuc h2')), (await k.$$eval('#sonuc .k-izgara .k-kart', (x) => x.length)) + ' kitap');
  // raf gezinme
  await k.click('#ana-sayfa');
  await k.click('.k-raf-dugme >> nth=2');
  console.log('raf gezin:', await k.textContent('#sonuc h2'));
  // bulunamadı + kayıt
  await k.fill('#sorgu', 'Harry Potter');
  await k.press('#sorgu', 'Enter');
  console.log('bulunamadı:', await k.textContent('#sonuc h2'));
  const kayit = await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:aramalar') || '[]').map((x) => x.sorgu + '=' + x.sonuc));
  console.log('arama kaydı:', kayit.join(', '));
  // telefona al bağlantısı
  const id = await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).kitaplar[2].id);
  const t = await b.newPage({ viewport: { width: 390, height: 844 } });
  await t.goto('http://localhost:8765/index.html?yerel=1&kitap=' + id);
  await t.waitForTimeout(300);
  console.log('telefonda kitap:', await t.textContent('.k-detay h2').catch(() => 'yok (yerel veri telefonda yok — beklenen)'));
  const tk = await ctx.newPage();
  await tk.setViewportSize({ width: 390, height: 844 });
  await tk.goto('http://localhost:8765/index.html?yerel=1&kitap=' + id);
  await tk.waitForTimeout(300);
  console.log('aynı tarayıcıda telefon görünümü:', await tk.textContent('.k-detay h2'), '| taşma:', await tk.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await tk.screenshot({ path: OUT + '/k-telefon.png', fullPage: true });
  console.log('hatalar:', hatalar);
  await b.close();
})();
