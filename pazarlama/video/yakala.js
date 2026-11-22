// Tanıtım videosu için uygulamanın ekran görüntüleri (sahte örnek veriyle).
// Kullanım: depo kökünde `python3 -m http.server 8765`, sonra `node pazarlama/video/yakala.js <çıktı klasörü>`
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const tohum = require('../../tests/e2e/tohum.js');
const kaynak = fs.readFileSync(path.join(__dirname, '../../tests/e2e/pdf-goruntu.js'), 'utf8');
const zengin = kaynak.slice(kaynak.indexOf('function zenginlestir()'), kaynak.indexOf('// Örnek kampanya'));
const gorselKod = kaynak.slice(kaynak.indexOf('async function kampanyaGorseli'), kaynak.indexOf('(async () => {'));
const zenginlestir = new Function(zengin + '; return zenginlestir;')();
const kampanyaGorseli = new Function(gorselKod + '; return kampanyaGorseli;')();
const OUT = process.argv[2] || 'kareler', K = 'http://localhost:8765/';
fs.mkdirSync(OUT, { recursive: true });
const bekle = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const kampanyalar = [{ id: 'kp1', baslik: 'Okula dönüşte test kitaplarında %20 indirim', aciklama: 'Tüm LGS, TYT ve AYT kitaplarında, kasada geçerli.', resim: await kampanyaGorseli(b, '#EA580C', '#BE123C', '%20') }];
  const hazirla = async (p) => {
    await p.goto(K + 'index.html?yerel=1'); await p.evaluate(tohum); await p.evaluate(zenginlestir);
    await p.evaluate((l) => { const v = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')); v.ayarlar.kampanyalar = l; localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify(v)); }, kampanyalar);
    // Videoda gerçek gibi görünen telefon numarası olmasın
    await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:talepler')); t.forEach((x) => { x.telefon = ''; }); localStorage.setItem('kitabim-hangi-rafta:talepler', JSON.stringify(t)); });
  };
  // Müşteri ekranı (dükkândaki tablet, dikey)
  const kc = await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1.5 });
  const k = await kc.newPage(); await hazirla(k);
  const f = (p, ad) => p.screenshot({ path: OUT + '/' + ad + '.png' });
  await k.goto(K + 'index.html?yerel=1&kiosk=1'); await bekle(k, 800); await f(k, 'k-karsilama');
  const s = 'kürk'; for (let i = 1; i <= s.length; i++) { await k.fill('#sorgu', s.slice(0, i)); await bekle(k, 150); await f(k, 'k-yaz-' + i); }
  await k.press('#sorgu', 'Enter'); await bekle(k, 3800); await f(k, 'k-sonuc'); await k.screenshot({ path: OUT + '/k-sonuc-tam.png', fullPage: true });
  await k.click('#ana-sayfa'); await k.click('#okul-gezin [data-okul-ad="Örnek Ortaokulu"]'); await bekle(k, 300); await f(k, 'k-okul-sinif');
  await k.click('[data-liste="l1"]'); await bekle(k, 400); await f(k, 'k-okul');
  await k.click('#ana-sayfa'); await k.fill('#sorgu', 'Suç ve Ceza'); await k.press('#sorgu', 'Enter'); await bekle(k, 600); await f(k, 'k-bulunamadi');
  await k.click('[data-talep-kitap]'); await k.fill('#t-ad', 'Ayşe'); await bekle(k, 300); await f(k, 'k-talep');
  // Telefon: okul listesi QR'dan açılınca
  const tc = await b.newContext({ ...devices['iPhone 13'] }); const t = await tc.newPage(); await hazirla(t);
  await t.goto(K + 'index.html?yerel=1&liste=l1'); await bekle(t, 1500); await t.screenshot({ path: OUT + '/t-liste.png', fullPage: true });
  // Yönetim paneli
  const pc = await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1.5 });
  const p = await pc.newPage(); await hazirla(p);
  await p.goto(K + 'yonetim.html?yerel=1'); await bekle(p, 800); await p.evaluate(() => window.scrollTo(0, 0)); await bekle(p, 200); await f(p, 'p-genel');
  await p.click('#sek-talepler'); await bekle(p, 400); await f(p, 'p-talepler');
  await p.click('#sek-raflar'); await bekle(p, 300); await p.click('button.bolme:has-text("3.1")').catch(() => {}); await bekle(p, 300); await f(p, 'p-raflar');
  await p.click('#sek-urun-girisi'); await p.setInputFiles('#giris-dosya', path.join(__dirname, '../../tests/veri/libreoffice-ornek.xls'));
  await p.waitForSelector('#giris-onizleme:not([hidden])'); await bekle(p, 300);
  await p.evaluate(() => { document.getElementById('giris-ozet').scrollIntoView(); window.scrollBy(0, -140); }); await f(p, 'p-urun');
  await p.evaluate(() => { document.getElementById('yerlestir').scrollIntoView(); window.scrollBy(0, -40); }); await f(p, 'p-yerlestir');
  await b.close();
  console.log(fs.readdirSync(OUT).join(' '));
})();
