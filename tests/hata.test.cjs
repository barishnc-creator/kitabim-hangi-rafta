// Hata bildirimi (js/hata.js): neyin bildirildiği, kayda ne yazıldığı.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Hata = require('../js/hata.js');
const Depo = require('../js/depo.js');

test('hata.js sürümü sw.js sürümüyle aynı (panelde görünen sürüm doğru olsun)', () => {
  const sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8').match(/SURUM = '([^']+)'/)[1];
  assert.equal(Hata.SURUM, sw);
  assert.match(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), /'js\/hata\.js'/);
});

test('kullanıcının yanlış girişi hata sayılmaz; beklenmeyen hata sayılır', () => {
  const d = Depo.bos();
  let dogrulama;
  try { Depo.kitapKaydet(d, { ad: '' }); } catch (e) { dogrulama = e; }
  assert.equal(Hata.bildirilmeli(dogrulama), false);
  const dosya = new Error('Dosya bir Excel dosyası değil'); dosya.kullaniciMesaji = true;
  assert.equal(Hata.bildirilmeli(dosya), false);
  const sinir = new Error('Bu numarayla bugün en fazla 5 talep'); sinir.sinir = true;
  assert.equal(Hata.bildirilmeli(sinir), false);
  assert.equal(Hata.bildirilmeli('Script error.'), false);
  assert.equal(Hata.bildirilmeli(new TypeError("Cannot read properties of undefined (reading 'ad')")), true);
  assert.equal(Hata.bildirilmeli(new Error('Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.')), true);
});

test('kayıt: bağlam eklenir, uzunluk sınırlanır, adresler yalnız dosya adına iner (sorgu yazılmaz)', () => {
  const e = new Error('x is undefined');
  e.stack = 'TypeError: x is undefined\n    at ciz (https://barishnc-creator.github.io/kitabim-hangi-rafta/js/musteri.js?v=1:120:5)\n    at https://ornek.com/index.html?sorgu=ahmet:3:1';
  const k = Hata.kayitYap(e, 'Müşteri ekranı açılışı');
  assert.equal(k.mesaj, 'Müşteri ekranı açılışı: x is undefined');
  assert.match(k.ayrinti, /at ciz \(musteri\.js:120:5\)/);
  assert.doesNotMatch(k.ayrinti, /ahmet|github\.io/);
  assert.equal(k.surum, Hata.SURUM);
  assert.ok(Hata.kayitYap(new Error('a'.repeat(1000))).mesaj.length <= 300);
});
