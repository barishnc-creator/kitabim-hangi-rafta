// Excel ile ürün girişi ve rafa yerleştirme (deneme modu).
// 1) .xls (mağaza programı biçimi: BARCODE, MALINCINSI, KOD3, MIKTAR) yüklenir: kayıtlı kitap atlanır, yeniler rafsız eklenir;
//    aynı dosya ikinci kez yüklenince hiçbir şey eklenmez.
// 2) Müşteri ekranında rafsız kitap "henüz rafına yerleştirilmedi" der.
// 3) Rafa yerleştir: bölme seçilip barkod okutulunca kitap o bölmeye geçer.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || require('os').tmpdir();
const XLS = path.join(__dirname, '../veri/libreoffice-ornek.xls');
const K = 'http://localhost:8765/';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const hatalar = [];
  let tamam = true;
  const bekle = (kosul, ad) => { if (!kosul) { tamam = false; console.log('  BAŞARISIZ:', ad); } };
  p.on('pageerror', (e) => hatalar.push(e.message));

  await p.goto(K + 'yonetim.html?yerel=1');
  await p.evaluate(() => localStorage.clear());
  await p.goto(K + 'yonetim.html?yerel=1');
  await p.click('#sek-raflar');
  await p.fill('#raf-etiket', 'Roman'); await p.click('#raf-ekle-dugme');
  // Kayıtlı bir kitap
  await p.click('.ust-cubuk [data-is=kitap-yeni]');
  await p.fill('#f-barkod', '9789750701689'); await p.fill('#f-ad', 'Vanilya Kokulu Mektuplar');
  bekle(!(await p.$('#f-stok')), 'kitap formunda stok alanı olmamalı');
  await p.click('#f-kaydet'); await p.waitForTimeout(200); await p.click('#cekmece-kapat');

  // Kitaplar sekmesindeki düğme ürün girişine götürür
  await p.click('#sek-kitaplar');
  await p.click('#kitaplar [data-sekme-git=urun-girisi]');
  bekle(await p.isVisible('#urun-girisi'), 'Excel düğmesi Ürün girişi sekmesini açmalı');

  await p.setInputFiles('#giris-dosya', XLS);
  await p.waitForSelector('#giris-onizleme:not([hidden])');
  const ozet = (await p.textContent('#giris-ozet')).replace(/\s+/g, ' ');
  console.log('özet:', ozet);
  bekle(/2 Yeni kitap/.test(ozet) && /1 Zaten kayıtlı/.test(ozet), 'özet: 2 yeni, 1 kayıtlı');
  bekle(!/eklenemeyecek|adet|Stok/i.test(ozet), 'özette adet/stok olmamalı');
  bekle(!(await p.$('#giris-s-adet')), 'sütun seçiminde adet olmamalı');
  const satirlar = await p.$$eval('#giris-satirlar tr', (t) => t.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('önizleme:', satirlar);
  bekle(!satirlar.some((s) => /Vanilya/.test(s)), 'kayıtlı kitap önizlemede olmamalı');
  bekle(satirlar.some((s) => /Yeni.*Rafsız.*Ahmet Haşim \/ Bize Göre.*Kültür Kitabı/.test(s)), 'yeni kitap normal yazımla, rafsız');
  await p.screenshot({ path: OUT + '/giris-onizleme.png', fullPage: true });

  await p.click('#giris-kaydet');
  await p.waitForFunction(() => /kaydedildi/.test(document.getElementById('giris-durum').textContent));
  console.log('kayıt:', await p.textContent('#giris-durum'));
  const veri = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).kitaplar.map((k) => [k.ad, k.barkod, k.stok, k.bolmeId]));
  console.log('kitaplar:', JSON.stringify(veri));
  bekle(veri.length === 3 && veri.every((k) => k[2] === undefined), '3 kitap, hiçbirinde stok yok');
  bekle(veri.filter((k) => !k[3]).length === 2, '2 rafsız kitap');
  const rafsizListe = await p.$$eval('#yer-rafsiz li', (t) => t.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('rafsız liste:', rafsizListe);
  bekle(await p.textContent('#rafsiz-sayac') === '2', 'menüde rafsız sayacı 2');
  // Aynı tüm-ürün listesi tekrar yüklenir: eklenecek yok
  await p.setInputFiles('#giris-dosya', XLS);
  await p.waitForSelector('#giris-onizleme:not([hidden])');
  const ozet2 = (await p.textContent('#giris-ozet')).replace(/\s+/g, ' ');
  console.log('ikinci yükleme özeti:', ozet2);
  bekle(/0 Yeni kitap/.test(ozet2) && /3 Zaten kayıtlı/.test(ozet2), 'ikinci yüklemede 0 yeni, 3 kayıtlı');
  bekle(await p.isDisabled('#giris-kaydet'), 'eklenecek yokken kaydet kapalı');
  await p.click('#giris-vazgec');

  // Müşteri ekranı
  const k = await ctx.newPage(); // aynı tarayıcı oturumu: deneme modunun verisi ortak
  await k.goto(K + 'index.html?yerel=1');
  await k.fill('#sorgu', 'bize göre'); await k.press('#sorgu', 'Enter'); await k.waitForTimeout(400);
  const kiosk = await k.textContent('body');
  bekle(/henüz rafına yerleştirilmedi/.test(kiosk), 'müşteri ekranı rafsız kitabı söylemeli');
  await k.screenshot({ path: OUT + '/giris-kiosk.png' });

  // Rafa yerleştir: bölme seç, barkod okut
  await p.fill('#yer-barkod', '9786051000145'); await p.press('#yer-barkod', 'Enter');
  bekle(/Önce kitabın konulacağı bölmeyi seçin/.test(await p.textContent('#yer-durum')), 'bölme seçilmeden uyarı');
  await p.selectOption('#yer-bolme', { label: '1.2' });
  await p.fill('#yer-barkod', '9786051000145'); await p.press('#yer-barkod', 'Enter');
  await p.waitForFunction(() => /Bölme 1\.2/.test(document.getElementById('yer-durum').textContent));
  console.log('yerleştir:', await p.textContent('#yer-durum'));
  const sonra = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).kitaplar.filter((x) => !x.bolmeId).length);
  bekle(sonra === 1, '1 rafsız kitap kalmalı');
  bekle(await p.textContent('#rafsiz-sayac') === '1', 'rafsız sayacı 1'); 
  bekle(/Ahmet Haşim/.test(await p.textContent('#yer-son')), 'son yerleştirilenler listesi');
  // Kayıtsız barkod
  await p.fill('#yer-barkod', '9780000000002'); await p.press('#yer-barkod', 'Enter');
  bekle(/kayıtlı değil/.test(await p.textContent('#yer-durum')), 'kayıtsız barkod uyarısı');
  await p.screenshot({ path: OUT + '/giris-yerlestir.png', fullPage: true });

  // Genel bakış uyarısı: rafsız kitap varken görünür
  await p.click('#sek-genel');
  bekle(await p.isVisible('#pano-rafsiz'), 'rafsız varken genel bakış uyarısı görünür');
  // Ayarlarda stok anahtarı, kitap listesinde stok sütunu yok
  bekle(!(await p.$('#ayar-stok')), 'ayarlarda stok anahtarı olmamalı');
  await p.click('#sek-kitaplar');
  bekle(!/Stok/.test(await p.textContent('#kitaplar thead')), 'kitap listesinde stok sütunu olmamalı');

  console.log(tamam && !hatalar.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', hatalar);
  await b.close();
  if (!tamam || hatalar.length) process.exit(1);
})();
