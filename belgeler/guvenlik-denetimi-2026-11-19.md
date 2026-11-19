# Güvenlik denetimi · Kitabım Hangi Rafta? · 19 Kasım 2026

Yayın öncesi, salt okunur denetim (kod düzeltmesi yapılmadı). Kapsam: `supabase/` (kurulum.sql, kapak-depo.sql, iki Edge Function), `js/`, `index.html`, `yonetim.html`, `sw.js`.

## Özet

- **Kritik ve yüksek önemde bulgu yok.** RLS 10 tablonun hepsinde açık, yönetim işlemleri veritabanında (RLS) ve fonksiyonda (rol denetimi) korunuyor; istemcide yalnız gizlenen yetki yok. Depoda gizli anahtar yok.
- **3 orta önemde bulgu:** anonim talep/arama ekleme sınırsız (spam, KVKK yükü), oturum jetonu paylaşılan `github.io` kökeninde localStorage'da, Auth'ta herkese açık kayıt + 6 karakterlik şifre sınırı.
- **7 düşük önemde bulgu:** savunma derinliği (varsayılan tablo yetkileri, SECURITY DEFINER fonksiyonuna anon erişimi, CSP yok, ham hata mesajları vb.).

## Bulgular

| # | Önem | Yer (dosya:satır) | Ne olabilir | Nasıl düzeltilir |
|---|---|---|---|---|
| O1 | Orta | `supabase/kurulum.sql:173`, `:182`; `js/veri.js:332`; `js/musteri.js:219` | `kirtasiye_talepler` ve `kirtasiye_aramalar` tablolarına anonim (yayındaki publishable anahtarla) sınırsız ekleme yapılabilir. Bir betik binlerce sahte "gelince haber ver" talebi (geçerli biçimli başkasına ait telefon numaralarıyla) ya da arama kaydı basabilir: personel listesi dolar, rapor (en çok aranan/bulunamayan) bozulur, ücretsiz plan depolaması dolar, başkasının telefon numarası onaysız kaydedilmiş olur (KVKK). | Talep eklemeyi bir Edge Function'a taşıyıp Cloudflare Turnstile (ücretsiz) ya da IP başına hız sınırı koyun; ya da tetikleyiciyle son 1 dakikadaki kayıt sayısını sınırlayın (ör. dakikada 20). Aramalar için eski kayıtları düzenli silen bir `pg_cron` işi ekleyin. |
| O2 | Orta | `js/veri.js:171` (`createClient` varsayılan depolama = localStorage); yayın adresi `barishnc-creator.github.io/kitabim-hangi-rafta/` | Supabase oturumu (erişim + yenileme jetonu) localStorage'da durur. GitHub Pages'te aynı kullanıcının **tüm** depoları aynı kökeni (`barishnc-creator.github.io`) paylaşır; o hesaptaki başka bir Pages sayfası (ya da onda çıkacak bir XSS) panelin düzenleyici jetonunu okuyup kullanıcı yönetimi dahil her şeyi yapabilir. Service worker kapsamı yol ile sınırlı olsa da localStorage köken düzeyindedir. | Programı kendi alan adında (ör. özel domain, Cloudflare Pages ücretsiz) ya da yalnız bu programa ait ayrı bir GitHub hesabı/organizasyonunun Pages'inde yayınlayın. Kısa vadede bu hesapta başka Pages sitesi tutmayın. |
| O3 | Orta | Supabase Auth ayarı (`disable_signup: false`, canlıda doğrulandı); `supabase/functions/kirtasiye-kullanici/index.ts:53`, `:109` (şifre ≥ 6), `:35-45` ve `:87-91` (mevcut hesabı bağlama) | Herkes publishable anahtarla hesap açabilir (e-posta onayı gerekli). Rolsüz hesap RLS nedeniyle veri göremez, ama: (a) gereksiz saldırı yüzeyi, (b) düzenleyici bir çalışanı eklerken o e-posta önceden kaydolmuşsa fonksiyon mevcut hesabı **şifresine dokunmadan** bağlar (`kirtasiye_hesabi=false`), yani önceden kaydolan kişi o rolü alır (posta kutusunu kontrol etmesi gerekir; ekranda "mevcut hesap" uyarısı çıkıyor). 6 karakterlik şifre panel için zayıf. | Supabase → Authentication → Sign In / Providers → "Allow new users to sign up" kapatın (fonksiyon `admin.createUser` kullandığı için etkilenmez). Şifre sınırını fonksiyonda ve Auth ayarında en az 10–12 yapın. Mevcut hesap bağlanınca düzenleyiciye açık onay sordurun. |
| D1 | Düşük | `supabase/kurulum.sql:101-111` | Dosya yalnız gereken yetkileri veriyor ama Supabase'in varsayılan yetkileri (anon/authenticated'a tüm tablolarda ALL) geri alınmıyor. Canlıda anon `kirtasiye_uyeler`, `kirtasiye_gecmis`, `kirtasiye_revizeler`'i sorgulayınca "yetki yok" yerine `200 []` dönüyor: tek koruma RLS. Bir politika yanlışlıkla gevşetilirse veri doğrudan açılır. | `revoke all on <kirtasiye_ tabloları> from anon, authenticated;` ardından dosyadaki `grant` satırları. |
| D2 | Düşük | `supabase/kurulum.sql:219-222` | `kirtasiye_bolme_kodu` SECURITY DEFINER ve `revoke` yok; anon RPC ile çağırabiliyor (canlıda `200 null`). Verdiği bilgi zaten herkese açık, bu yüzden etkisi yok; ama SECURITY DEFINER fonksiyonların herkese açık bırakılması alışkanlık olarak riskli. (`search_path` sabitlenmiş: iyi.) | `revoke all on function public.kirtasiye_bolme_kodu(uuid) from public, anon, authenticated;` (tetikleyici sahibin yetkisiyle çalıştığı için etkilenmez) ya da SECURITY INVOKER yapın. |
| D3 | Düşük | `supabase/kurulum.sql:71`, `:194`; `js/veri.js:399-403` | Revizedeki `yazan_ad` istemciden geliyor ve politikada denetlenmiyor: revize veren biri başka birinin adıyla revize yazabilir (`yazan` uuid'i doğru kalır). | `yazan_ad`'ı `kirtasiye_uyeler`'den dolduran bir BEFORE INSERT tetikleyicisi ekleyin. |
| D4 | Düşük | `supabase/kurulum.sql:41` (`kapak like 'https://%'`), `:154-156` | Çalışan, kitabın kapak alanına herhangi bir https adresi yazabilir; müşteri ekranı bu görseli dış sunucudan yükler (izleme pikseli, uygunsuz görsel). İstemci tarafında `Depo.kapakAdresi` ve `O.kacis` olduğu için XSS'e dönüşmüyor. | Kapak adresini izinli alan adlarıyla sınırlayın (books.google.com, covers.openlibrary.org, proje storage adresi) — CHECK kısıtı ya da tetikleyici. |
| D5 | Düşük | `supabase/functions/kitap-bilgi/index.ts:213-237`, `:271-275` | Yetkili çalışan sınırsız sayıda istek atıp Gemini kotasını tüketebilir ve herkese açık `kapaklar` deposuna yükleme yapabilir; yapay zekâ hata verdiğinde içerik JPEG olup olmadığına bakılmadan (yalnız base64 ve boyut denetimi) kaydedilir. İçerik türü `image/jpeg` zorlandığı için tarayıcıda betik çalışması beklenmez. | Kayıttan önce JPEG sihirli baytlarını (`FF D8 FF`) denetleyin; kullanıcı başına günlük istek sınırı koyun. |
| D6 | Düşük | `index.html`, `yonetim.html` (CSP yok); iki fonksiyonda `Access-Control-Allow-Origin: *` | Bugün XSS bulunmadı, ama ileride çıkacak bir hatanın etkisini sınırlayacak Content-Security-Policy yok. CORS `*` jeton Bearer başlığıyla gittiği için tek başına açık değil. | `<meta http-equiv="Content-Security-Policy">` ile `script-src 'self'` (satır içi betik nonce/hash ile ya da dosyaya taşınarak), `connect-src` Supabase + Google/Open Library, `img-src 'self' https: data:`. CORS'u yayın adresiyle sınırlayın. |
| D7 | Düşük | `supabase/functions/kirtasiye-kullanici/index.ts:44`, `:126`; `kitap-bilgi/index.ts:279` | Fonksiyonlar iç hata metnini (Auth/DB mesajı) olduğu gibi döndürüyor; iç yapı hakkında bilgi sızdırır. | Kullanıcıya genel mesaj, ayrıntıyı `console.error` ile loga yazın. |

## Olumlu bulgular (kontrol edilip sorun bulunmayanlar)

- **RLS / IDOR:** 10 tablonun hepsinde `enable row level security` var. Anonim kiosk yalnız raf, bölme, kitap, ayar ve okul listelerini okuyabilir (müşteri ekranı için tasarım gereği). Talepler (ad, telefon) yalnız düzenleyici ve çalışana açık; anonim yalnız ekler, okuyamaz. Üyeler tablosuna istemciden yazma yetkisi yok; rol değişikliği yalnız fonksiyonda ve düzenleyici denetimiyle. Kullanıcı kendi rolünü yükseltemez. Satır sahipliğine dayalı (başkasının kaydı) bir model olmadığı için klasik IDOR yok; erişim role göre ve tutarlı.
- **Yönetim yetkisi sunucuda:** panel sekmeleri istemcide gizleniyor ama her yazma RLS (`kirtasiye_rol()`) ya da fonksiyondaki `kirtasiye_uyeler` denetimiyle korunuyor. "Son düzenleyici kaldırılamaz" kuralı var. `ilk-kurulum` yalnız hiç düzenleyici yokken çalışıyor; canlıda `kurulumGerekli: false` (kapalı).
- **Anahtarlar:** `js/ayar.js` yalnız `sb_publishable_` anahtarı içeriyor; depoda (tek commit dahil) `service_role`, `sb_secret_`, JWT, Google `AIza…` anahtarı ya da şifre bulunmadı. Google anahtarı Edge Function gizli değerinde.
- **SQL fonksiyonları:** `kirtasiye_rol`, `kirtasiye_bolme_kodu`, `kirtasiye_gecmis_kaydet` SECURITY DEFINER ve hepsinde `set search_path = public`. Dinamik SQL yalnız `do` bloklarında sabit tablo adı dizisiyle ve `format('%I')` ile; kullanıcı girdisi yok. İstemci sorguları supabase-js ile parametreli; SQL enjeksiyonu yolu bulunmadı. Geçmiş tetikleyicisinin fonksiyonu `revoke all ... from public`.
- **XSS:** `innerHTML`'e giden tüm veritabanı/kullanıcı metinleri `Ortak.kacis` ile kaçırılıyor (kitap adı, yazar, okul, revize, talep, kullanıcı adı, geçmiş). Kapak adresi `Depo.kapakAdresi` (yalnız tırnaksız https) + kaçış; logo `Depo.duzelt`/`Tema.logoGecerli` ile tam base64 deseniyle doğrulanıyor; harita planı `planDuzelt` ile sayıya ve izinli türlere indirgeniyor. URL'ye yönlendiren kod yok. CSV dışa aktarmada formül enjeksiyonuna karşı `'` öneki var (`js/csv.js:44-48`).
- **Oturum:** giriş supabase-js `signInWithPassword` ile; özel JWT işleme, `alg` seçimi ya da istemcide imza doğrulama yok. Fonksiyonlar jetonu `auth.getUser` ile sunucuda doğruluyor (Verify JWT kapalı olsa da). PIN mantığı yok.
- **Service worker:** yalnız aynı kökenli statik dosyaları ve Google Fonts'u önbelleğe alıyor; Supabase ve Google veri istekleri, POST'lar önbelleğe girmiyor. Çevrimdışı kopya (`localStorage`) yalnız herkese açık kitap/raf verisi; talepler önbelleklenmiyor.

## Doğrulanmış / doğrulanmamış

**Canlıda doğrulandı** (19 Kasım, salt okunur istekler, yalnız publishable anahtarla, `kkcfzrchrdiroiskibhw.supabase.co`):
- `GET /auth/v1/settings`: `disable_signup: false`, `mailer_autoconfirm: false` (kayıt açık, e-posta onayı zorunlu) → O3.
- Anonim `select` → `kirtasiye_talepler`, `kirtasiye_uyeler`, `kirtasiye_gecmis`, `kirtasiye_revizeler`, `kirtasiye_aramalar`: hepsi `200 []` (RLS veri vermiyor; ama yetki hatası da yok) → D1.
- Anonim `kirtasiye_kitaplar`: 88 kayıt okunabiliyor (tasarım gereği).
- Kullanıcı fonksiyonu `smart-processor` `{"islem":"durum"}` → `kurulumGerekli: false` (ilk kurulum kapalı).
- `rpc/kirtasiye_bolme_kodu` anon çağrılabiliyor → D2.
- `kapaklar` deposu anon listeleme → `[]` (listeleme kapalı).

**Doğrulanmadı:**
- Canlı `pg_policies` ve Supabase güvenlik danışmanı (`get_advisors`): proje kullanıcının ayrı Supabase hesabında, Claude'un Supabase MCP bağlantısında yok (yalnız `ortak-muhasebe` ve `csn` görünüyor). Canlı politikaların `kurulum.sql` ile aynı olduğu varsayıldı; DEVIR'e göre bulutta geçmiş tetikleyicisi eski sürüm.
- Yazma gerektiren testler bilerek yapılmadı: anonim talep spam'i (O1), rolsüz kayıtlı hesabın davranışı, kitap-bilgi fonksiyonunun hız sınırı.
- Auth tarafındaki asgari şifre uzunluğu, sızmış şifre koruması, giriş denemesi hız sınırları (panelden bakılmalı).
- O2: kullanıcının aynı GitHub hesabında başka Pages sitesi olup olmadığı.

## Yöntem

- Statik kod incelemesi (tüm SQL, iki Edge Function, `js/*.js` içindeki HTML sink'leri, `sw.js`, gizli anahtar taraması: mevcut dosyalar + git geçmişi) ve yukarıdaki salt okunur canlı istekler.
- Kontrol listesi olarak açık kaynak **Claude-Red** skill koleksiyonu (github.com/SnailSploit/Claude-Red, `--depth 1` klon) kullanıldı: `Skills/web/offensive-idor`, `Skills/auth/offensive-jwt`, `Skills/web/offensive-sqli`, `Skills/web/offensive-xss` SKILL.md metinleri yalnız okundu; depodaki hiçbir betik çalıştırılmadı. Ek olarak OWASP Top 10 / Supabase RLS en iyi uygulamaları.
- **Claude-Red lisansı: MIT License** (Copyright (c) 2024-2025 SnailSploit / Kai Aizen).

## Önerilen sıra

1. O3: Auth'ta kaydı kapatın, şifre sınırını yükseltin (5 dakika, panelden).
2. O1: talep eklemeye Turnstile ya da hız sınırı.
3. O2: kendi alan adına geçiş (müdüre satış öncesi de profesyonel görünür).
4. D1 + D2 + D3: tek SQL dosyasıyla (`kurulum.sql`'e ekleyip yeniden çalıştırma).

## Düzeltme durumu (19 Kasım 2026, `claude/guvenlik-duzeltme` dalı)

Elle yapılacak adımlar: `belgeler/guvenlik-duzeltme-adimlari.md`. Canlıya henüz uygulanmadı.

- **O1:** `supabase/guvenlik-2026-11-19.sql`: BEFORE INSERT tetikleyicisi. Talep: aynı telefondan 24 saatte ≤ 5, toplam 10 dakikada ≤ 30 (aşınca anlaşılır hata); arama: dakikada ≤ 30 (fazlası hata vermeden atlanır). Kayıt zamanı sunucuda `now()` (istemci eski tarihle sınırı atlatamaz). Alan uzunlukları ve zorunlu KVKK onayı (`onay boolean check (onay)`, formda kutucuk + aydınlatma metni) zaten vardı. Turnstile/IP sınırı eklenmedi (ek servis gerektirir); toplam sınır betikli spam'i saatte en çok 180 taleple sınırlar. Testler: `npm run test:sql` (yerel PostgreSQL, 7 kontrol).
- **O2:** `js/veri.js`: supabase-js oturumu `sessionStorage`'da, anahtar `kitabim-hangi-rafta-oturum`; eski `sb-…-auth-token` localStorage kaydı silinir. Kalan risk: aynı sekmede açılan başka bir `barishnc-creator.github.io` sayfası sessionStorage'ı da okuyabilir. **Gerçek çözüm ayrı köken:** Cloudflare Pages ya da Vercel ücretsiz alt alan adı veya özel alan adı. Kiosk girişsiz çalıştığı için etkilenmez; panel sekme kapanınca yeniden giriş ister.
- **O3:** `kirtasiye-kullanici/index.ts`: şifre ≥ 10; önceden kayıtlı e-posta artık role bağlanmıyor, reddediliyor (ilk kurulumdaki davranışla aynı). Depoda `supabase/config.toml` yok; kayıt kapatma ve Auth asgari şifre uzunluğu panelden (adımlar belgesi, 2. adım). Testler: `npm run test:fonksiyon` (4 yeni).
