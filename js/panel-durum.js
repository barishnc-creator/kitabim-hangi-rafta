// Yönetim paneli: Sistem durumu (yalnız düzenleyici). Hata kaydı ve veritabanı doluluğu (supabase/hata-kaydi.sql).
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var acik = {};

  function zaman(t) {
    if (!t) return '—';
    var d = new Date(t), fark = (Date.now() - d.getTime()) / 60000;
    if (fark < 1) return 'az önce';
    if (fark < 60) return Math.round(fark) + ' dk önce';
    if (fark < 1440) return Math.round(fark / 60) + ' saat önce';
    return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function sayi(n) { return Number(n || 0).toLocaleString('tr-TR'); }
  function kpi(renk, ikon, etiket, deger, alt) {
    return '<div class="kart kpi"><div class="kpi-ikon ' + renk + '">' + O.ikon[ikon] + '</div><div><span>' + etiket + '</span><b>' + deger + '</b>' + (alt ? '<small>' + alt + '</small>' : '') + '</div></div>';
  }
  function mesaj(tur, metin) { $('durum-mesaj').innerHTML = metin ? '<div class="mesaj ' + tur + '">' + O.kacis(metin) + '</div>' : ''; }

  function sayacYaz(n) {
    $('hata-sayac').hidden = !n;
    $('hata-sayac').textContent = n > 99 ? '99+' : String(n);
  }

  function ciz() {
    if (Veri.mod !== 'bulut') {
      $('durum-kpiler').innerHTML = '';
      $('durum-hatalar').innerHTML = '<tr><td colspan="4" class="bos-not" style="text-align:center;padding:24px">Deneme modunda (veri bu cihazda) hata kaydı tutulmaz.</td></tr>';
      return Promise.resolve();
    }
    return Promise.all([Veri.sistemDurumu(), Veri.hatalar()]).then(function (s) {
      var d = s[0], l = s[1];
      $('durum-kurulum').hidden = !!(d && l);
      if (d) {
        var doluluk = Math.round(100 * d.veritabani_mb / d.veritabani_sinir_mb);
        $('durum-kpiler').innerHTML =
          kpi(d.hata_24_saat ? 'turuncu' : 'yesil', d.hata_24_saat ? 'uyari' : 'nabiz', 'Son 24 saatte hata', sayi(d.hata_24_saat), d.son_hata ? 'son: ' + zaman(d.son_hata) : 'hiç hata yok') +
          kpi('mavi', 'kitap18', 'Kitap', sayi(d.kitap), sayi(d.rafsiz) + ' tanesi rafa yerleştirilecek') +
          kpi(doluluk >= 80 ? 'turuncu' : 'mor', 'veritabani', 'Veritabanı', Number(d.veritabani_mb).toLocaleString('tr-TR') + ' MB', '%' + doluluk + ' dolu (ücretsiz sınır ' + d.veritabani_sinir_mb + ' MB)') +
          kpi('yesil', 'saat', 'Program sürümü', O.kacis(Hata.SURUM), 'son kitap değişikliği ' + zaman(d.son_kitap_degisikligi));
        sayacYaz(d.hata_gorulmemis);
      }
      if (!l) { $('durum-hatalar').innerHTML = ''; return; }
      $('durum-hatalar').innerHTML = l.length ? l.map(function (h) {
        return '<tr' + (h.goruldu ? '' : ' style="background:#FFFBEB"') + '><td>' + zaman(h.son) + (h.adet > 1 ? '<div class="soluk">ilk: ' + zaman(h.ilk) + '</div>' : '') + '</td>' +
          '<td><b>' + O.kacis(h.mesaj) + '</b>' + (h.goruldu ? '' : ' <span class="rozet r-az">Yeni</span>') +
            (h.ayrinti ? '<div><button type="button" class="dugme" data-ayrinti="' + h.id + '" style="min-height:30px;padding:2px 10px;margin-top:4px">' + (acik[h.id] ? 'Ayrıntıyı gizle' : 'Ayrıntı') + '</button></div>' +
              (acik[h.id] ? '<pre style="white-space:pre-wrap;font-size:12px;margin-top:6px">' + O.kacis(h.ayrinti) + '</pre>' : '') : '') + '</td>' +
          '<td>' + (h.ekran === 'panel' ? 'Panel' : 'Müşteri ekranı') + '<div class="soluk">' + O.kacis([h.cihaz, h.kullanici, h.surum].filter(Boolean).join(' · ')) + '</div></td>' +
          '<td class="sayi">' + sayi(h.adet) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="bos-not" style="text-align:center;padding:24px">Kayıtlı hata yok. Her şey yolunda.</td></tr>';
    }).catch(function (e) { mesaj('hata', 'Sistem durumu okunamadı: ' + e.message); });
  }

  $('durum-yenile').addEventListener('click', function () { mesaj('', ''); ciz(); });
  $('durum-goruldu').addEventListener('click', function () {
    P.yap(function () { return Veri.hatalariGorulduYap(); }, 'Hatalar görüldü olarak işaretlendi.').then(ciz, function () {});
  });
  $('durum-temizle').addEventListener('click', function () {
    if (!confirm('Hata listesi silinsin mi? Bu geri alınamaz.')) return;
    P.yap(function () { return Veri.hatalariSil(); }, 'Hata listesi temizlendi.').then(ciz, function () {});
  });
  $('durum-hatalar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ayrinti]');
    if (!b) return;
    var id = b.getAttribute('data-ayrinti');
    acik[id] = !acik[id];
    ciz();
  });

  P.sekmeEkle('durum', 'Sistem durumu', ciz);
  // Menüdeki "yeni hata" sayacı: panel açılınca bir kez (yalnız düzenleyici; diğer roller için fonksiyon yetki hatası verir, sessizce geçilir).
  setTimeout(function () {
    if (Veri.mod === 'bulut' && !$('sek-durum').hidden) Veri.sistemDurumu().then(function (d) { if (d) sayacYaz(d.hata_gorulmemis); }, function () {});
  }, 4000);
})();
