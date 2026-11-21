// Kitapları toplu sil (Ayarlar), BULUT modunda (sahte Supabase): önce yalnız rafsızlar, sonra tümü.
// 200'lük parçalarla DELETE ?id=in.(...) gönderilmeli; "SİL" yazılmadan düğme kapalı; bitince liste güncel.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const K = 'http://localhost:8765/';
const SB = fs.readFileSync(path.join(__dirname, '../../js/ayar.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/)[1].replace(/\/$/, '');
const kitap = (i, bolme) => ({ id: 'a0000000-0000-4000-8000-' + String(i).padStart(12, '0'), ad: 'Kitap ' + i, yazar: '', yayinevi: '', barkod: String(9780000000000 + i), bolme_id: bolme, fiyat: null, kapak: '', eklendi: '2026-11-21T10:00:00Z' });
const VERI = {
  kirtasiye_raflar: [{ id: 'r1', no: 1, etiket: '' }], kirtasiye_bolmeler: [{ id: 'b11', raf_id: 'r1', no: 1 }],
  kirtasiye_kitaplar: Array.from({ length: 1005 }, (_, i) => kitap(i, i < 5 ? 'b11' : null)),
  kirtasiye_okul_listeleri: [], kirtasiye_ayarlar: { fiyat: true, magaza_adi: 'Test', renk: '', logo: '', karsilama: '', plan: {} },
};
const silmeler = [];
function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let tamam = true; const hatalar = [];
  const bekle = (k, ad) => { if (!k) { tamam = false; console.log('  BAŞARISIZ:', ad); } };
  const sure = Math.floor(Date.now() / 1000) + 3600;
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u1', exp: sure, role: 'authenticated' }) + '.imza';
  await ctx.addInitScript(([a, v]) => { sessionStorage.setItem(a, v); }, ['kitabim-hangi-rafta-oturum',
    JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: sure, user: { id: 'u1', email: 't@o.com', aud: 'authenticated', role: 'authenticated' } })]);
  await ctx.route(SB + '/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), t = u.pathname.split('/').pop(), y = q.method();
    const tek = (q.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname.startsWith('/auth/')) return json({ id: 'u1' });
    if (t === 'kirtasiye_uyeler') { const o = { ad: 'T', eposta: 't@o.com', rol: 'duzenleyici' }; return json(tek ? o : [o]); }
    if (t === 'kirtasiye_kitaplar' && y === 'DELETE') {
      const ids = (u.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/"/g, ''));
      silmeler.push(ids.length);
      VERI.kirtasiye_kitaplar = VERI.kirtasiye_kitaplar.filter((k) => !ids.includes(k.id));
      return r.fulfill({ status: 204, body: '' });
    }
    if (y === 'GET' && VERI[t] !== undefined) {
      let v = VERI[t]; if (!Array.isArray(v)) return json(tek ? v : [v]);
      const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1e9); return json(v.slice(off, off + lim));
    }
    return json([]);
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => hatalar.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(K + 'yonetim.html#ayarlar');
  await p.waitForSelector('#panel:not([hidden])', { timeout: 10000 });
  await p.click('#sek-ayarlar');
  await p.waitForFunction(() => /1\.000/.test(document.getElementById('toplu-sil-rafsiz').textContent));
  console.log('sayılar:', await p.textContent('#toplu-sil-rafsiz'), await p.textContent('#toplu-sil-tum'));
  bekle(await p.isDisabled('#toplu-sil-dugme'), 'SİL yazılmadan düğme kapalı');
  await p.fill('#toplu-sil-onay', 'sil');
  bekle(!(await p.isDisabled('#toplu-sil-dugme')), 'küçük harfle "sil" de kabul');
  await p.click('#toplu-sil-dugme');
  await p.waitForFunction(() => /silindi|yarıda/.test(document.getElementById('toplu-sil-durum').textContent), null, { timeout: 20000 });
  console.log('1:', await p.textContent('#toplu-sil-durum'), '| parçalar:', JSON.stringify(silmeler));
  bekle(JSON.stringify(silmeler) === '[200,200,200,200,200]', '1000 rafsız kitap 200lük 5 parçada');
  bekle(VERI.kirtasiye_kitaplar.length === 5 && VERI.kirtasiye_kitaplar.every((k) => k.bolme_id), 'raftakiler kalmalı');
  await p.waitForFunction(() => document.getElementById('toplu-sil-tum').textContent === '(5)');
  // Tümü
  await p.check('input[name=toplu-sil-kapsam][value=tum]');
  await p.fill('#toplu-sil-onay', 'SİL');
  await p.click('#toplu-sil-dugme');
  await p.waitForFunction(() => /^5 kitap silindi/.test(document.getElementById('toplu-sil-durum').textContent), null, { timeout: 20000 });
  bekle(VERI.kirtasiye_kitaplar.length === 0, 'tümü silinmeli');
  await p.click('#sek-kitaplar');
  console.log('kitap sayısı:', await p.textContent('#kitap-sayi'));
  bekle(/^0 kitap/.test(await p.textContent('#kitap-sayi')), 'liste boş');
  console.log(tamam && !hatalar.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', hatalar);
  await b.close();
  if (!tamam || hatalar.length) process.exit(1);
})();
