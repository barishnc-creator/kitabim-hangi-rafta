// Okunan barkodu kabul etmeden önce doğrular.
// Bulanık görüntüde çizgili barkod (EAN/UPC) nadiren de olsa kontrol hanesi tutan YANLIŞ bir sayı olarak okunabilir
// (denendi: 9789944886666 → 0718974886666). Bu yüzden çizgili barkod, iki ayrı okumada aynı çıkınca kabul edilir.
// QR kodun kendi hata düzeltmesi olduğu için ilk okumada kabul edilir.
(function (kok) {
  var EAN = { ean_13: 13, ean_8: 8, upc_a: 12 };

  // EAN-13 / EAN-8 / UPC-A kontrol hanesi doğru mu?
  function kontrolHanesi(kod) {
    if (!/^\d+$/.test(kod)) return false;
    var t = 0, n = kod.length;
    for (var i = 0; i < n - 1; i++) t += Number(kod[n - 2 - i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (t % 10)) % 10 === Number(kod[n - 1]);
  }

  function isbnMi(kod) { return /^97[89]\d{10}$/.test(kod) && kontrolHanesi(kod); }

  function Onay(gerekli) {
    this.gerekli = gerekli || 2;
    this.sayac = {};
  }
  // Bir okuma ekler. Kabul edilen kodu, henüz kabul edilmediyse '' döndürür.
  Onay.prototype.ekle = function (deger, bicim) {
    deger = String(deger || '').trim();
    if (!deger) return '';
    if (bicim === 'qr_code') return deger;
    if (EAN[bicim] && (deger.length !== EAN[bicim] || !kontrolHanesi(deger))) return '';
    this.sayac[deger] = (this.sayac[deger] || 0) + 1;
    return this.sayac[deger] >= this.gerekli ? deger : '';
  };
  // Tarama bitti, hiçbir kod iki kez okunmadı: tek aday varsa ve geçerli bir ISBN ise kabul et.
  Onay.prototype.tekAday = function () {
    var adaylar = Object.keys(this.sayac);
    return adaylar.length === 1 && isbnMi(adaylar[0]) ? adaylar[0] : '';
  };

  var api = { Onay: Onay, kontrolHanesi: kontrolHanesi, isbnMi: isbnMi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.BarkodOnay = api;
})(this);
