// Kamerayla barkod / QR okuma.
// Motor: cihazın yerleşik BarcodeDetector'ı (Android Chrome) ya da yoksa vendor/barcode-detector.js
// (ZXing-C++ / WebAssembly, iPhone Safari dahil her yerde). Görüntü küçültülmeden, tam çözünürlükte taranır.
// Yedek: ikisi de çalışmazsa vendor/html5-qrcode.min.js.
// Kullanım: Tarayici.ac(function (kod) { ... })
// Not: Barkod tabancası (USB okuyucu) klavye gibi yazdığı için ek ayar gerektirmez.
(function (kok) {
  var BICIMLER = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
  var perde = null;
  var akis = null;       // MediaStream
  var dongu = null;      // tarama zamanlayıcısı
  var eskiOkuyucu = null; // html5-qrcode (yedek)
  var dedektorSozu = null;

  // ---- Motor seçimi ----
  function dedektor() {
    if (dedektorSozu) return dedektorSozu;
    dedektorSozu = Promise.resolve().then(function () {
      var Yerli = kok.BarcodeDetector;
      if (Yerli && Yerli.getSupportedFormats) {
        return Yerli.getSupportedFormats().then(function (b) {
          if (b.indexOf('ean_13') >= 0) return new Yerli({ formats: BICIMLER.filter(function (x) { return b.indexOf(x) >= 0; }) });
          throw new Error('yerleşik okuyucu EAN desteklemiyor');
        });
      }
      throw new Error('yerleşik okuyucu yok');
    }).catch(function () {
      var API = kok.BarcodeDetectionAPI;
      if (!API || !API.BarcodeDetector) throw new Error('okuyucu yüklenemedi');
      // WebAssembly dosyası programla birlikte gelir (internetsiz de çalışır).
      var taban = new URL('vendor/', document.baseURI).href;
      API.setZXingModuleOverrides({ locateFile: function (dosya) { return taban + dosya; } });
      var d = new API.BarcodeDetector({ formats: BICIMLER });
      // Motoru önceden yükle: ilk okuma beklemesin. Yüklenemezse yedeğe geçilir.
      var bos = document.createElement('canvas'); bos.width = bos.height = 8;
      return d.detect(bos).then(function () { return d; });
    });
    dedektorSozu.catch(function () { dedektorSozu = null; });
    return dedektorSozu;
  }

  function ilkKod(sonuclar) {
    for (var i = 0; i < (sonuclar || []).length; i++) {
      var v = sonuclar[i] && String(sonuclar[i].rawValue || '').trim();
      if (v) return v;
    }
    return '';
  }

  // ---- Fotoğraftan okuma ----
  // Barkod fotoğrafın küçük bir köşesindeyse: önce bütün resim, sonra üst üste binen parçalar büyütülerek denenir.
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

  // Parça parça tarama; coz(tuval) bir kod döndürür ya da hata fırlatır.
  function parcaParca(img, coz, ilerleme) {
    var pen = pencereler(), kaynak = img, i = 0, n = pen.length * 2;
    function sonraki() {
      if (i >= n) return Promise.reject(new Error('okunamadı'));
      if (i === pen.length) kaynak = cevir(img);
      var j = i % pen.length;
      i++;
      if (ilerleme) ilerleme(i, n);
      return Promise.resolve(kesit(kaynak, pen[j], j === 0 ? 1600 : 900)).then(coz).catch(sonraki);
    }
    return sonraki();
  }

  function eskiCozucu() {
    var alan = document.createElement('div');
    alan.id = 'foto-oku-' + Date.now();
    alan.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:10px;overflow:hidden';
    document.body.appendChild(alan);
    var F = kok.Html5QrcodeSupportedFormats;
    var h = new kok.Html5Qrcode(alan.id, { verbose: false, formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE] });
    return {
      coz: function (c) { return tuvaldenDosya(c).then(function (f) { return h.scanFile(f, false); }); },
      bitir: function () { alan.remove(); }
    };
  }

  function fotoOku(dosya, ilerleme) {
    return resimYukle(dosya).then(function (img) {
      return dedektor().then(function (d) {
        var coz = function (c) { return d.detect(c).then(function (s) { var k = ilkKod(s); if (!k) throw new Error('yok'); return k; }); };
        return coz(img).catch(function () { return parcaParca(img, coz, ilerleme); });
      }, function () {
        if (!kok.Html5Qrcode) throw new Error('okuyucu yok');
        var e = eskiCozucu();
        return parcaParca(img, e.coz, ilerleme).then(function (k) { e.bitir(); return k; }, function (x) { e.bitir(); throw x; });
      });
    });
  }

  // ---- Canlı kamera ----
  function kapat() {
    var p = perde;
    perde = null;
    if (dongu) { clearTimeout(dongu); dongu = null; }
    if (akis) { akis.getTracks().forEach(function (t) { t.stop(); }); akis = null; }
    var bitti = eskiOkuyucu && eskiOkuyucu.isScanning ? eskiOkuyucu.stop().catch(function () {}) : Promise.resolve();
    eskiOkuyucu = null;
    return bitti.then(function () { if (p) p.remove(); });
  }

  // Yakın çekimde iPhone kamerası odaklanamaz. Yakınlaştırma destekleniyorsa 2x açılır,
  // böylece barkod 20–30 cm uzakta tutulup net okunur.
  function iyilestir(iz) {
    try {
      var y = iz.getCapabilities ? iz.getCapabilities() : null;
      var ayar = [];
      if (y && y.zoom && y.zoom.max >= 1.5) ayar.push({ zoom: Math.min(2, y.zoom.max) });
      if (y && y.focusMode && y.focusMode.indexOf('continuous') >= 0) ayar.push({ focusMode: 'continuous' });
      if (ayar.length) return iz.applyConstraints({ advanced: ayar }).then(function () { return !!(y.zoom && y.zoom.max >= 1.5); }, function () { return false; });
    } catch (e) { /* desteklenmiyor */ }
    return Promise.resolve(false);
  }

  function canliBaslat(alan, durum, d, bitir) {
    var video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
    var cerceve = document.createElement('div'); cerceve.className = 'kamera-cerceve';
    alan.appendChild(video); alan.appendChild(cerceve);
    var tuval = document.createElement('canvas');
    var ctx = tuval.getContext('2d', { willReadFrequently: true });
    var tur = 0;

    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    }).then(function (s) {
      if (!perde) { s.getTracks().forEach(function (t) { t.stop(); }); return false; }
      akis = s;
      video.srcObject = s;
      return video.play().catch(function () {}).then(function () { return iyilestir(s.getVideoTracks()[0]); });
    }).then(function (yakin) {
      if (!perde) return;
      durum.textContent = yakin
        ? 'Barkodu çerçeveye getirin; kendiliğinden okunur. Görüntü bulanıksa telefonu biraz uzaklaştırın.'
        : 'Barkodu 20–30 cm uzaktan çerçeveye getirin; kendiliğinden okunur. Çok yaklaşırsanız görüntü bulanıklaşır.';
      function tara() {
        if (!perde || !akis) return;
        var W = video.videoWidth, H = video.videoHeight;
        if (!W || video.readyState < 2) { dongu = setTimeout(tara, 150); return; }
        // Çoğunlukla çerçevenin içi (tam çözünürlükte), arada bir de bütün görüntü taranır.
        var butun = (tur++ % 4) === 3;
        var sw = butun ? W : Math.round(W * 0.9), sh = butun ? H : Math.round(H * 0.6);
        var sx = Math.round((W - sw) / 2), sy = Math.round((H - sh) / 2);
        tuval.width = sw; tuval.height = sh;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        d.detect(tuval).then(function (s) {
          var k = ilkKod(s);
          if (k) bitir(k); else dongu = setTimeout(tara, 60);
        }, function () { dongu = setTimeout(tara, 200); });
      }
      tara();
    });
  }

  // Yeni motor yüklenemezse eski kütüphaneyle canlı tarama.
  function eskiCanli(durum, bitir) {
    var F = kok.Html5QrcodeSupportedFormats;
    eskiOkuyucu = new kok.Html5Qrcode('kamera-alani', {
      verbose: false,
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
    return eskiOkuyucu.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: function (g, y) { return { width: Math.floor(g * 0.85), height: Math.floor(Math.min(y, g) * 0.5) }; } },
      bitir, function () {}
    ).then(function () {
      if (perde) durum.textContent = 'Barkodu 20–30 cm uzaktan çerçeveye getirin; kendiliğinden okunur.';
    });
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
    var alan = perde.querySelector('#kamera-alani');
    var okundu = false;
    function bitir(metin) {
      if (okundu) return;
      okundu = true;
      if (navigator.vibrate) navigator.vibrate(80);
      kapat().then(function () { okununca(String(metin).trim()); });
    }

    // Canlı kamerada okunmazsa: barkodun fotoğrafını çek, fotoğraftan oku.
    perde.querySelector('#kamera-foto').addEventListener('change', function (e) {
      var dosya = e.target.files[0];
      e.target.value = '';
      if (!dosya) return;
      durum.textContent = 'Fotoğraf okunuyor…';
      fotoOku(dosya, function (i, n) { if (i > 1 && perde) durum.textContent = 'Fotoğraf taranıyor… (' + Math.round(i / n * 100) + '%)'; })
        .then(bitir).catch(function () {
          if (perde) durum.textContent = 'Barkod okunamadı. Barkodun net çıktığından emin olup tekrar deneyin (çok yaklaşmayın, 20–30 cm yeterli).';
        });
    });
    perde.querySelector('#kamera-kapat').addEventListener('click', kapat);
    perde.addEventListener('click', function (e) { if (e.target === perde) kapat(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); kapat(); }
    });

    if (!kok.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      durum.textContent = 'Canlı kamera burada açılamıyor. “Fotoğraf çekerek okut” düğmesini kullanın.';
      return;
    }
    var hataMetni = 'Canlı kamera açılamadı. “Fotoğraf çekerek okut” düğmesini kullanın ya da kamera iznini verin.';
    dedektor().then(function (d) {
      if (!perde) return;
      return canliBaslat(alan, durum, d, bitir);
    }, function () {
      if (!perde) return;
      if (!kok.Html5Qrcode) { durum.textContent = 'Kamera okuyucu yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.'; return; }
      return eskiCanli(durum, bitir);
    }).catch(function () { if (perde) durum.textContent = hataMetni; });
  }

  kok.Tarayici = { ac: ac, kapat: kapat, fotoOku: fotoOku, pencereler: pencereler, dedektor: dedektor };
})(window);
