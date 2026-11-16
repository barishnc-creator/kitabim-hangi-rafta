// Yönetim paneli: Ayarlar > Görünüm (ana renk, logo, karşılama yazısı) ve temanın her ekrana uygulanması.
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var HAZIR = [['Mavi', '#1D4ED8'], ['Petrol', '#0F766E'], ['Yeşil', '#15803D'], ['Kırmızı', '#B91C1C'], ['Turuncu', '#C2410C'], ['Mor', '#7C3AED'], ['Lacivert', '#1E3A8A'], ['Siyah', '#111827']];
  var secili = { renk: '', logo: '', karsilama: '' };
  var duzenleniyor = false; // kullanıcı formda değişiklik yaptıysa canlı güncelleme formu ezmesin

  function onizle() {
    var t = Tema.renkler(secili.renk || Tema.VARSAYILAN);
    document.querySelector('.mini-kiosk').style.setProperty('--onizleme-renk', t.ana);
    $('logo-onizleme').innerHTML = secili.logo ? '<img alt="" src="' + secili.logo + '">' : O.ikon.kitap;
    $('mini-logo').innerHTML = secili.logo ? '<img alt="" src="' + secili.logo + '">' : '';
    $('logo-durum').textContent = secili.logo ? 'Logo yüklendi' : 'Logo yok';
    $('logo-kaldir').hidden = !secili.logo;
    $('mini-karsilama').textContent = secili.karsilama.trim() || 'Aradığınız kitabı birlikte bulalım';
    $('renk-not').textContent = t.duzeltildi
      ? 'Seçtiğiniz renk beyaz yazıyla okunmayacak kadar açık; okunur olması için biraz koyulaştırıldı.'
      : 'Düğmeler, seçili menü ve vurgular bu renge döner. Okunurluk otomatik kontrol edilir.';
    var aktif = (secili.renk || Tema.VARSAYILAN).toUpperCase();
    var ozelMi = !HAZIR.some(function (h) { return h[1] === aktif; });
    $('renkler').innerHTML = HAZIR.map(function (h) {
      return '<button type="button" class="renk-sec" role="radio" aria-checked="' + (h[1] === aktif) + '" aria-label="' + h[0] + '" title="' + h[0] + '" data-renk="' + h[1] + '" style="background:' + h[1] + '"></button>';
    }).join('') + '<label class="renk-ozel" title="Özel renk" style="' + (ozelMi ? 'box-shadow:0 0 0 3px var(--yazi)' : '') + '"><span class="gizli-etiket">Özel renk seç</span><input type="color" id="renk-ozel" value="' + aktif.toLowerCase() + '"></label>';
  }

  function formuDoldur() {
    var a = P.d().ayarlar;
    secili = { renk: a.renk || '', logo: a.logo || '', karsilama: a.karsilama || '' };
    if (document.activeElement !== $('ayar-karsilama')) $('ayar-karsilama').value = secili.karsilama;
    onizle();
  }

  $('renkler').addEventListener('click', function (e) {
    var b = e.target.closest('[data-renk]');
    if (!b) return;
    secili.renk = b.getAttribute('data-renk'); duzenleniyor = true; onizle();
  });
  $('renkler').addEventListener('input', function (e) {
    if (e.target.id !== 'renk-ozel') return;
    secili.renk = e.target.value.toUpperCase(); duzenleniyor = true;
    var t = Tema.renkler(secili.renk);
    document.querySelector('.mini-kiosk').style.setProperty('--onizleme-renk', t.ana);
  });
  $('renkler').addEventListener('change', function (e) { if (e.target.id === 'renk-ozel') onizle(); });
  $('ayar-karsilama').addEventListener('input', function () { secili.karsilama = $('ayar-karsilama').value; duzenleniyor = true; onizle(); });
  $('logo-dosya').addEventListener('change', function (e) {
    var dosya = e.target.files[0];
    e.target.value = '';
    if (!dosya) return;
    Tema.logoHazirla(dosya).then(function (veri) { secili.logo = veri; duzenleniyor = true; onizle(); })
      .catch(function (err) { P.genel('hata', err.message); });
  });
  $('logo-kaldir').addEventListener('click', function () { secili.logo = ''; duzenleniyor = true; onizle(); });

  $('gorunum-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = P.d().ayarlar, is = [];
    if ((secili.renk || '') !== (a.renk || '')) is.push(['renk', secili.renk]);
    if ((secili.logo || '') !== (a.logo || '')) is.push(['logo', secili.logo]);
    if ((secili.karsilama || '').trim() !== (a.karsilama || '')) is.push(['karsilama', secili.karsilama.trim()]);
    if (!is.length) { P.genel('basari', 'Değişiklik yok.'); return; }
    P.yap(function () {
      return is.reduce(function (p, x) { return p.then(function () { return Veri.ayarKaydet(x[0], x[1]); }); }, Promise.resolve());
    }, 'Görünüm kaydedildi. Müşteri ekranı da güncellendi.').then(function () { duzenleniyor = false; formuDoldur(); }, P.sus);
  });

  // Her yeniden çizimde: temayı uygula; form düzenlenmiyorsa güncel ayarları göster.
  P.herCizimde(function () {
    Tema.uygula(P.d().ayarlar);
    if (!duzenleniyor) formuDoldur();
  });
})();
