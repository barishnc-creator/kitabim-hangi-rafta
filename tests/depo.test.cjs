const test = require('node:test');
const assert = require('node:assert/strict');
const Depo = require('../js/depo.js');
const Arama = require('../js/arama.js');

function ornek() {
  const d = Depo.bos();
  const r1 = Depo.rafEkle(d, 'Okul kitapları', 3);
  const r2 = Depo.rafEkle(d, 'Test kitapları', 4);
  return { d, r1, r2 };
}

test('raflar sırayla numaralanır, bölme kodu raf.bölme olur', () => {
  const { d, r1, r2 } = ornek();
  assert.equal(r1.no, 1);
  assert.equal(r2.no, 2);
  assert.equal(Depo.konum(d, r2.bolmeler[2].id).kod, '2.3');
});

test('silinen rafın numarası yeni rafa verilmez', () => {
  const { d, r2 } = ornek();
  Depo.rafSil(d, r2.id);
  assert.equal(Depo.rafEkle(d, '').no, 2);
  const { d: d2, r1 } = ornek();
  Depo.rafSil(d2, r1.id);
  assert.equal(Depo.rafEkle(d2, '').no, 3);
});

test('içinde kitap olan raf ve bölme silinemez', () => {
  const { d, r1 } = ornek();
  Depo.kitapKaydet(d, { ad: 'Atlas', bolmeId: r1.bolmeler[0].id });
  assert.throws(() => Depo.rafSil(d, r1.id), { kod: 'DOLU' });
  assert.throws(() => Depo.bolmeSil(d, r1.bolmeler[0].id), { kod: 'DOLU' });
  Depo.bolmeSil(d, r1.bolmeler[1].id);
  assert.equal(r1.bolmeler.length, 2);
});

test('kitap adı ve bölme zorunlu, fiyat/stok sayı olmalı', () => {
  const { d, r1 } = ornek();
  const b = r1.bolmeler[0].id;
  assert.throws(() => Depo.kitapKaydet(d, { ad: '  ', bolmeId: b }), { kod: 'EKSIK' });
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'X' }), { kod: 'EKSIK' });
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'X', bolmeId: b, fiyat: 'abc' }), { kod: 'GECERSIZ' });
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'X', bolmeId: b, stok: '-1' }), { kod: 'GECERSIZ' });
  const k = Depo.kitapKaydet(d, { ad: 'X', bolmeId: b, fiyat: '249,90', stok: '12' });
  assert.equal(k.fiyat, 249.9);
  assert.equal(k.stok, 12);
  const bosAlan = Depo.kitapKaydet(d, { ad: 'Y', bolmeId: b, fiyat: '', stok: '' });
  assert.equal(bosAlan.fiyat, null);
  assert.equal(bosAlan.stok, null);
});

test('aynı barkod uyarı verir, izinle kaydedilir; güncelleme kendi barkoduna takılmaz', () => {
  const { d, r1 } = ornek();
  const b = r1.bolmeler[0].id;
  const k = Depo.kitapKaydet(d, { ad: 'A', barkod: '978 605 1', bolmeId: b });
  assert.equal(k.barkod, '9786051');
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'B', barkod: '9786051', bolmeId: b }), { kod: 'AYNI_BARKOD' });
  Depo.kitapKaydet(d, { ad: 'B', barkod: '9786051', bolmeId: b }, { ayniBarkodaIzin: true });
  assert.equal(d.kitaplar.length, 2);
  Depo.kitapKaydet(d, { ...k, ad: 'A2' });
  assert.equal(d.kitaplar.find((x) => x.id === k.id).ad, 'A2');
});

test('arama Türkçe harf ve büyük/küçük harf duyarsız', () => {
  const kitaplar = [
    { id: 1, ad: 'İlköğretim Sözlüğü', yazar: 'Şükrü Çelik', yayinevi: 'Örnek', barkod: '9781111111111' },
    { id: 2, ad: '7. Sınıf Matematik Soru Bankası', yazar: 'A', yayinevi: 'Işık Yayınları', barkod: '9782222222222' },
    { id: 3, ad: 'Matematik Defteri', yazar: 'B', yayinevi: 'C', barkod: '' }
  ];
  assert.deepEqual(Arama.ara(kitaplar, 'ilkogretim sozlugu').map((k) => k.id), [1]);
  assert.deepEqual(Arama.ara(kitaplar, 'SUKRU').map((k) => k.id), [1]);
  assert.deepEqual(Arama.ara(kitaplar, 'isik').map((k) => k.id), [2]);
  assert.deepEqual(Arama.ara(kitaplar, '7 sinif matematik').map((k) => k.id), [2]);
  assert.deepEqual(Arama.ara(kitaplar, 'matematik').map((k) => k.id), [3, 2]);
  assert.deepEqual(Arama.ara(kitaplar, '978-2222222222').map((k) => k.id), [2]);
  assert.deepEqual(Arama.ara(kitaplar, '   '), []);
  assert.deepEqual(Arama.ara(kitaplar, 'yok böyle kitap'), []);
});

test('bozuk yedek dosyası güvenli şekilde düzeltilir', () => {
  assert.deepEqual(Depo.duzelt(null), Depo.bos());
  const d = Depo.duzelt({ raflar: [{ id: 'r', no: '2', bolmeler: [{ id: 'b', no: 1 }, null] }], kitaplar: [{ id: 'k' }], ayarlar: { fiyat: false } });
  assert.equal(d.raflar[0].no, 2);
  assert.equal(d.raflar[0].bolmeler.length, 1);
  assert.equal(d.kitaplar.length, 0);
  assert.equal(d.ayarlar.fiyat, false);
  assert.equal(d.ayarlar.stok, true);
});

test('okul listesi: zorunlu alanlar, aynı okul+sınıf engeli, durum hesabı', () => {
  const { d, r1, r2 } = ornek();
  const a = Depo.kitapKaydet(d, { ad: 'A', bolmeId: r1.bolmeler[0].id, stok: 3 });
  const b = Depo.kitapKaydet(d, { ad: 'B', bolmeId: r2.bolmeler[1].id, stok: 0 });
  assert.throws(() => Depo.okulListesiKaydet(d, { okul: '', sinif: '7-A' }), { kod: 'EKSIK' });
  assert.throws(() => Depo.okulListesiKaydet(d, { okul: 'X', sinif: ' ' }), { kod: 'EKSIK' });
  const l = Depo.okulListesiKaydet(d, { okul: 'Örnek Ortaokulu', sinif: '7-A', kalemler: [{ metin: 'A', kitapId: a.id }, { metin: 'B', kitapId: b.id }, { metin: 'Yok', kitapId: null }, { metin: '  ' }] });
  assert.equal(l.kalemler.length, 3);
  assert.throws(() => Depo.okulListesiKaydet(d, { okul: 'örnek ortaokulu', sinif: '7-a' }), { kod: 'AYNI_LISTE' });
  Depo.okulListesiKaydet(d, Object.assign({}, l, { sinif: '7-A' })); // kendi kaydını güncellemek serbest
  assert.equal(Depo.okulListesiKaydet(d, { okul: 'ÖRNEK ORTAOKULU', sinif: '8-A' }).okul, 'Örnek Ortaokulu');
  Depo.okulListesiSil(d, d.okulListeleri[1].id);
  const durum = Depo.listeDurumu(d, d.okulListeleri[0]);
  assert.equal(durum.toplam, 3);
  assert.equal(durum.hazir, 1); // B tükendi, üçüncü mağazada yok
  assert.deepEqual(durum.raflar, { 1: 1 });
  Depo.kitapSil(d, a.id);
  assert.equal(Depo.listeDurumu(d, d.okulListeleri[0]).hazir, 0, 'silinen kitap eksik sayılır');
  Depo.okulListesiSil(d, l.id);
  assert.equal(d.okulListeleri.length, 0);
});
