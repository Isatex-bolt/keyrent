#!/usr/bin/env bash
# Esegue migrazioni, seed e test su un PostgreSQL 16 temporaneo.
# Uso: tests/db/run.sh            (da root, gira come utente 'pgtest')
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${PGDATA_DIR:-/tmp/keyrent-pg}"
PORT="${PGPORT_TEST:-54329}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  RUNAS=(runuser -u pgtest --)
fi

"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true
rm -rf "$DATA"
"${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c max_connections=100" -l /tmp/keyrent-pg.log start -w >/dev/null
trap '"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true' EXIT

export PGHOST=/tmp PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

echo "▸ stub Supabase"
"${PSQL[@]}" -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "▸ migrazione $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "▸ seed"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
echo "▸ fixture"
"${PSQL[@]}" -f "$ROOT/tests/db/05_fixtures.sql" >/dev/null

for f in "$ROOT"/tests/db/[1-9]*.sql; do
  [ -e "$f" ] || continue
  echo "▸ $(basename "$f")"
  "${PSQL[@]}" -f "$f" 2>&1 | sed -n -e 's/^psql:.*NOTICE:  //p' -e '/ERROR/p' -e '/DETAIL/p' -e '/CONTEXT/p'
done
for f in "$ROOT"/tests/db/[1-9]*.sh; do
  [ -e "$f" ] || continue
  echo "▸ $(basename "$f")"
  bash "$f"
done
echo "✔ tutti i test superati"
