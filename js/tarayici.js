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
  // Tanı bilgisi: barkod penceresinin altında küçük yazıyla gösterilir; sorun bildirilirken ekran görüntüsüne girer.
  var SURUM = '18.11-c';
  var tani = { motor: '', motorHata: '', foto: '', deneme: 0, okunan: {}, hata: '', kare: 0, video: '' };
  function taniMetni(foto) {
    var p = ['sürüm ' + SURUM, 'motor: ' + (tani.motor || '?') + (tani.motorHata ? ' (' + tani.motorHata + ')' : '')];
    if (foto) {
      p.push('foto: ' + (tani.foto || '?'), 'deneme: ' + tani.deneme);
      var o = Object.keys(tani.okunan).map(function (k) { return k + '×' + tani.okunan[k]; });
      if (o.length) p.push('okunan: ' + o.join(', '));
      if (tani.hata) p.push('hata: ' + tani.hata);
    } else if (tani.video) p.push('kamera: ' + tani.video, 'kare: ' + tani.kare);
    return p.join(' · ');
  }
  function hataAdi(e) { return String((e && (e.name && e.name !== 'Error' ? e.name + ': ' : '') + (e.message || e)) || 'bilinmiyor').slice(0, 120); }

  // ---- Motor seçimi ----
  function dedektor() {
    if (dedektorSozu) return dedektorSozu;
    dedektorSozu = Promise.resolve().then(function () {
      var Yerli = kok.BarcodeDetector;
      if (Yerli && Yerli.getSupportedFormats) {
        return Yerli.getSupportedFormats().then(function (b) {
          if (b.indexOf('ean_13') >= 0) { tani.motor = 'yerleşik'; return new Yerli({ formats: BICIMLER.filter(function (x) { return b.indexOf(x) >= 0; }) }); }
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
      return d.detect(bos).then(function () { tani.motor = 'zxing'; tani.motorHata = ''; return d; }, function (e) { tani.motor = 'yok'; tani.motorHata = hataAdi(e); throw e; });
    });
    dedektorSozu.catch(function () { dedektorSozu = null; });
    return dedektorSozu;
  }

  function ilkSonuc(sonuclar) {
    for (var i = 0; i < (sonuclar || []).length; i++) {
      var v = sonuclar[i] && String(sonuclar[i].rawValue || '').trim();
      if (v) return { deger: v, bicim: sonuclar[i].format };
    }
    return null;
  }

  // ---- Ortak çizim tuvali ----
  // iPhone Safari'de tuval başına (~16 MP) ve toplam tuval belleğine sınır var; 24 MP fotoğrafı tuvale çizmek
  // ya da her parça için yeni tuval açmak bir süre sonra okumayı bozar. Bu yüzden tek tuval kullanılır ve
  // okuyucuya tuval değil piksel verisi (ImageData) verilir; okuyucu da kendi tuvalini açmaz.
  var ortakTuval = null, ortakCtx = null;
  function cizim(kaynak, sx, sy, sw, sh, dw, dh, donuk) {
    if (!ortakTuval) {
      ortakTuval = document.createElement('canvas');
      ortakCtx = ortakTuval.getContext('2d', { willReadFrequently: true });
    }
    dw = Math.max(1, Math.round(dw)); dh = Math.max(1, Math.round(dh));
    ortakTuval.width = donuk ? dh : dw; ortakTuval.height = donuk ? dw : dh;
    var ctx = ortakCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (donuk) { ctx.translate(dh, 0); ctx.rotate(Math.PI / 2); }
    ctx.drawImage(kaynak, sx, sy, sw, sh, 0, 0, dw, dh);
    return ctx.getImageData(0, 0, ortakTuval.width, ortakTuval.height);
  }
  function tuvaliBirak() { if (ortakTuval) { ortakTuval.width = ortakTuval.height = 1; } }

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

  // Bir pencereyi (oran olarak) hedef genişliğe ölçekleyip çizer; donuk ise 90° çevrilmiş halini.
  function kesit(img, p, hedef, donuk) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    var sx = p.x * W, sy = p.y * H, sw = p.g * W, sh = p.h * H;
    // Bütün resimde uzun kenar 'hedef' piksele küçültülür (büyütülmez); parçalarda genişlik 'hedef' olur, en fazla 3 kat.
    var olcek = p.g === 1 ? Math.min(hedef / Math.max(sw, sh), 1) : Math.min(hedef / sw, 3);
    return cizim(img, sx, sy, sw, sh, sw * olcek, sh * olcek, donuk);
  }

  function veridenDosya(veri) {
    var c = document.createElement('canvas');
    c.width = veri.width; c.height = veri.height;
    c.getContext('2d').putImageData(veri, 0, 0);
    return new Promise(function (tamam) {
      c.toBlob(function (b) { c.width = c.height = 1; tamam(new File([b], 'kesit.png', { type: 'image/png' })); }, 'image/png');
    });
  }

  // Denenecek görüntüler sırasıyla: bütün resim (iki ölçek), parçalar, bütün resim büyük boyda; sonra 90° çevrilmiş halleri.
  // Büyük boy en fazla 4096 px: iPhone'un tuval sınırının (~16 MP) altında kalır.
  function denemeler() {
    var pen = pencereler(), liste = [];
    [false, true].forEach(function (donuk) {
      liste.push({ p: pen[0], hedef: 2000, donuk: donuk }, { p: pen[0], hedef: 1300, donuk: donuk });
      for (var j = 1; j < pen.length; j++) liste.push({ p: pen[j], hedef: 1200, donuk: donuk });
      if (!donuk) liste.push({ p: pen[0], hedef: 3000, donuk: false }, { p: pen[0], hedef: 4096, donuk: false });
    });
    return liste;
  }

  // Parça parça tarama. coz(ImageData) → {deger, bicim} ya da null.
  // Çizgili barkod iki ayrı görüntüde aynı okununca kabul edilir (bkz. barkodonay.js).
  function parcaParca(img, coz, ilerleme) {
    var liste = denemeler(), i = 0, onay = new kok.BarkodOnay.Onay(2), bulunan = -1;
    function sonraki() {
      if (i >= liste.length) {
        var tek = onay.tekAday();
        return tek ? tek : Promise.reject(new Error('okunamadı'));
      }
      var d = liste[i];
      // İlk okumadan sonra aynı parçayı başka ölçekte bir kez daha dene: doğrulama hızlı gelsin.
      if (bulunan >= 0) { d = { p: liste[bulunan].p, hedef: liste[bulunan].hedef * 0.7, donuk: liste[bulunan].donuk }; bulunan = -2; }
      else i++;
      if (ilerleme) ilerleme(i, liste.length);
      var veri;
      try { veri = kesit(img, d.p, d.hedef, d.donuk); } catch (e) { tani.hata = 'çizim: ' + hataAdi(e); return sonraki(); }
      tani.deneme++;
      return Promise.resolve(veri).then(coz).catch(function (e) { tani.hata = hataAdi(e); return null; }).then(function (s) {
        if (s) tani.okunan[s.deger] = (tani.okunan[s.deger] || 0) + 1;
        var kabul = s ? onay.ekle(s.deger, s.bicim) : '';
        if (kabul) return kabul;
        if (s && bulunan === -1) bulunan = i - 1;
        return sonraki();
      });
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
      coz: function (veri) {
        return veridenDosya(veri).then(function (f) { return h.scanFileV2(f, false); }).then(function (r) {
          var bicim = r && r.result && r.result.format ? String(r.result.format.formatName || '').toLowerCase() : '';
          return { deger: r.decodedText, bicim: bicim === 'qr_code' ? 'qr_code' : bicim };
        });
      },
      bitir: function () { alan.remove(); }
    };
  }

  function fotoOku(dosya, ilerleme) {
    tani.foto = (dosya.type || '?') + ' ' + Math.round((dosya.size || 0) / 1024) + ' KB'; tani.deneme = 0; tani.okunan = {}; tani.hata = '';
    return resimYukle(dosya).then(function (img) {
      tani.foto = (img.naturalWidth || img.width) + '×' + (img.naturalHeight || img.height) + ' ' + tani.foto;
      return dedektor().then(function (d) {
        var coz = function (veri) { return d.detect(veri).then(ilkSonuc); };
        return parcaParca(img, coz, ilerleme);
      }, function () {
        if (!kok.Html5Qrcode) throw new Error('okuyucu yok');
        tani.motor = 'yedek';
        var e = eskiCozucu();
        return parcaParca(img, e.coz, ilerleme).then(function (k) { e.bitir(); return k; }, function (x) { e.bitir(); throw x; });
      });
    }).then(function (k) { tuvaliBirak(); return k; }, function (x) { tuvaliBirak(); throw x; });
  }

  // ---- Canlı kamera ----
  function kapat() {
    var p = perde;
    perde = null;
    if (dongu) { clearTimeout(dongu); dongu = null; }
    if (akis) { akis.getTracks().forEach(function (t) { t.stop(); }); akis = null; }
    var bitti = eskiOkuyucu && eskiOkuyucu.isScanning ? eskiOkuyucu.stop().catch(function () {}) : Promise.resolve();
    eskiOkuyucu = null;
    tuvaliBirak();
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

  var taniYaz = null;
  function canliBaslat(alan, durum, d, bitir) {
    var video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
    var cerceve = document.createElement('div'); cerceve.className = 'kamera-cerceve';
    alan.appendChild(video); alan.appendChild(cerceve);
    var tur = 0, onay = new kok.BarkodOnay.Onay(2);

    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    }).then(function (s) {
      if (!perde) { s.getTracks().forEach(function (t) { t.stop(); }); return false; }
      akis = s;
      video.srcObject = s;
      tani.kare = 0;
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
        tani.video = W + '×' + H; tani.kare++;
        if (tani.kare % 10 === 1 && taniYaz) taniYaz(false);
        var veri;
        try { veri = cizim(video, sx, sy, sw, sh, sw, sh); } catch (e) { dongu = setTimeout(tara, 200); return; }
        d.detect(veri).then(function (s) {
          // Çizgili barkod iki karede aynı okununca kabul edilir (bulanık karede yanlış okumaya karşı).
          var o = ilkSonuc(s), k = o ? onay.ekle(o.deger, o.bicim) : '';
          if (k) bitir(k); else dongu = setTimeout(tara, o ? 0 : 60);
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
      '<p id="kamera-tani" style="font-size:11px;line-height:1.4;opacity:.6;margin:-4px 0 0;word-break:break-word"></p>' +
      '<label class="dugme cerceve" for="kamera-foto" style="cursor:pointer;background:#fff">Fotoğraf çekerek okut</label>' +
      '<input type="file" id="kamera-foto" accept="image/*" capture="environment" class="gizli-etiket">' +
      '<button type="button" class="dugme" id="kamera-kapat">Kapat</button>' +
      '</div>';
    document.body.appendChild(perde);
    var durum = perde.querySelector('#kamera-durum');
    var alan = perde.querySelector('#kamera-alani');
    var taniAlan = perde.querySelector('#kamera-tani');
    taniYaz = function (foto) { if (perde && taniAlan) taniAlan.textContent = taniMetni(foto); };
    taniYaz(false);
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
        .then(bitir).catch(function (e) {
          if (!tani.hata) tani.hata = hataAdi(e);
          taniYaz(true);
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
      taniYaz(false);
      return canliBaslat(alan, durum, d, bitir);
    }, function () {
      if (!perde) return;
      taniYaz(false);
      if (!kok.Html5Qrcode) { durum.textContent = 'Kamera okuyucu yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.'; return; }
      return eskiCanli(durum, bitir);
    }).catch(function (e) { tani.hata = hataAdi(e); if (perde) { durum.textContent = hataMetni; taniAlan.textContent = taniMetni(false) + ' · hata: ' + tani.hata; } });
  }

  kok.Tarayici = { SURUM: SURUM, tani: function () { return taniMetni(true); }, ac: ac, kapat: kapat, fotoOku: fotoOku, pencereler: pencereler, dedektor: dedektor };
})(window);
