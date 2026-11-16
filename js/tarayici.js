// Kamerayla barkod / QR okuma. vendor/html5-qrcode.min.js kütüphanesini kullanır.
// Kullanım: Tarayici.ac(function (kod) { ... })
// Not: Barkod tabancası (USB okuyucu) klavye gibi yazdığı için ek ayar gerektirmez.
(function (kok) {
  var okuyucu = null;
  var perde = null;

  function kapat() {
    var p = perde;
    perde = null;
    var bitti = okuyucu && okuyucu.isScanning ? okuyucu.stop().catch(function () {}) : Promise.resolve();
    okuyucu = null;
    return bitti.then(function () { if (p) p.remove(); });
  }

  function ac(okununca) {
    if (perde) return;
    perde = document.createElement('div');
    perde.className = 'kamera-perde';
    perde.innerHTML =
      '<div class="kamera-kutu" role="dialog" aria-modal="true" aria-labelledby="kamera-baslik">' +
      '<h2 id="kamera-baslik" style="font-size:18px">Barkodu ya da QR kodu kameraya tutun</h2>' +
      '<div id="kamera-alani"></div>' +
      '<p id="kamera-durum">Kamera açılıyor…</p>' +
      '<label class="dugme cerceve" for="kamera-foto" style="cursor:pointer;background:#fff">Fotoğraf çekerek okut</label>' +
      '<input type="file" id="kamera-foto" accept="image/*" capture="environment" class="gizli-etiket">' +
      '<button type="button" class="dugme" id="kamera-kapat">Kapat</button>' +
      '</div>';
    document.body.appendChild(perde);
    var durum = perde.querySelector('#kamera-durum');
    var okundu = false;
    function bitir(metin) {
      if (okundu) return;
      okundu = true;
      if (navigator.vibrate) navigator.vibrate(80);
      kapat().then(function () { okununca(String(metin).trim()); });
    }

    // Canlı kamera açılmayan cihazlarda: barkodun fotoğrafını çek, fotoğraftan oku.
    perde.querySelector('#kamera-foto').addEventListener('change', function (e) {
      var dosya = e.target.files[0];
      e.target.value = '';
      if (!dosya || !kok.Html5Qrcode) return;
      durum.textContent = 'Fotoğraf okunuyor…';
      var dur = okuyucu && okuyucu.isScanning ? okuyucu.stop().catch(function () {}) : Promise.resolve();
      dur.then(function () {
        var F = kok.Html5QrcodeSupportedFormats;
        return new kok.Html5Qrcode('kamera-alani', {
          verbose: false,
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE]
        }).scanFile(dosya, false);
      }).then(bitir).catch(function () {
        durum.textContent = 'Barkod okunamadı. Barkodu yakından, net ve düz çekip tekrar deneyin.';
      });
    });
    perde.querySelector('#kamera-kapat').addEventListener('click', kapat);
    perde.addEventListener('click', function (e) { if (e.target === perde) kapat(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); kapat(); }
    });

    if (!kok.Html5Qrcode) { durum.textContent = 'Kamera okuyucu yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.'; return; }
    if (!kok.isSecureContext || !navigator.mediaDevices) { durum.textContent = 'Canlı kamera burada açılamıyor. “Fotoğraf çekerek okut” düğmesini kullanın.'; return; }

    var F = kok.Html5QrcodeSupportedFormats;
    okuyucu = new kok.Html5Qrcode('kamera-alani', {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    okuyucu.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: function (g, y) { return { width: Math.floor(g * 0.8), height: Math.floor(Math.min(y, g) * 0.5) }; } },
      bitir,
      function () {}
    ).then(function () {
      if (durum) durum.textContent = 'Kod çerçevenin içine gelince kendiliğinden okunur.';
    }).catch(function () {
      if (durum) durum.textContent = 'Canlı kamera açılamadı. “Fotoğraf çekerek okut” düğmesini kullanın ya da kamera iznini verin.';
    });
  }

  kok.Tarayici = { ac: ac, kapat: kapat };
})(window);
