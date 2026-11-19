// Yönetim paneli: müşteri kitap talepleri. Aynı kitaba gelen talepler tek satırda sayılır (Depo.talepGrupla).
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var son = [], gruplar = [];
  var yetki = function () { return P.yetkili('duzenleyici', 'calisan'); };

  function telBicim(t) { return String(t).replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4'); }
  function tarih(t) {
    try { return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function sayac() {
    $('talep-sayac').hidden = !gruplar.length;
    $('talep-sayac').textContent = gruplar.length;
  }

  // Aynı telefondan günde 5'ten fazla talep denenince (talep kaydedilmez) üstte uyarı şeridi.
  // Bildirim tablosu yoksa (SQL henüz çalıştırılmadı) ya da okunamazsa şerit gizli kalır.
  function bildirimleriCiz(l) {
    var s = $('bildirim-serit');
    s.hidden = !(l && l.length);
    s.innerHTML = s.hidden ? '' : l.map(function (b) {
      return '<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between">' +
        '<span><b>Bu kişi birden fazla istek gönderiyor:</b> <a href="tel:' + O.kacis(b.telefon) + '" style="white-space:nowrap">' + O.kacis(telBicim(b.telefon)) + '</a>' +
        ' · 24 saatte ' + Number(b.deneme) + ' deneme · son ' + tarih(b.son) + '. Günde en fazla 5 talep kaydedilir; fazlası kaydedilmedi.</span>' +
        '<button type="button" class="dugme" data-bildirim-okundu="' + O.kacis(b.id) + '">Okundu</button></div>';
    }).join('');
  }
  function bildirimYukle() { return Veri.bildirimler().then(bildirimleriCiz, function () { bildirimleriCiz(null); }); }

  function yukle() {
    if (!yetki()) return Promise.resolve();
    bildirimYukle();
    return Veri.talepler().then(function (l) { son = l; gruplar = Depo.talepGrupla(l); sayac(); if (!$('talepler').hidden) ciz(); })
      .catch(function (e) { $('talep-satirlar').innerHTML = '<tr><td colspan="5"><div class="mesaj hata">' + O.kacis(e.message) + '</div></td></tr>'; });
  }

  function kisilerHtml(g) {
    if (!g.kisiler.length) return '<span class="soluk">—</span>';
    var ilk = g.kisiler.slice(0, 3).map(function (k) {
      return '<div>' + O.kacis(k.ad || 'Adsız') + (k.telefon ? ' · <a href="tel:' + O.kacis(k.telefon) + '" style="white-space:nowrap">' + O.kacis(telBicim(k.telefon)) + '</a>' : '') + '</div>';
    }).join('');
    return ilk + (g.kisiler.length > 3 ? '<div class="soluk">+' + (g.kisiler.length - 3) + ' kişi daha</div>' : '');
  }

  function ciz() {
    var d = P.d();
    $('talep-satirlar').innerHTML = gruplar.length ? gruplar.map(function (g, i) {
      var kitap = g.kitapId && d.kitaplar.find(function (k) { return k.id === g.kitapId; });
      var yer = kitap && Depo.konum(d, kitap.bolmeId);
      var alt = [g.notlar.join(' · '), kitap ? '' : 'mağazada kayıtlı değil'].filter(Boolean).join(' · ');
      return '<tr><td><b>' + O.kacis(kitap ? kitap.ad : g.kitap) + '</b><div class="soluk">' + O.kacis(alt) +
        (yer ? (alt ? ' · ' : '') + '<span style="color:var(--yesil);font-weight:600">şu an rafta (' + yer.kod + ')</span>' : '') + '</div></td>' +
        '<td class="sayi"><span class="talep-adet">' + g.sayi + '</span></td>' +
        '<td style="white-space:nowrap">' + tarih(g.son) + '</td>' +
        '<td>' + kisilerHtml(g) + '</td>' +
        '<td class="islem"><button type="button" class="dugme" data-talep-kapat="' + i + '" style="min-height:40px">Kapat</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="bos-not" style="text-align:center;padding:32px">Henüz talep yok. Müşteri ekranındaki “Talep oluşturun” kutusundan ve bulunamayan kitaplardan talep gelir.</td></tr>';
  }

  $('bildirim-serit').addEventListener('click', function (e) {
    var id = e.target.getAttribute('data-bildirim-okundu');
    if (id) P.yap(function () { return Veri.bildirimOkundu(id); }, 'Bildirim okundu olarak işaretlendi.').then(bildirimYukle, bildirimYukle);
  });
  $('talep-satirlar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-talep-kapat]');
    if (!b) return;
    var g = gruplar[Number(b.getAttribute('data-talep-kapat'))];
    if (!g) return;
    O.pencere('“' + g.kitap + '” için ' + g.sayi + ' talep kapatılsın mı? (Kitabı getirttiyseniz ya da artık gerekmiyorsa.)', { evet: 'Kapat', tehlike: true }).then(function (tamam) {
      if (tamam) P.yap(function () { return Veri.talepSil(g.idler); }, 'Talep kapatıldı.').then(yukle, yukle);
    });
  });
  $('talep-indir').addEventListener('click', function () {
    var d = P.d();
    var satir = [['Kitap', 'Talep sayısı', 'İlk talep', 'Son talep', 'Raf', 'Bırakılan bilgi', 'Not']].concat(gruplar.map(function (g) {
      var kitap = g.kitapId && d.kitaplar.find(function (k) { return k.id === g.kitapId; });
      var yer = kitap && Depo.konum(d, kitap.bolmeId);
      return [kitap ? kitap.ad : g.kitap, g.sayi, tarih(g.ilk), tarih(g.son), yer ? yer.kod : '',
        g.kisiler.map(function (k) { return [k.ad, k.telefon && telBicim(k.telefon)].filter(Boolean).join(' '); }).join('; '), g.notlar.join('; ')];
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Csv.yaz(satir)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'talepler-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  P.sekmeEkle('talepler', 'Talepler', function () { yukle(); });
  // Sayaç: açılışta ve dakikada bir; başka sekmede talep gelirse (yerel mod) anında.
  var ilk = false;
  P.herCizimde(function () { if (!ilk && P.ben()) { ilk = true; yukle(); setInterval(yukle, 60000); } });
  window.addEventListener('storage', function (e) { if (e.key === 'kitabim-hangi-rafta:talepler') yukle(); });
})();
