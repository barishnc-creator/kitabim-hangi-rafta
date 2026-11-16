// İşlem geçmişi: kitap değişikliklerini okunur kayıtlara çevirir (deneme modunda kullanılır;
// bulutta aynı kayıtları veritabanı tetikleyicisi üretir). Tarayıcıda window.Gecmis, Node'da module.exports.
(function (kok) {
  // Depo, çağrı anında bulunur (dosya sırasına bağımlı kalmasın).
  function depo() { return kok.Depo || (typeof require === 'function' ? require('./depo.js') : null); }
  var ALANLAR = { ad: 'ad', yazar: 'yazar', yayinevi: 'yayınevi', barkod: 'barkod', fiyat: 'fiyat', stok: 'stok', kapak: 'kapak' };

  function kod(d, bolmeId) { var y = depo().konum(d, bolmeId); return y ? y.kod : '?'; }

  // onceki: değişiklikten önceki kitap (yoksa null), yeni: kaydedilen kitap (silindiyse null).
  function kitapOlayi(d, onceki, yeni) {
    if (!onceki && yeni) return { islem: 'ekledi', konu: 'kitap', ayrinti: '“' + yeni.ad + '” → ' + kod(d, yeni.bolmeId) };
    if (onceki && !yeni) return { islem: 'sildi', konu: 'kitap', ayrinti: '“' + onceki.ad + '” (' + kod(d, onceki.bolmeId) + ')' };
    if (onceki.bolmeId !== yeni.bolmeId) return { islem: 'tasidi', konu: 'kitap', ayrinti: '“' + yeni.ad + '” ' + kod(d, onceki.bolmeId) + ' → ' + kod(d, yeni.bolmeId) };
    var degisen = Object.keys(ALANLAR).filter(function (a) { return String(onceki[a] == null ? '' : onceki[a]) !== String(yeni[a] == null ? '' : yeni[a]); });
    if (!degisen.length) return null;
    return { islem: 'guncelledi', konu: 'kitap', ayrinti: '“' + yeni.ad + '” (' + degisen.map(function (a) { return ALANLAR[a]; }).join(', ') + ')' };
  }

  var ISLEM = { ekledi: 'ekledi', guncelledi: 'güncelledi', tasidi: 'taşıdı', sildi: 'sildi', yukledi: 'yükledi' };
  var api = { kitapOlayi: kitapOlayi, ISLEM: ISLEM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Gecmis = api;
})(this);
