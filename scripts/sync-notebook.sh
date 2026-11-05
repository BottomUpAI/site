#!/usr/bin/env bash
# Copies a notebook from a BottomUpAI/notebooks checkout into the site, and
# scaffolds its notebook.yaml the first time.
#
#   scripts/sync-notebook.sh ../notebooks/einops-basics
#
# Copies <dir>/<dir name>.ipynb and any licence file (*LICENSE*, *LICENCE*) to
# src/content/notebooks/<dir name>/. If notebook.yaml doesn't exist yet, writes
# one with the GitHub source URL worked out from the checkout's origin remote,
# the licence file (if there is exactly one), and a [[WRITE: …]] marker for the
# description, which is Nathan's to write. An existing notebook.yaml is left alone.
set -euo pipefail

src=${1:?usage: scripts/sync-notebook.sh <notebook directory>}
src=${src%/}
slug=$(basename "$src")
ipynb="$src/$slug.ipynb"
dest="src/content/notebooks/$slug"

[[ -f $ipynb ]] || { echo "sync-notebook: no $ipynb" >&2; exit 1; }
[[ $slug =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "sync-notebook: '$slug' isn't a URL slug (a-z, 0-9, -)" >&2; exit 1; }

mkdir -p "$dest"
cp "$ipynb" "$dest/"
echo "copied $ipynb -> $dest/"

licences=()
for file in "$src"/*LICENSE* "$src"/*LICENCE*; do
  [[ -f $file ]] || continue
  cp "$file" "$dest/"
  licences+=("$(basename "$file")")
  echo "copied $file -> $dest/"
done

meta="$dest/notebook.yaml"
if [[ -f $meta ]]; then
  echo "kept $meta"
  exit 0
fi

# https://github.com/<owner>/<repo>/blob/main/<path in repo>/<slug>.ipynb
remote=$(git -C "$src" config --get remote.origin.url)
repo=$(sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##' <<<"$remote")
[[ $repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "sync-notebook: origin isn't a GitHub repo: $remote" >&2; exit 1; }
path=$(git -C "$src" ls-files --full-name -- "$slug.ipynb")
[[ -n $path ]] || { echo "sync-notebook: $ipynb isn't committed in its repo" >&2; exit 1; }

{
  echo "description: \"[[WRITE: one or two sentences on what the $slug notebook is]]\""
  echo "source: https://github.com/$repo/blob/main/$path"
  if [[ ${#licences[@]} -eq 1 ]]; then
    echo "licence: ${licences[0]}"
  elif [[ ${#licences[@]} -gt 1 ]]; then
    echo "# Several licence files were copied; name the one to show: ${licences[*]}"
  fi
} >"$meta"
echo "wrote $meta: replace its [[WRITE: …]] description before publishing"
