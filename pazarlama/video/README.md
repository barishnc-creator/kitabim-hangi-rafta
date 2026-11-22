# Tanıtım videosu

Kırtasiye/kitapçı müdürlerine gösterilecek ~50 sn'lik tanıtım. Dikey 1080×1920 (Reels/WhatsApp) ve yatay 1920×1080.
Yöntem: /brag (brag-slim) iş akışı; video bir HTML sayfasında kare kare çizilir, Playwright + ffmpeg ile yerelde MP4'e döker. Ücretli servis yok.

## Akış (110 BPM, kesmeler vuruşta)

| Süre | Sahne |
|---|---|
| 0–4,6 sn | Kanca: "Bu kitap nerede?" |
| 4,6–9 | Bugün mağazada: personel raf raf arar, müşteri bekler, sonra gider |
| 9–12,3 | Ürün: Kitabım Hangi Rafta? · kırtasiye ve kitapçılar için |
| 12,3–21 | Müşteri ekranı: kitabı adından ara → 3. Raf · Bölme 3.1 → haritada yol |
| 21–26,5 | Okul kitap listeleri (telefon) |
| 26,5–32,5 | Satış kaçmasın: talep → panelde hangi kitap kaç kez istendi |
| 32,5–36,9 | Reklam alanı: kampanyalar müşteri ekranında |
| 36,9–42,3 | Mal girişi Excel'le → barkodla rafa yerleştir |
| 42,3–50,4 | "Müşteri beklemez. Çalışan aramaz." → "Kitabınızı arayın, rafını ekran göstersin." · Tidex Technology · canlı deneme · tidextechnology@gmail.com |

Metin ve görünüm kullanıcının son sunumuna (Kitabım Hangi Rafta Sunum.pptx, 27 slayt) uyarlandı.

## Yeniden üretmek

```bash
python3 -m http.server 8765                      # depo kökünde, ayrı terminal
node pazarlama/video/yakala.js pazarlama/video/kareler   # ekran görüntüleri (sahte örnek veri)
node pazarlama/video/anlatim.js [Kore]           # sesli anlatım (Gemini TTS ücretsiz kota, tek istek) → cikti/ses/
node pazarlama/video/yap.js v                    # dikey  → pazarlama/video/cikti/ (anlatım varsa eklenir, müzik altında kısılır)
node pazarlama/video/yap.js h                    # yatay
node pazarlama/video/yap.js v kare 15,30         # yalnız kontrol kareleri
```

- Müzik ve efektler brag deposundan: `git clone https://github.com/latent-spaces/brag ~/.cache/acik-kaynak/brag` (yollar `MUZIK`, `SFX` ortam değişkenleriyle değişir).
- Müzik: "Happy Beats / Business Moves Vol. 10", Sascha Ende (ende.app), **CC BY 4.0**: paylaşımda kaynak belirtilmeli (videonun sonunda yazıyor). Efektler: Kenney (CC0).
- İletişim bilgisi `sahne.html` içinde `id="iletisim"` satırında.
- Videodaki veriler sahtedir (Örnek Kırtasiye, örnek kitaplar, telefon numaraları gizli).
- `kareler/` ve `cikti/` depoya girmez.
