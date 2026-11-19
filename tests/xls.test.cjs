const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Xls = require('../js/xls.js');

const veri = (ad) => fs.readFileSync(path.join(__dirname, 'veri', ad));

test('Xls: xlwt dosyası (sayı barkod, CONTINUE\'a taşan Türkçe metin tablosu, formül, mantıksal)', async () => {
  const r = await Xls.oku(veri('xlwt-ornek.xls'));
  assert.equal(r.sayfa, 'Ürünler'); // ilk sayfa okunur
  assert.equal(r.satirlar.length, 302);
  assert.deepEqual(r.satirlar[0], ['BARKOD', 'ÜRÜN ADI', 'MİKTAR', 'FİYAT', 'TOPLAM', 'AKTİF']);
  assert.deepEqual(r.satirlar[1].slice(0, 4), ['9786050000007', 'ŞİİR VE ÖYKÜ ĞÜÇ KİTABI NO 1 — ıİşŞçÇ x', '2', '13.5']);
  // Metin tablosu 4 CONTINUE kaydına bölünmüş; sondaki metinler de bozulmadan gelmeli
  assert.equal(r.satirlar[300][1], 'ŞİİR VE ÖYKÜ ĞÜÇ KİTABI NO 300 — ıİşŞçÇ ');
  assert.equal(r.satirlar[300][0], '9786050002100'); // barkod bilimsel gösterime dönmez
  assert.equal(r.satirlar[300][5], 'DOĞRU');
  assert.deepEqual(r.satirlar[301], ['', 'Son satır']);
  r.satirlar.slice(1, 301).forEach((s, i) => assert.equal(s[1].startsWith('ŞİİR VE ÖYKÜ ĞÜÇ KİTABI NO ' + (i + 1) + ' '), true));
});

test('Xls: LibreOffice dosyası (küçük dosya / mini akış, kaydedilmiş formül sonucu)', async () => {
  const r = await Xls.oku(veri('libreoffice-ornek.xls'));
  assert.equal(r.sayfa, 'Giriş');
  assert.deepEqual(r.satirlar[0], ['BARCODE', 'MALINCINSI', 'KOD3', 'MIKTAR', 'NOT']);
  assert.deepEqual(r.satirlar[1].slice(0, 4), ['9789750701689', 'VANİLYA KOKULU MEKTUPLAR', 'CANYAYINLARI', '5']);
  assert.deepEqual(r.satirlar[2].slice(0, 4), ['9786051000145', 'AHMET HAŞİM / BİZE GÖRE', 'KÜLTÜR KİTABI', '10']); // =D2*2
  assert.deepEqual(r.satirlar[3].slice(0, 4), ['9786259506586', 'KINALI SERÇE', '', '1.5']);
});

test('Xls: .xls olmayan dosya anlaşılır hata verir', async () => {
  assert.equal(Xls.xlsMi(veri('openpyxl-ornek.xlsx')), false);
  assert.equal(Xls.xlsMi(veri('xlwt-ornek.xls')), true);
  await assert.rejects(Xls.oku(veri('openpyxl-ornek.xlsx')), /Excel \(\.xls\) dosyası değil/);
});

test('Xls: sayı yazımı ve RK sayıları', () => {
  assert.equal(Xls.sayiMetni(9786051000145), '9786051000145');
  assert.equal(Xls.sayiMetni(15701114048267666), '15701114048267666');
  assert.equal(Xls.sayiMetni(12.5), '12.5');
  assert.equal(Xls.sayiMetni(0.1 + 0.2), '0.3');
  assert.equal(Xls.rkSayi((5 << 2) | 2), 5);        // tam sayı
  assert.equal(Xls.rkSayi((1234 << 2) | 3), 12.34); // tam sayı / 100
  assert.equal(Xls.rkSayi(((-7 << 2) | 2) >>> 0), -7);
});
