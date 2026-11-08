#!/usr/bin/env bash
# Download NASA Blue Marble NG (June 2004, topography + bathymetry) and Black Marble 2016 (public domain, US Gov),
# then cut the textures the K1/K2 mockups use into ../.tex/ (git-ignored; ~11 MB, never shipped).
# Usage: bash docs/styles/kierunki-2026-11c/makiety/src/fetch-textures.sh   (needs python3 + Pillow)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; dl="$(mktemp -d)"; out="$here/../.tex"; mkdir -p "$out"
base="https://assets.science.nasa.gov/content/dam/science/esd/eo/images"
curl -fsSL -o "$dl/bm.jpg" "$base/bmng/bmng-topography-bathymetry/june/world.topo.bathy.200406.3x5400x2700.jpg"
curl -fsSL -o "$dl/C1.jpg" "$base/bmng/bmng-topography-bathymetry/june/world.topo.bathy.200406.3x21600x21600.C1.jpg"
curl -fsSL -o "$dl/night.jpg" "$base/imagerecords/144000/144898/BlackMarble_2016_3km.jpg"
python3 -I "$here/prep-textures.py" "$dl" "$out"
rm -rf "$dl"; ls -la "$out"
