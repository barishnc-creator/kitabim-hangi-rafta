// Excel ile alışveriş: kitap listesini CSV olarak dışa aktarma ve CSV okuma/yazma (içe aktarma: js/giris.js).
// Türkçe Excel ";" ayırıcı kullanır; ',' ve sekme de tanınır. Depo'ya ihtiyaç duyar.
// Tarayıcıda window.Csv, Node'da module.exports.
(function (kok) {
  var Depo = kok.Depo || (typeof require === 'function' ? require('./depo.js') : null);

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

  var api = { oku: oku, yaz: yaz, kitaplariSatirla: kitaplariSatirla, BASLIKLAR: BASLIKLAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Csv = api;
})(this);
