const test = require('node:test');
const assert = require('node:assert/strict');
const Tema = require('../js/tema.js');
const Depo = require('../js/depo.js');

test('renk tonları ve okunurluk düzeltmesi', () => {
  const t = Tema.renkler('#1D4ED8');
  assert.equal(t.ana, '#1D4ED8');
  assert.equal(t.duzeltildi, false);
  assert.ok(Tema.kontrast(t.ana, '#FFFFFF') >= 4.5);
  const sari = Tema.renkler('#FACC15'); // beyaz yazı okunmaz → koyulaştırılır
  assert.equal(sari.duzeltildi, true);
  assert.ok(Tema.kontrast(sari.ana, '#FFFFFF') >= 4.5);
  assert.equal(Tema.renkler('bozuk').ana, '#1D4ED8');
  assert.ok(Tema.kontrast('#000000', '#FFFFFF') > 20);
});

test('renk ve logo doğrulama', () => {
  assert.equal(Tema.renkGecerli('#0f766e'), true);
  assert.equal(Tema.renkGecerli('red'), false);
  assert.equal(Tema.logoGecerli('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(Tema.logoGecerli('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(Tema.logoGecerli('https://x.com/a.png'), false);
  assert.equal(Tema.logoGecerli('data:image/png;base64,' + 'A'.repeat(300000)), false);
});

test('ayarlar yedekten okunurken görünüm alanları süzülür', () => {
  const d = Depo.duzelt({ ayarlar: { renk: '#0F766E', logo: 'javascript:alert(1)', karsilama: 'Merhaba'.repeat(30) } });
  assert.equal(d.ayarlar.renk, '#0F766E');
  assert.equal(d.ayarlar.logo, '');
  assert.equal(d.ayarlar.karsilama.length, 80);
  assert.equal(Depo.duzelt({ ayarlar: { renk: 'kirmizi' } }).ayarlar.renk, '');
});
