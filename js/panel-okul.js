// Yönetim paneli: Okul listeleri. Okulun listesi yapıştırılır, kitaplarla bulanık eşleştirilir, kaydedilir.
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var acik = null;        // düzenlenen listenin id'si (yeni listede null)
  var kalemler = [];      // [{ metin, kitapId, duzeltildi }]
  var yetki = function () { return P.yetkili('duzenleyici', 'calisan'); };

  function listeleriCiz() {
    var d = P.d();
    var liste = d.okulListeleri.slice().sort(function (a, b) {
      return a.okul.localeCompare(b.okul, 'tr') || a.sinif.localeCompare(b.sinif, 'tr', { numeric: true });
    });
    $('okul-listeler').innerHTML = liste.length ? liste.map(function (l) {
      var du = Depo.listeDurumu(d, l);
      return '<li><button type="button" class="yan-ogesi" data-okul="' + l.id + '" style="color:inherit;padding:0 6px;' + (l.id === acik ? 'background:var(--mavi-acik)' : '') + '">' +
        '<span class="metin" style="padding:6px 0"><b>' + O.kacis(l.okul + ' · ' + l.sinif) + '</b><span>' + du.toplam + ' kitap · ' + O.sayiEki(du.hazir) + ' hazır</span></span></button></li>';
    }).join('') : '<li class="bos-not">Henüz liste yok. “Yeni” ile başlayın.</li>';
    var okullar = {};
    d.okulListeleri.forEach(function (l) { okullar[l.okul] = 1; });
    $('okul-adlari').innerHTML = Object.keys(okullar).map(function (o) { return '<option value="' + O.kacis(o) + '">'; }).join('');
  }

  function sonucCiz() {
    var d = P.d();
    $('okul-sonuc-kart').hidden = !kalemler.length;
    if (!kalemler.length) return;
    var kitaplar = d.kitaplar.slice().sort(function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); });
    var bulunan = kalemler.filter(function (k) { return k.kitapId; }).length;
    $('okul-ozet').textContent = kalemler.length + ' satırdan ' + O.sayiEki(bulunan) + ' eşleşti';
    var duzen = yetki();
    $('okul-satirlar').innerHTML = kalemler.map(function (k, i) {
      var kitap = k.kitapId && d.kitaplar.find(function (x) { return x.id === k.kitapId; });
      var yer = kitap && Depo.konum(d, kitap.bolmeId);
      var secenekler = '<option value="">— Mağazada yok —</option>' + kitaplar.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === k.kitapId ? ' selected' : '') + '>' + O.kacis(x.ad) + (x.yazar ? ' · ' + O.kacis(x.yazar) : '') + '</option>';
      }).join('');
      return '<tr><td>' + (kitap ? '<span style="color:var(--yesil);font-weight:700" aria-label="Eşleşti">✓</span>' : '<span style="color:#B45309;font-weight:700" aria-label="Eşleşmedi">?</span>') + '</td>' +
        '<td>' + O.kacis(k.metin) + (k.duzeltildi && kitap ? '<div class="soluk">yazım farkı düzeltildi</div>' : '') + '</td>' +
        '<td>' + (duzen
          ? '<label class="gizli-etiket" for="ok-' + i + '">Kitap seçin</label><select id="ok-' + i + '" data-kalem="' + i + '" style="max-width:320px;min-height:40px;border:1px solid var(--cizgi-koyu);border-radius:8px;font:inherit">' + secenekler + '</select>' +
            (kitap ? '' : ' <button type="button" class="dugme" data-kalem-ekle="' + i + '" style="min-height:40px">Kitap ekle</button>')
          : O.kacis(kitap ? kitap.ad : 'Mağazada yok')) + '</td>' +
        '<td>' + (yer ? '<span class="kod-rozet">' + yer.kod + '</span>' : '—') + '</td></tr>';
    }).join('');
  }

  function formuDoldur(liste) {
    acik = liste ? liste.id : null;
    $('okul-ad').value = liste ? liste.okul : '';
    $('okul-sinif').value = liste ? liste.sinif : '';
    $('okul-metin').value = liste ? liste.kalemler.map(function (k) { return k.metin; }).join('\n') : '';
    kalemler = liste ? liste.kalemler.map(function (k) { return { metin: k.metin, kitapId: k.kitapId, duzeltildi: false }; }) : [];
    $('okul-sil').hidden = !liste || !yetki();
    P.bildir($('okul-mesaj'), '', '');
    ['okul-ad', 'okul-sinif', 'okul-metin'].forEach(function (i) { $(i).readOnly = !yetki(); });
    listeleriCiz();
    sonucCiz();
  }

  function eslestir() {
    var eski = {};
    kalemler.forEach(function (k) { eski[k.metin] = k.kitapId; }); // elle yapılan seçimler korunur
    kalemler = Arama.listeyiCoz(P.d().kitaplar, $('okul-metin').value).map(function (k) {
      if (Object.prototype.hasOwnProperty.call(eski, k.metin)) { k.kitapId = eski[k.metin]; k.duzeltildi = false; }
      return k;
    });
    if (!kalemler.length) P.bildir($('okul-mesaj'), 'hata', 'Listeye en az bir kitap satırı yazın.');
    else P.bildir($('okul-mesaj'), '', '');
    sonucCiz();
  }

  $('okul-eslestir').addEventListener('click', eslestir);
  $('okul-yeni').addEventListener('click', function () { formuDoldur(null); $('okul-ad').focus(); });

  $('okul-listeler').addEventListener('click', function (e) {
    var b = e.target.closest('[data-okul]');
    if (!b) return;
    var l = P.d().okulListeleri.find(function (x) { return x.id === b.getAttribute('data-okul'); });
    if (l) formuDoldur(l);
  });

  $('okul-satirlar').addEventListener('change', function (e) {
    var i = e.target.getAttribute('data-kalem');
    if (i == null) return;
    kalemler[i].kitapId = e.target.value || null;
    kalemler[i].duzeltildi = false;
    sonucCiz();
  });
  $('okul-satirlar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kalem-ekle]');
    if (!b) return;
    var k = kalemler[b.getAttribute('data-kalem-ekle')];
    P.kitapFormuAc({ ad: Arama.satirCoz(k.metin).ad });
  });

  $('okul-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!yetki()) return;
    // Metin değiştiyse ama eşleştirilmediyse önce eşleştir.
    var metinler = Arama.listeyiCoz([], $('okul-metin').value).map(function (k) { return k.metin; }).join('\n');
    if (metinler !== kalemler.map(function (k) { return k.metin; }).join('\n')) eslestir();
    var giris = { id: acik || undefined, okul: $('okul-ad').value, sinif: $('okul-sinif').value, kalemler: kalemler };
    P.yap(function () { return Veri.okulListesiKaydet(giris); }, function (l) { return l.okul + ' · ' + l.sinif + ' listesi kaydedildi.'; })
      .then(function (l) {
        P.bildir($('okul-mesaj'), 'basari', 'Kaydedildi. Müşteri ekranında “Okul listeleri” bölümünde görünür.');
        acik = l.id;
        $('okul-sil').hidden = false;
        listeleriCiz();
      }, function (err) { P.bildir($('okul-mesaj'), 'hata', err.message); });
  });

  $('okul-sil').addEventListener('click', function () {
    var l = P.d().okulListeleri.find(function (x) { return x.id === acik; });
    if (!l) return;
    O.pencere(l.okul + ' · ' + l.sinif + ' listesi silinsin mi?', { evet: 'Sil', tehlike: true }).then(function (tamam) {
      if (tamam) P.yap(function () { return Veri.okulListesiSil(l.id); }, 'Liste silindi.').then(function () { formuDoldur(null); }, P.sus);
    });
  });

  P.sekmeEkle('okul', 'Okul listeleri', function () {
    // Açık liste başka cihazdan silindiyse formu boşalt; değilse yalnız listeyi ve eşleşmeyi tazele.
    if (acik && !P.d().okulListeleri.some(function (l) { return l.id === acik; })) formuDoldur(null);
    else { listeleriCiz(); sonucCiz(); }
  });
})();
