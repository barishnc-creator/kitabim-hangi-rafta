// Oturum jetonu nerede saklanıyor? (güvenlik denetimi O2)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function depo(ilk) {
  const m = new Map(Object.entries(ilk || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), has: (k) => m.has(k) };
}

function bulutModundaYukle(localStorage) {
  let secenek = null;
  const zincir = { on: () => zincir, subscribe: () => zincir };
  const sessionStorage = depo();
  const window = {
    AYAR: { supabaseUrl: 'https://kkcfzrchrdiroiskibhw.supabase.co', supabaseKey: 'sb_publishable_test' },
    location: { search: '' },
    navigator: { onLine: true },
    addEventListener: () => {},
    localStorage,
    sessionStorage,
    supabase: { createClient: (url, key, o) => { secenek = o; return { channel: () => zincir }; } }
  };
  const baglam = vm.createContext({ window, Depo: require('../js/depo.js') });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/veri.js'), 'utf8'), baglam);
  return { secenek, window };
}

test('bulut: oturum localStorage yerine sekmeye özel sessionStorage içinde, uygulamaya özel anahtarla', () => {
  const { secenek, window } = bulutModundaYukle(depo());
  assert.ok(secenek && secenek.auth, 'createClient auth seçenekleriyle çağrılmalı');
  assert.equal(secenek.auth.storage, window.sessionStorage);
  assert.equal(secenek.auth.storageKey, 'kitabim-hangi-rafta-oturum');
});

test('bulut: eski sürümün localStorage\'da bıraktığı jeton silinir, başka veriye dokunulmaz', () => {
  const ls = depo({ 'sb-kkcfzrchrdiroiskibhw-auth-token': '{"access_token":"eski"}', 'kitabim-hangi-rafta:talepler': '[]', 'kitabim-hangi-rafta:onbellek': '{}' });
  bulutModundaYukle(ls);
  assert.equal(ls.has('sb-kkcfzrchrdiroiskibhw-auth-token'), false);
  assert.equal(ls.has('kitabim-hangi-rafta:talepler'), true);
  // Büyük çevrimdışı kopya artık IndexedDB'de; eski sürümün localStorage'daki kopyası silinir (5 MB sınırı).
  assert.equal(ls.has('kitabim-hangi-rafta:onbellek'), false);
});
