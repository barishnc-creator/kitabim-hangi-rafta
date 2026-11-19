// Excel ile ürün girişi: mağaza programından gelen listeyi (barkod, ad, yayınevi, adet…) okuyup
// yeni kitapları ve stok artışlarını çıkarır. Veriyi değiştirmez; planı Veri modülü uygular.
// Kurallar (kullanıcının kararları):
//  - Kayıtlı barkod tekrar gelirse adet stoğa EKLENİR (3 + 5 = 8).
//  - Excel'de raf yoksa yeni kitap rafsız kaydedilir ("Rafa yerleştirilecek"), personel sonra yerleştirir.
//  - Tamamı BÜYÜK HARF olan adlar normal yazıma çevrilir (kısaltmalar korunur).
// Saf fonksiyonlar. Tarayıcıda window.Giris, Node'da module.exports.
(function (kok) {
  var Depo = kok.Depo || (typeof require === 'function' ? require('./depo.js') : null);

  function temiz(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
  var SADE = { 'ı': 'i', 'i̇': 'i', 'ş': 's', 'ç': 'c', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'â': 'a', 'î': 'i', 'û': 'u' };
  // Başlık karşılaştırması: küçük harf, Türkçe karaktersiz (MIKTAR → miktar, MALINCINSI → malincinsi).
  function sade(x) { return temiz(x).toLocaleLowerCase('tr-TR').replace(/i̇|[ışçğüöâîû]/g, function (h) { return SADE[h]; }); }

  // ---------- Sütunlar ----------
  // Sıra önemli: bir başlık ilk uyan alana verilir.
  var ALANLAR = [
    ['barkod', /barkod|barcode|isbn|ean|gtin/],
    ['adet', /^(adet|miktar|miktari|giris miktari|giris adedi|qty|quantity|sayi|adedi|stok)$|adet|miktar/], // Stok: programın kendi dışa aktardığı liste
    ['fiyat', /^(fiyat|satis fiyati|etiket fiyati|liste fiyati|perakende fiyat|price)$|fiyat/],
    ['yazar', /yazar|author/],
    ['yayinevi', /yayinevi|yayin evi|yayinci|publisher|marka|^kod ?3$/], // KOD3: bazı mağaza programlarında yayınevi
    ['konum', /^(raf|bolme|raf ?\/ ?bolme|raf bolme|konum|lokasyon|yer|reyon)$/],
    ['ad', /mal ?cins|malin ?cinsi|urun ?adi|stok ?adi|kitap ?adi|^adi?$|isim|eser|baslik|aciklama|kitap|urun/]
  ];
  var BOS_SUTUN = { baslikSatiri: -1, barkod: -1, ad: -1, yazar: -1, yayinevi: -1, adet: -1, fiyat: -1, konum: -1 };

  function barkodGibi(x) { return /^\d{8,19}$/.test(String(x == null ? '' : x).replace(/[\s-]/g, '')); }

  // Başlık satırını ve sütunları bulur (ilk 15 satıra bakar). Başlık yoksa barkod sütunu içerikten seçilir.
  function sutunlariBul(satirlar) {
    var sonuc = Object.assign({}, BOS_SUTUN);
    for (var r = 0; r < Math.min(satirlar.length, 15); r++) {
      var satir = satirlar[r] || [];
      if (!satir.some(function (h) { return /barkod|barcode|isbn|ean|gtin/.test(sade(h)); })) continue;
      sonuc.baslikSatiri = r;
      satir.forEach(function (h, k) {
        var s = sade(h);
        if (!s) return;
        for (var a = 0; a < ALANLAR.length; a++) {
          if (sonuc[ALANLAR[a][0]] < 0 && ALANLAR[a][1].test(s)) { sonuc[ALANLAR[a][0]] = k; return; }
        }
      });
      return sonuc;
    }
    // Başlıksız liste: en çok barkod içeren sütun
    var sayac = [];
    satirlar.slice(0, 200).forEach(function (s) { (s || []).forEach(function (h, k) { if (barkodGibi(h)) sayac[k] = (sayac[k] || 0) + 1; }); });
    sayac.forEach(function (n, k) { if (sonuc.barkod < 0 || n > sayac[sonuc.barkod]) sonuc.barkod = k; });
    return sonuc;
  }

  // ---------- Ad yazımı ----------
  var KISALTMALAR = ('TYT AYT YKS LGS KPSS ALES DGS YDS YDT YÖKDİL MSÜ TOEFL IELTS SAT YÖS MEB ÖSYM BİLSEM TÜBİTAK ' +
    'TDK TBMM TRT ABD AB NATO PDR İHL AÖL KR IQ VIP MÖF DNM DVD CD USB A4 A5 B5 PVC').split(' ');
  var ROMA = /^(II|III|IV|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV|XX)$/;
  var KUCUK_KELIMELER = ['VE', 'İLE', 'VEYA', 'YA', 'DA', 'DE', 'Kİ', 'Mİ', 'İÇİN'];
  var UNLU = /[AEIİOÖUÜaeıioöuü]/;

  // Türkçe klavye kullanılmadan yazılmış adlarda (FIZIK, DEFTERI) İ yerine I yazılır. Böyle adlarda (metinde hiç İ yoksa)
  // kırtasiyede sık geçen kelimeler sözlükten, diğerleri ünlü uyumundan düzeltilir: E/Ö/Ü'lü kelimede I → i.
  var I_SOZLUK = { FIZIK: 'FİZİK', KIMYA: 'KİMYA', BIYOLOJI: 'BİYOLOJİ', MATEMATIK: 'MATEMATİK', TARIH: 'TARİH',
    EDEBIYAT: 'EDEBİYAT', EDEBIYATI: 'EDEBİYATI', INGILIZCE: 'İNGİLİZCE', ALMANCA: 'ALMANCA', GEOMETRI: 'GEOMETRİ',
    FELSEFE: 'FELSEFE', GRI: 'GRİ', BILGI: 'BİLGİ', BILGISI: 'BİLGİSİ', BILIMLER: 'BİLİMLER', BILIMLERI: 'BİLİMLERİ',
    KITAP: 'KİTAP', KITABI: 'KİTABI', KITAPLARI: 'KİTAPLARI', DEFTERI: 'DEFTERİ', SIYAH: 'SİYAH', BEYAZ: 'BEYAZ',
    ILKOKUL: 'İLKOKUL', ILK: 'İLK', IKI: 'İKİ', BIR: 'BİR', SERI: 'SERİ', SETI: 'SETİ', DIN: 'DİN', KULTURU: 'KÜLTÜRÜ',
    SIFIR: 'SIFIR', SINIF: 'SINIF', SORU: 'SORU', BANKASI: 'BANKASI', DENEME: 'DENEME', TURKCE: 'TÜRKÇE', VIDEO: 'VİDEO',
    INKILAP: 'İNKILAP', ISTANBUL: 'İSTANBUL', SIIR: 'ŞİİR', SIIRLERI: 'ŞİİRLERİ', HIKAYE: 'HİKAYE', HIKAYELERI: 'HİKAYELERİ',
    TARIHI: 'TARİHİ', CILT: 'CİLT', CILTLI: 'CİLTLİ', CILTSIZ: 'CİLTSİZ', KITAPLIK: 'KİTAPLIK', SOZLUK: 'SÖZLÜK',
    BILIM: 'BİLİM', BILGISAYAR: 'BİLGİSAYAR', ROMANI: 'ROMANI', DIZISI: 'DİZİSİ', SIYASET: 'SİYASET', DIL: 'DİL',
    BILGISI: 'BİLGİSİ', SINAV: 'SINAV', SINAVI: 'SINAVI', SINAVLAR: 'SINAVLAR', ANLATIMI: 'ANLATIMI', IKINCI: 'İKİNCİ' };
  function iDuzelt(kelime) {
    if (I_SOZLUK[kelime]) return I_SOZLUK[kelime];
    if (/[EÖÜ]/.test(kelime) && !/[AOU]/.test(kelime)) return kelime.replace(/I/g, 'İ');
    return kelime;
  }

  function buyukHarfle(x) { return x.toLocaleUpperCase('tr-TR'); }
  function kucukHarfle(x) { return x.toLocaleLowerCase('tr-TR'); }

  function parcaYaz(p, kelimeBasi, ilkKelime) {
    if (!p) return p;
    var B = buyukHarfle(p);
    if (KISALTMALAR.indexOf(B) >= 0 || ROMA.test(B)) return B;
    if (!UNLU.test(p) && p.length <= 5) return B; // ünlüsüz kısa parçalar kısaltmadır: KR, SB, G.P.T.
    if (kelimeBasi && !ilkKelime && KUCUK_KELIMELER.indexOf(B) >= 0) return kucukHarfle(p);
    return buyukHarfle(p.charAt(0)) + kucukHarfle(p.slice(1));
  }

  // Büyük harfle yazılmış metni normal yazıma çevirir. Harflerin çoğu küçükse (zaten düzgün yazılmışsa) dokunmaz;
  // "HIZ ve RENK" gibi arada tek küçük kelime olan büyük harfli adlar da çevrilir.
  function adYazimi(metin) {
    var s = temiz(metin);
    var buyuk = (s.match(/[A-ZÇĞİÖŞÜÂÎÛ]/g) || []).length, kucuk = (s.match(/[a-zçğıöşüâîû]/g) || []).length;
    if (!s || buyuk === 0 || kucuk / (buyuk + kucuk) > 0.25) return s;
    var noktaliIYok = s.indexOf('İ') < 0;
    var kelimeler = s.split(' ');
    return kelimeler.map(function (kelime, ki) {
      // Kelimeyi harf dizileri ve ayraçlara böl: 5.SINIF → 5 . SINIF, 40'Lİ → 40 ' Lİ
      var parcalar = kelime.match(/[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+|[^A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+/g) || [kelime];
      var kesmeden = false, ilkHarfParcasi = true;
      return parcalar.map(function (p) {
        if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p)) { kesmeden = /['’]$/.test(p); return p; }
        if (noktaliIYok && /I/.test(p) && KISALTMALAR.indexOf(p) < 0 && !ROMA.test(p)) p = iDuzelt(p);
        var sonuc = kesmeden ? kucukHarfle(p) : parcaYaz(p, ilkHarfParcasi, ki === 0);
        kesmeden = false; ilkHarfParcasi = false;
        return sonuc;
      }).join('');
    }).join(' ');
  }

  // ---------- Plan ----------
  function adetOku(x) {
    var s = temiz(x).replace(/\s/g, '');
    if (!s) return { adet: 1 };
    var n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!isFinite(n)) return { hata: '“' + temiz(x) + '” geçerli bir adet değil.' };
    if (n < 0) return { hata: 'Adet eksi olamaz (' + temiz(x) + ').' }; // 0: tükenmiş kitap (dışa aktarılan listede olabilir)
    if (Math.round(n) !== n) return { hata: 'Adet tam sayı olmalı (' + temiz(x) + ').' };
    return { adet: n };
  }
  function barkodTemiz(x) { return temiz(x).replace(/[\s-]/g, ''); }

  // satirlar: tablo (başlık satırı dahil), sutun: sutunlariBul sonucu (kullanıcı değiştirmiş olabilir).
  // Döner: {
  //   yeni:   [{ satir, barkod, ad, yazar, yayinevi, stok, fiyat, bolmeId|null }],
  //   artis:  [{ satir, kitapId, ad, barkod, eskiStok, ek, yeniStok, fiyat|undefined }],
  //   hatalar:[{ satir, mesaj }], bos: boş satır sayısı, toplamAdet, rafsiz: rafsız yeni kitap sayısı, adetSutunuYok
  // }
  function planla(d, satirlar, sutun) {
    var sonuc = { yeni: [], artis: [], hatalar: [], bos: 0, toplamAdet: 0, rafsiz: 0, adetSutunuYok: sutun.adet < 0 };
    if (sutun.barkod < 0) { sonuc.hatalar.push({ satir: 0, mesaj: 'Barkod sütunu bulunamadı.' }); return sonuc; }
    // Eşleştirme anahtarı: barkod; barkodu olmayan satırda kitap adı (Türkçe karaktersiz, küçük harf).
    // Böylece barkodsuz kitaplar da aynı dosya iki kez yüklenince çiftlenmez.
    var kayitli = {};
    d.kitaplar.forEach(function (k) {
      if (k.barkod) kayitli[barkodTemiz(k.barkod)] = k;
      else if (!kayitli['ad:' + sade(k.ad)]) kayitli['ad:' + sade(k.ad)] = k;
    });
    var gruplar = {}, sira = [];
    var al = function (satir, alan) { return sutun[alan] >= 0 ? temiz(satir[sutun[alan]]) : ''; };

    for (var r = sutun.baslikSatiri + 1; r < satirlar.length; r++) {
      var satir = satirlar[r] || [];
      var no = r + 1; // Excel'deki satır numarası
      var barkod = barkodTemiz(satir[sutun.barkod]);
      if (!satir.some(function (h) { return temiz(h); })) { sonuc.bos++; continue; }
      if (!barkod && !al(satir, 'ad')) { sonuc.hatalar.push({ satir: no, mesaj: 'Barkod ve kitap adı boş.' }); continue; }
      if (barkod && !/^[0-9A-Za-z]{4,30}$/.test(barkod)) { sonuc.hatalar.push({ satir: no, mesaj: '“' + barkod + '” geçerli bir barkod değil.' }); continue; }
      var anahtar = barkod || 'ad:' + sade(al(satir, 'ad'));
      var a = sutun.adet >= 0 ? adetOku(satir[sutun.adet]) : { adet: 1 };
      if (a.hata) { sonuc.hatalar.push({ satir: no, mesaj: a.hata }); continue; }
      var fiyatHam = al(satir, 'fiyat').replace(/[₺\s]|TL/gi, '');
      var fiyat = fiyatHam ? Depo.sayiYap(fiyatHam.replace(/\.(?=\d{3}(\D|$))/g, ''), false) : null;
      if (Number.isNaN(fiyat)) { sonuc.hatalar.push({ satir: no, mesaj: '“' + al(satir, 'fiyat') + '” geçerli bir fiyat değil.' }); continue; }
      var g = gruplar[anahtar];
      if (!g) {
        g = gruplar[anahtar] = { anahtar: anahtar, satir: no, barkod: barkod, adet: 0, ad: al(satir, 'ad'), yazar: al(satir, 'yazar'),
          yayinevi: al(satir, 'yayinevi'), konum: al(satir, 'konum'), fiyat: fiyat };
        sira.push(g);
      }
      g.adet += a.adet; // aynı barkod listede birden çok satırda geçerse adetler toplanır
      if (fiyat != null) g.fiyat = fiyat;
    }

    sira.forEach(function (g) {
      sonuc.toplamAdet += g.adet;
      var k = kayitli[g.anahtar];
      if (k && g.adet === 0 && (g.fiyat == null || g.fiyat === k.fiyat)) return; // değişecek bir şey yok
      if (k) {
        var eski = k.stok == null ? 0 : k.stok;
        var a = { satir: g.satir, kitapId: k.id, ad: k.ad, barkod: g.barkod, eskiStok: k.stok, ek: g.adet, yeniStok: eski + g.adet };
        if (g.fiyat != null && g.fiyat !== k.fiyat) a.fiyat = g.fiyat;
        sonuc.artis.push(a);
        return;
      }
      if (!g.ad) { sonuc.hatalar.push({ satir: g.satir, mesaj: g.barkod + ': kitap adı yok; yeni kitap eklenemedi.' }); return; }
      var yer = g.konum ? Depo.bolmeBul(d, g.konum) : null;
      if (g.konum && !yer) { sonuc.hatalar.push({ satir: g.satir, mesaj: '“' + g.konum + '” diye bir bölme yok; kitap rafsız eklenecek.' }); }
      var y = { satir: g.satir, barkod: g.barkod, ad: adYazimi(g.ad), yazar: adYazimi(g.yazar), yayinevi: adYazimi(g.yayinevi),
        stok: g.adet, fiyat: g.fiyat, bolmeId: yer ? yer.bolme.id : null };
      if (!y.bolmeId) sonuc.rafsiz++;
      sonuc.yeni.push(y);
    });
    // Rafsız eklenecek uyarısı hata sayılmaz: kitap yine eklenir
    sonuc.uyarilar = sonuc.hatalar.filter(function (h) { return /rafsız eklenecek/.test(h.mesaj); });
    sonuc.hatalar = sonuc.hatalar.filter(function (h) { return !/rafsız eklenecek/.test(h.mesaj); });
    return sonuc;
  }

  var api = { sutunlariBul: sutunlariBul, adYazimi: adYazimi, planla: planla, adetOku: adetOku, sade: sade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Giris = api;
})(this);
