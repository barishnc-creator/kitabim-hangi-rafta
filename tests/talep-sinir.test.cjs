// Bulut modunda talep bırakma ve yönetici bildirimleri (supabase/guvenlik-2026-11-19.sql).
// Veritabanı güncellenmeden önce de (fonksiyon/tablo yok) çalışmalı.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Sahte supabase-js: her sorgu zinciri yapılan çağrıları kaydeder ve verilen sonucu döndürür.
function sahteSupabase(cevap) {
  const cagrilar = [];
  function zincir(kayit) {
    const z = {};
    ['select', 'insert', 'update', 'eq', 'order', 'limit'].forEach((ad) => {
      z[ad] = (...a) => { kayit.push([ad, ...a]); return z; };
    });
    z.then = (ok, hata) => Promise.resolve(cevap(kayit)).then(ok, hata);
    return z;
  }
  const kanal = { on: () => kanal, subscribe: () => kanal };
  const sb = {
    channel: () => kanal,
    from: (tablo) => { const k = [['from', tablo]]; cagrilar.push(k); return zincir(k); },
    rpc: (ad, arg) => { const k = [['rpc', ad, arg]]; cagrilar.push(k); return zincir(k); }
  };
  return { sb, cagrilar };
}

function veriYukle(cevap) {
  const { sb, cagrilar } = sahteSupabase(cevap);
  const depo = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const window = {
    AYAR: { supabaseUrl: 'https://ornek.supabase.co', supabaseKey: 'sb_publishable_test' },
    location: { search: '' }, navigator: { onLine: true }, addEventListener: () => {},
    localStorage: depo, sessionStorage: depo,
    supabase: { createClient: () => sb }
  };
  const baglam = vm.createContext({ window, Depo: require('../js/depo.js') });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/veri.js'), 'utf8'), baglam);
  return { Veri: window.Veri, cagrilar };
}

const TALEP = { kitap: 'Kınalı Serçe', ad: 'Ayşe', telefon: '0532 111 22 33', onay: true };

test('talep fonksiyonla bırakılır, kaydedildiyse talep döner', async () => {
  const { Veri, cagrilar } = veriYukle(() => ({ data: true, error: null }));
  const t = await Veri.talepEkle(TALEP);
  assert.equal(t.telefon, '05321112233');
  assert.deepEqual(cagrilar.map((k) => k[0][0]), ['rpc']);
  const [, ad, arg] = cagrilar[0][0];
  assert.equal(ad, 'kirtasiye_talep_birak');
  assert.deepEqual(JSON.parse(JSON.stringify(arg)), { p_kitap: 'Kınalı Serçe', p_kitap_id: null, p_ad: 'Ayşe', p_telefon: '05321112233', p_notu: '' });
});

test('6. talep (fonksiyon false döndü): nazik mesaj, "spam" yok', async () => {
  const { Veri } = veriYukle(() => ({ data: false, error: null }));
  await assert.rejects(Veri.talepEkle(TALEP), (e) => {
    assert.equal(e.message, 'Bu numarayla bugün en fazla 5 talep bırakılabiliyor; kırtasiye çalışanımız sizinle ilgilenecek.');
    assert.equal(e.sinir, true);
    return true;
  });
});

test('eski veritabanı (fonksiyon yok): tabloya doğrudan eklenir', async () => {
  const { Veri, cagrilar } = veriYukle((k) => k[0][0] === 'rpc'
    ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.kirtasiye_talep_birak in the schema cache' } }
    : { data: null, error: null });
  const t = await Veri.talepEkle(TALEP);
  assert.equal(t.kitap, 'Kınalı Serçe');
  const ekleme = cagrilar[1];
  assert.deepEqual(ekleme[0], ['from', 'kirtasiye_talepler']);
  assert.equal(ekleme[1][0], 'insert');
  assert.equal(ekleme[1][1].telefon, '05321112233');
  assert.equal(ekleme[1][1].onay, true);
});

test('fonksiyonun başka hatası yutulmaz, doğrudan eklemeye geçilmez', async () => {
  const { Veri, cagrilar } = veriYukle(() => ({ data: null, error: { code: '23514', message: 'violates check constraint' } }));
  await assert.rejects(Veri.talepEkle(TALEP), /violates check constraint/);
  assert.equal(cagrilar.length, 1);
});

test('bildirimler: okunmamışlar en yeni üstte gelir', async () => {
  const satir = { id: 'b1', telefon: '05321112233', deneme: 7, ilk: '2026-11-19T10:00:00Z', son: '2026-11-19T10:05:00Z' };
  const { Veri, cagrilar } = veriYukle(() => ({ data: [satir], error: null }));
  assert.deepEqual(JSON.parse(JSON.stringify(await Veri.bildirimler())), [satir]);
  const k = cagrilar[0];
  assert.deepEqual(k[0], ['from', 'kirtasiye_bildirimler']);
  assert.ok(k.some((c) => c[0] === 'eq' && c[1] === 'okundu' && c[2] === false));
  assert.ok(k.some((c) => c[0] === 'order' && c[1] === 'son' && c[2].ascending === false));
});

test('bildirim tablosu yoksa (SQL çalıştırılmadı) null döner, hata vermez', async () => {
  for (const error of [
    { code: 'PGRST205', message: "Could not find the table 'public.kirtasiye_bildirimler' in the schema cache" },
    { code: '42P01', message: 'relation "public.kirtasiye_bildirimler" does not exist' }
  ]) {
    const { Veri } = veriYukle(() => ({ data: null, error }));
    assert.equal(await Veri.bildirimler(), null, error.code);
  }
});

test('bildirim okundu işaretlenir', async () => {
  const { Veri, cagrilar } = veriYukle(() => ({ data: null, error: null }));
  await Veri.bildirimOkundu('b1');
  const k = cagrilar[0];
  assert.deepEqual(k[0], ['from', 'kirtasiye_bildirimler']);
  assert.deepEqual(JSON.parse(JSON.stringify(k[1])), ['update', { okundu: true }]);
  assert.deepEqual(k[2], ['eq', 'id', 'b1']);
});

test('yerel (deneme) modda bildirim yok', async () => {
  const depo = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const window = { AYAR: {}, location: { search: '' }, navigator: { onLine: true }, addEventListener: () => {}, localStorage: depo, sessionStorage: depo };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/veri.js'), 'utf8'), vm.createContext({ window, Depo: require('../js/depo.js') }));
  assert.equal(await window.Veri.bildirimler(), null);
});
