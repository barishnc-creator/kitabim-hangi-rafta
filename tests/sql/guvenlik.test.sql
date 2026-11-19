-- supabase/guvenlik-2026-11-19.sql testleri (O1: anonim ekleme sınırı).
-- Her assert başarısız olursa psql hata verip durur.
\set ON_ERROR_STOP 1

-- Yardımcı: müşteri ekranı gibi (girişsiz) talep ekler; hata mesajını döndürür, başarılıysa ''.
create function pg_temp.talep(tel text, zaman timestamptz default null) returns text language plpgsql as $$
begin
  set local role anon;
  insert into public.kirtasiye_talepler (kitap, ad, telefon, onay, olusturuldu)
    values ('Kınalı Serçe', 'Ayşe', tel, true, coalesce(zaman, now()));
  reset role;
  return '';
exception when others then
  return sqlerrm;
end $$;

-- 1) Aynı telefondan günde 5 talep; 6.sı reddedilir.
do $$
declare i int; m text;
begin
  for i in 1..5 loop
    m := pg_temp.talep('05321112233');
    assert m = '', 'aynı telefondan ' || i || '. talep kabul edilmeliydi: ' || m;
  end loop;
  m := pg_temp.talep('05321112233');
  assert m like '%Bu telefon numarasıyla%', '6. talep reddedilmeliydi, gelen: ' || coalesce(nullif(m, ''), 'kabul edildi');
  assert (select count(*) from public.kirtasiye_talepler) = 5;
end $$;

-- 2) İstemci geçmiş tarih yazıp sınırı atlatamaz: olusturuldu sunucuda now() olur.
do $$
declare m text;
begin
  m := pg_temp.talep('05329998877', '2000-01-01');
  assert m = '', m;
  assert (select olusturuldu from public.kirtasiye_talepler where telefon = '05329998877') > now() - interval '1 minute',
    'olusturuldu istemciden gelen eski tarih olmamalı';
end $$;

-- 3) Farklı telefonlarla 10 dakikada toplam 30 talep; 31.si reddedilir.
do $$
declare i int; m text;
begin
  for i in 1..24 loop  -- şu ana kadar 6 kayıt var
    m := pg_temp.talep('0533' || lpad(i::text, 7, '0'));
    assert m = '', i || '. farklı telefon kabul edilmeliydi: ' || m;
  end loop;
  assert (select count(*) from public.kirtasiye_talepler) = 30;
  m := pg_temp.talep('05440000001');
  assert m like '%çok fazla talep%', '31. talep reddedilmeliydi, gelen: ' || coalesce(nullif(m, ''), 'kabul edildi');
end $$;

-- 4) Süre geçince yeniden kabul edilir (eski kayıtlar sınıra sayılmaz).
update public.kirtasiye_talepler set olusturuldu = now() - interval '2 days';
do $$
declare m text;
begin
  m := pg_temp.talep('05321112233');
  assert m = '', 'süre geçince aynı telefon yeniden talep bırakabilmeli: ' || m;
end $$;

-- 5) Giriş yapmış ama rolü olmayan hesap da aynı sınıra tabi.
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

-- 6) Aramalar: dakikada 30 kayıt; fazlası hata vermeden atlanır (müşteri ekranı etkilenmez).
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

-- 7) Onay olmadan talep yine reddedilir (kurulum.sql kuralı bozulmadı).
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

\echo 'guvenlik.test.sql: 7 kontrol geçti'
