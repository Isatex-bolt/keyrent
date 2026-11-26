#!/usr/bin/env bash
# Test della logica pagamenti (addebito con esito incerto, recupero, rimborsi, versamenti) con Stripe e database simulati.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$HERE/../../apps/web/src/lib"; T="$(mktemp -d)"
mkdir -p "$T/supabase"
sed -e '/import "server-only";/d' "$SRC/stripe.ts" > "$T/stripe.ts"
sed -e '/import "server-only";/d' "$SRC/payments.ts" > "$T/payments.ts"
cp "$HERE/mock_admin.ts" "$T/supabase/admin.ts"
cp "$HERE/payments.test.ts" "$T/test.ts"
cd "$T" && STRIPE_SECRET_KEY=sk_test_x NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_x tsx test.ts
