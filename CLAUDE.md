# Kitabım Hangi Rafta? · Claude için kurallar

Kırtasiye raf takip programı. Düz HTML/CSS/JS, derleme yok. Ayrıntılar `README.md`, son durum `DEVIR.md`.

## Oturum başında

1. `DEVIR.md`'yi oku; "Sıradaki işler" listesinden devam et.
2. Kullanıcıya bir cümleyle nerede kaldığımızı söyle, sonra işe geç.

## Devir kuralı (kalıcı)

Kullanıcının isteği: bağlam penceresi yarıyı geçince yeni oturuma devredilsin, eski oturum arşivlensin, bilgi kaybolmasın.

Claude bağlam yüzdesini doğrudan göremez. Şu durumlardan biri olunca devir yapılır:
- sohbet bir kez özetlendiyse (sıkıştırma olduysa),
- büyük bir iş bittiyse ve sohbet uzunsa (çok sayıda dosya okuma, ekran görüntüsü, uzun çıktılar),
- kullanıcı "devret" derse.

Devir adımları:
1. `DEVIR.md`'yi güncelle: ne yapıldı, ne yarım kaldı, sıradaki işler, açık sorular, kullanıcının kararları.
2. Testleri çalıştır (`npm test`), commit et ve GitHub'a push et. **Push edilmeden arşivleme yapılmaz**: kapsayıcı silinir, kod kaybolur.
3. `create_session` ile yeni oturum aç: `source_url` https://github.com/barishnc-creator/kitabim-hangi-rafta, başlık "Kitabım Hangi Rafta? – devam", ilk mesaj "DEVIR.md'yi oku ve kaldığımız yerden devam et."
4. Kullanıcıya yeni oturumun bağlantısını/adını bildir.
5. Eski oturumu `archive_session` ile arşivle (kullanıcı bu kuralla önceden onay verdi).

## Gizlilik

- Depoya yalnız `sb_publishable_` anahtarı girer; `service_role` ve şifreler asla.
- Fiyat notu (iç kullanım) bu depoya konmaz; depo herkese açık olabilir (GitHub Pages).
- Müşteri/mağaza kişisel verisi depoya yazılmaz.
