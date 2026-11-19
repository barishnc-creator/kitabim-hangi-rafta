// İki ekranın ortak küçük yardımcıları.
(function (kok) {
  function kacis(metin) {
    return String(metin == null ? '' : metin).replace(/[&<>"']/g, function (h) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[h];
    });
  }

  function para(n) {
    if (n == null || n === '') return '';
    return '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sirali(raflar) {
    return raflar.slice().sort(function (a, b) { return a.no - b.no; });
  }

  function siraliBolmeler(raf) {
    return raf.bolmeler.slice().sort(function (a, b) { return a.no - b.no; });
  }

  var ikon = {
    ara: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    barkod: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M11 8v8M15 8v8M18 8v8"/></svg>',
    konum: '<svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    kalem: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    cop: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    arti: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    kitap: '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
  };
  function s(ic, boy) {
    return '<svg aria-hidden="true" width="' + (boy || 20) + '" height="' + (boy || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ic + '</svg>';
  }
  ikon.kitap18 = s('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>');
  ikon.pano = s('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>');
  ikon.raf = s('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M12 3v18"/>');
  ikon.etiket = s('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>');
  ikon.revize = s('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
  ikon.kullanici = s('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>');
  ikon.ayar = s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');
  ikon.ekran = s('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>');
  ikon.cikis = s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
  ikon.indir = s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', 18);
  ikon.yukle = s('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', 18);
  ikon.yazdir = s('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>', 18);
  ikon.kapat = s('<path d="M18 6 6 18M6 6l12 12"/>');
  ikon.klavye = s('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8"/>', 24);
  ikon.ok = s('<path d="M5 12h14M12 5l7 7-7 7"/>');
  ikon.okul = s('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>');
  ikon.zil = s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>');
  ikon.tel = s('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>', 16);
  ikon.konum20 = s('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>');
  ikon.saat = s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
  ikon.sube = s('<path d="M3 9l1.5-5h15L21 9M3 9h18M4 9v11h16V9M9 20v-6h6v6"/>');
  ikon.kamera = s('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>');
  ikon.kampanya = s('<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>');
  ikon.geri = s('<path d="M19 12H5M12 19l-7-7 7-7"/>');

  // <span data-ikon="ad"> öğelerini simgeyle doldurur.
  function ikonlariDoldur(kok2) {
    (kok2 || document).querySelectorAll('[data-ikon]').forEach(function (el) {
      var i = ikon[el.getAttribute('data-ikon')];
      if (i && !el.innerHTML) el.innerHTML = i;
    });
  }

  // Sayıya iyelik eki: 1'i, 2'si, 6'sı, 9'u, 10'u, 40'ı, 100'ü…
  function sayiEki(n) {
    n = Math.abs(Math.floor(Number(n) || 0));
    var birler = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u' };
    var onlar = { 1: 'u', 2: 'si', 3: 'u', 4: 'ı', 5: 'si', 6: 'ı', 7: 'i', 8: 'i', 9: 'ı' };
    var ek = n === 0 ? 'ı' : n % 10 ? birler[n % 10] : n % 100 ? onlar[(n % 100) / 10] : n % 1000 ? 'ü' : 'i';
    return n + "'" + ek;
  }

  function tarihKisa(t) {
    try { return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; }
  }

  // Tarayıcının confirm/prompt pencereleri yerine sayfa içi pencere.
  // pencere(mesaj, { girdi: true, deger, evet, tehlike }) → Promise: onayda true (ya da yazılan metin), vazgeçte null.
  function pencere(mesaj, s) {
    s = s || {};
    return new Promise(function (coz) {
      var onceki = document.activeElement;
      var perde = document.createElement('div');
      perde.className = 'kamera-perde';
      perde.innerHTML =
        '<form class="kart bolum pencere" role="dialog" aria-modal="true" aria-labelledby="pencere-metin">' +
        '<p id="pencere-metin" style="margin:0;font-size:17px;white-space:pre-line"></p>' +
        (s.girdi ? '<div class="alan"><label class="gizli-etiket" for="pencere-girdi">Değer</label><input id="pencere-girdi" autocomplete="off"></div>' : '') +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">' +
        '<button type="button" class="dugme" data-p="hayir">Vazgeç</button>' +
        '<button type="submit" class="dugme ' + (s.tehlike ? 'tehlike' : 'ana') + '"></button></div></form>';
      perde.querySelector('#pencere-metin').textContent = mesaj;
      perde.querySelector('[type=submit]').textContent = s.evet || 'Tamam';
      var girdi = perde.querySelector('#pencere-girdi');
      if (girdi) girdi.value = s.deger || '';
      document.body.appendChild(perde);
      function bitir(sonuc) {
        document.removeEventListener('keydown', tus);
        perde.remove();
        if (onceki && onceki.focus) onceki.focus();
        coz(sonuc);
      }
      function tus(e) { if (e.key === 'Escape') bitir(null); }
      document.addEventListener('keydown', tus);
      perde.querySelector('[data-p=hayir]').addEventListener('click', function () { bitir(null); });
      perde.addEventListener('click', function (e) { if (e.target === perde) bitir(null); });
      perde.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        bitir(girdi ? girdi.value : true);
      });
      (girdi || perde.querySelector('[type=submit]')).focus();
    });
  }

  kok.Ortak = { kacis: kacis, para: para, sirali: sirali, siraliBolmeler: siraliBolmeler, ikon: ikon, pencere: pencere, ikonlariDoldur: ikonlariDoldur, tarihKisa: tarihKisa, sayiEki: sayiEki };
})(window);
