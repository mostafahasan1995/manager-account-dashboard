#!/usr/bin/env bash
# Proves docker/40-runtime-config.sh writes a /config.js that is valid JavaScript and carries every
# value through EXACTLY, whatever the value contains.
#
# ── WHY THIS TEST EXISTS ─────────────────────────────────────────────────────────────────────────
# The image has no node and no jq, so the JSON encoding is hand-written in POSIX sh and awk. That is
# the kind of code that looks right and is wrong for one byte nobody tried. So this runs the REAL
# script inside the REAL image (busybox sh, awk and od — not the host's GNU tools, which behave
# differently) with hostile values, then hands the output to node on the host, which:
#   1. compiles it as a classic script (a syntax error fails the test),
#   2. runs it and compares window.__APP_CONFIG__ to the original values, byte for byte,
#   3. checks the file is pure ASCII with no raw `<`, so no value can ever spell `</script>`.
# It also proves the script REFUSES to start the container for URLs that could inject into nginx.
#
# Usage:  docker/test-runtime-config.sh [image]   (default: ghcr.io/mostafahasan1995/cashier-dashboard:local)
# Needs:  docker and node on PATH. Runs on Linux CI and in Git Bash on Windows.
# Containers are named wf-dashboard-rtc-* and removed by --rm.

set -euo pipefail

IMAGE="${1:-ghcr.io/mostafahasan1995/cashier-dashboard:local}"
SCRIPT=/docker-entrypoint.d/40-runtime-config.sh

# Git Bash rewrites arguments that look like absolute paths (/docker-entrypoint.d/...) into Windows
# paths before docker sees them. This turns that off; it is ignored everywhere else.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

failures=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

# Runs the entrypoint hook in a throwaway container and prints the generated config.js, a marker,
# then the generated api-origin.conf.
# Values travel as `-e NAME` with no `=`, which makes docker copy them from THIS process's
# environment — so newlines, quotes and unicode reach the container untouched by any shell quoting.
generate() {
    docker run --rm --name "wf-dashboard-rtc-$$-$RANDOM" \
        -e API_BASE_URL -e APP_NAME -e TENANT_HEADER_ENABLED -e ENABLE_SHAMCASH_DEV \
        --entrypoint /bin/sh "$IMAGE" \
        -c "$SCRIPT >/dev/null && cat /tmp/dashboard-runtime/config.js && printf '@@ORIGIN@@\n' && cat /tmp/dashboard-runtime/api-origin.conf"
}

# ── 1. Hostile values round-trip exactly ────────────────────────────────────────────────────────
# The invisible and non-ASCII characters are built from their UTF-8 BYTES with printf. Bash's own
# unicode escapes only work under a UTF-8 locale; Git Bash on Windows is often not in one, and there
# they silently produce the escape's letters instead — a test that passes without testing anything.
#   LS, PS   U+2028 and U+2029, which older JavaScript engines treat as line breaks inside a string
#   ARABIC   two-byte UTF-8 sequences
#   EURO     a three-byte sequence
#   EMOJI    U+1F600, a four-byte sequence that JSON must write as a surrogate pair
#   CTL      U+0001, U+001F and U+007F, control characters
nl=$'\n'
LS=$(printf '\342\200\250')
PS=$(printf '\342\200\251')
ARABIC=$(printf '\330\271\330\261\330\250\331\212')
EURO=$(printf '\342\202\254')
EMOJI=$(printf '\360\237\230\200')
CTL=$(printf '\001\037\177')

export API_BASE_URL='https://api.203-0-113-7.sslip.io:8443/base/"quote"\back</script><!--&amp;///'
APP_NAME="He said \"hi\" \\ \\\\ ${nl}second line"$'\t'"tab </script><script>alert(1)</script> &<> \$HOME \`id\` 'single' "
APP_NAME+="${ARABIC} ${EURO} ${EMOJI} line${nl}sep:${LS}para:${PS} ctl:${CTL} end"
export APP_NAME
export TENANT_HEADER_ENABLED=1
export ENABLE_SHAMCASH_DEV=TRUE # not exactly true or 1, so it must come out false

output=$(generate)
config_js="${output%%@@ORIGIN@@*}"
origin_conf="${output#*@@ORIGIN@@}"

# node reads the expected values from its own environment — the same bytes docker was given.
if CONFIG_JS="$config_js" node -e '
  const vm = require("node:vm");
  const src = process.env.CONFIG_JS;
  const problems = [];

  let script;
  try { script = new vm.Script(src, { filename: "config.js" }); }
  catch (e) { console.error("not valid JavaScript:", e.message); process.exit(1); }

  const sandbox = { window: {} };
  script.runInNewContext(sandbox);
  const got = sandbox.window.__APP_CONFIG__;

  const expected = {
    // The script strips trailing slashes, exactly as src/config.ts does.
    apiBaseUrl: process.env.API_BASE_URL.replace(/\/+$/, ""),
    appName: process.env.APP_NAME,
    tenantHeaderEnabled: true,
    shamCashDevEnabled: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (got[key] !== value) problems.push(`${key}: expected ${JSON.stringify(value)} got ${JSON.stringify(got[key])}`);
  }
  const extra = Object.keys(got).filter((k) => !(k in expected));
  if (extra.length) problems.push(`unexpected keys: ${extra.join(", ")}`);
  if (!Object.isFrozen(got)) problems.push("config object is not frozen");

  if (/[^\x0a\x20-\x7e]/.test(src)) problems.push("output is not pure printable ASCII");
  if (src.includes("<")) problems.push("output contains a raw <");

  // Guard against a vacuous pass: the input must really contain everything this claims to test.
  const cp = (...codes) => String.fromCodePoint(...codes);
  const needles = {
    newline: "\n", tab: "\t", quote: "\"", backslash: "\\", scriptClose: "</script>",
    lineSeparator: cp(0x2028), paragraphSeparator: cp(0x2029),
    controls: cp(0x01, 0x1f, 0x7f), arabic: cp(0x639, 0x631, 0x628, 0x64a),
    euro: cp(0x20ac), emoji: cp(0x1f600),
  };
  for (const [name, needle] of Object.entries(needles)) {
    if (!process.env.APP_NAME.includes(needle)) problems.push(`test input lost its ${name} before reaching node`);
  }
  if (!process.env.API_BASE_URL.includes("</script>")) problems.push("test URL lost </script>");

  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  console.log("      " + src.split("\n")[1]);
'; then
    pass "hostile APP_NAME and API_BASE_URL parse as JavaScript and round-trip exactly"
else
    fail "hostile values did not round-trip; generated file:"
    printf '%s\n' "$config_js"
fi

if grep -q 'default "https://api.203-0-113-7.sslip.io:8443";' <<<"$origin_conf"; then
    pass "CSP origin is scheme://host:port with the path dropped"
else
    fail "unexpected api-origin.conf: $origin_conf"
fi

# ── 2. Booleans: exactly true or 1, anything else false; APP_NAME omitted when empty ───────────
check_bool() {
    local input="$1" want="$2" js
    export API_BASE_URL='http://api.localhost' APP_NAME='' TENANT_HEADER_ENABLED="$input" ENABLE_SHAMCASH_DEV="$input"
    js=$(generate)
    js="${js%%@@ORIGIN@@*}"
    if CONFIG_JS="$js" WANT="$want" node -e '
      const vm = require("node:vm");
      const s = { window: {} };
      new vm.Script(process.env.CONFIG_JS).runInNewContext(s);
      const c = s.window.__APP_CONFIG__, want = process.env.WANT === "true";
      if (c.tenantHeaderEnabled !== want || c.shamCashDevEnabled !== want) process.exit(1);
      if ("appName" in c) process.exit(2);
      if (c.apiBaseUrl !== "http://api.localhost") process.exit(3);
    '; then
        pass "boolean input '${input//$'\n'/\\n}' becomes $want"
    else
        fail "boolean input '${input//$'\n'/\\n}' should become $want (got: $js)"
    fi
}
check_bool true true
check_bool 1 true
for v in false 0 yes TRUE on ' true' 'true ' '' "true${nl}"; do check_bool "$v" false; done

# ── 3. URLs that must stop the container from starting ─────────────────────────────────────────
reject() {
    local label="$1"
    export API_BASE_URL="$2" APP_NAME='' TENANT_HEADER_ENABLED='' ENABLE_SHAMCASH_DEV=''
    if docker run --rm --name "wf-dashboard-rtc-$$-$RANDOM" -e API_BASE_URL \
        --entrypoint /bin/sh "$IMAGE" -c "$SCRIPT" >/dev/null 2>&1; then
        fail "accepted $label"
    else
        pass "refused $label"
    fi
}
reject "an unset API_BASE_URL" ''
reject "a non-http scheme" 'javascript:alert(1)'
reject "a quote in the host (nginx injection)" 'http://api.localhost";add_header X 1;"'
reject "a dollar in the host (nginx variable)" 'http://api$host'
reject "credentials in the URL" 'https://user:pass@api.example.com'
reject "whitespace in the path" 'https://api.example.com/a b'
reject "a newline" "https://api.example.com${nl}evil"
reject "a bare host with no scheme" 'api.example.com'

# ── 4. The full start-up path, through the image's own entrypoint ──────────────────────────────
# `nginx -t` as the command still goes through /docker-entrypoint.sh (it runs the hooks for any
# command starting with "nginx"), so this is the real start-up sequence minus serving traffic.
export API_BASE_URL='' APP_NAME='' TENANT_HEADER_ENABLED='' ENABLE_SHAMCASH_DEV=''
if docker run --rm --name "wf-dashboard-rtc-$$-$RANDOM" -e API_BASE_URL "$IMAGE" nginx -t >/dev/null 2>&1; then
    fail "the container got past its entrypoint without API_BASE_URL"
else
    pass "the image's entrypoint refuses to reach nginx without API_BASE_URL"
fi
export API_BASE_URL='http://api.localhost'
if docker run --rm --name "wf-dashboard-rtc-$$-$RANDOM" -e API_BASE_URL "$IMAGE" nginx -t >/dev/null 2>&1; then
    pass "with API_BASE_URL set, the generated files make a valid nginx configuration (nginx -t)"
else
    fail "nginx -t failed with a valid API_BASE_URL"
fi

echo
if [ "$failures" -eq 0 ]; then
    echo "All runtime-config checks passed."
else
    echo "$failures runtime-config check(s) FAILED."
    exit 1
fi
