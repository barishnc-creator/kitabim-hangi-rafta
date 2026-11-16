// Raf, bölme ve kitap kuralları. Saf fonksiyonlar: verilen durum nesnesini değiştirir,
// kaydetmeyi Veri modülü yapar. Tarayıcıda window.Depo, Node'da module.exports.
//
// Durum şekli:
// { raflar:   [{ id, no, etiket, bolmeler: [{ id, no }] }],
//   kitaplar: [{ id, ad, yazar, yayinevi, barkod, bolmeId, fiyat, stok, kapak, eklendi }],
//   ayarlar:  { fiyat: true, stok: true, magazaAdi: '' } }
(function (kok) {
  function yeniId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hata(kod, mesaj, ek) {
    var e = new Error(mesaj);
    e.kod = kod;
    if (ek) Object.keys(ek).forEach(function (k) { e[k] = ek[k]; });
    return e;
  }

  function bos() {
    return { raflar: [], kitaplar: [], ayarlar: { fiyat: true, stok: true, magazaAdi: '' } };
  }

  function enBuyuk(liste) {
    return liste.reduce(function (m, x) { return Math.max(m, x.no); }, 0);
  }

  function raf(d, rafId) {
    var r = d.raflar.find(function (x) { return x.id === rafId; });
    if (!r) throw hata('YOK', 'Raf bulunamadı.');
    return r;
  }

  // Bölmenin yerini döndürür: { raf, bolme, kod: "2.3" } ya da null.
  function konum(d, bolmeId) {
    for (var i = 0; i < d.raflar.length; i++) {
      var r = d.raflar[i];
      var b = r.bolmeler.find(function (x) { return x.id === bolmeId; });
      if (b) return { raf: r, bolme: b, kod: r.no + '.' + b.no };
    }
    return null;
  }

  // "2.3" gibi bir koddan bölmeyi bulur; yoksa null.
  function bolmeBul(d, kod) {
    var m = /^\s*(\d+)\s*[.,\-/ ]\s*(\d+)\s*$/.exec(String(kod == null ? '' : kod));
    if (!m) return null;
    var r = d.raflar.find(function (x) { return x.no === Number(m[1]); });
    var b = r && r.bolmeler.find(function (x) { return x.no === Number(m[2]); });
    return b ? { raf: r, bolme: b, kod: r.no + '.' + b.no } : null;
  }

  // Kapak adresi: yalnız https (sayfa güvenliği için); Google'ın http adresleri https'e çevrilir.
  function kapakAdresi(url) {
    var u = String(url || '').trim().replace(/^http:\/\//i, 'https://');
    return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
  }

  function bolmeKitaplari(d, bolmeId) {
    return d.kitaplar.filter(function (k) { return k.bolmeId === bolmeId; });
  }

  function rafKitapSayisi(d, r) {
    var ids = r.bolmeler.map(function (b) { return b.id; });
    return d.kitaplar.filter(function (k) { return ids.indexOf(k.bolmeId) >= 0; }).length;
  }

  // Yeni raf, en büyük numaranın bir fazlasını alır. Aradaki bir raf silinince
  // diğerleri yeniden numaralanmaz, böylece raflara yapıştırılmış etiketler kaymaz.
  function rafEkle(d, etiket, bolmeSayisi) {
    var r = { id: yeniId(), no: enBuyuk(d.raflar) + 1, etiket: String(etiket || '').trim(), bolmeler: [] };
    d.raflar.push(r);
    for (var i = 0; i < (bolmeSayisi == null ? 1 : bolmeSayisi); i++) bolmeEkle(d, r.id);
    return r;
  }

  function rafGuncelle(d, rafId, alanlar) {
    var r = raf(d, rafId);
    if (alanlar.etiket != null) r.etiket = String(alanlar.etiket).trim();
    return r;
  }

  function rafSil(d, rafId) {
    var r = raf(d, rafId);
    var n = rafKitapSayisi(d, r);
    if (n > 0) throw hata('DOLU', r.no + '. rafta ' + n + ' kitap var. Önce kitapları başka bölmeye taşıyın.');
    d.raflar = d.raflar.filter(function (x) { return x.id !== rafId; });
  }

  function bolmeEkle(d, rafId) {
    var r = raf(d, rafId);
    var b = { id: yeniId(), no: enBuyuk(r.bolmeler) + 1 };
    r.bolmeler.push(b);
    return b;
  }

  function bolmeSil(d, bolmeId) {
    var k = konum(d, bolmeId);
    if (!k) throw hata('YOK', 'Bölme bulunamadı.');
    var n = bolmeKitaplari(d, bolmeId).length;
    if (n > 0) throw hata('DOLU', k.kod + ' bölmesinde ' + n + ' kitap var. Önce kitapları taşıyın.');
    k.raf.bolmeler = k.raf.bolmeler.filter(function (x) { return x.id !== bolmeId; });
  }

  function sayiYap(deger, tamSayi) {
    if (deger == null || String(deger).trim() === '') return null;
    var n = Number(String(deger).replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(n) || n < 0) return NaN;
    return tamSayi ? Math.floor(n) : Math.round(n * 100) / 100;
  }

  // Yeni kitap ekler ya da id'si verilmiş kitabı günceller.
  // Aynı barkodlu başka kitap varsa secenekler.ayniBarkodaIzin olmadan AYNI_BARKOD hatası verir.
  function kitapKaydet(d, giris, secenekler) {
    secenekler = secenekler || {};
    var ad = String(giris.ad || '').trim();
    if (!ad) throw hata('EKSIK', 'Kitap adı boş olamaz.');
    if (!giris.bolmeId || !konum(d, giris.bolmeId)) throw hata('EKSIK', 'Raf ve bölme seçin.');
    var fiyat = sayiYap(giris.fiyat, false);
    var stok = sayiYap(giris.stok, true);
    if (Number.isNaN(fiyat)) throw hata('GECERSIZ', 'Fiyat geçerli bir sayı olmalı.');
    if (Number.isNaN(stok)) throw hata('GECERSIZ', 'Stok geçerli bir sayı olmalı.');
    var barkod = String(giris.barkod || '').replace(/\s+/g, '');

    var onceki = giris.id ? d.kitaplar.find(function (k) { return k.id === giris.id; }) : null;
    var barkodDegisti = !onceki || onceki.barkod !== barkod;
    if (barkod && barkodDegisti && !secenekler.ayniBarkodaIzin) {
      var ayni = d.kitaplar.find(function (k) { return k.barkod === barkod && k.id !== giris.id; });
      if (ayni) throw hata('AYNI_BARKOD', 'Bu barkodla kayıtlı bir kitap zaten var: ' + ayni.ad, { kitap: ayni });
    }

    var kayit = {
      id: giris.id || yeniId(),
      ad: ad,
      yazar: String(giris.yazar || '').trim(),
      yayinevi: String(giris.yayinevi || '').trim(),
      barkod: barkod,
      bolmeId: giris.bolmeId,
      fiyat: fiyat,
      stok: stok,
      kapak: kapakAdresi(giris.kapak),
      eklendi: (onceki && onceki.eklendi) || giris.eklendi || new Date().toISOString()
    };
    var i = d.kitaplar.findIndex(function (k) { return k.id === kayit.id; });
    if (i >= 0) d.kitaplar[i] = kayit; else d.kitaplar.push(kayit);
    return kayit;
  }

  function kitapSil(d, kitapId) {
    d.kitaplar = d.kitaplar.filter(function (k) { return k.id !== kitapId; });
  }

  // Yedekten gelen veriyi doğrulayıp eksik alanları tamamlar.
  function duzelt(ham) {
    var d = bos();
    if (!ham || typeof ham !== 'object') return d;
    if (Array.isArray(ham.raflar)) d.raflar = ham.raflar.filter(function (r) { return r && r.id; }).map(function (r) {
      return { id: r.id, no: Number(r.no) || 0, etiket: r.etiket || '', bolmeler: (r.bolmeler || []).filter(function (b) { return b && b.id; }).map(function (b) { return { id: b.id, no: Number(b.no) || 0 }; }) };
    });
    if (Array.isArray(ham.kitaplar)) d.kitaplar = ham.kitaplar.filter(function (k) { return k && k.id && k.ad; });
    if (ham.ayarlar) {
      d.ayarlar.fiyat = ham.ayarlar.fiyat !== false;
      d.ayarlar.stok = ham.ayarlar.stok !== false;
      d.ayarlar.magazaAdi = String(ham.ayarlar.magazaAdi || '').slice(0, 60);
    }
    return d;
  }

  var api = {
    bos: bos, duzelt: duzelt, konum: konum, bolmeBul: bolmeBul, kapakAdresi: kapakAdresi, bolmeKitaplari: bolmeKitaplari, rafKitapSayisi: rafKitapSayisi,
    rafEkle: rafEkle, rafGuncelle: rafGuncelle, rafSil: rafSil, bolmeEkle: bolmeEkle, bolmeSil: bolmeSil,
    kitapKaydet: kitapKaydet, kitapSil: kitapSil
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Depo = api;
})(this);
