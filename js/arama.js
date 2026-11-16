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

  // Arama kayıtlarından özet: en çok arananlar ve sonuç vermeyenler.
  // kayitlar: [{ sorgu, sonuc (bulunan sayısı), zaman }]
  function ozet(kayitlar, adet) {
    adet = adet || 8;
    var grup = {};
    (kayitlar || []).forEach(function (k) {
      var anahtar = sadelestir(k.sorgu);
      if (anahtar.length < 2) return;
      var g = grup[anahtar] || (grup[anahtar] = { sorgu: String(k.sorgu).trim(), sayi: 0, bulunamayan: 0, son: '' });
      g.sayi++;
      if (!k.sonuc) g.bulunamayan++;
      if (String(k.zaman || '') > g.son) { g.son = String(k.zaman || ''); g.sorgu = String(k.sorgu).trim(); }
    });
    var liste = Object.keys(grup).map(function (a) { return grup[a]; });
    function sirala(alan) {
      return function (a, b) { return b[alan] - a[alan] || (b.son > a.son ? 1 : -1); };
    }
    return {
      toplam: (kayitlar || []).length,
      enCok: liste.filter(function (g) { return g.sayi > g.bulunamayan; }).sort(sirala('sayi')).slice(0, adet),
      bulunamayan: liste.filter(function (g) { return g.bulunamayan > 0; }).sort(sirala('bulunamayan')).slice(0, adet)
    };
  }

  var api = { ara: ara, sadelestir: sadelestir, rakamlar: rakamlar, ozet: ozet };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Arama = api;
})(this);
