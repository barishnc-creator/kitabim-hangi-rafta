const { chromium, devices } = require('playwright');
const tohum = require('./tohum.js');
const OUT = (process.argv[2] || require('os').tmpdir()) + '/pdf-img', K = 'http://localhost:8765/';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
function zenginlestir() {
  const v = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1'));
  v.ayarlar.magazaAdi = 'Örnek Kırtasiye';
  v.kitaplar.forEach((k, i) => { if (!k.barkod) k.barkod = '97860500' + String(10000 + i * 37).slice(-5); });
  v.ayarlar.plan = { raflar: { r1: { x: 6, y: 8, w: 30, h: 13, tarif: 'Girişten sola, duvar boyunca' }, r2: { x: 6, y: 36, w: 30, h: 13, tarif: 'Girişten sola, ikinci sıra' }, r3: { x: 60, y: 8, w: 13, h: 42, tarif: 'Girişten sağa, kasanın arkası' }, r4: { x: 82, y: 8, w: 12, h: 42, tarif: 'En sağ köşe' } },
    nesneler: [{ id: 'k', tur: 'kasa', x: 56, y: 64, w: 22, h: 13 }, { id: 'g', tur: 'giris', x: 41, y: 92, w: 18, h: 8 }], kiosk: { x: 50, y: 86 } };
  v.okulListeleri = [
    { id: 'l1', okul: 'Örnek Ortaokulu', sinif: '7-A', kalemler: [{ metin: '7. Sınıf Matematik Soru Bankası', kitapId: 'k1' }, { metin: '7. Sınıf Fen Bilimleri Konu Anlatımı', kitapId: 'k2' }, { metin: '7. Sınıf Türkçe Soru Bankası', kitapId: 'k3' }, { metin: '7. Sınıf İngilizce Workbook', kitapId: 'k4' }, { metin: 'Kürk Mantolu Madonna - Sabahattin Ali', kitapId: 'k6' }, { metin: 'Küçük Prens', kitapId: 'k8' }, { metin: 'Sefiller (çocuk klasikleri)', kitapId: null }] },
    { id: 'l2', okul: 'Örnek Ortaokulu', sinif: '8-A', kalemler: [{ metin: '8. Sınıf LGS Deneme Seti', kitapId: 'k5' }, { metin: 'Simyacı', kitapId: 'k7' }] },
    { id: 'l3', okul: 'Örnek İlkokulu', sinif: '3-A', kalemler: [{ metin: 'Küçük Prens', kitapId: 'k8' }] }
  ];
  localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify(v));
  const g = (n, s) => new Date(Date.now() - n * 864e5 - (s || 0) * 6e4).toISOString();
  const a = []; [['LGS deneme', 1, 14], ['Kürk Mantolu Madonna', 1, 9], ['matematik', 3, 8], ['simyacı', 1, 5], ['Harry Potter', 0, 7], ['Suç ve Ceza', 0, 4], ['KPSS', 0, 3]].forEach(([s, n, t]) => { for (let i = 0; i < t; i++) a.push({ sorgu: s, sonuc: n, zaman: g(i % 20) }); });
  localStorage.setItem('kitabim-hangi-rafta:aramalar', JSON.stringify(a));
  localStorage.setItem('kitabim-hangi-rafta:talepler', JSON.stringify([
    { id: 't1', kitap: 'Suç ve Ceza', ad: 'Ayşe', telefon: '05321234567', not: '', durum: 'yeni', olusturuldu: g(0, 30), onay: true },
    { id: 't2', kitap: 'suç ve ceza', ad: '', telefon: '', not: '', durum: 'yeni', olusturuldu: g(1, 20), onay: true },
    { id: 't3', kitap: 'Suç ve Ceza', ad: 'Mert', telefon: '', not: '', durum: 'yeni', olusturuldu: g(2), onay: true },
    { id: 't4', kitap: 'Sefiller', ad: 'Mehmet', telefon: '05551234567', not: 'Örnek Ortaokulu · 7-A listesi', durum: 'yeni', olusturuldu: g(1), onay: true },
    { id: 't5', kitap: 'Sefiller', ad: '', telefon: '', not: '', durum: 'yeni', olusturuldu: g(3), onay: true },
    { id: 't6', kitap: 'Harry Potter ve Felsefe Taşı', ad: 'Zeynep', telefon: '05440001122', not: '', durum: 'yeni', olusturuldu: g(2), onay: true },
    { id: 't7', kitap: 'Küçük Kara Balık', ad: '', telefon: '', not: '', durum: 'yeni', olusturuldu: g(4), onay: true }]));
  localStorage.setItem('kitabim-hangi-rafta:revizeler', JSON.stringify([{ id: 'v1', yazan_ad: 'Mağaza müdürü', metin: 'Müşteri kartında kitabın sınıfı da yazsın.', durum: 'yeni', olusturuldu: g(1) }]));
  localStorage.setItem('kitabim-hangi-rafta:gecmis', JSON.stringify([
    { zaman: g(0, 5), kim_ad: 'Ayşe K. · Çalışan', islem: 'ekledi', konu: 'kitap', ayrinti: '“7. Sınıf Fen Bilimleri Konu Anlatımı” → 1.2' },
    { zaman: g(0, 40), kim_ad: 'Mehmet · Çalışan', islem: 'tasidi', konu: 'kitap', ayrinti: '“Simyacı” 3.1 → 3.2' },
    { zaman: g(0, 70), kim_ad: 'Mehmet · Çalışan', islem: 'guncelledi', konu: 'kitap', ayrinti: '“Türkçe Sözlük” (fiyat)' },
    { zaman: g(1, 10), kim_ad: 'Yönetici · Düzenleyici', islem: 'guncelledi', konu: 'ayar', ayrinti: 'mağaza haritası' },
    { zaman: g(1, 80), kim_ad: 'Yönetici · Düzenleyici', islem: 'ekledi', konu: 'liste', ayrinti: 'Örnek Ortaokulu · 7-A (7 kitap)' },
    { zaman: g(2, 15), kim_ad: 'Ayşe K. · Çalışan', islem: 'yukledi', konu: 'kitap', ayrinti: 'Excel\'den 120 kitap' },
    { zaman: g(2, 90), kim_ad: 'Yönetici · Düzenleyici', islem: 'ekledi', konu: 'raf', ayrinti: '4. Raf · Sözlük ve atlas (2 bölme)' }]));
}
// Örnek kampanya görseli (yalnız ekran görüntüleri için): sağda renkli kitap sırtları, solda boş alan (yazı üstüne gelir).
async function kampanyaGorseli(b, renk1, renk2, rozet) {
  const boy = [300, 360, 330, 390, 280, 350, 320, 370, 300];
  const sirtlar = ['#FDE68A', '#FCA5A5', '#93C5FD', '#FFFFFF', '#86EFAC', '#C4B5FD', '#FDBA74', '#F9A8D4', '#A5F3FC']
    .map((c, i) => '<i style="display:block;width:46px;height:' + boy[i] + 'px;background:' + c + ';border-radius:6px 6px 0 0;box-shadow:inset -6px 0 0 rgba(0,0,0,.12)"></i>').join('');
  const p = await b.newPage({ viewport: { width: 1600, height: 500 } });
  await p.setContent('<body style="margin:0"><div style="position:relative;width:1600px;height:500px;overflow:hidden;background:linear-gradient(115deg,' + renk1 + ' 0%,' + renk2 + ' 100%);font-family:sans-serif">' +
    '<div style="position:absolute;right:-120px;top:-160px;width:620px;height:620px;border-radius:50%;background:rgba(255,255,255,.12)"></div>' +
    '<div style="position:absolute;right:120px;bottom:0;display:flex;align-items:flex-end;gap:10px">' + sirtlar + '</div>' +
    '<div style="position:absolute;right:640px;top:70px;width:200px;height:200px;border-radius:50%;background:#FACC15;color:#422006;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:64px;transform:rotate(-12deg);box-shadow:0 20px 40px rgba(0,0,0,.25)">' + rozet + '</div>' +
    '</div></body>');
  const veri = 'data:image/jpeg;base64,' + (await p.screenshot({ type: 'jpeg', quality: 82 })).toString('base64');
  await p.close();
  return veri;
}
(async () => {
  const b = await chromium.launch();
  const kampanyalar = [
    { id: 'kp1', baslik: 'Okula dönüşte test kitaplarında %20 indirim', aciklama: 'Tüm LGS, TYT ve AYT kitaplarında 30 Kasım’a kadar, kasada geçerli.', resim: await kampanyaGorseli(b, '#EA580C', '#BE123C', '%20') },
    { id: 'kp2', baslik: 'Yeni gelenler: 2027 deneme setleri', aciklama: 'Raf 2’de sizi bekliyor.', resim: await kampanyaGorseli(b, '#0284C7', '#4338CA', 'YENİ') }
  ];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  const foto = (ad, tam) => p.screenshot({ path: OUT + '/' + ad + '.jpg', type: 'jpeg', quality: 82, fullPage: !!tam });
  await p.goto(K + 'index.html?yerel=1'); await p.evaluate(tohum); await p.evaluate(zenginlestir); await p.evaluate((l) => { const v = JSON.parse(localStorage.getItem('kitabim-hangi-rafta:v1')); v.ayarlar.kampanyalar = l; localStorage.setItem('kitabim-hangi-rafta:v1', JSON.stringify(v)); }, kampanyalar);
  // Müşteri ekranı
  await p.goto(K + 'index.html?yerel=1&kiosk=1'); await p.waitForTimeout(500); await foto('k1-karsilama', true);
  await p.fill('#sorgu', 'kürk'); await p.press('#sorgu', 'Enter'); await p.waitForTimeout(3800); await foto('k2-sonuc');
  await p.click('#ana-sayfa'); await p.click('#okul-gezin [data-okul-ad="Örnek Ortaokulu"]'); await p.click('[data-liste="l1"]'); await p.waitForTimeout(300); await foto('k3-okul', true);
  await p.click('#ana-sayfa'); await p.fill('#sorgu', 'Suç ve Ceza'); await p.press('#sorgu', 'Enter'); await p.click('[data-talep-kitap]');
  await p.fill('#t-ad', 'Ayşe'); await p.waitForTimeout(200); await foto('k4-talep');
  await p.keyboard.press('Escape'); await p.evaluate(() => window.Klavye && Klavye.kapat());
  await p.fill('#sorgu', 'kurk mantolu madona'); await p.press('#sorgu', 'Enter'); await p.waitForTimeout(200); await foto('k5-oneri');
  // Yönetim paneli
  const sekme = async (ad, dosya) => { await p.click('#sek-' + ad); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, 0)); await foto(dosya); };
  await p.goto(K + 'yonetim.html?yerel=1'); await p.waitForTimeout(500); await foto('p1-genel');
  await sekme('raflar', 'p2-raflar'); await p.click('button.bolme:has-text("2.3")'); await foto('p2-raflar');
  await sekme('harita', 'p3-harita'); await p.click('[data-tur=raf] >> nth=2'); await foto('p3-harita');
  await sekme('kitaplar', 'p4-kitaplar');
  await p.click('.ust-cubuk [data-is=kitap-yeni]'); await p.waitForTimeout(200); await foto('p5-kitap-ekle'); await p.keyboard.press('Escape');
  await sekme('okul', 'p6-okul'); await p.click('[data-okul="l1"]'); await p.waitForTimeout(200); await foto('p6-okul');
  await sekme('talepler', 'p7-talepler');
  await sekme('etiketler', 'p8-etiketler');
  await sekme('gecmis', 'p9-gecmis');
  await sekme('revizeler', 'p10-revizeler');
  await sekme('ayarlar', 'p11-ayarlar');
  await sekme('kampanyalar', 'p14-kampanyalar');
  // Ürün girişi: mağaza programının .xls listesi yüklenir, önizleme
  await p.click('#sek-urun-girisi'); await p.setInputFiles('#giris-dosya', require('path').join(__dirname, '../veri/libreoffice-ornek.xls'));
  await p.waitForSelector('#giris-onizleme:not([hidden])'); await p.waitForTimeout(300); await p.evaluate(() => document.getElementById('giris-ozet').scrollIntoView()); await p.evaluate(() => window.scrollBy(0, -140)); await foto('p13-urun-girisi');
  // Şube eksikleri: örnek listeyi indir, geri yükle
  await p.click('#sek-sube'); await p.fill('#sube-ad', 'Kadıköy şubesi');
  const [ind] = await Promise.all([p.waitForEvent('download'), p.click('#sube-ornek')]);
  await p.setInputFiles('#sube-dosya', await ind.path()); await p.waitForSelector('#sube-sonuc:not([hidden])');
  await p.waitForTimeout(300); await p.evaluate(() => document.getElementById('sube-ozet').scrollIntoView()); await p.evaluate(() => window.scrollBy(0, -140)); await foto('p12-sube');
  // Telefon
  const t = await b.newContext({ ...devices['iPhone 13'] }); const tp = await t.newPage();
  await tp.goto(K + 'index.html?yerel=1'); await tp.evaluate(tohum); await tp.evaluate(zenginlestir);
  await tp.goto(K + 'index.html?yerel=1&liste=l1'); await tp.waitForTimeout(400);
  await tp.screenshot({ path: OUT + '/t1-telefon-liste.jpg', type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 390, height: 844 } });
  await tp.goto(K + 'index.html?yerel=1'); await tp.waitForTimeout(300); await tp.fill('#sorgu', 'kürk'); await tp.press('#sorgu', 'Enter'); await tp.waitForTimeout(3800);
  await tp.screenshot({ path: OUT + '/t2-telefon-sonuc.jpg', type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 390, height: 844 } });
  await b.close();
  console.log(fs.readdirSync(OUT).join(' '));
})();
