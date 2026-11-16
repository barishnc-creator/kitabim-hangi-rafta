const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2], K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const h = []; p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.evaluate(tohum);
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(300);
  await p.click('#sek-ayarlar');
  // örnek logo: tarayıcıda çizilmiş "ÖK" yazılı PNG
  const logo = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 400;
    const x = c.getContext('2d'); x.fillStyle = '#0F766E'; x.fillRect(0, 0, 400, 400);
    x.fillStyle = '#fff'; x.font = 'bold 170px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ÖK', 200, 210);
    return c.toDataURL('image/png').split(',')[1];
  });
  await p.setInputFiles('#logo-dosya', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(logo, 'base64') });
  await p.waitForTimeout(300);
  console.log('logo durumu:', await p.textContent('#logo-durum'));
  await p.click('[data-renk="#0F766E"]');
  await p.fill('#ayar-karsilama', 'Okul kitaplarınız burada!');
  await p.screenshot({ path: OUT + '/gorunum-panel.png', fullPage: true });
  await p.click('#gorunum-form button[type=submit]'); await p.waitForTimeout(300);
  console.log('kayıt:', await p.textContent('#genel-mesaj'));
  console.log('panel ana renk:', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mavi')), '| kenar logosu:', await p.isVisible('.yan .marka-ikon img'));
  // açık renk → otomatik koyulaştırma
  await p.$eval('#renk-ozel', (el) => { el.value = '#facc15'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  console.log('sarı uyarısı:', await p.textContent('#renk-not'));
  await p.click('[data-renk="#0F766E"]');
  // müşteri ekranı
  const k = await ctx.newPage(); k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.waitForTimeout(300);
  console.log('kiosk karşılama:', await k.textContent('#karsilama-yazi'), '| logo:', await k.isVisible('.k-marka-ikon img'),
    '| düğme rengi:', await k.$eval('.k-secim', (e) => getComputedStyle(e).backgroundColor));
  await k.screenshot({ path: OUT + '/gorunum-kiosk.png' });
  // kaldır
  await p.click('#logo-kaldir'); await p.click('#gorunum-form button[type=submit]'); await p.waitForTimeout(300);
  await k.waitForTimeout(300);
  console.log('logo kaldırılınca kiosk:', await k.isVisible('.k-marka-ikon img'), '| simge:', await k.isVisible('.k-marka-ikon svg'));
  const r = await ctx.newPage(); await r.goto(K + 'yonetim.html?yerel=1&rol=calisan'); await r.waitForTimeout(300); await r.click('#sek-ayarlar').catch(() => {});
  console.log('çalışan görünüm formunu görüyor mu:', await r.isVisible('#gorunum-form'));
  console.log('hatalar:', h);
  await b.close();
})();
