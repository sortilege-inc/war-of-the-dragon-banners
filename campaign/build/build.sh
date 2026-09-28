#!/usr/bin/env bash
# War of the Dragon Banners' own build: the squires (Foundry exports → squires.json → DSL layer → data, gated
# at each step), the public pages, and the table's seed. The books (data/) are upstream's, built by
# build/build.sh; run that first after pulling a corpus change.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 campaign/source/extract_foundry.py
python3 campaign/source/convert_squires.py
bash build/build_layer.sh campaign/dsl campaign "War of the Dragon Banners" campaign/data
python3 campaign/source/check_squires.py
python3 campaign/build/build_docs.py
python3 campaign/build/build_seed.py
node --check campaign/data/docs.js
node --check campaign/site/site.js
node -e "JSON.parse(require('fs').readFileSync('campaign/pack/seed.json','utf8'))"
echo "campaign/build/build.sh: OK"
