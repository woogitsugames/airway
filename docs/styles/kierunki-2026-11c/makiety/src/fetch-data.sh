#!/usr/bin/env bash
# Rebuilds the (not committed) inputs of k3.html into $K3_DEPS. Needs python3 + Pillow + numpy, node, npm, curl.
set -euo pipefail
D="${K3_DEPS:?set K3_DEPS to an empty working dir}"; H="$(cd "$(dirname "$0")" && pwd)"; REPO="$H/../../../../.."
mkdir -p "$D/data" "$D/dl"; cd "$D"
npm init -y >/dev/null; npm i --no-audit --no-fund three@0.170.0 world-atlas@2.0.2 topojson-client@3.1.0
curl -sfL -o dl/hyp.zip https://naturalearth.s3.amazonaws.com/50m_raster/HYP_50M_SR_W.zip && unzip -oq dl/hyp.zip -d dl   # Natural Earth, public domain
curl -sfL -o dl/places.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson
python3 -I -c "
from PIL import Image; Image.MAX_IMAGE_PIXELS=None
Image.open('dl/HYP_50M_SR_W.tif').convert('RGB').resize((4096,2048),Image.LANCZOS).save('data/day.jpg',quality=88)"
python3 -I "$H/prep-data.py" dl/places.geojson data
python3 -I "$H/prep-relief.py" "$REPO/public/data/globe/elevation-2048.png" data
node "$H/prep-borders.mjs" data/borders.json
ln -sfn "$H/../fonts" fonts   # k3.html loads ./fonts/*.ttf
echo "now: K3_DEPS=$D node $H/render.mjs"
