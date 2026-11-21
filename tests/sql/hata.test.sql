-- supabase/hata-kaydi.sql testleri: hata yazma (anonim), okuma yetkisi, tekrar sayımı, izleme anahtarı.
\set ON_ERROR_STOP 1

-- 1) Anonim (müşteri ekranı) hata yazabilir, tabloyu okuyamaz
do $$
declare m text := '';
begin
  set local role anon;
  perform public.kirtasiye_hata_yaz('musteri', 'TypeError: x is undefined', 'at ciz (musteri.js:10)', 'khr-v19', 'iPad Safari');
  begin perform count(*) from public.kirtasiye_hatalar; m := 'okudu'; exception when others then m := ''; end;
  reset role;
  assert m = '', 'anonim hata tablosunu okuyamamalı';
  assert (select count(*) from public.kirtasiye_hatalar) = 1;
end $$;

-- 2) Aynı hata tekrar edince yeni satır açılmaz, adet artar; farklı sürüm ayrı satır; boş mesaj yazılmaz
do $$
begin
  set local role anon;
  perform public.kirtasiye_hata_yaz('musteri', 'TypeError: x is undefined', '', 'khr-v19', 'iPad Safari');
  perform public.kirtasiye_hata_yaz('musteri', 'TypeError: x is undefined', '', 'khr-v20', 'iPad Safari');
  perform public.kirtasiye_hata_yaz('musteri', '   ', '', 'khr-v19', '');
  reset role;
  assert (select adet from public.kirtasiye_hatalar where surum = 'khr-v19') = 2, 'tekrar eden hata sayılmalı';
  assert (select count(*) from public.kirtasiye_hatalar) = 2;
end $$;

-- 3) Saatte en çok 200 yeni satır
do $$
declare i int;
begin
  set local role anon;
  for i in 1..250 loop perform public.kirtasiye_hata_yaz('panel', 'hata ' || i, '', 'khr-v19', ''); end loop;
  reset role;
  assert (select count(*) from public.kirtasiye_hatalar) = 200, 'saatlik sınır 200 olmalı';
  delete from public.kirtasiye_hatalar where mesaj like 'hata %';
end $$;

-- 4) Sistem durumu yalnız düzenleyiciye; anonim ve çalışan alamaz
do $$
declare m text := ''; j json;
begin
  insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000c1') on conflict do nothing;
  insert into public.kirtasiye_uyeler (user_id, rol) values
    ('00000000-0000-0000-0000-0000000000d1', 'duzenleyici'), ('00000000-0000-0000-0000-0000000000c1', 'calisan')
    on conflict (user_id) do update set rol = excluded.rol;
  set local role anon;
  begin perform public.kirtasiye_sistem_durumu(); m := 'aldı'; exception when others then m := ''; end;
  reset role;
  assert m = '', 'anonim sistem durumunu alamamalı';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
  set local role authenticated;
  begin perform public.kirtasiye_sistem_durumu(); m := 'aldı'; exception when others then m := ''; end;
  begin perform count(*) from public.kirtasiye_hatalar; exception when others then null; end;
  reset role;
  assert m = '', 'çalışan sistem durumunu alamamalı';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  set local role authenticated;
  j := public.kirtasiye_sistem_durumu();
  assert (select count(*) from public.kirtasiye_hatalar) = 2, 'düzenleyici hataları okuyabilmeli';
  reset role;
  assert (j ->> 'hata_gorulmemis')::int = 2 and (j ->> 'veritabani_mb') is not null, 'durum alanları dolu olmalı';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- 5) İzleme kapısı: anahtarsız/yanlış anahtarla kapalı, doğru anahtarla okur; anahtar üretimi anonime kapalı
do $$
declare anahtar text; m text := ''; j json;
begin
  set local role anon;
  begin perform public.kirtasiye_izleme_anahtari_uret(); m := 'üretti'; exception when others then m := ''; end;
  reset role;
  assert m = '', 'anonim anahtar üretememeli';
  anahtar := public.kirtasiye_izleme_anahtari_uret();
  assert anahtar like 'izle_%' and length(anahtar) > 60;
  assert not exists (select 1 from public.kirtasiye_izleme where anahtar_ozet = anahtar), 'anahtar düz metin saklanmamalı';
  set local role anon;
  begin perform public.kirtasiye_izle(); m := 'açtı'; exception when others then m := ''; end;
  assert m = '', 'anahtarsız kapı açılmamalı';
  perform set_config('request.headers', json_build_object('x-izleme-token', 'izle_yanlis')::text, true);
  begin perform public.kirtasiye_izle(); m := 'açtı'; exception when others then m := ''; end;
  assert m = '', 'yanlış anahtarla kapı açılmamalı';
  perform set_config('request.headers', json_build_object('x-izleme-token', anahtar)::text, true);
  j := public.kirtasiye_izle();
  reset role;
  assert json_array_length(j -> 'hatalar') = 2 and (j -> 'durum' ->> 'hata_24_saat')::int = 3, 'doğru anahtarla durum ve hatalar okunmalı';
  -- revizeler ve zaman süzgeci
  insert into public.kirtasiye_revizeler (yazan, yazan_ad, metin, olusturuldu) values
    (null, 'Müdür', 'Kiosk yazısı büyüsün', now() - interval '30 minutes'),
    (null, 'Müdür', 'Eski istek', now() - interval '3 days');
  set local role anon;
  j := public.kirtasiye_izle();
  assert json_array_length(j -> 'revizeler') = 2, 'yeni durumdaki tüm revizeler dönmeli';
  j := public.kirtasiye_izle(2);
  assert json_array_length(j -> 'revizeler') = 1 and (j -> 'revizeler' -> 0 ->> 'metin') = 'Kiosk yazısı büyüsün', 'son 2 saatteki revize dönmeli';
  assert json_array_length(j -> 'hatalar') = 2, 'son 2 saatteki hatalar dönmeli';
  assert (j -> 'durum' ->> 'revize_yeni')::int = 2;
  reset role;
  -- yeni anahtar eskisini geçersiz kılar
  perform public.kirtasiye_izleme_anahtari_uret();
  set local role anon;
  begin perform public.kirtasiye_izle(); m := 'açtı'; exception when others then m := ''; end;
  reset role;
  assert m = '', 'eski anahtar geçersiz olmalı';
end $$;

\echo 'hata.test.sql: 5 kontrol geçti'
