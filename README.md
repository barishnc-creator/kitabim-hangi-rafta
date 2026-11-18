# Kitabım Hangi Rafta?

Kırtasiye için raf takip programı. Çalışanlar rafları ve bölmeleri (1.1, 1.2 …) kurar, kitapları barkodla ya da elle ekler. Müşteri dükkândaki ekranda kitabın adını yazar ya da barkodunu okutur; program kitabın hangi raf ve bölmede olduğunu söyler ve raf şemasında o bölmeyi turuncuyla gösterir.

## Öne çıkanlar

- **Müşteri ekranı (kiosk):** karşılama ekranı, dokunmatik Türkçe ekran klavyesi (`?kiosk=1`), kapak görselli sonuçlar, büyük raf/bölme kartı ve raf şeması, stok rozeti (Rafta var / Son N adet / Tükendi), raflara göre gezinme, yeni gelenler, raf etiketindeki QR okutulunca bölme içeriği, "Telefonunuza alın" QR'ı, 90 sn boşta kalınca başa dönme, tam ekran.
- **Yönetim paneli:** Genel bakış panosu (kitap/raf/bölme sayıları, en çok arananlar, aranıp bulunamayanlar, son eklenenler, raf doluluğu), kitap tablosu (arama, raf filtresi), çekmece formunda barkoddan otomatik bilgi ve kapak, Excel (CSV) içe/dışa aktarma, QR'lı raf etiketi yazdırma, revizeler, kullanıcılar ve yetkiler, mağaza adı ve fiyat/stok ayarları.

- **Okul listeleri:** okulun listesi yapıştırılır, kitaplarla otomatik (yazım hatasına dayanıklı) eşleştirilir; veli müşteri ekranında okul → sınıf seçip listedeki kitapları raf ve stok durumuyla görür.
- **Gelince haber ver:** bulunamayan ya da tükenen kitap için müşteri ad ve telefon bırakır (KVKK onaylı); panelde Talepler sekmesinden takip edilir.
- **Mağaza haritası:** raflar kat planına sürüklenerek yerleştirilir; müşteri ekranı "Buradasınız"dan rafa yolu gösterir.
- **Görünüm:** mağazanın logosu, ana rengi ve karşılama yazısı.
- **Şube eksikleri:** şubeden gelen barkodlu eksik listesi (Excel .xlsx ya da .csv) yüklenir; her kitabın raf ve bölmesi bulunur, raf sırasına göre toplama listesi çıkar (stok yetersiz / stokta yok / kayıtlı değil uyarılarıyla). Liste Excel olarak indirilir ya da “Toplandı” kutucuklarıyla yazdırılır. Excel okuma/yazma dış kütüphanesiz (`js/xlsx.js`).
- **İşlem geçmişi:** kim, ne zaman, hangi kitabı ekledi, taşıdı, sildi.
- **İnternetsiz çalışma:** bağlantı kesilse de müşteri ekranı son listeyle arama yapar (hizmet çalışanı + yerel kopya).

## Ekranlar

- `index.html`: müşteri ekranı. Giriş gerekmez. Arama, barkod/QR okutma, kitap kartı ve raf şeması var. 90 saniye dokunulmazsa başa döner.
- `yonetim.html`: giriş yapılan panel. Sekmeler yetkiye göre görünür:

| Sekme | Düzenleyici | Revize veren (müdür, yönetici) | Çalışan |
|---|---|---|---|
| Raflar | görür, raf/bölme ekler-siler | görür | görür |
| Kitaplar | ekler, düzenler, siler | görür | ekler, düzenler, siler |
| Revizeler | görür, yazar, durum değiştirir | görür, yazar | yok |
| Kullanıcılar | kişi ekler, yetki/şifre değiştirir | yok | yok |
| Ayarlar | fiyat/stok aç-kapa, yedek | yok | yok |

Yetkiler yalnız ekranda değil, veritabanında da kontrol edilir (Supabase RLS).

**Revizeler:** programın kendisine dair istekler ("şu butonu büyüt" gibi). Düzenleyici "Yeni revizeleri kopyala" ile hepsini tek metin hâlinde alıp geliştiriciye iletir, sonra durumlarını "İletildi" ya da "Yapıldı" yapar.

## Uygulama olarak kurma

İki ekran da tarayıcıdan ayrı birer uygulama olarak kurulur. Kendi simgesiyle, adres çubuğu olmadan açılır ve güncellemeler kendiliğinden gelir.

| Cihaz | Nasıl |
|---|---|
| Android tablet/telefon (Chrome) | Adresi aç → sağ üstte ⋮ → **Uygulamayı yükle** (ya da **Ana ekrana ekle**) |
| iPad / iPhone (Safari) | Adresi aç → **Paylaş** düğmesi → **Ana Ekrana Ekle** |
| Windows / Mac (Chrome, Edge) | Adres çubuğunun sağındaki **yükle** simgesi → **Yükle** |

- Müşteri ekranı (`index.html`) "Kitabım Nerede" adıyla, tam ekran kurulur.
- Yönetim paneli (`yonetim.html`) "Raf Yönetimi" adıyla kurulur. Tarayıcı izin verdiğinde kenar menüde **Uygulama olarak kur** düğmesi de çıkar.
- Müşteri tabletini kilitlemek için: Android'de **Ayarlar → Güvenlik → Uygulama sabitleme**, iPad'de **Ayarlar → Erişilebilirlik → Rehberli Erişim**.

Dosyalar: `kiosk.webmanifest`, `yonetim.webmanifest`, `simge/` (kaynak `simge/*.svg`), kur düğmesi `js/kur.js`.

## Kurulum (Supabase)

1. **Veritabanı:** Supabase panelinde SQL Editor'ü aç, `supabase/kurulum.sql` dosyasının içeriğini yapıştır, Run'a bas. Tüm tablolar `kirtasiye_` ile başlar; aynı projedeki başka uygulamalara dokunmaz. Dosya tekrar çalıştırılabilir.
2. **Kullanıcı sunucusu:** Edge Functions bölümünde `kirtasiye-kullanici` adıyla yeni bir fonksiyon oluştur. İçeriği `supabase/functions/kirtasiye-kullanici/index.ts` dosyasından al. **"Verify JWT" kapalı olmalı**; fonksiyon girişi kendisi kontrol ediyor. CLI ile: `supabase functions deploy kirtasiye-kullanici --no-verify-jwt`.
3. **Adres ve anahtar:** `js/ayar.js` içindeki proje adresini ve `sb_publishable_` anahtarını yaz. Fonksiyon panelde başka bir adla kaydolduysa (Supabase editörü rastgele ad verebilir) o adı `fonksiyon` satırına yaz. Gizli (service role) anahtar buraya **asla** yazılmaz.
4. **Kitap bilgisi sunucusu (isteğe bağlı, önerilir):** barkod Google Kitaplar'da yoksa Google aramasıyla bulur, bulunamayan kitapta kapak fotoğrafından ad/yazar/yayınevini okur ve fotoğrafı kapak resmi yapar. Kurulmazsa program eskisi gibi tarayıcıdan Google Kitaplar ve Open Library'ye sorar (anahtarsız Google Kitaplar'ın ortak günlük kotası sık sık dolar).
   - [Google AI Studio](https://aistudio.google.com/apikey)'dan bir API anahtarı al. İstersen aynı Google Cloud projesinde **Books API**'yi de etkinleştir (kapak resimleri ve hızlı sonuç için; açılmazsa sunucu doğrudan Google aramasına geçer).
   - Supabase → Edge Functions → Secrets: `GOOGLE_API_KEY` = anahtar. İsteğe bağlı `GEMINI_MODEL` (varsayılan `gemini-2.5-flash`; model emekliye ayrılırsa sunucu sıradakini dener).
   - Edge Functions'ta `kitap-bilgi` adıyla fonksiyon oluştur, içeriği `supabase/functions/kitap-bilgi/index.ts`. **"Verify JWT" kapalı**; giriş ve yetkiyi (düzenleyici, çalışan) fonksiyon kendisi kontrol eder. Başka adla kaydolduysa `js/ayar.js`'teki `kitapFonksiyon` satırına o adı yaz.
   - Mevcut kurulumda SQL Editor'de `supabase/kapak-depo.sql`'i bir kez çalıştır (kapak fotoğrafları deposu; yeni kurulumda `kurulum.sql` içinde var).
   - Ücretsiz kota (Kasım 2026): `gemini-2.5-flash` ile Google Arama'lı cevap günde 500 istek; kapak okuma ve Google Kitaplar bundan ayrı sayılır.
5. **İlk yönetici:** `yonetim.html`'i aç. Hiç düzenleyici yokken "İlk kurulum" formu çıkar; ilk hesabı oradan oluştur. Diğer kişileri sonra Kullanıcılar sekmesinden ekle.

### Yeni projeye taşıma

Yeni Supabase projesinde yukarıdaki 1, 2, 4 ve 5. adımları yap, 3. adımda `js/ayar.js`'teki iki satırı yeni projeninkilerle değiştir. Program sıfır veriyle başlar.

## Deneme modu

Adrese `?yerel=1` eklenirse (`yonetim.html?yerel=1`) program buluta bağlanmaz. Veriler o cihazın tarayıcısında durur, giriş istenmez. Başka bir yetkinin ekranını görmek için örneğin `yonetim.html?yerel=1&rol=calisan` ya da `&rol=revizeci` kullanılır. Bu mod sunum ve deneme içindir.

## Geliştirme

Derleme adımı yok, düz HTML/CSS/JS.

```
python3 -m http.server 8000   # http://localhost:8000
npm test                      # birim testleri (Node 18+)
npm run test:fonksiyon        # kitap-bilgi sunucu fonksiyonunun testleri (Deno 2)
```

Kütüphaneler `vendor/` altında:
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8 (Apache-2.0): kamera ile barkod/QR okuma. Kamera yalnız https'te ya da localhost'ta açılır.
- [supabase-js](https://github.com/supabase/supabase-js) 2.49.4 (MIT)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT): raf etiketi ve "telefonuna al" QR'ları
