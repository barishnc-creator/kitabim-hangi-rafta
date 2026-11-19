# Güvenlik düzeltmesi · elle yapılacak adımlar (19 Kasım 2026)

Kod hazır, `claude/guvenlik-duzeltme` dalında. Canlı sisteme henüz hiçbir şey uygulanmadı. Aşağıdaki 5 adımı sırayla yapın; toplam 15 dakika kadar sürer. Her adım tek başına geri alınabilir.

Supabase'e girerken: https://supabase.com/dashboard → sağ üstten doğru hesapla giriş → programın projesine tıklayın (proje adresi `kkcfzrchrdiroiskibhw.supabase.co`; proje ayarlarında "Project ID" olarak görünür).

---

## 1. Veritabanı sınırını kur (SQL'i çalıştır)

Ne işe yarar: müşteri ekranından aynı telefonla günde en çok 5, toplamda 10 dakikada en çok 30 talep bırakılabilir; arama kayıtları dakikada 30 ile sınırlanır. Kötü niyetli biri binlerce sahte talep basamaz.

1. GitHub'da depoyu açın, dal seçicisinden (sol üstte `main` yazan düğme) **claude/guvenlik-duzeltme** dalını seçin.
2. `supabase` klasörü → `guvenlik-2026-11-19.sql` dosyasına tıklayın → sağ üstteki **kopyala** simgesine (iki üst üste kare, "Copy raw file") tıklayın.
3. Supabase'de sol menüden **SQL Editor**'e tıklayın.
4. Üstte **+** (New query) düğmesine tıklayın.
5. Boş alana yapıştırın (Ctrl+V / Cmd+V) → sağ alttaki yeşil **Run** düğmesine tıklayın.
6. Altta **Success. No rows returned** yazmalı. Kırmızı hata çıkarsa ekran görüntüsünü Claude'a gönderin.

Geri almak isterseniz: dosyanın başındaki "GERİ ALMA" bölümündeki üç satırı (başlarındaki `--` işaretlerini silerek) aynı yere yapıştırıp **Run**.

## 2. Herkese açık kaydı kapat ve şifre sınırını yükselt

Ne işe yarar: yabancılar kendi kendine hesap açamaz; hesapları yalnız panelde düzenleyici açar (bu yol etkilenmez).

1. Supabase'de sol menüden **Authentication**'a tıklayın.
2. Açılan menüde **Sign In / Providers**'a tıklayın (eski görünümde: **Providers**).
3. **User Signups** bölümünde **Allow new users to sign up** anahtarını **kapalı** yapın → **Save changes**.
4. Aynı sayfada **Email** satırına tıklayın → **Minimum password length** kutusuna **10** yazın → **Save**.

Not: mevcut çalışanların eski (kısa) şifreleri girişte çalışmaya devam eder. Bir çalışanın şifresini değiştirmek için panelde **Kullanıcılar → Şifre** düğmesini kullanın (artık en az 10 karakter ister).

## 3. Kullanıcı fonksiyonunu yeniden yükle (deploy)

Ne işe yarar: panelden yeni kişi eklerken şifre en az 10 karakter olur; e-posta önceden kayıtlıysa o hesap sessizce bağlanmaz, panel uyarı verir.

1. GitHub'da (yine **claude/guvenlik-duzeltme** dalında) `supabase/functions/kirtasiye-kullanici/index.ts` dosyasını açın → **kopyala** simgesine tıklayın.
2. Supabase'de sol menüden **Edge Functions**'a tıklayın.
3. Listede **smart-processor** adlı fonksiyona tıklayın (programdaki kullanıcı fonksiyonu bu adla kayıtlı).
4. Üstte **Code** sekmesine tıklayın.
5. Editördeki her şeyi seçin (Ctrl+A / Cmd+A), silin, kopyaladığınızı yapıştırın.
6. Sağ alttaki **Deploy updates** (ya da **Deploy**) düğmesine tıklayın; yeşil "deployed" bildirimi çıkmalı.
7. **Details** sekmesinde **Verify JWT** ayarına dokunmayın (eskisi nasılsa öyle kalsın).

Geri almak için: `main` dalındaki aynı dosyayı aynı yolla yapıştırıp Deploy edin.

## 4. Yayına al (GitHub Pages)

Ne işe yarar: yönetim paneli oturumu artık tarayıcının kalıcı hafızası yerine yalnız o sekmede tutulur.

Bu adım `main` dalına birleştirme demektir ve dışarıya yayındır; Claude'a "güvenlik düzeltmesini yayına al" demeniz yeterli ya da kendiniz:

1. GitHub'da depoda **Pull requests** → **New pull request**.
2. **base: main**, **compare: claude/guvenlik-duzeltme** seçin → **Create pull request** → **Merge pull request** → **Confirm merge**.
3. 1–2 dakika sonra **Actions** sekmesinde yeşil tik görünür; site kendiliğinden güncellenir.

## 5. Dene

1. Kiosk ekranını açın, bir kitap için "Gelince haber verilsin" talebi bırakın: eskisi gibi çalışmalı.
2. Panele girin; sekmeyi/uygulamayı kapatıp yeniden açın: **yeniden giriş ister** (bu bilinçli, aşağıya bakın).
3. Panelde **Kullanıcılar**'dan 9 karakterlik şifreyle kişi eklemeyi deneyin: "Şifre en az 10 karakter olmalı." uyarısı çıkmalı.

---

## Neler değişti, bilmeniz gerekenler

- **Kiosk (müşteri ekranı) değişmedi.** Giriş gerektirmez, gün boyu açık kalabilir. Telefon girilen tek form ("Gelince haber ver" / "Kitap talebi") zaten zorunlu KVKK onay kutusu ve "Aydınlatma metni" bağlantısı içeriyordu; onay olmadan talep kaydedilmez (veritabanı da reddeder). Onay zamanı artık sunucu saatiyle yazılır. Yalnız sınır aşılırsa müşteri "Bu telefon numarasıyla bugün yeterince talep bırakıldı…" mesajını görür.
- **Yönetim paneli:** oturum, sekme ya da tablete kurulu panel uygulaması kapanınca biter; çalışanlar her açılışta yeniden giriş yapar. Aynı anda açık sekmeler arasında oturum paylaşılmaz.
- **Bu önlem yarım çözümdür.** Program `barishnc-creator.github.io` adresinde; bu hesabın diğer GitHub Pages siteleri aynı "köken"i paylaşır. Oturum artık kalıcı hafızada değil ama o sekmede başka bir `barishnc-creator.github.io` sayfası açılırsa yine okunabilir. **Gerçek çözüm programı kendi adresine taşımaktır**: Cloudflare Pages (`kitabim-hangi-rafta.pages.dev`) ya da Vercel (`….vercel.app`) ücretsiz alt alan adı, veya satın alınacak bir alan adı. O zamana kadar bu GitHub hesabında başka Pages sitesi yayınlamayın. Taşıma kararı sizde; isterseniz Claude adım adım yapar.
- **Aydınlatma metni** "talebiniz sonuçlandıktan sonra en geç 90 gün içinde silinir" diyor; bu silme şu an otomatik değil, panelden **Talepler**'de eski talepleri silerek yapılmalı (ya da ileride otomatik silme eklenebilir).
