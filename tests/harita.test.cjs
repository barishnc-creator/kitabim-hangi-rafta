const test = require('node:test');
const assert = require('node:assert/strict');
const Harita = require('../js/harita.js');
const Depo = require('../js/depo.js');

test('yol: kioskun bulunduğu taraftan rafa iki dik parça', () => {
  const raf = { x: 60, y: 10, w: 10, h: 40 };            // üstte, dikey raf
  assert.deepEqual(Harita.yol({ x: 50, y: 90 }, raf), [[50, 90], [50, 52.5], [65, 52.5]]); // alttan yaklaşır
  assert.deepEqual(Harita.yol({ x: 95, y: 30 }, raf), [[95, 30], [72.5, 30], [72.5, 30]]); // sağdan
  assert.equal(Harita.yol(null, raf), null);
  assert.equal(Harita.yol({ x: 1, y: 1 }, undefined), null);
});

test('plan doğrulama: sınırlar, bilinmeyen raflar ve türler ayıklanır', () => {
  const raflar = [{ id: 'r1' }, { id: 'r2' }];
  const p = Depo.planDuzelt({
    raflar: { r1: { x: 95, y: -5, w: 20, h: 30, tarif: 'Girişten sağa'.repeat(10) }, silinmis: { x: 1, y: 1, w: 5, h: 5 } },
    nesneler: [{ tur: 'kasa', x: 10, y: 10, w: 10, h: 10 }, { tur: 'bomba', x: 1, y: 1, w: 1, h: 1 }, null],
    kiosk: { x: 150, y: 50 }
  }, raflar);
  assert.deepEqual(Object.keys(p.raflar), ['r1']);
  assert.deepEqual([p.raflar.r1.x, p.raflar.r1.y, p.raflar.r1.w], [80, 0, 20]);
  assert.equal(p.raflar.r1.tarif.length, 80);
  assert.equal(p.nesneler.length, 1);
  assert.equal(p.nesneler[0].tur, 'kasa');
  assert.deepEqual(p.kiosk, { x: 100, y: 50 });
  assert.deepEqual(Depo.planDuzelt(null), { raflar: {}, nesneler: [], kiosk: null });
});

test('yerleştirilmemiş raflar ve harita varlığı', () => {
  const plan = { raflar: { r1: { x: 0, y: 0, w: 5, h: 5 } }, nesneler: [], kiosk: null };
  assert.deepEqual(Harita.yerlesmemis(plan, [{ id: 'r1' }, { id: 'r2' }]).map((r) => r.id), ['r2']);
  assert.equal(Harita.haritaVar(plan), true);
  assert.equal(Harita.haritaVar({ raflar: {} }), false);
  const html = Harita.ciz({ ...plan, kiosk: { x: 50, y: 90 } }, [{ id: 'r1', no: 1, etiket: '<b>x</b>' }], 'r1');
  assert.match(html, /raf-blok hedef/);
  assert.match(html, /polyline/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test('çakışma uyarısı: üst üste binen raflar bulunur, yan yana olanlar değil', () => {
  const raflar = [{ id: 'r1', no: 1 }, { id: 'r2', no: 2 }, { id: 'r3', no: 3 }];
  const plan = { raflar: { r1: { x: 0, y: 0, w: 20, h: 10 }, r2: { x: 20, y: 0, w: 20, h: 10 }, r3: { x: 30, y: 5, w: 10, h: 10 } }, nesneler: [{ tur: 'kasa', x: 80, y: 80, w: 10, h: 10 }], kiosk: null };
  assert.deepEqual(Harita.cakismalar(plan, raflar), [{ a: '2. Raf', b: '3. Raf' }]);
});
