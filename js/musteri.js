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
  var telefondan = adres.get('kitap') || adres.get('liste'); // "Telefonuna al" QR'ından gelindiyse

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
  // Mağaza haritası varsa haritayı ve yolu, yoksa raf şemasını gösterir.
  function sema(hedefBolmeId, hedefRafId) {
    var raflar = O.sirali(d.raflar);
    if (!raflar.length) return '';
    var plan = d.ayarlar.plan;
    var hedefRaf = hedefRafId || (hedefBolmeId && (Depo.konum(d, hedefBolmeId) || {}).raf || {}).id;
    if (Harita.haritaVar(plan) && (!hedefRaf || plan.raflar[hedefRaf])) {
      return '<div class="kart"><div class="k-bolum-baslik"><h2 style="font-size:20px">' + (hedefRaf ? 'Rafa nasıl gidilir?' : 'Mağaza haritası') + '</h2>' +
        (hedefRaf ? '<div class="plan-lejant">' + (plan.kiosk ? '<span style="--c:var(--mavi)">Buradasınız</span>' : '') + '<span style="--c:var(--turuncu)">Aradığınız raf</span></div>' : '') + '</div>' +
        Harita.ciz(plan, raflar, hedefRaf) + '</div>';
    }
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
  function tarif(raf) {
    var k = d.ayarlar.plan && d.ayarlar.plan.raflar && d.ayarlar.plan.raflar[raf.id];
    return k && k.tarif ? k.tarif : '';
  }
  function telefonQr(k, tur, baslik, aciklama) {
    if (typeof window.qrcode !== 'function' || telefondan) return '';
    var url = location.origin + location.pathname + '?' + (tur || 'kitap') + '=' + encodeURIComponent(k.id);
    var qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return '<div class="k-telefon">' + qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) +
      '<div><b>' + (baslik || 'Telefonunuza alın') + '</b><span>' + (aciklama || 'Kameranızla okutun; kitabın yeri telefonunuzda açılsın.') + '</span></div></div>';
  }

  // ---------- Ekranlar ----------
  function okullar() {
    var g = {};
    d.okulListeleri.forEach(function (l) { (g[l.okul] = g[l.okul] || []).push(l); });
    Object.keys(g).forEach(function (o) { g[o].sort(function (a, b) { return a.sinif.localeCompare(b.sinif, 'tr', { numeric: true }); }); });
    return g;
  }
  function karsilamaCiz() {
    var g = okullar(), adlar = Object.keys(g).sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    $('okul-kutu').hidden = !adlar.length;
    $('okul-gezin').innerHTML = adlar.map(function (o) {
      return '<button type="button" class="k-raf-dugme" data-okul-ad="' + O.kacis(o) + '"><b style="font-size:18px">' + O.kacis(o) + '</b><span>' + g[o].length + ' sınıf listesi</span></button>';
    }).join('');
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
          (tarif(yer.raf) || yer.raf.etiket ? '<p style="font-weight:500;margin-top:4px">' + O.kacis(tarif(yer.raf) || yer.raf.etiket + ' rafı') + '</p>' : '') + '</div></div>'
        : '<div class="mesaj hata">Bu kitabın rafı kayıtlı değil. Lütfen görevliye sorun.</div>') +
      (rozetler ? '<div class="k-rozetler">' + rozetler + '</div>' : '') +
      (k.stok === 0 && d.ayarlar.stok ? '<button type="button" class="dugme ana" data-talep-kitap="' + O.kacis(k.ad) + '" data-talep-id="' + O.kacis(k.id) + '" style="min-height:56px;font-size:17px">Gelince haber verilsin</button>' : '') +
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

  // ---------- Gelince haber ver ----------
  function talepFormu(kitap, kitapId, not) {
    if (document.querySelector('.talep-perde')) return;
    var perde = document.createElement('div');
    perde.className = 'kamera-perde talep-perde';
    perde.innerHTML =
      '<form class="kart bolum pencere" style="width:min(560px,100%);display:flex;flex-direction:column;gap:14px" role="dialog" aria-modal="true" aria-labelledby="talep-baslik" novalidate>' +
      '<div><h2 id="talep-baslik" style="font-size:26px">Gelince haber verelim</h2><p class="soluk" style="font-size:15px;margin-top:4px">Kitap mağazaya ulaşınca sizi arayalım ya da mesaj atalım.</p></div>' +
      '<div class="alan"><label for="t-kitap">Aradığınız kitap</label><input id="t-kitap" autocomplete="off"></div>' +
      '<div class="alan"><label for="t-ad">Adınız</label><input id="t-ad" autocomplete="off" autocapitalize="words"></div>' +
      '<div class="alan"><label for="t-tel">Telefon</label><input id="t-tel" type="tel" inputmode="tel" autocomplete="off" placeholder="05XX XXX XX XX"></div>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--ikincil)"><input type="checkbox" id="t-onay" style="width:24px;height:24px;flex-shrink:0;accent-color:var(--mavi)">' +
      '<span>Bilgilerimin yalnız bu talep için kullanılmasını ve kitap gelince benimle iletişime geçilmesini kabul ediyorum. <button type="button" id="t-metin" style="background:none;border:0;padding:0;color:var(--mavi);font:inherit;text-decoration:underline;cursor:pointer">Aydınlatma metni</button></span></label>' +
      '<div id="t-mesaj" role="status"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="dugme" id="t-vazgec">Vazgeç</button><button type="submit" class="dugme ana" style="min-width:200px">Talebimi gönder</button></div></form>';
    document.body.appendChild(perde);
    var $p = function (s2) { return perde.querySelector(s2); };
    $p('#t-kitap').value = kitap || '';
    if (kioskModu) ['#t-kitap', '#t-ad', '#t-tel'].forEach(function (s2) {
      var el = $p(s2);
      el.setAttribute('inputmode', 'none');
      el.addEventListener('focus', function () {
        Klavye.ac(el, { onayYazi: 'Gönder', araBas: function () { $p('form').requestSubmit(); } });
      });
    });
    function kapat() { Klavye.kapat(); perde.remove(); document.removeEventListener('keydown', tus); }
    function tus(e) { if (e.key === 'Escape') kapat(); }
    document.addEventListener('keydown', tus);
    $p('#t-vazgec').addEventListener('click', kapat);
    $p('#t-metin').addEventListener('click', function () { O.pencere(O.kvkkMetni(d.ayarlar.magazaAdi), { evet: 'Anladım' }); });
    $p('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var giris = { kitap: $p('#t-kitap').value, kitapId: kitapId, ad: $p('#t-ad').value, telefon: $p('#t-tel').value, onay: $p('#t-onay').checked, not: not || '' };
      try { Depo.talepDogrula(giris); } catch (err) { $p('#t-mesaj').innerHTML = '<div class="mesaj hata">' + O.kacis(err.message) + '</div>'; return; }
      Veri.talepEkle(giris).then(function (t) {
        Klavye.kapat();
        $p('form').innerHTML = '<div style="text-align:center;padding:20px 8px;display:flex;flex-direction:column;gap:12px;align-items:center">' +
          '<div style="width:72px;height:72px;border-radius:50%;background:#DCFCE7;color:#166534;display:flex;align-items:center;justify-content:center;font-size:38px" aria-hidden="true">✓</div>' +
          '<h2 style="font-size:26px">Talebiniz alındı</h2><p class="soluk" style="font-size:16px">“' + O.kacis(t.kitap) + '” gelince ' + O.kacis(t.telefon.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4')) + ' numarasından size haber vereceğiz.</p>' +
          '<button type="button" class="dugme ana" id="t-tamam" style="min-width:160px">Tamam</button></div>';
        $p('#t-tamam').addEventListener('click', kapat);
        setTimeout(function () { if (perde.isConnected) kapat(); }, 8000);
      }).catch(function (err) {
        $p('#t-mesaj').innerHTML = '<div class="mesaj hata">Talep gönderilemedi: ' + O.kacis(err.message) + '</div>';
      });
    });
    setTimeout(function () { $p(kitap ? '#t-ad' : '#t-kitap').focus(); }, 0);
  }

  // ---------- Okul listeleri ----------
  function okulGoster(okul, listeId) {
    var g = okullar(), adlar = Object.keys(g).sort(function (a, b) { return a.localeCompare(b, 'tr'); });
    var liste = listeId && d.okulListeleri.find(function (l) { return l.id === listeId; });
    if (liste) okul = liste.okul;
    if (!okul || !g[okul]) okul = adlar[0];
    if (!okul) return karsilamaGoster();
    var html = '<div style="display:flex;flex-direction:column;gap:18px">' +
      (telefondan ? '' : '<button type="button" class="dugme k-geri" data-is="ana"><span data-ikon="geri"></span>Başa dön</button>') +
      '<div class="kart" style="display:flex;flex-direction:column;gap:14px"><h2 style="font-size:28px">' + (liste ? 'Okul kitap listesi' : 'Okulunuzu ve sınıfınızı seçin') + '</h2>' +
      (telefondan ? '' : '<div class="k-cipler">' + adlar.map(function (o) {
        return '<button type="button" class="secim-cip" data-okul-ad="' + O.kacis(o) + '" aria-pressed="' + (o === okul) + '">' + O.kacis(o) + '</button>';
      }).join('') + '</div>' +
      '<div class="k-cipler">' + g[okul].map(function (l) {
        return '<button type="button" class="secim-cip" data-liste="' + l.id + '" aria-pressed="' + (liste && l.id === liste.id) + '">' + O.kacis(l.sinif) + '</button>';
      }).join('') + '</div>') + '</div>';
    if (liste) {
      var du = Depo.listeDurumu(d, liste);
      var raflar = Object.keys(du.raflar).sort(function (a, b) { return a - b; }).map(function (n) { return n + '. Raf (' + du.raflar[n] + ')'; }).join(' · ');
      var eksik = du.toplam - du.hazir;
      html += '<div class="k-sonuc"><div class="kart"><div class="k-bolum-baslik"><h2 style="font-size:22px">' + O.kacis(liste.okul + ' · ' + liste.sinif) + '</h2><span class="soluk">' + du.toplam + ' kitap</span></div>' +
        du.kalemler.map(function (k, i) {
          var rozet = !k.kitap || !k.yer ? '<span class="k-rozet yok">Mağazada yok</span>'
            : k.kitap.stok === 0 ? '<span class="k-rozet yok">Tükendi</span>'
            : d.ayarlar.stok && k.kitap.stok != null && k.kitap.stok <= 2 ? '<span class="k-rozet az">Son ' + k.kitap.stok + ' adet</span>'
            : '<span class="k-rozet var">Rafta var</span>';
          var ic = '<span class="no">' + (i + 1) + '</span><span style="min-width:0"><b>' + O.kacis(k.kitap ? k.kitap.ad : Arama.satirCoz(k.metin).ad) + '</b><span class="alt">' +
            O.kacis(k.kitap ? (k.kitap.yazar || k.kitap.yayinevi || '') : 'Görevliye sorabilirsiniz') + '</span></span>' + rozet + (k.yer ? '<span class="k-kod">' + k.yer.kod + '</span>' : '<span></span>');
          return k.kitap ? '<button type="button" class="liste-satir" data-kitap="' + k.kitap.id + '">' + ic + '</button>' : '<div class="liste-satir">' + ic + '</div>';
        }).join('') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:16px"><div class="kart" style="display:flex;flex-direction:column;gap:12px"><h3 style="font-size:20px">Listenin durumu</h3>' +
        '<div class="ilerleme" role="img" aria-label="' + du.hazir + ' / ' + du.toplam + ' hazır"><i style="width:' + (du.toplam ? Math.round(du.hazir / du.toplam * 100) : 0) + '%"></i></div>' +
        '<p style="margin:0;font-size:18px"><b>' + du.toplam + ' kitaptan ' + O.sayiEki(du.hazir) + '</b> mağazada hazır.</p>' +
        (raflar ? '<p class="soluk" style="font-size:15px">Raflar: ' + raflar + '</p>' : '') +
        (eksik && !telefondan ? '<button type="button" class="dugme ana" data-talep-liste="' + liste.id + '" style="min-height:56px;font-size:17px">Eksik ' + eksik + ' kitap için haber verilsin</button>' : '') +
        '</div>' + telefonQr(liste, 'liste', 'Listeyi telefonunuza alın', 'Rafları gezerken listeyi telefonunuzdan takip edin.') + '</div></div>';
    }
    sonucGoster(html + '</div>');
    O.ikonlariDoldur(sonuc);
  }

  // Yazım hatası toleransı: "Bunu mu demek istediniz?"
  function oneriHtml(s) {
    var o = Arama.oneriler(d.kitaplar, s, 4);
    if (!o.length) return '';
    return '<div style="width:100%;max-width:820px;text-align:left"><h3 class="k-liste-baslik">Bunu mu demek istediniz?</h3><div class="k-izgara">' +
      o.map(function (k) { return kart(k, false); }).join('') + '</div></div>';
  }

  function bulunamadi(s) {
    sonucGoster('<div class="kart" style="text-align:center;padding:48px 20px;display:flex;flex-direction:column;gap:12px;align-items:center">' +
      '<h2 style="font-size:28px">“' + O.kacis(String(s).trim()) + '” bulunamadı</h2>' +
      '<p class="soluk" style="font-size:17px;max-width:520px">Yazımı kontrol edin ya da yalnız bir kelimeyle deneyin. Kitap mağazada yoksa gelince size haber verebiliriz.</p>' +
      oneriHtml(s) +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button type="button" class="dugme" data-is="ana"><span data-ikon="geri"></span>Başa dön</button>' +
      '<button type="button" class="dugme ana" data-talep-kitap="' + O.kacis(String(s).trim()) + '">Gelince haber verilsin</button></div></div>');
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
    if (e.key.length === 1 && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { sorgu.value = ''; sorgu.focus(); }
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
    var talepB = e.target.closest('[data-talep-kitap]');
    if (talepB) { talepFormu(talepB.getAttribute('data-talep-kitap'), talepB.getAttribute('data-talep-id'), ''); return; }
    var talepL = e.target.closest('[data-talep-liste]');
    if (talepL) {
      var liste = d.okulListeleri.find(function (l) { return l.id === talepL.getAttribute('data-talep-liste'); });
      if (liste) {
        var eksik = Depo.listeDurumu(d, liste).kalemler.filter(function (x) { return !x.hazir; })
          .map(function (x) { return x.kitap ? x.kitap.ad : Arama.satirCoz(x.metin).ad; });
        talepFormu(eksik.join(', '), null, liste.okul + ' · ' + liste.sinif + ' listesi');
      }
      return;
    }
    var okulB = e.target.closest('[data-okul-ad]');
    if (okulB) { okulGoster(okulB.getAttribute('data-okul-ad'), null); return; }
    var listeB = e.target.closest('[data-liste]');
    if (listeB) { okulGoster(null, listeB.getAttribute('data-liste')); return; }
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
      sorgu.value = ''; $('temizle').hidden = true; Klavye.kapat(); Tarayici.kapat();
      var tp = document.querySelector('.talep-perde'); if (tp) tp.remove();
      karsilamaGoster();
    }, BOSTA_SURE);
  }
  ['pointerdown', 'keydown', 'input'].forEach(function (olay) { document.addEventListener(olay, hareket, true); });

  // ---------- Veri ----------
  function magazaAdi() {
    var ad = d.ayarlar.magazaAdi || 'Kitabım Hangi Rafta?';
    $('magaza-adi').textContent = ad;
    Tema.uygula(d.ayarlar);
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
    var k = adres.get('kitap') && d.kitaplar.find(function (x) { return x.id === adres.get('kitap'); });
    var l = adres.get('liste') && d.okulListeleri.find(function (x) { return x.id === adres.get('liste'); });
    if (k) kitapGoster(k, null); else if (l) okulGoster(null, l.id); else karsilamaGoster();
    hareket();
  }).catch(function (e) {
    sonucGoster('<div class="mesaj hata">Kitap listesi yüklenemedi: ' + O.kacis(e.message) + '</div>');
  });
})();
