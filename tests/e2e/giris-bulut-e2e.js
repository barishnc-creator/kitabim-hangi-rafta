// Ürün girişi ve rafa yerleştirme, BULUT modunda (sahte Supabase).
// Programın Supabase'e gönderdiği istekler yakalanır: yeni kitap rafsız (bolme_id null) eklenmeli,
// kayıtlı kitabın stoğu güncellenmeli, rafa yerleştirme bölmeyi yazmalı. ESKI_SEMA=1: veritabanı güncellenmemişken (bolme_id zorunlu) anlaşılır mesaj.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const K = 'http://localhost:8765/';
const SB = fs.readFileSync(path.join(__dirname, '../../js/ayar.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/)[1].replace(/\/$/, '');
const REF = new URL(SB).hostname.split('.')[0];
const XLS = path.join(__dirname, '../veri/libreoffice-ornek.xls');

const VERI = {
  kirtasiye_raflar: [{ id: 'r1', no: 1, etiket: 'Roman' }],
  kirtasiye_bolmeler: [{ id: 'b11', raf_id: 'r1', no: 1 }, { id: 'b12', raf_id: 'r1', no: 2 }],
  kirtasiye_kitaplar: [{ id: 'k1', ad: 'Vanilya Kokulu Mektuplar', yazar: '', yayinevi: 'Can', barkod: '9789750701689', bolme_id: 'b11', fiyat: null, stok: 3, kapak: '', eklendi: '2026-11-10T10:00:00Z' }],
  kirtasiye_okul_listeleri: [],
  kirtasiye_ayarlar: { fiyat: true, stok: true, magaza_adi: 'Bulut Kırtasiye', renk: '', logo: '', karsilama: '', plan: {} },
};
const istekler = [];

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const hatalar = [];
  let tamam = true;
  const bekle = (kosul, ad) => { if (!kosul) { tamam = false; console.log('  BAŞARISIZ:', ad); } };

  // Sahte oturum: supabase-js oturumu yerel depodan okur
  const sure = Math.floor(Date.now() / 1000) + 3600;
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u1', exp: sure, role: 'authenticated' }) + '.imza';
  await ctx.addInitScript(([anahtar, deger]) => { localStorage.setItem(anahtar, deger); }, [
    'sb-' + REF + '-auth-token',
    JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: sure, user: { id: 'u1', email: 'test@ornek.com', aud: 'authenticated', role: 'authenticated' } }),
  ]);
  await ctx.route(SB + '/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), tablo = u.pathname.split('/').pop(), yontem = q.method();
    const tek = (q.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (process.env.ESKI_SEMA && tablo === 'kirtasiye_kitaplar' && yontem === 'POST') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '23502', message: 'null value in column "bolme_id" of relation "kirtasiye_kitaplar" violates not-null constraint' }) });
    if (u.pathname.startsWith('/auth/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', email: 'test@ornek.com' }) });
    if (tablo === 'kirtasiye_uyeler') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tek ? { ad: 'Test', eposta: 'test@ornek.com', rol: 'duzenleyici' } : [{ ad: 'Test', eposta: 'test@ornek.com', rol: 'duzenleyici' }]) });
    if (u.pathname.includes('/rest/v1/') && yontem === 'GET' && VERI[tablo] !== undefined) {
      const v = VERI[tablo];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Array.isArray(v) ? v : (tek ? v : [v])) });
    }
    if (tablo === 'kirtasiye_kitaplar' && yontem === 'POST') {
      const satirlar = [].concat(JSON.parse(q.postData()));
      istekler.push({ yontem, satirlar });
      satirlar.forEach((s, i) => VERI.kirtasiye_kitaplar.push(Object.assign({ id: 'yeni' + (VERI.kirtasiye_kitaplar.length + i), eklendi: new Date().toISOString() }, s)));
      return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (tablo === 'kirtasiye_kitaplar' && yontem === 'PATCH') {
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, ''), govde = JSON.parse(q.postData());
      istekler.push({ yontem, id, govde });
      Object.assign(VERI.kirtasiye_kitaplar.find((k) => k.id === id) || {}, govde);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tek ? { id } : [{ id }]) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const p = await ctx.newPage();
  p.on('pageerror', (e) => hatalar.push(e.message));
  await p.goto(K + 'yonetim.html#urun-girisi');
  p.on('console', (m) => { if (m.type() === 'error' && process.env.AYRINTI) console.log('konsol:', m.text()); });
  await p.waitForSelector('#panel:not([hidden])', { timeout: 10000 }).catch(async () => { console.log('açık ekran:', await p.evaluate(() => ['giris', 'yetkisiz', 'panel', 'kurulum'].filter((i) => document.getElementById(i) && !document.getElementById(i).hidden))); throw new Error('panel açılmadı'); });
  await p.click('#sek-urun-girisi');
  await p.setInputFiles('#giris-dosya', XLS);
  await p.waitForSelector('#giris-onizleme:not([hidden])');
  await p.click('#giris-kaydet');
  await p.waitForFunction(() => /kaydedildi|Kaydedilemedi/.test(document.getElementById('giris-durum').textContent));
  console.log('kayıt:', await p.textContent('#giris-durum'));

  const post = istekler.find((x) => x.yontem === 'POST');
  const patch = istekler.find((x) => x.yontem === 'PATCH' && x.id === 'k1');
  console.log('POST:', JSON.stringify(post && post.satirlar.map((s) => [s.ad, s.barkod, s.stok, s.bolme_id, s.yayinevi])));
  console.log('PATCH k1:', JSON.stringify(patch && patch.govde));
  bekle(post && post.satirlar.length === 1, 'tek yeni kitap eklenmeli');
  bekle(post && post.satirlar[0].bolme_id === null && post.satirlar[0].ad === 'Ahmet Haşim / Bize Göre' && post.satirlar[0].stok === 10, 'yeni kitap rafsız, normal yazımla, 10 adet');
  bekle(patch && patch.govde.stok === 8, 'kayıtlı kitabın stoğu 3 + 5 = 8');

  // Rafa yerleştir
  await p.waitForFunction(() => document.getElementById('rafsiz-sayac').textContent === '1');
  await p.selectOption('#yer-bolme', 'b12');
  await p.fill('#yer-barkod', '9786051000145'); await p.press('#yer-barkod', 'Enter');
  await p.waitForFunction(() => /Bölme 1\.2|Kaydedilemedi|hata/i.test(document.getElementById('yer-durum').textContent));
  console.log('yerleştir:', await p.textContent('#yer-durum'));
  const yer = istekler.filter((x) => x.yontem === 'PATCH' && x.id !== 'k1').pop();
  console.log('PATCH yerleştir:', JSON.stringify(yer && { id: yer.id, bolme_id: yer.govde.bolme_id, stok: yer.govde.stok }));
  bekle(yer && yer.govde.bolme_id === 'b12' && yer.govde.stok === 10, 'yerleştirme bölmeyi yazmalı, stok değişmemeli');

  console.log(tamam && !hatalar.length ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  console.log('hatalar:', hatalar);
  await b.close();
  if (!tamam || hatalar.length) process.exit(1);
})();
