#!/usr/bin/env bash
# Copies a notebook from a BottomUpAI/notebooks checkout into the site, and
# scaffolds its notebook.yaml the first time.
#
#   scripts/sync-notebook.sh ../notebooks/einops-basics
#   scripts/sync-notebook.sh ../notebooks/nes/00-meet-mario.ipynb
#
# Copies the notebook (a directory's <dir name>.ipynb, or the file named), any
# licence file beside it (*LICENSE*, *LICENCE*), and the images its Markdown
# cells show (scripts/notebook-images.mjs) to src/content/notebooks/<slug>/;
# scripts/notebook-path.sh says how the slug is chosen.
#
# The first time, writes notebook.yaml with the GitHub source URL (worked out
# from the checkout's origin remote), the group (the top-level folder the
# notebook is in, in its repo), the licence file (if there is exactly one), and
# a [[WRITE: …]] marker for the description, which is Nathan's to write. After
# that it only refreshes source and group, so a notebook moved in its repo
# follows. A group not yet in src/content/notebook-groups.yaml is added there
# with a [[WRITE: …]] title.
set -euo pipefail

source "$(dirname "$0")/notebook-path.sh"
notebook_path "${1:?usage: scripts/sync-notebook.sh <notebook directory or .ipynb>}"
src=$nb_dir
ipynb="$src/$nb_file"
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

while IFS= read -r image; do
  [[ -f $src/$image ]] || { echo "sync-notebook: $nb_file shows $image, which isn't in $src" >&2; exit 1; }
  mkdir -p "$(dirname "$dest/$image")"
  cp "$src/$image" "$dest/$image"
  echo "copied $src/$image -> $dest/$image"
done < <(node "$(dirname "$0")/notebook-images.mjs" "$ipynb")

# Where it is on GitHub, and its group: the top-level folder it's in there.
#   https://github.com/<owner>/<repo>/blob/main/<group>/.../<file>.ipynb
remote=$(git -C "$src" config --get remote.origin.url)
repo=$(sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##' <<<"$remote")
[[ $repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "sync-notebook: origin isn't a GitHub repo: $remote" >&2; exit 1; }
path=$(git -C "$src" ls-files --full-name -- "$nb_file")
[[ -n $path ]] || { echo "sync-notebook: $ipynb isn't committed in its repo" >&2; exit 1; }
source_url="https://github.com/$repo/blob/main/$path"
# A notebook with its own directory (einops-basics/einops-basics.ipynb) needs a
# folder above that; one of several in a directory needs only that directory.
home=${path%.ipynb}
[[ $nb_file == "$(basename "$nb_dir").ipynb" ]] && home=$(dirname "$path")
[[ $home == */* ]] || { echo "sync-notebook: $path isn't in a group folder in its repo" >&2; exit 1; }
group=${home%%/*}
[[ $group =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "sync-notebook: group folder '$group' isn't a slug (a-z, 0-9, -)" >&2; exit 1; }

# A new group gets an entry in the groups file, with a title for Nathan to write.
groups=src/content/notebook-groups.yaml
if ! grep -qE "^- id: $group\$" "$groups"; then
  printf -- '- id: %s\n  title: "[[WRITE: the %s group'"'"'s title on the Notebooks index]]"\n' "$group" "$group" >>"$groups"
  echo "added group $group to $groups: replace its [[WRITE: …]] title before publishing"
fi

meta="$dest/notebook.yaml"
if [[ -f $meta ]]; then
  # Keep Nathan's description and the licence; refresh what's derived from the repo.
  kept=$(grep -vE '^(source|group):' "$meta")
  {
    printf '%s\n' "$kept"
    echo "source: $source_url"
    echo "group: $group"
  } >"$meta"
  echo "updated source and group in $meta"
  exit 0
fi

{
  echo "description: \"[[WRITE: one or two sentences on what the $slug notebook is]]\""
  echo "source: $source_url"
  echo "group: $group"
  if [[ ${#licences[@]} -eq 1 ]]; then
    echo "licence: ${licences[0]}"
  elif [[ ${#licences[@]} -gt 1 ]]; then
    echo "# Several licence files were copied; name the one to show: ${licences[*]}"
  fi
} >"$meta"
echo "wrote $meta: replace its [[WRITE: …]] description before publishing"
