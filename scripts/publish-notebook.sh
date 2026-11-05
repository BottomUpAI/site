#!/usr/bin/env bash
# Publishes a notebook from a BottomUpAI/notebooks checkout: syncs it into the
# site, checks it builds, and opens (or updates) a pull request with fresh
# visual baselines.
#
#   npm run notebook -- ../notebooks/einops-basics
#
# Steps:
#   1. The notebook must be committed and pushed in its own repo, since the page
#      links to it on GitHub.
#   2. On main, switches to a new branch notebook/<slug>; on any other branch,
#      stays there.
#   3. scripts/sync-notebook.sh copies it in (and scaffolds notebook.yaml the
#      first time). If the notebook's directory still has a [[WRITE: …]] marker,
#      stops here: write the description, then run this again.
#   4. Builds, so a notebook the converter can't render fails now, not in CI.
#   5. Commits, pushes, opens a PR if the branch has none, and runs
#      scripts/update-baselines.sh.
set -euo pipefail

src=${1:?usage: npm run notebook -- <notebook directory>}
src=${src%/}
slug=$(basename "$src")
ipynb="$slug.ipynb"
dest="src/content/notebooks/$slug"
fail() { echo "publish-notebook: $*" >&2; exit 1; }

[[ -f $src/$ipynb ]] || fail "no $src/$ipynb"

# 1. The source link must resolve: committed, and on origin/main.
git -C "$src" fetch --quiet origin main
[[ -n $(git -C "$src" ls-files -- "$ipynb") ]] || fail "$src/$ipynb isn't committed in its repo"
[[ -z $(git -C "$src" status --porcelain --untracked-files=no -- .) ]] || fail "$src has uncommitted changes; commit and push them first"
[[ -z $(git -C "$src" diff --name-only origin/main HEAD -- .) ]] || fail "$src differs from origin/main; push it first"

# 2. Branch.
[[ -z $(git status --porcelain) ]] || fail "the site has uncommitted changes; commit or stash them first"
branch=$(git rev-parse --abbrev-ref HEAD)
created=""
if [[ $branch == main ]]; then
  git pull --quiet --ff-only
  branch="notebook/$slug"
  if git switch --quiet -c "$branch" 2>/dev/null; then
    created=1
  else
    git switch --quiet "$branch"
  fi
  echo "on branch $branch"
fi

# 3. Sync, and stop while Nathan's words are still missing.
scripts/sync-notebook.sh "$src"
if grep -rqiE '\[\[[[:space:]]*write[[:space:]]*:' "$dest"; then
  echo
  echo "Write the description in $dest/notebook.yaml (replace the [[WRITE: …]] marker),"
  echo "then run this again: npm run notebook -- $src"
  exit 0
fi

# 4. Build.
npm run build >/dev/null || fail "the build failed; run 'npm run build' to see why"

# 5. Commit, push, PR, baselines.
git add -- "$dest"
if [[ -n $(git status --porcelain -- "$dest") ]]; then
  if git cat-file -e "HEAD:$dest/notebook.yaml" 2>/dev/null; then
    git commit --quiet -m "content: update the $slug notebook"
  else
    git commit --quiet -m "content: add the $slug notebook"
  fi
elif [[ -n $created ]]; then
  # Nothing to publish: undo the branch this run made.
  git switch --quiet main
  git branch --quiet -D "$branch"
  echo "$slug is already up to date on main; nothing to publish"
  exit 0
else
  echo "the notebook is unchanged"
fi
git push --quiet -u origin "$branch"

if [[ -z $(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty') ]]; then
  gh pr create --base main --head "$branch" --title "Notebook: $slug" \
    --body "Syncs \`$slug\` from $(sed -n 's/^source: //p' "$dest/notebook.yaml")."
fi

scripts/update-baselines.sh
echo "done: $(gh pr view "$branch" --json url --jq .url)"
