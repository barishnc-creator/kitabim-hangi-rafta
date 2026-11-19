// Yönetim paneli: Excel ile ürün girişi ve rafa yerleştirme.
// Ürün girişi: mağaza programından gelen liste (.xls/.xlsx/.csv) okunur, sütunlar bulunur (gerekirse elle seçilir),
// özet ve önizleme gösterilir; onaylanınca programda olmayan kitaplar rafsız eklenir, kayıtlı olanlar atlanır.
// Rafa yerleştir: bölme bir kez seçilir, okutulan her barkodun kitabı o bölmeye kaydedilir.
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var tablo = null;  // { dosya, satirlar, sutun }
  var plan = null;   // Giris.planla sonucu
  var SUTUNLAR = [['barkod', 'Barkod'], ['ad', 'Kitap adı'], ['yayinevi', 'Yayınevi'], ['yazar', 'Yazar'], ['fiyat', 'Fiyat'], ['konum', 'Raf/Bölme']];

  function durum(kutu, tur, metin) { P.bildir($(kutu), tur, metin); }
  function harf(k) { var s = ''; k++; while (k > 0) { var m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; }

  function csvMetni(ab) {
    var metin = new TextDecoder('utf-8').decode(ab);
    // Türkçe Excel'in CSV'si çoğu zaman Windows-1254'tür: bozuk karakter varsa onunla dene
    if (metin.indexOf(String.fromCharCode(0xFFFD)) >= 0) { try { metin = new TextDecoder('windows-1254').decode(ab); } catch (e) { /* desteklenmiyor */ } }
    return metin;
  }

  // ---------- Ürün girişi ----------
  function dosyaOku(dosya) {
    if (!dosya) return;
    var ad = dosya.name || 'liste';
    if (dosya.size > 15 * 1024 * 1024) { durum('giris-durum', 'hata', 'Dosya çok büyük (en fazla 15 MB).'); return; }
    durum('giris-durum', 'basari', '“' + ad + '” okunuyor…');
    dosya.arrayBuffer().then(function (ab) {
      if (/\.csv$/i.test(ad) || /^text\//.test(dosya.type)) return { satirlar: Csv.oku(csvMetni(ab)) };
      if (Xls.xlsMi(new Uint8Array(ab))) return Xls.oku(ab);
      return Xlsx.oku(ab);
    }).then(function (r) {
      var satirlar = (r.satirlar || []).map(function (s) { return s || []; });
      if (!satirlar.some(function (s) { return s.length; })) throw new Error('Dosyada veri bulunamadı.');
      var sutun = Giris.sutunlariBul(satirlar);
      if (sutun.barkod < 0) throw new Error('Listede barkod sütunu bulunamadı. Barkodların olduğu sütunun başlığına “Barkod” yazıp tekrar deneyin.');
      tablo = { dosya: ad, satirlar: satirlar, sutun: sutun };
      sutunSecimiCiz();
      hesapla();
      durum('giris-durum', '', '');
      $('giris-onizleme').hidden = false;
      $('giris-onizleme').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      durum('giris-durum', 'hata', e && e.message ? e.message : 'Dosya okunamadı.');
    });
  }

  function sutunSecimiCiz() {
    var s = tablo.sutun, enGenis = 0;
    tablo.satirlar.slice(0, 200).forEach(function (r) { enGenis = Math.max(enGenis, r.length); });
    var baslik = function (k) { var b = s.baslikSatiri >= 0 ? O.kacis(String(tablo.satirlar[s.baslikSatiri][k] || '').trim()) : ''; return harf(k) + ' sütunu' + (b ? ' · ' + b : ''); };
    var secenekler = '';
    for (var k = 0; k < enGenis; k++) secenekler += '<option value="' + k + '">' + baslik(k) + '</option>';
    $('giris-sutun-secim').innerHTML = SUTUNLAR.map(function (a) {
      return '<div class="alan"><label for="giris-s-' + a[0] + '">' + a[1] + '</label><select id="giris-s-' + a[0] + '" data-alan="' + a[0] + '">' +
        (a[0] === 'barkod' ? '' : '<option value="-1">Yok</option>') + secenekler + '</select></div>';
    }).join('');
    SUTUNLAR.forEach(function (a) { $('giris-s-' + a[0]).value = String(s[a[0]]); });
    $('giris-sutun-ozet').textContent = '(' + SUTUNLAR.filter(function (a) { return s[a[0]] >= 0; }).map(function (a) { return a[1]; }).join(', ') + ')';
  }

  function hesapla() {
    plan = Giris.planla(P.d(), tablo.satirlar, tablo.sutun);
    ciz();
  }

  function ciz() {
    var p = plan;
    var parca = [['Yeni kitap', p.yeni.length], ['Zaten kayıtlı (atlanacak)', p.kayitli]];
    if (p.rafsiz) parca.push(['Rafa yerleştirilecek', p.rafsiz]);
    $('giris-ozet').innerHTML = parca.map(function (x) { return '<span><b>' + x[1].toLocaleString('tr-TR') + '</b> ' + x[0] + '</span>'; }).join('') +
      (p.hatalar.length ? '<span style="background:#FEF2F2;color:#991B1B"><b>' + p.hatalar.length + '</b> satır eklenemeyecek</span>' : '');
    var uyari = [];
    var liste = function (sinif, baslik, l) {
      if (!l.length) return;
      uyari.push('<div class="mesaj ' + sinif + '"><b>' + baslik + ':</b><ul style="margin:6px 0 0 18px">' +
        l.slice(0, 8).map(function (h) { return '<li>' + h.satir + '. satır: ' + O.kacis(h.mesaj) + '</li>'; }).join('') +
        (l.length > 8 ? '<li>… ' + (l.length - 8) + ' satır daha</li>' : '') + '</ul></div>');
    };
    liste('hata', 'Eklenemeyecek satırlar', p.hatalar);
    liste('uyari', 'Uyarılar', p.uyarilar);
    $('giris-uyari').innerHTML = uyari.join('');
    $('giris-kaydet').disabled = !p.yeni.length;
    $('giris-kaydet').textContent = 'Yeni kitapları kaydet (' + p.yeni.length.toLocaleString('tr-TR') + ')';

    var satirlar = p.yeni.map(function (y) {
      var yer = y.bolmeId && Depo.konum(P.d(), y.bolmeId);
      return '<tr><td><span class="rozet r-az">Yeni</span> ' + (yer ? '<span class="kod-rozet">' + yer.kod + '</span>' : '<span class="kod-rozet rafsiz">Rafsız</span>') + '</td>' +
        '<td><b>' + O.kacis(y.ad) + '</b><div class="soluk">' + O.kacis([y.yazar, y.yayinevi].filter(Boolean).join(' · ') || '—') + '</div></td>' +
        '<td>' + O.kacis(y.barkod) + '</td></tr>';
    });
    $('giris-satirlar').innerHTML = satirlar.length
      ? satirlar.slice(0, 300).join('') + (satirlar.length > 300 ? '<tr><td colspan="3" class="soluk">… ' + (satirlar.length - 300) + ' satır daha (hepsi kaydedilecek)</td></tr>' : '')
      : '<tr><td colspan="3" class="bos-not" style="text-align:center;padding:28px">Yeni kitap yok: listedeki ürünlerin hepsi programda kayıtlı.</td></tr>';
  }

  function temizle() {
    tablo = plan = null;
    $('giris-onizleme').hidden = true;
    $('giris-satirlar').innerHTML = '';
  }

  $('giris-dosya').addEventListener('change', function () { dosyaOku(this.files[0]); this.value = ''; });
  var birak = $('giris-birak');
  ['dragenter', 'dragover'].forEach(function (o) { birak.addEventListener(o, function (e) { e.preventDefault(); birak.classList.add('uzerinde'); }); });
  ['dragleave', 'drop'].forEach(function (o) { birak.addEventListener(o, function () { birak.classList.remove('uzerinde'); }); });
  birak.addEventListener('drop', function (e) { e.preventDefault(); dosyaOku(e.dataTransfer.files[0]); });
  $('giris-sutun-secim').addEventListener('change', function (e) {
    var alan = e.target.getAttribute('data-alan');
    if (!alan || !tablo) return;
    tablo.sutun[alan] = Number(e.target.value);
    sutunSecimiCiz();
    hesapla();
  });
  $('giris-vazgec').addEventListener('click', function () { temizle(); durum('giris-durum', '', ''); });
  $('giris-kaydet').addEventListener('click', function () {
    if (!plan) return;
    var dugme = this, kaydedilen = plan;
    dugme.disabled = true;
    durum('giris-durum', 'basari', 'Kaydediliyor…');
    // Plan, sayfadaki güncel veriye göre yeniden hazırlanır: bu arada başka cihazdan eklenen kitaplar çift kaydedilmesin
    kaydedilen = Giris.planla(P.d(), tablo.satirlar, tablo.sutun);
    Veri.urunGirisi(kaydedilen).then(function (s) {
      var dosya = tablo ? tablo.dosya : '';
      temizle();
      durum('giris-durum', 'basari', '“' + dosya + '” kaydedildi: ' + s.eklenen.length + ' yeni kitap eklendi.' +
        (Depo.rafsizKitaplar(P.d()).length ? ' Yeni kitapları aşağıdan rafına yerleştirin.' : ''));
      yerlestirCiz();
      if (s.eklenen.some(function (k) { return !k.bolmeId; })) $('yerlestir').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) {
      durum('giris-durum', 'hata', 'Kaydedilemedi: ' + (e && e.message ? e.message : 'bilinmeyen hata'));
      dugme.disabled = false;
    });
  });

  // ---------- Rafa yerleştir ----------
  var sonYerlesen = [];   // bu oturumda yerleştirilenler (en yeni başta)
  var gosterilen = 50;

  function bolmeSecenekleri() {
    var secili = $('yer-bolme').value;
    var html = '<option value="">Bölme seçin</option>';
    O.sirali(P.d().raflar).forEach(function (r) {
      html += '<optgroup label="' + O.kacis(r.no + '. Raf' + (r.etiket ? ' · ' + r.etiket : '')) + '">' +
        O.sirali(r.bolmeler).map(function (b) { return '<option value="' + b.id + '">' + r.no + '.' + b.no + '</option>'; }).join('') + '</optgroup>';
    });
    $('yer-bolme').innerHTML = html;
    if (secili && Depo.konum(P.d(), secili)) $('yer-bolme').value = secili;
  }

  function anahtar(x) { return window.Sube ? Sube.barkodAnahtar(x) : String(x || '').replace(/\D/g, ''); }
  function kitapBul(barkod) {
    var a = anahtar(barkod);
    return a ? P.d().kitaplar.find(function (k) { return k.barkod && anahtar(k.barkod) === a; }) : null;
  }

  function yerlestir(kitap, bolmeId) {
    var hedef = Depo.konum(P.d(), bolmeId);
    return Veri.kitapKaydet(Object.assign({}, kitap, { bolmeId: bolmeId }), true).then(function (k) {
      sonYerlesen = [{ id: kitap.id, ad: kitap.ad, kod: hedef.kod }].concat(sonYerlesen.filter(function (x) { return x.id !== kitap.id; })).slice(0, 8);
      durum('yer-durum', 'basari', '“' + kitap.ad + '” → Bölme ' + hedef.kod);
      yerlestirCiz();
      return k;
    });
  }

  function barkodOkundu(kod) {
    var bolmeId = $('yer-bolme').value;
    kod = String(kod || '').replace(/\s+/g, '');
    if (!kod) return Promise.resolve(false);
    if (!bolmeId) { durum('yer-durum', 'hata', 'Önce kitabın konulacağı bölmeyi seçin.'); $('yer-bolme').focus(); return Promise.resolve(false); }
    var kitap = kitapBul(kod);
    if (!kitap) { durum('yer-durum', 'hata', kod + ' barkodlu kitap kayıtlı değil. Önce ürün girişi yapın ya da “Kitap ekle” ile ekleyin.'); return Promise.resolve(false); }
    if (kitap.bolmeId === bolmeId) { durum('yer-durum', 'basari', '“' + kitap.ad + '” zaten Bölme ' + Depo.konum(P.d(), bolmeId).kod + '\'de.'); return Promise.resolve(true); }
    var onay = Promise.resolve(true);
    var eski = kitap.bolmeId && Depo.konum(P.d(), kitap.bolmeId);
    if (eski) onay = O.pencere('“' + kitap.ad + '” şu an Bölme ' + eski.kod + '\'de kayıtlı. Bölme ' + Depo.konum(P.d(), bolmeId).kod + '\'ye taşınsın mı?', { evet: 'Taşı' });
    return onay.then(function (evet) {
      if (!evet) return false;
      return yerlestir(kitap, bolmeId).then(function () { return true; });
    }).catch(function (e) { durum('yer-durum', 'hata', e && e.message ? e.message : 'Kaydedilemedi.'); return false; });
  }

  function yerlestirCiz() {
    if (!$('urun-girisi') || $('urun-girisi').hidden) return;
    bolmeSecenekleri();
    var rafsiz = Depo.rafsizKitaplar(P.d());
    $('yer-rafsiz-sayi').textContent = rafsiz.length ? '(' + rafsiz.length + ')' : '';
    $('yer-son').innerHTML = sonYerlesen.map(function (x) {
      return '<li><div class="metin"><b>' + O.kacis(x.ad) + '</b><span class="soluk">Az önce yerleştirildi</span></div><span class="kod-rozet">' + x.kod + '</span></li>';
    }).join('');
    $('yer-rafsiz').innerHTML = rafsiz.length ? rafsiz.slice(0, gosterilen).map(function (k) {
      return '<li><div class="metin"><b>' + O.kacis(k.ad) + '</b><span class="soluk">' + O.kacis([k.barkod, k.yayinevi].filter(Boolean).join(' · ')) +
        '</span></div>' +
        '<button type="button" class="dugme" data-yerlestir="' + O.kacis(k.id) + '">Seçili bölmeye koy</button></li>';
    }).join('') : '<li class="bos-not">Rafa yerleştirilmeyi bekleyen kitap yok.</li>';
    $('yer-daha').hidden = rafsiz.length <= gosterilen;
  }

  function sayacGuncelle() {
    var n = Depo.rafsizKitaplar(P.d()).length;
    $('rafsiz-sayac').hidden = !n;
    $('rafsiz-sayac').textContent = n > 99 ? '99+' : String(n);
  }

  $('yer-barkod').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var alan = this;
    barkodOkundu(alan.value).then(function () { alan.value = ''; alan.focus(); });
  });
  $('yer-tara').addEventListener('click', function taraAc() {
    if (!$('yer-bolme').value) { durum('yer-durum', 'hata', 'Önce kitabın konulacağı bölmeyi seçin.'); $('yer-bolme').focus(); return; }
    Tarayici.ac(function (kod) {
      barkodOkundu(kod).then(function (tamam) {
        // Art arda yerleştirme: kamera kendiliğinden yeniden açılır
        if (tamam && $('yer-art-arda').checked) setTimeout(taraAc, 700);
      });
    });
  });
  $('yer-rafsiz').addEventListener('click', function (e) {
    var b = e.target.closest('[data-yerlestir]');
    if (!b) return;
    var bolmeId = $('yer-bolme').value;
    if (!bolmeId) { durum('yer-durum', 'hata', 'Önce kitabın konulacağı bölmeyi seçin.'); $('yer-bolme').focus(); return; }
    var kitap = P.d().kitaplar.find(function (k) { return k.id === b.getAttribute('data-yerlestir'); });
    if (kitap) { b.disabled = true; yerlestir(kitap, bolmeId).catch(function (x) { b.disabled = false; durum('yer-durum', 'hata', x.message || 'Kaydedilemedi.'); }); }
  });
  $('yer-daha').addEventListener('click', function () { gosterilen += 50; yerlestirCiz(); });

  P.sekmeEkle('urun-girisi', 'Ürün girişi', function () { if (plan) hesapla(); yerlestirCiz(); });
  P.herCizimde(function () {
    sayacGuncelle();
    if (!$('urun-girisi').hidden) { if (plan) hesapla(); yerlestirCiz(); }
  });
})();
