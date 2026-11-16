// Yönetim paneli: Mağaza haritası düzenleyicisi (sürükle-bırak, boyutlandır, kasa/giriş/kiosk yeri, yön tarifi).
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var plan = null;          // üzerinde çalışılan kopya
  var secili = null;        // { tur: 'raf'|'nesne'|'kiosk', id }
  var degisti = false;

  function kopya(x) { return JSON.parse(JSON.stringify(x)); }
  function raflar() { return O.sirali(P.d().raflar); }
  function kutu(s) {
    if (!s) return null;
    if (s.tur === 'raf') return plan.raflar[s.id];
    if (s.tur === 'nesne') return plan.nesneler.find(function (n) { return n.id === s.id; });
    return null;
  }
  function isaretle(v) {
    degisti = v;
    $('harita-durum').innerHTML = v ? '<div class="mesaj" style="background:#FEF3C7;color:#92400E;border:1px solid #FDE68A">Kaydedilmemiş değişiklik var. Bitirince “Haritayı kaydet”e basın.</div>' : '';
  }

  function ciz() {
    var el = $('harita-plan'), html = '';
    var esle = function (tur, id) { return secili && secili.tur === tur && secili.id === id; };
    raflar().forEach(function (r) {
      var k = plan.raflar[r.id];
      if (!k) return;
      html += '<div class="raf-blok' + (esle('raf', r.id) ? ' secili' : '') + '" data-tur="raf" data-id="' + r.id + '" style="left:' + k.x + '%;top:' + k.y + '%;width:' + k.w + '%;height:' + k.h + '%">' +
        r.no + '. Raf' + (r.etiket ? '<small>' + O.kacis(r.etiket) + '</small>' : '') + (esle('raf', r.id) ? '<span class="tutamac" data-boyut="1"></span>' : '') + '</div>';
    });
    plan.nesneler.forEach(function (n) {
      html += '<div class="ozel ' + n.tur + (esle('nesne', n.id) ? ' secili' : '') + '" data-tur="nesne" data-id="' + n.id + '" style="left:' + n.x + '%;top:' + n.y + '%;width:' + n.w + '%;height:' + n.h + '%">' +
        (n.tur === 'kasa' ? 'Kasa' : 'Giriş') + (esle('nesne', n.id) ? '<span class="tutamac" data-boyut="1"></span>' : '') + '</div>';
    });
    if (plan.kiosk) html += '<div class="siz' + (esle('kiosk', 'k') ? ' secili' : '') + '" data-tur="kiosk" data-id="k" style="left:' + plan.kiosk.x + '%;top:' + plan.kiosk.y + '%"><span>Kiosk</span><i></i></div>';
    el.innerHTML = html;

    var bekleyen = Harita.yerlesmemis(plan, raflar());
    $('harita-bekleyen').innerHTML = bekleyen.length ? bekleyen.map(function (r) {
      return '<button type="button" class="dugme" data-yerlestir="' + r.id + '">+ ' + r.no + '. Raf</button>';
    }).join('') : '<p class="soluk">Tüm raflar haritada.</p>';
    ozellikCiz();
  }

  function ozellikCiz() {
    var p = $('harita-ozellik'), k = kutu(secili);
    var c = Harita.cakismalar(plan, raflar());
    var uyari = c.length ? '<div class="mesaj hata">Üst üste gelenler: ' + c.slice(0, 3).map(function (x) { return O.kacis(x.a + ' – ' + x.b); }).join(', ') + (c.length > 3 ? '…' : '') + '. Müşteri ekranında karışık görünür; ayırın.</div>' : '';
    if (!secili) {
      p.innerHTML = '<h2 style="font-size:17px">Seçili öğe yok</h2><p class="soluk">Bir rafa, kasaya ya da kiosk noktasına dokunun. Ok tuşlarıyla da taşıyabilirsiniz (Shift ile 5 kat).</p>' +
        (plan.kiosk ? '' : '<div class="mesaj hata">Kiosk yeri konmadı. Müşteri ekranında yol çizilebilmesi için “Kiosk yerini koy”a basın.</div>') + uyari;
      return;
    }
    if (secili.tur === 'kiosk') {
      p.innerHTML = '<h2 style="font-size:17px">Kiosk (Buradasınız)</h2><p class="soluk">Müşteri ekranının durduğu yer. Yol buradan başlar.</p>' +
        '<button type="button" class="dugme tehlike" data-harita-sil="1">Haritadan kaldır</button>' + uyari;
      return;
    }
    var baslik = secili.tur === 'raf' ? (function () { var r = P.d().raflar.find(function (x) { return x.id === secili.id; }); return r ? r.no + '. Raf' : 'Raf'; })()
      : (k.tur === 'kasa' ? 'Kasa' : 'Giriş');
    p.innerHTML = '<h2 style="font-size:17px">Seçili: ' + O.kacis(baslik) + '</h2>' +
      '<div class="izgara-2"><div class="alan"><label for="hz-w">Genişlik (%)</label><input id="hz-w" type="number" min="2" max="100" step="1" value="' + k.w + '"></div>' +
      '<div class="alan"><label for="hz-h">Uzunluk (%)</label><input id="hz-h" type="number" min="2" max="100" step="1" value="' + k.h + '"></div></div>' +
      (secili.tur === 'raf' ? '<div class="alan"><label for="hz-tarif">Yön tarifi (müşteriye gösterilir)</label><input id="hz-tarif" maxlength="80" placeholder="Örn. Girişten sağa, kasanın arkası" value="' + O.kacis(k.tarif || '') + '"></div>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="dugme" data-harita-dondur="1">↻ 90° döndür</button><button type="button" class="dugme tehlike" data-harita-sil="1">Haritadan kaldır</button></div>' + uyari;
  }

  function sinirla(k) {
    k.w = Math.max(2, Math.min(100, Math.round(k.w * 10) / 10));
    k.h = Math.max(2, Math.min(100, Math.round(k.h * 10) / 10));
    k.x = Math.max(0, Math.min(100 - k.w, Math.round(k.x * 10) / 10));
    k.y = Math.max(0, Math.min(100 - k.h, Math.round(k.y * 10) / 10));
  }

  // ---- Sürükleme / boyutlandırma ----
  var surukle = null;
  $('harita-plan').addEventListener('pointerdown', function (e) {
    var hedef = e.target.closest('[data-tur]');
    if (!hedef) { secili = null; ciz(); return; }
    secili = { tur: hedef.getAttribute('data-tur'), id: hedef.getAttribute('data-id') };
    var r = this.getBoundingClientRect();
    var k = secili.tur === 'kiosk' ? plan.kiosk : kutu(secili);
    surukle = { boyut: !!e.target.closest('[data-boyut]'), x0: e.clientX, y0: e.clientY, w: r.width, h: r.height, bas: kopya(k) };
    this.setPointerCapture(e.pointerId);
    ciz();
    e.preventDefault();
  });
  $('harita-plan').addEventListener('pointermove', function (e) {
    if (!surukle) return;
    var dx = (e.clientX - surukle.x0) / surukle.w * 100, dy = (e.clientY - surukle.y0) / surukle.h * 100;
    if (secili.tur === 'kiosk') {
      plan.kiosk = { x: Math.max(0, Math.min(100, Math.round((surukle.bas.x + dx) * 10) / 10)), y: Math.max(0, Math.min(100, Math.round((surukle.bas.y + dy) * 10) / 10)) };
    } else {
      var k = kutu(secili);
      if (surukle.boyut) { k.w = surukle.bas.w + dx; k.h = surukle.bas.h + dy; } else { k.x = surukle.bas.x + dx; k.y = surukle.bas.y + dy; }
      sinirla(k);
    }
    if (Math.abs(dx) + Math.abs(dy) > 0.2) isaretle(true);
    ciz();
  });
  ['pointerup', 'pointercancel'].forEach(function (ol) { $('harita-plan').addEventListener(ol, function () { surukle = null; }); });

  // Klavye: ok tuşlarıyla taşı.
  $('harita-plan').addEventListener('keydown', function (e) {
    if (!secili || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var a = e.shiftKey ? 5 : 1, dx = e.key === 'ArrowLeft' ? -a : e.key === 'ArrowRight' ? a : 0, dy = e.key === 'ArrowUp' ? -a : e.key === 'ArrowDown' ? a : 0;
    if (secili.tur === 'kiosk') { plan.kiosk.x = Math.max(0, Math.min(100, plan.kiosk.x + dx)); plan.kiosk.y = Math.max(0, Math.min(100, plan.kiosk.y + dy)); }
    else { var k = kutu(secili); k.x += dx; k.y += dy; sinirla(k); }
    isaretle(true); ciz();
  });

  // ---- Düğmeler ----
  document.getElementById('harita').addEventListener('click', function (e) {
    var ekle = e.target.closest('[data-harita-ekle]');
    if (ekle) {
      var tur = ekle.getAttribute('data-harita-ekle');
      if (tur === 'kiosk') { plan.kiosk = plan.kiosk || { x: 50, y: 88 }; secili = { tur: 'kiosk', id: 'k' }; }
      else {
        var n = { id: Date.now().toString(36), tur: tur, x: tur === 'giris' ? 42 : 60, y: tur === 'giris' ? 92 : 66, w: tur === 'giris' ? 16 : 20, h: tur === 'giris' ? 8 : 12 };
        plan.nesneler.push(n); secili = { tur: 'nesne', id: n.id };
      }
      isaretle(true); ciz(); return;
    }
    var yer = e.target.closest('[data-yerlestir]');
    if (yer) {
      var adet = Object.keys(plan.raflar).length;
      plan.raflar[yer.getAttribute('data-yerlestir')] = { x: 4 + (adet % 4) * 24, y: 6 + Math.floor(adet / 4) * 30, w: 20, h: 12, tarif: '' };
      secili = { tur: 'raf', id: yer.getAttribute('data-yerlestir') };
      isaretle(true); ciz(); return;
    }
    if (e.target.closest('[data-harita-dondur]')) {
      var k = kutu(secili); var w = k.w; k.w = k.h * 10 / 16; k.h = w * 16 / 10; sinirla(k); isaretle(true); ciz(); return;
    }
    if (e.target.closest('[data-harita-sil]')) {
      if (secili.tur === 'raf') delete plan.raflar[secili.id];
      else if (secili.tur === 'kiosk') plan.kiosk = null;
      else plan.nesneler = plan.nesneler.filter(function (n) { return n.id !== secili.id; });
      secili = null; isaretle(true); ciz();
    }
  });
  $('harita-ozellik').addEventListener('input', function (e) {
    var k = kutu(secili);
    if (!k) return;
    if (e.target.id === 'hz-w' || e.target.id === 'hz-h') {
      var v = Number(e.target.value);
      if (!isFinite(v) || v <= 0) return;
      k[e.target.id === 'hz-w' ? 'w' : 'h'] = v; sinirla(k);
      isaretle(true);
      var el = $('harita-plan').querySelector('.secili');
      if (el) { el.style.width = k.w + '%'; el.style.height = k.h + '%'; el.style.left = k.x + '%'; el.style.top = k.y + '%'; }
    }
    if (e.target.id === 'hz-tarif') { k.tarif = e.target.value.slice(0, 80); isaretle(true); }
  });

  $('harita-kaydet').addEventListener('click', function () {
    var temiz = Depo.planDuzelt(plan, P.d().raflar);
    P.yap(function () { return Veri.ayarKaydet('plan', temiz); }, 'Harita kaydedildi. Müşteri ekranı artık yolu gösteriyor.')
      .then(function () { plan = kopya(P.d().ayarlar.plan); isaretle(false); ciz(); }, P.sus);
  });

  P.sekmeEkle('harita', 'Mağaza haritası', function () {
    if (!plan || !degisti) plan = kopya(Depo.planDuzelt(P.d().ayarlar.plan, P.d().raflar));
    ciz();
  });
  window.addEventListener('beforeunload', function (e) { if (degisti) { e.preventDefault(); e.returnValue = ''; } });
})();
