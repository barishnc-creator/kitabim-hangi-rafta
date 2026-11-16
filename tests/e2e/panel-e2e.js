const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
  await p.goto('http://localhost:8765/yonetim.html?yerel=1');
  // örnek veri: raflar arayüzden, kitaplar CSV'den
  for (const [e, n] of [['Okul kitapları', 4], ['Test kitapları', 4], ['Roman ve hikâye', 3], ['Sözlük ve atlas', 2]]) {
    await p.click('#sek-raflar');
    await p.fill('#raf-etiket', e); await p.fill('#raf-bolme', String(n)); await p.click('#raf-ekle-dugme');
  }
  const csv = ['Kitap adı;Yazar;Yayınevi;Barkod;Raf/Bölme;Fiyat;Stok',
    '7. Sınıf Matematik Soru Bankası;Örnek Yazar;Örnek Yayınları;9780306406157;2.3;249,90;5',
    '8. Sınıf LGS Deneme Seti;Örnek Yazar;Örnek Yayınları;;2.1;310;0',
    'Kürk Mantolu Madonna;Sabahattin Ali;Yapı Kredi Yayınları;;3.1;125;12',
    'Simyacı;Paulo Coelho;Can Yayınları;;3.2;160;4',
    'Türkçe Sözlük;TDK;TDK Yayınları;;4.1;450;2',
    '5. Sınıf Fen Bilimleri;Örnek Yazar;Örnek Yayınları;;1.2;180;7',
    'Yanlış satır;;;;9.9;;'].join('\n');
  await p.click('#sek-kitaplar');
  await p.setInputFiles('#csv-yukle', { name: 'k.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await p.waitForTimeout(300);
  console.log('içe aktarma penceresi:', (await p.textContent('.pencere')).replace(/\s+/g, ' ').slice(0, 160));
  await p.click('.pencere button[type=submit]');
  await p.waitForTimeout(300);
  console.log('mesaj:', await p.textContent('#genel-mesaj'));
  // arama kayıtları
  await p.evaluate(() => {
    const k = [];
    const ekle = (s, n, t) => { for (let i = 0; i < t; i++) k.push({ sorgu: s, sonuc: n, zaman: new Date().toISOString() }); };
    ekle('LGS deneme', 2, 9); ekle('Kürk Mantolu Madonna', 1, 6); ekle('matematik', 3, 4);
    ekle('Harry Potter', 0, 5); ekle('Sefiller', 0, 3);
    localStorage.setItem('kitabim-hangi-rafta:aramalar', JSON.stringify(k));
  });
  await p.click('#sek-ayarlar');
  await p.fill('#ayar-magaza', 'Deniz Kırtasiye');
  await p.click('#magaza-form button[type=submit]');
  await p.click('#sek-genel');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/p-genel.png', fullPage: true });
  await p.click('#sek-kitaplar');
  await p.screenshot({ path: OUT + '/p-kitaplar.png', fullPage: true });
  console.log('tablo satır:', await p.$$eval('#tum-kitaplar tr', (x) => x.length));
  await p.selectOption('#liste-raf', { index: 3 });
  console.log('3. raf filtresi:', await p.$$eval('#tum-kitaplar tr', (x) => x.length));
  await p.selectOption('#liste-raf', { index: 0 });
  // çekmece
  await p.click('.ust-cubuk [data-is=kitap-yeni]');
  await p.screenshot({ path: OUT + '/p-cekmece.png' });
  await p.keyboard.press('Escape');
  console.log('çekmece kapandı:', await p.isHidden('#kitap-form'));
  await p.click('#sek-etiketler');
  await p.waitForTimeout(200);
  console.log('etiket sayısı:', await p.$$eval('.etiket', (x) => x.length), 'qr svg:', await p.$$eval('.etiket svg', (x) => x.length));
  await p.screenshot({ path: OUT + '/p-etiket.png' });
  await p.click('#sek-raflar');
  await p.click('button.bolme:has-text("2.3")');
  await p.screenshot({ path: OUT + '/p-raflar.png' });
  const t = await ctx.newPage();
  await t.setViewportSize({ width: 390, height: 844 });
  await t.goto('http://localhost:8765/yonetim.html?yerel=1#kitaplar');
  console.log('telefon taşma:', await t.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await t.screenshot({ path: OUT + '/p-telefon.png' });
  console.log('hatalar:', hatalar);
  await b.close();
})();
