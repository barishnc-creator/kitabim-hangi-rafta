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

  kok.Ortak = { kacis: kacis, para: para, sirali: sirali, siraliBolmeler: siraliBolmeler, ikon: ikon, pencere: pencere };
})(window);
