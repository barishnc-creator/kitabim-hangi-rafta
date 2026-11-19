-- Güvenlik düzeltmesi · 19 Kasım 2026 (denetim bulgusu O1).
-- Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run. Birden çok kez çalıştırmak zararsızdır.
--
-- Ne yapar: müşteri ekranından (girişsiz) eklenen kayıtlara veritabanında sınır koyar.
--  - "Gelince haber ver" talebi: aynı telefondan 24 saatte en çok 5, toplamda 10 dakikada en çok 30.
--    Sınır aşılınca müşteri ekranında anlaşılır bir mesaj çıkar.
--  - Arama kaydı (rapor için): toplamda dakikada en çok 30; fazlası sessizce kaydedilmez, arama yine çalışır.
--  - Kayıt zamanı her zaman sunucu saatidir (istemci eski tarih yazıp sınırı atlatamaz; KVKK onayının zamanı da budur).
-- Alan uzunlukları ve KVKK onayı zaten kurulum.sql'de zorunlu: kitap ≤ 300, ad ≤ 60, not ≤ 120,
-- telefon 05XXXXXXXXX biçiminde, onay = true olmadan talep kaydedilmez; sorgu ≤ 100 karakter.
--
-- GERİ ALMA (gerekirse SQL Editor'de çalıştırın):
--   drop trigger if exists ekleme_siniri on public.kirtasiye_talepler;
--   drop trigger if exists ekleme_siniri on public.kirtasiye_aramalar;
--   drop function if exists public.kirtasiye_ekleme_siniri();

create or replace function public.kirtasiye_ekleme_siniri()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'kirtasiye_talepler' then
    new.olusturuldu := now();
    -- Aynı anda gelen istekler sırayla sayılsın (yoksa paralel istekler sınırı aşabilir).
    perform pg_advisory_xact_lock(hashtext('kirtasiye_talepler'));
    if (select count(*) from kirtasiye_talepler where telefon = new.telefon and olusturuldu > now() - interval '24 hours') >= 5 then
      raise exception 'Bu telefon numarasıyla bugün yeterince talep bırakıldı. Lütfen mağaza görevlisine başvurun.';
    end if;
    if (select count(*) from kirtasiye_talepler where olusturuldu > now() - interval '10 minutes') >= 30 then
      raise exception 'Şu an çok fazla talep var. Lütfen birkaç dakika sonra tekrar deneyin.';
    end if;
  else
    new.zaman := now();
    perform pg_advisory_xact_lock(hashtext('kirtasiye_aramalar'));
    if (select count(*) from kirtasiye_aramalar where zaman > now() - interval '1 minute') >= 30 then
      return null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.kirtasiye_ekleme_siniri() from public, anon, authenticated;

drop trigger if exists ekleme_siniri on public.kirtasiye_talepler;
create trigger ekleme_siniri before insert on public.kirtasiye_talepler
  for each row execute function public.kirtasiye_ekleme_siniri();
drop trigger if exists ekleme_siniri on public.kirtasiye_aramalar;
create trigger ekleme_siniri before insert on public.kirtasiye_aramalar
  for each row execute function public.kirtasiye_ekleme_siniri();
