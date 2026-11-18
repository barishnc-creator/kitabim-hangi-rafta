// Kamerayla barkod / QR okuma. vendor/html5-qrcode.min.js kütüphanesini kullanır.
// Kullanım: Tarayici.ac(function (kod) { ... })
// Not: Barkod tabancası (USB okuyucu) klavye gibi yazdığı için ek ayar gerektirmez.
(function (kok) {
  var okuyucu = null;
  var perde = null;

  function bicimler() {
    var F = kok.Html5QrcodeSupportedFormats;
    return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE];
  }

  function kapat() {
    var p = perde;
    perde = null;
    var bitti = okuyucu && okuyucu.isScanning ? okuyucu.stop().catch(function () {}) : Promise.resolve();
    okuyucu = null;
    return bitti.then(function () { if (p) p.remove(); });
  }

  // Fotoğrafta barkod genelde küçük bir köşededir; okuyucu bütün fotoğrafta bulamayınca
  // fotoğraf üst üste binen parçalara bölünür ve her parça büyütülerek ayrı ayrı denenir.
  // Döndürür: [{x, y, g, h}]: oran olarak (0–1) kesit pencereleri, önce bütün resim.
  function pencereler() {
    var liste = [{ x: 0, y: 0, g: 1, h: 1 }];
    [[0.6, 0.35], [0.45, 0.22]].forEach(function (b) {
      var gw = b[0], gh = b[1];
      for (var y = 0; y <= 1 - gh + 1e-9; y += gh / 2) {
        for (var x = 0; x <= 1 - gw + 1e-9; x += gw / 2) liste.push({ x: x, y: y, g: gw, h: gh });
        if (x - gw / 2 < 1 - gw - 1e-9) liste.push({ x: 1 - gw, y: y, g: gw, h: gh });
      }
    });
    return liste;
  }

  function resimYukle(dosya) {
    return new Promise(function (tamam, hata) {
      var url = URL.createObjectURL(dosya);
      var img = new Image();
      img.onload = function () { tamam(img); setTimeout(function () { URL.revokeObjectURL(url); }, 0); };
      img.onerror = function () { URL.revokeObjectURL(url); hata(new Error('resim açılamadı')); };
      img.src = url;
    });
  }

  function kesit(img, p, hedef) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var sx = p.x * W, sy = p.y * H, sw = p.g * W, sh = p.h * H;
    var olcek = Math.min(hedef / sw, 3);
    var c = document.createElement('canvas');
    c.width = Math.round(sw * olcek); c.height = Math.round(sh * olcek);
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  // Kitap yan çekildiyse barkod dikey kalır; düz okunamazsa resim 90° çevrilip yeniden denenir.
  function cevir(img) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var c = document.createElement('canvas');
    c.width = H; c.height = W;
    var ctx = c.getContext('2d');
    ctx.translate(H, 0); ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    return c;
  }

  function tuvaldenDosya(c) {
    return new Promise(function (tamam) {
      c.toBlob(function (b) { tamam(new File([b], 'kesit.png', { type: 'image/png' })); }, 'image/png');
    });
  }

  // Fotoğraftan kod okur. Cihazda yerleşik barkod okuyucu varsa (Android Chrome) önce o denenir.
  function fotoOku(dosya, ilerleme) {
    var alan = document.createElement('div');
    alan.id = 'foto-oku-' + Date.now();
    alan.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:10px;overflow:hidden';
    document.body.appendChild(alan);
    var cozucu = new kok.Html5Qrcode(alan.id, { verbose: false, formatsToSupport: bicimler() });
    function temizle(s) { alan.remove(); return s; }

    return resimYukle(dosya).then(function (img) {
      var yerlesik = null;
      if ('BarcodeDetector' in kok) {
        try { yerlesik = new kok.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] }); } catch (e) { yerlesik = null; }
      }
      var ilk = yerlesik
        ? yerlesik.detect(img).then(function (s) { if (s && s[0]) return s[0].rawValue; throw new Error('yok'); })
        : Promise.reject(new Error('yok'));
      return ilk.catch(function () {
        var pen = pencereler(), kaynak = img, i = 0, n = pen.length * 2;
        function sonraki() {
          if (i >= n) throw new Error('okunamadı');
          if (i === pen.length) kaynak = cevir(img);
          var j = i % pen.length;
          i++;
          if (ilerleme) ilerleme(i, n);
          return tuvaldenDosya(kesit(kaynak, pen[j], j === 0 ? 1600 : 900))
            .then(function (f) { return cozucu.scanFile(f, false); })
            .catch(sonraki);
        }
        return sonraki();
      });
    }).then(temizle, function (e) { temizle(); throw e; });
  }

  // Yakın çekimde iPhone kamerası odaklanamaz. Yakınlaştırma destekleniyorsa 2x açılır,
  // böylece barkod 20–30 cm uzakta tutulup net okunur.
  function yakinlastir() {
    try {
      var yetenek = okuyucu && okuyucu.getRunningTrackCapabilities ? okuyucu.getRunningTrackCapabilities() : null;
      var ayar = [];
      if (yetenek && yetenek.zoom && yetenek.zoom.max >= 1.5) ayar.push({ zoom: Math.min(2, yetenek.zoom.max) });
      if (yetenek && yetenek.focusMode && yetenek.focusMode.indexOf('continuous') >= 0) ayar.push({ focusMode: 'continuous' });
      if (ayar.length) return okuyucu.applyVideoConstraints({ advanced: ayar }).then(function () { return true; }, function () { return false; });
    } catch (e) { /* desteklenmiyor */ }
    return Promise.resolve(false);
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

    // Canlı kamerada net görüntü alınamazsa: barkodun fotoğrafını çek, fotoğraftan oku.
    perde.querySelector('#kamera-foto').addEventListener('change', function (e) {
      var dosya = e.target.files[0];
      e.target.value = '';
      if (!dosya || !kok.Html5Qrcode) return;
      durum.textContent = 'Fotoğraf okunuyor…';
      var dur = okuyucu && okuyucu.isScanning ? okuyucu.stop().catch(function () {}) : Promise.resolve();
      dur.then(function () {
        return fotoOku(dosya, function (i, n) { if (i > 1) durum.textContent = 'Fotoğraf taranıyor… (' + Math.round(i / n * 100) + '%)'; });
      }).then(bitir).catch(function () {
        if (perde) durum.textContent = 'Barkod okunamadı. Barkodun net çıktığından emin olup tekrar deneyin (çok yaklaşmayın, 20–30 cm yeterli).';
      });
    });
    perde.querySelector('#kamera-kapat').addEventListener('click', kapat);
    perde.addEventListener('click', function (e) { if (e.target === perde) kapat(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); kapat(); }
    });

    if (!kok.Html5Qrcode) { durum.textContent = 'Kamera okuyucu yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.'; return; }
    if (!kok.isSecureContext || !navigator.mediaDevices) { durum.textContent = 'Canlı kamera burada açılamıyor. “Fotoğraf çekerek okut” düğmesini kullanın.'; return; }

    okuyucu = new kok.Html5Qrcode('kamera-alani', {
      verbose: false,
      formatsToSupport: bicimler(),
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    okuyucu.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        // Yüksek çözünürlük: ince barkod çizgileri ancak böyle ayrışır (varsayılan 640×480 yetmiyor).
        videoConstraints: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        qrbox: function (g, y) { return { width: Math.floor(g * 0.85), height: Math.floor(Math.min(y, g) * 0.5) }; }
      },
      bitir,
      function () {}
    ).then(function () {
      return yakinlastir();
    }).then(function (yakin) {
      if (durum && !okundu) {
        durum.textContent = yakin
          ? 'Barkodu çerçeveye getirin; kendiliğinden okunur. Görüntü bulanıksa telefonu biraz uzaklaştırın.'
          : 'Barkodu 20–30 cm uzaktan çerçeveye getirin; kendiliğinden okunur. Çok yaklaşırsanız görüntü bulanıklaşır.';
      }
    }).catch(function () {
      if (durum) durum.textContent = 'Canlı kamera açılamadı. “Fotoğraf çekerek okut” düğmesini kullanın ya da kamera iznini verin.';
    });
  }

  kok.Tarayici = { ac: ac, kapat: kapat, fotoOku: fotoOku, pencereler: pencereler };
})(window);
