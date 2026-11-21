-- TÜM KİTAPLARI SİLME (geri alınamaz). Raflar, bölmeler, ayarlar, kullanıcılar, talepler ve okul listeleri kalır.
-- Önce yedek alın: Panel → Kitaplar → "Excel'e aktar".
-- Önerilen: silmeden önce açık panel ve müşteri ekranlarını kapatın, bittikten sonra yeniden açın.
--
-- Supabase > SQL Editor'e yapıştırıp Run'a basın. Sonuç satırında silinen kitap sayısı görünür.
--
-- Neden doğrudan "delete" değil: her silinen kitap için işlem geçmişine ayrı satır yazılırdı (on binlerce satır).
-- Bu dosya geçmiş kaydını bu işlem süresince kapatır ve yerine tek bir özet satırı yazar.
-- Taleplerdeki kitap bağlantısı otomatik boşalır (talep metni kalır). Okul listelerindeki kalemler "kayıtlı değil" görünür.

begin;

alter table public.kirtasiye_kitaplar disable trigger gecmis;

with silinen as (
  delete from public.kirtasiye_kitaplar
  -- Yalnız rafa yerleştirilmemiş (Excel ile girilmiş, rafsız) kitapları silmek için alttaki satırın başındaki -- işaretini kaldırın:
  -- where bolme_id is null
  returning 1
)
insert into public.kirtasiye_gecmis (kim_ad, islem, konu, ayrinti)
select 'SQL Editor', 'sildi', 'kitap', 'Toplu silme: ' || count(*) || ' kitap' from silinen;

alter table public.kirtasiye_kitaplar enable trigger gecmis;

commit;

select (select count(*) from public.kirtasiye_kitaplar) as kalan_kitap,
       (select ayrinti from public.kirtasiye_gecmis where konu = 'kitap' order by zaman desc limit 1) as islem;
