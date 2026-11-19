const test = require('node:test');
const assert = require('node:assert/strict');
const Depo = require('../js/depo.js');
const Giris = require('../js/giris.js');

test('ad yazımı: büyük harfli adlar normal yazıma, kısaltmalar korunur', () => {
  const ornekler = {
    'VANİLYA KOKULU MEKTUPLAR': 'Vanilya Kokulu Mektuplar',
    'AHMET HAŞİM / BİZE GÖRE': 'Ahmet Haşim / Bize Göre',
    'GURUR VE ÖN YARGI': 'Gurur ve Ön Yargı',
    'SİNEKLERİN TANRISI (K.KAPAK)': 'Sineklerin Tanrısı (K.Kapak)',
    "SOKRATES'İN SAVUNMASI": "Sokrates'in Savunması",
    'ORİJİNAL YKS TYT AYT S.B. GEOMETRİ - 2026-27': 'Orijinal YKS TYT AYT S.B. Geometri - 2026-27',
    "TYT BİYOLOJİ 40'Lİ DENEME": "TYT Biyoloji 40'li Deneme", // kaynakta noktalı İ var; yazım hatası tahminle düzeltilmez
    '5.SINIF MORE & MORE TEST BOOK': '5.Sınıf More & More Test Book',
    'TYT G.P.T. SORU BANKASI': 'TYT G.P.T. Soru Bankası',
    'KÖPEK ADAM 3 İKİ KEDİCİĞİN HİKAYESİ': 'Köpek Adam 3 İki Kediciğin Hikayesi',
    'II. ABDÜLHAMİT': 'II. Abdülhamit',
    'KR YAYIN': 'KR Yayın',
    'İŞBANKASI': 'İşbankası',
    'ÇİZGİLİ PİJAMALI ÇOCUK': 'Çizgili Pijamalı Çocuk',
    // Türkçe klavyesiz yazılmış (hiç İ yok): sözlük ve ünlü uyumu
    'AYT ICEBERG FIZIK KONU ANLATIMI': 'AYT İceberg Fizik Konu Anlatımı', // yabancı marka: ünlü uyumu kuralına uyar, kabul edilebilir
    'IELTS VE TOEFL KELIME KITABI': 'IELTS ve TOEFL Kelime Kitabı', // kısaltmalar ve Roma rakamı bozulmaz
    'DÜNYA TARIHI CILT II': 'Dünya Tarihi Cilt II',
    'GRI KOÇ PLANLAMA DEFTERI': 'Gri Koç Planlama Defteri',
    'ORHAN VELI BÜTÜN ŞIIRLERI': 'Orhan Veli Bütün Şiirleri',
    '5.SINIF MORE & MORE TEST': '5.Sınıf More & More Test',
    // İ kullanılmışsa I'ya dokunulmaz (HIZ = hız)
    'HIZ YAYINLARI FİZİK': 'Hız Yayınları Fizik',
    // arada küçük harfli tek kelime olan büyük harfli ad da çevrilir
    '09.SINIF HIZ ve RENK HİT S.B. COĞRAFYA': '09.Sınıf Hız ve Renk Hit S.B. Coğrafya',
  };
  for (const [g, b] of Object.entries(ornekler)) assert.equal(Giris.adYazimi(g), b, g);
  // Zaten düzgün yazılmış (küçük harf içeren) adlara dokunulmaz
  assert.equal(Giris.adYazimi('Tarçın Kasabası Gizemi'), 'Tarçın Kasabası Gizemi');
  assert.equal(Giris.adYazimi('8.Sınıf LGS Çıkmış Sorular'), '8.Sınıf LGS Çıkmış Sorular');
  assert.equal(Giris.adYazimi('  '), '');
});

test('sütunlar: mağaza programı başlıkları (BARCODE, MALINCINSI, KOD3, MIKTAR)', () => {
  const s = Giris.sutunlariBul([['BARCODE', 'MALINCINSI', 'KOD3', 'MIKTAR', 'SATIŞ FİYATI']]);
  assert.deepEqual([s.baslikSatiri, s.barkod, s.ad, s.yayinevi, s.adet, s.fiyat, s.yazar, s.konum], [0, 0, 1, 2, 3, 4, -1, -1]);
  const t = Giris.sutunlariBul([['Giriş listesi'], [], ['Sıra', 'Barkod', 'Kitap Adı', 'Yazar', 'Yayınevi', 'Adet', 'Raf']]);
  assert.deepEqual([t.baslikSatiri, t.barkod, t.ad, t.yazar, t.yayinevi, t.adet, t.konum], [2, 1, 2, 3, 4, 5, 6]);
  const u = Giris.sutunlariBul([['Kürk', '9789750719387', '2'], ['Atlas', '8690000000017', '1']]);
  assert.equal(u.baslikSatiri, -1);
  assert.equal(u.barkod, 1);
});

test('adet okuma', () => {
  assert.deepEqual(Giris.adetOku('5'), { adet: 5 });
  assert.deepEqual(Giris.adetOku(''), { adet: 1 });
  assert.deepEqual(Giris.adetOku('1.000'), { adet: 1000 });
  assert.match(Giris.adetOku('0').hata, /0 ya da eksi/);
  assert.match(Giris.adetOku('2,5').hata, /tam sayı/);
  assert.match(Giris.adetOku('beş').hata, /geçerli bir adet değil/);
});

function magaza() {
  const d = Depo.bos();
  const r = Depo.rafEkle(d, 'Roman', 3);
  Depo.kitapKaydet(d, { ad: 'Beyaz Gemi', barkod: '9789754370430', bolmeId: r.bolmeler[0].id, stok: 3, fiyat: 100 });
  Depo.kitapKaydet(d, { ad: 'Şeker Portakalı', barkod: '9789750738609', bolmeId: r.bolmeler[1].id }); // stok bilinmiyor
  return { d, r };
}
const BASLIK = ['BARCODE', 'MALINCINSI', 'KOD3', 'MIKTAR'];

test('plan: kayıtlı barkodda adet stoğa eklenir, yeni kitap rafsız ve normal yazımla eklenir', () => {
  const { d } = magaza();
  const satirlar = [BASLIK,
    ['9789754370430', 'BEYAZ GEMİ', 'ÖTÜKEN', '5'],
    ['9789750738609', 'ŞEKER PORTAKALI', 'CANYAYINLARI', '2'],
    ['9789750701689', 'VANİLYA KOKULU MEKTUPLAR', 'CANYAYINLARI', '4'],
    [],
    ['9789750701689', 'VANİLYA KOKULU MEKTUPLAR', 'CANYAYINLARI', '1'], // aynı barkod ikinci kez: toplanır
  ];
  const p = Giris.planla(d, satirlar, Giris.sutunlariBul(satirlar));
  assert.deepEqual(p.artis.map((a) => [a.ad, a.eskiStok, a.ek, a.yeniStok]), [['Beyaz Gemi', 3, 5, 8], ['Şeker Portakalı', null, 2, 2]]);
  assert.equal(p.yeni.length, 1);
  assert.deepEqual(p.yeni[0], { satir: 4, barkod: '9789750701689', ad: 'Vanilya Kokulu Mektuplar', yazar: '', yayinevi: 'Canyayınları', stok: 5, fiyat: null, bolmeId: null });
  assert.equal(p.rafsiz, 1);
  assert.equal(p.toplamAdet, 12);
  assert.equal(p.bos, 1);
  assert.deepEqual(p.hatalar, []);
  assert.equal(p.adetSutunuYok, false);
});

test('plan: adet sütunu yoksa her satır 1 adet; sorunlu satırlar ayrılır', () => {
  const { d } = magaza();
  const satirlar = [['BARCODE', 'MALINCINSI', 'KOD3'],
    ['9789754370430', 'BEYAZ GEMİ', 'ÖTÜKEN'],
    ['', 'BARKODSUZ KİTAP', 'X'],
    ['97860 51000 145', 'AHMET HAŞİM / BİZE GÖRE', 'KÜLTÜR KİTABI'], // boşluklu barkod temizlenir
    ['9786000000001', '', 'Y'], // yeni ama adı yok
    ['15701114048267666', 'KUTLU HAYATIN İZİNDE 2 KİTAP CİLTLİ', 'TİMAŞ'], // ISBN değil, ürün kodu: yine eklenir
  ];
  const p = Giris.planla(d, satirlar, Giris.sutunlariBul(satirlar));
  assert.equal(p.adetSutunuYok, true);
  assert.deepEqual(p.artis.map((a) => a.yeniStok), [4]);
  assert.deepEqual(p.yeni.map((y) => y.barkod), ['9786051000145', '15701114048267666']);
  assert.deepEqual(p.hatalar.map((h) => h.satir), [3, 5]);
  assert.match(p.hatalar[0].mesaj, /Barkod boş \(BARKODSUZ KİTAP\)/);
  assert.match(p.hatalar[1].mesaj, /kitap adı yok/);
});

test('plan: Excel\'de raf ve fiyat varsa kullanılır; olmayan bölme uyarıyla rafsız eklenir', () => {
  const { d } = magaza();
  const satirlar = [['Barkod', 'Kitap adı', 'Adet', 'Fiyat', 'Raf'],
    ['9789750701689', 'Vanilya Kokulu Mektuplar', '2', '185,50', '1.3'],
    ['9786051000145', 'Bize Göre', '1', '', '9.9'],
    ['9789754370430', 'Beyaz Gemi', '1', '120', ''],
  ];
  const p = Giris.planla(d, satirlar, Giris.sutunlariBul(satirlar));
  assert.equal(p.yeni[0].bolmeId, Depo.bolmeBul(d, '1.3').bolme.id);
  assert.equal(p.yeni[0].fiyat, 185.5);
  assert.equal(p.yeni[1].bolmeId, null);
  assert.equal(p.uyarilar.length, 1);
  assert.match(p.uyarilar[0].mesaj, /9\.9.*rafsız/);
  assert.equal(p.artis[0].fiyat, 120); // fiyat değiştiyse güncellenir
  assert.equal(p.rafsiz, 1);
});

test('Depo: plan uygulanır; yeni kitap rafsız, stok güncel değere eklenir; formda raf yine zorunlu', () => {
  const { d, r } = magaza();
  const satirlar = [BASLIK, ['9789754370430', 'BEYAZ GEMİ', 'ÖTÜKEN', '5'], ['9789750701689', 'VANİLYA KOKULU MEKTUPLAR', 'CAN', '4']];
  const plan = Giris.planla(d, satirlar, Giris.sutunlariBul(satirlar));
  d.kitaplar.find((k) => k.barkod === '9789754370430').stok = 4; // plan hazırlandıktan sonra biri 1 adet daha eklemiş
  const s = Depo.urunGirisiUygula(d, plan);
  assert.equal(s.eklenen.length, 1);
  assert.equal(s.eklenen[0].bolmeId, null);
  assert.equal(s.guncellenen[0].stok, 9); // 4 + 5
  assert.deepEqual(Depo.rafsizKitaplar(d).map((k) => k.ad), ['Vanilya Kokulu Mektuplar']);
  // Rafa yerleştirme: bölme verilince rafsız listeden çıkar
  const k = s.eklenen[0];
  Depo.kitapKaydet(d, Object.assign({}, k, { bolmeId: r.bolmeler[2].id }));
  assert.equal(Depo.rafsizKitaplar(d).length, 0);
  // Formdan rafsız kitap eklenemez
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'Raf seçilmemiş' }), /Raf ve bölme seçin/);
  assert.throws(() => Depo.kitapKaydet(d, { ad: 'Olmayan bölme', bolmeId: 'yok' }, { rafsizOlabilir: true }), /Raf ve bölme seçin/);
});
