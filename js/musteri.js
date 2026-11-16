// Müşteri ekranı: arama, sonuç kartı ve raf şeması.
(function () {
  var O = Ortak;
  var d = Depo.bos();
  var seciliKitapId = null;
  var sonSorgu = '';
  var bekleme = null;
  var BOSTA_SURE = 90 * 1000; // Dokunulmazsa ekran 90 sn sonra başa döner.

  var sorgu = document.getElementById('sorgu');
  var sonuc = document.getElementById('sonuc');
  var semaKart = document.getElementById('sema-kart');
  var sema = document.getElementById('sema');
  var semaNot = document.getElementById('sema-not');

  document.getElementById('logo-ikon').innerHTML = O.ikon.kitap;
  document.getElementById('ara-ikon').innerHTML = O.ikon.ara;
  document.getElementById('barkod-ikon').innerHTML = O.ikon.barkod;

  function semaCiz(hedefBolmeId) {
    var raflar = O.sirali(d.raflar);
    if (!raflar.length) { semaKart.hidden = true; return; }
    semaKart.hidden = false;
    semaNot.textContent = hedefBolmeId ? 'Turuncu bölme: aradığınız kitap' : '';
    sema.innerHTML = raflar.map(function (r) {
      var icinde = r.bolmeler.some(function (b) { return b.id === hedefBolmeId; });
      return '<div class="raf' + (icinde ? ' vurgu' : '') + '">' +
        '<div class="raf-bas"><div class="raf-ad"><strong>' + r.no + '. Raf</strong></div>' +
        (r.etiket ? '<span class="soluk">' + O.kacis(r.etiket) + '</span>' : '') + '</div>' +
        '<div class="bolmeler">' + O.siraliBolmeler(r).map(function (b) {
          var bu = b.id === hedefBolmeId;
          return '<div class="bolme' + (bu ? ' hedef' : '') + '"' + (bu ? ' aria-label="Aradığınız kitap burada"' : '') + '>' + r.no + '.' + b.no + '</div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function kartCiz(k) {
    var yer = Depo.konum(d, k.bolmeId);
    var kutular = '';
    if (d.ayarlar.fiyat && k.fiyat != null) {
      kutular += '<div class="kutucuk"><span>Fiyat</span><b>' + O.para(k.fiyat) + '</b></div>';
    }
    if (d.ayarlar.stok && k.stok != null) {
      kutular += k.stok > 0
        ? '<div class="kutucuk"><span>Stok</span><b style="color:var(--yesil)">Rafta var</b></div>'
        : '<div class="kutucuk"><span>Stok</span><b style="color:var(--kirmizi)">Tükendi</b></div>';
    }
    return '<div class="kart kitap-kart">' +
      '<div><h2>' + O.kacis(k.ad) + '</h2>' +
      (k.yazar ? '<p class="bilgi">Yazar: <strong>' + O.kacis(k.yazar) + '</strong></p>' : '') +
      (k.yayinevi ? '<p class="bilgi">Yayınevi: <strong>' + O.kacis(k.yayinevi) + '</strong></p>' : '') +
      (k.barkod ? '<p class="soluk" style="margin-top:6px">Barkod: ' + O.kacis(k.barkod) + '</p>' : '') + '</div>' +
      (yer
        ? '<div class="yer">' + O.ikon.konum + '<div><p>Bu kitap burada</p><strong>' + yer.raf.no + '. Raf · Bölme ' + yer.kod + '</strong></div></div>'
        : '<div class="mesaj hata">Bu kitabın rafı kayıtlı değil. Lütfen görevliye sorun.</div>') +
      (kutular ? '<div class="kutucuklar">' + kutular + '</div>' : '') +
      '</div>';
  }

  function goster() {
    var s = sorgu.value;
    sonSorgu = s;
    if (!s.trim()) {
      sonuc.innerHTML = d.kitaplar.length ? '' : '<div class="bos-durum">Henüz kitap eklenmemiş.</div>';
      semaCiz(null);
      return;
    }
    var bulunan = Arama.ara(d.kitaplar, s);
    if (!bulunan.length) {
      sonuc.innerHTML = '<div class="kart bos-durum">“' + O.kacis(s.trim()) + '” bulunamadı.<br><span style="font-size:15px">Yazımı kontrol edin ya da görevliye sorun.</span></div>';
      semaCiz(null);
      return;
    }
    var secili = bulunan.find(function (k) { return k.id === seciliKitapId; }) || bulunan[0];
    seciliKitapId = secili.id;
    var html = '<div class="sonuc-alani">' + kartCiz(secili);
    if (bulunan.length > 1) {
      html += '<div><h2 style="font-size:18px;margin-bottom:10px">' + bulunan.length + ' kitap bulundu</h2><div class="liste">' +
        bulunan.slice(0, 20).map(function (k) {
          var yer = Depo.konum(d, k.bolmeId);
          return '<button type="button" data-id="' + O.kacis(k.id) + '"' + (k.id === secili.id ? ' aria-current="true" style="border:2px solid var(--mavi)"' : '') + '>' +
            '<span><b>' + O.kacis(k.ad) + '</b><br><span class="soluk">' + O.kacis([k.yazar, k.yayinevi].filter(Boolean).join(' · ')) + '</span></span>' +
            '<span class="kod">' + (yer ? yer.kod : '?') + '</span></button>';
        }).join('') + '</div></div>';
    }
    sonuc.innerHTML = html + '</div>';
    semaCiz(secili.bolmeId);
  }

  sonuc.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    seciliKitapId = b.getAttribute('data-id');
    goster();
  });

  var gecikme = null;
  sorgu.addEventListener('input', function () {
    clearTimeout(gecikme);
    seciliKitapId = null;
    gecikme = setTimeout(goster, 250);
  });

  document.getElementById('arama-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(gecikme);
    seciliKitapId = null;
    goster();
  });

  document.getElementById('tara').addEventListener('click', function () {
    Tarayici.ac(function (kod) {
      sorgu.value = kod;
      seciliKitapId = null;
      goster();
    });
  });

  function bastanBasla() {
    sorgu.value = '';
    seciliKitapId = null;
    goster();
    sorgu.focus();
  }
  function hareket() {
    clearTimeout(bekleme);
    bekleme = setTimeout(bastanBasla, BOSTA_SURE);
  }
  ['pointerdown', 'keydown', 'input'].forEach(function (olay) { document.addEventListener(olay, hareket); });

  Veri.dinle(function (yeni) { d = yeni; if (sonSorgu === sorgu.value) goster(); });
  Veri.yukle().then(function (yeni) { d = yeni; goster(); hareket(); }).catch(function (e) {
    sonuc.innerHTML = '<div class="mesaj hata">Kitap listesi yüklenemedi: ' + O.kacis(e.message) + '</div>';
  });
})();
