#!/usr/bin/env bash
# SQL testleri: geçici bir PostgreSQL veritabanında kurulum.sql + güvenlik dosyası + test.
# Gerekenler: yerelde çalışan PostgreSQL ve veritabanı açma yetkisi (psql, createdb).
set -euo pipefail
kok="$(cd "$(dirname "$0")/../.." && pwd)"
db="kht_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
export PGOPTIONS="-c client_min_messages=error"
p() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
p -f "$kok/tests/sql/supabase-taklit.sql"
p -f "$kok/supabase/kurulum.sql" >/dev/null
p -f "$kok/supabase/guvenlik-2026-11-19.sql" >/dev/null
p -f "$kok/supabase/guncelleme-20-kasim.sql" >/dev/null
p -f "$kok/supabase/guvenlik-2026-11-19.sql" >/dev/null  # ikinci kez çalıştırmak zararsız olmalı
p -f "$kok/supabase/guncelleme-20-kasim.sql" >/dev/null
p -f "$kok/tests/sql/guvenlik.test.sql"
echo "SQL testleri geçti."
