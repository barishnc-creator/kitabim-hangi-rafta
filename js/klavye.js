// Dokunmatik kiosk için Türkçe ekran klavyesi (Q düzeni).
// Klavye.ac(input, { araBas: fn }) / Klavye.kapat(). Yazılan harf input'a eklenir ve 'input' olayı tetiklenir.
(function (kok) {
  var SATIRLAR = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç', '.']
  ];
  var kutu = null, hedef = null, ayar = {};

  function yaz(metin) {
    if (!hedef) return;
    var bas = hedef.selectionStart == null ? hedef.value.length : hedef.selectionStart;
    var son = hedef.selectionEnd == null ? hedef.value.length : hedef.selectionEnd;
    hedef.value = hedef.value.slice(0, bas) + metin + hedef.value.slice(son);
    try { hedef.setSelectionRange(bas + metin.length, bas + metin.length); } catch (e) { /* bazı türlerde desteklenmez */ }
    hedef.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function sil() {
    if (!hedef || !hedef.value) return;
    var bas = hedef.selectionStart == null ? hedef.value.length : hedef.selectionStart;
    var son = hedef.selectionEnd == null ? hedef.value.length : hedef.selectionEnd;
    if (bas === son && bas > 0) bas--;
    hedef.value = hedef.value.slice(0, bas) + hedef.value.slice(son);
    try { hedef.setSelectionRange(bas, bas); } catch (e) { /* yok say */ }
    hedef.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function kur() {
    kutu = document.createElement('div');
    kutu.className = 'klavye';
    kutu.setAttribute('role', 'group');
    kutu.setAttribute('aria-label', 'Ekran klavyesi');
    var html = SATIRLAR.map(function (satir) {
      return '<div class="klavye-satir">' + satir.map(function (h) {
        return '<button type="button" data-tus="' + h + '">' + h.toLocaleUpperCase('tr-TR') + '</button>';
      }).join('') + '</div>';
    }).join('');
    html += '<div class="klavye-satir">' +
      '<button type="button" class="orta" data-islem="kapat">Klavyeyi gizle</button>' +
      '<button type="button" class="genis" data-tus=" ">Boşluk</button>' +
      '<button type="button" class="orta" data-islem="sil" aria-label="Son harfi sil">⌫ Sil</button>' +
      '<button type="button" class="orta ana" data-islem="ara" id="klavye-onay">Ara</button></div>';
    kutu.innerHTML = html;
    // Odak input'ta kalsın diye mousedown'da varsayılanı engelle.
    kutu.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
    kutu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var tus = b.getAttribute('data-tus'), islem = b.getAttribute('data-islem');
      if (tus != null) yaz(tus);
      else if (islem === 'sil') sil();
      else if (islem === 'kapat') kapat();
      else if (islem === 'ara') { kapat(); if (ayar.araBas) ayar.araBas(); }
    });
    document.body.appendChild(kutu);
  }

  function ac(input, secenek) {
    hedef = input;
    ayar = secenek || {};
    if (!kutu) kur();
    kutu.querySelector('#klavye-onay').textContent = ayar.onayYazi || 'Ara';
    kutu.hidden = false;
    document.body.classList.add('klavye-acik');
  }
  function kapat() {
    if (kutu) kutu.hidden = true;
    document.body.classList.remove('klavye-acik');
  }
  function acikMi() { return !!kutu && !kutu.hidden; }

  kok.Klavye = { ac: ac, kapat: kapat, acikMi: acikMi };
})(window);
