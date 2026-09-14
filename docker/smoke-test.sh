#!/usr/bin/env bash
# Starts the dashboard image and checks what it serves: health, runtime config, caching, SPA routing,
# 404s, security headers, the non-root user — and then the page itself, in a real browser.
#
# Usage:  docker/smoke-test.sh [image]     (default: ghcr.io/mostafahasan1995/cashier-dashboard:local)
# Needs:  docker, curl, node, and `npx playwright install chromium` for the browser step.
# The container is named wf-dashboard-app, published on 127.0.0.1:18080, and removed on exit.

set -euo pipefail

IMAGE="${1:-ghcr.io/mostafahasan1995/cashier-dashboard:local}"
NAME=wf-dashboard-app
PORT=18080
BASE="http://127.0.0.1:${PORT}"
API=http://api.localhost

export MSYS_NO_PATHCONV=1
# That setting has a side effect on this one host: Git Bash also stops translating /dev/null for native
# Windows programs, and the curl that ships with Git for Windows is one. `curl -o /dev/null` then cannot
# write the body and exits 23, which `set -e` turns into a silent abort at the first assignment. NUL is the
# Windows null device; everywhere else this stays /dev/null.
DEVNULL=/dev/null
case "$(uname -s 2>/dev/null)" in MINGW* | MSYS* | CYGWIN*) DEVNULL=NUL ;; esac
cd "$(dirname "$0")/.."

failures=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
# header <path> <name>: prints one response header's value (case-insensitive), without the CR.
header() { curl -s -o "$DEVNULL" -D - "${BASE}$1" | tr -d '\r' | awk -v n="$(echo "$2" | tr 'A-Z' 'a-z')" -F': ' 'tolower($1) == n { sub(/^[^:]*: /, ""); print }'; }
status() { curl -s -o "$DEVNULL" -w '%{http_code}' "${BASE}$1"; }
expect_eq() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected '$3', got '$2')"; fi; }
expect_has() { if [[ "$2" == *"$3"* ]]; then pass "$1"; else fail "$1 (expected to contain '$3', got '$2')"; fi; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:8080" \
    -e API_BASE_URL="$API" -e TENANT_HEADER_ENABLED=true \
    "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
    [ "$(status /healthz)" = 200 ] && break
    sleep 1
done

expect_eq  "GET /healthz is 200"                          "$(status /healthz)" 200
expect_eq  "GET /healthz body is ok"                      "$(curl -s "${BASE}/healthz")" ok
expect_eq  "runs as uid 101 (non-root)"                   "$(docker exec "$NAME" id -u)" 101

config_js=$(curl -s "${BASE}/config.js")
expect_has "/config.js carries the runtime API URL"       "$config_js" "\"apiBaseUrl\":\"${API}\""
expect_has "/config.js carries tenantHeaderEnabled=true"  "$config_js" '"tenantHeaderEnabled":true'
expect_has "/config.js carries shamCashDevEnabled=false"  "$config_js" '"shamCashDevEnabled":false'
expect_eq  "/config.js is Cache-Control: no-store"        "$(header /config.js Cache-Control)" no-store
expect_has "/config.js is served as JavaScript"           "$(header /config.js Content-Type)" javascript

expect_eq  "/ is Cache-Control: no-cache"                 "$(header / Cache-Control)" no-cache
expect_eq  "/index.html is Cache-Control: no-cache"       "$(header /index.html Cache-Control)" no-cache

deep=$(curl -s "${BASE}/deposits/some-id?tab=proofs")
expect_eq  "SPA deep route is 200"                        "$(status '/deposits/some-id?tab=proofs')" 200
expect_has "SPA deep route serves index.html"             "$deep" '<div id="root"></div>'
expect_has "index.html loads /config.js"                  "$deep" '<script src="/config.js"></script>'

expect_eq  "missing /assets file is a real 404"           "$(status /assets/does-not-exist-abc123.js)" 404
expect_eq  "a 404 asset gets no immutable cache header"   "$(header /assets/does-not-exist-abc123.js Cache-Control)" ""
expect_eq  "a 404 still carries X-Frame-Options"          "$(header /assets/does-not-exist-abc123.js X-Frame-Options)" DENY

asset=$(grep -o '/assets/[^"]*\.js' <<<"$deep" | head -n 1)
expect_eq  "a real hashed asset is 200 ($asset)"          "$(status "$asset")" 200
expect_eq  "hashed asset is immutable for a year"         "$(header "$asset" Cache-Control)" "public, max-age=31536000, immutable"
gzip_encoding=$(curl -s -o "$DEVNULL" -D - -H 'Accept-Encoding: gzip' "${BASE}${asset}" | tr -d '\r' | awk -F': ' 'tolower($1) == "content-encoding" { print $2 }')
expect_eq  "hashed asset is gzip-compressed"              "$gzip_encoding" gzip
expect_eq  "the dev placeholder's mock service worker is not in the image" \
           "$(curl -s "${BASE}/mockServiceWorker.js" | grep -c 'Mock Service Worker' || true)" 0

expect_eq  "X-Content-Type-Options"                       "$(header / X-Content-Type-Options)" nosniff
expect_eq  "Referrer-Policy"                              "$(header / Referrer-Policy)" strict-origin-when-cross-origin
expect_eq  "X-Frame-Options"                              "$(header / X-Frame-Options)" DENY
expect_has "Permissions-Policy"                           "$(header / Permissions-Policy)" "camera=()"
csp=$(header / Content-Security-Policy)
expect_has "CSP connect-src includes the API origin"      "$csp" "connect-src 'self' ${API};"
expect_has "CSP img-src allows data: and blob:"           "$csp" "img-src 'self' data: blob:"
expect_has "CSP script-src is self only"                  "$csp" "script-src 'self';"
expect_eq  "no HSTS from nginx (Caddy owns it)"           "$(header / Strict-Transport-Security)" ""
expect_eq  "Server header has no version"                 "$(header / Server)" nginx
expect_eq  "headers also on /healthz"                     "$(header /healthz X-Content-Type-Options)" nosniff

# Access logs: the pages above are logged as JSON, /healthz never is.
sleep 1
logs=$(docker logs "$NAME" 2>/dev/null)
expect_eq  "/healthz is not in the access log"            "$(grep -c '"uri":"/healthz"' <<<"$logs" || true)" 0
expect_has "access log lines are JSON"                    "$logs" '"uri":"/config.js","status":200'

echo
echo "── browser check ──"
if node docker/browser-check.mjs "http://localhost:${PORT}" "$API"; then
    pass "headless Chromium: sign-in renders with zero CSP violations"
else
    fail "headless Chromium check"
fi

echo
if [ "$failures" -eq 0 ]; then
    echo "All smoke checks passed."
else
    echo "$failures smoke check(s) FAILED."
    exit 1
fi
