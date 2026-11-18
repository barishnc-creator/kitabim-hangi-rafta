const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const h = []; p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'yonetim.html?yerel=1'); await p.evaluate(tohum);
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(300);
  await p.click('#sek-harita');
  console.log('bekleyen raf:', await p.$$eval('[data-yerlestir]', (x) => x.length));
  for (let i = 0; i < 4; i++) await p.click('[data-yerlestir] >> nth=0');
  // sürükle: 3. rafı sağ üste, 4. rafı en sağa
  const plan = await p.locator('#harita-plan').boundingBox();
  async function tasi(sel, xYuzde, yYuzde) {
    const kutu = await p.locator(sel).boundingBox();
    await p.mouse.move(kutu.x + 10, kutu.y + 10); await p.mouse.down();
    await p.mouse.move(plan.x + plan.width * xYuzde / 100 + 10, plan.y + plan.height * yYuzde / 100 + 10, { steps: 6 }); await p.mouse.up();
  }
  await tasi('[data-tur=raf] >> nth=0', 6, 8);
  await tasi('[data-tur=raf] >> nth=1', 6, 40);
  await tasi('[data-tur=raf] >> nth=2', 62, 8);
  await tasi('[data-tur=raf] >> nth=3', 84, 8);
  // 3. rafı döndür ve tarif yaz
  await p.click('[data-tur=raf] >> nth=2');
  await p.click('[data-harita-dondur]');
  await p.fill('#hz-tarif', 'Girişten sağa, kasanın arkası');
  // 4. raf boyutu: tutamaçla uzat
  await p.click('[data-tur=raf] >> nth=3');
  const t = await p.locator('.tutamac').boundingBox();
  await p.mouse.move(t.x + 8, t.y + 8); await p.mouse.down(); await p.mouse.move(t.x - 60, t.y + 120, { steps: 5 }); await p.mouse.up();
  // klavye ile taşı
  await p.focus('#harita-plan'); await p.keyboard.press('Shift+ArrowLeft');
  await p.click('[data-harita-ekle=kasa]');
  await p.click('[data-harita-ekle=giris]');
  await p.click('[data-harita-ekle=kiosk]');
  console.log('durum:', await p.textContent('#harita-durum'));
  await p.screenshot({ path: OUT + '/harita-panel.png' });
  await p.click('#harita-kaydet'); await p.waitForTimeout(200);
  console.log('kayıt:', await p.textContent('#genel-mesaj'), '| uyarı kalktı:', !(await p.textContent('#harita-durum')));
  const kayitli = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')).ayarlar.plan);
  console.log('kaydedilen: raf', Object.keys(kayitli.raflar).length, '| nesne', kayitli.nesneler.length, '| kiosk', JSON.stringify(kayitli.kiosk), '| 3. raf', JSON.stringify(kayitli.raflar.r3));
  // müşteri ekranı
  const k = await ctx.newPage(); k.on('pageerror', (e) => h.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.waitForTimeout(300);
  await k.fill('#sorgu', 'kürk'); await k.press('#sorgu', 'Enter'); await k.waitForTimeout(300);
  console.log('başlık:', await k.textContent('.k-sonuc .kart .k-bolum-baslik h2 >> nth=0').catch(() => '?'),
    '| hedef raf:', await k.textContent('.plan .raf-blok.hedef'), '| yol:', await k.isVisible('.plan svg.yol polyline'),
    '| tarif:', await k.textContent('.k-yer p >> nth=1'));
  await k.waitForTimeout(3600);
  await k.screenshot({ path: OUT + '/harita-kiosk.png' });
  // haritada olmayan raf → şema
  await p.click('[data-tur=raf] >> nth=0'); await p.click('[data-harita-sil]'); await p.click('#harita-kaydet'); await p.waitForTimeout(200);
  await k.reload(); await k.waitForTimeout(300);
  await k.fill('#sorgu', 'türkçe soru'); await k.press('#sorgu', 'Enter'); await k.waitForTimeout(200);
  console.log('haritada olmayan raf → şema:', await k.isVisible('.sema'), '| harita yok:', !(await k.isVisible('.plan')));
  console.log('hatalar:', h);
  await b.close();
})();
