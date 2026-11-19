// Eski Excel (.xls, Excel 97–2003 / BIFF8) okuma, dış kütüphane olmadan.
// Mağaza ve muhasebe programları listeleri çoğu zaman bu biçimde verir.
// .xls bir "Compound File" (küçük bir dosya sistemi) içindeki "Workbook" akışıdır; akış kayıtlardan oluşur.
// Okunanlar: metin (paylaşılan metin tablosu ve doğrudan metin), sayı, RK sayı, formül sonucu, mantıksal değer.
// Xls.oku(ArrayBuffer | Uint8Array) → Promise<{ sayfa, satirlar: [[metin, ...], ...] }> (ilk sayfa)
// Xls.xlsMi(bayt) → dosya .xls (Compound File) mı?
// Tarayıcıda window.Xls, Node'da module.exports.
(function (kok) {
  var IMZA = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  var SON = 0xFFFFFFFE, BOS = 0xFFFFFFFF;

  function hataYap(mesaj) { var e = new Error(mesaj); e.kullaniciMesaji = true; return e; }
  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
  function baytYap(x) { return x instanceof Uint8Array ? x : new Uint8Array(x.buffer ? x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength) : x); }

  function xlsMi(bayt) {
    bayt = baytYap(bayt);
    if (bayt.length < 512) return false;
    for (var i = 0; i < 8; i++) if (bayt[i] !== IMZA[i]) return false;
    return true;
  }

  // ---------- Compound File: içindeki akışı (stream) çıkar ----------
  function akisOku(bayt, adlar) {
    var sektorBoy = 1 << u16(bayt, 0x1E), miniBoy = 1 << u16(bayt, 0x20);
    var miniSinir = u32(bayt, 0x38);
    var sektor = function (n) { return 512 + n * sektorBoy; };

    // FAT sektörlerinin listesi (DIFAT): başlıkta 109 tane, fazlası zincirde
    var fatSektorleri = [];
    for (var i = 0; i < 109; i++) { var s = u32(bayt, 0x4C + i * 4); if (s < SON) fatSektorleri.push(s); }
    var difat = u32(bayt, 0x44), difatSay = u32(bayt, 0x48), koruma = 0;
    while (difat < SON && difatSay-- > 0 && koruma++ < 10000) {
      var yer = sektor(difat);
      for (var j = 0; j < sektorBoy / 4 - 1; j++) { var t = u32(bayt, yer + j * 4); if (t < SON) fatSektorleri.push(t); }
      difat = u32(bayt, yer + sektorBoy - 4);
    }
    var fat = [];
    fatSektorleri.forEach(function (fs) {
      var y = sektor(fs);
      for (var k = 0; k < sektorBoy / 4; k++) fat.push(u32(bayt, y + k * 4));
    });

    function zincir(baslangic, tablo, okuyucu, boy) {
      var parcalar = [], n = baslangic, sinir = 0;
      while (n < SON && sinir++ < 1000000) {
        parcalar.push(okuyucu(n));
        n = tablo[n];
        if (n === undefined) throw hataYap('Excel (.xls) dosyası bozuk görünüyor.');
      }
      var toplam = new Uint8Array(parcalar.length * boy);
      parcalar.forEach(function (p, x) { toplam.set(p, x * boy); });
      return toplam;
    }
    var buyukOku = function (n) { var y = sektor(n); return bayt.subarray(y, y + sektorBoy); };

    // Dizin girişleri
    var dizin = zincir(u32(bayt, 0x30), fat, buyukOku, sektorBoy);
    var girisler = [];
    for (var d = 0; d + 128 <= dizin.length; d += 128) {
      var adBoy = u16(dizin, d + 0x40), ad = '';
      for (var c = 0; c + 2 < adBoy; c += 2) ad += String.fromCharCode(u16(dizin, d + c));
      girisler.push({ ad: ad, tur: dizin[d + 0x42], bas: u32(dizin, d + 0x74), boy: u32(dizin, d + 0x78) });
    }
    var kok_ = girisler[0];
    var giris = null;
    for (var a = 0; a < adlar.length && !giris; a++) {
      giris = girisler.find(function (g) { return g.tur === 2 && g.ad.toLowerCase() === adlar[a].toLowerCase(); }) || null;
    }
    if (!giris) return null;

    var veri;
    if (giris.boy < miniSinir) {
      // Küçük akışlar "mini" sektörlerde, kök girişin akışı içinde durur
      var miniFat = [];
      var mf = zincir(u32(bayt, 0x3C), fat, buyukOku, sektorBoy);
      for (var m = 0; m + 4 <= mf.length; m += 4) miniFat.push(u32(mf, m));
      var miniAkis = zincir(kok_.bas, fat, buyukOku, sektorBoy);
      veri = zincir(giris.bas, miniFat, function (n) { return miniAkis.subarray(n * miniBoy, (n + 1) * miniBoy); }, miniBoy);
    } else {
      veri = zincir(giris.bas, fat, buyukOku, sektorBoy);
    }
    return veri.subarray(0, giris.boy);
  }

  // ---------- BIFF8 ----------
  function rkSayi(rk) {
    var sayi;
    if (rk & 2) sayi = rk >> 2; // 30 bit işaretli tam sayı
    else {
      var b = new DataView(new ArrayBuffer(8));
      b.setUint32(0, 0, true); b.setUint32(4, rk & 0xFFFFFFFC, true);
      sayi = b.getFloat64(0, true);
    }
    return (rk & 1) ? sayi / 100 : sayi;
  }

  // Sayıyı Excel'de görünen haliyle yaz: barkod gibi büyük tam sayılar bilimsel gösterime dönmesin.
  function sayiMetni(x) {
    if (!isFinite(x)) return '';
    if (Number.isInteger(x)) return Math.abs(x) < 1e21 ? x.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 0 }) : String(x);
    return String(Math.round(x * 1e10) / 1e10);
  }

  // Kayıt parçalarının (ana kayıt + CONTINUE) üzerinde metin okuyucu. Bir metin CONTINUE sınırını
  // aşarsa yeni parçanın ilk baytı, kalan karakterlerin sıkıştırılmış (1 bayt) mı 2 bayt mı olduğunu söyler.
  function ParcaOkuyucu(parcalar) { this.p = parcalar; this.i = 0; this.y = 0; }
  ParcaOkuyucu.prototype.kalan = function () { return this.p[this.i].length - this.y; };
  ParcaOkuyucu.prototype.ilerle = function () {
    while (this.i < this.p.length && this.y >= this.p[this.i].length) { this.i++; this.y = 0; }
  };
  ParcaOkuyucu.prototype.bayt = function () { this.ilerle(); return this.p[this.i][this.y++]; };
  ParcaOkuyucu.prototype.u16 = function () { return this.bayt() | (this.bayt() << 8); };
  ParcaOkuyucu.prototype.u32 = function () { return (this.u16() | (this.u16() << 16)) >>> 0; };
  ParcaOkuyucu.prototype.atla = function (n) {
    while (n > 0) { this.ilerle(); if (this.i >= this.p.length) return; var k = Math.min(n, this.kalan()); this.y += k; n -= k; }
  };
  ParcaOkuyucu.prototype.bitti = function () { this.ilerle(); return this.i >= this.p.length; };
  // XLUnicodeRichExtendedString (SST içindeki metin)
  ParcaOkuyucu.prototype.metin = function () {
    var uzunluk = this.u16(), bayrak = this.bayt();
    var genis = bayrak & 1, zengin = bayrak & 8, ek = bayrak & 4;
    var calisma = zengin ? this.u16() : 0, ekBoy = ek ? this.u32() : 0;
    var s = '';
    while (uzunluk > 0 && this.i < this.p.length) {
      if (this.y >= this.p[this.i].length) {
        // Karakterler bir CONTINUE kaydına taşıyor: yeni parçanın ilk baytı kalan karakterlerin bayrağıdır.
        this.i++; this.y = 0;
        if (this.i >= this.p.length) break;
        genis = this.p[this.i][0] & 1; this.y = 1;
      }
      var parca = this.p[this.i];
      while (uzunluk > 0 && this.y < parca.length) {
        if (genis) { if (this.y + 1 >= parca.length) { this.y = parca.length; break; } s += String.fromCharCode(parca[this.y] | (parca[this.y + 1] << 8)); this.y += 2; }
        else { s += String.fromCharCode(parca[this.y]); this.y += 1; }
        uzunluk--;
      }
    }
    this.atla(calisma * 4 + ekBoy);
    return s;
  };

  // Tek parça içindeki metin (LABEL, STRING, BOUNDSHEET): uzunluk 1 ya da 2 bayt
  function metinOku(b, i, uzunlukBayti) {
    var uzunluk = uzunlukBayti === 1 ? b[i] : u16(b, i);
    i += uzunlukBayti;
    var bayrak = b[i++], s = '';
    if (bayrak & 8) i += 2; // zengin metin (biçim bilgisi atlanır)
    if (bayrak & 4) i += 4;
    for (var k = 0; k < uzunluk && i < b.length; k++) {
      if (bayrak & 1) { s += String.fromCharCode(u16(b, i)); i += 2; }
      else { s += String.fromCharCode(b[i]); i += 1; }
    }
    return s;
  }

  function kayitlar(akis) {
    var liste = [], i = 0;
    while (i + 4 <= akis.length) {
      var tur = u16(akis, i), boy = u16(akis, i + 2);
      liste.push({ tur: tur, yer: i, veri: akis.subarray(i + 4, i + 4 + boy) });
      i += 4 + boy;
    }
    return liste;
  }

  function oku(arabellek) {
    return Promise.resolve().then(function () {
      var bayt = baytYap(arabellek);
      if (!xlsMi(bayt)) throw hataYap('Dosya bir Excel (.xls) dosyası değil ya da bozuk.');
      var akis = akisOku(bayt, ['Workbook', 'Book']);
      if (!akis) throw hataYap('Excel (.xls) dosyasının içinde tablo bulunamadı.');
      var liste = kayitlar(akis);
      var ilk = liste[0];
      if (!ilk || ilk.tur !== 0x0809 || u16(ilk.veri, 0) !== 0x0600) {
        throw hataYap('Bu çok eski bir Excel biçimi (Excel 95 ya da öncesi). Dosyayı Excel\'de açıp “.xlsx” olarak kaydedin.');
      }

      // Çalışma kitabı bölümü: paylaşılan metinler ve sayfaların yeri
      var sst = [], sayfalar = [];
      for (var n = 0; n < liste.length; n++) {
        var k = liste[n];
        if (k.tur === 0x002F) throw hataYap('Excel dosyası şifreli. Şifreyi kaldırıp yeniden kaydedin.');
        if (k.tur === 0x0085) sayfalar.push({ yer: u32(k.veri, 0), tur: k.veri[5], ad: metinOku(k.veri, 6, 1) });
        if (k.tur === 0x00FC) {
          var parcalar = [k.veri.subarray(8)];
          while (n + 1 < liste.length && liste[n + 1].tur === 0x003C) parcalar.push(liste[++n].veri);
          var adet = u32(k.veri, 4), o = new ParcaOkuyucu(parcalar);
          for (var s = 0; s < adet && !o.bitti(); s++) sst.push(o.metin());
        }
        if (k.tur === 0x000A) break; // çalışma kitabı bölümünün sonu
      }
      var sayfa = sayfalar.find(function (x) { return x.tur === 0; }) || sayfalar[0];
      if (!sayfa) throw hataYap('Excel (.xls) dosyasında sayfa bulunamadı.');

      // İlk sayfanın hücreleri
      var satirlar = [], bekleyenFormul = null;
      var koy = function (r, c, deger) {
        while (satirlar.length <= r) satirlar.push([]);
        var satir = satirlar[r];
        while (satir.length < c) satir.push('');
        satir[c] = deger;
      };
      var basla = liste.findIndex(function (x) { return x.yer === sayfa.yer; });
      for (var m = basla + 1; m > 0 && m < liste.length; m++) {
        var h = liste[m], v = h.veri;
        if (h.tur === 0x000A) break;
        if (h.tur === 0x00FD) koy(u16(v, 0), u16(v, 2), sst[u32(v, 6)] || '');
        else if (h.tur === 0x0204) koy(u16(v, 0), u16(v, 2), metinOku(v, 6, 2));
        else if (h.tur === 0x0203) koy(u16(v, 0), u16(v, 2), sayiMetni(new DataView(v.buffer, v.byteOffset + 6, 8).getFloat64(0, true)));
        else if (h.tur === 0x027E) koy(u16(v, 0), u16(v, 2), sayiMetni(rkSayi(u32(v, 6))));
        else if (h.tur === 0x00BD) {
          var r = u16(v, 0), c0 = u16(v, 2), say = (v.length - 6) / 6;
          for (var x = 0; x < say; x++) koy(r, c0 + x, sayiMetni(rkSayi(u32(v, 4 + x * 6 + 2))));
        } else if (h.tur === 0x0205) {
          koy(u16(v, 0), u16(v, 2), v[7] ? '' : (v[6] ? 'DOĞRU' : 'YANLIŞ'));
        } else if (h.tur === 0x0006) {
          var rr = u16(v, 0), cc = u16(v, 2);
          if (v[12] === 0xFF && v[13] === 0xFF) {
            if (v[6] === 0) bekleyenFormul = [rr, cc]; // sonuç metin: sıradaki STRING kaydında
            else if (v[6] === 1) koy(rr, cc, v[8] ? 'DOĞRU' : 'YANLIŞ');
          } else koy(rr, cc, sayiMetni(new DataView(v.buffer, v.byteOffset + 6, 8).getFloat64(0, true)));
        } else if (h.tur === 0x0207 && bekleyenFormul) {
          koy(bekleyenFormul[0], bekleyenFormul[1], metinOku(v, 0, 2));
          bekleyenFormul = null;
        }
      }
      return { sayfa: sayfa.ad, satirlar: satirlar };
    });
  }

  var api = { oku: oku, xlsMi: xlsMi, sayiMetni: sayiMetni, rkSayi: rkSayi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Xls = api;
})(this);
