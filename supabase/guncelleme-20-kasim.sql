-- 20 Kasım güncellemesi (canlı sistem için; kurulum.sql'in tamamını yeniden çalıştırmaya gerek yok).
-- Supabase > SQL Editor'e yapıştırıp Run'a basın. Birden çok kez çalıştırmak zararsızdır.

-- 1) Müşteri talebinde ad ve telefon isteğe bağlı
alter table public.kirtasiye_talepler drop constraint if exists kirtasiye_talepler_ad_check;
alter table public.kirtasiye_talepler drop constraint if exists kirtasiye_talepler_telefon_check;
alter table public.kirtasiye_talepler alter column ad set default '';
alter table public.kirtasiye_talepler alter column telefon set default '';
alter table public.kirtasiye_talepler add constraint kirtasiye_talepler_ad_check check (length(ad) <= 60);
alter table public.kirtasiye_talepler add constraint kirtasiye_talepler_telefon_check check (telefon = '' or telefon ~ '^0[2-5][0-9]{9}$');

-- 2) Müşteri ekranı kampanya / reklam alanı
alter table public.kirtasiye_ayarlar add column if not exists kampanyalar jsonb not null default '[]'::jsonb check (jsonb_typeof(kampanyalar) = 'array' and pg_column_size(kampanyalar) < 3000000);
