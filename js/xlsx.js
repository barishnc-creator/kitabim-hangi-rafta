// Excel (.xlsx) okuma ve yazma, dış kütüphane olmadan.
// .xlsx bir zip arşividir: okurken tarayıcının DecompressionStream'i ile açılır,
// yazarken sıkıştırmasız (stored) zip üretilir; Excel ikisini de sorunsuz açar.
// Xlsx.oku(ArrayBuffer) → Promise<{ sayfa, satirlar: [[metin, ...], ...] }> (ilk sayfa)
// Xlsx.yaz(satirlar, { sayfa, genislikler, kalinBaslik }) → Uint8Array
// Tarayıcıda window.Xlsx, Node'da module.exports (Node 18+).
(function (kok) {
  // ---------- zip okuma ----------
  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

  function zipIcerik(bayt) {
    var son = -1;
    for (var i = bayt.length - 22; i >= Math.max(0, bayt.length - 65557); i--) {
      if (u32(bayt, i) === 0x06054b50) { son = i; break; }
    }
    if (son < 0) throw hataYap('Dosya bir Excel (.xlsx) dosyası değil ya da bozuk.');
    var adet = u16(bayt, son + 10), yer = u32(bayt, son + 16), dosyalar = {};
    var cozucu = new TextDecoder('utf-8');
    for (var n = 0; n < adet; n++) {
      if (u32(bayt, yer) !== 0x02014b50) throw hataYap('Excel dosyasının içi okunamadı.');
      var yontem = u16(bayt, yer + 10), boy = u32(bayt, yer + 20);
      var adBoy = u16(bayt, yer + 28), ekBoy = u16(bayt, yer + 30), notBoy = u16(bayt, yer + 32);
      var yerel = u32(bayt, yer + 42);
      var ad = cozucu.decode(bayt.subarray(yer + 46, yer + 46 + adBoy));
      var veri = yerel + 30 + u16(bayt, yerel + 26) + u16(bayt, yerel + 28);
      dosyalar[ad] = { yontem: yontem, veri: bayt.subarray(veri, veri + boy) };
      yer += 46 + adBoy + ekBoy + notBoy;
    }
    return dosyalar;
  }

  function ac(kayit) {
    if (!kayit) return Promise.resolve(null);
    if (kayit.yontem === 0) return Promise.resolve(new TextDecoder('utf-8').decode(kayit.veri));
    if (kayit.yontem !== 8) return Promise.reject(hataYap('Excel dosyası desteklenmeyen biçimde sıkıştırılmış.'));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(hataYap('Bu tarayıcı Excel dosyasını açamıyor. Güncel Chrome, Edge ya da Safari kullanın.'));
    var akis = new Blob([kayit.veri]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(akis).text();
  }

  // ---------- XML yardımcıları (DOMParser yok: Node'da da çalışsın) ----------
  function cozXml(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (_, k) {
      var t = k.toLowerCase();
      if (t === 'amp') return '&'; if (t === 'lt') return '<'; if (t === 'gt') return '>';
      if (t === 'quot') return '"'; if (t === 'apos') return "'";
      return String.fromCodePoint(t[1] === 'x' ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10));
    });
  }
  function ozellik(etiket, ad) {
    var m = new RegExp('\\s' + ad + '="([^"]*)"').exec(etiket);
    return m ? cozXml(m[1]) : null;
  }
  // <si> ya da <is> içindeki metin: düz <t> ve zengin metin <r><t>; okunuş (<rPh>) atlanır.
  function metinTopla(xml) {
    xml = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    var s = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, m;
    while ((m = re.exec(xml))) s += cozXml(m[1]);
    return s;
  }
  function sutunNo(ref) {
    var m = /^([A-Z]+)/.exec(ref || ''), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }
  function sayiMetni(v) {
    // Excel büyük tam sayıları bazen 9.789750719387E+12 biçiminde yazar; barkod bozulmasın.
    if (/e/i.test(v)) { var n = Number(v); if (isFinite(n) && Math.abs(n) < 1e16 && Math.floor(n) === n) return n.toFixed(0); }
    return v;
  }

  function sayfaCoz(xml, ortak) {
    var satirlar = [], reSatir = /<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g, ms, sira = 0;
    while ((ms = reSatir.exec(xml))) {
      var rNo = ms[1] ? Number(ozellik(ms[1], 'r')) : 0;
      var satirIndeks = rNo > 0 ? rNo - 1 : sira;
      sira = satirIndeks + 1;
      if (!ms[2]) continue;
      var satir = [], reHucre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mc, kol = 0;
      while ((mc = reHucre.exec(ms[2]))) {
        var oz = mc[1], ic = mc[2] || '';
        var k = sutunNo(ozellik(oz, 'r'));
        if (k < 0) k = kol;
        kol = k + 1;
        var tur = ozellik(oz, 't') || 'n', deger = '';
        var v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(ic);
        if (tur === 's') deger = v ? (ortak[Number(v[1])] || '') : '';
        else if (tur === 'inlineStr') deger = metinTopla(ic);
        else if (tur === 'b') deger = v ? (v[1] === '1' ? 'DOĞRU' : 'YANLIŞ') : '';
        else if (tur === 'e') deger = '';
        else deger = v ? (tur === 'n' ? sayiMetni(cozXml(v[1]).trim()) : cozXml(v[1])) : '';
        while (satir.length < k) satir.push('');
        satir[k] = deger;
      }
      while (satirlar.length < satirIndeks) satirlar.push([]);
      satirlar[satirIndeks] = satir;
    }
    return satirlar;
  }

  function yolBirlestir(taban, hedef) {
    if (hedef[0] === '/') return hedef.slice(1);
    var parca = taban.split('/'); parca.pop();
    hedef.split('/').forEach(function (p) { if (p === '..') parca.pop(); else if (p && p !== '.') parca.push(p); });
    return parca.join('/');
  }

  function oku(arabellek) {
    return Promise.resolve().then(function () {
      var bayt = arabellek instanceof Uint8Array ? arabellek : new Uint8Array(arabellek);
      if (bayt[0] === 0xD0 && bayt[1] === 0xCF && bayt[2] === 0x11 && bayt[3] === 0xE0) {
        throw hataYap('Bu dosya eski Excel biçiminde (.xls). Excel’de “Farklı Kaydet → Excel Çalışma Kitabı (.xlsx)” ile kaydedip tekrar yükleyin.');
      }
      var z = zipIcerik(bayt);
      return Promise.all([ac(z['xl/workbook.xml']), ac(z['xl/_rels/workbook.xml.rels']), ac(z['xl/sharedStrings.xml'])]).then(function (r) {
        var kitap = r[0], iliski = r[1] || '', ortakXml = r[2] || '';
        if (!kitap) throw hataYap('Dosya bir Excel (.xlsx) dosyası değil.');
        var ilk = /<sheet\b[^>]*>/.exec(kitap);
        var sayfaAdi = ilk ? ozellik(ilk[0], 'name') : 'Sayfa1';
        var rid = ilk ? (ozellik(ilk[0], 'r:id') || '') : '';
        var yol = 'xl/worksheets/sheet1.xml', reIl = /<Relationship\b[^>]*>/g, mi;
        while ((mi = reIl.exec(iliski))) {
          if (ozellik(mi[0], 'Id') === rid) { yol = yolBirlestir('xl/workbook.xml', ozellik(mi[0], 'Target')); break; }
        }
        var ortak = [], reSi = /<si>([\s\S]*?)<\/si>|<si\/>/g, ms;
        while ((ms = reSi.exec(ortakXml))) ortak.push(ms[1] ? metinTopla(ms[1]) : '');
        return ac(z[yol]).then(function (sayfa) {
          if (!sayfa) throw hataYap('Excel dosyasında sayfa bulunamadı.');
          return { sayfa: sayfaAdi, satirlar: sayfaCoz(sayfa, ortak) };
        });
      });
    });
  }

  // ---------- yazma ----------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zipYap(dosyalar) {
    var kod = new TextEncoder(), parcalar = [], merkez = [], yer = 0;
    function yaz16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
    function yaz32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }
    dosyalar.forEach(function (f) {
      var ad = kod.encode(f.ad), veri = kod.encode(f.icerik), crc = crc32(veri);
      var bas = [];
      yaz32(bas, 0x04034b50); yaz16(bas, 20); yaz16(bas, 0x0800); yaz16(bas, 0); yaz16(bas, 0); yaz16(bas, 0x21);
      yaz32(bas, crc); yaz32(bas, veri.length); yaz32(bas, veri.length); yaz16(bas, ad.length); yaz16(bas, 0);
      parcalar.push(new Uint8Array(bas), ad, veri);
      var m = [];
      yaz32(m, 0x02014b50); yaz16(m, 20); yaz16(m, 20); yaz16(m, 0x0800); yaz16(m, 0); yaz16(m, 0); yaz16(m, 0x21);
      yaz32(m, crc); yaz32(m, veri.length); yaz32(m, veri.length); yaz16(m, ad.length); yaz16(m, 0); yaz16(m, 0);
      yaz16(m, 0); yaz16(m, 0); yaz32(m, 0); yaz32(m, yer);
      merkez.push(new Uint8Array(m), ad);
      yer += bas.length + ad.length + veri.length;
    });
    var merkezBoy = merkez.reduce(function (t, p) { return t + p.length; }, 0), son = [];
    yaz32(son, 0x06054b50); yaz16(son, 0); yaz16(son, 0); yaz16(son, dosyalar.length); yaz16(son, dosyalar.length);
    yaz32(son, merkezBoy); yaz32(son, yer); yaz16(son, 0);
    var hepsi = parcalar.concat(merkez, [new Uint8Array(son)]);
    var cikti = new Uint8Array(hepsi.reduce(function (t, p) { return t + p.length; }, 0)), i = 0;
    hepsi.forEach(function (p) { cikti.set(p, i); i += p.length; });
    return cikti;
  }

  function kacisXml(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function harf(k) { var s = ''; k++; while (k > 0) { var m = (k - 1) % 26; s = String.fromCharCode(65 + m) + s; k = Math.floor((k - 1) / 26); } return s; }

  // Hücre: metin, sayı ya da { metin|sayi, kalin }. Barkod gibi uzun rakam dizileri metin yazılmalı,
  // yoksa Excel 9,78975E+12 gösterir; bu yüzden yalnız gerçekten number olanlar sayı olur.
  function yaz(satirlar, secenek) {
    secenek = secenek || {};
    var sayfaAdi = String(secenek.sayfa || 'Liste').replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Liste';
    var xml = '';
    satirlar.forEach(function (satir, r) {
      xml += '<row r="' + (r + 1) + '">';
      satir.forEach(function (h, k) {
        if (h == null || h === '') return;
        var kalin = (secenek.kalinBaslik && r === 0) || (h && h.kalin);
        var deger = h && typeof h === 'object' ? (h.sayi != null ? h.sayi : h.metin) : h;
        var ref = harf(k) + (r + 1), stil = kalin ? ' s="1"' : '';
        if (typeof deger === 'number' && isFinite(deger)) xml += '<c r="' + ref + '"' + stil + '><v>' + deger + '</v></c>';
        else xml += '<c r="' + ref + '"' + stil + ' t="inlineStr"><is><t xml:space="preserve">' + kacisXml(deger) + '</t></is></c>';
      });
      xml += '</row>';
    });
    var kolonlar = (secenek.genislikler || []).map(function (g, k) {
      return '<col min="' + (k + 1) + '" max="' + (k + 1) + '" width="' + g + '" customWidth="1"/>';
    }).join('');
    var sabit = secenek.kalinBaslik ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    var NS = 'http://schemas.openxmlformats.org/';
    var sayfa = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="' + NS + 'spreadsheetml/2006/main">' +
      sabit + (kolonlar ? '<cols>' + kolonlar + '</cols>' : '') + '<sheetData>' + xml + '</sheetData></worksheet>';
    return zipYap([
      { ad: '[Content_Types].xml', icerik: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="' + NS + 'package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { ad: '_rels/.rels', icerik: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="' + NS + 'package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { ad: 'xl/workbook.xml', icerik: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="' + NS + 'spreadsheetml/2006/main" xmlns:r="' + NS + 'officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + kacisXml(sayfaAdi) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { ad: 'xl/_rels/workbook.xml.rels', icerik: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="' + NS + 'package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + NS + 'officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="' + NS + 'officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { ad: 'xl/styles.xml', icerik: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="' + NS + 'spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { ad: 'xl/worksheets/sheet1.xml', icerik: sayfa }
    ]);
  }

  function hataYap(mesaj) { var e = new Error(mesaj); e.kod = 'EXCEL'; return e; }

  var api = { oku: oku, yaz: yaz, crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else kok.Xlsx = api;
})(this);
