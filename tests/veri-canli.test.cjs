// Başka cihazdan gelen değişiklikler (Supabase realtime): kitap değişikliği listeyi yeniden indirmeden uygulanmalı.
// On binlerce kitapta her değişiklikte tam indirme ücretsiz kotayı birkaç günde bitirir.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function kur(tablolar) {
  const istekler = [];
  let olay = null, abonelik = null;
  function sorgu(tablo) {
    const z = {
      select: () => z, order: () => z, eq: () => z,
      range: () => { istekler.push(tablo); return Promise.resolve({ data: tablolar[tablo] || [], error: null }); },
      maybeSingle: () => Promise.resolve({ data: tablolar[tablo] || null, error: null }),
    };
    return z;
  }
  const kanal = { on: (_t, _f, cb) => { olay = cb; return kanal; }, subscribe: (cb) => { abonelik = cb; return kanal; } };
  const depo = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const window = {
    AYAR: { supabaseUrl: 'https://ornek.supabase.co', supabaseKey: 'sb_publishable_test' },
    location: { search: '' }, navigator: { onLine: true }, addEventListener: () => {},
    localStorage: depo(), sessionStorage: depo(),
    supabase: { createClient: () => ({ from: sorgu, channel: () => kanal, auth: {} }) },
  };
  const baglam = vm.createContext({ window, Depo: require('../js/depo.js'), setTimeout, clearTimeout, Promise, Set });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/veri.js'), 'utf8'), baglam);
  return { Veri: window.Veri, istekler, olay: (p) => olay(p), abonelik: (d) => abonelik(d) };
}
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const KITAP = (id, ad, bolme) => ({ id, ad, yazar: '', yayinevi: '', barkod: id, bolme_id: bolme, fiyat: null, kapak: '', eklendi: '2026-11-21T10:00:00Z' });

test('realtime: kitap değişikliği yerinde uygulanır, kitap listesi yeniden indirilmez', async () => {
  const t = kur({
    kirtasiye_raflar: [{ id: 'r1', no: 1, etiket: '' }], kirtasiye_bolmeler: [{ id: 'b1', raf_id: 'r1', no: 1 }],
    kirtasiye_kitaplar: [KITAP('k1', 'Bir', null), KITAP('k2', 'İki', null), KITAP('k3', 'Üç', null)],
    kirtasiye_okul_listeleri: [], kirtasiye_ayarlar: { fiyat: true, magaza_adi: 'T', plan: {} },
  });
  const gelen = [];
  t.Veri.dinle((d) => gelen.push(d));
  await t.Veri.yukle();
  t.abonelik('SUBSCRIBED');
  const ilk = t.istekler.filter((x) => x === 'kirtasiye_kitaplar').length;
  assert.equal(ilk, 1);

  t.olay({ table: 'kirtasiye_kitaplar', eventType: 'UPDATE', new: KITAP('k1', 'Bir', 'b1') });
  t.olay({ table: 'kirtasiye_kitaplar', eventType: 'INSERT', new: KITAP('k4', 'Dört', null) });
  t.olay({ table: 'kirtasiye_kitaplar', eventType: 'DELETE', old: { id: 'k2' } });
  await bekle(400);
  const son = gelen[gelen.length - 1];
  assert.equal(son.kitaplar.map((k) => k.id).sort().join(','), 'k1,k3,k4');
  assert.equal(son.kitaplar.find((k) => k.id === 'k1').bolmeId, 'b1');
  assert.equal(gelen.length, 1, 'üç olay tek çizimde toplanmalı');
  assert.equal(t.istekler.filter((x) => x === 'kirtasiye_kitaplar').length, 1, 'kitaplar yeniden indirilmemeli');

  // Raf değişikliği: küçük tablolar okunur, kitaplar yine indirilmez
  t.olay({ table: 'kirtasiye_raflar', eventType: 'UPDATE', new: { id: 'r1' } });
  await bekle(400);
  assert.ok(t.istekler.filter((x) => x === 'kirtasiye_raflar').length >= 2);
  assert.equal(t.istekler.filter((x) => x === 'kirtasiye_kitaplar').length, 1);
  assert.equal(gelen[gelen.length - 1].kitaplar.length, 3);

  // Bağlantı koptu ve geri geldi: kaçan olaylar için bir kez tam yükleme
  t.abonelik('SUBSCRIBED');
  await bekle(50);
  assert.equal(t.istekler.filter((x) => x === 'kirtasiye_kitaplar').length, 2);
});
