-- Hata kaydı, sistem durumu ve Claude izleme kapısı (21 Kasım 2026).
-- Supabase > SQL Editor'e yapıştırıp Run'a basın. Birden çok kez çalıştırmak zararsızdır.
--
-- Ne yapar:
--  1) Programda (müşteri ekranı ya da panel) beklenmeyen bir hata olunca kirtasiye_hatalar tablosuna kayıt düşer.
--     Aynı hata 24 saat içinde tekrar ederse yeni satır açılmaz, "adet" artar. Saatte en çok 200 yeni satır.
--  2) Panelde "Sistem durumu" (yalnız düzenleyici): hatalar, kitap sayısı, veritabanı doluluğu.
--  3) Claude'un okuması için salt okunur kapı: x-izleme-token başlığıyla gelen istek, anahtar doğruysa durumu,
--     son hataları ve panelden yazılan revizeleri okur; hiçbir şeyi değiştiremez. Anahtar depoda yoktur, veritabanında yalnız özeti (sha256) durur.
--
-- Claude anahtarı (bir kez): bu dosyadan sonra SQL Editor'de şunu çalıştırın:
--     select public.kirtasiye_izleme_anahtari_uret();
-- Çıkan anahtarı Claude'un açtığı güvenli forma girin (sohbete yapıştırmayın). Yeniden çalıştırmak eski anahtarı geçersiz kılar.

-- 1) Hata tablosu
create table if not exists public.kirtasiye_hatalar (
  id bigint generated always as identity primary key,
  ilk timestamptz not null default now(),
  son timestamptz not null default now(),
  adet integer not null default 1,
  ekran text not null default '' check (length(ekran) <= 20),
  mesaj text not null check (length(mesaj) between 1 and 300),
  ayrinti text not null default '' check (length(ayrinti) <= 2000),
  surum text not null default '' check (length(surum) <= 20),
  cihaz text not null default '' check (length(cihaz) <= 120),
  kullanici text not null default '' check (length(kullanici) <= 60),
  goruldu boolean not null default false
);
create index if not exists kirtasiye_hatalar_son on public.kirtasiye_hatalar (son desc);
alter table public.kirtasiye_hatalar enable row level security;
revoke all on table public.kirtasiye_hatalar from anon, authenticated;
grant select, update, delete on table public.kirtasiye_hatalar to authenticated;
drop policy if exists okuma on public.kirtasiye_hatalar;
create policy okuma on public.kirtasiye_hatalar for select to authenticated using (public.kirtasiye_rol() = 'duzenleyici');
drop policy if exists guncelleme on public.kirtasiye_hatalar;
create policy guncelleme on public.kirtasiye_hatalar for update to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici') with check (public.kirtasiye_rol() = 'duzenleyici');
drop policy if exists silme on public.kirtasiye_hatalar;
create policy silme on public.kirtasiye_hatalar for delete to authenticated using (public.kirtasiye_rol() = 'duzenleyici');

-- Hata yazma: müşteri ekranı girişsiz çalıştığı için anonim de çağırabilir; tabloya doğrudan yazma izni yok.
create or replace function public.kirtasiye_hata_yaz(p_ekran text, p_mesaj text, p_ayrinti text, p_surum text, p_cihaz text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mesaj text := left(btrim(coalesce(p_mesaj, '')), 300);
  v_ekran text := left(coalesce(p_ekran, ''), 20);
  v_surum text := left(coalesce(p_surum, ''), 20);
  v_kim text := coalesce((select ad from kirtasiye_uyeler where user_id = auth.uid()), '');
begin
  if v_mesaj = '' then return; end if;
  update kirtasiye_hatalar set adet = adet + 1, son = now(), goruldu = false,
      cihaz = left(coalesce(p_cihaz, ''), 120), kullanici = left(v_kim, 60)
    where ekran = v_ekran and mesaj = v_mesaj and surum = v_surum and son > now() - interval '24 hours';
  if found then return; end if;
  if (select count(*) from kirtasiye_hatalar where ilk > now() - interval '1 hour') >= 200 then return; end if;
  insert into kirtasiye_hatalar (ekran, mesaj, ayrinti, surum, cihaz, kullanici)
    values (v_ekran, v_mesaj, left(coalesce(p_ayrinti, ''), 2000), v_surum, left(coalesce(p_cihaz, ''), 120), left(v_kim, 60));
end $$;
revoke all on function public.kirtasiye_hata_yaz(text, text, text, text, text) from public;
grant execute on function public.kirtasiye_hata_yaz(text, text, text, text, text) to anon, authenticated;

-- 2) Sistem durumu (iç fonksiyon; dışarıdan iki kapıdan çağrılır)
create or replace function public.kirtasiye_durum_ic()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'zaman', now(),
    'kitap', (select count(*) from kirtasiye_kitaplar),
    'rafsiz', (select count(*) from kirtasiye_kitaplar where bolme_id is null),
    'raf', (select count(*) from kirtasiye_raflar),
    'talep', (select count(*) from kirtasiye_talepler),
    'veritabani_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'veritabani_sinir_mb', 500,
    'hata_24_saat', (select coalesce(sum(adet), 0) from kirtasiye_hatalar where son > now() - interval '24 hours'),
    'hata_gorulmemis', (select count(*) from kirtasiye_hatalar where not goruldu),
    'revize_yeni', (select count(*) from kirtasiye_revizeler where durum = 'yeni'),
    'son_hata', (select max(son) from kirtasiye_hatalar),
    'son_kitap_degisikligi', (select max(guncellendi) from kirtasiye_kitaplar)
  )
$$;
revoke all on function public.kirtasiye_durum_ic() from public, anon, authenticated;

create or replace function public.kirtasiye_sistem_durumu()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if public.kirtasiye_rol() is distinct from 'duzenleyici' then raise exception 'Bu bilgi yalnız düzenleyiciye açık.' using errcode = '42501'; end if;
  return public.kirtasiye_durum_ic();
end $$;
revoke all on function public.kirtasiye_sistem_durumu() from public;
grant execute on function public.kirtasiye_sistem_durumu() to authenticated;

-- 3) Claude izleme kapısı
create table if not exists public.kirtasiye_izleme (
  id integer primary key default 1 check (id = 1),
  anahtar_ozet text not null,
  olusturuldu timestamptz not null default now()
);
alter table public.kirtasiye_izleme enable row level security; -- politika yok: kimse doğrudan okuyamaz
revoke all on table public.kirtasiye_izleme from anon, authenticated;

create or replace function public.kirtasiye_izleme_anahtari_uret()
returns text language plpgsql security definer set search_path = public as $$
declare v_anahtar text := 'izle_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into kirtasiye_izleme (id, anahtar_ozet) values (1, encode(sha256(convert_to(v_anahtar, 'UTF8')), 'hex'))
    on conflict (id) do update set anahtar_ozet = excluded.anahtar_ozet, olusturuldu = now();
  return v_anahtar;
end $$;
revoke all on function public.kirtasiye_izleme_anahtari_uret() from public, anon, authenticated; -- yalnız SQL Editor

-- Anahtar istek başlığından okunur (x-izleme-token): böylece Claude ortamına ağ sırrı olarak kaydedilir, sohbete girmez.
-- p_saat verilirse yalnız son p_saat saatte görülen hatalar ve yazılan revizeler döner (zamanlanmış kontrol "yeni ne var" diye sorar).
-- Revizeler: panelden yazılan, programa dair istekler (durumu 'yeni' olanlar ve son p_saat saattekiler).
drop function if exists public.kirtasiye_izle();
create or replace function public.kirtasiye_izle(p_saat integer default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_anahtar text := coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-izleme-token', '');
  v_sinir timestamptz := case when p_saat is null then '-infinity'::timestamptz else now() - make_interval(hours => greatest(p_saat, 1)) end;
begin
  if v_anahtar = '' or not exists (select 1 from kirtasiye_izleme where anahtar_ozet = encode(sha256(convert_to(v_anahtar, 'UTF8')), 'hex')) then
    raise exception 'İzleme anahtarı geçersiz.' using errcode = '42501';
  end if;
  return json_build_object(
    'durum', public.kirtasiye_durum_ic(),
    'hatalar', coalesce((select json_agg(h) from (
      select id, ilk, son, adet, ekran, mesaj, ayrinti, surum, cihaz, kullanici, goruldu
      from kirtasiye_hatalar where son > v_sinir order by son desc limit 50) h), '[]'::json),
    'revizeler', coalesce((select json_agg(r) from (
      select id, yazan_ad, metin, durum, olusturuldu
      from kirtasiye_revizeler where olusturuldu > v_sinir or (p_saat is null and durum = 'yeni')
      order by olusturuldu desc limit 50) r), '[]'::json)
  );
end $$;
revoke all on function public.kirtasiye_izle(integer) from public;
grant execute on function public.kirtasiye_izle(integer) to anon, authenticated;

-- 4) 90 günden eski hataları da sil (pg_cron işi varsa günceller; pg_cron yoksa bu adım atlanır)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kitabim-90-gun-silme';
    perform cron.schedule('kitabim-90-gun-silme', '15 3 * * *', $c$
      delete from public.kirtasiye_talepler where olusturuldu < now() - interval '90 days';
      delete from public.kirtasiye_bildirimler where son < now() - interval '90 days';
      delete from public.kirtasiye_hatalar where son < now() - interval '90 days';
    $c$);
  end if;
end $$;
