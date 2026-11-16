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
      '<button type="button" class="dugme" id="kamera-kapat">Kapat</button>' +
      '</div>';
    document.body.appendChild(perde);
    var durum = perde.querySelector('#kamera-durum');
    perde.querySelector('#kamera-kapat').addEventListener('click', kapat);
    perde.addEventListener('click', function (e) { if (e.target === perde) kapat(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); kapat(); }
    });

    if (!kok.Html5Qrcode) { durum.textContent = 'Kamera okuyucu yüklenemedi. Sayfayı yenileyin.'; return; }
    if (!kok.isSecureContext) { durum.textContent = 'Kamera yalnız güvenli (https) adreste çalışır.'; return; }

    var F = kok.Html5QrcodeSupportedFormats;
    okuyucu = new kok.Html5Qrcode('kamera-alani', {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    var okundu = false;
    okuyucu.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: function (g, y) { return { width: Math.floor(g * 0.8), height: Math.floor(Math.min(y, g) * 0.5) }; } },
      function (metin) {
        if (okundu) return;
        okundu = true;
        if (navigator.vibrate) navigator.vibrate(80);
        kapat().then(function () { okununca(String(metin).trim()); });
      },
      function () {}
    ).then(function () {
      if (durum) durum.textContent = 'Kod çerçevenin içine gelince kendiliğinden okunur.';
    }).catch(function () {
      if (durum) durum.textContent = 'Kamera açılamadı. Tarayıcının kamera iznini verin ya da kitabın adını yazarak arayın.';
    });
  }

  kok.Tarayici = { ac: ac, kapat: kapat };
})(window);
