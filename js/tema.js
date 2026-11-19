// Mağazaya özel görünüm: ana renk, logo, karşılama yazısı.
// Renk hesapları saf fonksiyonlardır (Node'da test edilir); uygula() yalnız tarayıcıda çalışır.
(function (kok) {
  var VARSAYILAN = '#1D4ED8';

  function rgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex(r) {
    return '#' + r.map(function (x) { return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  function karistir(a, b, oran) { // a'dan b'ye doğru oran kadar
    return a.map(function (x, i) { return x + (b[i] - x) * oran; });
  }
  function parlaklik(r) { // WCAG göreli parlaklık
    var c = r.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function kontrast(a, b) {
    var x = parlaklik(rgb(a) || [0, 0, 0]), y = parlaklik(rgb(b) || [0, 0, 0]);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // Ana renkten tema tonlarını üretir. Beyaz yazı okunmuyorsa (kontrast < 4.5) ana rengi koyulaştırır.
  function renkler(girdi) {
    var r = rgb(girdi) || rgb(VARSAYILAN);
    var ana = r, adim = 0;
    while (kontrast(hex(ana), '#FFFFFF') < 4.5 && adim < 20) { ana = karistir(ana, [0, 0, 0], 0.08); adim++; }
    return {
      ana: hex(ana),
      koyu: hex(karistir(ana, [0, 0, 0], 0.3)),
      acik: hex(karistir(ana, [255, 255, 255], 0.86)),
      duzeltildi: adim > 0
    };
  }

  function renkGecerli(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')); }
  function logoGecerli(u) { return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(u || '')) && u.length <= 300000; }

  // Sayfaya uygular: CSS değişkenleri, logo ve (müşteri ekranında) karşılama yazısı.
  function uygula(ayarlar) {
    if (typeof document === 'undefined') return;
    ayarlar = ayarlar || {};
    var t = renkler(renkGecerli(ayarlar.renk) ? ayarlar.renk : VARSAYILAN);
    var st = document.documentElement.style;
    st.setProperty('--mavi', t.ana);
    st.setProperty('--mavi-koyu', t.koyu);
    st.setProperty('--mavi-acik', t.acik);
    var logo = logoGecerli(ayarlar.logo) ? ayarlar.logo : '';
    document.querySelectorAll('.k-marka-ikon, .marka-ikon').forEach(function (el) {
      if (logo) {
        if (!el.querySelector('img.logo-resim') || el.querySelector('img.logo-resim').src !== logo) {
          el.innerHTML = '<img class="logo-resim" alt="" src="' + logo + '">';
        }
        el.classList.add('logolu');
      } else if (el.classList.contains('logolu')) {
        el.classList.remove('logolu');
        el.innerHTML = kok.Ortak ? kok.Ortak.ikon.kitap : '';
      }
    });
    var k = document.getElementById('karsilama-yazi');
    if (k) k.textContent = String(ayarlar.karsilama || '').trim() || 'Aradığınız kitabı birlikte bulalım';
  }

  // Seçilen görseli kare içine sığacak şekilde küçültür (en fazla 256 px), data URL döner.
  function logoHazirla(dosya) {
    return new Promise(function (coz, red) {
      if (!dosya || !/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(dosya.type)) { red(new Error('PNG, JPG ya da WebP bir görsel seçin.')); return; }
      if (dosya.size > 5 * 1024 * 1024) { red(new Error('Görsel 5 MB’tan küçük olmalı.')); return; }
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onload = function () {
        var olcek = Math.min(1, 256 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * olcek));
        c.height = Math.max(1, Math.round(img.height * olcek));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var veri = c.toDataURL('image/png');
        if (veri.length > 300000) veri = c.toDataURL('image/jpeg', 0.85);
        logoGecerli(veri) ? coz(veri) : red(new Error('Görsel işlenemedi. Daha küçük bir dosya deneyin.'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Görsel açılamadı.')); };
      img.src = url;
    });
  }

  // Kampanya görseli: en fazla 1600 px genişlik, JPEG; veritabanı sınırı için boyut 380 KB altına inene kadar kalite düşürülür.
  function kampanyaResmiHazirla(dosya) {
    return new Promise(function (coz, red) {
      if (!dosya || !/^image\/(png|jpeg|webp|gif)$/.test(dosya.type)) { red(new Error('PNG, JPG ya da WebP bir fotoğraf seçin.')); return; }
      if (dosya.size > 20 * 1024 * 1024) { red(new Error('Fotoğraf 20 MB’tan küçük olmalı.')); return; }
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var genislik = Math.min(1600, img.width), veri = '';
        for (var deneme = 0; deneme < 8; deneme++) {
          var olcek = genislik / img.width, c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * olcek));
          c.height = Math.max(1, Math.round(img.height * olcek));
          var cx = c.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
          cx.drawImage(img, 0, 0, c.width, c.height);
          veri = c.toDataURL('image/jpeg', deneme < 4 ? 0.85 - deneme * 0.1 : 0.55);
          if (veri.length <= 380000) break;
          if (deneme >= 3) genislik = Math.round(genislik * 0.8);
        }
        veri.length <= 380000 ? coz(veri) : red(new Error('Fotoğraf küçültülemedi. Daha küçük bir dosya deneyin.'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); red(new Error('Fotoğraf açılamadı.')); };
      img.src = url;
    });
  }

  var api = { VARSAYILAN: VARSAYILAN, renkler: renkler, kontrast: kontrast, renkGecerli: renkGecerli, logoGecerli: logoGecerli, uygula: uygula, logoHazirla: logoHazirla, kampanyaResmiHazirla: kampanyaResmiHazirla };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Tema = api;
})(this);
