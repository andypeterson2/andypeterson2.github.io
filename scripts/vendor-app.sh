#!/usr/bin/env bash
#
# vendor-app.sh — refresh a sub-app's built frontend assets into public/<app>/
#
# The portal commits each app's built frontend under public/<app>/ and serves it
# statically. This script re-vendors those assets from the app's own repository.
# It is a MAINTAINER action: the site build never runs it, so there is no
# build-time network dependency and the site keeps building offline / on Pages.
#
# Usage:
#   scripts/vendor-app.sh <app|all> [--from <local-clone>] [--ref <git-ref>]
#
# Apps:  classifiers  nonogram  video-chat  ui-kit
#   (cv is portal-owned/frozen — its public/cv/* frontend has no upstream
#    source in the cv repo, so it is intentionally NOT synced here.)
#
# Notes:
#   - Default refs track the currently-deployed branches. The API-contract work
#     for classifiers/nonogram/video-chat currently lives on tech-debt/api-contract;
#     update REF here (or pass --ref) once those merge to main.
#   - video-chat (qvc) is mid-refactor; its source dir (website/client/static)
#     is expected to move to public/video-chat upstream — update SRC_DIR then.
#   - The script never commits; it prints a diff for you to review and commit.
#
# Examples:
#   scripts/vendor-app.sh nonogram
#   scripts/vendor-app.sh classifiers --ref main
#   scripts/vendor-app.sh ui-kit --from ../ui-kit
#   scripts/vendor-app.sh all
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS=(classifiers nonogram video-chat ui-kit)

app_config() {
  # Sets globals: REPO REF SRC_DIR BUILD_CMD INCLUDE[] DEST
  BUILD_CMD=""
  case "$1" in
    classifiers)
      REPO="https://github.com/andypeterson2/quantum-machine-learning.git"
      REF="tech-debt/api-contract"
      SRC_DIR="classifiers/static/js"
      INCLUDE=(app.js chart.js connection.js sse.js)
      DEST="public/classifiers/js" ;;
    nonogram)
      REPO="https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver.git"
      REF="tech-debt/api-contract"
      SRC_DIR="website/static"
      INCLUDE=(app.js grid.js solver.js state.js)
      DEST="public/nonogram/js" ;;
    video-chat)
      REPO="https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat.git"
      REF="tech-debt/api-contract"
      SRC_DIR="website/client/static"
      INCLUDE=(js/app.js js/dashboard.js css/style.css logo.png)
      DEST="public/video-chat" ;;
    ui-kit)
      REPO="https://github.com/andypeterson2/ui-kit.git"
      REF="main"
      SRC_DIR="."
      INCLUDE=(icons.js ui-kit.js)
      DEST="public/vendor/ui-kit" ;;
    *)
      echo "Unknown app: $1" >&2
      echo "Known apps: ${APPS[*]}  (cv is portal-owned, not synced)" >&2
      return 1 ;;
  esac
}

vendor_one() {
  local app="$1" from="$2" ref_override="$3"
  app_config "$app" || return 1
  [ -n "$ref_override" ] && REF="$ref_override"

  local src cleanup=""
  if [ -n "$from" ]; then
    src="$from"
    echo "→ $app: using local clone $src (ref ignored)"
  else
    src="$(mktemp -d)"; cleanup="$src"
    echo "→ $app: cloning $REPO @ $REF"
    git clone --depth 1 --branch "$REF" "$REPO" "$src" >/dev/null 2>&1
  fi

  if [ -n "$BUILD_CMD" ]; then
    echo "→ $app: building ($BUILD_CMD)"
    ( cd "$src" && eval "$BUILD_CMD" )
  fi

  local dest="$ROOT/$DEST" f srcfile missing=0
  mkdir -p "$dest"
  for f in "${INCLUDE[@]}"; do
    srcfile="$src/$SRC_DIR/$f"
    if [ ! -f "$srcfile" ]; then
      echo "  ! missing in source: $SRC_DIR/$f" >&2; missing=1; continue
    fi
    mkdir -p "$dest/$(dirname "$f")"
    rsync -a --exclude='.DS_Store' "$srcfile" "$dest/$f"
  done

  [ -n "$cleanup" ] && rm -rf "$cleanup"
  if [ "$missing" -eq 0 ]; then
    echo "→ $app: vendored ${#INCLUDE[@]} file(s) to $DEST"
  else
    echo "→ $app: vendored with WARNINGS (see missing files above)" >&2
  fi
}

TARGET="${1:-}"; shift || true
FROM=""; REF_OVERRIDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:?--from needs a path}"; shift 2 ;;
    --ref)  REF_OVERRIDE="${2:?--ref needs a ref}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
[ -z "$TARGET" ] && { echo "Usage: scripts/vendor-app.sh <app|all> [--from <path>] [--ref <ref>]" >&2; exit 2; }

cd "$ROOT"
if [ "$TARGET" = "all" ]; then
  [ -n "$FROM" ] && { echo "--from cannot be combined with 'all'" >&2; exit 2; }
  for a in "${APPS[@]}"; do vendor_one "$a" "" "$REF_OVERRIDE"; done
else
  vendor_one "$TARGET" "$FROM" "$REF_OVERRIDE"
fi

echo
echo "Review and commit:"
git -C "$ROOT" status --short -- public/ | sed 's/^/  /' || true
echo "  git add public/ && git commit -m 'chore: refresh vendored assets'"
