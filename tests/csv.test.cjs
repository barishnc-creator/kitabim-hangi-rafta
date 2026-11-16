const test = require('node:test');
const assert = require('node:assert/strict');
const Depo = require('../js/depo.js');
const Arama = require('../js/arama.js');
const Csv = require('../js/csv.js');

function ornek() {
  const d = Depo.bos();
  Depo.rafEkle(d, 'Okul', 3);
  Depo.rafEkle(d, 'Test', 4);
  return d;
}

test('CSV okuma: ; ve , ayırıcı, tırnak, BOM, boş satır', () => {
  assert.deepEqual(Csv.oku('﻿a;b;c\r\n1;"x;y";3\r\n\r\n'), [['a', 'b', 'c'], ['1', 'x;y', '3']]);
  assert.deepEqual(Csv.oku('a,b\n"söz ""alıntı""",2'), [['a', 'b'], ['söz "alıntı"', '2']]);
  assert.deepEqual(Csv.oku('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(Csv.oku('a;b\n"iki\nsatır";2'), [['a', 'b'], ['iki\nsatır', '2']]);
});

test('CSV yazma Excel uyumlu ve formül enjeksiyonuna kapalı', () => {
  const metin = Csv.yaz([['a;b', 'x"y', '=1+1', '-5', '12,5']]);
  assert.equal(metin, '﻿"a;b";"x""y";\'=1+1;-5;12,5\r\n');
  assert.deepEqual(Csv.oku(metin), [['a;b', 'x"y', "'=1+1", '-5', '12,5']]);
});

test('Dışa aktarılan liste geri içe aktarılabilir', () => {
  const d = ornek();
  const b = Depo.bolmeBul(d, '2.3').bolme.id;
  Depo.kitapKaydet(d, { ad: 'Kürk Mantolu Madonna', yazar: 'Sabahattin Ali', yayinevi: 'YKY', barkod: '9789753638029', bolmeId: b, fiyat: '125,5', stok: '3' });
  const satirlar = Csv.oku(Csv.yaz(Csv.kitaplariSatirla(d)));
  assert.deepEqual(satirlar[1], ['Kürk Mantolu Madonna', 'Sabahattin Ali', 'YKY', '9789753638029', '2.3', '125,5', '3']);
  const bos = ornek();
  const h = Csv.iceAktarHazirla(bos, satirlar);
  assert.equal(h.kitaplar.length, 1);
  assert.equal(h.kitaplar[0].bolmeId, Depo.bolmeBul(bos, '2.3').bolme.id);
});

test('İçe aktarma: sütun sırası serbest, hatalı satırlar raporlanır, aynı barkod atlanır', () => {
  const d = ornek();
  Depo.kitapKaydet(d, { ad: 'Var olan', barkod: '111', bolmeId: Depo.bolmeBul(d, '1.1').bolme.id });
  const satirlar = Csv.oku([
    'Raf;KİTAP ADI;ISBN;Fiyat',
    '1.2;Atlas;222;99 TL',
    '9.9;Yanlış raf;;',
    '1.1;;333;',
    '2-4;Sözlük;;₺ 45,90',
    '1.1;Tekrar;111;',
    '1.3;Bozuk fiyat;;abc'
  ].join('\n'));
  const h = Csv.iceAktarHazirla(d, satirlar);
  assert.deepEqual(h.kitaplar.map((k) => k.ad), ['Atlas', 'Sözlük']);
  assert.equal(h.kitaplar[1].fiyat, '45,90');
  assert.equal(h.atlanan, 1);
  assert.deepEqual(h.hatalar.map((x) => x.satir), [3, 4, 7]);
  assert.equal(d.kitaplar.length, 1, 'hazırlık veriyi değiştirmemeli');
});

test('İçe aktarma: başlıksız ya da boş dosya', () => {
  const d = ornek();
  assert.match(Csv.iceAktarHazirla(d, []).hatalar[0].mesaj, /boş/);
  assert.match(Csv.iceAktarHazirla(d, [['x', 'y']]).hatalar[0].mesaj, /Kitap adı/);
  assert.match(Csv.iceAktarHazirla(d, [['Kitap adı', 'Yazar']]).hatalar[0].mesaj, /Raf/);
});

test('bölme kodu bulma ve kapak adresi güvenliği', () => {
  const d = ornek();
  assert.equal(Depo.bolmeBul(d, ' 2 . 4 ').kod, '2.4');
  assert.equal(Depo.bolmeBul(d, '2/1').kod, '2.1');
  assert.equal(Depo.bolmeBul(d, '3.1'), null);
  assert.equal(Depo.bolmeBul(d, 'abc'), null);
  assert.equal(Depo.kapakAdresi('http://books.google.com/x?id=1'), 'https://books.google.com/x?id=1');
  assert.equal(Depo.kapakAdresi('javascript:alert(1)'), '');
  assert.equal(Depo.kapakAdresi('https://a.com/"onerror="x'), '');
});

test('kitap eklenme tarihi korunur, mağaza adı yedekten okunur', () => {
  const d = ornek();
  const b = Depo.bolmeBul(d, '1.1').bolme.id;
  const k = Depo.kitapKaydet(d, { ad: 'A', bolmeId: b, eklendi: '2026-01-01T00:00:00.000Z' });
  const g = Depo.kitapKaydet(d, Object.assign({}, k, { ad: 'A2', eklendi: undefined }));
  assert.equal(g.eklendi, '2026-01-01T00:00:00.000Z');
  assert.equal(Depo.duzelt({ ayarlar: { magazaAdi: 'Deniz Kırtasiye' } }).ayarlar.magazaAdi, 'Deniz Kırtasiye');
});

test('arama özeti: en çok arananlar ve bulunamayanlar', () => {
  const kayit = (sorgu, sonuc, zaman) => ({ sorgu, sonuc, zaman });
  const o = Arama.ozet([
    kayit('Matematik', 3, '1'), kayit('matematik ', 2, '2'), kayit('MATEMATİK', 1, '3'),
    kayit('Harry Potter', 0, '4'), kayit('harry potter', 0, '5'),
    kayit('Atlas', 1, '6'), kayit('x', 0, '7')
  ]);
  assert.equal(o.toplam, 7);
  assert.deepEqual(o.enCok.map((g) => [g.sorgu, g.sayi]), [['MATEMATİK', 3], ['Atlas', 1]]);
  assert.deepEqual(o.bulunamayan.map((g) => [g.sorgu, g.bulunamayan]), [['harry potter', 2]]);
});
