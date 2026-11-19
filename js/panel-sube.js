// Yönetim paneli: şube eksik listesi. Şubeden gelen barkodlu Excel listesini yükler,
// kitapların raf/bölmesini bulur, raf sırasına göre gösterir; Excel'e indirir ya da yazdırır.
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var liste = null;   // { dosya, satirlar, sutun }
  var sonuc = null;   // Sube.eslestir çıktısı
  var RENK = { var: 'r-var', kayitsiz: 'r-kayitsiz' };

  function durum(tur, metin) { P.bildir($('sube-durum'), tur, metin); }
  function harf(k) { var s = ''; k++; while (k > 0) { var m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; }

  function csvMetni(arabellek) {
    var metin = new TextDecoder('utf-8').decode(arabellek);
    // Türkçe Excel'in "CSV" kaydı çoğu zaman Windows-1254'tür; bozuk karakter varsa onunla dene.
    if (metin.indexOf(String.fromCharCode(0xFFFD)) >= 0) { try { metin = new TextDecoder('windows-1254').decode(arabellek); } catch (e) { /* desteklenmiyor */ } }
    return metin;
  }

  function dosyaOku(dosya) {
    if (!dosya) return;
    var ad = dosya.name || 'liste';
    if (dosya.size > 10 * 1024 * 1024) { durum('hata', 'Dosya çok büyük (en fazla 10 MB).'); return; }
    durum('basari', '“' + ad + '” okunuyor…');
    dosya.arrayBuffer().then(function (ab) {
      if (/\.csv$/i.test(ad) || /^text\//.test(dosya.type)) return { satirlar: Csv.oku(csvMetni(ab)) };
      if (Xls.xlsMi(new Uint8Array(ab))) return Xls.oku(ab); // eski Excel (.xls)
      return Xlsx.oku(ab);
    }).then(function (r) {
      var satirlar = (r.satirlar || []).map(function (s) { return s || []; });
      if (!satirlar.some(function (s) { return s.length; })) throw new Error('Dosyada veri bulunamadı.');
      var sutun = Sube.sutunlariBul(satirlar);
      if (sutun.barkod < 0) throw new Error('Listede barkod sütunu bulunamadı. Barkodların olduğu sütunun başlığına “Barkod” yazıp tekrar deneyin.');
      liste = { dosya: ad, satirlar: satirlar, sutun: sutun };
      if (!$('sube-ad').value.trim()) $('sube-ad').value = tahminiSube(satirlar, ad);
      sutunSecenekleri();
      hesapla();
      durum('', '');
      $('sube-sonuc').hidden = false;
    }).catch(function (e) {
      durum('hata', e && e.message ? e.message : 'Dosya okunamadı.');
    });
  }

  // Liste başında "Şube: Kadıköy" gibi bir satır varsa şube adını oradan al.
  function tahminiSube(satirlar, dosyaAdi) {
    for (var r = 0; r < Math.min(5, satirlar.length); r++) {
      var m = /[şs]ube\s*(?:ad[ıi])?\s*[:\-]\s*(.+)/i.exec((satirlar[r] || []).join(' ').trim());
      if (m) return m[1].trim().slice(0, 60);
    }
    return '';
  }

  function sutunSecenekleri() {
    var s = liste.sutun, enGenis = 0;
    liste.satirlar.slice(0, 200).forEach(function (r) { enGenis = Math.max(enGenis, r.length); });
    var ad = function (k) {
      var b = s.baslikSatiri >= 0 ? (liste.satirlar[s.baslikSatiri][k] || '').toString().trim() : '';
      return harf(k) + ' sütunu' + (b ? ' · ' + b : '');
    };
    var se = '';
    for (var k = 0; k < enGenis; k++) se += '<option value="' + k + '">' + O.kacis(ad(k)) + '</option>';
    $('sube-barkod-sutun').innerHTML = se;
    $('sube-barkod-sutun').value = String(s.barkod);
    $('sube-adet-sutun').innerHTML = '<option value="-1">Adet sütunu yok (her kalem 1 adet)</option>' + se;
    $('sube-adet-sutun').value = String(s.adet);
  }

  function hesapla() {
    if (!liste) return;
    sonuc = Sube.eslestir(P.d(), liste.satirlar, liste.sutun);
    ciz();
  }

  function ozetCiz() {
    var o = sonuc.ozet, parca = [
      ['Kalem', o.kalem], ['Toplam adet', o.adet], ['Mağazada var', o.var]
    ];
    parca.push(['Kayıtlı değil', o.kayitsiz]);
    $('sube-ozet').innerHTML = parca.map(function (p) { return '<span><b>' + p[1] + '</b>' + p[0] + '</span>'; }).join('') +
      (sonuc.atlanan ? '<span style="background:#FEF3C7;color:#92400E"><b>' + sonuc.atlanan + '</b>barkodu okunamayan satır</span>' : '');
  }

  function ciz() {
    if (!sonuc) return;
    ozetCiz();
    var f = $('sube-filtre').value;
    var kalemler = sonuc.kalemler.filter(function (k) {
      return !f || (f === 'bulunan' ? !!k.yer : k.durum !== 'var');
    });
    var ekleyebilir = P.yetkili('duzenleyici', 'calisan'), sonRaf = null, html = '';
    var sutunSayisi = 6;
    kalemler.forEach(function (k) {
      var rafId = k.yer ? k.yer.raf.id : k.kitap ? 'rafsiz' : '-';
      if (rafId !== sonRaf) {
        sonRaf = rafId;
        html += '<tr class="raf-satir"><td colspan="' + sutunSayisi + '">' + (k.yer
          ? O.kacis(k.yer.raf.no + '. Raf' + (k.yer.raf.etiket ? ' · ' + k.yer.raf.etiket : ''))
          : k.kitap ? 'Mağazada var, henüz rafa yerleştirilmedi' : 'Mağazada kayıtlı olmayan kitaplar') + '</td></tr>';
      }
      var kitap = k.kitap;
      var alt = kitap ? [kitap.yazar, kitap.yayinevi].filter(Boolean).join(' · ') : 'Listede: ' + (k.listeAdi || 'ad yok');
      html += '<tr>' +
        '<td>' + (k.yer ? '<span class="kod-rozet">' + k.yer.kod + '</span>' : k.kitap ? '<span class="kod-rozet rafsiz">Rafsız</span>' : '—') + '</td>' +
        '<td><b>' + O.kacis(kitap ? kitap.ad : (k.listeAdi || 'Bilinmeyen kitap')) + '</b><div class="soluk">' + O.kacis(alt) + '</div></td>' +
        '<td style="font-variant-numeric:tabular-nums;white-space:nowrap">' + O.kacis(k.barkod) + '</td>' +
        '<td class="sayi"><b>' + k.adet + '</b></td>' +
        '<td><span class="rozet ' + RENK[k.durum] + '">' + Sube.DURUM[k.durum] + '</span></td>' +
        '<td class="islem"><span class="yazdirma-gizle">' +
          (!kitap && ekleyebilir ? '<button class="dugme" type="button" data-sube-ekle="' + O.kacis(k.barkod) + '" style="min-height:36px">Kitabı ekle</button>' : '') +
        '</span><span class="sadece-yazdir"><i class="kutucuk"></i></span></td></tr>';
    });
    $('sube-satirlar').innerHTML = html || '<tr><td colspan="' + sutunSayisi + '" class="bos-not" style="text-align:center;padding:28px">Bu filtrede kalem yok.</td></tr>';
    var sube = $('sube-ad').value.trim();
    $('sube-yazdir-baslik').innerHTML = '<h2>' + O.kacis((sube ? sube + ' · ' : '') + 'Eksik listesi') + '</h2><p class="soluk">' +
      O.kacis(liste.dosya) + ' · ' + new Date().toLocaleDateString('tr-TR') + ' · ' + sonuc.ozet.kalem + ' kalem, ' + sonuc.ozet.adet + ' adet</p>';
  }

  function indir(bayt, ad) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bayt], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  var ASCII = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  function dosyaAdi(metin) {
    return String(metin).replace(/[çÇğĞıİöÖşŞüÜ]/g, function (h) { return ASCII[h]; }).replace(/[^\w.\- ]+/g, ' ').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  $('sube-dosya').addEventListener('change', function () { dosyaOku(this.files[0]); this.value = ''; });
  var birak = $('sube-birak');
  ['dragenter', 'dragover'].forEach(function (o) { birak.addEventListener(o, function (e) { e.preventDefault(); birak.classList.add('uzerinde'); }); });
  ['dragleave', 'drop'].forEach(function (o) { birak.addEventListener(o, function () { birak.classList.remove('uzerinde'); }); });
  birak.addEventListener('drop', function (e) { e.preventDefault(); dosyaOku(e.dataTransfer.files[0]); });

  $('sube-barkod-sutun').addEventListener('change', function () { liste.sutun.barkod = Number(this.value); hesapla(); });
  $('sube-adet-sutun').addEventListener('change', function () { liste.sutun.adet = Number(this.value); hesapla(); });
  $('sube-filtre').addEventListener('change', ciz);
  $('sube-ad').addEventListener('input', function () { if (sonuc) ciz(); });

  $('sube-indir').addEventListener('click', function () {
    if (!sonuc) return;
    var sube = $('sube-ad').value.trim();
    var satirlar = Sube.ciktiSatirlari(sonuc);
    var genislik = [6, 22, 8, 16, 40, 24, 22, 12, 15, 34];
    indir(Xlsx.yaz(satirlar, { sayfa: sube || 'Eksik listesi', genislikler: genislik, kalinBaslik: true }),
      dosyaAdi('eksik-listesi-' + (sube ? sube + '-' : '') + new Date().toISOString().slice(0, 10)) + '.xlsx');
  });
  $('sube-yazdir').addEventListener('click', function () { ciz(); window.print(); });
  $('sube-temizle').addEventListener('click', function () {
    liste = sonuc = null;
    $('sube-sonuc').hidden = true;
    $('sube-ad').value = '';
    durum('', '');
  });
  // Örnek liste: mağazadaki barkodlu birkaç kitap + kayıtlı olmayan bir barkod; yükleyip hemen denenebilir.
  $('sube-ornek').addEventListener('click', function () {
    var satir = [['Şube: Örnek şube'], [], ['Barkod', 'Kitap adı', 'Adet']];
    P.d().kitaplar.filter(function (k) { return k.barkod; }).slice(0, 5).forEach(function (k, i) {
      satir.push([k.barkod, k.ad, [2, 1, 3, 1, 4][i]]);
    });
    satir.push(['9789750000001', 'Mağazada olmayan örnek kitap', 1]);
    indir(Xlsx.yaz(satir, { sayfa: 'Eksikler', genislikler: [18, 40, 8] }), 'ornek-eksik-listesi.xlsx');
  });
  $('sube-satirlar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sube-ekle]');
    if (b) P.kitapFormuAc({ barkod: b.getAttribute('data-sube-ekle') });
  });

  P.sekmeEkle('sube', 'Şube eksikleri', function () { if (liste) hesapla(); });
  // Kitap eklenince ya da taşınınca liste kendiliğinden güncellensin.
  P.herCizimde(function () { if (liste && !$('sube').hidden) hesapla(); });
})();
