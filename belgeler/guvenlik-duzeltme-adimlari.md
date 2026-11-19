# Güvenlik düzeltmesi · yapacağınız tek adım (19 Kasım 2026)

Program yayında (GitHub Pages güncellendi). Talep sınırının ve yönetici bildiriminin çalışması için veritabanına bir SQL dosyası eklenmeli. Bunu yapana kadar program eskisi gibi çalışır (aşağıda "SQL'den önce").

## SQL dosyasını çalıştırın (5 dakika)

1. Şu adresi açın: https://raw.githubusercontent.com/barishnc-creator/kitabim-hangi-rafta/main/supabase/guvenlik-2026-11-19.sql
2. Sayfada bir yere tıklayın → **Ctrl+A** (Mac: Cmd+A) ile hepsini seçin → **Ctrl+C** (Cmd+C) ile kopyalayın.
3. https://supabase.com/dashboard adresine gidin → kırtasiye için açtığınız hesapla giriş yapın → **kitabim-hangi-rafta** projesine tıklayın.
4. Sol menüden **SQL Editor**'e tıklayın.
5. Üstteki **+** düğmesine (New query) tıklayın.
6. Boş alana tıklayıp **Ctrl+V** (Cmd+V) ile yapıştırın.
7. Sağ alttaki yeşil **Run** düğmesine tıklayın. Supabase "bu sorgu tablo/fonksiyon oluşturuyor" diye onay sorarsa **Run this query**'ye tıklayın.
8. Altta **Success. No rows returned** yazmalı. Kırmızı hata çıkarsa ekran görüntüsünü Claude'a gönderin.

Dosyayı iki kez çalıştırmak zararsızdır. Geri almak gerekirse: dosyanın başındaki "GERİ ALMA" bölümündeki beş satırı, başlarındaki `--` işaretlerini silerek aynı yere yapıştırıp **Run**.

## Nasıl denenir

1. Müşteri ekranını açın (https://barishnc-creator.github.io/kitabim-hangi-rafta/) → **Kitap talebi bırakın** → aynı telefon numarasıyla 6 kez talep bırakın.
2. İlk 5 talepte "Talebiniz alındı" çıkar. 6.'da talep kaydedilmez, müşteri şu mesajı görür: "Bu numarayla bugün en fazla 5 talep bırakılabiliyor; kırtasiye çalışanımız sizinle ilgilenecek."
3. Yönetim panelini açın (en geç 1 dakika içinde, ya da sayfayı yenileyin): en üstte turuncu şerit "Bu kişi birden fazla istek gönderiyor: 05XX XXX XX XX · 24 saatte 6 deneme · son …". Kişi tekrar denedikçe deneme sayısı artar.
4. Şeritteki **Okundu** düğmesine basın: şerit kapanır. Kişi yeniden denerse şerit yeniden açılır.
5. Denemeden sonra panelde **Talepler**'den deneme taleplerini silin (durumu "İptal" yapıp **Kapananları sil**).

Şeridi yalnız düzenleyici ve çalışan görür. Sınır 24 saattir: aynı numara ertesi gün yeniden talep bırakabilir.

## SQL'den önce ne çalışır, ne çalışmaz

- Çalışır: müşteri ekranı ve talep bırakma (eskisi gibi, sınırsız), yönetim paneli, Talepler sekmesi. Panelde bildirim şeridi hiç görünmez, hata da çıkmaz.
- Çalışmaz: kişi başı günde 5 talep sınırı, bildirim şeridi, arama kaydı sınırı (dakikada 30).

## Neler değişti, bilmeniz gerekenler

- **Talep sınırı:** aynı telefon numarası 24 saatte en çok 5 talep bırakabilir. Herkese toplam bir sınır yok. Müşteri ekranı giriş gerektirmez; telefon girilen form zaten zorunlu KVKK onay kutusu ve "Aydınlatma metni" bağlantısı içeriyor; onay zamanı sunucu saatiyle yazılır.
- **Arama kaydı** (rapor için): dakikada en çok 30 kayıt tutulur; fazlası sessizce kaydedilmez, arama yine çalışır.
- **Yönetim paneli oturumu:** sekme ya da tablete kurulu panel uygulaması kapanınca biter; çalışanlar her açılışta yeniden giriş yapar. Açık sekmede oturum açık kalır.
- **Hesap açma ve şifre:** değişmedi (kararınızla; tek yönetici hesabı var).
- **Bu oturum önlemi yarım çözümdür.** Program `barishnc-creator.github.io` adresinde; bu hesabın diğer GitHub Pages siteleri aynı "köken"i paylaşır. **Gerçek çözüm programı kendi adresine taşımaktır**: Cloudflare Pages ya da Vercel ücretsiz alt alan adı, veya satın alınacak bir alan adı. O zamana kadar bu GitHub hesabında başka Pages sitesi yayınlamayın. Taşıma kararı sizde.
- **Aydınlatma metni** "talebiniz sonuçlandıktan sonra en geç 90 gün içinde silinir" diyor; bu silme otomatik değil, panelden **Talepler**'de eski talepleri silerek yapılmalı.
