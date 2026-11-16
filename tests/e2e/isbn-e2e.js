const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  // Google Kitaplar yanıtını taklit et (test ortamı Google'a erişemiyor)
  await p.route('https://www.googleapis.com/**', (r) => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ totalItems: 1, items: [{ volumeInfo: { title: 'Kürk Mantolu Madonna', authors: ['Sabahattin Ali'], publisher: 'Yapı Kredi Yayınları', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&printsec=frontcover' } } }] }) }));
  await p.route('https://openlibrary.org/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await p.goto('http://localhost:8765/yonetim.html?yerel=1#kitaplar');
  await p.click('#sek-raflar');
  await p.fill('#raf-etiket', 'Roman'); await p.click('#raf-ekle-dugme');
  await p.click('.ust-cubuk [data-is=kitap-yeni]');
  await p.fill('#f-barkod', '9780306406157');
  await p.press('#f-barkod', 'Enter');
  await p.waitForTimeout(500);
  console.log('ad:', await p.inputValue('#f-ad'), '| yazar:', await p.inputValue('#f-yazar'), '| yayınevi:', await p.inputValue('#f-yayinevi'));
  console.log('mesaj:', await p.textContent('#form-mesaj'));
  console.log('odak:', await p.evaluate(() => document.activeElement.id), '| kapak:', await p.inputValue('#f-kapak'));
  await p.screenshot({ path: OUT + '/isbn.png' });
  await p.click('#f-kaydet');
  console.log('kayıt:', await p.textContent('#form-mesaj'));
  // ürün barkodu (ISBN değil): internete gitmemeli, ada odaklanmalı
  let istek = 0;
  p.on('request', (r) => { if (r.url().includes('googleapis')) istek++; });
  await p.fill('#f-barkod', '8690000000001');
  await p.press('#f-barkod', 'Enter');
  await p.waitForTimeout(300);
  console.log('ISBN değil -> istek:', istek, 'odak:', await p.evaluate(() => document.activeElement.id));
  // bulunamayan kitap
  await p.unroute('https://www.googleapis.com/**');
  await p.route('https://www.googleapis.com/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"totalItems":0}' }));
  await p.click('#f-vazgec'); await p.click('.ust-cubuk [data-is=kitap-yeni]');
  await p.fill('#f-barkod', '080442957X');
  await p.press('#f-barkod', 'Enter');
  await p.waitForTimeout(500);
  console.log('bulunamadı:', await p.textContent('#form-mesaj'));
  // kamera penceresi: fotoğraf düğmesi var mı
  await p.click('#f-tara');
  console.log('foto düğmesi:', await p.isVisible('label[for=kamera-foto]'), '| durum:', await p.textContent('#kamera-durum'));
  console.log('hatalar:', hatalar);
  await b.close();
})();
