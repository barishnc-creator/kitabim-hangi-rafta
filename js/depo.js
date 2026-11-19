// Raf, bölme ve kitap kuralları. Saf fonksiyonlar: verilen durum nesnesini değiştirir,
// kaydetmeyi Veri modülü yapar. Tarayıcıda window.Depo, Node'da module.exports.
//
// Durum şekli:
// { raflar:   [{ id, no, etiket, bolmeler: [{ id, no }] }],
//   kitaplar: [{ id, ad, yazar, yayinevi, barkod, bolmeId, fiyat, kapak, eklendi }],
//   ayarlar:  { fiyat: true, magazaAdi: '' } }
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
    return { raflar: [], kitaplar: [], okulListeleri: [], ayarlar: { fiyat: true, magazaAdi: '' } };
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
    // Excel ile girilen kitap rafsız olabilir (bolmeId null: "Rafa yerleştirilecek"); formdan eklenen kitapta raf zorunlu.
    if (giris.bolmeId ? !konum(d, giris.bolmeId) : !secenekler.rafsizOlabilir) throw hata('EKSIK', 'Raf ve bölme seçin.');
    var fiyat = sayiYap(giris.fiyat, false);
    if (Number.isNaN(fiyat)) throw hata('GECERSIZ', 'Fiyat geçerli bir sayı olmalı.');
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
      bolmeId: giris.bolmeId || null,
      fiyat: fiyat,
      kapak: kapakAdresi(giris.kapak),
      eklendi: (onceki && onceki.eklendi) || giris.eklendi || new Date().toISOString()
    };
    var i = d.kitaplar.findIndex(function (k) { return k.id === kayit.id; });
    if (i >= 0) d.kitaplar[i] = kayit; else d.kitaplar.push(kayit);
    return kayit;
  }

  // Rafa yerleştirilmeyi bekleyen kitaplar (Excel ile girilmiş, bölmesi yok), ada göre sıralı.
  function rafsizKitaplar(d) {
    return d.kitaplar.filter(function (k) { return !k.bolmeId; }).sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
  }

  // Ürün girişi planını (Giris.planla) uygular: yeni kitapları ekler. Döner: { eklenen: [kitap] }
  function urunGirisiUygula(d, plan) {
    return { eklenen: plan.yeni.map(function (y) {
      return kitapKaydet(d, { ad: y.ad, yazar: y.yazar, yayinevi: y.yayinevi, barkod: y.barkod, bolmeId: y.bolmeId, fiyat: y.fiyat },
        { rafsizOlabilir: true, ayniBarkodaIzin: true });
    }) };
  }

  function kitapSil(d, kitapId) {
    d.kitaplar = d.kitaplar.filter(function (k) { return k.id !== kitapId; });
  }

  // ---- Okul listeleri ----
  // liste: { id, okul, sinif, kalemler: [{ metin, kitapId|null }] }
  function okulListesiKaydet(d, giris) {
    var okul = String(giris.okul || '').trim(), sinif = String(giris.sinif || '').trim();
    if (!okul) throw hata('EKSIK', 'Okul adını yazın.');
    if (!sinif) throw hata('EKSIK', 'Sınıfı yazın (örn. 7-A).');
    var ayni = d.okulListeleri.find(function (l) {
      return l.id !== giris.id && l.okul.toLocaleLowerCase('tr-TR') === okul.toLocaleLowerCase('tr-TR') && l.sinif.toLocaleLowerCase('tr-TR') === sinif.toLocaleLowerCase('tr-TR');
    });
    if (ayni) throw hata('AYNI_LISTE', okul + ' · ' + sinif + ' listesi zaten var.');
    // Aynı okul farklı büyük/küçük harfle yazıldıysa mevcut yazımı kullan (müşteri ekranında tek okul görünsün).
    var esOkul = d.okulListeleri.find(function (l) { return l.id !== giris.id && l.okul.toLocaleLowerCase('tr-TR') === okul.toLocaleLowerCase('tr-TR'); });
    if (esOkul) okul = esOkul.okul;
    var kayit = {
      id: giris.id || yeniId(), okul: okul.slice(0, 80), sinif: sinif.slice(0, 20),
      kalemler: (giris.kalemler || []).filter(function (k) { return k && String(k.metin || '').trim(); }).slice(0, 100).map(function (k) {
        return { metin: String(k.metin).trim().slice(0, 200), kitapId: k.kitapId || null };
      })
    };
    var i = d.okulListeleri.findIndex(function (l) { return l.id === kayit.id; });
    if (i >= 0) d.okulListeleri[i] = kayit; else d.okulListeleri.push(kayit);
    return kayit;
  }
  function okulListesiSil(d, id) {
    d.okulListeleri = d.okulListeleri.filter(function (l) { return l.id !== id; });
  }
  // Listenin mağazadaki durumu: her kalem için kitap ve yer; kaç tanesi hazır.
  function listeDurumu(d, liste) {
    var kalemler = liste.kalemler.map(function (k) {
      var kitap = k.kitapId && d.kitaplar.find(function (x) { return x.id === k.kitapId; });
      var yer = kitap && konum(d, kitap.bolmeId);
      var hazir = !!(kitap && yer);
      return { metin: k.metin, kitap: kitap || null, yer: yer || null, hazir: hazir };
    });
    var raflar = {};
    kalemler.forEach(function (k) { if (k.hazir) raflar[k.yer.raf.no] = (raflar[k.yer.raf.no] || 0) + 1; });
    return { kalemler: kalemler, toplam: kalemler.length, hazir: kalemler.filter(function (k) { return k.hazir; }).length, raflar: raflar };
  }

  // ---- Mağaza haritası ----
  // plan: { raflar: { rafId: {x,y,w,h,tarif} }, nesneler: [{id,tur:'kasa'|'giris',x,y,w,h}], kiosk: {x,y}|null }
  // Tüm ölçüler kat planının yüzdesi (0–100); harita her ekran boyutunda aynı görünür.
  function sinirla(v, alt, ust) { v = Number(v); return isFinite(v) ? Math.max(alt, Math.min(ust, Math.round(v * 10) / 10)) : alt; }
  function kutuDuzelt(k) {
    var w = sinirla(k.w, 2, 100), h = sinirla(k.h, 2, 100);
    return { x: sinirla(k.x, 0, 100 - w), y: sinirla(k.y, 0, 100 - h), w: w, h: h };
  }
  function planDuzelt(ham, raflar) {
    var p = { raflar: {}, nesneler: [], kiosk: null };
    if (!ham || typeof ham !== 'object') return p;
    var gecerli = raflar ? raflar.map(function (r) { return r.id; }) : null;
    Object.keys(ham.raflar || {}).forEach(function (id) {
      var k = ham.raflar[id];
      if (!k || (gecerli && gecerli.indexOf(id) < 0)) return;
      var kutu = kutuDuzelt(k);
      kutu.tarif = String(k.tarif || '').slice(0, 80);
      p.raflar[id] = kutu;
    });
    (Array.isArray(ham.nesneler) ? ham.nesneler : []).slice(0, 20).forEach(function (n) {
      if (!n || (n.tur !== 'kasa' && n.tur !== 'giris')) return;
      var kutu = kutuDuzelt(n);
      kutu.id = String(n.id || yeniId()).slice(0, 20);
      kutu.tur = n.tur;
      p.nesneler.push(kutu);
    });
    if (ham.kiosk && isFinite(Number(ham.kiosk.x)) && isFinite(Number(ham.kiosk.y))) p.kiosk = { x: sinirla(ham.kiosk.x, 0, 100), y: sinirla(ham.kiosk.y, 0, 100) };
    return p;
  }

  // ---- Gelince haber ver talepleri ----
  // Telefonu 05XXXXXXXXX biçimine getirir; geçersizse ''.
  function telefonDuzelt(t) {
    var r = String(t || '').replace(/\D+/g, '');
    if (/^90\d{10}$/.test(r)) r = r.slice(2);
    if (/^5\d{9}$/.test(r)) r = '0' + r;
    return /^0[2-5]\d{9}$/.test(r) ? r : '';
  }
  function talepDogrula(g) {
    var kitap = String(g.kitap || '').trim(), ad = String(g.ad || '').trim();
    var telefon = telefonDuzelt(g.telefon);
    if (!kitap) throw hata('EKSIK', 'Aradığınız kitabı yazın.');
    if (!ad) throw hata('EKSIK', 'Adınızı yazın.');
    if (!telefon) throw hata('GECERSIZ', 'Telefon numarasını 05XX XXX XX XX biçiminde yazın.');
    if (g.onay !== true) throw hata('ONAY', 'Devam etmek için bilgilendirme metnini onaylayın.');
    return { kitap: kitap.slice(0, 300), kitapId: g.kitapId || null, ad: ad.slice(0, 60), telefon: telefon, not: String(g.not || '').slice(0, 120), onay: true };
  }

  // Yedekten gelen veriyi doğrulayıp eksik alanları tamamlar.
  function duzelt(ham) {
    var d = bos();
    if (!ham || typeof ham !== 'object') return d;
    if (Array.isArray(ham.raflar)) d.raflar = ham.raflar.filter(function (r) { return r && r.id; }).map(function (r) {
      return { id: r.id, no: Number(r.no) || 0, etiket: r.etiket || '', bolmeler: (r.bolmeler || []).filter(function (b) { return b && b.id; }).map(function (b) { return { id: b.id, no: Number(b.no) || 0 }; }) };
    });
    if (Array.isArray(ham.kitaplar)) d.kitaplar = ham.kitaplar.filter(function (k) { return k && k.id && k.ad; }).map(function (k) {
      var kalan = Object.assign({}, k); delete kalan.stok; return kalan; // eski yerel verideki stok alanı atılır (stok takibi kaldırıldı)
    });
    if (Array.isArray(ham.okulListeleri)) d.okulListeleri = ham.okulListeleri.filter(function (l) { return l && l.id && l.okul; }).map(function (l) {
      return { id: l.id, okul: String(l.okul), sinif: String(l.sinif || ''), kalemler: Array.isArray(l.kalemler) ? l.kalemler.filter(Boolean) : [] };
    });
    if (ham.ayarlar) {
      d.ayarlar.fiyat = ham.ayarlar.fiyat !== false;
      d.ayarlar.magazaAdi = String(ham.ayarlar.magazaAdi || '').slice(0, 60);
      d.ayarlar.renk = /^#[0-9a-f]{6}$/i.test(ham.ayarlar.renk || '') ? ham.ayarlar.renk : '';
      d.ayarlar.logo = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(ham.ayarlar.logo || '') && ham.ayarlar.logo.length <= 300000 ? ham.ayarlar.logo : '';
      d.ayarlar.karsilama = String(ham.ayarlar.karsilama || '').slice(0, 80);
      d.ayarlar.plan = planDuzelt(ham.ayarlar.plan, d.raflar.length ? d.raflar : null);
    }
    return d;
  }

  var api = {
    bos: bos, duzelt: duzelt, konum: konum, bolmeBul: bolmeBul, kapakAdresi: kapakAdresi, bolmeKitaplari: bolmeKitaplari, rafKitapSayisi: rafKitapSayisi,
    rafEkle: rafEkle, rafGuncelle: rafGuncelle, rafSil: rafSil, bolmeEkle: bolmeEkle, bolmeSil: bolmeSil,
    kitapKaydet: kitapKaydet, kitapSil: kitapSil, sayiYap: sayiYap, rafsizKitaplar: rafsizKitaplar, urunGirisiUygula: urunGirisiUygula,
    planDuzelt: planDuzelt, telefonDuzelt: telefonDuzelt, talepDogrula: talepDogrula,
    okulListesiKaydet: okulListesiKaydet, okulListesiSil: okulListesiSil, listeDurumu: listeDurumu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Depo = api;
})(this);
