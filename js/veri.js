// Verinin saklandığı yer. Şimdilik tarayıcının kendi hafızası (localStorage):
// veriler yalnız bu cihazda durur. Bulut (Supabase) bağlanınca aynı arayüz
// korunacak, sayfalar değişmeyecek.
(function (kok) {
  var ANAHTAR = 'kitabim-hangi-rafta:v1';
  var dinleyiciler = [];

  function oku() {
    try {
      var ham = kok.localStorage.getItem(ANAHTAR);
      return Depo.duzelt(ham ? JSON.parse(ham) : null);
    } catch (e) {
      return Depo.bos();
    }
  }

  function yaz(d) {
    kok.localStorage.setItem(ANAHTAR, JSON.stringify(d));
  }

  var Veri = {
    mod: 'yerel',

    yukle: function () {
      return Promise.resolve(oku());
    },

    // fn güncel veriyi değiştirir; hata atarsa hiçbir şey kaydedilmez.
    degistir: function (fn) {
      return new Promise(function (coz) {
        var d = oku();
        var sonuc = fn(d);
        yaz(d);
        dinleyiciler.forEach(function (cb) { cb(d); });
        coz(sonuc);
      });
    },

    // Tümünü değiştir (yedekten yükleme).
    yerineKoy: function (ham) {
      var d = Depo.duzelt(ham);
      yaz(d);
      dinleyiciler.forEach(function (cb) { cb(d); });
      return Promise.resolve(d);
    },

    // Başka sekmede/pencerede yapılan değişikliklerde de çağrılır.
    dinle: function (cb) {
      dinleyiciler.push(cb);
    }
  };

  kok.addEventListener('storage', function (e) {
    if (e.key !== ANAHTAR) return;
    var d = oku();
    dinleyiciler.forEach(function (cb) { cb(d); });
  });

  kok.Veri = Veri;
})(window);
