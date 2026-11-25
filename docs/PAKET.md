# PAKET — Kitabım Hangi Rafta

Son güncelleme: 25 Kas 2026. Bu işin güncellemeleri ve revizeleri yalnız bu paketin tek oturumundan yürür ("Kitabım Hangi Rafta" başlıklı, sol menüde sabitli). Oturum başında önce `DEVIR.md`, sonra bu dosya okunur.

## Amaç
Kırtasiye için raf takip programı: müşteri ekranı (kiosk, `index.html`) kitabın raf/bölmesini gösterir; yönetim paneli (`yonetim.html`) raflar, kitaplar, okul listeleri, talepler, harita, etiketler, geçmiş, revizeler, kullanıcılar, ayarlar. Kullanıcı bunu bir kırtasiye müdürüne sunup satacak. Düz HTML/CSS/JS, derleme yok.

## Şu anki durum (25 Kas 2026)
- Canlı ve çalışıyor (GitHub Pages, main). Kullanıcı canlı sistemi deneyip revize verecek; teklif kırtasiye müdürüne sunuldu, sonucu kullanıcı paylaşacak.
- Canlıda 0 kitap (22 Kas'ta tüm kitaplar silindi; silme nedeni bilinmiyor). Raflar, ayarlar, talepler, okul listeleri duruyor. Bölme özelliği kapalı (raflar bölmesiz).
- Testler: 85 birim + fonksiyon testi, 10 Playwright senaryosu (`tests/`, `npm test`).
- Kullanıcı kararı (23 Kas): "Kitabım oturumunda bir şey yapma, ben ilerletirim" → oturum yalnız kullanıcı istediğinde iş yapar, kendiliğinden başlamaz.

## Tamamlananlar (özet; ayrıntı DEVIR.md)
Raf/bölme şeması, barkod (kamera, fotoğraf, USB; iPhone'da doğrulandı), ISBN'den otomatik bilgi/kapak, CSV/Excel, QR raf etiketleri, roller + Supabase RLS, okul listesi, talep oluşturma (KVKK onayı kaldırıldı, ad/telefon isteğe bağlı), renk/logo, mağaza haritası, işlem geçmişi, çevrimdışı çalışma (IndexedDB), şube eksikleri Excel çıktısı, uygulama olarak kurulum (kiosk + yönetim manifestleri), hata kaydı + Sistem durumu sekmesi, 90 gün otomatik silme (pg_cron), toplu kitap silme, proje dokümanı PDF (`belgeler/`), sunum (27 slayt, kaynağı `belgeler/sunum/`), sesli tanıtım videosu (`pazarlama/video/`, yeniden üretilebilir).

## Açık işler / sıradaki adımlar
1. Kullanıcıdan doğru ürün listesi gelirse "Ürün girişi" ile yükle (yüklemeden önce dosyayı kontrol et; silme nedeni hâlâ bilinmiyor).
2. Kullanıcının canlı denemesinden gelen revizeler (panel Revizeler sekmesi; haftalık kontrol görevi listeler).
3. Android tablette kamera testi; Microsoft Excel ile gerçek şube listesi denemesi; Türkçe kitaplarda Google Books kapsamı.
4. Karar bekliyor: Google arama (grounding) için faturalandırma açılsın mı? Açılmazsa akış: Google Kitaplar → Open Library → "Kapaktan doldur".
5. Teklif sonucuna göre: müdür onaylarsa ücretli yeni Supabase projesine sıfır veriyle taşıma.

## Kararlar ve tercihler (bu işe özel)
- Kendi tasarımımız kalır (D&R görünümü beğenilmedi), renk ayarlanabilir.
- Şimdilik ücretsiz altyapı. Paketler yalnız Standart ve Kiosk. Şube eksiklerinde adet yok. Talepte KVKK onayı yok, telefon isteğe bağlı.
- Fiyat notu iç kullanım: kullanıcıda, bu (açık) depoya yazılmaz. Müşteri/mağaza kişisel verisi ve gizli anahtar depoya yazılmaz.

## Kimlikler
- Depo (açık): github.com/barishnc-creator/kitabim-hangi-rafta, dal main. Müşteri ekranı: barishnc-creator.github.io/kitabim-hangi-rafta/ ; panel: .../yonetim.html
- Supabase: ayrı proje `kitabim-hangi-rafta`, ref `kkcfzrchrdiroiskibhw`, eu-central-1; kullanıcının kırtasiye için açtığı ayrı hesapta, Claude'un Supabase MCP bağlantısında YOK: veritabanı değişikliği SQL Editor'den kullanıcıya yaptırılır (SQL dosyaları `supabase/`). Kullanıcı fonksiyonu panelde `smart-processor` adıyla.
- Hata/revize izleme: `kirtasiye_izle` (x-izleme-token başlığı; anahtar Claude ortamının ağ sırrında, kullanıcı `request_credential` ile girdi; yeniden üretmek eskisini iptal eder).
- Zamanlanmış görev: trig_01FDny2tc8RmeaLkLCAPmcFG "Kitabım Hangi Rafta – hata ve revize kontrolü" — 25 Kas'ta günlükten HAFTALIĞA indirildi (cron `CRON_TZ=Europe/Istanbul 47 19 * * 5`, cuma 19:47, telefona bildirim, yeni oturumda yalnız okur).
- Sunum artifact: claude.ai/artifact/DcQsrxVbtD3ER7ZxvUkAGN (26 slayt sürümü); fiyat yerleri kullanıcı tarafından doldurulacak.

## Skill ve araçlar
Depoda `.claude/skills` yok. Hesap skill'leri: `anthropic-skills:pptx` / `sunum-kalitesi` (sunum), `pdf` (proje dokümanı), `tasarim-paketi` (arayüz), `kod-video-paketi` (tanıtım videosu), `yazilim-test-ve-hata-ayiklama`, `guvenlik-denetimi` (yayın öncesi). Araçlar: Playwright e2e, Supabase SQL Editor (kullanıcı), curl ile REST testi (ağ izin listesinde proje adresi var).

## Bilinen sorunlar / dersler
- Çok bulanık fotoğrafta ZXing tutarlı yanlış sayı okuyabiliyor (kontrol hanesi tutuyor); vendor dosyası değiştirilmedi.
- Google Kitaplar kotası iPhone "okumuyor" sanılan sorunun asıl nedeniydi.
- Push edilmeden oturum arşivlenmez (kapsayıcı silinir). Bağlam 200 bine yaklaşınca devir: DEVIR.md + bu dosyayı güncelle, push, kullanıcıdan uygulamada yeni sohbet açıp "Kitabım Hangi Rafta, kaldığın yerden devam" yazmasını iste.

## Eski oturumlar (hepsi arşivli; bilgi DEVIR.md'de)
Kütüphane yönetim sistemi (ilk kurulum, 16 Kas) · Kitabım devam zinciri 18–22 Kas (TyhaJ, BE3, 9ZFv, 7m2b, A2Sb, 87YN, AZk2) · tanıtım videosu (7XUG, 22 Kas) · "Merhaba" (sunum artifact'ı, 16 Kas). Aktif tek oturum: session_01Ry9EY8UXw8qHGwyA8fZ2Kx.
