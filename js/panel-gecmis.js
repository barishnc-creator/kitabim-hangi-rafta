// Yönetim paneli: İşlem geçmişi (kim, ne zaman, ne yaptı).
(function () {
  var P = window.Panel, O = Ortak;
  var $ = function (id) { return document.getElementById(id); };
  var son = [];
  var RENK = {
    ekledi: ['#DCFCE7', '#166534', 'arti'], tasidi: ['#DBEAFE', '#1D4ED8', 'ok'], guncelledi: ['#FEF3C7', '#92400E', 'kalem'],
    sildi: ['#FEE2E2', '#991B1B', 'cop'], yukledi: ['#EDE9FE', '#5B21B6', 'yukle']
  };
  var KONU_ADI = { kitap: '', raf: '', bolme: '', liste: 'okul listesi ', ayar: 'ayar: ' };

  function gunAdi(t) {
    var g = new Date(t), bugun = new Date(), dun = new Date(Date.now() - 864e5);
    if (g.toDateString() === bugun.toDateString()) return 'Bugün';
    if (g.toDateString() === dun.toDateString()) return 'Dün';
    return g.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  }

  function ciz() {
    var ara = Arama.sadelestir($('gecmis-ara').value), kim = $('gecmis-kim').value, konu = $('gecmis-konu').value;
    var liste = son.filter(function (g) {
      if (kim && g.kim_ad !== kim) return false;
      if (konu && !(g.konu === konu || (konu === 'raf' && g.konu === 'bolme'))) return false;
      return !ara || Arama.sadelestir(g.kim_ad + ' ' + g.ayrinti).indexOf(ara) >= 0;
    });
    var html = '', gun = '';
    liste.forEach(function (g) {
      var gAd = gunAdi(g.zaman);
      if (gAd !== gun) { gun = gAd; html += '<li class="gun">' + O.kacis(gAd) + '</li>'; }
      var r = RENK[g.islem] || RENK.guncelledi;
      html += '<li><span class="ikon-kutu" style="background:' + r[0] + ';color:' + r[1] + '">' + O.ikon[r[2]] + '</span>' +
        '<span><b>' + O.kacis(g.kim_ad || 'Bilinmeyen') + '</b> ' + O.kacis(KONU_ADI[g.konu] || '') + O.kacis(g.ayrinti) + ' ' + O.kacis(Gecmis.ISLEM[g.islem] || g.islem) + '</span>' +
        '<span class="soluk" style="white-space:nowrap">' + new Date(g.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + '</span></li>';
    });
    $('gecmis-liste').innerHTML = html || '<li class="bos-not" style="display:block">' + (son.length ? 'Bu filtrede kayıt yok.' : 'Henüz işlem yok. Kitap, raf ya da ayar değiştikçe burada listelenir.') + '</li>';
  }

  function yukle() {
    return Veri.gecmis().then(function (l) {
      son = l;
      var secili = $('gecmis-kim').value, kisiler = {};
      l.forEach(function (g) { if (g.kim_ad) kisiler[g.kim_ad] = 1; });
      $('gecmis-kim').innerHTML = '<option value="">Herkes</option>' + Object.keys(kisiler).sort().map(function (k) {
        return '<option' + (k === secili ? ' selected' : '') + '>' + O.kacis(k) + '</option>';
      }).join('');
      ciz();
    }).catch(function (e) { $('gecmis-liste').innerHTML = '<li><div class="mesaj hata">' + O.kacis(e.message) + '</div></li>'; });
  }

  ['gecmis-ara', 'gecmis-kim', 'gecmis-konu'].forEach(function (id) { $(id).addEventListener(id === 'gecmis-ara' ? 'input' : 'change', ciz); });
  P.sekmeEkle('gecmis', 'İşlem geçmişi', yukle);
})();
