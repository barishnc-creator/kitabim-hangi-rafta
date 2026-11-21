// Hata kaydı ve Sistem durumu, BULUT modunda (sahte Supabase).
// Müşteri ekranında beklenmeyen hata → rpc kirtasiye_hata_yaz isteği; çevrimdışıyken sırada bekler, bağlantı gelince gider.
// Panel: Sistem durumu sekmesi özet kartları ve hata listesini gösterir; "görüldü" PATCH gönderir; menü sayacı.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const K = 'http://localhost:8765/';
const SB = fs.readFileSync(path.join(__dirname, '../../js/ayar.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/)[1].replace(/\/$/, '');
const VERI = {
  kirtasiye_raflar: [{ id: 'r1', no: 1, etiket: '' }], kirtasiye_bolmeler: [{ id: 'b11', raf_id: 'r1', no: 1 }],
  kirtasiye_kitaplar: [{ id: 'k1', ad: 'Kınalı Serçe', yazar: '', yayinevi: '', barkod: '9786259506586', bolme_id: 'b11', fiyat: null, kapak: '', eklendi: '2026-11-10T10:00:00Z' }],
  kirtasiye_okul_listeleri: [], kirtasiye_ayarlar: { fiyat: true, magaza_adi: 'Bulut Kırtasiye', renk: '', logo: '', karsilama: '', plan: {} },
  kirtasiye_hatalar: [
    { id: 2, ilk: new Date(Date.now() - 7200e3).toISOString(), son: new Date(Date.now() - 60e3).toISOString(), adet: 3, ekran: 'musteri', mesaj: "Yakalanmamış: Cannot read properties of undefined (reading 'ad')", ayrinti: 'at ciz (musteri.js:120:5)', surum: 'khr-v19', cihaz: 'iPad Safari (uygulama)', kullanici: '', goruldu: false },
    { id: 1, ilk: '2026-11-20T10:00:00Z', son: '2026-11-20T10:00:00Z', adet: 1, ekran: 'panel', mesaj: 'Panel işlemi: Sunucuya ulaşılamadı.', ayrinti: '', surum: 'khr-v18', cihaz: 'Windows Chrome', kullanici: 'Ayşe', goruldu: true },
  ],
};
const DURUM = { kitap: 38748, rafsiz: 38000, raf: 1, talep: 0, veritabani_mb: 41.2, veritabani_sinir_mb: 500, hata_24_saat: 3, hata_gorulmemis: 1, son_hata: new Date(Date.now() - 60e3).toISOString(), son_kitap_degisikligi: new Date().toISOString() };
const hataIstekleri = [], patchler = [];
function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }

async function sahte(ctx, durum) {
  await ctx.route(SB + '/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), son = u.pathname.split('/').pop(), y = q.method();
    if (durum.kapali) return r.abort('internetdisconnected');
    const tek = (q.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname.startsWith('/auth/')) return json({ id: 'u1' });
    if (son === 'kirtasiye_hata_yaz') { hataIstekleri.push(JSON.parse(q.postData())); return r.fulfill({ status: 204, body: '' }); }
    if (son === 'kirtasiye_sistem_durumu') return json(DURUM);
    if (son === 'kirtasiye_uyeler') { const o = { ad: 'Test', eposta: 't@o.com', rol: 'duzenleyici' }; return json(tek ? o : [o]); }
    if (son === 'kirtasiye_hatalar' && y === 'PATCH') { patchler.push({ q: u.search, govde: JSON.parse(q.postData()) }); VERI.kirtasiye_hatalar.forEach((h) => { h.goruldu = true; }); DURUM.hata_gorulmemis = 0; return json([]); }
    if (y === 'GET' && VERI[son] !== undefined) { const v = VERI[son]; return json(Array.isArray(v) ? v : (tek ? v : [v])); }
    return json([]);
  });
}

(async () => {
  const b = await chromium.launch();
  let tamam = true;
  const bekle = (kosul, ad) => { if (!kosul) { tamam = false; console.log('  BAŞARISIZ:', ad); } };
  const sayfaHatalari = [];

  // 1) Müşteri ekranı: beklenmeyen hata bildirilir; doğrulama hatası bildirilmez
  const c1 = await b.newContext();
  const d1 = { kapali: false };
  await sahte(c1, d1);
  const k = await c1.newPage();
  await k.goto(K); await k.waitForTimeout(800);
  await k.evaluate(() => { setTimeout(() => { null.ad; }, 0); });
  await k.evaluate(() => { Promise.reject(Object.assign(new Error('Kitap adı boş olamaz.'), { kod: 'EKSIK' })); });
  await k.waitForTimeout(1200);
  console.log('müşteri ekranı bildirimleri:', JSON.stringify(hataIstekleri.map((h) => [h.p_ekran, h.p_mesaj, h.p_surum, h.p_cihaz])));
  bekle(hataIstekleri.length === 1 && hataIstekleri[0].p_ekran === 'musteri' && /reading 'ad'|null/.test(hataIstekleri[0].p_mesaj), 'beklenmeyen hata tek kez bildirilmeli, doğrulama hatası bildirilmemeli');
  bekle(/khr-v\d+/.test(hataIstekleri[0] && hataIstekleri[0].p_surum), 'sürüm yazılmalı');

  // 2) Çevrimdışıyken hata: sırada bekler, bağlantı gelince gider
  d1.kapali = true; await c1.setOffline(true);
  await k.evaluate(() => { setTimeout(() => { throw new Error('çevrimdışı deneme hatası'); }, 0); });
  await k.waitForTimeout(800);
  const sira = await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:hata-kuyrugu') || '[]').length);
  console.log('çevrimdışı sırada bekleyen:', sira);
  bekle(sira === 1, 'çevrimdışı hata sırada beklemeli');
  d1.kapali = false; await c1.setOffline(false);
  await k.waitForTimeout(3500);
  bekle(hataIstekleri.some((h) => h.p_mesaj === 'çevrimdışı deneme hatası'), 'bağlantı gelince sıradaki hata gönderilmeli');
  bekle(await k.evaluate(() => JSON.parse(localStorage.getItem('kitabim-hangi-rafta:hata-kuyrugu') || '[]').length) === 0, 'sıra boşalmalı');
  await c1.close();

  // 3) Panel: Sistem durumu
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const sure = Math.floor(Date.now() / 1000) + 3600;
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u1', exp: sure, role: 'authenticated' }) + '.imza';
  await c2.addInitScript(([a, v]) => { sessionStorage.setItem(a, v); }, ['kitabim-hangi-rafta-oturum',
    JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: sure, user: { id: 'u1', email: 't@o.com', aud: 'authenticated', role: 'authenticated' } })]);
  await sahte(c2, { kapali: false });
  const p = await c2.newPage();
  p.on('pageerror', (e) => sayfaHatalari.push(e.message));
  await p.goto(K + 'yonetim.html');
  await p.waitForSelector('#panel:not([hidden])', { timeout: 10000 });
  await p.waitForFunction(() => !document.getElementById('hata-sayac').hidden, null, { timeout: 8000 });
  console.log('menü sayacı:', await p.textContent('#hata-sayac'));
  await p.click('#sek-durum');
  await p.waitForFunction(() => document.querySelectorAll('#durum-hatalar tr').length === 2);
  const kpi = (await p.textContent('#durum-kpiler')).replace(/\s+/g, ' ');
  console.log('özet:', kpi);
  bekle(/38\.748/.test(kpi) && /41,2 MB/.test(kpi) && /%8 dolu/.test(kpi) && /khr-v\d+/.test(kpi), 'özet kartları doğru');
  bekle(/Yeni/.test(await p.textContent('#durum-hatalar tr:first-child')), 'görülmemiş hata işaretli');
  await p.click('[data-ayrinti="2"]');
  await p.waitForFunction(() => /musteri\.js:120/.test(document.getElementById('durum-hatalar').textContent), null, { timeout: 5000 }).catch(() => {});
  bekle(/musteri\.js:120/.test(await p.textContent('#durum-hatalar')), 'ayrıntı açılır');
  await p.click('#durum-goruldu');
  await p.waitForFunction(() => document.getElementById('hata-sayac').hidden);
  console.log('PATCH:', JSON.stringify(patchler));
  bekle(patchler.length === 1 && patchler[0].govde.goruldu === true, 'görüldü PATCH gönderilmeli');
  await p.screenshot({ path: path.join(process.argv[2] || require('os').tmpdir(), 'durum.png') });

  console.log(tamam && !sayfaHatalari.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', sayfaHatalari);
  await b.close();
  if (!tamam || sayfaHatalari.length) process.exit(1);
})();
