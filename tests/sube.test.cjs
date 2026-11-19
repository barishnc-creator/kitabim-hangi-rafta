const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Depo = require('../js/depo.js');
const Sube = require('../js/sube.js');
const Xlsx = require('../js/xlsx.js');

function magaza() {
  const d = Depo.bos();
  const r1 = Depo.rafEkle(d, 'Okul', 2);
  const r3 = Depo.rafEkle(d, 'Roman', 2);
  Depo.kitapKaydet(d, { ad: 'Kürk Mantolu Madonna', barkod: '9789750719387', bolmeId: r3.bolmeler[0].id });
  Depo.kitapKaydet(d, { ad: 'Penguin Klasik', barkod: '9780140449136', bolmeId: r3.bolmeler[1].id });
  Depo.kitapKaydet(d, { ad: '7. Sınıf Matematik', barkod: '9786050000018', bolmeId: r1.bolmeler[1].id });
  Depo.kitapKaydet(d, { ad: 'Atlas', barkod: '8690000000017', bolmeId: r1.bolmeler[0].id });
  return d;
}

test('Barkod anahtarı: tire/boşluk silinir, ISBN-10 ISBN-13’e çevrilir', () => {
  assert.equal(Sube.barkodAnahtar('978-975-07-1938-7'), '9789750719387');
  assert.equal(Sube.barkodAnahtar('0140449132'), '9780140449136');
  assert.equal(Sube.barkodAnahtar(' 8690000000017 '), '8690000000017');
});

test('Sütunlar: başlık satırı üstte açıklama olsa da bulunur', () => {
  const s = Sube.sutunlariBul([['Şube: Kadıköy'], [], ['Sıra', 'Barkod', 'Kitap Adı', 'Eksik Adet']]);
  assert.deepEqual([s.baslikSatiri, s.barkod, s.ad], [2, 1, 2]);
  assert.equal(s.adet, undefined, 'adet sütunu okunmaz');
});

test('Sütunlar: başlık yoksa barkod sütunu içerikten seçilir', () => {
  const s = Sube.sutunlariBul([['Kürk', '9789750719387', '2'], ['Atlas', '8690000000017', '1']]);
  assert.equal(s.baslikSatiri, -1);
  assert.equal(s.barkod, 1);
});

test('Sütunlar: başlıkta “barkod” yazmasa da barkodların üstündeki satır başlık sayılır', () => {
  const s = Sube.sutunlariBul([['Ürün', 'Kod', 'Miktar'], ['Kürk', '9789750719387', '2'], ['Atlas', '8690000000017', '1']]);
  assert.deepEqual([s.baslikSatiri, s.barkod, s.ad], [0, 1, 0]);
});

test('Eşleştirme: raf ve bölme bulunur, toplama sırasına dizilir, durumlar doğru', () => {
  const d = magaza();
  const satirlar = [
    ['Barkod', 'Ad', 'Adet'],
    ['9789750719387', 'Kürk', '2'],
    ['0140449132', 'Penguin', '3'],
    ['9786050000018', 'Matematik', '1'],
    ['9786059999999', 'Bilinmeyen kitap', '4'],
    ['8690000000017', 'Atlas', ''],
    ['978-975-07-1938-7', 'Kürk tekrar', '1'],
    ['yok', 'geçersiz', '1']
  ];
  const sonuc = Sube.eslestir(d, satirlar, Sube.sutunlariBul(satirlar));
  assert.deepEqual(sonuc.kalemler.map((k) => [k.yer ? k.yer.kod : '-', k.durum]), [
    ['1.1', 'var'],
    ['1.2', 'var'],
    ['2.1', 'var'],      // Kürk: aynı barkod iki kez → tek kalem
    ['2.2', 'var'],      // Penguin: ISBN-10 ile eşleşti
    ['-', 'kayitsiz']
  ]);
  assert.ok(sonuc.kalemler.every((k) => k.adet === undefined), 'adet tutulmaz');
  assert.equal(sonuc.atlanan, 1);
  assert.deepEqual(sonuc.ozet, { kalem: 5, var: 4, kayitsiz: 1 });
});

test('Excel çıktısı: başlık + satırlar, barkod metin olarak kalır', async () => {
  const d = magaza();
  const satirlar = [['Barkod', 'Adet'], ['9789750719387', '2'], ['9786059999999', '1']];
  const cikti = Sube.ciktiSatirlari(Sube.eslestir(d, satirlar, Sube.sutunlariBul(satirlar)));
  assert.deepEqual(cikti[0], ['Sıra', 'Raf', 'Bölme', 'Barkod', 'Kitap adı', 'Durum']);
  assert.deepEqual(cikti[1], [1, '2. Raf · Roman', '2.1', '9789750719387', 'Kürk Mantolu Madonna', 'Mağazada var']);
  assert.equal(cikti[2][5], 'Kayıtlı değil');
  const geri = await Xlsx.oku(Xlsx.yaz(cikti, { kalinBaslik: true }));
  assert.equal(geri.satirlar[1][3], '9789750719387');
});

test('Xlsx: openpyxl ve LibreOffice ile yapılmış dosyalar okunur', async () => {
  const a = await Xlsx.oku(fs.readFileSync(path.join(__dirname, 'veri/openpyxl-ornek.xlsx')));
  assert.equal(a.sayfa, 'Eksikler');
  assert.deepEqual(a.satirlar[2], ['Barkod', 'Kitap Adı', 'Adet']);
  assert.deepEqual(a.satirlar[3], ['9789750719387', 'Kürk Mantolu Madonna', '3']);
  assert.deepEqual(a.satirlar[4], ['978-975-07-3364-7', 'Simyacı & "Can"', '1']);
  assert.equal(a.satirlar[9][4], 'uzak hücre');
  const b = await Xlsx.oku(fs.readFileSync(path.join(__dirname, 'veri/libreoffice-ornek.xlsx')));
  assert.deepEqual(b.satirlar, [['Barkod', 'Ürün Adı', 'Eksik Adet'], ['9789750719387', 'Kürk Mantolu Madonna', '2'], ['0140449132', 'Penguin', '1']]);
});

test('Xlsx: yazılan dosya geri okunur, özel karakterler korunur; eski .xls açık hata verir', async () => {
  const bayt = Xlsx.yaz([['A', 'B'], ['<&>"\'', 3.5], ['ç ğ ı ö ş ü', null]], { sayfa: 'Liste/1' });
  const r = await Xlsx.oku(bayt);
  assert.equal(r.sayfa, 'Liste 1');
  assert.deepEqual(r.satirlar, [['A', 'B'], ['<&>"\'', '3.5'], ['ç ğ ı ö ş ü']]);
  await assert.rejects(Xlsx.oku(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0, 0])), /xls/);
  await assert.rejects(Xlsx.oku(new TextEncoder().encode('düz metin')), /Excel/);
});

test('sütunlar: muhasebe programlarının büyük harfli Türkçesiz başlıkları (MIKTAR, MALINCINSI)', () => {
  const s = Sube.sutunlariBul([['BARCODE', 'MALINCINSI', 'KOD3', 'MIKTAR'], ['9789750701689', 'VANİLYA KOKULU MEKTUPLAR', 'CANYAYINLARI', '5']]);
  assert.equal(s.barkod, 0);
  assert.equal(s.ad, 1, 'MALINCINSI kitap adı sütunu olmalı');
  const t = Sube.sutunlariBul([['STOK KODU', 'STOK ADI', 'ADET'], ['9789750701689', 'X', '2']]);
  assert.equal(t.ad, 1);
});

test('eşleştirme: mağazada olan ama rafa yerleştirilmemiş kitap kayıtsız sayılmaz, onlardan önce gelir', () => {
  const d = magaza();
  Depo.kitapKaydet(d, { ad: 'Yeni Gelen', barkod: '9789750701689' }, { rafsizOlabilir: true });
  const satirlar = [['Barkod', 'Adet'], ['9780000000002', '1'], ['9789750701689', '1'], ['9789750719387', '1']];
  const s = Sube.eslestir(d, satirlar, Sube.sutunlariBul(satirlar));
  assert.deepEqual(s.kalemler.map((k) => [k.barkod, k.durum, !!k.yer, !!k.kitap]), [
    ['9789750719387', 'var', true, true],
    ['9789750701689', 'var', false, true], // rafsız ama mağazada
    ['9780000000002', 'kayitsiz', false, false],
  ]);
});
