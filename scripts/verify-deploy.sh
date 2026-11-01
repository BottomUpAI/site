#!/usr/bin/env bash
# Checks that bottomuplabs.ai is serving exactly what was just built.
# Prints "ok <check>" per passing check; exits non-zero on the first failure.
set -euo pipefail

ORIGIN="https://bottomuplabs.ai"

fail() {
  echo "FAIL $1: $2"
  exit 1
}

ok() {
  echo "ok $1"
}

status() {
  curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$1"
}

sha() {
  shasum -a 256 | cut -d' ' -f1
}

for path in / /about/ /about; do
  code=$(status "$ORIGIN$path")
  [[ $code == 200 ]] || fail "status $path" "$code"
  ok "status $path"
done

# The live home page is byte for byte the one in dist/.
[[ $(curl -sS --max-time 20 "$ORIGIN/" | sha) == $(sha <dist/index.html) ]] || fail home-matches-build "live / differs from dist/index.html"
ok home-matches-build

# /about (no slash) is rewritten by CloudFront; its stylesheet must still load.
css=$(curl -sS --max-time 20 "$ORIGIN/about" | grep -o '<link rel="stylesheet" href="[^"]*"' | head -1 | sed 's/.*href="//; s/"$//')
[[ $css == /* ]] || fail about-stylesheet "href not root-absolute: '$css'"
[[ $(status "$ORIGIN$css") == 200 ]] || fail about-stylesheet "$css not served"
ok about-stylesheet

# Missing pages are a real 404 with the built 404 page.
code=$(status "$ORIGIN/definitely-missing/")
[[ $code == 404 ]] || fail not-found "status $code"
[[ $(curl -sS --max-time 20 "$ORIGIN/definitely-missing/" | sha) == $(sha <dist/404.html) ]] || fail not-found "body differs from dist/404.html"
ok not-found

# The CSP the browser tests use (tests/serve.mjs) is the one CloudFront sends.
expected=$(node --input-type=module -e 'import { PRODUCTION_CSP } from "./tests/serve.mjs"; console.log(PRODUCTION_CSP)')
live=$(curl -sS --max-time 20 -o /dev/null -D - "$ORIGIN/" | tr -d '\r' | awk -F': ' 'tolower($1) == "content-security-policy" { print $2 }')
[[ $live == "$expected" ]] || fail csp "live: $live"
ok csp
