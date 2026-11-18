const { chromium } = require('playwright');
const tohum = require('./tohum.js');
const OUT = process.argv[2] || require('os').tmpdir(), K = 'http://localhost:8765/';
// Sahte Supabase adresi js/ayar.js'ten okunur; proje taşınınca test de kendiliğinden uyar.
const SB = require('fs').readFileSync(require('path').join(__dirname, '../../js/ayar.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/)[1].replace(/\/$/, '');
// Sahte Supabase verisi (REST yanıtları)
const VERI = {
  kirtasiye_raflar: [{ id: 'r1', no: 1, etiket: 'Okul' }, { id: 'r2', no: 2, etiket: 'Roman' }],
  kirtasiye_bolmeler: [{ id: 'b11', raf_id: 'r1', no: 1 }, { id: 'b21', raf_id: 'r2', no: 1 }, { id: 'b22', raf_id: 'r2', no: 2 }],
  kirtasiye_kitaplar: [{ id: 'k1', ad: 'Kürk Mantolu Madonna', yazar: 'Sabahattin Ali', yayinevi: 'YKY', barkod: '', bolme_id: 'b22', fiyat: '125.00', stok: 3, kapak: '', eklendi: '2026-11-10T10:00:00Z' },
    { id: 'k2', ad: '7. Sınıf Matematik', yazar: '', yayinevi: '', barkod: '', bolme_id: 'b11', fiyat: null, stok: null, kapak: '', eklendi: '2026-11-12T10:00:00Z' }],
  kirtasiye_okul_listeleri: [{ id: 'l1', okul: 'Örnek Ortaokulu', sinif: '7-A', kalemler: [{ metin: '7. Sınıf Matematik', kitapId: 'k2' }] }],
  kirtasiye_ayarlar: { fiyat: true, stok: true, magaza_adi: 'Bulut Kırtasiye', renk: '#0F766E', logo: '', karsilama: '', plan: {} }
};
async function sahteSupabase(ctx, durum) {
  await ctx.route(SB + '/**', (r) => {
    if (durum.kapali) return r.abort('internetdisconnected');
    const u = new URL(r.request().url());
    const tablo = u.pathname.split('/').pop();
    if (u.pathname.includes('/rest/v1/') && r.request().method() === 'GET' && VERI[tablo] !== undefined) {
      const tek = (r.request().headers()['accept'] || '').includes('vnd.pgrst.object');
      const govde = Array.isArray(VERI[tablo]) ? VERI[tablo] : (tek ? VERI[tablo] : [VERI[tablo]]);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
    }
    if (u.pathname.includes('/rest/v1/kirtasiye_aramalar')) return r.fulfill({ status: 201, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
(async () => {
  const b = await chromium.launch();
  const h = [];
  // 1) Yerel mod: önbellekten açılış
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => h.push(e.message));
  await p.goto(K + 'index.html?yerel=1'); await p.evaluate(tohum);
  await p.goto(K + 'index.html?yerel=1');
  await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 10000 });
  await p.reload(); await p.waitForTimeout(500);
  console.log('hizmet çalışanı aktif:', await p.evaluate(() => !!navigator.serviceWorker.controller));
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(500);
  console.log('[yerel] çevrimdışı açıldı:', await p.textContent('#magaza-adi'), '| şerit:', await p.isVisible('#cevrimdisi'));
  await p.fill('#sorgu', 'kürk'); await p.press('#sorgu', 'Enter');
  console.log('[yerel] çevrimdışı arama:', await p.textContent('.k-yer strong'));
  await ctx.setOffline(false); await p.waitForTimeout(300);
  console.log('[yerel] bağlantı gelince şerit kalktı:', !(await p.isVisible('#cevrimdisi')));
  await ctx.close();

  // 2) Bulut modu (sahte Supabase): ilk yükleme, sonra bağlantı kopuk
  const c2 = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const durum = { kapali: false };
  await sahteSupabase(c2, durum);
  const k = await c2.newPage(); k.on('pageerror', (e) => h.push('bulut: ' + e.message));
  await k.goto(K + 'index.html'); await k.waitForTimeout(800);
  console.log('[bulut] mağaza adı:', await k.textContent('#magaza-adi'), '| raf düğmesi:', await k.$$eval('.k-raf-dugme', (x) => x.length), '| okul:', await k.textContent('#okul-gezin'));
  await k.fill('#sorgu', 'kürk'); await k.press('#sorgu', 'Enter');
  console.log('[bulut] arama:', await k.textContent('.k-yer strong'), '| fiyat:', await k.textContent('.k-rozetler'));
  durum.kapali = true;
  await k.reload(); await k.waitForTimeout(800);
  console.log('[bulut→kopuk] mağaza adı:', await k.textContent('#magaza-adi'), '| şerit:', (await k.textContent('#cevrimdisi')).slice(0, 70));
  await k.fill('#sorgu', '7. sınıf'); await k.press('#sorgu', 'Enter');
  console.log('[bulut→kopuk] son listeyle arama:', await k.textContent('.k-yer strong'));
  await k.screenshot({ path: OUT + '/cevrimdisi-kiosk.png' });
  durum.kapali = false;
  await k.evaluate(() => window.dispatchEvent(new Event('online'))); await k.waitForTimeout(800);
  console.log('[bulut] bağlantı gelince şerit kalktı:', !(await k.isVisible('#cevrimdisi')));
  console.log('hatalar:', h);
  await b.close();
})();
