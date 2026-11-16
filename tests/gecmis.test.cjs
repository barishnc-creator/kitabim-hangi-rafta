const test = require('node:test');
const assert = require('node:assert/strict');
const Depo = require('../js/depo.js');
const Gecmis = require('../js/gecmis.js');

test('kitap olayları: ekleme, taşıma, güncelleme, silme', () => {
  const d = Depo.bos();
  const r = Depo.rafEkle(d, '', 2);
  const k = Depo.kitapKaydet(d, { ad: 'Simyacı', bolmeId: r.bolmeler[0].id, fiyat: 100 });
  assert.deepEqual(Gecmis.kitapOlayi(d, null, k), { islem: 'ekledi', konu: 'kitap', ayrinti: '“Simyacı” → 1.1' });
  const tasinan = Object.assign({}, k, { bolmeId: r.bolmeler[1].id });
  assert.deepEqual(Gecmis.kitapOlayi(d, k, tasinan), { islem: 'tasidi', konu: 'kitap', ayrinti: '“Simyacı” 1.1 → 1.2' });
  assert.deepEqual(Gecmis.kitapOlayi(d, k, Object.assign({}, k, { fiyat: 120, stok: 3 })), { islem: 'guncelledi', konu: 'kitap', ayrinti: '“Simyacı” (fiyat, stok)' });
  assert.equal(Gecmis.kitapOlayi(d, k, Object.assign({}, k)), null);
  assert.deepEqual(Gecmis.kitapOlayi(d, k, null), { islem: 'sildi', konu: 'kitap', ayrinti: '“Simyacı” (1.1)' });
});
