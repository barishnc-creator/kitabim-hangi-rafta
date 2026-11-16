-- Kitabım Hangi Rafta: veritabanı kurulumu.
-- Her şey "kirtasiye_" ile başlar; aynı projedeki başka uygulamalara dokunmaz.
-- Yeni bir Supabase projesine taşırken bu dosyayı SQL Editor'de bir kez çalıştırmak yeterli.

-- Yetkiler: duzenleyici = her şey, revizeci = görür + revize yazar, calisan = kitap ekler/siler/düzenler.
create table if not exists public.kirtasiye_uyeler (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ad text not null default '',
  eposta text not null default '',
  rol text not null check (rol in ('duzenleyici', 'revizeci', 'calisan')),
  kirtasiye_hesabi boolean not null default false, -- true: hesabı bu program açtı (şifresi buradan sıfırlanabilir)
  eklendi timestamptz not null default now()
);

create table if not exists public.kirtasiye_raflar (
  id uuid primary key default gen_random_uuid(),
  no int not null unique check (no > 0),
  etiket text not null default ''
);

create table if not exists public.kirtasiye_bolmeler (
  id uuid primary key default gen_random_uuid(),
  raf_id uuid not null references public.kirtasiye_raflar (id) on delete cascade,
  no int not null check (no > 0),
  unique (raf_id, no)
);

create table if not exists public.kirtasiye_kitaplar (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (length(trim(ad)) > 0),
  yazar text not null default '',
  yayinevi text not null default '',
  barkod text not null default '',
  bolme_id uuid not null references public.kirtasiye_bolmeler (id) on delete restrict, -- dolu bölme/raf silinemez
  fiyat numeric(12, 2) check (fiyat is null or fiyat >= 0),
  stok int check (stok is null or stok >= 0),
  guncellendi timestamptz not null default now()
);
alter table public.kirtasiye_kitaplar add column if not exists kapak text not null default '' check (kapak = '' or kapak like 'https://%');
alter table public.kirtasiye_kitaplar add column if not exists eklendi timestamptz not null default now();
create index if not exists kirtasiye_kitaplar_bolme on public.kirtasiye_kitaplar (bolme_id);
create index if not exists kirtasiye_kitaplar_barkod on public.kirtasiye_kitaplar (barkod) where barkod <> '';

create table if not exists public.kirtasiye_ayarlar (
  id int primary key default 1 check (id = 1),
  fiyat boolean not null default true,
  stok boolean not null default true
);
alter table public.kirtasiye_ayarlar add column if not exists magaza_adi text not null default '' check (length(magaza_adi) <= 60);
alter table public.kirtasiye_ayarlar add column if not exists renk text not null default '' check (renk = '' or renk ~ '^#[0-9A-Fa-f]{6}$');
alter table public.kirtasiye_ayarlar add column if not exists logo text not null default '' check (logo = '' or (logo ~ '^data:image/(png|jpeg|webp);base64,' and length(logo) <= 300000));
alter table public.kirtasiye_ayarlar add column if not exists karsilama text not null default '' check (length(karsilama) <= 80);
insert into public.kirtasiye_ayarlar (id) values (1) on conflict do nothing;

-- Müşteri ekranındaki aramalar (en çok arananlar / bulunamayanlar raporu için). Kişisel bilgi tutulmaz.
create table if not exists public.kirtasiye_aramalar (
  id bigint generated always as identity primary key,
  sorgu text not null check (length(sorgu) between 1 and 100),
  sonuc int not null default 0 check (sonuc >= 0),
  zaman timestamptz not null default now()
);
create index if not exists kirtasiye_aramalar_zaman on public.kirtasiye_aramalar (zaman);

-- Programın kendisine dair istekler (müdür/yönetici yazar).
create table if not exists public.kirtasiye_revizeler (
  id uuid primary key default gen_random_uuid(),
  yazan uuid references auth.users (id) on delete set null default auth.uid(),
  yazan_ad text not null default '',
  metin text not null check (length(trim(metin)) > 0),
  durum text not null default 'yeni' check (durum in ('yeni', 'iletildi', 'yapildi')),
  olusturuldu timestamptz not null default now()
);

-- Okul kitap listeleri (müşteri ekranında okul → sınıf seçilerek görülür).
create table if not exists public.kirtasiye_okul_listeleri (
  id uuid primary key default gen_random_uuid(),
  okul text not null check (length(trim(okul)) between 1 and 80),
  sinif text not null check (length(trim(sinif)) between 1 and 20),
  kalemler jsonb not null default '[]'::jsonb check (jsonb_typeof(kalemler) = 'array'),
  guncellendi timestamptz not null default now(),
  unique (okul, sinif)
);

-- "Gelince haber ver" talepleri. Kişisel veri (ad, telefon): yalnız düzenleyici ve çalışan görür.
create table if not exists public.kirtasiye_talepler (
  id uuid primary key default gen_random_uuid(),
  kitap text not null check (length(trim(kitap)) between 1 and 300),
  kitap_id uuid references public.kirtasiye_kitaplar (id) on delete set null,
  ad text not null check (length(trim(ad)) between 1 and 60),
  telefon text not null check (telefon ~ '^0[2-5][0-9]{9}$'),
  notu text not null default '' check (length(notu) <= 120),
  onay boolean not null check (onay),
  durum text not null default 'yeni' check (durum in ('yeni', 'arandi', 'geldi', 'iptal')),
  olusturuldu timestamptz not null default now()
);
create index if not exists kirtasiye_talepler_zaman on public.kirtasiye_talepler (olusturuldu);

-- Giriş yapan kişinin rolü (yoksa null).
create or replace function public.kirtasiye_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.kirtasiye_uyeler where user_id = auth.uid()
$$;
revoke all on function public.kirtasiye_rol() from public;
grant execute on function public.kirtasiye_rol() to anon, authenticated;

alter table public.kirtasiye_uyeler enable row level security;
alter table public.kirtasiye_raflar enable row level security;
alter table public.kirtasiye_bolmeler enable row level security;
alter table public.kirtasiye_kitaplar enable row level security;
alter table public.kirtasiye_ayarlar enable row level security;
alter table public.kirtasiye_revizeler enable row level security;
alter table public.kirtasiye_aramalar enable row level security;
alter table public.kirtasiye_okul_listeleri enable row level security;
alter table public.kirtasiye_talepler enable row level security;

-- Müşteri ekranı girişsiz çalışır: raflar, bölmeler, kitaplar ve ayarlar herkese okunur.
drop policy if exists okuma on public.kirtasiye_raflar;
create policy okuma on public.kirtasiye_raflar for select to anon, authenticated using (true);
drop policy if exists okuma on public.kirtasiye_bolmeler;
create policy okuma on public.kirtasiye_bolmeler for select to anon, authenticated using (true);
drop policy if exists okuma on public.kirtasiye_kitaplar;
create policy okuma on public.kirtasiye_kitaplar for select to anon, authenticated using (true);
drop policy if exists okuma on public.kirtasiye_ayarlar;
create policy okuma on public.kirtasiye_ayarlar for select to anon, authenticated using (true);

-- Raf, bölme, ayar: yalnız düzenleyici değiştirir.
drop policy if exists yazma on public.kirtasiye_raflar;
create policy yazma on public.kirtasiye_raflar for all to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici') with check (public.kirtasiye_rol() = 'duzenleyici');
drop policy if exists yazma on public.kirtasiye_bolmeler;
create policy yazma on public.kirtasiye_bolmeler for all to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici') with check (public.kirtasiye_rol() = 'duzenleyici');
drop policy if exists yazma on public.kirtasiye_ayarlar;
create policy yazma on public.kirtasiye_ayarlar for update to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici') with check (public.kirtasiye_rol() = 'duzenleyici');

-- Kitap: düzenleyici ve çalışan ekler, düzenler, siler.
drop policy if exists yazma on public.kirtasiye_kitaplar;
create policy yazma on public.kirtasiye_kitaplar for all to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'calisan'))
  with check (public.kirtasiye_rol() in ('duzenleyici', 'calisan'));

-- Üyeler: herkes kendi satırını, düzenleyici hepsini görür. Ekleme/silme edge function'da (service role).
drop policy if exists okuma on public.kirtasiye_uyeler;
create policy okuma on public.kirtasiye_uyeler for select to authenticated
  using (user_id = auth.uid() or public.kirtasiye_rol() = 'duzenleyici');

-- Okul listeleri: herkes okur (müşteri ekranı), düzenleyici ve çalışan yönetir.
drop policy if exists okuma on public.kirtasiye_okul_listeleri;
create policy okuma on public.kirtasiye_okul_listeleri for select to anon, authenticated using (true);
drop policy if exists yazma on public.kirtasiye_okul_listeleri;
create policy yazma on public.kirtasiye_okul_listeleri for all to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'calisan'))
  with check (public.kirtasiye_rol() in ('duzenleyici', 'calisan'));

-- Talepler: müşteri ekranı (girişsiz) yalnız yeni talep ekler, okuyamaz.
drop policy if exists ekleme on public.kirtasiye_talepler;
create policy ekleme on public.kirtasiye_talepler for insert to anon, authenticated with check (onay and durum = 'yeni');
grant insert on public.kirtasiye_talepler to anon;
drop policy if exists yonetim on public.kirtasiye_talepler;
create policy yonetim on public.kirtasiye_talepler for all to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'calisan'))
  with check (public.kirtasiye_rol() in ('duzenleyici', 'calisan'));

-- Aramalar: müşteri ekranı (girişsiz) yalnız ekler; düzenleyici ve revize veren raporda görür.
drop policy if exists ekleme on public.kirtasiye_aramalar;
create policy ekleme on public.kirtasiye_aramalar for insert to anon, authenticated with check (true);
grant insert on public.kirtasiye_aramalar to anon;
drop policy if exists okuma on public.kirtasiye_aramalar;
create policy okuma on public.kirtasiye_aramalar for select to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'revizeci'));

-- Revizeler: düzenleyici ve revizeci görür ve yazar; durumu düzenleyici değiştirir, siler.
drop policy if exists okuma on public.kirtasiye_revizeler;
create policy okuma on public.kirtasiye_revizeler for select to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'revizeci'));
drop policy if exists ekleme on public.kirtasiye_revizeler;
create policy ekleme on public.kirtasiye_revizeler for insert to authenticated
  with check (public.kirtasiye_rol() in ('duzenleyici', 'revizeci') and yazan = auth.uid() and durum = 'yeni');
drop policy if exists guncelleme on public.kirtasiye_revizeler;
create policy guncelleme on public.kirtasiye_revizeler for update to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici') with check (public.kirtasiye_rol() = 'duzenleyici');
drop policy if exists silme on public.kirtasiye_revizeler;
create policy silme on public.kirtasiye_revizeler for delete to authenticated
  using (public.kirtasiye_rol() = 'duzenleyici');

-- Ekranlar canlı güncellensin.
do $$
declare t text;
begin
  foreach t in array array['kirtasiye_raflar', 'kirtasiye_bolmeler', 'kirtasiye_kitaplar', 'kirtasiye_ayarlar', 'kirtasiye_revizeler', 'kirtasiye_okul_listeleri'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- İLK DÜZENLEYİCİ (kurulumdan sonra bir kez, e-postayı değiştirerek):
-- insert into public.kirtasiye_uyeler (user_id, ad, eposta, rol)
-- select id, 'Yönetici', email, 'duzenleyici' from auth.users where email = 'ORNEK@EPOSTA.COM'
-- on conflict (user_id) do update set rol = 'duzenleyici';
