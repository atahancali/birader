#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-https://birader.app}"
TIMEOUT="${TIMEOUT:-20}"

echo "== Global access check =="
echo "Target: ${TARGET}"
echo

host="$(echo "${TARGET}" | sed -E 's#https?://##' | cut -d/ -f1)"
echo "-- DNS lookup"
if command -v dig >/dev/null 2>&1; then
  dig +short "${host}" || true
else
  nslookup "${host}" || true
fi
echo

echo "-- TLS/HTTP head"
curl -I "${TARGET}" -m "${TIMEOUT}" || true
echo

echo "-- Route timings"
for path in "/" "/yardim" "/u/test-user"; do
  url="${TARGET%/}${path}"
  echo "Path: ${path}"
  curl -o /dev/null -sS \
    -w "status=%{http_code} dns=%{time_namelookup}s connect=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
    "${url}" -m "${TIMEOUT}" || true
done
echo

cat <<'EOF'
Next:
1) Ayni scripti EU ve US lokasyonda calistir (friend VPS / GitHub Action region runner).
2) EU'da DNS/TTFB ciddi kotuyse Vercel veya Supabase region uyumsuzlugunu kontrol et.
3) 403/429 varsa firewall/rate limit kurallarini gozden gecir.
EOF
