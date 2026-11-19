-- Güvenlik düzeltmesi · 19 Kasım 2026 (denetim bulgusu O1).
-- Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run. Birden çok kez çalıştırmak zararsızdır.
--
-- Ne yapar:
--  - Talep: aynı telefondan 24 saatte en çok 5. Fazlası kaydedilmez; müşteri nazik bir mesaj görür ve
--    yönetim paneline "Bu kişi birden fazla istek gönderiyor" bildirimi düşer (telefon, deneme sayısı, zaman).
--  - Arama kaydı (rapor için): toplamda dakikada en çok 30; fazlası sessizce kaydedilmez, arama yine çalışır.
--  - Kayıt zamanı her zaman sunucu saatidir (istemci eski tarih yazıp sınırı atlatamaz; KVKK onayının zamanı da budur).
-- Alan uzunlukları ve KVKK onayı zaten kurulum.sql'de zorunlu: kitap ≤ 300, ad ≤ 60, not ≤ 120,
-- telefon 05XXXXXXXXX biçiminde, onay = true olmadan talep kaydedilmez; sorgu ≤ 100 karakter.
--
-- GERİ ALMA (gerekirse SQL Editor'de çalıştırın):
--   drop trigger if exists ekleme_siniri on public.kirtasiye_talepler;
--   drop trigger if exists ekleme_siniri on public.kirtasiye_aramalar;
--   drop function if exists public.kirtasiye_talep_birak(text, uuid, text, text, text);
--   drop function if exists public.kirtasiye_ekleme_siniri();
--   drop table if exists public.kirtasiye_bildirimler;

-- Yönetici bildirimleri. Kişi başına (telefon) 24 saatlik pencerede tek satır; her engellenen denemede deneme artar.
-- Yalnız talep fonksiyonu yazar; düzenleyici ve çalışan görür, okundu işaretler, siler.
create table if not exists public.kirtasiye_bildirimler (
  id uuid primary key default gen_random_uuid(),
  telefon text not null,
  deneme int not null,
  ilk timestamptz not null default now(),
  son timestamptz not null default now(),
  okundu boolean not null default false
);
alter table public.kirtasiye_bildirimler enable row level security;
revoke all on public.kirtasiye_bildirimler from anon, authenticated;
grant select, update, delete on public.kirtasiye_bildirimler to authenticated;
drop policy if exists yonetim on public.kirtasiye_bildirimler;
create policy yonetim on public.kirtasiye_bildirimler for all to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'calisan'))
  with check (public.kirtasiye_rol() in ('duzenleyici', 'calisan'));

create or replace function public.kirtasiye_ekleme_siniri()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'kirtasiye_talepler' then
    new.olusturuldu := now();
    -- Aynı anda gelen istekler sırayla sayılsın (yoksa paralel istekler sınırı aşabilir).
    perform pg_advisory_xact_lock(hashtext('kirtasiye_talepler'));
    if (select count(*) from kirtasiye_talepler where telefon = new.telefon and olusturuldu > now() - interval '24 hours') >= 5 then
      raise exception using errcode = 'KT429',
        message = 'Bu numarayla bugün en fazla 5 talep bırakılabiliyor; kırtasiye çalışanımız sizinle ilgilenecek.';
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

-- Müşteri ekranı talebi bu fonksiyonla bırakır: true = kaydedildi, false = sınır aşıldı (bildirim yazıldı).
-- Sınırı yukarıdaki tetikleyici uygular; burada yalnız hatası yakalanıp bildirim yazılır.
create or replace function public.kirtasiye_talep_birak(p_kitap text, p_kitap_id uuid, p_ad text, p_telefon text, p_notu text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into kirtasiye_talepler (kitap, kitap_id, ad, telefon, notu, onay)
      values (p_kitap, p_kitap_id, p_ad, p_telefon, coalesce(p_notu, ''), true);
    return true;
  exception when sqlstate 'KT429' then null;
  end;
  update kirtasiye_bildirimler set deneme = deneme + 1, son = now(), okundu = false
    where telefon = p_telefon and son > now() - interval '24 hours';
  if not found then
    insert into kirtasiye_bildirimler (telefon, deneme)
      values (p_telefon, 1 + (select count(*) from kirtasiye_talepler where telefon = p_telefon and olusturuldu > now() - interval '24 hours'));
  end if;
  return false;
end $$;
revoke all on function public.kirtasiye_talep_birak(text, uuid, text, text, text) from public;
grant execute on function public.kirtasiye_talep_birak(text, uuid, text, text, text) to anon, authenticated;

-- API yeni fonksiyonu hemen görsün.
notify pgrst, 'reload schema';
