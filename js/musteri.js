// Müşteri ekranı (kiosk): karşılama, arama, sonuç kartı, raf şeması, raf QR'ı, ekran klavyesi.
(function () {
  var O = Ortak;
  var d = Depo.bos();
  var $ = function (id) { return document.getElementById(id); };
  var sorgu = $('sorgu');
  var sonuc = $('sonuc');
  var karsilama = $('karsilama');
  var seciliKitapId = null;
  var BOSTA_SURE = 90 * 1000; // Dokunulmazsa 90 sn sonra başa döner.
  var adres = new URLSearchParams(location.search);
  var kioskModu = adres.get('kiosk') === '1' ||
    (window.matchMedia && matchMedia('(pointer: coarse)').matches && window.innerWidth >= 1000);
  var telefondan = adres.get('kitap'); // "Telefonuna al" QR'ından gelindiyse

  O.ikonlariDoldur();
  if (kioskModu) sorgu.setAttribute('inputmode', 'none');

  // ---------- Saat ----------
  function saat() {
    var n = new Date();
    $('saat').textContent = n.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    $('tarih').textContent = n.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  saat();
  setInterval(saat, 15000);

  // ---------- Parçalar ----------
  function renk(id) {
    var t = 0;
    String(id).split('').forEach(function (c) { t = (t * 31 + c.charCodeAt(0)) % 9973; });
    return t % 6; // 0: koyu gri, 1-5: renkli kapak
  }
  function kapak(k, sinif) {
    return k.kapak
      ? '<img class="k-kapak ' + (sinif || '') + '" src="' + O.kacis(k.kapak) + '" alt="" loading="lazy">'
      : '<div class="k-kapak-yok r' + renk(k.id) + ' ' + (sinif || '') + '"><b>' + O.kacis(k.ad) + '</b><span>' + O.kacis(k.yazar || k.yayinevi || '') + '</span></div>';
  }
  function kart(k, secili) {
    var yer = Depo.konum(d, k.bolmeId);
    return '<button type="button" class="k-kart" data-kitap="' + O.kacis(k.id) + '"' + (secili ? ' aria-current="true"' : '') + '>' +
      kapak(k) + '<span class="k-ad">' + O.kacis(k.ad) + '</span>' +
      '<span class="k-yazar">' + O.kacis(k.yazar || k.yayinevi || '') + '</span>' +
      '<span class="k-kod">' + (yer ? yer.kod : '?') + '</span></button>';
  }
  function stokRozeti(k) {
    if (!d.ayarlar.stok || k.stok == null) return '';
    if (k.stok === 0) return '<span class="k-rozet yok">Tükendi</span>';
    if (k.stok <= 2) return '<span class="k-rozet az">Son ' + k.stok + ' adet</span>';
    return '<span class="k-rozet var">Rafta var</span>';
  }
  function sema(hedefBolmeId, hedefRafId) {
    var raflar = O.sirali(d.raflar);
    if (!raflar.length) return '';
    return '<div class="kart"><div class="k-bolum-baslik"><h2 style="font-size:20px">Raf şeması</h2>' +
      (hedefBolmeId || hedefRafId ? '<span class="soluk">Turuncu: aradığınız yer</span>' : '') + '</div><div class="sema">' +
      raflar.map(function (r) {
        var icinde = r.id === hedefRafId || r.bolmeler.some(function (b) { return b.id === hedefBolmeId; });
        return '<div class="raf' + (icinde ? ' vurgu' : '') + '"><div class="raf-bas"><div class="raf-ad"><strong>' + r.no + '. Raf</strong></div>' +
          (r.etiket ? '<span class="soluk">' + O.kacis(r.etiket) + '</span>' : '') + '</div><div class="bolmeler">' +
          O.siraliBolmeler(r).map(function (b) {
            var bu = b.id === hedefBolmeId;
            return '<div class="bolme' + (bu ? ' hedef' : '') + '"' + (bu ? ' aria-label="Aradığınız kitap burada"' : '') + '>' + r.no + '.' + b.no + '</div>';
          }).join('') + '</div></div>';
      }).join('') + '</div></div>';
  }
  function telefonQr(k) {
    if (typeof window.qrcode !== 'function' || telefondan) return '';
    var url = location.origin + location.pathname + '?kitap=' + encodeURIComponent(k.id);
    var qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return '<div class="k-telefon">' + qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) +
      '<div><b>Telefonunuza alın</b><span>Kameranızla okutun; kitabın yeri telefonunuzda açılsın.</span></div></div>';
  }

  // ---------- Ekranlar ----------
  function karsilamaCiz() {
    var raflar = O.sirali(d.raflar);
    $('raf-gezin-kutu').hidden = !raflar.length;
    $('raf-gezin').innerHTML = raflar.map(function (r) {
      return '<button type="button" class="k-raf-dugme" data-raf="' + r.id + '"><b>' + r.no + '. Raf</b><span>' +
        O.kacis(r.etiket || 'Raf ' + r.no) + ' · ' + Depo.rafKitapSayisi(d, r) + ' kitap</span></button>';
    }).join('');
    var yeniler = d.kitaplar.slice().sort(function (a, b) { return String(b.eklendi || '').localeCompare(String(a.eklendi || '')); }).slice(0, 6);
    $('yeniler-kutu').hidden = !yeniler.length;
    $('yeniler').innerHTML = yeniler.map(function (k) { return kart(k, false); }).join('');
  }

  function karsilamaGoster() {
    seciliKitapId = null;
    sonuc.hidden = true;
    karsilama.hidden = false;
    karsilamaCiz();
  }

  function sonucGoster(html) {
    karsilama.hidden = true;
    sonuc.hidden = false;
    sonuc.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function detayCiz(k, digerleri, digerBaslik) {
    var yer = Depo.konum(d, k.bolmeId);
    var rozetler = (d.ayarlar.fiyat && k.fiyat != null ? '<span class="k-rozet">' + O.para(k.fiyat) + '</span>' : '') + stokRozeti(k);
    var sol = '<div class="kart k-detay">' +
      '<div class="k-detay-ust">' + kapak(k) + '<div style="min-width:0"><h2>' + O.kacis(k.ad) + '</h2>' +
      (k.yazar ? '<p class="bilgi">Yazar: <strong>' + O.kacis(k.yazar) + '</strong></p>' : '') +
      (k.yayinevi ? '<p class="bilgi">Yayınevi: <strong>' + O.kacis(k.yayinevi) + '</strong></p>' : '') +
      (k.barkod ? '<p class="soluk" style="margin-top:6px">Barkod: ' + O.kacis(k.barkod) + '</p>' : '') + '</div></div>' +
      (yer
        ? '<div class="k-yer">' + O.ikon.konum + '<div><p>Bu kitap burada</p><strong>' + yer.raf.no + '. Raf · Bölme ' + yer.kod + '</strong>' +
          (yer.raf.etiket ? '<p style="font-weight:500;margin-top:4px">' + O.kacis(yer.raf.etiket) + ' rafı</p>' : '') + '</div></div>'
        : '<div class="mesaj hata">Bu kitabın rafı kayıtlı değil. Lütfen görevliye sorun.</div>') +
      (rozetler ? '<div class="k-rozetler">' + rozetler + '</div>' : '') +
      telefonQr(k) + '</div>';
    var sag = sema(k.bolmeId) +
      (digerleri.length ? '<div><h3 class="k-liste-baslik">' + digerBaslik + '</h3><div class="k-izgara">' +
        digerleri.map(function (x) { return kart(x, x.id === k.id); }).join('') + '</div></div>' : '');
    return '<div class="k-sonuc"><div class="bolum" style="display:flex;flex-direction:column;gap:16px">' +
      '<button type="button" class="dugme k-geri" data-is="ana"><span data-ikon="geri"></span>Başa dön</button>' + sol + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' + sag + '</div></div>';
  }

  function kitapGoster(k, liste) {
    seciliKitapId = k.id;
    var baslik, digerleri;
    if (liste && liste.length > 1) { digerleri = liste.slice(0, 24); baslik = liste.length + ' kitap bulundu'; }
    else {
      digerleri = Depo.bolmeKitaplari(d, k.bolmeId).filter(function (x) { return x.id !== k.id; }).slice(0, 12);
      baslik = 'Aynı bölmedeki diğer kitaplar';
    }
    sonucGoster(detayCiz(k, digerleri, baslik));
    O.ikonlariDoldur(sonuc);
  }

  function bolmeGoster(kod) {
    var yer = Depo.bolmeBul(d, kod);
    if (!yer) return bulunamadi(kod);
    var kitaplar = Depo.bolmeKitaplari(d, yer.bolme.id).sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    sonucGoster('<div class="bolum" style="display:flex;flex-direction:column;gap:16px">' +
      '<button type="button" class="dugme k-geri" data-is="ana"><span data-ikon="geri"></span>Başa dön</button>' +
      '<div class="kart"><h2 style="font-size:28px">Bölme ' + yer.kod + '</h2><p class="soluk" style="font-size:16px">' + yer.raf.no + '. Raf' +
      (yer.raf.etiket ? ' · ' + O.kacis(yer.raf.etiket) : '') + ' · ' + kitaplar.length + ' kitap</p></div>' +
      (kitaplar.length ? '<div class="k-izgara">' + kitaplar.map(function (k) { return kart(k, false); }).join('') + '</div>' : '<p class="soluk">Bu bölmede kayıtlı kitap yok.</p>') +
      sema(yer.bolme.id) + '</div>');
    O.ikonlariDoldur(sonuc);
  }

  function rafGoster(rafId) {
    var r = d.raflar.find(function (x) { return x.id === rafId; });
    if (!r) return karsilamaGoster();
    var ids = r.bolmeler.map(function (b) { return b.id; });
    var kitaplar = d.kitaplar.filter(function (k) { return ids.indexOf(k.bolmeId) >= 0; }).sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    sonucGoster('<div style="display:flex;flex-direction:column;gap:16px">' +
      '<button type="button" class="dugme k-geri" data-is="ana"><span data-ikon="geri"></span>Başa dön</button>' +
      '<div class="kart"><h2 style="font-size:28px">' + r.no + '. Raf' + (r.etiket ? ' · ' + O.kacis(r.etiket) : '') + '</h2><p class="soluk" style="font-size:16px">' + kitaplar.length + ' kitap</p></div>' +
      (kitaplar.length ? '<div class="k-izgara">' + kitaplar.map(function (k) { return kart(k, false); }).join('') + '</div>' : '<p class="soluk">Bu rafta kayıtlı kitap yok.</p>') +
      sema(null, r.id) + '</div>');
    O.ikonlariDoldur(sonuc);
  }

  function bulunamadi(s) {
    sonucGoster('<div class="kart" style="text-align:center;padding:48px 20px;display:flex;flex-direction:column;gap:12px;align-items:center">' +
      '<h2 style="font-size:28px">“' + O.kacis(String(s).trim()) + '” bulunamadı</h2>' +
      '<p class="soluk" style="font-size:17px;max-width:520px">Yazımı kontrol edin ya da yalnız bir kelimeyle deneyin. Kitap mağazada yoksa görevliden sipariş isteyebilirsiniz.</p>' +
      '<button type="button" class="dugme" data-is="ana"><span data-ikon="geri"></span>Başa dön</button></div>');
    O.ikonlariDoldur(sonuc);
  }

  // ---------- Arama ----------
  var sonKayit = '';
  function kaydet(s, n) {
    var t = String(s).trim();
    if (t.length < 2 || t === sonKayit || /^RAF:/i.test(t) || telefondan) return;
    sonKayit = t;
    Veri.aramaKaydet(t, n);
  }

  function ara(kayitla) {
    var s = sorgu.value;
    $('temizle').hidden = !s;
    if (!s.trim()) return karsilamaGoster();
    var raf = /^\s*RAF[:\s]*(\d+[.,]\d+)\s*$/i.exec(s);
    if (raf) return bolmeGoster(raf[1]);
    var bulunan = Arama.ara(d.kitaplar, s);
    if (kayitla) kaydet(s, bulunan.length);
    if (!bulunan.length) return bulunamadi(s);
    var secili = bulunan.find(function (k) { return k.id === seciliKitapId; }) || bulunan[0];
    kitapGoster(secili, bulunan);
  }

  var gecikme = null, kayitGecikme = null;
  sorgu.addEventListener('input', function () {
    clearTimeout(gecikme);
    clearTimeout(kayitGecikme);
    seciliKitapId = null;
    gecikme = setTimeout(function () { ara(false); }, 250);
    kayitGecikme = setTimeout(function () { ara(true); }, 2000); // yazmayı bırakınca kaydet
  });
  $('arama-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(gecikme); clearTimeout(kayitGecikme);
    seciliKitapId = null;
    Klavye.kapat();
    ara(true);
  });
  $('temizle').addEventListener('click', function () { sorgu.value = ''; karsilamaGoster(); $('temizle').hidden = true; sorguyaOdaklan(); });

  function okutuldu(kod) {
    sorgu.value = kod;
    seciliKitapId = null;
    ara(true);
  }
  function taramaAc() { Klavye.kapat(); Tarayici.ac(okutuldu); }
  $('tara').addEventListener('click', taramaAc);
  $('secim-tara').addEventListener('click', taramaAc);

  function sorguyaOdaklan() {
    sorgu.focus();
    if (kioskModu) Klavye.ac(sorgu, { araBas: function () { ara(true); } });
  }
  $('secim-yaz').addEventListener('click', sorguyaOdaklan);
  sorgu.addEventListener('focus', function () { if (kioskModu) Klavye.ac(sorgu, { araBas: function () { ara(true); } }); });

  // Barkod okuyucu klavye gibi yazar: odak başka yerdeyse tuşları arama kutusuna yönlendir.
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || document.activeElement === sorgu) return;
    if (document.querySelector('.kamera-perde')) return;
    if (e.key.length === 1) { sorgu.value = ''; sorgu.focus(); }
  });

  // ---------- Tıklamalar ----------
  document.addEventListener('click', function (e) {
    var k = e.target.closest('[data-kitap]');
    if (k) {
      var kitap = d.kitaplar.find(function (x) { return x.id === k.getAttribute('data-kitap'); });
      if (kitap) {
        var liste = sorgu.value.trim() && !/^RAF/i.test(sorgu.value) ? Arama.ara(d.kitaplar, sorgu.value) : null;
        kitapGoster(kitap, liste && liste.some(function (x) { return x.id === kitap.id; }) ? liste : null);
      }
      return;
    }
    var r = e.target.closest('[data-raf]');
    if (r) { rafGoster(r.getAttribute('data-raf')); return; }
    if (e.target.closest('[data-is=ana]')) { sorgu.value = ''; $('temizle').hidden = true; karsilamaGoster(); }
  });
  $('ana-sayfa').addEventListener('click', function () { sorgu.value = ''; $('temizle').hidden = true; Klavye.kapat(); karsilamaGoster(); });
  $('tam-ekran').addEventListener('click', function () {
    var el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
  });

  // ---------- Boşta kalınca başa dön ----------
  var bekleme = null;
  function hareket() {
    clearTimeout(bekleme);
    if (telefondan) return;
    bekleme = setTimeout(function () {
      sorgu.value = ''; $('temizle').hidden = true; Klavye.kapat(); Tarayici.kapat(); karsilamaGoster();
    }, BOSTA_SURE);
  }
  ['pointerdown', 'keydown', 'input'].forEach(function (olay) { document.addEventListener(olay, hareket, true); });

  // ---------- Veri ----------
  function magazaAdi() {
    var ad = d.ayarlar.magazaAdi || 'Kitabım Hangi Rafta?';
    $('magaza-adi').textContent = ad;
    document.title = ad + ' · Kitabım Hangi Rafta';
  }
  function yenidenCiz() {
    magazaAdi();
    if (!sonuc.hidden && sorgu.value.trim()) ara(false);
    else if (sonuc.hidden) karsilamaCiz();
  }
  Veri.dinle(function (yeni) { d = yeni; yenidenCiz(); });
  Veri.yukle().then(function (yeni) {
    d = yeni;
    magazaAdi();
    var k = telefondan && d.kitaplar.find(function (x) { return x.id === telefondan; });
    if (k) kitapGoster(k, null); else karsilamaGoster();
    hareket();
  }).catch(function (e) {
    sonucGoster('<div class="mesaj hata">Kitap listesi yüklenemedi: ' + O.kacis(e.message) + '</div>');
  });
})();
