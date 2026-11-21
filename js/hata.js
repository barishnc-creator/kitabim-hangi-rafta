// Beklenmeyen hataları Supabase'deki kirtasiye_hatalar tablosuna bildirir (supabase/hata-kaydi.sql).
// Panelde "Sistem durumu" bölümünde görünür. Kullanıcının yanlış girişi (boş ad, aynı barkod vb.) hata sayılmaz.
// İnternet yoksa en çok 20 bildirim cihazda bekler, bağlantı gelince gönderilir. Tarayıcıda window.Hata.
(function (kok) {
  var SURUM = 'khr-v20'; // sw.js ile aynı olmalı (tests/hata.test.cjs denetler)
  var KUYRUK = 'kitabim-hangi-rafta:hata-kuyrugu';
  var SAYFA_SINIRI = 30; // bir sayfa açılışında en çok bu kadar bildirim (döngüye giren hata sunucuyu doldurmasın)
  var gonderilen = 0, sonGonderim = {};

  function ekran() { return /yonetim/.test((kok.location && kok.location.pathname) || '') ? 'panel' : 'musteri'; }
  function cihaz() {
    var ua = (kok.navigator && kok.navigator.userAgent) || '';
    var aygit = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android telefon' : 'Android tablet') : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Diğer';
    var tarayici = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'tarayıcı';
    var uygulama = kok.matchMedia && kok.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ? ' (uygulama)' : '';
    return (aygit + ' ' + tarayici + uygulama).slice(0, 120);
  }

  // Kullanıcıya gösterilen doğrulama mesajları hata değildir: Depo hataları "kod" taşır, dosya okuma hataları "kullaniciMesaji".
  function bildirilmeli(h) {
    if (!h) return false;
    if (h.kod || h.kullaniciMesaji || h.sinir) return false;
    var m = String(h.message || h);
    if (/^Script error\.?$/i.test(m)) return false; // başka kökenden gelen, ayrıntısız hata
    if (/ResizeObserver loop/i.test(m)) return false; // tarayıcının zararsız uyarısı
    return true;
  }

  function kayitYap(h, baglam) {
    var mesaj = String((h && h.message) || h || 'Bilinmeyen hata').replace(/\s+/g, ' ').trim();
    if (baglam) mesaj = baglam + ': ' + mesaj;
    var ayrinti = String((h && h.stack) || '').split('\n').slice(0, 12).join('\n');
    // Adres satırındaki ayrıntılar (arama sorgusu vb.) yazılmaz; yalnız dosya adı ve satır.
    ayrinti = ayrinti.replace(/https?:\/\/[^\s)]+\/([^\/\s)?#]+)(\?[^\s):]*)?/g, '$1');
    return { ekran: ekran(), mesaj: mesaj.slice(0, 300), ayrinti: ayrinti.slice(0, 2000), surum: SURUM, cihaz: cihaz() };
  }

  function kuyrukOku() { try { return JSON.parse(kok.localStorage.getItem(KUYRUK)) || []; } catch (e) { return []; } }
  function kuyrukYaz(l) { try { kok.localStorage.setItem(KUYRUK, JSON.stringify(l.slice(-20))); } catch (e) { /* depolama kapalı */ } }

  function gonder(k) {
    if (!kok.Veri || !kok.Veri.hataYaz) return Promise.reject(new Error('hazır değil'));
    return kok.Veri.hataYaz(k);
  }

  function bildir(h, baglam) {
    try {
      if (!bildirilmeli(h)) return;
      var k = kayitYap(h, baglam);
      var simdi = Date.now();
      if (sonGonderim[k.mesaj] && simdi - sonGonderim[k.mesaj] < 60000) return; // aynı hata dakikada bir
      if (gonderilen >= SAYFA_SINIRI) return;
      sonGonderim[k.mesaj] = simdi;
      gonderilen++;
      gonder(k).catch(function () { var l = kuyrukOku(); l.push(k); kuyrukYaz(l); });
    } catch (e) { /* bildirim yaparken hata çıkarsa programı etkilemesin */ }
  }

  function bekleyenleriGonder() {
    var l = kuyrukOku();
    if (!l.length || (kok.navigator && kok.navigator.onLine === false)) return;
    kuyrukYaz([]);
    l.forEach(function (k) { gonder(k).catch(function () { var m = kuyrukOku(); m.push(k); kuyrukYaz(m); }); });
  }

  if (kok.addEventListener) {
    kok.addEventListener('error', function (e) {
      if (e && e.target && e.target !== kok && e.target.tagName) return; // resim/dosya yüklenemedi: program hatası değil
      bildir(e.error || e.message);
    });
    kok.addEventListener('unhandledrejection', function (e) { bildir(e.reason, 'Yakalanmamış'); });
    kok.addEventListener('online', function () { setTimeout(bekleyenleriGonder, 2000); });
    kok.addEventListener('load', function () { setTimeout(bekleyenleriGonder, 3000); });
  }

  var api = { bildir: bildir, SURUM: SURUM, bildirilmeli: bildirilmeli, kayitYap: kayitYap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  kok.Hata = api;
})(typeof window !== 'undefined' ? window : globalThis);
