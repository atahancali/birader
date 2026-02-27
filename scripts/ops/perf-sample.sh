#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
REQUESTS="${REQUESTS:-8}"
START_CMD="${START_CMD:-npm run start}"

echo "== Perf sample =="
echo "Build..."
npm run build >/dev/null

echo "Start app..."
${START_CMD} >/tmp/birader-start.log 2>&1 &
APP_PID=$!
trap 'kill ${APP_PID} >/dev/null 2>&1 || true' EXIT

for _ in {1..30}; do
  if curl -s "${BASE_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -s "${BASE_URL}" >/dev/null 2>&1; then
  echo "App could not start. See /tmp/birader-start.log"
  exit 1
fi

sample_route () {
  local route="$1"
  local total=0
  local ttfb=0
  local code=0
  local url="${BASE_URL%/}${route}"

  for _ in $(seq 1 "${REQUESTS}"); do
    out="$(curl -o /dev/null -sS -w "%{http_code} %{time_starttransfer} %{time_total}" "${url}")"
    code="$(echo "${out}" | awk '{print $1}')"
    ttfb="$(echo "${out}" | awk '{print $2}')"
    total="$(echo "${out}" | awk '{print $3}')"
    echo "${route} status=${code} ttfb=${ttfb}s total=${total}s"
  done
}

sample_route "/"
sample_route "/yardim"

echo
echo "Tip: LCP/INP icin Vercel Speed Insights + browser profiler birlikte kullan."
