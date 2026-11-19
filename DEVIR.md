# Devir notu

_Son güncelleme: 19 Kasım 2026 (Excel ile ürün girişi, rafa yerleştirme, .xls okuma)_

## Proje

Kırtasiye için "Kitabım Hangi Rafta?": müşteri ekranı (kiosk, `index.html`) kitabın raf/bölmesini gösterir; yönetim paneli (`yonetim.html`) raflar, kitaplar, okul listeleri, talepler, harita, etiketler, geçmiş, revizeler, kullanıcılar, ayarlar. Kullanıcı bunu bir kırtasiye müdürüne **sunup satacak**.

Yetkiler: düzenleyici (her şey), revize veren / müdür (revize yazar, görür), çalışan (kitap ekler/çıkarır). Revizeler programın kendisine dair isteklerdir; Claude'a iletilir.

## Yapılanlar (hepsi bitti, 65 birim + 15 fonksiyon testi geçiyor)

- Temel: raf/bölme şeması, barkod (kamera + fotoğraf + USB okuyucu), ISBN'den Google Books / Open Library ile otomatik bilgi ve kapak, CSV, QR raf etiketleri, fiyat/stok aç-kapa, roller, Supabase RLS.
- Profesyonel sürüm: kenar menülü panel, genel bakış panosu, kiosk karşılama ekranı, Türkçe ekran klavyesi, kapaklar.
- Altı gelişmiş özellik: okul listesi, gelince haber ver (KVKK onaylı), renk/logo, mağaza haritası, işlem geçmişi, internetsiz çalışma.
- Revize 1 (17 Kasım): **Şube eksikleri** sekmesi. Şubeden gelen barkodlu Excel listesi → raf/bölme eşleştirme → Excel'e indirme ve yazdırma. Dosyalar: `js/xlsx.js` (kütüphanesiz .xlsx okuma/yazma), `js/sube.js` (eşleştirme kuralları), `js/panel-sube.js`, testler `tests/sube.test.cjs` + `tests/veri/*.xlsx`. Eski .xls desteklenmez (kullanıcıya .xlsx olarak kaydetmesi söylenir). Sunuma eklendi (slayt 10 “Şube eksik listesi”, Standart pakete yazıldı); proje PDF'inde de var (18 Kasım).
- Uygulama olarak kurulum (18 Kasım): iki ayrı manifest (`kiosk.webmanifest` tam ekran "Kitabım Nerede", `yonetim.webmanifest` "Raf Yönetimi"), simgeler `simge/`, iPad meta etiketleri, panelde "Uygulama olarak kur" düğmesi (`js/kur.js`). Chrome kurulabilirlik denetimi iki sayfada da temiz. Kurulum talimatı README'de.
- Barkod okuma (18 Kasım, kullanıcının iPhone denemesinden): html5-qrcode canlı görüntüyü çerçeve boyutuna (~300 px) küçültüp tarıyordu, iPhone'da okumuyordu. Yeni motor: `vendor/barcode-detector.js` (barcode-detector 3.2.3 ponyfill) + `vendor/zxing_reader.wasm` (zxing-wasm 3.1.6, ZXing-C++, MIT). Android'de yerleşik BarcodeDetector, yoksa bu motor; ikisi de yoksa html5-qrcode yedek. Kendi tarama döngüsü: 1920×1080 kamera, çerçeve içi tam çözünürlükte, destekleniyorsa 2x yakınlaştırma. Fotoğraftan okuma parça parça + 90° döndürme. Test `tests/e2e/barkod-e2e.js`: gerçek kitap fotoğrafından ffmpeg ile üretilen bulanık/titreyen sahte kamera, yeni sürüm 0,2 sn'de okuyor, eski sürüm hiç okuyamıyordu. QR (raf etiketleri) de okunuyor. Kullanıcı iPhone'da canlı kamerayla denedi: **çalışıyor** (18 Kasım).
- Fotoğraftan okuma düzeltmesi (18 Kasım; kullanıcı: net fotoğraf bazen okunamıyor): eski kod 24 MP iPhone fotoğrafını tam boy tuvale çiziyordu (24,5 MP; iPhone Safari sınırı ~16,7 MP) ve her parça için yeni tuval açıp bırakmıyordu, tuval belleği dolunca okuma bozuluyordu. Şimdi tek ortak tuval, okuyucuya ImageData verilir (okuyucu kendi tuvalini açmaz), döndürme parça içinde; en büyük tuval ≤ 4096 px uzun kenar. `tests/e2e/barkod-e2e.js` 24 MP fotoğrafı ve tuval boyutunu denetler (eski kodda başarısız). `js/barkodonay.js`: çizgili barkod iki okumada aynı çıkınca kabul (canlı kamera ve fotoğraf), QR hemen; tek aday kalırsa yalnız geçerli ISBN kabul. Bilinen sınır: çok bulanık fotoğrafta ZXing tutarlı yanlış sayı okuyabiliyor (9789944886666 → 0718974886666, kontrol hanesi tutuyor); `minLineCount` 3–4 denendi, işe yaramadı, vendor dosyası değiştirilmedi.
- `belgeler/`: müşteriye verilecek proje dokümanı (PDF + kaynağı `proje.html`, `node belgeler/yap.js` ile yeniden üretilir). Sürüm 1.1 (18 Kasım): şube eksik listesi sayfası ve görüntüsü (`pdf-img/p12-sube.jpg`), tablete uygulama olarak kurulum, canlı kurulum ve iPhone kamera durumu, 43 test; resim yolları düzeltildi (`pdf-img/`, eskiden kırık `../pdf-img/`). Ekran görüntüleri `node tests/e2e/pdf-goruntu.js <klasör>` ile üretilir (yerel sunucu açıkken), örnek kitaplara barkod verir. İç kullanım fiyat notu kullanıcıda; depoda yok.
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

**ÖNCE BU — Excel ile ürün girişi YAZILDI ve bulutta açıldı (19 Kasım). Sıradaki: kullanıcı canlıda gerçek adetli Excel ile deneyecek.**
Kullanıcının bilgisi: mağaza programı hazır alacak; personel kitap bilgisi tamamlamaz, ürünleri yalnız **Excel ile, adetli** ekler. Kararlar: Excel'de raf yok → yeni kitap rafsız ("Rafa yerleştirilecek"); kayıtlı barkod tekrar gelirse **adet stoğa eklenir**; BÜYÜK HARF adlar **normal yazıma** çevrilir; gerçek dosyada adet sütunu olacak (örnekte yoktu).
- Müşterinin örnek dosyası `DENEME.xls` (BIFF8, 88 ürün: BARCODE, MALINCINSI, KOD3=yayınevi; adet yok, 86 ISBN + 2 uzun ürün kodu, çoğu TYT/AYT/LGS test kitabı). **Depoya konmadı** (CLAUDE.md gizlilik); yalnız scratchpad'de denendi: 88 yeni kitap, 55 ms, hata yok.
- `js/xls.js`: dış kütüphanesiz .xls (Compound File + BIFF8: SST/CONTINUE, LABELSST, LABEL, NUMBER, RK, MULRK, FORMULA/STRING, BOOLERR, mini akış). xlrd ile 1.295 satır birebir. Testler `tests/xls.test.cjs` + sentetik `tests/veri/xlwt-ornek.xls`, `libreoffice-ornek.xls`. Şube eksikleri de .xls okur.
- `js/giris.js` (saf): `sutunlariBul` (Türkçesiz büyük harf başlıklar: MIKTAR→ı sorunu `sade()` ile çözüldü; aynı hata `js/sube.js`'te de düzeltildi), `adYazimi` (kısaltma listesi, Roma rakamı, ünlüsüz kısa parça, "ve/ile" küçük, kesmeden sonra küçük; metinde hiç İ yoksa I_SOZLUK + ünlü uyumu; %25'ten çok küçük harf varsa dokunmaz), `planla` (barkod ya da barkodsuzsa ad anahtarı; aynı anahtar toplanır; 0 adet geçerli, eksi hata; fiyat varsa günceller; Raf sütunu varsa yerleştirir, yoksa rafsız).
- Rafsız kitap: `Depo.kitapKaydet(..., {rafsizOlabilir})`, `Depo.rafsizKitaplar`, `Depo.urunGirisiUygula`; `Veri.urunGirisi` (yerel + bulut: insert 500'lük, stok update 10'luk gruplar). `supabase/kurulum.sql`: `bolme_id` nullable (+ `alter ... drop not null`), geçmişte 'rafsız'. Bulutta eski şemada 23502 → "kurulum.sql'i yeniden çalıştırın" mesajı.
- Panel: **Ürün girişi** sekmesi (`#urun-girisi`; `#giris` oturum açma ekranının id'si, çakışma yaşandı), `js/panel-giris.js`: yükle → sütun seçimi (details) → özet/önizleme → kaydet; **Rafa yerleştir** (bölme seç, barkod/kamera art arda; rafsız liste "Seçili bölmeye koy"; zaten başka bölmedeyse taşıma onayı). Kitaplar sekmesinde eski CSV yükle kaldırıldı (`Csv.iceAktarHazirla`, `Veri.topluKitapEkle` silindi), yerine "Excel'den ürün girişi" düğmesi. "Rafsız" rozeti, raf filtresinde "Rafa yerleştirilecek", menü sayacı, genel bakış uyarısı. Müşteri ekranı: "mağazaya yeni geldi, henüz rafına yerleştirilmedi". Şube eksiklerinde rafsız kitap kayıtsız sayılmaz.
- Testler: 65 birim, 15 fonksiyon (Deno), e2e `giris-e2e.js` (yerel) ve `giris-bulut-e2e.js` (sahte Supabase + sahte oturum; POST/PATCH gövdeleri doğrulanır; `ESKI_SEMA=1` eski şema mesajı). `kiosk-e2e`, `panel-e2e` yeni ekrana geçirildi. sw khr-v10.
- **SQL adımı TAMAM (19 Kasım):** kullanıcı yalnız `alter table public.kirtasiye_kitaplar alter column bolme_id drop not null;` satırını çalıştırdı (Success). Tüm dosyayı yapıştırınca 316. satırda `logo` sözdizimi hatası almıştı: dosya 315 satır, kopyalarken uzun satır bölünmüş. Tüm dosya gerekirse raw.githubusercontent.com adresinden kopyalatılmalı. Geçmiş tetikleyicisi bulutta eski sürüm: rafsız kitapta 'rafsız' yerine '?' yazar (zararsız; istenirse kurulum.sql tamamı yeniden çalıştırılır).
- Bilinen sınırlar: bulutta stok güncellemeleri ortasında hata olursa kısmi kalabilir; aynı dosya yeniden yüklenirse stok ikinci kez eklenir (ürün girişi doğası gereği). Türkçe klavyesiz yazılmış adlarda bazı I'lar yanlış kalabilir ("Rısk"). Toplu internetten yazar/kapak tamamlama YAPILMADI (Excel'de ad ve yayınevi zaten var; istenirse "Eksik bilgileri internetten tamamla" düğmesi eklenebilir; ücretsiz planda Google Kitaplar + Open Library, test kitaplarında kapsam zayıf).
- Önceki durum: Supabase `kitap-bilgi` kurulumu TAMAM (19 Kasım; secret GOOGLE_API_KEY, JWT kapalı, `kapaklar` deposu var). Kullanıcı Books API'yi "Default Gemini Project"te açtı (iki Google hesabı/proje karışıklığı yaşandı: gen-lang-client-0539371734 ve ...0573755216). Telefonda 9789753638029 / 9786259506586 denemesinin sonucu henüz bildirilmedi.

0. **Kitap bilgisi sunucusu yazıldı, kullanıcının kurulumu bekleniyor** (18 Kasım). Kök neden: anahtarsız Google Kitaplar isteği Google'ın ortak projesinden (624717413613) düşüyor, günlük kota doluyor → 429 → "internette bulunamadı". Kullanıcı "Google'da normal aramada çıkıyor" dedi (örnek 9786259506586 Kınalı Serçe, Kronik Kitap) ve onay verdi.
   - `supabase/functions/kitap-bilgi/index.ts`: `isbn` → Google Kitaplar (GOOGLE_API_KEY ile) → Open Library → Gemini + Google Search grounding (JSON metinden ayıklanır); `kapak` → fotoğraf `kapaklar` deposuna (service role) + Gemini görselden ad/yazar/yayınevi (responseSchema). Yetki: düzenleyici, çalışan. Model `GEMINI_MODEL` ya da gemini-2.5-flash → 3.1-flash-lite → 2.5-flash-lite (404'te sıradaki). Testler `npm run test:fonksiyon` (Deno, sahte fetch; CI'da da çalışır). Arama fikri önce OpenRouter `google/gemini-2.5-flash:online` ile doğrulandı (3 ISBN, uydurmadı).
   - Tarayıcı: `KitapBilgi.bul(kod, Veri.kitapBilgi)` önce sunucu, ulaşılamazsa doğrudan; `KitapBilgi.kaynak` ('google-arama' ise "mutlaka kontrol edin"). Formda "Kapaktan doldur" (yalnız bulut modunda; foto 1024 px JPEG). `js/ayar.js` → `kitapFonksiyon: 'kitap-bilgi'`. sw khr-v9. E2E `tests/e2e/kapak-e2e.js`.
   - Kullanıcının yapacakları (README "Kurulum" 4. adım): AI Studio anahtarı, Supabase secret `GOOGLE_API_KEY`, fonksiyonu `kitap-bilgi` adıyla yükle + Verify JWT kapalı, SQL Editor'de `supabase/kapak-depo.sql`. Fonksiyon başka adla kaydolursa `kitapFonksiyon` satırını güncelle. Kurulumdan sonra `curl -X POST https://kkcfzrchrdiroiskibhw.supabase.co/functions/v1/kitap-bilgi` → 401 "Giriş yapın." dönmeli (kurulu demek).
   - **Gerçek anahtarla denendi (18 Kasım, ortam ağ sırrı `x-goog-api-key` başlığıyla):** gemini-2.5-flash yeni kullanıcılara kapalı (404). Ücretsiz planda Google Search grounding YOK (her modelde 429; fiyat sayfası "Free Tier: Not available"); faturalandırma açılırsa ayda 5.000 arama ücretsiz, sonra 14 $/1.000. Kapaktan okuma ücretsiz planda çalışıyor: sentetik kapak doğru (Kınalı Serçe / Şermin Yaşar & İlber Ortaylı / Kronik), arka kapakta "kapak değil" (kaydedilmez). Modeller: arama `gemini-flash-latest` önce, kapak `gemini-flash-lite-latest` önce; 404/429/5xx/zaman aşımında (20 sn) sıradaki. Groq gpt-oss-120b browser_search denendi: yayınevini YANLIŞ verdi (Tudem), elendi.
   - Kullanıcıya sorulacak karar: Google aramasını açmak için faturalandırma (kart) açılsın mı? Açılmazsa akış: Google Kitaplar (anahtarla; Books API projede etkin olmalı, değilse anahtarsız) → Open Library → "Kapaktan doldur".
0b. Tanı satırı: barkod penceresinde `sürüm 18.11-c · motor · foto · deneme · hata` (iPhone fotoğraf sorunu için eklendi; arkadaşın sorunu aslında Google Kitaplar kotasıydı).
1. Kullanıcı canlı sistemi deneyip revize verecek; revizeleri bu depoda yap, test et, push et (Pages otomatik güncellenir).
2. Sunum: claude.ai/artifact/DcQsrxVbtD3ER7ZxvUkAGN (16 slayt, kaynağı `belgeler/sunum/`). Fiyat yerleri `[₺__]`, teslim süresi, ad/telefon kullanıcı tarafından doldurulacak.
3. Sunuma "tablete uygulama olarak kurulur" bilgisi eklenebilir (PDF'te var).
4. Android tablette kamera testi (iPhone tamam), Türkçe kitaplarda Google Books kapsamı, Microsoft Excel ile gerçek şube listesi denemesi.

## Açık sorular

- Yok (Supabase kararı verildi: yeni hesap).
