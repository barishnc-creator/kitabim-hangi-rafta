-- Kitabım Hangi Rafta: kapak fotoğrafları deposu.
-- Mevcut kurulumda SQL Editor'de bir kez çalıştırılır (yeni kurulumda kurulum.sql içinde zaten var).
-- Fotoğrafları yalnız kitap-bilgi fonksiyonu yükler (service role); herkes adresiyle görüntüleyebilir.
-- Tarayıcıya yazma izni verilmez: bu depo için ek politika tanımlanmaz.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kapaklar', 'kapaklar', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
