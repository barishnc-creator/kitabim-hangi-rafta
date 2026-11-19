// Talep sınırı ve yönetici bildirimi, BULUT modunda (sahte Supabase). İki veritabanı durumu denenir:
//  - yeni: supabase/guvenlik-2026-11-19.sql çalıştırılmış (talep fonksiyonu + bildirim tablosu var)
//  - eski: SQL henüz çalıştırılmamış (fonksiyon ve tablo yok): müşteri ekranı tabloya doğrudan ekler, panel şeridi gizler.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const K = 'http://localhost:8765/';
const SB = fs.readFileSync(path.join(__dirname, '../../js/ayar.js'), 'utf8').match(/supabaseUrl:\s*'([^']+)'/)[1].replace(/\/$/, '');
const SINIR = 'Bu numarayla bugün en fazla 5 talep bırakılabiliyor; kırtasiye çalışanımız sizinle ilgilenecek.';

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
const json = (r, status, govde) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(govde) });

async function senaryo(b, eski, bekle) {
  const ad = eski ? 'eski veritabanı' : 'yeni veritabanı';
  const hatalar = [], istekler = [];
  let rpcSayisi = 0;
  let bildirimler = [{ id: 'bd1', telefon: '05321112233', deneme: 7, ilk: '2026-11-19T10:00:00Z', son: '2026-11-19T10:05:00Z' }];
  const VERI = {
    kirtasiye_raflar: [], kirtasiye_bolmeler: [], kirtasiye_kitaplar: [], kirtasiye_okul_listeleri: [],
    kirtasiye_ayarlar: { fiyat: true, magaza_adi: 'Bulut Kırtasiye', renk: '', logo: '', karsilama: '', plan: {} },
    kirtasiye_talepler: [{ id: 't1', kitap: 'Küçük Prens', kitap_id: null, ad: 'Can', telefon: '05321234567', notu: '', durum: 'yeni', olusturuldu: '2026-11-19T09:00:00Z' }]
  };
  async function sahteSupabase(ctx) {
    await ctx.route(SB + '/**', async (r) => {
      const q = r.request(), u = new URL(q.url()), son = u.pathname.split('/').pop(), yontem = q.method();
      const tek = (q.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (u.pathname.startsWith('/auth/')) return json(r, 200, { id: 'u1', email: 'test@ornek.com' });
      if (son === 'kirtasiye_uyeler') return json(r, 200, tek ? { ad: 'Test', eposta: 'test@ornek.com', rol: 'calisan' } : [{ ad: 'Test', eposta: 'test@ornek.com', rol: 'calisan' }]);
      if (u.pathname.includes('/rpc/kirtasiye_talep_birak')) {
        istekler.push({ yontem, son, govde: JSON.parse(q.postData()) });
        if (eski) return json(r, 404, { code: 'PGRST202', message: 'Could not find the function public.kirtasiye_talep_birak(p_ad, p_kitap, p_kitap_id, p_notu, p_telefon) in the schema cache' });
        return json(r, 200, ++rpcSayisi === 1);
      }
      if (son === 'kirtasiye_bildirimler') {
        if (eski) return json(r, 404, { code: 'PGRST205', message: "Could not find the table 'public.kirtasiye_bildirimler' in the schema cache" });
        if (yontem === 'PATCH') {
          const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
          istekler.push({ yontem, son, id, govde: JSON.parse(q.postData()) });
          bildirimler = bildirimler.filter((x) => x.id !== id);
          return r.fulfill({ status: 204, body: '' });
        }
        return json(r, 200, bildirimler);
      }
      if (son === 'kirtasiye_talepler' && yontem === 'POST') {
        istekler.push({ yontem, son, govde: JSON.parse(q.postData()) });
        return r.fulfill({ status: 201, body: '' });
      }
      if (yontem === 'GET' && VERI[son] !== undefined) {
        const v = VERI[son];
        return json(r, 200, Array.isArray(v) ? v : (tek ? v : [v]));
      }
      return json(r, 200, []);
    });
  }

  // Müşteri ekranı (girişsiz)
  const kctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await sahteSupabase(kctx);
  const k = await kctx.newPage();
  k.on('pageerror', (e) => hatalar.push('kiosk: ' + e.message));
  await k.goto(K + 'index.html?kiosk=1');
  async function talepBirak() {
    await k.click('#ana-sayfa').catch(() => {});
    await k.click('#secim-talep');
    await k.fill('#t-kitap', 'Kınalı Serçe'); await k.fill('#t-ad', 'Ayşe'); await k.fill('#t-tel', '0532 111 22 33'); await k.check('#t-onay');
    await k.click('.talep-perde button[type=submit]');
    await k.waitForFunction(() => /Talebiniz alındı|en fazla|gönderilemedi/.test(document.querySelector('.talep-perde').textContent), null, { timeout: 5000 });
    return (await k.textContent('.talep-perde')).replace(/\s+/g, ' ');
  }
  const ilk = await talepBirak();
  console.log(ad, '· 1. talep:', ilk.slice(0, 60));
  bekle(/Talebiniz alındı/.test(ilk), ad + ': talep kaydedilmeli');
  if (eski) {
    const post = istekler.find((x) => x.son === 'kirtasiye_talepler' && x.yontem === 'POST');
    bekle(post && post.govde.telefon === '05321112233' && post.govde.onay === true, 'eski veritabanında tabloya doğrudan eklenmeli');
  } else {
    bekle(!istekler.some((x) => x.son === 'kirtasiye_talepler'), 'yeni veritabanında tabloya doğrudan eklenmemeli');
    await k.click('#t-tamam');
    const ikinci = await talepBirak();
    const mesaj = (await k.textContent('#t-mesaj')).trim();
    console.log(ad, '· sınır aşılınca:', mesaj);
    bekle(mesaj === SINIR, 'sınır aşılınca nazik mesaj çıkmalı');
    bekle(!/gönderilemedi|spam/i.test(ikinci), 'mesajda "gönderilemedi" ya da "spam" olmamalı');
    bekle(await k.$('#t-mesaj .mesaj.uyari'), 'mesaj hata değil uyarı görünümünde olmalı');
  }
  await kctx.close();

  // Yönetim paneli (çalışan oturumu)
  const pctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const sure = Math.floor(Date.now() / 1000) + 3600;
  const token = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u1', exp: sure, role: 'authenticated' }) + '.imza';
  await pctx.addInitScript(([anahtar, deger]) => { sessionStorage.setItem(anahtar, deger); }, [
    'kitabim-hangi-rafta-oturum',
    JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: sure, user: { id: 'u1', email: 'test@ornek.com', aud: 'authenticated', role: 'authenticated' } }),
  ]);
  await sahteSupabase(pctx);
  const p = await pctx.newPage();
  p.on('pageerror', (e) => hatalar.push('panel: ' + e.message));
  await p.goto(K + 'yonetim.html');
  await p.waitForSelector('#panel:not([hidden])', { timeout: 10000 });
  await p.waitForFunction(() => document.getElementById('talep-sayac').textContent === '1', null, { timeout: 5000 });
  await p.waitForTimeout(300);
  const serit = await p.isVisible('#bildirim-serit');
  if (eski) {
    bekle(!serit, 'bildirim tablosu yokken şerit gizli olmalı');
    const genel = await p.textContent('#genel-mesaj');
    bekle(!/hata|kurulmamış/i.test(genel), 'tablo yokken panelde hata çıkmamalı: ' + genel);
  } else {
    const metin = serit ? (await p.textContent('#bildirim-serit')).replace(/\s+/g, ' ') : '';
    console.log(ad, '· şerit:', metin);
    bekle(/Bu kişi birden fazla istek gönderiyor/.test(metin) && metin.includes('0532 111 22 33') && /7 deneme/.test(metin), 'şerit telefonu ve deneme sayısını göstermeli');
    bekle(!/spam/i.test(metin), 'şeritte "spam" geçmemeli');
    await p.click('[data-bildirim-okundu="bd1"]');
    await p.waitForFunction(() => document.getElementById('bildirim-serit').hidden, null, { timeout: 5000 }).catch(() => {});
    const patch = istekler.find((x) => x.son === 'kirtasiye_bildirimler' && x.yontem === 'PATCH');
    bekle(patch && patch.id === 'bd1' && patch.govde.okundu === true, 'Okundu bildirimi güncellemeli');
    bekle(await p.isHidden('#bildirim-serit'), 'okundu sonrası şerit gizlenmeli');
  }
  await p.click('#sek-talepler'); await p.waitForTimeout(200);
  const satir = await p.$$eval('#talep-satirlar tr', (x) => x.length);
  bekle(satir === 1, ad + ': Talepler sekmesi çalışmalı (satır: ' + satir + ')');
  await pctx.close();
  bekle(!hatalar.length, ad + ': sayfa hatası olmamalı ' + JSON.stringify(hatalar));
}

(async () => {
  const b = await chromium.launch();
  let tamam = true;
  const bekle = (kosul, ad) => { if (!kosul) { tamam = false; console.log('  BAŞARISIZ:', ad); } };
  await senaryo(b, false, bekle);
  await senaryo(b, true, bekle);
  await b.close();
  console.log(tamam ? 'SONUÇ: geçti' : 'SONUÇ: BAŞARISIZ');
  if (!tamam) process.exit(1);
})();
