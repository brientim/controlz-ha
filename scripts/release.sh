#!/usr/bin/env bash
# Publish a HACS release: test, build, tag v<package.json version>, push, and create the
# GitHub release with dist/controlz-ha.js attached (HACS installs the release asset).
#
#   npm version patch --no-git-tag-version   # bump first (or minor / major), then commit
#   ./scripts/release.sh
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(node -p "require('./package.json').version")"
tag="v${version}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean — commit first." >&2
  exit 1
fi
if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "Tag ${tag} already exists — bump the version in package.json." >&2
  exit 1
fi

npm test
npm run build

git tag -a "${tag}" -m "ControlZ HA ${tag}"
git push origin HEAD "${tag}"
gh release create "${tag}" dist/controlz-ha.js \
  --title "ControlZ HA ${tag}" \
  --generate-notes
echo "Released ${tag}. HACS users get it via HACS → ControlZ HA → Update."
