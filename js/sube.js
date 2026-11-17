// Şube eksik listesi: şubeden gelen barkodlu Excel listesini mağazadaki kitaplarla eşleştirir,
// her kitabın raf ve bölmesini bulur, toplama sırasına (raf → bölme) dizer.
// Saf fonksiyonlar. Tarayıcıda window.Sube, Node'da module.exports.
(function (kok) {
  var Depo = kok.Depo || (typeof require === 'function' ? require('./depo.js') : null);

  function temiz(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
  function kucuk(x) { return temiz(x).toLocaleLowerCase('tr-TR'); }

  // Barkodun karşılaştırma anahtarı: yalnız rakamlar (ISBN-10'un X'i dahil).
  // ISBN-10, aynı kitabın ISBN-13'üne çevrilir; böylece iki biçim de eşleşir.
  function barkodAnahtar(x) {
    var k = String(x == null ? '' : x).toUpperCase().replace(/[^0-9X]/g, '');
    if (/^\d{9}[\dX]$/.test(k)) {
      var govde = '978' + k.slice(0, 9), t = 0;
      for (var i = 0; i < 12; i++) t += Number(govde[i]) * (i % 2 ? 3 : 1);
      return govde + ((10 - (t % 10)) % 10);
    }
    return k.replace(/X/g, '');
  }
  function barkodMu(x) { return /^\d{8,14}$/.test(barkodAnahtar(x)); }

  var BASLIK = {
    barkod: /barkod|barcode|isbn|ean|gtin/,
    adet: /adet|miktar|eksik|say[ıi]|istenen|ihtiya[çc]|talep|sipari[şs]|qty|quantity/,
    ad: /kitap|[üu]r[üu]n|ad[ıi]?$|^ad\b|isim|a[çc][ıi]klama|eser|ba[şs]l[ıi]k/
  };

  // Başlık satırını ve sütunları bulur. Başlık yoksa barkod sütunu içeriğe göre seçilir.
  // Döner: { baslikSatiri: -1|n, barkod: k, adet: k|-1, ad: k|-1, basliklar: [...] }
  function sutunlariBul(satirlar) {
    var sonuc = { baslikSatiri: -1, barkod: -1, adet: -1, ad: -1, basliklar: [] };
    for (var r = 0; r < Math.min(satirlar.length, 15); r++) {
      var satir = satirlar[r] || [];
      var b = satir.findIndex(function (h) { return BASLIK.barkod.test(kucuk(h)); });
      if (b >= 0) {
        sonuc.baslikSatiri = r;
        sonuc.barkod = b;
        sonuc.basliklar = satir.map(temiz);
        satir.forEach(function (h, k) {
          var s = kucuk(h);
          if (k === b || !s) return;
          if (sonuc.adet < 0 && BASLIK.adet.test(s)) sonuc.adet = k;
          else if (sonuc.ad < 0 && BASLIK.ad.test(s)) sonuc.ad = k;
        });
        break;
      }
    }
    if (sonuc.barkod < 0) {
      var sayac = [];
      satirlar.slice(0, 200).forEach(function (s) {
        (s || []).forEach(function (h, k) { if (barkodMu(h)) sayac[k] = (sayac[k] || 0) + 1; });
      });
      var enIyi = -1, enCok = 0;
      sayac.forEach(function (n, k) { if (n > enCok) { enCok = n; enIyi = k; } });
      sonuc.barkod = enIyi;
      // Barkod başlığı farklı yazılmışsa ("Kod", "Ürün kodu"): barkodların hemen üstündeki satır başlıktır.
      for (var h = 0; enIyi >= 0 && h < Math.min(satirlar.length - 1, 15); h++) {
        var ust = satirlar[h] || [], alt = satirlar[h + 1] || [];
        if (!barkodMu(ust[enIyi]) && barkodMu(alt[enIyi]) && ust.some(function (x) { return temiz(x); })) {
          sonuc.baslikSatiri = h;
          sonuc.basliklar = ust.map(temiz);
          ust.forEach(function (x, k) {
            var s = kucuk(x);
            if (k === enIyi || !s) return;
            if (sonuc.adet < 0 && BASLIK.adet.test(s)) sonuc.adet = k;
            else if (sonuc.ad < 0 && BASLIK.ad.test(s)) sonuc.ad = k;
          });
          break;
        }
        if (barkodMu(ust[enIyi])) break;
      }
    }
    return sonuc;
  }

  function adetOku(x) {
    var n = Number(String(x == null ? '' : x).replace(',', '.').replace(/[^\d.]/g, ''));
    return isFinite(n) && n > 0 ? Math.round(n) : 1;
  }

  var DURUM = { var: 'Rafta', az: 'Stok yetersiz', tukendi: 'Stokta yok', kayitsiz: 'Kayıtlı değil' };

  // Listeyi eşleştirir. sutun: sutunlariBul sonucu (kullanıcı değiştirmiş olabilir).
  // Aynı barkod listede birden çok geçerse adetleri toplanır.
  function eslestir(d, satirlar, sutun) {
    var dizin = {};
    d.kitaplar.forEach(function (k) {
      var a = barkodAnahtar(k.barkod);
      if (a && !dizin[a]) dizin[a] = k;
    });
    var kalemler = [], gorulen = {}, atlanan = 0, stokVar = !(d.ayarlar && d.ayarlar.stok === false);
    satirlar.forEach(function (satir, r) {
      if (r <= sutun.baslikSatiri || !satir) return;
      var ham = satir[sutun.barkod];
      if (!temiz(ham)) return;
      var anahtar = barkodAnahtar(ham);
      if (!/^\d{6,14}$/.test(anahtar)) { atlanan++; return; }
      var adet = sutun.adet >= 0 ? adetOku(satir[sutun.adet]) : 1;
      if (gorulen[anahtar]) { gorulen[anahtar].adet += adet; return; }
      var kitap = dizin[anahtar] || null;
      var yer = kitap ? Depo.konum(d, kitap.bolmeId) : null;
      var durum = 'kayitsiz';
      if (kitap) {
        if (!stokVar || kitap.stok == null) durum = 'var';
        else if (kitap.stok <= 0) durum = 'tukendi';
        else durum = 'var';
      }
      var kalem = {
        satir: r + 1, barkod: temiz(ham).replace(/\s+/g, ''), anahtar: anahtar, adet: adet,
        listeAdi: sutun.ad >= 0 ? temiz(satir[sutun.ad]) : '',
        kitap: kitap, yer: yer, durum: durum
      };
      gorulen[anahtar] = kalem;
      kalemler.push(kalem);
    });
    kalemler.forEach(function (k) {
      if (stokVar && k.kitap && k.kitap.stok != null && k.kitap.stok > 0 && k.kitap.stok < k.adet) k.durum = 'az';
    });
    kalemler.sort(toplamaSirasi);
    return { kalemler: kalemler, atlanan: atlanan, ozet: ozet(kalemler) };
  }

  // Raf → bölme → kitap adı; mağazada kaydı olmayanlar en sonda.
  function toplamaSirasi(a, b) {
    if (!a.yer !== !b.yer) return a.yer ? -1 : 1;
    if (a.yer && b.yer) {
      if (a.yer.raf.no !== b.yer.raf.no) return a.yer.raf.no - b.yer.raf.no;
      if (a.yer.bolme.no !== b.yer.bolme.no) return a.yer.bolme.no - b.yer.bolme.no;
    }
    return String(a.kitap ? a.kitap.ad : a.listeAdi).localeCompare(String(b.kitap ? b.kitap.ad : b.listeAdi), 'tr');
  }

  function ozet(kalemler) {
    var o = { kalem: kalemler.length, adet: 0, var: 0, az: 0, tukendi: 0, kayitsiz: 0 };
    kalemler.forEach(function (k) { o.adet += k.adet; o[k.durum]++; });
    return o;
  }

  // Excel'e yazılacak satırlar (ilk satır başlık). Barkod metin kalır.
  function ciktiSatirlari(sonuc, stokGoster) {
    var bas = ['Sıra', 'Raf', 'Bölme', 'Barkod', 'Kitap adı', 'Yazar', 'Yayınevi', 'İstenen adet'];
    if (stokGoster) bas.push('Mağaza stoğu');
    bas.push('Durum', 'Listedeki ad');
    return [bas].concat(sonuc.kalemler.map(function (k, i) {
      var s = [i + 1,
        k.yer ? k.yer.raf.no + '. Raf' + (k.yer.raf.etiket ? ' · ' + k.yer.raf.etiket : '') : '',
        k.yer ? k.yer.kod : '',
        k.barkod, k.kitap ? k.kitap.ad : '', k.kitap ? k.kitap.yazar || '' : '', k.kitap ? k.kitap.yayinevi || '' : '', k.adet];
      if (stokGoster) s.push(k.kitap && k.kitap.stok != null ? k.kitap.stok : '');
      s.push(DURUM[k.durum], k.listeAdi);
      return s;
    }));
  }

  var api = { barkodAnahtar: barkodAnahtar, sutunlariBul: sutunlariBul, eslestir: eslestir, ciktiSatirlari: ciktiSatirlari, DURUM: DURUM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Sube = api;
})(this);
