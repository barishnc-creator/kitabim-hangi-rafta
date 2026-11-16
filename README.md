# Kitabım Hangi Rafta?

Kırtasiye için raf takip programı. Çalışanlar rafları ve bölmeleri (1.1, 1.2 …) kurar, kitapları barkodla ya da elle ekler. Müşteri dükkândaki ekranda kitabın adını yazar ya da barkodunu okutur; program kitabın hangi raf ve bölmede olduğunu söyler ve raf şemasında o bölmeyi turuncuyla gösterir.

## Öne çıkanlar

- **Müşteri ekranı (kiosk):** karşılama ekranı, dokunmatik Türkçe ekran klavyesi (`?kiosk=1`), kapak görselli sonuçlar, büyük raf/bölme kartı ve raf şeması, stok rozeti (Rafta var / Son N adet / Tükendi), raflara göre gezinme, yeni gelenler, raf etiketindeki QR okutulunca bölme içeriği, "Telefonunuza alın" QR'ı, 90 sn boşta kalınca başa dönme, tam ekran.
- **Yönetim paneli:** Genel bakış panosu (kitap/raf/bölme sayıları, en çok arananlar, aranıp bulunamayanlar, son eklenenler, raf doluluğu), kitap tablosu (arama, raf filtresi), çekmece formunda barkoddan otomatik bilgi ve kapak, Excel (CSV) içe/dışa aktarma, QR'lı raf etiketi yazdırma, revizeler, kullanıcılar ve yetkiler, mağaza adı ve fiyat/stok ayarları.

- **Okul listeleri:** okulun listesi yapıştırılır, kitaplarla otomatik (yazım hatasına dayanıklı) eşleştirilir; veli müşteri ekranında okul → sınıf seçip listedeki kitapları raf ve stok durumuyla görür.
- **Gelince haber ver:** bulunamayan ya da tükenen kitap için müşteri ad ve telefon bırakır (KVKK onaylı); panelde Talepler sekmesinden takip edilir.
- **Mağaza haritası:** raflar kat planına sürüklenerek yerleştirilir; müşteri ekranı "Buradasınız"dan rafa yolu gösterir.
- **Görünüm:** mağazanın logosu, ana rengi ve karşılama yazısı.
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

## Kurulum (Supabase)

1. **Veritabanı:** Supabase panelinde SQL Editor'ü aç, `supabase/kurulum.sql` dosyasının içeriğini yapıştır, Run'a bas. Tüm tablolar `kirtasiye_` ile başlar; aynı projedeki başka uygulamalara dokunmaz. Dosya tekrar çalıştırılabilir.
2. **Kullanıcı sunucusu:** Edge Functions bölümünde `kirtasiye-kullanici` adıyla yeni bir fonksiyon oluştur. İçeriği `supabase/functions/kirtasiye-kullanici/index.ts` dosyasından al. **"Verify JWT" kapalı olmalı**; fonksiyon girişi kendisi kontrol ediyor. CLI ile: `supabase functions deploy kirtasiye-kullanici --no-verify-jwt`.
3. **Adres ve anahtar:** `js/ayar.js` içindeki proje adresini ve `sb_publishable_` anahtarını yaz. Gizli (service role) anahtar buraya **asla** yazılmaz.
4. **İlk yönetici:** `yonetim.html`'i aç. Hiç düzenleyici yokken "İlk kurulum" formu çıkar; ilk hesabı oradan oluştur. Diğer kişileri sonra Kullanıcılar sekmesinden ekle.

### Yeni projeye taşıma

Yeni Supabase projesinde yukarıdaki 1, 2 ve 4. adımları yap, 3. adımda `js/ayar.js`'teki iki satırı yeni projeninkilerle değiştir. Program sıfır veriyle başlar.

## Deneme modu

Adrese `?yerel=1` eklenirse (`yonetim.html?yerel=1`) program buluta bağlanmaz. Veriler o cihazın tarayıcısında durur, giriş istenmez. Başka bir yetkinin ekranını görmek için örneğin `yonetim.html?yerel=1&rol=calisan` ya da `&rol=revizeci` kullanılır. Bu mod sunum ve deneme içindir.

## Geliştirme

Derleme adımı yok, düz HTML/CSS/JS.

```
python3 -m http.server 8000   # http://localhost:8000
npm test                      # birim testleri (Node 18+)
```

Kütüphaneler `vendor/` altında:
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8 (Apache-2.0): kamera ile barkod/QR okuma. Kamera yalnız https'te ya da localhost'ta açılır.
- [supabase-js](https://github.com/supabase/supabase-js) 2.49.4 (MIT)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT): raf etiketi ve "telefonuna al" QR'ları
