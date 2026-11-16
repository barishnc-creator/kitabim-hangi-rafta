// Kitap arama: Türkçe harf duyarsız, ad / yazar / yayınevi / barkod üzerinde.
// Tarayıcıda window.Arama, Node'da module.exports olarak kullanılır.
(function (kok) {
  var HARF = { 'ı': 'i', 'İ': 'i', 'I': 'i', 'ş': 's', 'Ş': 's', 'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u', 'â': 'a', 'Â': 'a',
    'î': 'i', 'Î': 'i', 'û': 'u', 'Û': 'u' };

  function sadelestir(metin) {
    return String(metin == null ? '' : metin)
      .replace(/[ıİIşŞçÇğĞöÖüÜâÂîÎûÛ]/g, function (h) { return HARF[h]; })
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function rakamlar(metin) {
    return String(metin == null ? '' : metin).replace(/\D+/g, '');
  }

  // Sonuçları en uygun olandan başlayarak döndürür.
  function ara(kitaplar, sorgu) {
    var s = sadelestir(sorgu);
    if (!s) return [];
    var sorguRakam = rakamlar(sorgu);
    var kelimeler = s.split(' ');
    var sonuc = [];

    kitaplar.forEach(function (k) {
      var puan = 0;
      var barkod = rakamlar(k.barkod);
      if (barkod && sorguRakam.length >= 4 && barkod === sorguRakam) {
        puan = 1000;
      } else {
        var ad = sadelestir(k.ad);
        var hepsi = [ad, sadelestir(k.yazar), sadelestir(k.yayinevi), barkod].join(' ');
        var tamam = kelimeler.every(function (w) { return hepsi.indexOf(w) >= 0; });
        if (!tamam) return;
        if (ad === s) puan = 500;
        else if (ad.indexOf(s) === 0) puan = 300;
        else if (ad.indexOf(s) >= 0) puan = 200;
        else if (kelimeler.every(function (w) { return ad.indexOf(w) >= 0; })) puan = 150;
        else puan = 100;
      }
      sonuc.push({ kitap: k, puan: puan });
    });

    sonuc.sort(function (a, b) {
      return b.puan - a.puan || String(a.kitap.ad).localeCompare(String(b.kitap.ad), 'tr');
    });
    return sonuc.map(function (x) { return x.kitap; });
  }

  var api = { ara: ara, sadelestir: sadelestir, rakamlar: rakamlar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Arama = api;
})(this);
