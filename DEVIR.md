# Devir notu

_Son güncelleme: 18 Kasım 2026_

## Proje

Kırtasiye için "Kitabım Hangi Rafta?": müşteri ekranı (kiosk, `index.html`) kitabın raf/bölmesini gösterir; yönetim paneli (`yonetim.html`) raflar, kitaplar, okul listeleri, talepler, harita, etiketler, geçmiş, revizeler, kullanıcılar, ayarlar. Kullanıcı bunu bir kırtasiye müdürüne **sunup satacak**.

Yetkiler: düzenleyici (her şey), revize veren / müdür (revize yazar, görür), çalışan (kitap ekler/çıkarır). Revizeler programın kendisine dair isteklerdir; Claude'a iletilir.

## Yapılanlar (hepsi bitti, 43 birim testi geçiyor)

- Temel: raf/bölme şeması, barkod (kamera + fotoğraf + USB okuyucu), ISBN'den Google Books / Open Library ile otomatik bilgi ve kapak, CSV, QR raf etiketleri, fiyat/stok aç-kapa, roller, Supabase RLS.
- Profesyonel sürüm: kenar menülü panel, genel bakış panosu, kiosk karşılama ekranı, Türkçe ekran klavyesi, kapaklar.
- Altı gelişmiş özellik: okul listesi, gelince haber ver (KVKK onaylı), renk/logo, mağaza haritası, işlem geçmişi, internetsiz çalışma.
- Revize 1 (17 Kasım): **Şube eksikleri** sekmesi. Şubeden gelen barkodlu Excel listesi → raf/bölme eşleştirme → Excel'e indirme ve yazdırma. Dosyalar: `js/xlsx.js` (kütüphanesiz .xlsx okuma/yazma), `js/sube.js` (eşleştirme kuralları), `js/panel-sube.js`, testler `tests/sube.test.cjs` + `tests/veri/*.xlsx`. Eski .xls desteklenmez (kullanıcıya .xlsx olarak kaydetmesi söylenir). Sunuma eklendi (slayt 10 “Şube eksik listesi”, Standart pakete yazıldı); PDF henüz içermiyor.
- Uygulama olarak kurulum (18 Kasım): iki ayrı manifest (`kiosk.webmanifest` tam ekran "Kitabım Nerede", `yonetim.webmanifest` "Raf Yönetimi"), simgeler `simge/`, iPad meta etiketleri, panelde "Uygulama olarak kur" düğmesi (`js/kur.js`). Chrome kurulabilirlik denetimi iki sayfada da temiz. Kurulum talimatı README'de.
- Barkod okuma (18 Kasım, kullanıcının iPhone denemesinden): html5-qrcode canlı görüntüyü çerçeve boyutuna (~300 px) küçültüp tarıyordu, iPhone'da okumuyordu. Yeni motor: `vendor/barcode-detector.js` (barcode-detector 3.2.3 ponyfill) + `vendor/zxing_reader.wasm` (zxing-wasm 3.1.6, ZXing-C++, MIT). Android'de yerleşik BarcodeDetector, yoksa bu motor; ikisi de yoksa html5-qrcode yedek. Kendi tarama döngüsü: 1920×1080 kamera, çerçeve içi tam çözünürlükte, destekleniyorsa 2x yakınlaştırma. Fotoğraftan okuma parça parça + 90° döndürme. Test `tests/e2e/barkod-e2e.js`: gerçek kitap fotoğrafından ffmpeg ile üretilen bulanık/titreyen sahte kamera, yeni sürüm 0,2 sn'de okuyor, eski sürüm hiç okuyamıyordu. QR (raf etiketleri) de okunuyor. Kullanıcı iPhone'da canlı kamerayla denedi: **çalışıyor** (18 Kasım).
- `belgeler/`: müşteriye verilecek proje dokümanı (PDF + kaynağı `proje.html`, `node belgeler/yap.js` ile yeniden üretilir). İç kullanım fiyat notu kullanıcıda; depoda yok.
- `tests/e2e/`: Playwright senaryoları (yerel sunucu `python3 -m http.server 8765` ile). 18 Kasım: 10 senaryonun hepsi temiz. Çevrimdışı testi sahte Supabase adresini `js/ayar.js`'ten okur (proje taşınınca bozulmaz); klasör verilmezse ekran görüntüleri geçici klasöre yazılır.

## Kullanıcının kararları

- D&R görünümü beğenilmedi; kendi tasarımımız kalıyor, renk ayarlanabilir.
- Şimdilik ücretsiz altyapı; müdür onaylarsa ücretli yeni Supabase projesine sıfır veriyle taşınır.
- Fiyat paketleri iç fiyat notundadır (kullanıcıda); herkese açık depoya yazılmaz.

## Canlı kurulum (18 Kasım 2026, tamamlandı)

- **Yayın:** GitHub Pages, `main` dalı, kök klasör (`.nojekyll` var).
  - Müşteri ekranı: https://barishnc-creator.github.io/kitabim-hangi-rafta/
  - Yönetim paneli: https://barishnc-creator.github.io/kitabim-hangi-rafta/yonetim.html
- **Supabase:** kullanıcının yeni, ayrı hesabı (kırtasiye için açıldı), proje `kitabim-hangi-rafta`, bölge eu-central-1 (Frankfurt), ref `kkcfzrchrdiroiskibhw`. Adres ve publishable anahtar `js/ayar.js`'te.
  - `supabase/kurulum.sql` SQL Editor'de çalıştırıldı (API yetkileri dosyada açıkça veriliyor).
  - Kullanıcı fonksiyonu panelde **`smart-processor`** adıyla kaydoldu (Supabase editörü rastgele ad verdi); kod `supabase/functions/kirtasiye-kullanici/index.ts`, Verify JWT kapalı. `js/ayar.js` → `fonksiyon: 'smart-processor'`.
  - Bu yeni hesap Claude'un Supabase MCP bağlantısında **yok** (MCP kullanıcının eski hesabına bağlı: ortak-muhasebe, csn). Veritabanı değişiklikleri SQL Editor'den kullanıcıya yaptırılır.
  - Bulut ortamı "Claude Bulut" ağ izin listesinde `kkcfzrchrdiroiskibhw.supabase.co` var; REST ve fonksiyon buradan curl ile test edilebilir.
- Kullanıcı canlı adreste programın çalıştığını doğruladı. İlk yönetici hesabını kendisi oluşturacak/oluşturdu (şifre Claude'da yok).
- Deneme sürümü (yerel veri, örnek doldurma): claude.ai/artifact/W2Go9k3SPxdrxF93SZNXDw — kaynağı scratchpad'deydi; yeniden üretmek için `index.html`/`yonetim.html`'den supabase.js ve service worker çıkarılıp `js/ayar.js` boş bırakılır.

## Sıradaki işler

1. Kullanıcı canlı sistemi deneyip revize verecek; revizeleri bu depoda yap, test et, push et (Pages otomatik güncellenir).
2. Sunum: claude.ai/artifact/DcQsrxVbtD3ER7ZxvUkAGN (16 slayt, kaynağı `belgeler/sunum/`). Fiyat yerleri `[₺__]`, teslim süresi, ad/telefon kullanıcı tarafından doldurulacak.
3. Proje PDF'i (`belgeler/`) şube eksik listesi özelliğini henüz içermiyor; istenirse sayfa ekle ve `node belgeler/yap.js`.
4. Sunuma/PDF'e "tablete uygulama olarak kurulur" bilgisi eklenebilir.
5. Android tablette kamera testi (iPhone tamam), Türkçe kitaplarda Google Books kapsamı, Microsoft Excel ile gerçek şube listesi denemesi.

## Açık sorular

- Yok (Supabase kararı verildi: yeni hesap).
