// Kitap bilgisi sunucusu (kitap-bilgi fonksiyonu) ile kitap ekleme.
// Bulut olmadan denenebilsin diye deneme modunda Veri.kitapBilgi sahte bir fonksiyonla doldurulur.
// 1) Barkod Google Kitaplar'da yok, sunucu Google aramasıyla buluyor: form dolar, "kontrol edin" uyarısı çıkar.
// 2) Barkod hiçbir yerde yok: "Kapaktan doldur" önerilir; kapak fotoğrafı çekilince bilgiler ve kapak resmi gelir.
// 3) Sunucu kurulmamışsa (deneme modu) düğme görünmez.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || require('os').tmpdir();
const FOTO = path.join(__dirname, '../veri/kitap-arka.jpg');

(async () => {
  const b = await chromium.launch();
  const hatalar = [];
  let tamam = true;
  const bekle = (kosul, ad) => { if (!kosul) { tamam = false; console.log('  BAŞARISIZ:', ad); } };

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__istekler = [];
    let V;
    Object.defineProperty(window, 'Veri', {
      configurable: true,
      get() { return V; },
      set(v) {
        V = v;
        v.kitapBilgi = (g) => {
          window.__istekler.push({ islem: g.islem, isbn: g.isbn, resimBoyu: g.resim ? g.resim.length : 0 });
          if (g.islem === 'isbn' && g.isbn === '9786259506586') {
            return Promise.resolve({ bilgi: { ad: 'Kınalı Serçe', yazar: 'Şermin Yaşar, İlber Ortaylı', yayinevi: 'Kronik Kitap', kapak: '', kaynak: 'google-arama' } });
          }
          if (g.islem === 'isbn') return Promise.resolve({ bilgi: null });
          return new Promise((t) => setTimeout(() => t({ bilgi: { ad: 'Kumkurdu', yazar: 'Asa Lind', yayinevi: '', kapak: 'https://depo.ornek/kapaklar/k.jpg', kaynak: 'kapak' }, kapak: 'https://depo.ornek/kapaklar/k.jpg' }), 300));
        };
      },
    });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => hatalar.push(e.message));
  await p.route('https://www.googleapis.com/**', (r) => r.abort());
  await p.route('https://openlibrary.org/**', (r) => r.abort());
  await p.goto('http://localhost:8765/yonetim.html?yerel=1');
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto('http://localhost:8765/yonetim.html?yerel=1');
  await p.click('#sek-raflar');
  await p.fill('#raf-etiket', 'Çocuk'); await p.click('#raf-ekle-dugme');
  await p.click('.ust-cubuk [data-is=kitap-yeni]');
  bekle(await p.isVisible('#f-kapak-dugme'), 'Kapaktan doldur düğmesi görünmeli');

  // 1) Google araması
  await p.fill('#f-barkod', '9786259506586'); await p.press('#f-barkod', 'Enter');
  await p.waitForFunction(() => document.getElementById('f-ad').value);
  const f1 = await p.evaluate(() => [document.getElementById('f-ad').value, document.getElementById('f-yazar').value, document.getElementById('f-yayinevi').value]);
  const m1 = await p.textContent('#form-mesaj');
  console.log('arama ile:', f1.join(' | '), '—', m1.trim());
  bekle(f1[0] === 'Kınalı Serçe' && f1[2] === 'Kronik Kitap', 'arama sonucu forma dolmalı');
  bekle(/arama yapılarak bulundu/.test(m1), 'arama uyarısı çıkmalı');

  // 2) Hiçbir yerde yok → kapaktan doldur
  await p.click('#cekmece-kapat'); await p.click('.ust-cubuk [data-is=kitap-yeni]');
  await p.fill('#f-barkod', '9789944886666'); await p.press('#f-barkod', 'Enter');
  await p.waitForFunction(() => /bulunamadı/.test(document.getElementById('form-mesaj').textContent));
  const m2 = await p.textContent('#form-mesaj');
  console.log('bulunamayınca:', m2.trim());
  bekle(/Kapaktan doldur/.test(m2), 'kapaktan doldur önerilmeli');
  await p.setInputFiles('#f-kapak-foto', FOTO);
  await p.waitForFunction(() => /okunuyor/.test(document.getElementById('form-mesaj').textContent));
  bekle(await p.evaluate(() => document.getElementById('f-kapak-dugme').classList.contains('mesgul')), 'okurken düğme meşgul görünmeli');
  await p.waitForFunction(() => /kapaktan okundu/.test(document.getElementById('form-mesaj').textContent));
  const f2 = await p.evaluate(() => [document.getElementById('f-ad').value, document.getElementById('f-yazar').value, document.getElementById('f-kapak').value, document.getElementById('kapak-not').textContent]);
  console.log('kapaktan:', f2.join(' | '));
  bekle(f2[0] === 'Kumkurdu' && f2[1] === 'Asa Lind', 'kapaktan okunan bilgiler dolmalı');
  bekle(f2[2] === 'https://depo.ornek/kapaklar/k.jpg', 'kapak resmi forma girmeli');
  const ist = await p.evaluate(() => window.__istekler);
  const kapakIstegi = ist.find((x) => x.islem === 'kapak');
  console.log('sunucuya giden:', JSON.stringify(ist));
  bekle(kapakIstegi && kapakIstegi.isbn === '9789944886666' && kapakIstegi.resimBoyu > 10000 && kapakIstegi.resimBoyu < 1400000, 'kapak küçültülüp barkodla gönderilmeli');
  await p.screenshot({ path: OUT + '/kapak-form.png' });
  await p.selectOption('#f-bolme', { index: 0 });
  await p.click('#f-kaydet');
  const kayit = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).kitaplar.find((k) => k.barkod === '9789944886666'));
  console.log('kaydedilen:', kayit && kayit.ad, kayit && kayit.kapak);
  bekle(kayit && kayit.kapak === 'https://depo.ornek/kapaklar/k.jpg', 'kapak resmiyle kaydedilmeli');

  // 3) Sunucu yoksa düğme görünmez
  const p2 = await b.newPage();
  await p2.goto('http://localhost:8765/yonetim.html?yerel=1');
  await p2.click('.ust-cubuk [data-is=kitap-yeni]');
  const gorunur = await p2.isVisible('#f-kapak-dugme');
  console.log('sunucu yokken düğme:', gorunur);
  bekle(!gorunur, 'sunucu yokken düğme gizli olmalı');

  console.log(tamam && !hatalar.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', hatalar);
  await b.close();
  if (!tamam || hatalar.length) process.exit(1);
})();
