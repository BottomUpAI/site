#!/usr/bin/env bash
# Uploads dist/ to the site bucket and invalidates CloudFront.
#
#   SITE_BUCKET=… SITE_DISTRIBUTION_ID=… scripts/deploy.sh [--dryrun]
#
# Two passes, because the files differ in how long they may be cached:
#   1. _astro/ holds content-hashed assets: cache for a year, never revalidate.
#   2. Everything else (HTML, favicon, …) must revalidate on every request, and
#      files no longer in dist/ are deleted.
# --dryrun lists what would change and stops before the invalidation.
set -euo pipefail

: "${SITE_BUCKET:?SITE_BUCKET is required}"
: "${SITE_DISTRIBUTION_ID:?SITE_DISTRIBUTION_ID is required}"

dryrun=()
if [[ ${1:-} == --dryrun ]]; then
  dryrun=(--dryrun)
fi

[[ -f dist/index.html && -f dist/404.html ]] || { echo "deploy: dist/ is not a complete build" >&2; exit 1; }

aws s3 sync dist "s3://$SITE_BUCKET" "${dryrun[@]}" \
  --exclude "*" --include "_astro/*" \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync dist "s3://$SITE_BUCKET" "${dryrun[@]}" \
  --exclude "_astro/*" --delete \
  --cache-control "public, max-age=0, must-revalidate"

if [[ ${#dryrun[@]} -gt 0 ]]; then
  echo "dry run: no invalidation"
  exit 0
fi

id=$(aws cloudfront create-invalidation --distribution-id "$SITE_DISTRIBUTION_ID" --paths "/*" \
  --query Invalidation.Id --output text)
echo "invalidation $id"
aws cloudfront wait invalidation-completed --distribution-id "$SITE_DISTRIBUTION_ID" --id "$id"
