// Çevrimdışı çalışma: uygulama dosyalarını önbellekte tutar.
// Strateji: önce ağ (güncel sürüm), ağ yoksa önbellek. Supabase ve Google istekleri önbelleğe alınmaz.
var SURUM = 'khr-v19';
var DOSYALAR = [
  './', 'index.html', 'yonetim.html',
  'css/stil.css', 'css/kiosk.css', 'css/panel.css',
  'js/ayar.js', 'js/hata.js', 'js/arama.js', 'js/depo.js', 'js/veri.js', 'js/ortak.js', 'js/barkodonay.js', 'js/tarayici.js', 'js/klavye.js', 'js/tema.js',
  'js/harita.js', 'js/musteri.js', 'js/kitapbilgi.js', 'js/csv.js', 'js/gecmis.js', 'js/yonetim.js',
  'js/panel-okul.js', 'js/panel-talep.js', 'js/xlsx.js', 'js/xls.js', 'js/sube.js', 'js/panel-sube.js', 'js/giris.js', 'js/panel-giris.js', 'js/panel-gorunum.js', 'js/panel-kampanya.js', 'js/panel-harita.js', 'js/panel-gecmis.js', 'js/panel-durum.js', 'js/kur.js',
  'vendor/supabase.js', 'vendor/html5-qrcode.min.js', 'vendor/qrcode.js', 'vendor/barcode-detector.js', 'vendor/zxing_reader.wasm',
  'kiosk.webmanifest', 'yonetim.webmanifest',
  'simge/kiosk-32.png', 'simge/kiosk-180.png', 'simge/kiosk-192.png', 'simge/kiosk-512.png',
  'simge/panel-32.png', 'simge/panel-180.png', 'simge/panel-192.png', 'simge/panel-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SURUM).then(function (c) { return c.addAll(DOSYALAR); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (adlar) {
    return Promise.all(adlar.filter(function (a) { return a !== SURUM; }).map(function (a) { return caches.delete(a); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var istek = e.request;
  if (istek.method !== 'GET') return;
  var url = new URL(istek.url);
  var yaziTipi = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !yaziTipi) return; // veri istekleri (Supabase, Google Kitaplar) doğrudan gider
  e.respondWith(fetch(istek).then(function (yanit) {
    if (yanit.ok || yanit.type === 'opaque') {
      var kopya = yanit.clone();
      caches.open(SURUM).then(function (c) { c.put(istek, kopya); });
    }
    return yanit;
  }).catch(function () {
    return caches.match(istek, { ignoreSearch: url.origin === self.location.origin }).then(function (k) {
      return k || (istek.mode === 'navigate' ? caches.match(url.pathname.indexOf('yonetim') >= 0 ? 'yonetim.html' : 'index.html') : Response.error());
    });
  }));
});
