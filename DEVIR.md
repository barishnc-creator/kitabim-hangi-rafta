# Devir notu

_Son güncelleme: 16 Kasım 2026_

## Proje

Kırtasiye için "Kitabım Hangi Rafta?": müşteri ekranı (kiosk, `index.html`) kitabın raf/bölmesini gösterir; yönetim paneli (`yonetim.html`) raflar, kitaplar, okul listeleri, talepler, harita, etiketler, geçmiş, revizeler, kullanıcılar, ayarlar. Kullanıcı bunu bir kırtasiye müdürüne **sunup satacak**.

Yetkiler: düzenleyici (her şey), revize veren / müdür (revize yazar, görür), çalışan (kitap ekler/çıkarır). Revizeler programın kendisine dair isteklerdir; Claude'a iletilir.

## Yapılanlar (hepsi bitti, 34 birim testi geçiyor)

- Temel: raf/bölme şeması, barkod (kamera + fotoğraf + USB okuyucu), ISBN'den Google Books / Open Library ile otomatik bilgi ve kapak, CSV, QR raf etiketleri, fiyat/stok aç-kapa, roller, Supabase RLS.
- Profesyonel sürüm: kenar menülü panel, genel bakış panosu, kiosk karşılama ekranı, Türkçe ekran klavyesi, kapaklar.
- Altı gelişmiş özellik: okul listesi, gelince haber ver (KVKK onaylı), renk/logo, mağaza haritası, işlem geçmişi, internetsiz çalışma.
- `belgeler/`: müşteriye verilecek proje dokümanı (PDF + kaynağı `proje.html`, `node belgeler/yap.js` ile yeniden üretilir). İç kullanım fiyat notu kullanıcıda; depoda yok.
- `tests/e2e/`: Playwright senaryoları (yerel sunucu `python3 -m http.server 8765` ile).

## Kullanıcının kararları

- D&R görünümü beğenilmedi; kendi tasarımımız kalıyor, renk ayarlanabilir.
- Şimdilik ücretsiz altyapı; müdür onaylarsa ücretli yeni Supabase projesine sıfır veriyle taşınır.
- Fiyat paketleri (iç not): Başlangıç 20–30 bin TL + 750–1.250 TL/ay; Standart 40–60 bin TL + 1.250–2.000 TL/ay; Kiosk Standart + 10–15 bin TL.

## Sıradaki işler

1. **Supabase kurulumu (kullanıcı bilgisayardayken):** SQL Editor'de `supabase/kurulum.sql` çalıştır; Edge Function `kirtasiye-kullanici` (Verify JWT kapalı). Yeni Supabase hesabı açılırsa `js/ayar.js`'teki adres ve publishable anahtarı değiştir. (Supabase MCP onay penceresi kullanıcıya ulaşmadı; elle yapılacak.)
2. **GitHub Pages:** depo ayarlarından Pages'i `main` dalından aç; sunumda bu adres kullanılır.
3. Sunum: slayt sunusu hazır (claude.ai/artifact/DcQsrxVbtD3ER7ZxvUkAGN, kaynağı `belgeler/sunum/`). Fiyat yerleri `[₺__]`, teslim süresi, ad/telefon kullanıcı tarafından doldurulacak. Demo: `index.html?yerel=1&kiosk=1` ve `yonetim.html?yerel=1` (örnek veri: `tests/e2e/tohum.js`).
4. Gerçek cihazda kamera testi, Türkçe kitaplarda Google Books kapsamı.

## Açık sorular

- Yeni Supabase hesabı mı, ortak-muhasebe projesi mi? (Öneri: yeni Supabase hesabı.)
