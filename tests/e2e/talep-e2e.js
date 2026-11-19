const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const k = await ctx.newPage();
  const h = []; k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.evaluate(tohum);
  await k.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1'));
    v.okulListeleri = [{ id: 'l1', okul: 'Örnek Ortaokulu', sinif: '7-A', kalemler: [{ metin: '7. Sınıf Matematik Soru Bankası', kitapId: 'k1' }, { metin: '7. Sınıf İngilizce Workbook', kitapId: 'k4' }, { metin: 'Sefiller', kitapId: null }] }];
    localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify(v));
    localStorage.removeItem('kitabim-hangi-rafta:talepler');
  });
  await k.goto(K + 'index.html?yerel=1&kiosk=1'); await k.waitForTimeout(300);
  // 1) bulunamadı + öneri
  await k.fill('#sorgu', 'kurk mantolu madona'); await k.press('#sorgu', 'Enter');
  console.log('öneri:', await k.textContent('#sonuc .k-liste-baslik').catch(() => 'YOK'), '→', await k.textContent('#sonuc .k-izgara .k-ad').catch(() => ''));
  await k.fill('#sorgu', 'Suç ve Ceza'); await k.press('#sorgu', 'Enter');
  await k.click('[data-talep-kitap]');
  console.log('form kitap:', await k.inputValue('#t-kitap'), '| klavye açık (ad odakta):', await k.isVisible('.klavye'));
  console.log('klavye onay tuşu:', await k.textContent('#klavye-onay'));
  await k.click('#klavye-onay');
  console.log('boş gönderim:', await k.textContent('#t-mesaj'));
  await k.fill('#t-ad', 'Ayşe'); await k.fill('#t-tel', '0532 123 45 67');
  await k.click('.talep-perde button[type=submit]');
  console.log('onaysız:', await k.textContent('#t-mesaj'));
  await k.click('#t-metin');
  const ust = k.locator('.kamera-perde').last();
  console.log('aydınlatma metni:', (await ust.locator('p').textContent()).slice(0, 70));
  await ust.locator('button[type=submit]').click();
  await k.check('#t-onay');
  await k.screenshot({ path: OUT + '/talep-form.png' });
  await k.click('.talep-perde button[type=submit]');
  await k.waitForTimeout(200);
  console.log('başarı:', (await k.textContent('.talep-perde')).replace(/\s+/g, ' ').slice(0, 110));
  await k.click('#t-tamam');
  // 1b) karşılama ekranındaki "Kitap talebi bırakın" kutusu: boş formla açılır
  await k.click('#ana-sayfa'); await k.click('#secim-talep');
  console.log('karşılamadan talep:', await k.textContent('#talep-baslik'), '| kitap boş:', (await k.inputValue('#t-kitap')) === '');
  await k.fill('#t-kitap', 'Küçük Prens'); await k.fill('#t-ad', 'Can'); await k.fill('#t-tel', '05321234567'); await k.check('#t-onay');
  await k.click('.talep-perde button[type=submit]'); await k.waitForTimeout(100); await k.click('#t-tamam');
  // 2) stok takibi yok: kitap sayfasında "gelince haber ver" düğmesi çıkmaz
  await k.fill('#sorgu', 'ingilizce workbook'); await k.press('#sorgu', 'Enter');
  console.log('kitap sayfasında talep düğmesi:', await k.$('.k-detay [data-talep-kitap]') ? 'VAR (hata)' : 'yok');
  // 3) okul listesi eksikleri
  await k.click('#ana-sayfa'); await k.click('#okul-gezin [data-okul-ad]'); await k.click('[data-liste="l1"]');
  await k.click('[data-talep-liste]');
  console.log('liste talebi kitap:', await k.inputValue('#t-kitap'));
  await k.fill('#t-ad', 'Zeynep'); await k.fill('#t-tel', '+90 544 000 11 22'); await k.check('#t-onay');
  await k.click('.talep-perde button[type=submit]'); await k.waitForTimeout(100); await k.click('#t-tamam');
  // panel
  const p = await ctx.newPage(); p.on('pageerror', (e) => h.push('panel: ' + e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(400);
  console.log('menü sayacı (3 olmalı):', await p.textContent('#talep-sayac'));
  await p.click('#sek-talepler'); await p.waitForTimeout(200);
  console.log('talep satırı:', await p.$$eval('#talep-satirlar tr', (x) => x.length));
  await p.screenshot({ path: OUT + '/talep-panel.png' });
  await p.selectOption('#talep-satirlar select >> nth=0', 'geldi'); await p.waitForTimeout(200);
  console.log('açık talep (geldi sonrası):', await p.$$eval('#talep-satirlar tr', (x) => x.length), '| sayaç:', await p.textContent('#talep-sayac'));
  await p.click('#talep-temizle'); await p.click('.pencere button[type=submit]'); await p.waitForTimeout(200);
  console.log('temizle:', await p.textContent('#genel-mesaj'));
  // çalışan görür, revize veren görmez
  const c = await ctx.newPage(); await c.goto(K + 'yonetim.html?yerel=1&rol=revizeci'); await c.waitForTimeout(300);
  console.log('revize veren talepleri görüyor mu:', await c.isVisible('#sek-talepler'));
  console.log('hatalar:', h);
  await b.close();
})();
