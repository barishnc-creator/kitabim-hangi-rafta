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
alter table public.kirtasiye_ayarlar add column if not exists plan jsonb not null default '{}'::jsonb check (pg_column_size(plan) < 100000);
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

-- API yetkileri açıkça verilir (projede "yeni tablolara otomatik API erişimi" kapalı olsa da çalışsın).
-- Kimin neyi görüp değiştirebileceğini aşağıdaki RLS kuralları belirler.
grant select on public.kirtasiye_raflar, public.kirtasiye_bolmeler, public.kirtasiye_kitaplar,
  public.kirtasiye_ayarlar, public.kirtasiye_okul_listeleri to anon, authenticated;
grant insert, update, delete on public.kirtasiye_raflar, public.kirtasiye_bolmeler, public.kirtasiye_kitaplar,
  public.kirtasiye_okul_listeleri to authenticated;
grant update on public.kirtasiye_ayarlar to authenticated;
grant select on public.kirtasiye_uyeler to authenticated;
grant select, insert, update, delete on public.kirtasiye_revizeler, public.kirtasiye_talepler to authenticated;
grant insert on public.kirtasiye_talepler, public.kirtasiye_aramalar to anon, authenticated;
grant select on public.kirtasiye_aramalar to authenticated;

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

-- İşlem geçmişi: kim, ne zaman, ne yaptı. Kayıtları yalnız tetikleyici yazar (istemci yazamaz, değiştiremez).
create table if not exists public.kirtasiye_gecmis (
  id bigint generated always as identity primary key,
  zaman timestamptz not null default now(),
  kim uuid,
  kim_ad text not null default '',
  islem text not null,
  konu text not null,
  ayrinti text not null default ''
);
create index if not exists kirtasiye_gecmis_zaman on public.kirtasiye_gecmis (zaman desc);
alter table public.kirtasiye_gecmis enable row level security;
grant select on public.kirtasiye_gecmis to authenticated;
drop policy if exists okuma on public.kirtasiye_gecmis;
create policy okuma on public.kirtasiye_gecmis for select to authenticated
  using (public.kirtasiye_rol() in ('duzenleyici', 'revizeci'));

create or replace function public.kirtasiye_bolme_kodu(p_bolme uuid)
returns text language sql stable security definer set search_path = public as $$
  select r.no || '.' || b.no from public.kirtasiye_bolmeler b join public.kirtasiye_raflar r on r.id = b.raf_id where b.id = p_bolme
$$;

create or replace function public.kirtasiye_gecmis_kaydet()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ad text;
  v_islem text;
  v_konu text;
  v_ayrinti text;
begin
  select coalesce(nullif(ad, ''), eposta) into v_ad from public.kirtasiye_uyeler where user_id = auth.uid();
  if tg_table_name = 'kirtasiye_kitaplar' then
    v_konu := 'kitap';
    if tg_op = 'INSERT' then
      v_islem := 'ekledi'; v_ayrinti := '“' || new.ad || '” → ' || coalesce(public.kirtasiye_bolme_kodu(new.bolme_id), '?');
    elsif tg_op = 'UPDATE' then
      if new.bolme_id is distinct from old.bolme_id then
        v_islem := 'tasidi';
        v_ayrinti := '“' || new.ad || '” ' || coalesce(public.kirtasiye_bolme_kodu(old.bolme_id), '?') || ' → ' || coalesce(public.kirtasiye_bolme_kodu(new.bolme_id), '?');
      elsif (new.ad, new.yazar, new.yayinevi, new.barkod, new.fiyat, new.stok, new.kapak) is not distinct from (old.ad, old.yazar, old.yayinevi, old.barkod, old.fiyat, old.stok, old.kapak) then
        return null;
      else
        v_islem := 'guncelledi'; v_ayrinti := '“' || new.ad || '”';
      end if;
    else
      v_islem := 'sildi'; v_ayrinti := '“' || old.ad || '” (' || coalesce(public.kirtasiye_bolme_kodu(old.bolme_id), '?') || ')';
    end if;
  elsif tg_table_name = 'kirtasiye_raflar' then
    v_konu := 'raf';
    v_islem := case tg_op when 'INSERT' then 'ekledi' when 'UPDATE' then 'guncelledi' else 'sildi' end;
    v_ayrinti := case when tg_op = 'DELETE' then old.no || '. Raf' else new.no || '. Raf' || case when new.etiket <> '' then ' · ' || new.etiket else '' end end;
  elsif tg_table_name = 'kirtasiye_bolmeler' then
    v_konu := 'bolme';
    if tg_op = 'DELETE' then
      -- Raf silinirken bölmeler de silinir; o durumda ayrıca kayıt düşme.
      if not exists (select 1 from public.kirtasiye_raflar where id = old.raf_id) then return null; end if;
      v_islem := 'sildi'; v_ayrinti := 'Bölme ' || (select no from public.kirtasiye_raflar where id = old.raf_id) || '.' || old.no;
    elsif tg_op = 'INSERT' then
      v_islem := 'ekledi'; v_ayrinti := 'Bölme ' || coalesce(public.kirtasiye_bolme_kodu(new.id), '?');
    else return null;
    end if;
  elsif tg_table_name = 'kirtasiye_okul_listeleri' then
    v_konu := 'liste';
    v_islem := case tg_op when 'INSERT' then 'ekledi' when 'UPDATE' then 'guncelledi' else 'sildi' end;
    v_ayrinti := case when tg_op = 'DELETE' then old.okul || ' · ' || old.sinif else new.okul || ' · ' || new.sinif end;
  elsif tg_table_name = 'kirtasiye_ayarlar' then
    v_konu := 'ayar'; v_islem := 'guncelledi';
    v_ayrinti := concat_ws(', ',
      case when new.fiyat is distinct from old.fiyat then 'fiyat alanı ' || case when new.fiyat then 'açıldı' else 'kapatıldı' end end,
      case when new.stok is distinct from old.stok then 'stok alanı ' || case when new.stok then 'açıldı' else 'kapatıldı' end end,
      case when new.magaza_adi is distinct from old.magaza_adi then 'mağaza adı' end,
      case when new.renk is distinct from old.renk then 'ana renk' end,
      case when new.logo is distinct from old.logo then 'logo' end,
      case when new.karsilama is distinct from old.karsilama then 'karşılama yazısı' end,
      case when new.plan is distinct from old.plan then 'mağaza haritası' end);
    if v_ayrinti = '' then return null; end if;
  else
    return null;
  end if;
  insert into public.kirtasiye_gecmis (kim, kim_ad, islem, konu, ayrinti) values (auth.uid(), coalesce(v_ad, ''), v_islem, v_konu, v_ayrinti);
  return null;
end $$;
revoke all on function public.kirtasiye_gecmis_kaydet() from public;

do $$
declare t text;
begin
  foreach t in array array['kirtasiye_kitaplar', 'kirtasiye_raflar', 'kirtasiye_bolmeler', 'kirtasiye_okul_listeleri', 'kirtasiye_ayarlar'] loop
    execute format('drop trigger if exists gecmis on public.%I', t);
    execute format('create trigger gecmis after insert or update or delete on public.%I for each row execute function public.kirtasiye_gecmis_kaydet()', t);
  end loop;
end $$;

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
