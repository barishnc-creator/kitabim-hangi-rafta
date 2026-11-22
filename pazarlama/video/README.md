# Tanıtım videosu

Kırtasiye/kitapçı müdürlerine gösterilecek ~44 sn'lik tanıtım. Dikey 1080×1920 (Reels/WhatsApp) ve yatay 1920×1080.
Yöntem: /brag (brag-slim) iş akışı; video bir HTML sayfasında kare kare çizilir, Playwright + ffmpeg ile yerelde MP4'e döker. Ücretli servis yok.

## Akış (110 BPM, kesmeler vuruşta)

| Süre | Sahne |
|---|---|
| 0–4,6 sn | Kanca: "Bu kitap hangi rafta?" |
| 4,6–9 | Sorun: çalışan raf raf arar, müşteri bekler; defter/Excel/akılda tutmak üstü çizilir |
| 9–12,3 | Ürün: Kitabım Hangi Rafta? |
| 12,3–21 | Müşteri ekranı: "kürk" yazılır → 3. Raf · Bölme 3.1 → mağaza haritasında yol |
| 21–26,5 | Okul listesi (telefon) |
| 26,5–32,5 | Talep: bulunamayan kitap → panelde en çok istenen üstte |
| 32,5–37,9 | Excel ile ürün girişi → barkodla rafa yerleştir |
| 37,9–43,9 | "Müşteri beklemez. Çalışan aramaz." → kapanış, ücretsiz deneme, **[İLETİŞİM BİLGİSİ]** yer tutucusu |

## Yeniden üretmek

```bash
python3 -m http.server 8765                      # depo kökünde, ayrı terminal
node pazarlama/video/yakala.js pazarlama/video/kareler   # ekran görüntüleri (sahte örnek veri)
node pazarlama/video/yap.js v                    # dikey  → pazarlama/video/cikti/
node pazarlama/video/yap.js h                    # yatay
node pazarlama/video/yap.js v kare 15,30         # yalnız kontrol kareleri
```

- Müzik ve efektler brag deposundan: `git clone https://github.com/latent-spaces/brag ~/.cache/acik-kaynak/brag` (yollar `MUZIK`, `SFX` ortam değişkenleriyle değişir).
- Müzik: "Happy Beats / Business Moves Vol. 10", Sascha Ende (ende.app), **CC BY 4.0**: paylaşımda kaynak belirtilmeli (videonun sonunda yazıyor). Efektler: Kenney (CC0).
- İletişim bilgisi `sahne.html` içinde `id="iletisim"` satırında.
- Videodaki veriler sahtedir (Örnek Kırtasiye, örnek kitaplar, telefon numaraları gizli).
- `kareler/` ve `cikti/` depoya girmez.
