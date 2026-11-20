-- 90 gün otomatik silme (20 Kasım 2026)
-- Canlı projede kuruldu (başka oturumdan bildirildi). Bu dosya kaydı ve yeniden kurulum içindir.
-- Her gün 03:15 UTC: 90 günden eski talepler ve bildirimler silinir.
-- Gerekli: Supabase > Database > Extensions'ta pg_cron açık olmalı.

create extension if not exists pg_cron;

-- Aynı adla iş varsa önce kaldır (yeniden çalıştırılabilir olsun diye).
select cron.unschedule(jobid) from cron.job where jobname = 'kitabim-90-gun-silme';

select cron.schedule(
  'kitabim-90-gun-silme',
  '15 3 * * *',
  $$
    delete from public.kirtasiye_talepler where olusturuldu < now() - interval '90 days';
    delete from public.kirtasiye_bildirimler where son < now() - interval '90 days';
  $$
);

-- Denetim: select jobname, schedule, active from cron.job where jobname = 'kitabim-90-gun-silme';
