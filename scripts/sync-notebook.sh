#!/usr/bin/env bash
# Copies a notebook from a BottomUpAI/notebooks checkout into the site.
#
#   scripts/sync-notebook.sh ../notebooks/einops-basics
#
# Copies <dir>/<dir name>.ipynb to src/content/notebooks/<dir name>/. A new
# notebook also needs a notebook.yaml there (see src/lib/schemas.ts), and a copy
# of any licence file it names; this script doesn't write either.
set -euo pipefail

src=${1:?usage: scripts/sync-notebook.sh <notebook directory>}
src=${src%/}
slug=$(basename "$src")
ipynb="$src/$slug.ipynb"
dest="src/content/notebooks/$slug"

[[ -f $ipynb ]] || { echo "sync-notebook: no $ipynb" >&2; exit 1; }
mkdir -p "$dest"
cp "$ipynb" "$dest/"
echo "copied $ipynb -> $dest/"
[[ -f $dest/notebook.yaml ]] || echo "sync-notebook: $dest/notebook.yaml doesn't exist yet; write it before building" >&2
