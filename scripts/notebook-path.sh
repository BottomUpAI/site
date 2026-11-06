# Sourced by sync-notebook.sh and publish-notebook.sh: works out which notebook
# an argument names, and its slug (its URL under /notebooks/ and its directory
# under src/content/notebooks/).
#
#   ../notebooks/einops-basics             -> einops-basics/einops-basics.ipynb, slug einops-basics
#   ../notebooks/nes/00-meet-mario.ipynb   -> that file, slug nes-00-meet-mario
#
# A file's slug is its directory's name, then its own name unless that's the
# same, so a series of notebooks in one directory gets distinct slugs.
#
# Sets: nb_dir (the notebook's directory), nb_file (its file name), slug.
notebook_path() {
  local arg=${1%/}
  if [[ $arg == *.ipynb ]]; then
    nb_dir=$(dirname "$arg")
    nb_file=$(basename "$arg")
  else
    nb_dir=$arg
    nb_file="$(basename "$arg").ipynb"
  fi
  local dir_name stem
  dir_name=$(basename "$(cd "$nb_dir" 2>/dev/null && pwd || echo "$nb_dir")")
  stem=${nb_file%.ipynb}
  if [[ $stem == "$dir_name" ]]; then slug=$stem; else slug="$dir_name-$stem"; fi
}
