#!/usr/bin/env bash
# Download OFL fonts (static TTF per weight) from Google Fonts + licence text from github.com/google/fonts.
# Usage: ./fetch-fonts.sh "Family Name" dirname "400;700"
set -euo pipefail
fam="$1"; dir="$2"; weights="$3"
out="$(dirname "$0")/fonts"; mkdir -p "$out"
q=$(echo "$fam" | sed 's/ /+/g')
css=$(curl -s "https://fonts.googleapis.com/css2?family=${q}:wght@${weights}" -A "curl/8")
echo "$css" | grep -oE "font-weight: [0-9]+|url\([^)]+\)" | paste - - | while read -r _ w url; do
  u=$(echo "$url" | sed -E 's/url\((.*)\)/\1/'); ext="${u##*.}"
  curl -s "$u" -o "$out/$(echo "$fam" | tr -d ' ')-$w.$ext"; echo "  $fam $w -> .$ext"
done
curl -sf "https://raw.githubusercontent.com/google/fonts/main/ofl/$dir/OFL.txt" -o "$out/OFL-$(echo "$fam" | tr -d ' ').txt" && echo "  licence OK" || echo "  LICENCE MISSING for $dir"
