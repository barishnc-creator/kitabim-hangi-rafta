// Bölme kullanımı kapalı (Ayarlar → "Bölme kullanılsın"): raflar tek parça, her yerde yalnız "N. Raf".
const test = require('node:test');
const assert = require('node:assert/strict');
const Depo = require('../js/depo.js');
const Sube = require('../js/sube.js');

function magaza(bolme) {
  const d = Depo.bos();
  d.ayarlar.bolme = bolme;
  const r1 = Depo.rafEkle(d, 'Roman', 1);
  const r2 = Depo.rafEkle(d, 'Test', 2);
  return { d, r1, r2 };
}

test('bölmesiz: konum "N. Raf" verir; bölmeli hâli değişmez', () => {
  const { d, r2 } = magaza(false);
  const y = Depo.konum(d, r2.bolmeler[1].id);
  assert.equal(y.kod, '2. Raf'); assert.equal(y.ad, '2. Raf'); assert.equal(y.yazi, '2. Raf');
  d.ayarlar.bolme = true;
  const z = Depo.konum(d, r2.bolmeler[1].id);
  assert.equal(z.kod, '2.2'); assert.equal(z.ad, 'Bölme 2.2'); assert.equal(z.yazi, '2. Raf · Bölme 2.2');
});

test('bolmeBul: "2", "2. Raf", "Raf 2" rafın ilk bölmesi; "2.2" bölme; olmayan raf null', () => {
  const { d, r2 } = magaza(false);
  ['2', '2. Raf', 'Raf 2', ' raf 2 ', '2.raf'].forEach((k) => assert.equal(Depo.bolmeBul(d, k).bolme.id, r2.bolmeler[0].id, k));
  assert.equal(Depo.bolmeBul(d, '2.2').bolme.id, r2.bolmeler[1].id);
  assert.equal(Depo.bolmeBul(d, '9'), null);
  assert.equal(Depo.bolmeBul(d, 'abc'), null);
});

test('ayar kaydı: bulutta plan içinde "bolme:false" saklanır, plan düzeltmesi korur, varsayılan açık', () => {
  assert.equal(Depo.bos().ayarlar.bolme, true);
  assert.equal(Depo.duzelt({ ayarlar: {} }).ayarlar.bolme, true);
  assert.equal(Depo.duzelt({ ayarlar: { plan: { bolme: false, raflar: {} } } }).ayarlar.bolme, false);
  assert.equal(Depo.duzelt({ ayarlar: { bolme: false } }).ayarlar.bolme, false);
  assert.equal(Depo.planDuzelt({ bolme: false, raflar: {} }).bolme, false);
  assert.equal('bolme' in Depo.planDuzelt({ raflar: {} }), false);
});

test('şube çıktısı: bölmesizde Bölme sütunu yok', () => {
  const { d } = magaza(false);
  Depo.kitapKaydet(d, { ad: 'Simyacı', barkod: '9789750726439', bolmeId: d.raflar[0].bolmeler[0].id });
  const sonuc = Sube.eslestir(d, [['Barkod'], ['9789750726439']], { baslikSatiri: 0, barkod: 0, ad: -1, adet: -1 });
  const c = Sube.ciktiSatirlari(sonuc);
  assert.equal(c[0].join(','), 'Sıra,Raf,Barkod,Kitap adı,Durum');
  assert.equal(c[1][1], '1. Raf · Roman');
});
