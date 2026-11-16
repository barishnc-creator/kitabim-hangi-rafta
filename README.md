# Kitabım Hangi Rafta?

Kırtasiye için raf takip programı. Çalışanlar rafları ve bölmeleri (1.1, 1.2 …) kurar, kitapları barkodla ya da elle ekler. Müşteri dükkândaki ekranda kitabın adını yazar ya da barkodunu okutur, program kitabın hangi raf ve bölmede olduğunu söyler ve raf şemasında o bölmeyi turuncuyla gösterir.

## Ekranlar

- `index.html`: müşteri ekranı (arama, barkod/QR okutma, kitap kartı, raf şeması). 90 saniye dokunulmazsa başa döner.
- `yonetim.html`: çalışan paneli
  - **Raflar:** raf ekleme ve silme, bölme ekleme ve silme, raf etiketi, bölmedeki kitaplar
  - **Kitap ekle:** barkod (kamera ya da barkod tabancası), ad, yazar, yayınevi, raf/bölme, fiyat, stok
  - **Ayarlar:** fiyat ve stok alanlarını açıp kapatma, yedek indirme ve geri yükleme

## Veri

İlk sürümde veriler tarayıcının kendi hafızasında (localStorage) duruyor, yani yalnız o cihazda saklanıyor. Bulut bağlantısı (Supabase) eklenince çalışanın telefonundan girilen kitap dükkândaki ekranda da görünecek.

## Geliştirme

Derleme adımı yok, düz HTML/CSS/JS.

```
python3 -m http.server 8000   # http://localhost:8000
npm test                      # birim testleri (Node 18+)
```

Kamera okuma: [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8 (`vendor/`, Apache-2.0). Kamera yalnızca https'te ya da localhost'ta açılır.
