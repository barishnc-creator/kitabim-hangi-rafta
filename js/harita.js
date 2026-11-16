// Mağaza haritası: "Buradasınız" noktasından hedef rafa yol ve haritanın çizimi.
// Tarayıcıda window.Harita, Node'da module.exports.
(function (kok) {
  // Yolu iki dik parçayla çizer: önce koridor boyunca, sonra rafın önüne.
  // Hedef: rafın kiosk tarafındaki kenarının ortası, biraz dışarıda.
  function yol(kiosk, raf) {
    if (!kiosk || !raf) return null;
    var cx = raf.x + raf.w / 2, cy = raf.y + raf.h / 2, pay = 2.5;
    var kenarlar = [
      { x: cx, y: raf.y + raf.h + pay, dikey: true },   // alt
      { x: cx, y: raf.y - pay, dikey: true },           // üst
      { x: raf.x - pay, y: cy, dikey: false },          // sol
      { x: raf.x + raf.w + pay, y: cy, dikey: false }   // sağ
    ].map(function (k) { k.x = Math.max(0, Math.min(100, k.x)); k.y = Math.max(0, Math.min(100, k.y)); return k; });
    var hedef = kenarlar.reduce(function (en, k) {
      var u = Math.abs(k.x - kiosk.x) + Math.abs(k.y - kiosk.y);
      return !en || u < en.u ? { k: k, u: u } : en;
    }, null).k;
    var ara = hedef.dikey ? [kiosk.x, hedef.y] : [hedef.x, kiosk.y];
    return [[kiosk.x, kiosk.y], ara, [hedef.x, hedef.y]];
  }

  function yerlesmemis(plan, raflar) {
    return raflar.filter(function (r) { return !(plan && plan.raflar && plan.raflar[r.id]); });
  }

  // Üst üste binen öğe çiftleri: [{a, b}] (adlarla). Kenar teması sayılmaz.
  function cakismalar(plan, raflar) {
    var l = [];
    raflar.forEach(function (r) { if (plan.raflar[r.id]) l.push({ ad: r.no + '. Raf', k: plan.raflar[r.id] }); });
    plan.nesneler.forEach(function (n) { l.push({ ad: n.tur === 'kasa' ? 'Kasa' : 'Giriş', k: n }); });
    var sonuc = [];
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var a = l[i].k, b = l[j].k;
      if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) sonuc.push({ a: l[i].ad, b: l[j].ad });
    }
    return sonuc;
  }

  function haritaVar(plan) { return !!(plan && plan.raflar && Object.keys(plan.raflar).length); }

  function kacis(m) { return String(m == null ? '' : m).replace(/[&<>"']/g, function (h) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[h]; }); }

  // Müşteri ekranı için salt-okunur harita HTML'i. hedefRafId verilirse yol çizilir.
  function ciz(plan, raflar, hedefRafId) {
    var html = '<div class="plan" role="img" aria-label="Mağaza haritası">';
    raflar.forEach(function (r) {
      var k = plan.raflar[r.id];
      if (!k) return;
      html += '<div class="raf-blok' + (r.id === hedefRafId ? ' hedef' : '') + '" style="left:' + k.x + '%;top:' + k.y + '%;width:' + k.w + '%;height:' + k.h + '%">' +
        r.no + '. Raf' + (r.etiket ? '<small>' + kacis(r.etiket) + '</small>' : '') + '</div>';
    });
    plan.nesneler.forEach(function (n) {
      html += '<div class="ozel ' + n.tur + '" style="left:' + n.x + '%;top:' + n.y + '%;width:' + n.w + '%;height:' + n.h + '%">' + (n.tur === 'kasa' ? 'Kasa' : 'Giriş') + '</div>';
    });
    var y = hedefRafId && yol(plan.kiosk, plan.raflar[hedefRafId]);
    if (y) {
      html += '<svg class="yol" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' +
        y.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' +
        '<span class="yol-uc" style="left:' + y[2][0] + '%;top:' + y[2][1] + '%"></span>';
    }
    if (plan.kiosk) html += '<div class="siz" style="left:' + plan.kiosk.x + '%;top:' + plan.kiosk.y + '%"><span>Buradasınız</span><i></i></div>';
    return html + '</div>';
  }

  var api = { yol: yol, yerlesmemis: yerlesmemis, cakismalar: cakismalar, haritaVar: haritaVar, ciz: ciz };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Harita = api;
})(this);
