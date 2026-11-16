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

  // ---- Bulanık eşleştirme (yazım hatası toleransı) ----
  function ikililer(s) {
    var t = sadelestir(s).replace(/ /g, '');
    var l = [];
    for (var i = 0; i < t.length - 1; i++) l.push(t.slice(i, i + 2));
    return l;
  }
  // Dice benzerliği (0–1). Sayılar farklıysa (7. sınıf / 8. sınıf) ciddi ceza: yanlış sınıf eşleşmesin.
  function benzerlik(a, b) {
    var x = ikililer(a), y = ikililer(b);
    if (!x.length || !y.length) return 0;
    var sayac = {}, ortak = 0;
    y.forEach(function (g) { sayac[g] = (sayac[g] || 0) + 1; });
    x.forEach(function (g) { if (sayac[g]) { ortak++; sayac[g]--; } });
    var skor = 2 * ortak / (x.length + y.length);
    var sa = (sadelestir(a).match(/\d+/g) || []).sort().join(','), sb = (sadelestir(b).match(/\d+/g) || []).sort().join(',');
    if (sa && sb && sa !== sb) skor *= 0.5;
    return skor;
  }

  // Okul listesi satırını temizler: "3- ", "3) ", "• ", "a. " gibi başları ve "- Yazar" kısmını ayırır.
  function satirCoz(satir) {
    var ham = String(satir || '').trim();
    var bas = /^(?:[•*·\-–]+|\d{1,3}\s*[.)\-–:]|[a-zçğıöşü]\s*[.)])\s*/i.exec(ham);
    // "7. Sınıf …" bir numara değil, kitabın adı: sınıf kelimesiyle devam ediyorsa silme.
    var t = bas && !/^s[ıi]n[ıi]f/i.test(ham.slice(bas[0].length)) ? ham.slice(bas[0].length).trim() : ham;
    var parca = t.split(/\s+[-–—]\s+/);
    return { metin: t, ad: parca[0].trim(), yazar: (parca[1] || '').trim() };
  }

  // Tek bir metni en uygun kitapla eşleştirir: { kitap, skor, tam } ya da null.
  function eslestir(kitaplar, metin, esik) {
    var c = typeof metin === 'string' ? satirCoz(metin) : metin;
    if (sadelestir(c.ad).length < 2) return null;
    var en = null;
    kitaplar.forEach(function (k) {
      var s = benzerlik(c.ad, k.ad);
      if (c.yazar && k.yazar) s = Math.max(s, (s * 3 + benzerlik(c.yazar, k.yazar)) / 4);
      if (!en || s > en.skor) en = { kitap: k, skor: s };
    });
    if (!en || en.skor < (esik || 0.6)) return null;
    var kucuk = function (x) { return String(x).toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); };
    en.tam = kucuk(en.kitap.ad) === kucuk(c.ad);
    return en;
  }

  // Yapıştırılan listeyi satır satır eşleştirir.
  function listeyiCoz(kitaplar, metin) {
    return String(metin || '').split(/\r?\n/).map(satirCoz).filter(function (c) { return sadelestir(c.ad).length >= 2; })
      .map(function (c) {
        var e = eslestir(kitaplar, c);
        return { metin: c.metin, kitapId: e ? e.kitap.id : null, skor: e ? Math.round(e.skor * 100) / 100 : 0, duzeltildi: !!(e && !e.tam) };
      });
  }

  // Arama sonuç vermezse "Bunu mu demek istediniz?" önerileri.
  function oneriler(kitaplar, sorgu, adet) {
    var s = sadelestir(sorgu);
    if (s.length < 3) return [];
    return kitaplar.map(function (k) {
      var skor = Math.max(benzerlik(sorgu, k.ad), benzerlik(sorgu, k.yazar || ''), benzerlik(sorgu, k.ad + ' ' + (k.yazar || '')));
      // Sorgu, adın bir parçasına benziyorsa da yakala ("kurk mantolu" → "Kürk Mantolu Madonna").
      var kelime = sadelestir(k.ad).split(' ');
      for (var i = 0; i < kelime.length; i++) {
        var parca = kelime.slice(i, i + s.split(' ').length).join(' ');
        skor = Math.max(skor, benzerlik(sorgu, parca) * 0.95);
      }
      return { kitap: k, skor: skor };
    }).filter(function (x) { return x.skor >= 0.55; })
      .sort(function (a, b) { return b.skor - a.skor; }).slice(0, adet || 5).map(function (x) { return x.kitap; });
  }

  var api = { ara: ara, sadelestir: sadelestir, rakamlar: rakamlar, ozet: ozet,
    benzerlik: benzerlik, satirCoz: satirCoz, eslestir: eslestir, listeyiCoz: listeyiCoz, oneriler: oneriler };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Arama = api;
})(this);
