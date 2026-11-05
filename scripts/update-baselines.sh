#!/usr/bin/env bash
# Re-renders the visual baselines for the current branch in CI's Playwright
# container and commits them to the branch.
#
#   scripts/update-baselines.sh
#
# Runs the Update Visual Baselines workflow on the pushed branch, waits for it,
# downloads the screenshots into tests/e2e/__screenshots__/, and commits and
# pushes them if any changed. The branch must be pushed and the tree clean, so
# the baselines match exactly what's on the branch.
set -euo pipefail

WORKFLOW=visual-baselines.yaml
SHOTS=tests/e2e/__screenshots__

branch=$(git rev-parse --abbrev-ref HEAD)
[[ $branch != main && $branch != HEAD ]] || { echo "update-baselines: run this on a PR branch, not $branch" >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "update-baselines: commit or stash your changes first" >&2; exit 1; }
git fetch --quiet origin "$branch"
[[ $(git rev-parse HEAD) == $(git rev-parse "origin/$branch") ]] || {
  echo "update-baselines: push $branch first (local and origin differ)" >&2
  exit 1
}

head=$(git rev-parse HEAD)
gh workflow run "$WORKFLOW" --ref "$branch"

# `gh workflow run` doesn't return the run id; wait for the run on this commit to appear.
run=""
for _ in $(seq 1 30); do
  run=$(gh run list --workflow "$WORKFLOW" --branch "$branch" --event workflow_dispatch --limit 5 \
    --json databaseId,headSha,status --jq "[.[] | select(.headSha == \"$head\")][0].databaseId // empty")
  [[ -n $run ]] && break
  sleep 4
done
[[ -n $run ]] || { echo "update-baselines: the workflow run didn't appear" >&2; exit 1; }

echo "waiting for run $run"
gh run watch "$run" --exit-status --interval 20 >/dev/null || {
  echo "update-baselines: run $run failed: $(gh run view "$run" --json url --jq .url)" >&2
  exit 1
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
gh run download "$run" --name visual-baselines --dir "$tmp"
cp "$tmp"/*.png "$SHOTS/"

if [[ -z $(git status --porcelain -- "$SHOTS") ]]; then
  echo "baselines unchanged"
  exit 0
fi
git add -- "$SHOTS"
git commit --quiet -m "test: visual baselines (Update Visual Baselines run $run)"
git push --quiet
echo "committed and pushed new baselines:"
git show --stat --format= HEAD
