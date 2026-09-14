#!/bin/sh
# Runtime configuration for the dashboard container: writes /config.js and the CSP's API origin.
#
# ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
# Vite bakes `import.meta.env.VITE_*` into the bundle at build time, which would mean one image per
# API URL. Four settings instead arrive from the container environment, through a `/config.js` that
# `index.html` loads before the bundle and `src/config.ts` reads (deploy/docs/CONTRACT.md, section 5):
#
#   API_BASE_URL           -> apiBaseUrl           REQUIRED. http(s)://host[:port][/path]
#   APP_NAME               -> appName              optional; empty means "use the translated name"
#   TENANT_HEADER_ENABLED  -> tenantHeaderEnabled  true or 1 is on; ANYTHING else is off
#   ENABLE_SHAMCASH_DEV    -> shamCashDevEnabled   true or 1 is on; ANYTHING else is off
#
# The mock flags are NOT on that list and must never be added. `src/main.tsx` refuses to boot a
# production bundle with the mock backend — which signs anyone in as SUPER_ADMIN — and that refusal
# is only worth something while both of its keys are fixed at build time.
#
# ── HOW IT RUNS ──────────────────────────────────────────────────────────────────────────────────
# The base image's /docker-entrypoint.sh runs every executable /docker-entrypoint.d/*.sh, in order,
# before starting nginx, with `set -e`: a non-zero exit here stops the container from starting. That
# is intended. A dashboard with no API URL, or one nginx cannot build a CSP for, is a blank page in a
# browser, and failing at start puts the reason in `docker logs` instead.
#
# ── WHY THE JSON ENCODING IS HAND-WRITTEN ────────────────────────────────────────────────────────
# The runtime image has no node and no jq, and an environment value is not trusted to be free of
# quotes, backslashes, newlines or `</script>`. Pasting it between quotes would let one stray `"`
# rewrite the config object. So every string is encoded byte by byte (see json_string) into
# pure-ASCII JSON, and docker/test-runtime-config.sh proves the result parses and round-trips.
#
# POSIX sh (busybox ash in the image). This file must keep LF line endings: a CRLF shebang fails as
# "/bin/sh^M: not found" — .gitattributes enforces it.

set -eu

ME=$(basename "$0")
# Overridable only so the test script can point it elsewhere; nginx reads the default path.
OUT_DIR="${DASHBOARD_RUNTIME_DIR:-/tmp/dashboard-runtime}"

log() {
    if [ -z "${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
        printf '%s: %s\n' "$ME" "$*"
    fi
}

fail() {
    printf '%s: ERROR: %s\n' "$ME" "$*" >&2
    exit 1
}

# json_string VALUE — prints VALUE as a double-quoted JSON string literal that is pure ASCII.
#
#   "  \          escaped as \" and \\, the two characters that can end or corrupt a JSON string.
#   < > &         escaped as \u003c \u003e \u0026, so no value can ever spell `</script>` or `<!--`,
#                 whatever context the file is one day inlined into.
#   U+0000-001F, U+007F
#                 control characters, including newline and tab, as \u00XX.
#   non-ASCII     decoded from UTF-8 and written as \uXXXX (a surrogate pair above U+FFFF). That
#                 covers U+2028 and U+2029, which older JavaScript engines treat as line breaks
#                 inside a string, and makes the file independent of any charset header. A byte
#                 sequence that is not valid UTF-8 becomes U+FFFD rather than being passed through.
#
# `od` turns the value into decimal bytes, so awk never has to handle raw binary itself.
json_string() {
    printf '%s' "$1" | od -An -v -tu1 | awk '
        { for (f = 1; f <= NF; f++) b[n++] = $f + 0 }
        END {
            out = "\""
            for (i = 0; i < n; i++) {
                c = b[i]
                if (c == 34)       { out = out "\\\""; continue }
                if (c == 92)       { out = out "\\\\"; continue }
                if (c == 60)       { out = out "\\u003c"; continue }
                if (c == 62)       { out = out "\\u003e"; continue }
                if (c == 38)       { out = out "\\u0026"; continue }
                if (c < 32 || c == 127) { out = out sprintf("\\u%04x", c); continue }
                if (c < 128)       { out = out sprintf("%c", c); continue }

                # A UTF-8 lead byte says how many continuation bytes follow.
                if (c >= 194 && c <= 223)      { len = 1; cp = c - 192 }
                else if (c >= 224 && c <= 239) { len = 2; cp = c - 224 }
                else if (c >= 240 && c <= 244) { len = 3; cp = c - 240 }
                else { out = out "\\ufffd"; continue }

                ok = (i + len < n)
                for (k = 1; ok && k <= len; k++) {
                    d = b[i + k]
                    if (d < 128 || d > 191) ok = 0
                    else cp = cp * 64 + (d - 128)
                }
                # Overlong encodings, UTF-16 surrogates and values past U+10FFFF are not valid UTF-8.
                if (ok && ((len == 2 && cp < 2048) || (len == 3 && cp < 65536) || (cp >= 55296 && cp <= 57343) || cp > 1114111)) ok = 0
                if (!ok) { out = out "\\ufffd"; continue }

                i += len
                if (cp < 65536) {
                    out = out sprintf("\\u%04x", cp)
                } else {
                    cp -= 65536
                    out = out sprintf("\\u%04x\\u%04x", 55296 + int(cp / 1024), 56320 + (cp % 1024))
                }
            }
            printf "%s\"", out
        }'
}

# bool_literal VALUE — `true` for exactly "true" or "1", `false` for anything else.
# Same rule as `bool` in src/config.ts: a flag that decides whose money is on screen does not guess
# what "yes", "TRUE" or "on" meant.
bool_literal() {
    case "$1" in
        true | 1) printf 'true' ;;
        *) printf 'false' ;;
    esac
}

# ── API_BASE_URL: required, validated, and reduced to an origin for the CSP ─────────────────────
api_base_url="${API_BASE_URL:-}"
[ -n "$api_base_url" ] || fail "API_BASE_URL is not set. It must be the public URL of the API, e.g. https://api.203-0-113-7.sslip.io"

# One line only: grep below matches line by line, so a value with a newline must not reach it.
case "$api_base_url" in
    *'
'*) fail "API_BASE_URL contains a line break" ;;
esac

# scheme://host[:port][/path]. The host charset is deliberately narrow — letters, digits, dots and
# hyphens, or a bracketed IPv6 address — because the origin is written into nginx configuration, where
# a quote, a semicolon or a `$` would change the meaning of the file. No user:password@ either.
if ! printf '%s\n' "$api_base_url" | grep -Eq '^https?://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(/[^[:space:][:cntrl:]]*)?$'; then
    fail "API_BASE_URL must look like http(s)://host[:port][/path] with no credentials; got: $api_base_url"
fi

# Trailing slashes make `${base}/v1/...` produce `//v1/...`; src/config.ts strips them as well.
api_base_url=$(printf '%s\n' "$api_base_url" | sed 's:/*$::')
api_origin=$(printf '%s\n' "$api_base_url" | sed -E 's#^(https?://[^/]+).*$#\1#')

# ── Encode everything first, so a failure cannot leave a half-written file behind ───────────────
api_json=$(json_string "$api_base_url")
app_name_json=""
if [ -n "${APP_NAME:-}" ]; then
    app_name_json=$(json_string "$APP_NAME")
fi
tenant_json=$(bool_literal "${TENANT_HEADER_ENABLED:-}")
shamcash_json=$(bool_literal "${ENABLE_SHAMCASH_DEV:-}")

mkdir -p "$OUT_DIR"

# Written to a temporary name and renamed, so nginx can never serve a partially written file.
tmp="$OUT_DIR/.config.js.$$"
{
    printf '%s\n' '// Generated at container start by /docker-entrypoint.d/40-runtime-config.sh. Do not edit.'
    printf 'window.__APP_CONFIG__ = Object.freeze({"apiBaseUrl":%s' "$api_json"
    if [ -n "$app_name_json" ]; then
        printf ',"appName":%s' "$app_name_json"
    fi
    printf ',"tenantHeaderEnabled":%s,"shamCashDevEnabled":%s});\n' "$tenant_json" "$shamcash_json"
} >"$tmp"
chmod 0644 "$tmp"
mv -f "$tmp" "$OUT_DIR/config.js"

# `map` with an empty source is nginx's way of declaring a constant variable at http level.
tmp="$OUT_DIR/.api-origin.conf.$$"
printf '# Generated at container start from API_BASE_URL. Do not edit.\nmap "" $dashboard_api_origin {\n    default "%s";\n}\n' "$api_origin" >"$tmp"
chmod 0644 "$tmp"
mv -f "$tmp" "$OUT_DIR/api-origin.conf"

log "wrote $OUT_DIR/config.js (apiBaseUrl=$api_base_url, tenantHeaderEnabled=$tenant_json, shamCashDevEnabled=$shamcash_json)"
log "wrote $OUT_DIR/api-origin.conf (CSP connect-src adds $api_origin)"
