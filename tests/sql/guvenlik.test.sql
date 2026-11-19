-- supabase/guvenlik-2026-11-19.sql testleri (O1: anonim ekleme sınırı + yönetici bildirimi).
-- Her assert başarısız olursa psql hata verip durur.
\set ON_ERROR_STOP 1

-- Yardımcı: müşteri ekranı gibi (girişsiz) talep bırakır. Dönen: 'kaydedildi', 'sinir' ya da hata mesajı.
create function pg_temp.talep(tel text) returns text language plpgsql as $$
declare ok boolean;
begin
  set local role anon;
  ok := public.kirtasiye_talep_birak('Kınalı Serçe', null, 'Ayşe', tel, '');
  reset role;
  return case when ok then 'kaydedildi' else 'sinir' end;
exception when others then
  return sqlerrm;
end $$;
-- Yardımcı: eski sürüm müşteri ekranı gibi doğrudan tabloya ekler; hata mesajını döndürür, başarılıysa ''.
create function pg_temp.dogrudan(tel text, zaman timestamptz default null) returns text language plpgsql as $$
begin
  set local role anon;
  insert into public.kirtasiye_talepler (kitap, ad, telefon, onay, olusturuldu)
    values ('Kınalı Serçe', 'Ayşe', tel, true, coalesce(zaman, now()));
  reset role;
  return '';
exception when others then
  return sqlerrm;
end $$;

-- 1) Aynı telefondan 24 saatte 5 talep; 6. ve 7. kaydedilmez, yöneticiye tek bildirim düşer (deneme sayısı artar).
do $$
declare i int; m text; b record;
begin
  for i in 1..5 loop
    m := pg_temp.talep('05321112233');
    assert m = 'kaydedildi', 'aynı telefondan ' || i || '. talep kaydedilmeliydi: ' || m;
  end loop;
  assert not exists (select 1 from public.kirtasiye_bildirimler), '5 talepte bildirim olmamalı';
  m := pg_temp.talep('05321112233');
  assert m = 'sinir', '6. talep kaydedilmemeliydi, gelen: ' || m;
  assert (select count(*) from public.kirtasiye_talepler) = 5, '6. talep tabloya yazılmamalı';
  select * into b from public.kirtasiye_bildirimler;
  assert b.telefon = '05321112233' and b.deneme = 6 and not b.okundu and b.son > now() - interval '1 minute',
    'bildirim: telefon, 6 deneme, okunmamış, şimdiki zaman bekleniyordu: ' || row_to_json(b)::text;
  m := pg_temp.talep('05321112233');
  assert m = 'sinir', m;
  assert (select count(*) from public.kirtasiye_bildirimler) = 1, 'aynı kişi için tek bildirim satırı olmalı';
  assert (select deneme from public.kirtasiye_bildirimler) = 7, '7. denemede deneme sayısı 7 olmalı';
end $$;

-- 2) Okundu işaretlenen bildirim yeni denemede yeniden okunmamış olur.
update public.kirtasiye_bildirimler set okundu = true;
do $$
begin
  assert pg_temp.talep('05321112233') = 'sinir';
  assert (select deneme from public.kirtasiye_bildirimler) = 8 and not (select okundu from public.kirtasiye_bildirimler),
    'yeni deneme bildirimi yeniden okunmamış yapmalı';
end $$;

-- 3) Eski sürüm (doğrudan ekleme) de 5 ile sınırlı; mesaj nazik, "spam" kelimesi yok.
do $$
declare m text;
begin
  m := pg_temp.dogrudan('05321112233');
  assert m like '%en fazla 5 talep%', 'doğrudan 6. ekleme reddedilmeliydi, gelen: ' || coalesce(nullif(m, ''), 'kabul edildi');
  assert m not ilike '%spam%';
  assert (select count(*) from public.kirtasiye_talepler) = 5;
end $$;

-- 4) İstemci geçmiş tarih yazıp sınırı atlatamaz: olusturuldu sunucuda now() olur.
do $$
declare m text;
begin
  m := pg_temp.dogrudan('05329998877', '2000-01-01');
  assert m = '', m;
  assert (select olusturuldu from public.kirtasiye_talepler where telefon = '05329998877') > now() - interval '1 minute',
    'olusturuldu istemciden gelen eski tarih olmamalı';
end $$;

-- 5) Herkese toplam sınır yok: farklı telefonlarla 10 dakikada 40 talep kaydedilir.
do $$
declare i int; m text;
begin
  for i in 1..40 loop
    m := pg_temp.talep('0533' || lpad(i::text, 7, '0'));
    assert m = 'kaydedildi', i || '. farklı telefon kaydedilmeliydi: ' || m;
  end loop;
  assert (select count(*) from public.kirtasiye_talepler where olusturuldu > now() - interval '10 minutes') = 46;
end $$;

-- 6) Süre geçince yeniden kabul edilir (eski kayıtlar sınıra sayılmaz).
update public.kirtasiye_talepler set olusturuldu = now() - interval '2 days';
do $$
begin
  assert pg_temp.talep('05321112233') = 'kaydedildi', 'süre geçince aynı telefon yeniden talep bırakabilmeli';
end $$;

-- 7) Giriş yapmış ama rolü olmayan hesap da aynı sınıra tabi.
update public.kirtasiye_talepler set olusturuldu = now() - interval '2 days';
do $$
declare i int; n int := 0;
begin
  set local role authenticated;
  for i in 1..6 loop
    begin
      insert into public.kirtasiye_talepler (kitap, ad, telefon, onay) values ('X', 'Y', '05550000000', true);
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  assert n = 5, 'rolsüz hesap da günde 5 ile sınırlı olmalı, eklenen: ' || n;
end $$;

-- 8) Bildirimler: anonim ve giriş yapmış hesap doğrudan ekleyemez; rolsüz hesap göremez; çalışan görür ve okundu işaretler.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2');
insert into public.kirtasiye_uyeler (user_id, rol) values ('00000000-0000-0000-0000-0000000000c1', 'calisan');
do $$
declare m text;
begin
  begin
    set local role anon;
    perform 1 from public.kirtasiye_bildirimler;
    m := 'okudu';
  exception when insufficient_privilege then m := '';
  end;
  assert m = '', 'anonim bildirimleri okuyamamalı';
  begin
    set local role anon;
    insert into public.kirtasiye_bildirimler (telefon, deneme) values ('05001112233', 99);
    m := 'ekledi';
  exception when insufficient_privilege then m := '';
  end;
  assert m = '', 'anonim bildirim ekleyememeli (yalnız talep fonksiyonu üzerinden)';
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
    insert into public.kirtasiye_bildirimler (telefon, deneme) values ('05001112233', 99);
    m := 'ekledi';
  exception when insufficient_privilege then m := '';
  end;
  assert m = '', 'giriş yapmış hesap da bildirim ekleyememeli';
end $$;
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
  select count(*) into n from public.kirtasiye_bildirimler;
  assert n = 0, 'rolsüz hesap bildirim görmemeli, gördü: ' || n;
  update public.kirtasiye_bildirimler set okundu = true;
  reset role;
  assert not (select okundu from public.kirtasiye_bildirimler), 'rolsüz hesap okundu işaretleyememeli';
end $$;
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
  select count(*) into n from public.kirtasiye_bildirimler;
  assert n = 1, 'çalışan bildirimi görmeli, gördü: ' || n;
  update public.kirtasiye_bildirimler set okundu = true;
  reset role;
  assert (select okundu from public.kirtasiye_bildirimler), 'çalışan okundu işaretleyebilmeli';
end $$;

-- 9) Aramalar: dakikada 30 kayıt; fazlası hata vermeden atlanır (müşteri ekranı etkilenmez).
do $$
declare i int;
begin
  set local role anon;
  for i in 1..35 loop
    insert into public.kirtasiye_aramalar (sorgu, sonuc, zaman) values ('arama ' || i, 1, '2000-01-01');
  end loop;
end $$;
do $$
begin
  assert (select count(*) from public.kirtasiye_aramalar) = 30, 'dakikada en çok 30 arama kaydı tutulmalı, tutulan: ' || (select count(*) from public.kirtasiye_aramalar);
  assert (select min(zaman) from public.kirtasiye_aramalar) > now() - interval '1 minute', 'arama zamanı sunucuda now() olmalı';
end $$;

-- 10) Geçersiz talep fonksiyondan da reddedilir (kurulum.sql kuralları geçerli).
do $$
begin
  assert pg_temp.talep('12345') not in ('kaydedildi', 'sinir'), 'geçersiz telefon reddedilmeliydi';
  assert (select count(*) from public.kirtasiye_bildirimler where telefon = '12345') = 0;
end $$;

-- 11) Onay olmadan doğrudan talep yine reddedilir (kurulum.sql kuralı bozulmadı).
do $$
declare m text;
begin
  update public.kirtasiye_talepler set olusturuldu = now() - interval '2 days';
  begin
    set local role anon;
    insert into public.kirtasiye_talepler (kitap, ad, telefon, onay) values ('X', 'Y', '05551234567', false);
    m := 'kabul edildi';
  exception when others then m := '';
  end;
  reset role;
  assert m = '', 'onaysız talep reddedilmeliydi';
end $$;

-- 12) Telefon isteğe bağlı (20 Kasım): ad ve telefon boş talep kaydedilir; telefonsuzlar ortak günlük 5 sınırına takılmaz,
--     ama toplamda 10 dakikada 30'u geçemez; bu durumda bildirim yazılmaz.
do $$
declare i int; ok boolean; n int;
begin
  update public.kirtasiye_talepler set olusturuldu = now() - interval '2 days';
  for i in 1..30 loop
    set local role anon;
    ok := public.kirtasiye_talep_birak('Simyacı', null, '', '', '');
    reset role;
    assert ok, i || '. telefonsuz talep kaydedilmeliydi';
  end loop;
  set local role anon;
  ok := public.kirtasiye_talep_birak('Simyacı', null, '', '', '');
  reset role;
  assert not ok, '31. telefonsuz talep (10 dakikada) kaydedilmemeliydi';
  select count(*) into n from public.kirtasiye_bildirimler where telefon = '';
  assert n = 0, 'telefonsuz talep için bildirim yazılmamalı';
  assert (select count(*) from public.kirtasiye_talepler where telefon = '' and ad = '') = 30;
end $$;

\echo 'guvenlik.test.sql: 12 kontrol geçti'
