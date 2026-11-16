// Excel ile alışveriş: kitap listesini CSV olarak dışa aktarma ve CSV'den toplu içe aktarma.
// Türkçe Excel ";" ayırıcı kullanır; ',' ve sekme de tanınır. Depo ve Arama'ya ihtiyaç duyar.
// Tarayıcıda window.Csv, Node'da module.exports.
(function (kok) {
  var Depo = kok.Depo || (typeof require === 'function' ? require('./depo.js') : null);
  var Arama = kok.Arama || (typeof require === 'function' ? require('./arama.js') : null);

  var BASLIKLAR = ['Kitap adı', 'Yazar', 'Yayınevi', 'Barkod', 'Raf/Bölme', 'Fiyat', 'Stok'];

  function ayiriciBul(ilkSatir) {
    var adaylar = [';', ',', '\t'];
    var enIyi = ';', enCok = -1;
    adaylar.forEach(function (a) {
      var n = ilkSatir.split(a).length;
      if (n > enCok) { enCok = n; enIyi = a; }
    });
    return enIyi;
  }

  // CSV metnini satır dizilerine çevirir (tırnaklı alanlar, satır içi yeni satır, BOM desteklenir).
  function oku(metin) {
    metin = String(metin || '').replace(/^﻿/, '');
    var ayirici = ayiriciBul(metin.split(/\r?\n/)[0] || '');
    var satirlar = [], satir = [], alan = '', tirnak = false;
    for (var i = 0; i < metin.length; i++) {
      var c = metin[i];
      if (tirnak) {
        if (c === '"') {
          if (metin[i + 1] === '"') { alan += '"'; i++; } else tirnak = false;
        } else alan += c;
      } else if (c === '"') tirnak = true;
      else if (c === ayirici) { satir.push(alan); alan = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && metin[i + 1] === '\n') i++;
        satir.push(alan); alan = '';
        if (satir.some(function (x) { return x.trim() !== ''; })) satirlar.push(satir);
        satir = [];
      } else alan += c;
    }
    satir.push(alan);
    if (satir.some(function (x) { return x.trim() !== ''; })) satirlar.push(satir);
    return satirlar;
  }

  function alanYaz(x) {
    var s = x == null ? '' : String(x);
    // Excel'in formül sanmaması için =,+,-,@ ile başlayan metnin başına ' koy.
    if (/^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Satır dizilerini Excel'in Türkçe ayarında doğru açılacak CSV metnine çevirir (BOM'lu).
  function yaz(satirlar) {
    return '﻿' + satirlar.map(function (s) { return s.map(alanYaz).join(';'); }).join('\r\n') + '\r\n';
  }

  function kitaplariSatirla(d) {
    var liste = d.kitaplar.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    return [BASLIKLAR].concat(liste.map(function (k) {
      var yer = Depo.konum(d, k.bolmeId);
      return [k.ad, k.yazar, k.yayinevi, k.barkod, yer ? yer.kod : '',
        k.fiyat == null ? '' : String(k.fiyat).replace('.', ','), k.stok == null ? '' : k.stok];
    }));
  }

  // Başlık adlarını alanlara eşle (sıra serbest, Türkçe harf ve büyük/küçük harf önemsiz).
  var ESLER = {
    ad: ['kitap adi', 'kitap', 'ad', 'adi', 'baslik', 'isim', 'urun', 'urun adi'],
    yazar: ['yazar', 'yazarlar'],
    yayinevi: ['yayinevi', 'yayin evi', 'yayinci'],
    barkod: ['barkod', 'isbn', 'barcode'],
    konum: ['raf bolme', 'raf', 'bolme', 'konum', 'yer', 'raf no'],
    fiyat: ['fiyat', 'fiyati', 'satis fiyati'],
    stok: ['stok', 'adet', 'miktar']
  };

  function sutunlariBul(baslik) {
    var harita = {};
    baslik.forEach(function (b, i) {
      var n = Arama.sadelestir(b);
      Object.keys(ESLER).forEach(function (alan) {
        if (harita[alan] == null && ESLER[alan].indexOf(n) >= 0) harita[alan] = i;
      });
    });
    return harita;
  }

  // CSV satırlarını kontrol edip eklenecek kitapları ve sorunlu satırları ayırır. Veriyi değiştirmez.
  // Dönüş: { kitaplar: [giris], hatalar: [{ satir, mesaj }], atlanan: sayı }
  function iceAktarHazirla(d, satirlar) {
    var sonuc = { kitaplar: [], hatalar: [], atlanan: 0 };
    if (!satirlar.length) { sonuc.hatalar.push({ satir: 0, mesaj: 'Dosya boş.' }); return sonuc; }
    var s = sutunlariBul(satirlar[0]);
    if (s.ad == null) { sonuc.hatalar.push({ satir: 1, mesaj: '“Kitap adı” sütunu bulunamadı. İlk satır başlık olmalı.' }); return sonuc; }
    if (s.konum == null) { sonuc.hatalar.push({ satir: 1, mesaj: '“Raf/Bölme” sütunu bulunamadı (ör. 2.3).' }); return sonuc; }
    var kopya = JSON.parse(JSON.stringify(d));
    for (var i = 1; i < satirlar.length; i++) {
      var r = satirlar[i];
      var al = function (alan) { return s[alan] == null ? '' : String(r[s[alan]] || '').trim(); };
      var yer = Depo.bolmeBul(kopya, al('konum'));
      if (!al('ad')) { sonuc.hatalar.push({ satir: i + 1, mesaj: 'Kitap adı boş.' }); continue; }
      if (!yer) { sonuc.hatalar.push({ satir: i + 1, mesaj: '“' + al('konum') + '” diye bir bölme yok.' }); continue; }
      var giris = { ad: al('ad'), yazar: al('yazar'), yayinevi: al('yayinevi'), barkod: al('barkod'),
        bolmeId: yer.bolme.id, fiyat: al('fiyat').replace(/[₺\s]|TL/gi, ''), stok: al('stok') };
      try {
        Depo.kitapKaydet(kopya, giris); // aynı barkod ve sayı kontrolleri
        sonuc.kitaplar.push(giris);
      } catch (e) {
        if (e.kod === 'AYNI_BARKOD') sonuc.atlanan++;
        else sonuc.hatalar.push({ satir: i + 1, mesaj: e.message });
      }
    }
    return sonuc;
  }

  var api = { oku: oku, yaz: yaz, kitaplariSatirla: kitaplariSatirla, iceAktarHazirla: iceAktarHazirla, BASLIKLAR: BASLIKLAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Csv = api;
})(this);
