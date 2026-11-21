// Bölme kapalı (yerel mod): Ayarlar'dan kapat → raf eklerken bölme sorulmaz, şema/form/etiket/müşteri ekranı "N. Raf" gösterir,
// RAF:N etiketi müşteri ekranında rafı açar; tekrar açınca bölmeler geri gelir.
const { chromium } = require('playwright');
const path = require('path');
const K = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const hatalar = []; let tamam = true;
  const bekle = (k, ad) => { if (!k) { tamam = false; console.log('  BAŞARISIZ:', ad); } };
  p.on('pageerror', (e) => hatalar.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(K + 'yonetim.html?yerel=1');
  await p.evaluate(() => localStorage.clear());
  await p.goto(K + 'yonetim.html?yerel=1#ayarlar');
  await p.click('#sek-ayarlar');
  bekle(await p.isChecked('#ayar-bolme'), 'varsayılan: bölme açık');
  await p.click('#ayar-bolme');
  await p.waitForFunction(() => /kapatıldı/.test(document.body.innerText));

  await p.click('#sek-raflar');
  bekle(await p.isHidden('#alan-raf-bolme'), 'raf eklerken bölme sayısı sorulmamalı');
  await p.fill('#raf-etiket', 'Roman'); await p.click('#raf-ekle-dugme');
  await p.waitForFunction(() => /1\. Raf eklendi\./.test(document.body.innerText));
  await p.fill('#raf-etiket', 'Test kitapları'); await p.click('#raf-ekle-dugme');
  await p.waitForFunction(() => document.querySelectorAll('#yonetim-sema .raf').length === 2);
  const sema = (await p.textContent('#yonetim-sema')).replace(/\s+/g, ' ');
  console.log('şema:', sema);
  bekle(!/bölme|\d\.\d/.test(sema) && !(await p.$('[data-is="bolme-ekle"]')), 'şemada bölme yok');
  const veri = await p.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')));
  bekle(veri.raflar.every((r) => r.bolmeler.length === 1), 'her rafın tek (görünmez) bölmesi var');

  // Raf seç → bu rafa kitap ekle (formda bölme seçimi yok)
  await p.click('#yonetim-sema .raf:nth-child(2) [data-is="bolme-sec"]');
  bekle(/2\. Raf/.test(await p.textContent('#bolme-panel')) && !/Bölmeyi sil/.test(await p.textContent('#bolme-panel')), 'panel rafı gösterir, bölme silme yok');
  await p.click('[data-is="bolmeye-ekle"]');
  bekle(await p.isHidden('#alan-f-bolme'), 'kitap formunda bölme seçimi gizli');
  await p.fill('#f-ad', 'Simyacı'); await p.fill('#f-barkod', '9789750726439');
  await p.click('#f-kaydet');
  await p.waitForFunction(() => /kaydedildi → 2\. Raf/.test(document.getElementById('form-mesaj').textContent));
  console.log('form:', await p.textContent('#form-mesaj'));
  await p.click('#f-vazgec');

  // Etiketler: raf başına bir etiket, RAF:N
  await p.click('#sek-etiketler');
  const etiket = (await p.textContent('#etiket-sayfa')).replace(/\s+/g, ' ');
  console.log('etiketler:', etiket, '| adet:', await p.$$eval('#etiket-sayfa .etiket', (x) => x.length));
  bekle((await p.$$eval('#etiket-sayfa .etiket', (x) => x.length)) === 2 && /2\. Raf/.test(etiket), 'raf başına tek etiket');

  // Müşteri ekranı
  const k = await ctx.newPage(); k.on('pageerror', (e) => hatalar.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?yerel=1'); await k.waitForTimeout(600);
  await k.fill('#sorgu', 'simyacı'); await k.press('#sorgu', 'Enter');
  await k.waitForSelector('.k-yer strong');
  console.log('müşteri:', await k.textContent('.k-yer strong'), '|', await k.textContent('.k-liste-baslik').catch(() => '-'));
  bekle((await k.textContent('.k-yer strong')).trim() === '2. Raf', 'müşteri ekranı yalnız "2. Raf"');
  await k.click('[data-is="ana"]');
  await k.fill('#sorgu', 'RAF:2'); await k.press('#sorgu', 'Enter');
  await k.waitForTimeout(400);
  const rafSayfa = (await k.textContent('#sonuc')).replace(/\s+/g, ' ');
  console.log('RAF:2 →', rafSayfa.slice(0, 120));
  bekle(/2\. Raf · Test kitapları/.test(rafSayfa) && /Simyacı/.test(rafSayfa) && !/Bölme/.test(rafSayfa), 'RAF:2 rafı açar');
  await k.screenshot({ path: path.join(process.argv[2] || require('os').tmpdir(), 'bolmesiz-kiosk.png') });

  // Yeniden aç: bölmeler geri gelir
  await p.click('#sek-ayarlar'); await p.click('#ayar-bolme');
  await p.click('#sek-raflar');
  bekle(!(await p.isHidden('#alan-raf-bolme')) && /2\.1/.test(await p.textContent('#yonetim-sema')), 'açınca bölmeler görünür');

  console.log(tamam && !hatalar.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', hatalar);
  await b.close();
  if (!tamam || hatalar.length) process.exit(1);
})();
