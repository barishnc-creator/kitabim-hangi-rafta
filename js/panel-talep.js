// Yönetim paneli: "Gelince haber ver" talepleri.
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var DURUM = { yeni: 'Yeni', arandi: 'Arandı', geldi: 'Geldi / teslim', iptal: 'İptal' };
  var RENK = { yeni: 'background:#FEF3C7;color:#92400E', arandi: 'background:var(--mavi-acik);color:var(--mavi-koyu)', geldi: 'background:#DCFCE7;color:#166534', iptal: 'background:#F1F5F9;color:#475569' };
  var son = [];
  var yetki = function () { return P.yetkili('duzenleyici', 'calisan'); };

  function telBicim(t) { return String(t).replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4'); }
  function tarih(t) {
    try { return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function sayac(liste) {
    var n = liste.filter(function (t) { return t.durum === 'yeni'; }).length;
    $('talep-sayac').hidden = !n;
    $('talep-sayac').textContent = n;
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
    return Veri.talepler().then(function (l) { son = l; sayac(l); if (!$('talepler').hidden) ciz(); })
      .catch(function (e) { $('talep-satirlar').innerHTML = '<tr><td colspan="5"><div class="mesaj hata">' + O.kacis(e.message) + '</div></td></tr>'; });
  }

  function ciz() {
    var f = $('talep-filtre').value;
    var liste = son.filter(function (t) { return f === 'acik' ? (t.durum === 'yeni' || t.durum === 'arandi') : !f || t.durum === f; });
    var d = P.d();
    $('talep-satirlar').innerHTML = liste.length ? liste.map(function (t) {
      var kitap = t.kitapId && d.kitaplar.find(function (k) { return k.id === t.kitapId; });
      var yer = kitap && Depo.konum(d, kitap.bolmeId);
      var gelmis = !!yer;
      return '<tr><td><b>' + O.kacis(t.kitap) + '</b><div class="soluk">' + O.kacis(t.not || (kitap ? '' : 'mağazada yok')) +
        (gelmis ? ' · <span style="color:var(--yesil);font-weight:600">şu an rafta (' + yer.kod + ')</span>' : '') + '</div></td>' +
        '<td>' + O.kacis(t.ad) + '<div><a href="tel:' + O.kacis(t.telefon) + '" style="white-space:nowrap">' + O.ikon.tel + ' ' + O.kacis(telBicim(t.telefon)) + '</a></div></td>' +
        '<td style="white-space:nowrap">' + tarih(t.olusturuldu) + '</td>' +
        '<td><span class="rozet" style="' + RENK[t.durum] + '">' + DURUM[t.durum] + '</span></td>' +
        '<td class="islem"><label class="gizli-etiket" for="td-' + t.id + '">Durumu değiştir</label><select id="td-' + t.id + '" data-talep="' + t.id + '" style="min-height:40px;border:1px solid var(--cizgi-koyu);border-radius:8px;font:inherit">' +
          Object.keys(DURUM).map(function (k) { return '<option value="' + k + '"' + (k === t.durum ? ' selected' : '') + '>' + DURUM[k] + '</option>'; }).join('') + '</select></td></tr>';
    }).join('') : '<tr><td colspan="5" class="bos-not" style="text-align:center;padding:32px">' + (son.length ? 'Bu filtrede talep yok.' : 'Henüz talep yok. Müşteri ekranında bulunamayan ya da tükenen kitaplar için “Gelince haber verilsin” düğmesi çıkar.') + '</td></tr>';
  }

  $('talep-filtre').addEventListener('change', ciz);
  $('bildirim-serit').addEventListener('click', function (e) {
    var id = e.target.getAttribute('data-bildirim-okundu');
    if (id) P.yap(function () { return Veri.bildirimOkundu(id); }, 'Bildirim okundu olarak işaretlendi.').then(bildirimYukle, bildirimYukle);
  });
  $('talep-satirlar').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-talep');
    if (!id) return;
    P.yap(function () { return Veri.talepDurum(id, e.target.value); }, 'Talep güncellendi.').then(yukle, yukle);
  });
  $('talep-temizle').addEventListener('click', function () {
    var kapali = son.filter(function (t) { return t.durum === 'geldi' || t.durum === 'iptal'; });
    if (!kapali.length) { P.genel('hata', 'Silinecek kapanmış talep yok.'); return; }
    O.pencere(kapali.length + ' kapanmış talep (Geldi / İptal) kalıcı olarak silinsin mi? Müşterilerin telefonları da silinir.', { evet: 'Sil', tehlike: true }).then(function (tamam) {
      if (tamam) P.yap(function () { return Veri.talepSil(kapali.map(function (t) { return t.id; })); }, kapali.length + ' talep silindi.').then(yukle, yukle);
    });
  });
  $('talep-indir').addEventListener('click', function () {
    var satir = [['Kitap', 'Not', 'Müşteri', 'Telefon', 'Tarih', 'Durum']].concat(son.map(function (t) {
      return [t.kitap, t.not || '', t.ad, telBicim(t.telefon), tarih(t.olusturuldu), DURUM[t.durum]];
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
