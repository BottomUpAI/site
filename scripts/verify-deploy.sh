#!/usr/bin/env bash
# Checks that bottomuplabs.ai is serving exactly what was just built.
# Prints "ok <check>" per passing check; exits non-zero on the first failure.
#
#   scripts/verify-deploy.sh                          # the live site
#   ORIGIN=http://localhost:4321 scripts/verify-deploy.sh   # tests/serve.mjs
set -euo pipefail

PRODUCTION="https://bottomuplabs.ai"
ORIGIN="${ORIGIN:-$PRODUCTION}"

fail() {
  echo "FAIL $1: $2"
  exit 1
}

ok() {
  echo "ok $1"
}

fetch() {
  curl -sS --max-time 20 "$1"
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
[[ $(fetch "$ORIGIN/" | sha) == $(sha <dist/index.html) ]] || fail home-matches-build "live / differs from dist/index.html"
ok home-matches-build

# /about (no slash) is rewritten by CloudFront; every stylesheet it links, and
# every font those stylesheets use, must still load.
stylesheets=$(fetch "$ORIGIN/about" | grep -o '<link rel="stylesheet" href="[^"]*"' | sed 's/.*href="//; s/"$//' || true)
[[ -n $stylesheets ]] || fail about-stylesheets "no stylesheets linked from /about"
fonts=""
for css in $stylesheets; do
  [[ $css == /* ]] || fail about-stylesheets "href not root-absolute: '$css'"
  [[ $(status "$ORIGIN$css") == 200 ]] || fail about-stylesheets "$css not served"
  fonts+=" $(fetch "$ORIGIN$css" | grep -o 'url([^)]*\.woff2)' | sed 's/^url(//; s/)$//; s/"//g' || true)"
done
ok about-stylesheets
[[ -n ${fonts// /} ]] || fail about-fonts "no fonts referenced by /about's stylesheets"
for font in $fonts; do
  [[ $(status "$ORIGIN$font") == 200 ]] || fail about-fonts "$font not served"
done
ok about-fonts

# Missing pages are a real 404 with the built 404 page.
code=$(status "$ORIGIN/definitely-missing/")
[[ $code == 404 ]] || fail not-found "status $code"
[[ $(fetch "$ORIGIN/definitely-missing/" | sha) == $(sha <dist/404.html) ]] || fail not-found "body differs from dist/404.html"
ok not-found

# Every security header the browser tests run under (tests/serve.mjs) is the
# one actually being sent.
live=$(curl -sS --max-time 20 -o /dev/null -D - "$ORIGIN/" | tr -d '\r')
while IFS=$'\t' read -r name expected; do
  got=$(awk -F': ' -v n="$name" 'tolower($1) == n { sub(/^[^:]*: /, ""); print; exit }' <<<"$live")
  [[ $got == "$expected" ]] || fail "header $name" "got '$got', expected '$expected'"
  ok "header $name"
done < <(node --input-type=module -e '
  import { SECURITY_HEADERS } from "./tests/serve.mjs";
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) console.log(`${name}\t${value}`);
')

# www redirects to the apex, keeping path and query (production only).
if [[ $ORIGIN == "$PRODUCTION" ]]; then
  location=$(curl -sS --max-time 20 -o /dev/null -w '%{redirect_url}' "https://www.bottomuplabs.ai/about/?x=1")
  [[ $location == "$PRODUCTION/about/?x=1" ]] || fail www-redirect "redirect_url '$location'"
  ok www-redirect
fi
