// Barkoddan (ISBN) kitap bilgisi: önce Google Kitaplar, eksik kalırsa Open Library.
// Tarayıcıda window.KitapBilgi, Node'da module.exports (testler için).
(function (kok) {
  function rakam(k) { return String(k == null ? '' : k).toUpperCase().replace(/[^0-9X]/g, ''); }

  // Kitap barkodu mu? ISBN-13 (978/979 ile başlar) ya da ISBN-10, kontrol hanesiyle.
  function isbnMi(kod) {
    var k = rakam(kod);
    if (/^97[89]\d{10}$/.test(k)) {
      var t = 0;
      for (var i = 0; i < 12; i++) t += Number(k[i]) * (i % 2 ? 3 : 1);
      return (10 - (t % 10)) % 10 === Number(k[12]);
    }
    if (/^\d{9}[\dX]$/.test(k)) {
      var s = 0;
      for (var j = 0; j < 10; j++) s += (k[j] === 'X' ? 10 : Number(k[j])) * (10 - j);
      return s % 11 === 0;
    }
    return false;
  }

  function temiz(x) { return String(x || '').replace(/\s+/g, ' ').trim(); }

  function googleCozumle(json) {
    var v = json && json.items && json.items[0] && json.items[0].volumeInfo;
    if (!v || !v.title) return null;
    return {
      ad: temiz(v.subtitle ? v.title + ': ' + v.subtitle : v.title),
      yazar: temiz((v.authors || []).join(', ')),
      yayinevi: temiz(v.publisher),
      kapak: temiz(v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)).replace(/^http:\/\//, 'https://')
    };
  }

  function openLibraryCozumle(json, isbn) {
    var v = json && json['ISBN:' + isbn];
    if (!v || !v.title) return null;
    return {
      ad: temiz(v.subtitle ? v.title + ': ' + v.subtitle : v.title),
      yazar: temiz((v.authors || []).map(function (a) { return a.name; }).join(', ')),
      yayinevi: temiz((v.publishers || []).map(function (p) { return p.name; }).join(', ')),
      kapak: temiz(v.cover && (v.cover.medium || v.cover.small))
    };
  }

  // İki kaynaktan gelenleri birleştir: ilkinin dolu alanları önceliklidir.
  function birlestir(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return { ad: a.ad || b.ad, yazar: a.yazar || b.yazar, yayinevi: a.yayinevi || b.yayinevi, kapak: a.kapak || b.kapak };
  }

  var KOTA = { kota: true };
  function getir(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var zaman = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(zaman);
      if (r.status === 429 || r.status === 403) return KOTA; // Google'ın anahtarsız ortak günlük kotası doldu
      return r.ok ? r.json() : null;
    }).catch(function () { clearTimeout(zaman); return undefined; }); // undefined: ağa ulaşılamadı
  }

  // Bulamazsa null döner; hiçbir zaman hata fırlatmaz.
  // sunucu (isteğe bağlı): bulutta kitap-bilgi fonksiyonunu çağıran işlev. Varsa önce o sorulur
  // (kendi Google anahtarıyla Google Kitaplar, Open Library, gerekirse Google Arama); ulaşılamazsa doğrudan aranır.
  // api.baglantiYok: son aramada iki kaynağa da ulaşılamadıysa true.
  // api.kotaDoldu: Google Kitaplar istek sınırı yüzünden cevap vermediyse ve kitap başka yerde de bulunamadıysa true.
  // api.kaynak: bilginin geldiği yer ('google-kitaplar', 'open-library', 'google-arama' ya da '').
  function bul(kod, sunucu) {
    api.baglantiYok = false;
    api.kotaDoldu = false;
    api.kaynak = '';
    if (!isbnMi(kod)) return Promise.resolve(null);
    var isbn = rakam(kod);
    if (typeof sunucu === 'function') {
      return Promise.resolve().then(function () { return sunucu({ islem: 'isbn', isbn: isbn }); }).then(function (c) {
        var b = c && c.bilgi;
        if (!b || !b.ad) return null;
        api.kaynak = b.kaynak || '';
        return { ad: temiz(b.ad), yazar: temiz(b.yazar), yayinevi: temiz(b.yayinevi), kapak: temiz(b.kapak) };
      }, function () { return dogrudan(isbn); });
    }
    return dogrudan(isbn);
  }

  function dogrudan(isbn) {
    return getir('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn, 6000).then(function (g) {
      var sonuc = g === KOTA ? null : googleCozumle(g);
      if (sonuc && sonuc.ad && sonuc.yazar && sonuc.yayinevi) { api.kaynak = 'google-kitaplar'; return sonuc; }
      return getir('https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data', 6000).then(function (o) {
        var son = birlestir(sonuc, openLibraryCozumle(o, isbn));
        api.baglantiYok = !son && g === undefined && o === undefined;
        api.kotaDoldu = !son && g === KOTA;
        if (son) api.kaynak = sonuc ? 'google-kitaplar' : 'open-library';
        return son;
      });
    });
  }

  var api = { isbnMi: isbnMi, googleCozumle: googleCozumle, openLibraryCozumle: openLibraryCozumle, birlestir: birlestir, bul: bul, baglantiYok: false, kotaDoldu: false, kaynak: '' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.KitapBilgi = api;
})(this);
