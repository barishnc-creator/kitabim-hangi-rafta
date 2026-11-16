const test = require('node:test');
const assert = require('node:assert/strict');
const Arama = require('../js/arama.js');

const kitaplar = [
  { id: 'm7', ad: '7. Sınıf Matematik Soru Bankası', yazar: 'Örnek Yazar' },
  { id: 'm8', ad: '8. Sınıf Matematik Soru Bankası', yazar: 'Örnek Yazar' },
  { id: 'f7', ad: '7. Sınıf Fen Bilimleri Konu Anlatımı', yazar: 'Örnek Yazar' },
  { id: 't7', ad: '7. Sınıf Türkçe Soru Bankası', yazar: 'Örnek Yazar' },
  { id: 'i7', ad: '7. Sınıf İngilizce Workbook', yazar: 'Örnek Yazar' },
  { id: 'kmm', ad: 'Kürk Mantolu Madonna', yazar: 'Sabahattin Ali' },
  { id: 'kp', ad: 'Küçük Prens', yazar: 'Antoine de Saint-Exupéry' }
];

test('satır temizleme: numara, madde işareti ve yazar ayrılır', () => {
  assert.deepEqual(Arama.satirCoz('3- Kürk Mantolu Madonna - Sabahattin Ali'), { metin: 'Kürk Mantolu Madonna - Sabahattin Ali', ad: 'Kürk Mantolu Madonna', yazar: 'Sabahattin Ali' });
  assert.equal(Arama.satirCoz('12) Küçük Prens').ad, 'Küçük Prens');
  assert.equal(Arama.satirCoz('• Küçük Prens').ad, 'Küçük Prens');
  assert.equal(Arama.satirCoz('a. Küçük Prens').ad, 'Küçük Prens');
  assert.equal(Arama.satirCoz('7. Sınıf Matematik').ad, '7. Sınıf Matematik'); // "7." numara değil
  assert.equal(Arama.satirCoz('2- 7. Sınıf Matematik').ad, '7. Sınıf Matematik');
});

test('okul listesi eşleşmesi: yazım hatası düzeltilir, sınıf karışmaz, olmayan kitap boş kalır', () => {
  const liste = [
    '1- 7. Sınıf Matematik Soru Bankası',
    '2- 7. sinif turkce soru bankasi',
    '3- İngilizce Workbook 7. sınıf',
    '4- Kurk Mantolu Madona - Sabahattin Ali',
    '5- Küçük Prens',
    '6- Sefiller (çocuk klasikleri)',
    '',
    '7- 8. Sınıf Matematik Soru Bankası'
  ].join('\n');
  const s = Arama.listeyiCoz(kitaplar, liste);
  assert.deepEqual(s.map((x) => x.kitapId), ['m7', 't7', 'i7', 'kmm', 'kp', null, 'm8']);
  assert.deepEqual(Arama.listeyiCoz(kitaplar, '8. Sınıf Matematik Soru Bankası\n7. Sınıf Matematik Soru Bankası').map((x) => x.kitapId), ['m8', 'm7']);
  assert.equal(s[0].duzeltildi, false);
  assert.equal(s[1].duzeltildi, true);
  assert.equal(s[3].duzeltildi, true);
});

test('benzerlik: farklı sınıf numarası cezalandırılır', () => {
  assert.ok(Arama.benzerlik('7. Sınıf Matematik', '7. sinif matematik') > 0.95);
  assert.ok(Arama.benzerlik('7. Sınıf Matematik', '8. Sınıf Matematik') < 0.6);
  assert.equal(Arama.benzerlik('', 'x'), 0);
});

test('öneriler: hatalı yazılan aramaya doğru kitap önerilir', () => {
  assert.equal(Arama.oneriler(kitaplar, 'kurk mantolu')[0].id, 'kmm');
  assert.equal(Arama.oneriler(kitaplar, 'sabahatin ali')[0].id, 'kmm');
  assert.equal(Arama.oneriler(kitaplar, 'kucuk prns')[0].id, 'kp');
  assert.deepEqual(Arama.oneriler(kitaplar, 'zzqqxx'), []);
  assert.deepEqual(Arama.oneriler(kitaplar, 'ab'), []);
});
