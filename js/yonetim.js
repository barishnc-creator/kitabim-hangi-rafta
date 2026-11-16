// Çalışan paneli: raf şeması, kitap ekleme/düzenleme, ayarlar.
(function () {
  var O = Ortak;
  var d = Depo.bos();
  var seciliBolmeId = null;
  var duzenlenenId = null;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Genel ----------
  function bildir(kutu, tur, metin) {
    kutu.innerHTML = metin ? '<div class="mesaj ' + tur + '">' + O.kacis(metin) + '</div>' : '';
  }

  function degistir(fn, basariMetni) {
    return Veri.degistir(fn).then(function (sonuc) {
      if (basariMetni) bildir($('genel-mesaj'), 'basari', basariMetni);
      return sonuc;
    }).catch(function (e) {
      bildir($('genel-mesaj'), 'hata', e.message || 'Bir hata oluştu.');
      throw e;
    });
  }

  function hepsiniCiz() {
    semaCiz();
    panelCiz();
    rafSecenekleri();
    listeCiz();
    ayarlariCiz();
  }

  // ---------- Sekmeler ----------
  var sekmeler = ['raflar', 'kitaplar', 'ayarlar'];
  function sekmeAc(ad) {
    sekmeler.forEach(function (s) {
      $(s).hidden = s !== ad;
      $('sek-' + s).setAttribute('aria-selected', String(s === ad));
    });
    bildir($('genel-mesaj'), '', '');
    if (location.hash !== '#' + ad) history.replaceState(null, '', '#' + ad);
  }
  sekmeler.forEach(function (s) {
    $('sek-' + s).addEventListener('click', function () { sekmeAc(s); });
  });

  // ---------- Raflar ----------
  $('raf-ekle-dugme').innerHTML = O.ikon.arti + 'Raf ekle';

  $('raf-ekle-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var sayi = Math.max(1, Math.min(30, parseInt($('raf-bolme').value, 10) || 1));
    var etiket = $('raf-etiket').value;
    degistir(function (x) { return Depo.rafEkle(x, etiket, sayi); }).then(function (r) {
      bildir($('genel-mesaj'), 'basari', r.no + '. Raf eklendi (' + sayi + ' bölme).');
      $('raf-etiket').value = '';
    });
  });

  function semaCiz() {
    var kap = $('yonetim-sema');
    var raflar = O.sirali(d.raflar);
    if (!raflar.length) {
      kap.innerHTML = '<div class="kart" style="grid-column:1/-1;text-align:center;color:var(--ikincil)">Henüz raf yok. Yukarıdan ilk rafı ekleyin.</div>';
      return;
    }
    kap.innerHTML = raflar.map(function (r) {
      return '<section class="raf">' +
        '<div class="raf-bas"><div class="raf-ad"><strong>' + r.no + '. Raf</strong>' +
        '<div class="soluk">' + (r.etiket ? O.kacis(r.etiket) + ' · ' : '') + r.bolmeler.length + ' bölme · ' + Depo.rafKitapSayisi(d, r) + ' kitap</div></div>' +
        '<button type="button" class="dugme kare" data-is="raf-adlandir" data-id="' + r.id + '" aria-label="' + r.no + '. rafın etiketini değiştir">' + O.ikon.kalem + '</button>' +
        '<button type="button" class="dugme kare tehlike" data-is="raf-sil" data-id="' + r.id + '" aria-label="' + r.no + '. rafı sil">' + O.ikon.cop + '</button></div>' +
        '<div class="bolmeler">' + O.siraliBolmeler(r).map(function (b) {
          var n = Depo.bolmeKitaplari(d, b.id).length;
          return '<button type="button" class="bolme' + (b.id === seciliBolmeId ? ' secili' : '') + '" data-is="bolme-sec" data-id="' + b.id + '" aria-pressed="' + (b.id === seciliBolmeId) + '">' +
            r.no + '.' + b.no + '<small>' + n + ' kitap</small></button>';
        }).join('') +
        '<button type="button" class="bolme ekle" data-is="bolme-ekle" data-id="' + r.id + '">+ Bölme</button></div></section>';
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
      '<button type="button" class="dugme ana" data-is="bolmeye-ekle">' + O.ikon.arti + 'Bu bölmeye kitap ekle</button>' +
      (kitaplar.length
        ? '<ul class="kitap-liste">' + kitaplar.map(kitapSatiri).join('') + '</ul>'
        : '<p class="soluk">Bu bölmede kitap yok.</p>') +
      '<button type="button" class="dugme tehlike" data-is="bolme-sil">' + O.ikon.cop + 'Bölmeyi sil</button></div>';
  }

  function kitapSatiri(k) {
    var yer = Depo.konum(d, k.bolmeId);
    return '<li><div class="metin"><b>' + O.kacis(k.ad) + '</b><span class="soluk">' +
      O.kacis([k.yazar, k.yayinevi].filter(Boolean).join(' · ') || '—') + '</span></div>' +
      '<span class="kod">' + (yer ? yer.kod : '?') + '</span>' +
      '<button type="button" class="dugme kare" data-is="kitap-duzenle" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını düzenle">' + O.ikon.kalem + '</button>' +
      '<button type="button" class="dugme kare tehlike" data-is="kitap-sil" data-id="' + k.id + '" aria-label="' + O.kacis(k.ad) + ' kitabını sil">' + O.ikon.cop + '</button></li>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-is]');
    if (!b) return;
    var is = b.getAttribute('data-is');
    var id = b.getAttribute('data-id');

    if (is === 'bolme-sec') { seciliBolmeId = id; semaCiz(); panelCiz(); }
    else if (is === 'bolme-ekle') {
      degistir(function (x) { return Depo.bolmeEkle(x, id); }).then(function (yeni) { seciliBolmeId = yeni.id; hepsiniCiz(); });
    }
    else if (is === 'raf-adlandir') {
      var r = d.raflar.find(function (x) { return x.id === id; });
      var yeniEtiket = prompt(r.no + '. raf için etiket (örn. Test kitapları):', r.etiket || '');
      if (yeniEtiket !== null) degistir(function (x) { Depo.rafGuncelle(x, id, { etiket: yeniEtiket }); });
    }
    else if (is === 'raf-sil') {
      var rs = d.raflar.find(function (x) { return x.id === id; });
      if (confirm(rs.no + '. raf ve bölmeleri silinsin mi?')) degistir(function (x) { Depo.rafSil(x, id); }, rs.no + '. Raf silindi.').catch(function () {});
    }
    else if (is === 'bolme-sil') {
      var y = Depo.konum(d, seciliBolmeId);
      if (y && confirm(y.kod + ' bölmesi silinsin mi?')) {
        var silinecek = seciliBolmeId;
        degistir(function (x) { Depo.bolmeSil(x, silinecek); }, y.kod + ' bölmesi silindi.').then(function () { seciliBolmeId = null; panelCiz(); }).catch(function () {});
      }
    }
    else if (is === 'bolmeye-ekle') { formuTemizle(seciliBolmeId); sekmeAc('kitaplar'); $('f-barkod').focus(); }
    else if (is === 'kitap-duzenle') { formaYukle(id); sekmeAc('kitaplar'); $('f-ad').focus(); }
    else if (is === 'kitap-sil') {
      var k = d.kitaplar.find(function (x) { return x.id === id; });
      if (k && confirm('“' + k.ad + '” silinsin mi?')) {
        degistir(function (x) { Depo.kitapSil(x, id); }, '“' + k.ad + '” silindi.');
        if (duzenlenenId === id) formuTemizle();
      }
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
    ['f-barkod', 'f-ad', 'f-yazar', 'f-yayinevi', 'f-fiyat', 'f-stok'].forEach(function (i) { $(i).value = ''; });
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

  // Barkod tabancası kodu yazıp Enter'a basar: formu göndermek yerine ada geç.
  $('f-barkod').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); barkodKontrol(); $('f-ad').focus(); }
  });
  $('f-barkod').addEventListener('change', barkodKontrol);
  $('f-tara').addEventListener('click', function () {
    Tarayici.ac(function (kod) { $('f-barkod').value = kod; barkodKontrol(); $('f-ad').focus(); });
  });
  $('f-vazgec').addEventListener('click', function () { formuTemizle(); bildir($('form-mesaj'), '', ''); });

  $('kitap-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var giris = {
      id: duzenlenenId || undefined,
      barkod: $('f-barkod').value,
      ad: $('f-ad').value,
      yazar: $('f-yazar').value,
      yayinevi: $('f-yayinevi').value,
      bolmeId: $('f-bolme').value
    };
    var eski = duzenlenenId && d.kitaplar.find(function (k) { return k.id === duzenlenenId; });
    // Kapalı alanlar formda görünmez; düzenlemede eski değer korunur.
    giris.fiyat = d.ayarlar.fiyat ? $('f-fiyat').value : (eski ? eski.fiyat : null);
    giris.stok = d.ayarlar.stok ? $('f-stok').value : (eski ? eski.stok : null);

    function kaydet(izin) {
      return Veri.degistir(function (x) { return Depo.kitapKaydet(x, giris, { ayniBarkodaIzin: izin }); });
    }
    kaydet(false).catch(function (err) {
      if (err.kod === 'AYNI_BARKOD' && confirm(err.message + '\n\nYine de ayrı bir kayıt olarak eklensin mi?')) return kaydet(true);
      throw err;
    }).then(function (k) {
      if (!k) return;
      var yer = Depo.konum(d, k.bolmeId);
      bildir($('form-mesaj'), 'basari', '“' + k.ad + '” kaydedildi → ' + (yer ? yer.raf.no + '. Raf · Bölme ' + yer.kod : ''));
      formuTemizle(k.bolmeId); // Raf/bölme seçili kalır: art arda ekleme hızlı olur.
      $('f-barkod').focus();
    }).catch(function (err) {
      bildir($('form-mesaj'), 'hata', err.message || 'Kaydedilemedi.');
    });
  });

  function listeCiz() {
    var s = $('liste-ara').value;
    var liste = s.trim() ? Arama.ara(d.kitaplar, s) : d.kitaplar.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    $('kitap-sayi').textContent = '(' + d.kitaplar.length + ')';
    $('tum-kitaplar').innerHTML = liste.length
      ? liste.slice(0, 200).map(kitapSatiri).join('')
      : '<li class="soluk">' + (d.kitaplar.length ? 'Eşleşen kitap yok.' : 'Henüz kitap eklenmedi.') + '</li>';
  }
  $('liste-ara').addEventListener('input', listeCiz);

  // ---------- Ayarlar ----------
  function ayarlariCiz() {
    $('ayar-fiyat').checked = d.ayarlar.fiyat;
    $('ayar-stok').checked = d.ayarlar.stok;
    $('alan-fiyat').hidden = !d.ayarlar.fiyat;
    $('alan-stok').hidden = !d.ayarlar.stok;
    $('mod-bilgi').textContent = Veri.mod === 'yerel'
      ? 'Şu an veriler yalnız bu cihazın tarayıcısında saklanıyor. Düzenli olarak yedek indirin.'
      : 'Veriler bulutta saklanıyor.';
  }
  ['fiyat', 'stok'].forEach(function (alan) {
    $('ayar-' + alan).addEventListener('change', function (e) {
      var acik = e.target.checked;
      degistir(function (x) { x.ayarlar[alan] = acik; }, (alan === 'fiyat' ? 'Fiyat' : 'Stok') + (acik ? ' açıldı.' : ' kapatıldı.'));
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
      if (!confirm(yeni.raflar.length + ' raf ve ' + yeni.kitaplar.length + ' kitap yüklenecek. Şu anki verilerin YERİNE geçecek. Devam edilsin mi?')) return;
      return Veri.yerineKoy(ham).then(function () { bildir($('genel-mesaj'), 'basari', 'Yedek yüklendi.'); });
    }).catch(function () {
      bildir($('genel-mesaj'), 'hata', 'Dosya okunamadı. Doğru yedek dosyasını seçtiğinizden emin olun.');
    });
  });

  // ---------- Başlat ----------
  Veri.dinle(function (yeni) { d = yeni; hepsiniCiz(); });
  Veri.yukle().then(function (yeni) {
    d = yeni;
    hepsiniCiz();
    var h = location.hash.slice(1);
    sekmeAc(sekmeler.indexOf(h) >= 0 ? h : 'raflar');
  });
})();
