#!/bin/sh
# Copies the files the site needs into dist/ (for hosts that publish a build folder, e.g.
# EdgeOne Makers: compile command "sh scripts/build-site.sh", output directory "dist").
# Leaves out .git, reference/ and scripts/; copies only what this branch has (study/ etc.).
set -e
rm -rf dist
mkdir dist
for f in a b assets css data icons js study tilepacks vendor index.html map-style.json .nojekyll; do
  if [ -e "$f" ]; then cp -R "$f" dist/; fi
done
echo "dist: $(find dist -type f | wc -l) files"
