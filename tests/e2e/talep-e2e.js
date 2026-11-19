// Müşteri kitap talebi (deneme modu):
// - "Talep oluştur": yalnız kitap adı zorunlu, ad/telefon isteğe bağlı, KVKK onay kutusu yok
// - okul listesi eksikleri: her kitap için ayrı talep
// - panelde aynı kitap tek satır, talep sayısı artar; "Kapat" satırın bütün taleplerini siler
const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const k = await ctx.newPage();
  const h = []; let tamam = true;
  const bekle = (kosul, ad) => { console.log((kosul ? '  tamam: ' : '  BAŞARISIZ: ') + ad); if (!kosul) tamam = false; };
  k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.evaluate(tohum);
  await k.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1'));
    v.okulListeleri = [{ id: 'l1', okul: 'Örnek Ortaokulu', sinif: '7-A', kalemler: [{ metin: '7. Sınıf Matematik Soru Bankası', kitapId: 'k1' }, { metin: 'Suç ve Ceza', kitapId: null }, { metin: 'Sefiller', kitapId: null }] }];
    localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify(v));
    localStorage.setItem('kitabim-hangi-rafta:talepler', '[]');
  });
  await k.goto(K + 'index.html?yerel=1&kiosk=1'); await k.waitForTimeout(300);
  bekle(/Talep oluşturun/.test(await k.textContent('#secim-talep')), 'karşılamada "Talep oluşturun" kutusu');

  // 1) bulunamayan kitap → Talep oluştur, ad/telefon boş
  await k.fill('#sorgu', 'Suç ve Ceza'); await k.press('#sorgu', 'Enter');
  const dugme = await k.textContent('[data-talep-kitap]');
  bekle(dugme.trim() === 'Talep oluştur', 'bulunamadı ekranında düğme "Talep oluştur"');
  bekle(!/haber/i.test(await k.textContent('#sonuc')), 'sonuçta "haber ver" ifadesi yok');
  await k.click('[data-talep-kitap]');
  bekle(await k.inputValue('#t-kitap') === 'Suç ve Ceza', 'form kitap adıyla açılır');
  bekle(!(await k.$('#t-onay')) && !/KVKK|Aydınlatma/i.test(await k.textContent('.talep-perde')), 'KVKK onayı ve aydınlatma metni yok');
  await k.screenshot({ path: OUT + '/talep-form.png' });
  await k.click('#klavye-onay'); await k.waitForTimeout(200);
  const basari = (await k.textContent('.talep-perde')).replace(/\s+/g, ' ');
  bekle(/Talebiniz oluşturuldu/.test(basari) && !/haber/i.test(basari), 'ad ve telefon boşken talep oluşur, "haber vereceğiz" denmez');
  await k.click('#t-tamam');

  // 2) aynı kitap ikinci kez (karşılama kutusundan, telefonla) + hatalı telefon
  await k.click('#ana-sayfa'); await k.click('#secim-talep');
  bekle((await k.inputValue('#t-kitap')) === '', 'karşılamadan boş form');
  await k.click('.talep-perde button[type=submit]');
  bekle(/kitab/i.test(await k.textContent('#t-mesaj')), 'kitap adı boşsa uyarı');
  await k.fill('#t-kitap', 'suç ve ceza'); await k.fill('#t-tel', '12');
  await k.click('.talep-perde button[type=submit]');
  bekle(/Telefon/.test(await k.textContent('#t-mesaj')), 'hatalı telefon uyarısı');
  await k.fill('#t-ad', 'Can'); await k.fill('#t-tel', '0532 123 45 67');
  await k.click('.talep-perde button[type=submit]'); await k.waitForTimeout(100); await k.click('#t-tamam');

  // 3) okul listesi eksikleri → her kitap ayrı talep
  await k.click('#ana-sayfa'); await k.click('#okul-gezin [data-okul-ad]'); await k.click('[data-liste="l1"]');
  bekle(/talep oluştur/.test(await k.textContent('[data-talep-liste]')), 'okul listesinde "Eksik N kitap için talep oluştur"');
  await k.click('[data-talep-liste]');
  const liste = await k.$$eval('.talep-kitaplar li', (x) => x.map((y) => y.textContent));
  bekle(liste.length === 2, 'formda 2 eksik kitap listelenir: ' + liste.join(', '));
  await k.click('.talep-perde button[type=submit]'); await k.waitForTimeout(150); await k.click('#t-tamam');
  const kayit = await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:talepler')));
  bekle(kayit.length === 4, '4 talep kaydı (2 + 2)');

  // 4) panel: Suç ve Ceza tek satır, 3 talep
  const p = await ctx.newPage(); p.on('pageerror', (e) => h.push('panel: ' + e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(400);
  bekle(await p.textContent('#talep-sayac') === '2', 'menü sayacı: 2 farklı kitap');
  await p.click('#sek-talepler'); await p.waitForTimeout(200);
  const satirlar = await p.$$eval('#talep-satirlar tr', (x) => x.map((y) => y.textContent.replace(/\s+/g, ' ').trim()));
  console.log('  satırlar:', satirlar);
  const sayilar = await p.$$eval('#talep-satirlar .talep-adet', (x) => x.map((y) => y.textContent));
  bekle(satirlar.length === 2 && /^Suç ve Ceza/.test(satirlar[0]) && /^Sefiller/.test(satirlar[1]) && sayilar.join() === '3,1', 'Suç ve Ceza tek satırda 3 talep, en üstte (sayılar: ' + sayilar + ')');
  bekle(/Can · 0532 123 45 67/.test(satirlar[0]), 'bırakılan ad/telefon görünür');
  bekle(!(await p.$('#talep-satirlar select')) && !(await p.$('#talep-filtre')), 'durum (Yeni/Arandı/Geldi) seçimi yok');
  await p.screenshot({ path: OUT + '/talep-panel.png' });
  await p.click('[data-talep-kapat="0"]'); await p.click('.pencere button[type=submit]'); await p.waitForTimeout(200);
  bekle((await p.$$('#talep-satirlar tr')).length === 1 && await p.textContent('#talep-sayac') === '1', 'Kapat: satır ve 3 talep silinir');
  const c = await ctx.newPage(); await c.goto(K + 'yonetim.html?yerel=1&rol=revizeci'); await c.waitForTimeout(300);
  bekle(!(await c.isVisible('#sek-talepler')), 'revize veren talepleri görmez');
  bekle(!h.length, 'sayfa hatası yok ' + JSON.stringify(h));
  await b.close();
  console.log(tamam ? 'TALEP E2E: TAMAM' : 'TALEP E2E: BAŞARISIZ');
  process.exit(tamam ? 0 : 1);
})();
