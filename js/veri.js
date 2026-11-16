// Verinin saklandığı yer ve giriş/yetki işlemleri. İki mod:
//  - bulut: Supabase (gerçek kullanım; tüm cihazlar aynı veriyi görür, giriş gerekir)
//  - yerel: tarayıcı hafızası (deneme; giriş yok, herkes düzenleyici sayılır)
// Sayfalar yalnız buradaki işlemleri çağırır; hangi modda olduğumuzu bilmeleri gerekmez.
(function (kok) {
  var A = kok.AYAR || {};
  var yerelIstendi = /[?&]yerel=1/.test(kok.location.search);
  var BULUT = !yerelIstendi && !!(A.supabaseUrl && A.supabaseKey && kok.supabase);
  var dinleyiciler = [];
  var son = Depo.bos(); // en son yüklenen veri (doğrulama için)

  function yay(d) { son = d; dinleyiciler.forEach(function (cb) { cb(d); }); }
  function kopya(d) { return JSON.parse(JSON.stringify(d)); }
  var ROL_ADI = { duzenleyici: 'Düzenleyici', revizeci: 'Revize veren', calisan: 'Çalışan' };

  // ======================= YEREL MOD =======================
  function yerel() {
    var ANAHTAR = 'kitabim-hangi-rafta:v1';
    var REVIZE = 'kitabim-hangi-rafta:revizeler';
    var ARAMA = 'kitabim-hangi-rafta:aramalar';
    var TALEP = 'kitabim-hangi-rafta:talepler';
    var GECMIS = 'kitabim-hangi-rafta:gecmis';
    function gecmisYaz(o) {
      if (!o) return;
      try {
        var m = /[?&]rol=(duzenleyici|revizeci|calisan)/.exec(kok.location.search);
        var l = JSON.parse(kok.localStorage.getItem(GECMIS) || '[]');
        l.unshift({ zaman: new Date().toISOString(), kim_ad: 'Deneme modu · ' + ROL_ADI[m ? m[1] : 'duzenleyici'], islem: o.islem, konu: o.konu, ayrinti: o.ayrinti });
        kok.localStorage.setItem(GECMIS, JSON.stringify(l.slice(0, 1000)));
      } catch (e) { /* geçmiş tutulamazsa işlem yine yapılır */ }
    }
    var AYAR_ADI = { fiyat: 'fiyat alanı', stok: 'stok alanı', magazaAdi: 'mağaza adı', renk: 'ana renk', logo: 'logo', karsilama: 'karşılama yazısı', plan: 'mağaza haritası' };
    function talepOku() { try { return JSON.parse(kok.localStorage.getItem(TALEP)) || []; } catch (e) { return []; } }
    function talepYaz(l) { kok.localStorage.setItem(TALEP, JSON.stringify(l)); return Promise.resolve(); }
    function oku() {
      try { return Depo.duzelt(JSON.parse(kok.localStorage.getItem(ANAHTAR))); } catch (e) { return Depo.bos(); }
    }
    function degistir(fn) {
      return new Promise(function (coz) {
        var d = oku();
        var sonuc = fn(d);
        kok.localStorage.setItem(ANAHTAR, JSON.stringify(d));
        yay(d);
        coz(sonuc);
      });
    }
    function revizeOku() {
      try { return JSON.parse(kok.localStorage.getItem(REVIZE)) || []; } catch (e) { return []; }
    }
    function revizeYaz(l) { kok.localStorage.setItem(REVIZE, JSON.stringify(l)); return Promise.resolve(); }
    kok.addEventListener('storage', function (e) { if (e.key === ANAHTAR) yay(oku()); });

    return {
      yukle: function () { var d = oku(); son = d; return Promise.resolve(d); },
      rafEkle: function (etiket, n) {
        return degistir(function (d) {
          var r = Depo.rafEkle(d, etiket, n);
          gecmisYaz({ islem: 'ekledi', konu: 'raf', ayrinti: r.no + '. Raf' + (r.etiket ? ' · ' + r.etiket : '') + ' (' + r.bolmeler.length + ' bölme)' });
          return r;
        });
      },
      rafGuncelle: function (id, etiket) {
        return degistir(function (d) { var r = Depo.rafGuncelle(d, id, { etiket: etiket }); gecmisYaz({ islem: 'guncelledi', konu: 'raf', ayrinti: r.no + '. Raf etiketi: “' + r.etiket + '”' }); });
      },
      rafSil: function (id) {
        return degistir(function (d) { var r = d.raflar.find(function (x) { return x.id === id; }); Depo.rafSil(d, id); gecmisYaz({ islem: 'sildi', konu: 'raf', ayrinti: (r ? r.no : '?') + '. Raf' }); });
      },
      bolmeEkle: function (rafId) {
        return degistir(function (d) { var b = Depo.bolmeEkle(d, rafId); gecmisYaz({ islem: 'ekledi', konu: 'bolme', ayrinti: 'Bölme ' + Depo.konum(d, b.id).kod }); return b; });
      },
      bolmeSil: function (id) {
        return degistir(function (d) { var y = Depo.konum(d, id); Depo.bolmeSil(d, id); gecmisYaz({ islem: 'sildi', konu: 'bolme', ayrinti: 'Bölme ' + (y ? y.kod : '?') }); });
      },
      kitapKaydet: function (g, izin) {
        return degistir(function (d) {
          var onceki = g.id ? JSON.parse(JSON.stringify(d.kitaplar.find(function (k) { return k.id === g.id; }) || null)) : null;
          var k = Depo.kitapKaydet(d, g, { ayniBarkodaIzin: izin });
          try { if (kok.Gecmis) gecmisYaz(kok.Gecmis.kitapOlayi(d, onceki, k)); } catch (e) { /* geçmiş işlemi engellemez */ }
          return k;
        });
      },
      kitapSil: function (id) {
        return degistir(function (d) {
          var onceki = d.kitaplar.find(function (k) { return k.id === id; });
          try { if (onceki && kok.Gecmis) gecmisYaz(kok.Gecmis.kitapOlayi(d, onceki, null)); } catch (e) { /* geçmiş işlemi engellemez */ }
          Depo.kitapSil(d, id);
        });
      },
      ayarKaydet: function (alan, deger) {
        return degistir(function (d) {
          var g = {}; g[alan] = deger;
          var temiz = Depo.duzelt({ ayarlar: Object.assign({}, d.ayarlar, g) }).ayarlar;
          if (alan === 'fiyat' || alan === 'stok') temiz[alan] = !!deger;
          d.ayarlar[alan] = temiz[alan];
          gecmisYaz({ islem: 'guncelledi', konu: 'ayar', ayrinti: (AYAR_ADI[alan] || alan) + (alan === 'fiyat' || alan === 'stok' ? (deger ? ' açıldı' : ' kapatıldı') : '') });
        });
      },
      okulListesiKaydet: function (g) {
        return degistir(function (d) { var l = Depo.okulListesiKaydet(d, g); gecmisYaz({ islem: g.id ? 'guncelledi' : 'ekledi', konu: 'liste', ayrinti: l.okul + ' · ' + l.sinif + ' (' + l.kalemler.length + ' kitap)' }); return l; });
      },
      okulListesiSil: function (id) {
        return degistir(function (d) { var l = d.okulListeleri.find(function (x) { return x.id === id; }); Depo.okulListesiSil(d, id); gecmisYaz({ islem: 'sildi', konu: 'liste', ayrinti: l ? l.okul + ' · ' + l.sinif : '' }); });
      },
      gecmis: function () { try { return Promise.resolve(JSON.parse(kok.localStorage.getItem(GECMIS) || '[]')); } catch (e) { return Promise.resolve([]); } },
      topluKitapEkle: function (liste) {
        return degistir(function (d) {
          liste.forEach(function (g) { Depo.kitapKaydet(d, g, { ayniBarkodaIzin: true }); });
          gecmisYaz({ islem: 'yukledi', konu: 'kitap', ayrinti: 'Excel\'den ' + liste.length + ' kitap' });
          return liste.length;
        });
      },
      aramaKaydet: function (sorgu, sonuc) {
        try {
          var l = JSON.parse(kok.localStorage.getItem(ARAMA) || '[]');
          l.push({ sorgu: String(sorgu).trim().slice(0, 100), sonuc: sonuc, zaman: new Date().toISOString() });
          kok.localStorage.setItem(ARAMA, JSON.stringify(l.slice(-2000)));
        } catch (e) { /* kayıt tutulamazsa arama yine çalışır */ }
        return Promise.resolve();
      },
      aramalar: function (gun) {
        var sinir = new Date(Date.now() - (gun || 30) * 864e5).toISOString();
        try { return Promise.resolve(JSON.parse(kok.localStorage.getItem(ARAMA) || '[]').filter(function (a) { return a.zaman >= sinir; })); }
        catch (e) { return Promise.resolve([]); }
      },
      yerineKoy: function (ham) { return degistir(function (d) { var y = Depo.duzelt(ham); d.raflar = y.raflar; d.kitaplar = y.kitaplar; d.okulListeleri = y.okulListeleri; d.ayarlar = y.ayarlar; }); },

      // Deneme modunda başka bir yetkinin ekranını görmek için: yonetim.html?yerel=1&rol=calisan
      oturum: function () {
        var m = /[?&]rol=(duzenleyici|revizeci|calisan)/.exec(kok.location.search);
        return Promise.resolve({ id: 'yerel', ad: 'Deneme modu', eposta: '', rol: m ? m[1] : 'duzenleyici' });
      },
      kurulumGerekli: function () { return Promise.resolve(false); },
      girisYap: function () { return Promise.resolve(); },
      ilkKurulum: function () { return Promise.resolve(); },
      cikis: function () { return Promise.resolve(); },

      uyeler: function () { return Promise.resolve([]); },
      uyeEkle: function () { return Promise.reject(new Error('Kullanıcılar yalnız bulut modunda yönetilir.')); },
      uyeRol: function () { return Promise.reject(new Error('Bulut modu gerekli.')); },
      uyeSifre: function () { return Promise.reject(new Error('Bulut modu gerekli.')); },
      uyeKaldir: function () { return Promise.reject(new Error('Bulut modu gerekli.')); },

      talepEkle: function (g) {
        var t = Depo.talepDogrula(g);
        t.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        t.durum = 'yeni';
        t.olusturuldu = new Date().toISOString();
        var l = talepOku(); l.unshift(t);
        return talepYaz(l).then(function () { return t; });
      },
      talepler: function () { return Promise.resolve(talepOku()); },
      talepDurum: function (id, durum) { return talepYaz(talepOku().map(function (t) { return t.id === id ? Object.assign({}, t, { durum: durum }) : t; })); },
      talepSil: function (ids) { ids = [].concat(ids); return talepYaz(talepOku().filter(function (t) { return ids.indexOf(t.id) < 0; })); },

      revizeler: function () { return Promise.resolve(revizeOku()); },
      revizeEkle: function (metin) {
        metin = String(metin || '').trim();
        if (!metin) return Promise.reject(new Error('Revize boş olamaz.'));
        var l = revizeOku();
        l.unshift({ id: Date.now().toString(36), yazan_ad: 'Deneme modu', metin: metin, durum: 'yeni', olusturuldu: new Date().toISOString() });
        return revizeYaz(l);
      },
      revizeDurum: function (id, durum) { return revizeYaz(revizeOku().map(function (r) { return r.id === id ? Object.assign({}, r, { durum: durum }) : r; })); },
      revizeSil: function (id) { return revizeYaz(revizeOku().filter(function (r) { return r.id !== id; })); }
    };
  }

  // ======================= BULUT MODU =======================
  function bulut() {
    var sb = kok.supabase.createClient(A.supabaseUrl, A.supabaseKey);
    var benimRol = null;

    function kontrol(sonuc) {
      if (sonuc.error) {
        var m = sonuc.error.message || '';
        if (/Failed to fetch|NetworkError|Load failed/i.test(m)) throw new Error('Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.');
        if (sonuc.error.code === '42P01' || /does not exist|schema cache/i.test(m)) throw new Error('Veritabanı henüz kurulmamış (supabase/kurulum.sql).');
        if (/row-level security|permission denied/i.test(m)) throw new Error('Bu işlem için yetkiniz yok.');
        if (/kirtasiye_kitaplar_bolme_id_fkey|violates foreign key/i.test(m)) throw new Error('Bu bölmede kitap var. Önce kitapları taşıyın.');
        if (/duplicate key/i.test(m)) throw new Error('Aynı numara başka bir cihazdan az önce kullanıldı. Tekrar deneyin.');
        throw new Error(m || 'Bağlantı hatası.');
      }
      return sonuc.data;
    }

    function hepsi(tablo, sutunlar, sira) {
      var sayfa = 1000, liste = [];
      function al(bas) {
        return sb.from(tablo).select(sutunlar).order(sira).range(bas, bas + sayfa - 1).then(function (s) {
          var v = kontrol(s);
          liste = liste.concat(v);
          return v.length === sayfa ? al(bas + sayfa) : liste;
        });
      }
      return al(0);
    }

    function yukle() {
      return Promise.all([
        hepsi('kirtasiye_raflar', 'id,no,etiket', 'no'),
        hepsi('kirtasiye_bolmeler', 'id,raf_id,no', 'no'),
        hepsi('kirtasiye_kitaplar', 'id,ad,yazar,yayinevi,barkod,bolme_id,fiyat,stok,kapak,eklendi', 'ad'),
        sb.from('kirtasiye_ayarlar').select('fiyat,stok,magaza_adi,renk,logo,karsilama,plan').eq('id', 1).maybeSingle().then(kontrol),
        hepsi('kirtasiye_okul_listeleri', 'id,okul,sinif,kalemler', 'okul')
      ]).then(function (s) {
        var d = Depo.bos();
        d.raflar = s[0].map(function (r) {
          return { id: r.id, no: r.no, etiket: r.etiket, bolmeler: s[1].filter(function (b) { return b.raf_id === r.id; }).map(function (b) { return { id: b.id, no: b.no }; }) };
        });
        d.kitaplar = s[2].map(function (k) {
          return { id: k.id, ad: k.ad, yazar: k.yazar, yayinevi: k.yayinevi, barkod: k.barkod, bolmeId: k.bolme_id,
            fiyat: k.fiyat == null ? null : Number(k.fiyat), stok: k.stok, kapak: k.kapak || '', eklendi: k.eklendi };
        });
        if (s[3]) d.ayarlar = Depo.duzelt({ ayarlar: { fiyat: s[3].fiyat, stok: s[3].stok, magazaAdi: s[3].magaza_adi || '', renk: s[3].renk, logo: s[3].logo, karsilama: s[3].karsilama, plan: s[3].plan } }).ayarlar;
        d.okulListeleri = s[4].map(function (l) { return { id: l.id, okul: l.okul, sinif: l.sinif, kalemler: l.kalemler || [] }; });
        son = d;
        return d;
      });
    }
    function yenile(sonuc) { return yukle().then(function (d) { yay(d); return sonuc; }); }
    function satirYap(k) {
      return { ad: k.ad, yazar: k.yazar, yayinevi: k.yayinevi, barkod: k.barkod, bolme_id: k.bolmeId, fiyat: k.fiyat, stok: k.stok,
        kapak: k.kapak || '', guncellendi: new Date().toISOString() };
    }

    // Başka cihazdaki değişiklikler: kısa bir beklemeyle tümünü yeniden yükle.
    var bekle = null;
    sb.channel('kirtasiye').on('postgres_changes', { event: '*', schema: 'public' }, function (p) {
      if (!/^kirtasiye_(raflar|bolmeler|kitaplar|ayarlar|okul_listeleri)$/.test(p.table)) return;
      clearTimeout(bekle);
      bekle = setTimeout(function () { yukle().then(yay).catch(function () {}); }, 300);
    }).subscribe();

    function fonksiyon(govde) {
      return sb.functions.invoke('kirtasiye-kullanici', { body: govde }).then(function (s) {
        if (!s.error) return s.data;
        var ctx = s.error.context;
        if (ctx && typeof ctx.json === 'function') {
          return ctx.json().then(function (j) { throw new Error((j && j.hata) || 'İşlem yapılamadı.'); },
            function () { throw new Error('Kullanıcı sunucusu kurulmamış ya da ulaşılamıyor.'); });
        }
        throw new Error('Kullanıcı sunucusuna ulaşılamadı.');
      });
    }

    return {
      yukle: yukle,

      rafEkle: function (etiket, n) {
        var r = Depo.rafEkle(kopya(son), etiket, n);
        return sb.from('kirtasiye_raflar').insert({ no: r.no, etiket: r.etiket }).select('id').single().then(kontrol).then(function (y) {
          var bolmeler = r.bolmeler.map(function (b) { return { raf_id: y.id, no: b.no }; });
          return bolmeler.length ? sb.from('kirtasiye_bolmeler').insert(bolmeler).then(kontrol) : null;
        }).then(function () { return yenile(r); });
      },
      rafGuncelle: function (id, etiket) {
        return sb.from('kirtasiye_raflar').update({ etiket: String(etiket || '').trim() }).eq('id', id).then(kontrol).then(function () { return yenile(); });
      },
      rafSil: function (id) {
        Depo.rafSil(kopya(son), id); // dolu raf uyarısı
        return sb.from('kirtasiye_raflar').delete().eq('id', id).then(kontrol).then(function () { return yenile(); });
      },
      bolmeEkle: function (rafId) {
        var b = Depo.bolmeEkle(kopya(son), rafId);
        return sb.from('kirtasiye_bolmeler').insert({ raf_id: rafId, no: b.no }).select('id,no').single().then(kontrol).then(function (y) { return yenile(y); });
      },
      bolmeSil: function (id) {
        Depo.bolmeSil(kopya(son), id);
        return sb.from('kirtasiye_bolmeler').delete().eq('id', id).then(kontrol).then(function () { return yenile(); });
      },
      kitapKaydet: function (g, izin) {
        var yeni = !g.id;
        var k = Depo.kitapKaydet(kopya(son), g, { ayniBarkodaIzin: izin }); // doğrulama + düzeltme
        var satir = satirYap(k);
        var istek = yeni
          ? sb.from('kirtasiye_kitaplar').insert(satir).select('id').single()
          : sb.from('kirtasiye_kitaplar').update(satir).eq('id', g.id).select('id').single();
        return istek.then(kontrol).then(function (y) { k.id = y.id; return yenile(k); });
      },
      kitapSil: function (id) {
        return sb.from('kirtasiye_kitaplar').delete().eq('id', id).then(kontrol).then(function () { return yenile(); });
      },
      okulListesiKaydet: function (g) {
        var k = Depo.okulListesiKaydet(kopya(son), g);
        var satir = { okul: k.okul, sinif: k.sinif, kalemler: k.kalemler };
        var istek = g.id
          ? sb.from('kirtasiye_okul_listeleri').update(satir).eq('id', g.id).select('id').single()
          : sb.from('kirtasiye_okul_listeleri').insert(satir).select('id').single();
        return istek.then(kontrol).then(function (y) { k.id = y.id; return yenile(k); });
      },
      okulListesiSil: function (id) {
        return sb.from('kirtasiye_okul_listeleri').delete().eq('id', id).then(kontrol).then(function () { return yenile(); });
      },
      topluKitapEkle: function (liste) {
        var satirlar = liste.map(function (g) { return satirYap(Depo.kitapKaydet(kopya(son), g, { ayniBarkodaIzin: true })); });
        var parcalar = [];
        for (var i = 0; i < satirlar.length; i += 500) parcalar.push(satirlar.slice(i, i + 500));
        return parcalar.reduce(function (p, parca) {
          return p.then(function () { return sb.from('kirtasiye_kitaplar').insert(parca).then(kontrol); });
        }, Promise.resolve()).then(function () { return yenile(liste.length); });
      },
      aramaKaydet: function (sorgu, sonuc) {
        return sb.from('kirtasiye_aramalar').insert({ sorgu: String(sorgu).trim().slice(0, 100), sonuc: sonuc }).then(function () {}, function () {});
      },
      aramalar: function (gun) {
        var sinir = new Date(Date.now() - (gun || 30) * 864e5).toISOString();
        return sb.from('kirtasiye_aramalar').select('sorgu,sonuc,zaman').gte('zaman', sinir).order('zaman', { ascending: false }).limit(5000).then(kontrol);
      },
      ayarKaydet: function (alan, deger) {
        var g = {}, sutun = { magazaAdi: 'magaza_adi', renk: 'renk', logo: 'logo', karsilama: 'karsilama', plan: 'plan' };
        if (sutun[alan]) {
          var o = {}; o[alan] = deger;
          g[sutun[alan]] = Depo.duzelt({ ayarlar: o }).ayarlar[alan];
          if (alan === 'magazaAdi') g.magaza_adi = String(deger || '').trim().slice(0, 60);
        } else g[alan] = !!deger;
        return sb.from('kirtasiye_ayarlar').update(g).eq('id', 1).then(kontrol).then(function () { return yenile(); });
      },
      yerineKoy: function () { return Promise.reject(new Error('Bulut modunda yedekten geri yükleme yok.')); },

      oturum: function () {
        return sb.auth.getSession().then(function (s) {
          var u = s.data.session && s.data.session.user;
          if (!u) { benimRol = null; return null; }
          return sb.from('kirtasiye_uyeler').select('ad,eposta,rol').eq('user_id', u.id).maybeSingle().then(function (r) {
            var uye = r.data;
            benimRol = uye ? uye.rol : null;
            return { id: u.id, ad: uye ? uye.ad : '', eposta: u.email, rol: benimRol };
          });
        });
      },
      kurulumGerekli: function () {
        return fonksiyon({ islem: 'durum' }).then(function (d) { return !!d.kurulumGerekli; }).catch(function () { return false; });
      },
      girisYap: function (eposta, sifre) {
        return sb.auth.signInWithPassword({ email: String(eposta).trim(), password: sifre }).then(function (s) {
          if (s.error) throw new Error(/invalid/i.test(s.error.message) ? 'E-posta ya da şifre hatalı.' : s.error.message);
        });
      },
      ilkKurulum: function (ad, eposta, sifre) {
        return fonksiyon({ islem: 'ilk-kurulum', ad: ad, eposta: eposta, sifre: sifre });
      },
      cikis: function () { return sb.auth.signOut(); },

      uyeler: function () {
        return sb.from('kirtasiye_uyeler').select('user_id,ad,eposta,rol,kirtasiye_hesabi,eklendi').order('eklendi').then(kontrol);
      },
      uyeEkle: function (u) { return fonksiyon(Object.assign({ islem: 'ekle' }, u)); },
      uyeRol: function (id, rol) { return fonksiyon({ islem: 'rol', user_id: id, rol: rol }); },
      uyeSifre: function (id, sifre) { return fonksiyon({ islem: 'sifre', user_id: id, sifre: sifre }); },
      uyeKaldir: function (id) { return fonksiyon({ islem: 'kaldir', user_id: id }); },

      gecmis: function () {
        return sb.from('kirtasiye_gecmis').select('zaman,kim_ad,islem,konu,ayrinti').order('zaman', { ascending: false }).limit(500).then(kontrol);
      },
      talepEkle: function (g) {
        var t = Depo.talepDogrula(g);
        return sb.from('kirtasiye_talepler').insert({ kitap: t.kitap, kitap_id: t.kitapId, ad: t.ad, telefon: t.telefon, notu: t.not, onay: true })
          .then(kontrol).then(function () { return t; });
      },
      talepler: function () {
        return sb.from('kirtasiye_talepler').select('id,kitap,kitap_id,ad,telefon,notu,durum,olusturuldu').order('olusturuldu', { ascending: false }).limit(1000).then(kontrol)
          .then(function (l) { return l.map(function (t) { return { id: t.id, kitap: t.kitap, kitapId: t.kitap_id, ad: t.ad, telefon: t.telefon, not: t.notu, durum: t.durum, olusturuldu: t.olusturuldu }; }); });
      },
      talepDurum: function (id, durum) { return sb.from('kirtasiye_talepler').update({ durum: durum }).eq('id', id).then(kontrol); },
      talepSil: function (ids) { return sb.from('kirtasiye_talepler').delete().in('id', [].concat(ids)).then(kontrol); },

      revizeler: function () {
        return sb.from('kirtasiye_revizeler').select('id,yazan_ad,metin,durum,olusturuldu').order('olusturuldu', { ascending: false }).then(kontrol);
      },
      revizeEkle: function (metin, yazanAd) {
        metin = String(metin || '').trim();
        if (!metin) return Promise.reject(new Error('Revize boş olamaz.'));
        return sb.auth.getUser().then(function (u) {
          return sb.from('kirtasiye_revizeler').insert({ metin: metin, yazan_ad: yazanAd || '', yazan: u.data.user.id }).then(kontrol);
        });
      },
      revizeDurum: function (id, durum) { return sb.from('kirtasiye_revizeler').update({ durum: durum }).eq('id', id).then(kontrol); },
      revizeSil: function (id) { return sb.from('kirtasiye_revizeler').delete().eq('id', id).then(kontrol); }
    };
  }

  var V = BULUT ? bulut() : yerel();
  V.mod = BULUT ? 'bulut' : 'yerel';
  V.ROL_ADI = ROL_ADI;
  V.dinle = function (cb) { dinleyiciler.push(cb); };
  kok.Veri = V;
})(window);
