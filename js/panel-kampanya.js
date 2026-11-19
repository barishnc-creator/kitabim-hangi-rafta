// Yönetim paneli: Kampanyalar — müşteri ekranındaki reklam alanı (fotoğraf + başlık + açıklama, en çok 6).
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var taslak = [], degisti = false;

  function durum(tur, metin) { $('kampanya-durum').innerHTML = metin ? '<div class="mesaj ' + tur + '">' + O.kacis(metin) + '</div>' : ''; }
  function isaretle() { degisti = true; $('kampanya-kaydet').disabled = false; if (/hata/.test($('kampanya-durum').innerHTML)) durum('', ''); }
  function yeniId() { return 'kp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function ciz() {
    $('kampanya-ekle').disabled = taslak.length >= Depo.KAMPANYA_EN_COK;
    $('kampanya-liste').innerHTML = taslak.length ? taslak.map(function (k, i) {
      return '<div class="kampanya-satir" data-i="' + i + '">' +
        '<label class="kampanya-resim" title="Fotoğraf seç">' + (k.resim ? '<img alt="" src="' + k.resim + '">' : '<span>' + O.ikon.yukle + 'Fotoğraf seç</span>') +
          '<input type="file" accept="image/png,image/jpeg,image/webp" class="gizli-etiket" data-alan="resim"></label>' +
        '<div class="kampanya-alanlar">' +
          '<div class="alan"><label for="kb-' + i + '">Başlık</label><input id="kb-' + i + '" maxlength="60" data-alan="baslik" placeholder="Örn. Okula dönüşte test kitaplarında %20 indirim" value="' + O.kacis(k.baslik) + '"></div>' +
          '<div class="alan"><label for="ka-' + i + '">Açıklama</label><textarea id="ka-' + i + '" maxlength="160" rows="2" data-alan="aciklama" placeholder="Örn. 30 Kasım’a kadar, kasada geçerli.">' + O.kacis(k.aciklama) + '</textarea></div>' +
        '</div>' +
        '<div class="kampanya-islem">' +
          '<button type="button" class="dugme" data-is="yukari" aria-label="Yukarı taşı"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button type="button" class="dugme" data-is="asagi" aria-label="Aşağı taşı"' + (i < taslak.length - 1 ? '' : ' disabled') + '>↓</button>' +
          (k.resim ? '<button type="button" class="dugme" data-is="resim-kaldir">Fotoğrafı kaldır</button>' : '') +
          '<button type="button" class="dugme tehlike" data-is="sil">Sil</button>' +
        '</div></div>';
    }).join('') : '<p class="bos-not">Henüz kampanya yok. “Kampanya ekle” ile başlayın; müşteri ekranında kampanya yoksa bu alan görünmez.</p>';
  }

  function yukle() {
    if (degisti) return;
    taslak = JSON.parse(JSON.stringify((P.d().ayarlar.kampanyalar) || []));
    $('kampanya-kaydet').disabled = true;
    ciz();
  }

  $('kampanya-ekle').addEventListener('click', function () {
    if (taslak.length >= Depo.KAMPANYA_EN_COK) return;
    taslak.push({ id: yeniId(), baslik: '', aciklama: '', resim: '' });
    isaretle(); ciz();
    var son = document.querySelector('.kampanya-satir:last-child [data-alan="baslik"]');
    if (son) son.focus();
  });
  $('kampanya-liste').addEventListener('input', function (e) {
    var satir = e.target.closest('.kampanya-satir'), alan = e.target.getAttribute('data-alan');
    if (!satir || (alan !== 'baslik' && alan !== 'aciklama')) return;
    taslak[Number(satir.getAttribute('data-i'))][alan] = e.target.value;
    isaretle();
  });
  $('kampanya-liste').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-alan') !== 'resim') return;
    var i = Number(e.target.closest('.kampanya-satir').getAttribute('data-i')), dosya = e.target.files[0];
    if (!dosya) return;
    durum('', 'Fotoğraf hazırlanıyor…');
    Tema.kampanyaResmiHazirla(dosya).then(function (veri) { taslak[i].resim = veri; isaretle(); ciz(); durum('', ''); })
      .catch(function (err) { durum('hata', err.message); });
  });
  $('kampanya-liste').addEventListener('click', function (e) {
    var b = e.target.closest('[data-is]');
    if (!b) return;
    var i = Number(b.closest('.kampanya-satir').getAttribute('data-i')), is = b.getAttribute('data-is');
    if (is === 'yukari' && i > 0) taslak.splice(i - 1, 0, taslak.splice(i, 1)[0]);
    else if (is === 'asagi' && i < taslak.length - 1) taslak.splice(i + 1, 0, taslak.splice(i, 1)[0]);
    else if (is === 'resim-kaldir') taslak[i].resim = '';
    else if (is === 'sil') taslak.splice(i, 1);
    else return;
    isaretle(); ciz();
  });
  $('kampanya-kaydet').addEventListener('click', function () {
    var bos = taslak.filter(function (k) { return !k.resim && !k.baslik.trim(); }).length;
    if (bos) { durum('hata', 'Her kampanyaya en az bir fotoğraf ya da başlık girin (ya da boş olanı silin).'); return; }
    $('kampanya-kaydet').disabled = true;
    P.yap(function () { return Veri.ayarKaydet('kampanyalar', Depo.kampanyaDuzelt(taslak)); }, 'Kampanyalar kaydedildi; müşteri ekranında görünür.')
      .then(function () { degisti = false; durum('', ''); yukle(); }, function (err) { $('kampanya-kaydet').disabled = false; durum('hata', err && err.message ? err.message : 'Kaydedilemedi.'); });
  });

  P.sekmeEkle('kampanyalar', 'Kampanyalar', yukle);
})();
