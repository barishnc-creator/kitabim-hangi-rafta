// Çalışan paneli: giriş, yetkiye göre menü, raflar, kitaplar, revizeler, kullanıcılar, ayarlar.
(function () {
  var O = Ortak;
  var d = Depo.bos();
  var ben = null; // { id, ad, eposta, rol }
  var seciliBolmeId = null;
  var duzenlenenId = null;
  var $ = function (id) { return document.getElementById(id); };

  function yetkili() {
    var roller = Array.prototype.slice.call(arguments);
    return !!ben && roller.indexOf(ben.rol) >= 0;
  }
  var duzenleyici = function () { return yetkili('duzenleyici'); };
  var kitapYetkisi = function () { return yetkili('duzenleyici', 'calisan'); };

  // ---------- Genel ----------
  function bildir(kutu, tur, metin) {
    kutu.innerHTML = metin ? '<div class="mesaj ' + tur + '">' + O.kacis(metin) + '</div>' : '';
  }
  function genel(tur, metin) { bildir($('genel-mesaj'), tur, metin); }

  // Veri işlemini çalıştırır; hatayı genel mesaj kutusunda gösterir.
  function yap(islem, basariMetni) {
    var p;
    try { p = Promise.resolve(islem()); } catch (e) { p = Promise.reject(e); }
    return p.then(function (sonuc) {
      if (basariMetni) genel('basari', typeof basariMetni === 'function' ? basariMetni(sonuc) : basariMetni);
      return sonuc;
    }, function (e) {
      genel('hata', e.message || 'Bir hata oluştu.');
      return Promise.reject(e);
    });
  }
  function sus() {} // reddedilen sözleri sessizce yut (mesaj zaten gösterildi)

  function hepsiniCiz() {
    semaCiz();
    panelCiz();
    rafSecenekleri();
    rafFiltresi();
    listeCiz();
    ayarlariCiz();
    magazaAdiYaz();
    if (!$('genel').hidden) panoCiz();
    if (!$('etiketler').hidden) etiketCiz();
    Object.keys(ekSekmeler).forEach(function (ad) { if ($(ad) && !$(ad).hidden) ekSekmeler[ad](); });
    herCizim.forEach(function (fn) { fn(); });
  }
  var ekSekmeler = {}, herCizim = [];

  function magazaAdiYaz() {
    var ad = d.ayarlar.magazaAdi || 'Kitabım Hangi Rafta';
    document.querySelectorAll('.magaza-adi-yaz').forEach(function (el) { el.textContent = ad; });
  }

  // ---------- Sekmeler ----------
  var sekmeler = ['genel', 'raflar', 'kitaplar', 'etiketler', 'revizeler', 'kullanicilar', 'ayarlar'];
  var BASLIK = { genel: 'Genel bakış', raflar: 'Raf şeması', kitaplar: 'Kitaplar', etiketler: 'Raf etiketleri', revizeler: 'Revizeler', kullanicilar: 'Kullanıcılar', ayarlar: 'Ayarlar' };
  function sekmeIzinli(ad) {
    var dugme = $('sek-' + ad);
    var y = dugme.getAttribute('data-yetki');
    return !y || yetkili.apply(null, y.split(' '));
  }
  function sekmeAc(ad) {
    if (!sekmeIzinli(ad)) ad = 'genel';
    sekmeler.forEach(function (s) {
      $(s).hidden = s !== ad;
      $('sek-' + s).setAttribute('aria-selected', String(s === ad));
    });
    genel('', '');
    if (location.hash !== '#' + ad) history.replaceState(null, '', '#' + ad);
    $('sayfa-baslik').textContent = BASLIK[ad];
    if (ad === 'genel') panoCiz();
    if (ad === 'etiketler') etiketCiz();
    if (ad === 'revizeler') revizeleriCiz();
    if (ad === 'kullanicilar') uyeleriCiz();
    if (ekSekmeler[ad]) ekSekmeler[ad]();
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-git]');
    if (g) sekmeAc(g.getAttribute('data-git'));
  });
  sekmeler.forEach(function (s) {
    $('sek-' + s).addEventListener('click', function () { sekmeAc(s); });
  });

  // data-yetki="rol1 rol2" taşıyan öğeleri yetkiye göre gizle.
  function yetkileriUygula() {
    document.querySelectorAll('[data-yetki]').forEach(function (el) {
      el.hidden = !yetkili.apply(null, el.getAttribute('data-yetki').split(' '));
    });
    $('ben-ad').textContent = ben.ad || ben.eposta || '';
    $('ben-rol').textContent = Veri.ROL_ADI[ben.rol] || '';
    $('ben-harf').textContent = (ben.ad || ben.eposta || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
    $('raf-aciklama').textContent = duzenleyici()
      ? 'Rafları ve bölmeleri dükkândaki düzene göre kurun. Bir bölmeye dokununca içindeki kitaplar açılır.'
      : 'Bir bölmeye dokununca içindeki kitaplar açılır. Rafları yalnız düzenleyici değiştirebilir.';
  }

  // ---------- Raflar ----------
  $('raf-ekle-dugme').innerHTML = O.ikon.arti + 'Raf ekle';

  $('raf-ekle-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var sayi = Math.max(1, Math.min(30, parseInt($('raf-bolme').value, 10) || 1));
    var etiket = $('raf-etiket').value;
    yap(function () { return Veri.rafEkle(etiket, sayi); }, function (r) { return r.no + '. Raf eklendi (' + sayi + ' bölme).'; })
      .then(function () { $('raf-etiket').value = ''; }, sus);
  });

  function semaCiz() {
    var kap = $('yonetim-sema');
    var raflar = O.sirali(d.raflar);
    if (!raflar.length) {
      kap.innerHTML = '<div class="kart" style="grid-column:1/-1;text-align:center;color:var(--ikincil)">' +
        (duzenleyici() ? 'Henüz raf yok. Yukarıdan ilk rafı ekleyin.' : 'Henüz raf eklenmemiş.') + '</div>';
      return;
    }
    var duz = duzenleyici();
    kap.innerHTML = raflar.map(function (r) {
      return '<section class="raf">' +
        '<div class="raf-bas"><div class="raf-ad"><strong>' + r.no + '. Raf</strong>' +
        '<div class="soluk">' + (r.etiket ? O.kacis(r.etiket) + ' · ' : '') + r.bolmeler.length + ' bölme · ' + Depo.rafKitapSayisi(d, r) + ' kitap</div></div>' +
        (duz ? '<button type="button" class="dugme kare" data-is="raf-adlandir" data-id="' + r.id + '" aria-label="' + r.no + '. rafın etiketini değiştir">' + O.ikon.kalem + '</button>' +
          '<button type="button" class="dugme kare tehlike" data-is="raf-sil" data-id="' + r.id + '" aria-label="' + r.no + '. rafı sil">' + O.ikon.cop + '</button>' : '') +
        '</div><div class="bolmeler">' + O.siraliBolmeler(r).map(function (b) {
          var n = Depo.bolmeKitaplari(d, b.id).length;
          return '<button type="button" class="bolme' + (b.id === seciliBolmeId ? ' secili' : '') + '" data-is="bolme-sec" data-id="' + b.id + '" aria-pressed="' + (b.id === seciliBolmeId) + '">' +
            r.no + '.' + b.no + '<small>' + n + ' kitap</small></button>';
        }).join('') +
        (duz ? '<button type="button" class="bolme ekle" data-is="bolme-ekle" data-id="' + r.id + '">+ Bölme</button>' : '') +
        '</div></section>';
    }).join('');
  }

  function panelCiz() {
    var p = $('bolme-panel');
    var yer = seciliBolmeId && Depo.konum(d, seciliBolmeId);
    if (!yer) {
      seciliBolmeId = null;
      p.innerHTML = '<h2 style="font-size:18px">Bölme seçin</h2><p class="soluk" style="margin-top:6px">Şemadan bir bölmeye dokunun; içindeki kitaplar burada listelenir.</p>';
      return;
    }
    var kitaplar = Depo.bolmeKitaplari(d, seciliBolmeId).sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    p.innerHTML = '<div class="bolum">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="font-size:20px">Bölme ' + yer.kod + '</h2><span class="soluk">' + yer.raf.no + '. Raf</span></div>' +
      (kitapYetkisi() ? '<button type="button" class="dugme ana" data-is="bolmeye-ekle">' + O.ikon.arti + 'Bu bölmeye kitap ekle</button>' : '') +
      (kitaplar.length ? '<ul class="kitap-liste">' + kitaplar.map(kitapSatiri).join('') + '</ul>' : '<p class="soluk">Bu bölmede kitap yok.</p>') +
      (duzenleyici() ? '<button type="button" class="dugme tehlike" data-is="bolme-sil">' + O.ikon.cop + 'Bölmeyi sil</button>' : '') +
      '</div>';
  }

  function kitapSatiri(k) {
    var yer = Depo.konum(d, k.bolmeId);
    return '<li><div class="metin"><b>' + O.kacis(k.ad) + '</b><span class="soluk">' +
      O.kacis([k.yazar, k.yayinevi].filter(Boolean).join(' · ') || '—') + '</span></div>' +
      '<span class="kod">' + (yer ? yer.kod : '?') + '</span>' +
      (kitapYetkisi()
        ? '<button type="button" class="dugme kare" data-is="kitap-duzenle" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını düzenle">' + O.ikon.kalem + '</button>' +
          '<button type="button" class="dugme kare tehlike" data-is="kitap-sil" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını sil">' + O.ikon.cop + '</button>'
        : '') + '</li>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-is]');
    if (!b) return;
    var is = b.getAttribute('data-is');
    var id = b.getAttribute('data-id');

    if (is === 'cikis') { Veri.cikis().then(function () { location.reload(); }); }
    else if (is === 'bolme-sec') { seciliBolmeId = id; semaCiz(); panelCiz(); }
    else if (is === 'bolme-ekle') {
      yap(function () { return Veri.bolmeEkle(id); }).then(function (yeni) { seciliBolmeId = yeni.id; hepsiniCiz(); }, sus);
    }
    else if (is === 'raf-adlandir') {
      var r = d.raflar.find(function (x) { return x.id === id; });
      O.pencere(r.no + '. raf için etiket (örn. Test kitapları):', { girdi: true, deger: r.etiket || '', evet: 'Kaydet' }).then(function (yeniEtiket) {
        if (yeniEtiket !== null) yap(function () { return Veri.rafGuncelle(id, yeniEtiket); }).catch(sus);
      });
    }
    else if (is === 'raf-sil') {
      var rs = d.raflar.find(function (x) { return x.id === id; });
      O.pencere(rs.no + '. raf ve bölmeleri silinsin mi?', { evet: 'Sil', tehlike: true }).then(function (tamam) {
        if (tamam) yap(function () { return Veri.rafSil(id); }, rs.no + '. Raf silindi.').catch(sus);
      });
    }
    else if (is === 'bolme-sil') {
      var y = Depo.konum(d, seciliBolmeId);
      var silinecek = seciliBolmeId;
      if (y) O.pencere(y.kod + ' bölmesi silinsin mi?', { evet: 'Sil', tehlike: true }).then(function (tamam) {
        if (tamam) yap(function () { return Veri.bolmeSil(silinecek); }, y.kod + ' bölmesi silindi.').then(function () { seciliBolmeId = null; panelCiz(); }, sus);
      });
    }
    else if (is === 'bolmeye-ekle') { formuTemizle(seciliBolmeId); bildir($('form-mesaj'), '', ''); cekmeceAc('f-barkod'); }
    else if (is === 'kitap-yeni') { formuTemizle(); bildir($('form-mesaj'), '', ''); cekmeceAc('f-barkod'); }
    else if (is === 'kitap-duzenle') { formaYukle(id); cekmeceAc('f-ad'); }
    else if (is === 'kitap-sil') {
      var k = d.kitaplar.find(function (x) { return x.id === id; });
      if (k) O.pencere('“' + k.ad + '” silinsin mi?', { evet: 'Sil', tehlike: true }).then(function (tamam) {
        if (!tamam) return;
        yap(function () { return Veri.kitapSil(id); }, '“' + k.ad + '” silindi.').catch(sus);
        if (duzenlenenId === id) formuTemizle();
      });
    }
    else if (is === 'revize-sil') {
      O.pencere('Bu revize silinsin mi?', { evet: 'Sil', tehlike: true }).then(function (tamam) {
        if (tamam) yap(function () { return Veri.revizeSil(id); }).then(revizeleriCiz, sus);
      });
    }
    else if (is === 'uye-sifre') {
      O.pencere('Yeni şifre (en az 6 karakter):', { girdi: true, evet: 'Şifreyi değiştir' }).then(function (s) {
        if (s) yap(function () { return Veri.uyeSifre(id, s); }, 'Şifre değiştirildi. Yeni şifreyi kişiye iletin.').catch(sus);
      });
    }
    else if (is === 'uye-kaldir') {
      O.pencere(b.getAttribute('data-ad') + ' kişisinin yetkisi kaldırılsın mı?', { evet: 'Kaldır', tehlike: true }).then(function (tamam) {
        if (tamam) yap(function () { return Veri.uyeKaldir(id); }, 'Kişi kaldırıldı.').then(uyeleriCiz, sus);
      });
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.getAttribute('data-is') === 'revize-durum') {
      yap(function () { return Veri.revizeDurum(el.getAttribute('data-id'), el.value); }).then(revizeleriCiz, sus);
    } else if (el.getAttribute('data-is') === 'uye-rol') {
      yap(function () { return Veri.uyeRol(el.getAttribute('data-id'), el.value); }, 'Yetki güncellendi.').then(uyeleriCiz, uyeleriCiz);
    }
  });

  // ---------- Kitap formu ----------
  function rafSecenekleri(seciliBolme) {
    var bolmeId = seciliBolme !== undefined ? seciliBolme : $('f-bolme').value;
    var yer = bolmeId && Depo.konum(d, bolmeId);
    var raflar = O.sirali(d.raflar);
    var rafId = yer ? yer.raf.id : ($('f-raf').value || (raflar[0] && raflar[0].id) || '');
    $('f-raf').innerHTML = raflar.length
      ? raflar.map(function (r) { return '<option value="' + r.id + '"' + (r.id === rafId ? ' selected' : '') + '>' + r.no + '. Raf' + (r.etiket ? ' · ' + O.kacis(r.etiket) : '') + '</option>'; }).join('')
      : '<option value="">Önce raf ekleyin</option>';
    bolmeSecenekleri(yer ? yer.bolme.id : bolmeId);
  }

  function bolmeSecenekleri(seciliId) {
    var r = d.raflar.find(function (x) { return x.id === $('f-raf').value; });
    $('f-bolme').innerHTML = r && r.bolmeler.length
      ? O.siraliBolmeler(r).map(function (b) { return '<option value="' + b.id + '"' + (b.id === seciliId ? ' selected' : '') + '>' + r.no + '.' + b.no + '</option>'; }).join('')
      : '<option value="">Bölme yok</option>';
  }
  $('f-raf').addEventListener('change', function () { bolmeSecenekleri(null); });

  function formuTemizle(bolmeId) {
    duzenlenenId = null;
    aranan = '';
    ['f-barkod', 'f-ad', 'f-yazar', 'f-yayinevi', 'f-fiyat', 'f-stok'].forEach(function (i) { $(i).value = ''; });
    kapakGoster('');
    $('form-baslik').textContent = 'Kitap ekle';
    bildir($('barkod-uyari'), '', '');
    if (bolmeId !== undefined) rafSecenekleri(bolmeId);
  }

  function formaYukle(id) {
    var k = d.kitaplar.find(function (x) { return x.id === id; });
    if (!k) return;
    duzenlenenId = id;
    $('form-baslik').textContent = 'Kitabı düzenle';
    $('f-barkod').value = k.barkod || '';
    $('f-ad').value = k.ad;
    $('f-yazar').value = k.yazar || '';
    $('f-yayinevi').value = k.yayinevi || '';
    $('f-fiyat').value = k.fiyat == null ? '' : String(k.fiyat).replace('.', ',');
    $('f-stok').value = k.stok == null ? '' : k.stok;
    kapakGoster(k.kapak);
    bildir($('form-mesaj'), '', '');
    bildir($('barkod-uyari'), '', '');
    rafSecenekleri(k.bolmeId);
  }

  function barkodKontrol() {
    var kod = $('f-barkod').value.replace(/\s+/g, '');
    var ayni = kod && d.kitaplar.find(function (k) { return k.barkod === kod && k.id !== duzenlenenId; });
    if (!ayni) { bildir($('barkod-uyari'), '', ''); return; }
    var yer = Depo.konum(d, ayni.bolmeId);
    $('barkod-uyari').innerHTML = '<div class="mesaj hata" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<span style="flex-grow:1">Bu barkod zaten kayıtlı: <b>' + O.kacis(ayni.ad) + '</b> (' + (yer ? yer.kod : '?') + ')</span>' +
      '<button type="button" class="dugme" data-is="kitap-duzenle" data-id="' + ayni.id + '">O kitabı düzenle</button></div>';
  }

  // Yeni kitapta ISBN okununca adı, yazarı ve yayınevini internetten getirip boş alanlara yazar.
  // Çalışana yalnız raf/bölmeyi kontrol edip kaydetmek kalır.
  var aranan = '';
  function bilgiGetir() {
    var kod = $('f-barkod').value.replace(/\s+/g, '');
    if (duzenlenenId || !KitapBilgi.isbnMi(kod) || kod === aranan) return;
    if ($('barkod-uyari').innerHTML) return; // zaten kayıtlı
    aranan = kod;
    bildir($('form-mesaj'), 'basari', 'Kitap bilgileri internetten aranıyor…');
    KitapBilgi.bul(kod, Veri.kitapBilgi).then(function (b) {
      if ($('f-barkod').value.replace(/\s+/g, '') !== kod) return; // bu arada barkod değişti
      if (!b) {
        bildir($('form-mesaj'), 'hata', KitapBilgi.baglantiYok
          ? 'Kitap bilgilerine internetten ulaşılamadı. Bilgileri elle girin.'
          : KitapBilgi.kotaDoldu
            ? 'Google Kitaplar şu an yoğun olduğu için cevap vermedi (günlük ücretsiz sınır doldu). Biraz sonra barkodu yeniden okutun ya da bilgileri elle girin.'
            : 'Bu barkod internette bulunamadı. ' + (Veri.kitapBilgi ? 'Kapağın fotoğrafını çekin (Kapaktan doldur) ya da bilgileri elle girin.' : 'Bilgileri elle girin.'));
        $('f-ad').focus();
        return;
      }
      if (!$('f-ad').value.trim()) $('f-ad').value = b.ad;
      if (!$('f-yazar').value.trim()) $('f-yazar').value = b.yazar;
      if (!$('f-yayinevi').value.trim()) $('f-yayinevi').value = b.yayinevi;
      if (!$('f-kapak').value && b.kapak) kapakGoster(b.kapak);
      bildir($('form-mesaj'), 'basari', KitapBilgi.kaynak === 'google-arama'
        ? 'Bilgiler internette arama yapılarak bulundu; kaydetmeden önce mutlaka kontrol edin. Raf ve bölmeyi seçip kaydedin.'
        : 'Bilgiler internetten getirildi, kontrol edin. Raf ve bölmeyi seçip kaydedin.');
      $('f-bolme').focus();
    });
  }
  function barkodOkundu() {
    barkodKontrol();
    bilgiGetir();
    if (!KitapBilgi.isbnMi($('f-barkod').value) || duzenlenenId) $('f-ad').focus();
  }

  // Barkod tabancası kodu yazıp Enter'a basar: formu göndermek yerine bilgileri getir.
  $('f-barkod').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); barkodOkundu(); }
  });
  $('f-barkod').addEventListener('change', function () { barkodKontrol(); bilgiGetir(); });
  $('f-tara').addEventListener('click', function () {
    Tarayici.ac(function (kod) { $('f-barkod').value = kod; barkodOkundu(); });
  });
  $('f-vazgec').addEventListener('click', cekmeceKapat);
  $('cekmece-kapat').addEventListener('click', cekmeceKapat);
  $('cekmece-perde').addEventListener('click', cekmeceKapat);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('kitap-form').hidden && !document.querySelector('.kamera-perde')) cekmeceKapat();
  });

  // ---- Kapaktan doldur: fotoğraf küçültülür, sunucuda yapay zekâ okur, fotoğraf kapak resmi olur ----
  $('kapak-foto-alan').hidden = !Veri.kitapBilgi;
  function kapakFotoHazirla(dosya) {
    return new Promise(function (tamam, hata) {
      var url = URL.createObjectURL(dosya), img = new Image();
      img.onload = function () {
        var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, o = Math.min(1, 1024 / Math.max(W, H));
        var c = document.createElement('canvas');
        c.width = Math.round(W * o); c.height = Math.round(H * o);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var veri = c.toDataURL('image/jpeg', 0.85);
        c.width = c.height = 1; // iPhone'da tuval belleğini hemen bırak
        URL.revokeObjectURL(url);
        tamam(veri.replace(/^data:image\/jpeg;base64,/, ''));
      };
      img.onerror = function () { URL.revokeObjectURL(url); hata(new Error('Fotoğraf açılamadı.')); };
      img.src = url;
    });
  }
  $('f-kapak-foto').addEventListener('change', function (e) {
    var dosya = e.target.files[0];
    e.target.value = '';
    if (!dosya || !Veri.kitapBilgi) return;
    var dugme = $('f-kapak-dugme');
    dugme.classList.add('mesgul');
    bildir($('form-mesaj'), 'basari', 'Kapak okunuyor…');
    kapakFotoHazirla(dosya).then(function (resim) {
      return Veri.kitapBilgi({ islem: 'kapak', resim: resim, isbn: $('f-barkod').value.replace(/\D/g, '') });
    }).then(function (c) {
      if (c.kapak) { kapakGoster(c.kapak); $('kapak-not').textContent = 'Kapak resmi çektiğiniz fotoğraftan.'; }
      var b = c.bilgi, ek = !c.kapak && c.depoHatasi ? ' Kapak resmi kaydedilemedi.' : '';
      if (b) {
        if (!$('f-ad').value.trim()) $('f-ad').value = b.ad || '';
        if (!$('f-yazar').value.trim()) $('f-yazar').value = b.yazar || '';
        if (!$('f-yayinevi').value.trim()) $('f-yayinevi').value = b.yayinevi || '';
        bildir($('form-mesaj'), 'basari', 'Bilgiler kapaktan okundu; kontrol edin, eksik varsa tamamlayın.' + ek);
        $('f-bolme').focus();
      } else {
        bildir($('form-mesaj'), 'hata', (c.kapak ? 'Kapak resmi kaydedildi ama ' : '') + 'kapaktaki yazılar okunamadı' +
          (c.uyari ? ' (' + c.uyari + ')' : '') + '. Bilgileri elle girin.' + ek);
        $('f-ad').focus();
      }
    }).catch(function (x) {
      bildir($('form-mesaj'), 'hata', 'Kapak okunamadı: ' + (x && x.message ? x.message : 'bilinmeyen hata') + ' Bilgileri elle girin.');
    }).then(function () { dugme.classList.remove('mesgul'); });
  });

  function kapakGoster(url) {
    var u = Depo.kapakAdresi(url);
    $('kapak-not').textContent = 'Kapak görseli internetten alındı.';
    $('f-kapak').value = u;
    $('kapak-onizleme').hidden = !u;
    if (u) $('kapak-resim').src = u; else $('kapak-resim').removeAttribute('src');
  }
  var cekmeceOncesi = null;
  function cekmeceAc(odak) {
    cekmeceOncesi = document.activeElement;
    $('kitap-form').hidden = false;
    $('cekmece-perde').hidden = false;
    setTimeout(function () { $(odak || 'f-barkod').focus(); }, 0);
  }
  function cekmeceKapat() {
    $('kitap-form').hidden = true;
    $('cekmece-perde').hidden = true;
    formuTemizle();
    bildir($('form-mesaj'), '', '');
    if (cekmeceOncesi && cekmeceOncesi.focus) cekmeceOncesi.focus();
  }

  var kaydediliyor = false;
  $('kitap-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (kaydediliyor) return;
    var giris = {
      id: duzenlenenId || undefined,
      barkod: $('f-barkod').value,
      ad: $('f-ad').value,
      yazar: $('f-yazar').value,
      yayinevi: $('f-yayinevi').value,
      bolmeId: $('f-bolme').value,
      kapak: $('f-kapak').value
    };
    var eski = duzenlenenId && d.kitaplar.find(function (k) { return k.id === duzenlenenId; });
    // Kapalı alanlar formda görünmez; düzenlemede eski değer korunur.
    giris.fiyat = d.ayarlar.fiyat ? $('f-fiyat').value : (eski ? eski.fiyat : null);
    giris.stok = d.ayarlar.stok ? $('f-stok').value : (eski ? eski.stok : null);

    function kaydet(izin) {
      try { return Veri.kitapKaydet(giris, izin); } catch (err) { return Promise.reject(err); }
    }
    kaydediliyor = true;
    $('f-kaydet').disabled = true;
    kaydet(false).catch(function (err) {
      if (err.kod !== 'AYNI_BARKOD') throw err;
      return O.pencere(err.message + '\n\nYine de ayrı bir kayıt olarak eklensin mi?', { evet: 'Yine de ekle' }).then(function (tamam) {
        if (tamam) return kaydet(true);
        throw err;
      });
    }).then(function (k) {
      if (!k) return;
      var yer = Depo.konum(d, k.bolmeId);
      bildir($('form-mesaj'), 'basari', '“' + k.ad + '” kaydedildi → ' + (yer ? yer.raf.no + '. Raf · Bölme ' + yer.kod : ''));
      formuTemizle(k.bolmeId); // Raf/bölme seçili kalır: art arda ekleme hızlı olur.
      $('f-barkod').focus();
    }).catch(function (err) {
      if (err.kod === 'AYNI_BARKOD') return;
      bildir($('form-mesaj'), 'hata', err.message || 'Kaydedilemedi.');
    }).then(function () {
      kaydediliyor = false;
      $('f-kaydet').disabled = false;
    });
  });

  var gosterilen = 100;
  function rafFiltresi() {
    var secili = $('liste-raf').value;
    $('liste-raf').innerHTML = '<option value="">Tüm raflar</option>' + O.sirali(d.raflar).map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === secili ? ' selected' : '') + '>' + r.no + '. Raf' + (r.etiket ? ' · ' + O.kacis(r.etiket) : '') + '</option>';
    }).join('');
  }
  function kapakHucre(k) {
    return k.kapak
      ? '<img class="kapak-kucuk" src="' + O.kacis(k.kapak) + '" alt="" loading="lazy">'
      : '<div class="kapak-yok">' + O.ikon.kitap18 + '</div>';
  }
  function listeCiz() {
    var s = $('liste-ara').value;
    var rafId = $('liste-raf').value;
    var liste = s.trim() ? Arama.ara(d.kitaplar, s) : d.kitaplar.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    if (rafId) liste = liste.filter(function (k) { var y = Depo.konum(d, k.bolmeId); return y && y.raf.id === rafId; });
    $('kitap-sayi').textContent = d.kitaplar.length + ' kitap' + (liste.length !== d.kitaplar.length ? ' · ' + liste.length + ' gösteriliyor' : '');
    document.querySelectorAll('[data-alan=fiyat]').forEach(function (el) { el.hidden = !d.ayarlar.fiyat; });
    document.querySelectorAll('[data-alan=stok]').forEach(function (el) { el.hidden = !d.ayarlar.stok; });
    var yetki = kitapYetkisi();
    $('tum-kitaplar').innerHTML = liste.length ? liste.slice(0, gosterilen).map(function (k) {
      var yer = Depo.konum(d, k.bolmeId);
      return '<tr><td>' + kapakHucre(k) + '</td>' +
        '<td><b>' + O.kacis(k.ad) + '</b><div class="soluk">' + O.kacis(k.yazar || '—') + (k.barkod ? ' · ' + O.kacis(k.barkod) : '') + '</div></td>' +
        '<td>' + O.kacis(k.yayinevi || '—') + '</td>' +
        '<td><span class="kod-rozet">' + (yer ? yer.kod : '?') + '</span></td>' +
        (d.ayarlar.fiyat ? '<td class="sayi">' + (k.fiyat == null ? '—' : O.para(k.fiyat)) + '</td>' : '') +
        (d.ayarlar.stok ? '<td class="sayi' + (k.stok === 0 ? ' stok-yok' : '') + '">' + (k.stok == null ? '—' : k.stok) + '</td>' : '') +
        '<td class="islem">' + (yetki
          ? '<button type="button" class="dugme kare" data-is="kitap-duzenle" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını düzenle">' + O.ikon.kalem + '</button> ' +
            '<button type="button" class="dugme kare tehlike" data-is="kitap-sil" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını sil">' + O.ikon.cop + '</button>'
          : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="bos-not" style="text-align:center;padding:32px">' +
      (d.kitaplar.length ? 'Eşleşen kitap yok.' : 'Henüz kitap eklenmedi. Sağ üstteki “Kitap ekle” ile başlayın ya da Excel\'den yükleyin.') + '</td></tr>';
    $('daha-fazla').hidden = liste.length <= gosterilen;
  }
  $('liste-ara').addEventListener('input', function () { gosterilen = 100; listeCiz(); });
  $('liste-raf').addEventListener('change', function () { gosterilen = 100; listeCiz(); });
  $('daha-fazla').addEventListener('click', function () { gosterilen += 100; listeCiz(); });

  // ---------- Genel bakış ----------
  function panoCiz() {
    var bolmeSayisi = 0, bosBolme = 0;
    d.raflar.forEach(function (r) { r.bolmeler.forEach(function (b) { bolmeSayisi++; if (!Depo.bolmeKitaplari(d, b.id).length) bosBolme++; }); });
    var hafta = new Date(Date.now() - 7 * 864e5).toISOString();
    var yeni = d.kitaplar.filter(function (k) { return (k.eklendi || '') >= hafta; }).length;
    var tukenen = d.kitaplar.filter(function (k) { return k.stok === 0; }).length;
    function kpi(renk, ikon, etiket, deger, alt) {
      return '<div class="kart kpi"><div class="kpi-ikon ' + renk + '">' + O.ikon[ikon] + '</div><div><span>' + etiket + '</span><b>' + deger + '</b>' + (alt ? '<small>' + alt + '</small>' : '') + '</div></div>';
    }
    $('kpiler').innerHTML =
      kpi('mavi', 'kitap18', 'Toplam kitap', d.kitaplar.length.toLocaleString('tr-TR'), yeni ? '+' + yeni + ' bu hafta' : 'Bu hafta yeni yok') +
      kpi('yesil', 'raf', 'Raf / bölme', d.raflar.length + ' / ' + bolmeSayisi, bosBolme ? bosBolme + ' bölme boş' : 'Tüm bölmeler dolu') +
      kpi('turuncu', 'ara', 'Müşteri araması', '…', 'Son 30 gün') +
      kpi('mor', 'etiket', d.ayarlar.stok ? 'Tükenen kitap' : 'Bölme başına kitap', d.ayarlar.stok ? tukenen : (bolmeSayisi ? (d.kitaplar.length / bolmeSayisi).toFixed(1).replace('.', ',') : '0'), d.ayarlar.stok ? 'Stok 0 olanlar' : 'Ortalama');

    var son = d.kitaplar.slice().sort(function (a, b) { return String(b.eklendi || '').localeCompare(String(a.eklendi || '')); }).slice(0, 6);
    $('pano-son').innerHTML = son.length ? son.map(function (k) {
      var yer = Depo.konum(d, k.bolmeId);
      return '<li>' + kapakHucre(k) + '<div class="metin"><b>' + O.kacis(k.ad) + '</b><span>' + O.kacis(k.yazar || k.yayinevi || '') + (k.eklendi ? ' · ' + O.tarihKisa(k.eklendi) : '') + '</span></div><span class="kod-rozet">' + (yer ? yer.kod : '?') + '</span></li>';
    }).join('') : '<li class="bos-not">Henüz kitap yok.</li>';

    var raflar = O.sirali(d.raflar);
    var enFazla = Math.max.apply(null, [1].concat(raflar.map(function (r) { return Depo.rafKitapSayisi(d, r); })));
    $('pano-doluluk').innerHTML = raflar.length ? raflar.map(function (r) {
      var n = Depo.rafKitapSayisi(d, r);
      return '<div class="doluluk-satir"><span>' + r.no + '. Raf</span><div class="cubuk" title="' + O.kacis(r.etiket) + '"><i style="width:' + Math.round(n / enFazla * 100) + '%"></i></div><span class="sayi" style="text-align:right">' + n + '</span></div>';
    }).join('') : '<p class="bos-not">Henüz raf yok.</p>';

    var aramaYetkisi = yetkili('duzenleyici', 'revizeci');
    if (!aramaYetkisi) {
      $('pano-encok').innerHTML = $('pano-bulunamayan').innerHTML = '<li class="bos-not">Bu raporu yönetici görür.</li>';
      return;
    }
    Veri.aramalar(30).then(function (kayitlar) {
      var o = Arama.ozet(kayitlar, 6);
      var kutu = $('kpiler').children[2];
      if (kutu) kutu.querySelector('b').textContent = o.toplam.toLocaleString('tr-TR');
      $('pano-encok').innerHTML = o.enCok.length ? o.enCok.map(function (g, i) {
        return '<li><span class="rozet-sayi">' + (i + 1) + '</span><div class="metin"><b>' + O.kacis(g.sorgu) + '</b></div><span class="rozet-sayi">' + g.sayi + ' arama</span></li>';
      }).join('') : '<li class="bos-not">Müşteri ekranında arama yapıldıkça burada listelenir.</li>';
      $('pano-bulunamayan').innerHTML = o.bulunamayan.length ? o.bulunamayan.map(function (g) {
        return '<li><div class="metin"><b>' + O.kacis(g.sorgu) + '</b><span>Mağazada bulunamadı</span></div><span class="rozet-sayi uyari">' + g.bulunamayan + ' kez</span></li>';
      }).join('') : '<li class="bos-not">Bulunamayan arama yok.</li>';
    }).catch(function () {
      $('pano-encok').innerHTML = $('pano-bulunamayan').innerHTML = '<li class="bos-not">Arama raporu yüklenemedi.</li>';
    });
  }

  // ---------- Raf etiketleri ----------
  function qrSvg(metin) {
    if (typeof window.qrcode !== 'function') return '<div class="soluk" style="width:92px">QR yüklenemedi</div>';
    var qr = window.qrcode(0, 'M');
    qr.addData(metin);
    qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  }
  function etiketCiz() {
    var secili = $('etiket-raf').value;
    var raflar = O.sirali(d.raflar);
    $('etiket-raf').innerHTML = '<option value="">Tüm raflar</option>' + raflar.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === secili ? ' selected' : '') + '>' + r.no + '. Raf' + (r.etiket ? ' · ' + O.kacis(r.etiket) : '') + '</option>';
    }).join('');
    var magaza = d.ayarlar.magazaAdi || 'Kitabım Hangi Rafta';
    var html = '';
    raflar.filter(function (r) { return !secili || r.id === secili; }).forEach(function (r) {
      O.siraliBolmeler(r).forEach(function (b) {
        var kod = r.no + '.' + b.no;
        html += '<div class="etiket"><div class="qr">' + qrSvg('RAF:' + kod) + '</div><div><div class="magaza">' + O.kacis(magaza) + '</div>' +
          '<div class="kod">' + kod + '</div><div class="alt">' + r.no + '. Raf' + (r.etiket ? ' · ' + O.kacis(r.etiket) : '') + '</div></div></div>';
      });
    });
    $('etiket-sayfa').innerHTML = html || '<p class="bos-not">Önce raf ekleyin.</p>';
  }
  $('etiket-raf').addEventListener('change', etiketCiz);
  $('etiket-yazdir').addEventListener('click', function () { window.print(); });

  // ---------- Excel (CSV) ----------
  function dosyaIndir(ad, icerik, tur) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([icerik], { type: tur }));
    a.download = ad;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('csv-indir').addEventListener('click', function () {
    dosyaIndir('kitaplar-' + new Date().toISOString().slice(0, 10) + '.csv', Csv.yaz(Csv.kitaplariSatirla(d)), 'text/csv;charset=utf-8');
  });
  $('csv-yukle').addEventListener('change', function (e) {
    var dosya = e.target.files[0];
    e.target.value = '';
    if (!dosya) return;
    dosya.text().then(function (metin) {
      var h = Csv.iceAktarHazirla(d, Csv.oku(metin));
      var ozet = h.kitaplar.length + ' kitap eklenecek.' +
        (h.atlanan ? '\n' + h.atlanan + ' kitap zaten kayıtlı (aynı barkod), atlanacak.' : '') +
        (h.hatalar.length ? '\n' + h.hatalar.length + ' satırda sorun var:\n' + h.hatalar.slice(0, 5).map(function (x) { return '• ' + x.satir + '. satır: ' + x.mesaj; }).join('\n') + (h.hatalar.length > 5 ? '\n…' : '') : '');
      if (!h.kitaplar.length) { O.pencere('Eklenecek kitap bulunamadı.\n' + ozet, { evet: 'Tamam' }); return; }
      return O.pencere(ozet + '\n\nDevam edilsin mi?', { evet: 'Kitapları ekle' }).then(function (tamam) {
        if (tamam) return yap(function () { return Veri.topluKitapEkle(h.kitaplar); }, function (n) { return n + ' kitap eklendi.'; });
      });
    }).catch(function () { genel('hata', 'Dosya okunamadı. CSV olarak kaydettiğinizden emin olun.'); });
  });

  // ---------- Revizeler ----------
  var DURUM = { yeni: 'Yeni', iletildi: 'İletildi', yapildi: 'Yapıldı' };
  var sonRevizeler = [];

  function tarih(t) {
    try { return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function revizeleriCiz() {
    var kap = $('revize-liste');
    return Veri.revizeler().then(function (liste) {
      sonRevizeler = liste;
      revizeSayaci(liste);
      if (!liste.length) { kap.innerHTML = '<p class="soluk">Henüz revize yok.</p>'; return; }
      kap.innerHTML = liste.map(function (r) {
        return '<article class="revize"><p>' + O.kacis(r.metin) + '</p><div class="alt-satir">' +
          '<span class="rozet ' + r.durum + '">' + DURUM[r.durum] + '</span>' +
          '<span style="flex-grow:1">' + O.kacis(r.yazan_ad || '') + ' · ' + tarih(r.olusturuldu) + '</span>' +
          (duzenleyici()
            ? '<label class="gizli-etiket" for="rd-' + r.id + '">Durum</label><select id="rd-' + r.id + '" data-is="revize-durum" data-id="' + r.id + '">' +
              Object.keys(DURUM).map(function (k) { return '<option value="' + k + '"' + (k === r.durum ? ' selected' : '') + '>' + DURUM[k] + '</option>'; }).join('') + '</select>' +
              '<button type="button" class="dugme kare tehlike" data-is="revize-sil" data-id="' + r.id + '" aria-label="Revizeyi sil">' + O.ikon.cop + '</button>'
            : '') + '</div></article>';
      }).join('');
    }).catch(function (e) { kap.innerHTML = '<div class="mesaj hata">' + O.kacis(e.message) + '</div>'; });
  }

  function revizeSayaci(liste) {
    var n = duzenleyici() ? liste.filter(function (r) { return r.durum === 'yeni'; }).length : 0;
    $('revize-sayac').hidden = !n;
    $('revize-sayac').textContent = n;
  }

  $('revize-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var metin = $('revize-metin').value;
    Veri.revizeEkle(metin, ben.ad || ben.eposta).then(function () {
      $('revize-metin').value = '';
      bildir($('revize-mesaj'), 'basari', 'Revize gönderildi.');
      revizeleriCiz();
    }).catch(function (err) { bildir($('revize-mesaj'), 'hata', err.message); });
  });

  $('revize-kopyala').addEventListener('click', function () {
    var yeni = sonRevizeler.filter(function (r) { return r.durum === 'yeni'; });
    if (!yeni.length) { genel('hata', 'Yeni revize yok.'); return; }
    var metin = 'Kitabım Hangi Rafta revizeleri:\n\n' + yeni.map(function (r, i) {
      return (i + 1) + '. ' + r.metin + (r.yazan_ad ? ' (' + r.yazan_ad + ')' : '');
    }).join('\n');
    navigator.clipboard.writeText(metin).then(function () {
      genel('basari', yeni.length + ' revize kopyalandı. Bunları Claude\'a yapıştırabilir, sonra durumlarını “İletildi” yapabilirsiniz.');
    }, function () { O.pencere('Kopyalanamadı. Metni seçip kopyalayın:', { girdi: true, deger: metin.replace(/\n/g, ' | ') }); });
  });

  // ---------- Kullanıcılar ----------
  function uyeleriCiz() {
    var kap = $('uye-liste');
    if (Veri.mod === 'yerel') {
      kap.innerHTML = '<li class="soluk">Deneme modunda kullanıcı yönetimi yok. Bulut bağlanınca burada kişi ekleyebilirsiniz.</li>';
      return Promise.resolve();
    }
    return Veri.uyeler().then(function (liste) {
      kap.innerHTML = liste.map(function (u) {
        var benim = u.user_id === ben.id;
        return '<li class="uye"><div class="metin"><b>' + O.kacis(u.ad || u.eposta) + (benim ? ' <span class="soluk">(siz)</span>' : '') + '</b>' +
          '<span class="soluk">' + O.kacis(u.eposta) + '</span></div>' +
          '<label class="gizli-etiket" for="ur-' + u.user_id + '">Yetki</label><select id="ur-' + u.user_id + '" data-is="uye-rol" data-id="' + u.user_id + '">' +
          ['duzenleyici', 'revizeci', 'calisan'].map(function (r) { return '<option value="' + r + '"' + (r === u.rol ? ' selected' : '') + '>' + Veri.ROL_ADI[r] + '</option>'; }).join('') + '</select>' +
          (u.kirtasiye_hesabi ? '<button type="button" class="dugme" data-is="uye-sifre" data-id="' + u.user_id + '">Şifre</button>' : '') +
          (benim ? '' : '<button type="button" class="dugme kare tehlike" data-is="uye-kaldir" data-id="' + u.user_id + '" data-ad="' + O.kacis(u.ad || u.eposta) + '" aria-label="' + O.kacis(u.ad || u.eposta) + ' kişisini kaldır">' + O.ikon.cop + '</button>') +
          '</li>';
      }).join('') || '<li class="soluk">Kimse yok.</li>';
    }).catch(function (e) { kap.innerHTML = '<li><div class="mesaj hata">' + O.kacis(e.message) + '</div></li>'; });
  }

  $('uye-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = { ad: $('u-ad').value, eposta: $('u-eposta').value, sifre: $('u-sifre').value, rol: $('u-rol').value };
    Veri.uyeEkle(u).then(function (s) {
      bildir($('uye-mesaj'), 'basari', (u.ad || u.eposta) + ' eklendi' + (s && s.mevcutHesap ? ' (mevcut hesabıyla; kendi şifresiyle girer).' : '. Şifreyi kendisine iletin.'));
      ['u-ad', 'u-eposta', 'u-sifre'].forEach(function (i) { $(i).value = ''; });
      uyeleriCiz();
    }).catch(function (err) { bildir($('uye-mesaj'), 'hata', err.message); });
  });

  // ---------- Ayarlar ----------
  $('magaza-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ad = $('ayar-magaza').value;
    yap(function () { return Veri.ayarKaydet('magazaAdi', ad); }, 'Mağaza adı kaydedildi.').catch(sus);
  });

  function ayarlariCiz() {
    if (document.activeElement !== $('ayar-magaza')) $('ayar-magaza').value = d.ayarlar.magazaAdi || '';
    $('ayar-fiyat').checked = d.ayarlar.fiyat;
    $('ayar-stok').checked = d.ayarlar.stok;
    $('alan-fiyat').hidden = !d.ayarlar.fiyat;
    $('alan-stok').hidden = !d.ayarlar.stok;
    $('mod-bilgi').textContent = Veri.mod === 'yerel'
      ? 'Deneme modu: veriler yalnız bu cihazın tarayıcısında saklanıyor. Düzenli olarak yedek indirin.'
      : 'Veriler bulutta saklanıyor. İsterseniz kayıt için yedek indirebilirsiniz.';
    $('yedek-yukle-etiket').hidden = Veri.mod !== 'yerel';
  }
  ['fiyat', 'stok'].forEach(function (alan) {
    $('ayar-' + alan).addEventListener('change', function (e) {
      var acik = e.target.checked;
      yap(function () { return Veri.ayarKaydet(alan, acik); }, (alan === 'fiyat' ? 'Fiyat' : 'Stok') + (acik ? ' açıldı.' : ' kapatıldı.')).catch(function () { ayarlariCiz(); });
    });
  });

  $('yedek-indir').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kitabim-hangi-rafta-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('yedek-yukle').addEventListener('change', function (e) {
    var dosya = e.target.files[0];
    e.target.value = '';
    if (!dosya) return;
    dosya.text().then(function (metin) {
      var ham = JSON.parse(metin);
      var yeni = Depo.duzelt(ham);
      return O.pencere(yeni.raflar.length + ' raf ve ' + yeni.kitaplar.length + ' kitap yüklenecek. Şu anki verilerin YERİNE geçecek. Devam edilsin mi?', { evet: 'Yükle', tehlike: true }).then(function (tamam) {
        if (tamam) return Veri.yerineKoy(ham).then(function () { genel('basari', 'Yedek yüklendi.'); });
      });
    }).catch(function () {
      genel('hata', 'Dosya okunamadı. Doğru yedek dosyasını seçtiğinizden emin olun.');
    });
  });

  // ---------- Giriş ----------
  function goster(bolum) {
    ['giris', 'yetkisiz', 'panel'].forEach(function (b) { $(b).hidden = b !== bolum; });
  }

  $('giris-form').addEventListener('submit', function (e) {
    e.preventDefault();
    bildir($('giris-mesaj'), '', '');
    Veri.girisYap($('g-eposta').value, $('g-sifre').value).then(baslat)
      .catch(function (err) { bildir($('giris-mesaj'), 'hata', err.message); });
  });

  $('kurulum-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var eposta = $('k-eposta').value, sifre = $('k-sifre').value;
    Veri.ilkKurulum($('k-ad').value, eposta, sifre)
      .then(function () { return Veri.girisYap(eposta, sifre); })
      .then(baslat)
      .catch(function (err) { bildir($('kurulum-mesaj'), 'hata', err.message); });
  });

  function girisGoster() {
    goster('giris');
    Veri.kurulumGerekli().then(function (gerekli) {
      $('kurulum-form').hidden = !gerekli;
      $('giris-form').hidden = gerekli;
    });
  }

  var dinleniyor = false;
  // Ayrı dosyalardaki bölümler (okul listeleri, talepler, harita, geçmiş) buradan bağlanır.
  window.Panel = {
    d: function () { return d; },
    ben: function () { return ben; },
    yap: yap, sus: sus, bildir: bildir, genel: genel, yetkili: yetkili, kapakHucre: kapakHucre,
    sekmeEkle: function (ad, baslik, ciz) {
      sekmeler.push(ad); BASLIK[ad] = baslik; ekSekmeler[ad] = ciz;
      $('sek-' + ad).addEventListener('click', function () { sekmeAc(ad); });
    },
    herCizimde: function (fn) { herCizim.push(fn); },
    sekmeAc: function (ad) { sekmeAc(ad); },
    kitapFormuAc: function (giris) {
      formuTemizle(giris && giris.bolmeId);
      bildir($('form-mesaj'), '', '');
      if (giris && giris.ad) $('f-ad').value = giris.ad;
      cekmeceAc(giris && giris.ad ? 'f-yazar' : 'f-barkod');
      // Barkod verildiyse (ör. şube listesindeki kayıtsız kitap) bilgiler internetten gelsin.
      if (giris && giris.barkod) { $('f-barkod').value = giris.barkod; barkodKontrol(); bilgiGetir(); }
    }
  };

  O.ikonlariDoldur();
  function baslat() {
    return Veri.oturum().then(function (o) {
      ben = o;
      if (!o) return girisGoster();
      if (!o.rol) return goster('yetkisiz');
      goster('panel');
      yetkileriUygula();
      if (!dinleniyor) { dinleniyor = true; Veri.dinle(function (yeni) { d = yeni; hepsiniCiz(); }); }
      return Veri.yukle().then(function (yeni) {
        d = yeni;
        hepsiniCiz();
        var h = location.hash.slice(1);
        sekmeAc(sekmeler.indexOf(h) >= 0 ? h : 'genel');
        if (yetkili('duzenleyici')) Veri.revizeler().then(revizeSayaci, sus);
      }).catch(function (e) { genel('hata', e.message); });
    });
  }
  Veri.durumDinle(function (dr) {
    $('cevrimdisi').hidden = !dr.cevrimdisi;
    if (dr.cevrimdisi) $('cevrimdisi').innerHTML = '<i aria-hidden="true"></i>İnternet bağlantısı yok. Gördüğünüz liste son kaydedilen hâli; bağlantı gelene kadar değişiklikler kaydedilemez.';
  });

  window.addEventListener('hashchange', function () {
    var h = location.hash.slice(1);
    if (ben && sekmeler.indexOf(h) >= 0) sekmeAc(h);
  });

  // Ek bölüm dosyaları yüklensin diye sayfa tamamen hazır olunca başla.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat); else setTimeout(baslat, 0);
})();
