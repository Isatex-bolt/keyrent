#!/usr/bin/env bash
# 20 clienti provano in parallelo a prenotare lo stesso camper per le stesse date: deve vincerne esattamente uno.
set -euo pipefail
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1)
P=$("${PSQL[@]}" -c "select date_trunc('day', now()) + interval '90 days 10 hours'")
R=$("${PSQL[@]}" -c "select date_trunc('day', now()) + interval '93 days 10 hours'")
OUT=$(mktemp -d)
for i in $(seq 1 20); do
  uid=$(printf 'e0000000-0000-0000-0000-%012d' "$i")
  ( "${PSQL[@]}" -c "select private.create_booking_request('$uid', '3a000000-0000-0000-0000-000000000001', '$P', '$R')" \
      >"$OUT/$i.ok" 2>"$OUT/$i.err" || true ) &
done
wait
WINS=$(find "$OUT" -name '*.ok' -size +0 | wc -l)
LOSSES=$(grep -l NOT_AVAILABLE "$OUT"/*.err | wc -l)
ROWS=$("${PSQL[@]}" -c "select count(*) from unit_reservations where vehicle_unit_id = '2a000000-0000-0000-0000-000000000001' and active and period && tstzrange('$P', '$R')")
echo "ok - 20 richieste concorrenti: $WINS riuscita, $LOSSES rifiutate con NOT_AVAILABLE, $ROWS hold sul periodo"
[ "$WINS" = "1" ] && [ "$LOSSES" = "19" ] && [ "$ROWS" = "1" ] || { echo "FAIL: double booking"; cat "$OUT"/*.err | sort | uniq -c; exit 1; }
