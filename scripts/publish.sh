#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/publish.sh [patch|minor|major|<x.y.z>]
#
# Defaults to "patch". Verifies the working tree is clean and on the
# tracking branch, runs lint + tests + build, bumps the version
# (creating a commit and tag), and pushes both to origin. The npm
# publish itself is handled by CI/CD on tag push.

cd "$(dirname "$0")/.."

BUMP="${1:-patch}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
EXPECTED_BRANCH="${PUBLISH_BRANCH:-main}"

if [[ "$BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "Refusing to publish from branch '$BRANCH' (expected '$EXPECTED_BRANCH')." >&2
    echo "Override with PUBLISH_BRANCH=<branch> if you really mean it." >&2
    exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is dirty. Commit or stash changes before publishing." >&2
    git status --short >&2
    exit 1
fi

git fetch origin "$EXPECTED_BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$EXPECTED_BRANCH")"
if [[ "$LOCAL" != "$REMOTE" ]]; then
    echo "Local '$EXPECTED_BRANCH' is out of sync with origin." >&2
    echo "  local : $LOCAL" >&2
    echo "  remote: $REMOTE" >&2
    exit 1
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"
echo "Current version: $CURRENT_VERSION"
echo "Bump:            $BUMP"

yarn install --immutable
yarn lint
yarn test
yarn build

# yarn 4: yarn version applies a deferred bump; --immediate writes it now.
yarn version "$BUMP" --immediate

NEW_VERSION="$(node -p "require('./package.json').version")"
TAG="v$NEW_VERSION"
echo "New version: $NEW_VERSION"

git add package.json
git commit -m "chore(release): $TAG"
git tag -a "$TAG" -m "$TAG"

git push origin "$EXPECTED_BRANCH"
git push origin "$TAG"

echo "Pushed $TAG to origin. CI/CD will handle the npm publish."
