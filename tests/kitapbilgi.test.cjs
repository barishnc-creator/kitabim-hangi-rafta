const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/kitapbilgi.js');

test('ISBN kontrol hanesi doğrulanır', () => {
  assert.equal(K.isbnMi('9780306406157'), true);
  assert.equal(K.isbnMi('978-0-306-40615-7'), true);
  assert.equal(K.isbnMi('9780306406158'), false); // yanlış kontrol hanesi
  assert.equal(K.isbnMi('0306406152'), true); // ISBN-10
  assert.equal(K.isbnMi('080442957X'), true);
  assert.equal(K.isbnMi('8690000000001'), false); // kitap olmayan ürün barkodu
  assert.equal(K.isbnMi(''), false);
});

test('Google Kitaplar yanıtı çözülür', () => {
  const json = { totalItems: 1, items: [{ volumeInfo: { title: 'Kürk Mantolu Madonna', authors: ['Sabahattin Ali'], publisher: 'Yapı Kredi Yayınları' } }] };
  assert.deepEqual(K.googleCozumle(json), { ad: 'Kürk Mantolu Madonna', yazar: 'Sabahattin Ali', yayinevi: 'Yapı Kredi Yayınları' });
  assert.deepEqual(K.googleCozumle({ items: [{ volumeInfo: { title: 'A', subtitle: 'B', authors: ['X', 'Y'] } }] }), { ad: 'A: B', yazar: 'X, Y', yayinevi: '' });
  assert.equal(K.googleCozumle({ totalItems: 0 }), null);
  assert.equal(K.googleCozumle(null), null);
  assert.equal(K.googleCozumle({ error: { code: 429 } }), null);
});

test('Open Library yanıtı çözülür ve eksikler birleştirilir', () => {
  const json = { 'ISBN:9780306406157': { title: 'Kitap', authors: [{ name: 'Yazar A' }], publishers: [{ name: 'Yayınevi B' }] } };
  const ol = K.openLibraryCozumle(json, '9780306406157');
  assert.deepEqual(ol, { ad: 'Kitap', yazar: 'Yazar A', yayinevi: 'Yayınevi B' });
  assert.equal(K.openLibraryCozumle({}, '9780306406157'), null);
  assert.deepEqual(K.birlestir({ ad: 'G', yazar: 'GY', yayinevi: '' }, ol), { ad: 'G', yazar: 'GY', yayinevi: 'Yayınevi B' });
  assert.deepEqual(K.birlestir(null, ol), ol);
  assert.equal(K.birlestir(null, null), null);
});

test('ISBN olmayan barkod için internete gidilmez', async () => {
  global.fetch = () => { throw new Error('çağrılmamalıydı'); };
  assert.equal(await K.bul('8690000000001'), null);
});

test('Google bulamazsa Open Library denenir; ağ hatası null döner', async () => {
  const cagrilar = [];
  global.fetch = (url) => {
    cagrilar.push(url);
    if (url.includes('googleapis')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ totalItems: 0 }) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ 'ISBN:9780306406157': { title: 'OL Kitap', authors: [{ name: 'Z' }], publishers: [{ name: 'P' }] } }) });
  };
  assert.deepEqual(await K.bul('9780306406157'), { ad: 'OL Kitap', yazar: 'Z', yayinevi: 'P' });
  assert.equal(cagrilar.length, 2);
  assert.equal(K.baglantiYok, false);
  global.fetch = () => Promise.reject(new Error('ağ yok'));
  assert.equal(await K.bul('9780306406157'), null);
  assert.equal(K.baglantiYok, true);
});
