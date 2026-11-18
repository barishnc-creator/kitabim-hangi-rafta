// Kamerayla barkod okuma: canlı kamera (sahte kamera) açılır, fotoğraftan okuma gerçek bir kitap arkası fotoğrafıyla denenir.
// Fotoğrafta barkod küçük ve yanında bandrol var; okuyucu parçalara bölerek bulmalı. Yan çekilmiş hali de okunmalı.
const { chromium } = require('playwright');
const path = require('path');
const K = 'http://localhost:8765/';
const FOTO = path.join(__dirname, '../veri/kitap-arka.jpg');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  const p = await ctx.newPage();
  const h = []; p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'index.html?yerel=1'); await p.waitForTimeout(500);
  await p.click('#tara');
  await p.waitForFunction(() => /çerçeve/.test(document.querySelector('#kamera-durum').textContent), null, { timeout: 15000 });
  await p.waitForTimeout(1200); const boy = await p.evaluate(() => { const v = document.querySelector('#kamera-alani video'); return v ? v.videoWidth + 'x' + v.videoHeight : 'yok'; });
  console.log('canlı kamera açıldı, görüntü:', boy, '|', await p.textContent('#kamera-durum'));

  await p.setInputFiles('#kamera-foto', FOTO);
  await p.waitForFunction(() => !document.querySelector('.kamera-perde'), null, { timeout: 30000 });
  console.log('fotoğraftan okunan (müşteri ekranı arama kutusu):', await p.inputValue('#sorgu'));

  // Yan çekilmiş fotoğraf
  const yan = await p.evaluate(async () => {
    const r = await fetch('tests/veri/kitap-arka.jpg'); const img = await createImageBitmap(await r.blob());
    const c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
    const x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(img, 0, 0);
    const blob = await new Promise((t) => c.toBlob(t, 'image/jpeg', 0.85));
    try { return await Tarayici.fotoOku(new File([blob], 'yan.jpg', { type: 'image/jpeg' })); } catch (e) { return 'HATA ' + e.message; }
  });
  console.log('yan çekilmiş fotoğraf:', yan);
  const tamam = (await p.inputValue('#sorgu')).includes('9789944886666') && yan === '9789944886666';
  console.log(tamam ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', h);
  await b.close();
  if (!tamam || h.length) process.exit(1);
})();
