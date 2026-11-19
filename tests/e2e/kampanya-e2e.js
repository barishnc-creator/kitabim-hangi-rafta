// Kampanya / reklam alanı (deneme modu):
// panelde fotoğraf + başlık + açıklama girilir, kaydedilir; müşteri ekranının karşılamasında görünür ve sırayla döner.
const { chromium } = require('playwright');
const path = require('path');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';

// Test için kampanya görseli: tarayıcıda çizilip JPEG olarak kaydedilir.
async function gorselUret(b, dosya, renk1, renk2, yazi) {
  const p = await b.newPage({ viewport: { width: 1600, height: 560 } });
  await p.setContent('<body style="margin:0"><div style="width:1600px;height:560px;background:linear-gradient(120deg,' + renk1 + ',' + renk2 + ');display:flex;align-items:center;justify-content:flex-end;padding-right:120px;box-sizing:border-box;font:700 160px sans-serif;color:rgba(255,255,255,.25)">' + yazi + '</div></body>');
  await p.screenshot({ path: dosya, type: 'jpeg', quality: 85 });
  await p.close();
}

(async () => {
  const b = await chromium.launch();
  const h = []; let tamam = true;
  const bekle = (kosul, ad) => { console.log((kosul ? '  tamam: ' : '  BAŞARISIZ: ') + ad); if (!kosul) tamam = false; };
  const g1 = path.join(OUT, 'kampanya-1.jpg'), g2 = path.join(OUT, 'kampanya-2.jpg');
  await gorselUret(b, g1, '#F97316', '#DC2626', '%20');
  await gorselUret(b, g2, '#0EA5E9', '#4F46E5', 'LGS');

  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => h.push('panel: ' + e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.evaluate(tohum);
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(300);
  await p.click('#sek-kampanyalar');
  bekle(await p.isVisible('#kampanyalar'), 'Kampanyalar sekmesi açılır');
  bekle(/Henüz kampanya yok/.test(await p.textContent('#kampanya-liste')), 'boş durum yazısı');

  await p.click('#kampanya-ekle');
  await p.fill('#kb-0', 'Okula dönüşte %20 indirim');
  await p.fill('#ka-0', 'Tüm test kitaplarında 30 Kasım’a kadar, kasada geçerli.');
  await p.setInputFiles('.kampanya-satir[data-i="0"] input[type=file]', g1);
  await p.waitForSelector('.kampanya-satir[data-i="0"] img');
  await p.click('#kampanya-ekle');
  await p.fill('#kb-1', 'LGS deneme setleri geldi');
  await p.setInputFiles('.kampanya-satir[data-i="1"] input[type=file]', g2);
  await p.waitForSelector('.kampanya-satir[data-i="1"] img');
  await p.click('#kampanya-ekle');
  await p.click('#kampanya-kaydet');
  bekle(/fotoğraf ya da başlık/.test(await p.textContent('#kampanya-durum')), 'boş kampanya kaydedilmez, uyarı verir');
  await p.click('.kampanya-satir[data-i="2"] [data-is="sil"]');
  await p.click('.kampanya-satir[data-i="1"] [data-is="yukari"]');
  bekle(await p.inputValue('#kb-0') === 'LGS deneme setleri geldi', 'sıralama: yukarı taşı');
  await p.click('.kampanya-satir[data-i="1"] [data-is="yukari"]');
  await p.screenshot({ path: OUT + '/kampanya-panel.png' });
  await p.click('#kampanya-kaydet'); await p.waitForTimeout(300);
  const kayit = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).ayarlar.kampanyalar);
  bekle(kayit.length === 2 && kayit[0].baslik === 'Okula dönüşte %20 indirim' && /^data:image\/jpeg;base64,/.test(kayit[0].resim) && kayit[0].resim.length <= 380000,
    'kaydedildi: 2 kampanya, JPEG ≤ 380 KB (' + (kayit[0] && kayit[0].resim.length) + ')');

  const k = await ctx.newPage(); k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1&kiosk=1'); await k.waitForTimeout(600);
  bekle(await k.isVisible('#kampanya-kutu'), 'müşteri ekranında kampanya alanı görünür');
  const etkin = () => k.textContent('.k-kampanya-kart.etkin h2');
  bekle(await etkin() === 'Okula dönüşte %20 indirim', 'ilk kampanya gösterilir');
  bekle((await k.$$('[data-kampanya]')).length === 2, '2 nokta (geçiş düğmesi)');
  await k.screenshot({ path: OUT + '/kampanya-kiosk.png' });
  await k.waitForTimeout(7600);
  bekle(await etkin() === 'LGS deneme setleri geldi', '7 sn sonra kendiliğinden ikinciye geçer');
  await k.click('[data-kampanya="0"]'); await k.waitForTimeout(100);
  bekle(await etkin() === 'Okula dönüşte %20 indirim', 'noktaya dokununca seçilen kampanya');

  // çalışan ve revize veren Kampanyalar sekmesini görmez
  const c = await ctx.newPage(); await c.goto(K + 'yonetim.html?yerel=1&rol=calisan'); await c.waitForTimeout(300);
  bekle(!(await c.isVisible('#sek-kampanyalar')), 'çalışan kampanya sekmesini görmez');
  // kampanya yoksa alan gizli
  await p.click('.kampanya-satir[data-i="0"] [data-is="sil"]'); await p.click('.kampanya-satir[data-i="0"] [data-is="sil"]');
  await p.click('#kampanya-kaydet'); await p.waitForTimeout(200);
  await k.reload(); await k.waitForTimeout(400);
  bekle(!(await k.isVisible('#kampanya-kutu')), 'kampanya yoksa alan görünmez');
  bekle(!h.length, 'sayfa hatası yok ' + JSON.stringify(h));
  await b.close();
  console.log(tamam ? 'KAMPANYA E2E: TAMAM' : 'KAMPANYA E2E: BAŞARISIZ');
  process.exit(tamam ? 0 : 1);
})();
