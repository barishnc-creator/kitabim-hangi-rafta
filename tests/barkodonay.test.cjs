const test = require('node:test');
const assert = require('node:assert/strict');
const { Onay, kontrolHanesi, isbnMi } = require('../js/barkodonay.js');

test('kontrol hanesi', () => {
  assert.equal(kontrolHanesi('9789944886666'), true);
  assert.equal(kontrolHanesi('9789944886667'), false);
  assert.equal(kontrolHanesi('0718974886666'), true); // bulanık fotoğrafta okunan yanlış ama geçerli sayı
  assert.equal(kontrolHanesi('96385074'), true);       // EAN-8
  assert.equal(kontrolHanesi('036000291452'), true);   // UPC-A
});

test('ISBN tanıma', () => {
  assert.equal(isbnMi('9789944886666'), true);
  assert.equal(isbnMi('0718974886666'), false);
  assert.equal(isbnMi('9789944886667'), false);
});

test('çizgili barkod iki aynı okumada kabul edilir', () => {
  const o = new Onay();
  assert.equal(o.ekle('9789944886666', 'ean_13'), '');
  assert.equal(o.ekle('0718974886666', 'ean_13'), '');
  assert.equal(o.ekle('9789944886666', 'ean_13'), '9789944886666');
});

test('QR ilk okumada kabul edilir', () => {
  assert.equal(new Onay().ekle('https://ornek/?bolme=b1', 'qr_code'), 'https://ornek/?bolme=b1');
});

test('kontrol hanesi tutmayan ya da boyu yanlış EAN reddedilir', () => {
  const o = new Onay(1);
  assert.equal(o.ekle('9789944886667', 'ean_13'), '');
  assert.equal(o.ekle('978994488666', 'ean_13'), '');
  assert.equal(o.ekle('', 'ean_13'), '');
});

test('tek aday yalnız geçerli ISBN ise kabul edilir', () => {
  const a = new Onay(); a.ekle('9789944886666', 'ean_13');
  assert.equal(a.tekAday(), '9789944886666');
  const b = new Onay(); b.ekle('0718974886666', 'ean_13');
  assert.equal(b.tekAday(), '');
  const c = new Onay(); c.ekle('9789944886666', 'ean_13'); c.ekle('9789750719387', 'ean_13');
  assert.equal(c.tekAday(), '');
});
