#!/bin/bash

# Build script for preview builds
# This script triggers a preview build on EAS and captures the build ID
# Used by both CI/CD (GitHub Actions) and local development

set -e

# Get platform from argument (default: ios)
PLATFORM="${1:-ios}"

# Validate platform
if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ]; then
  echo "Error: Invalid platform '$PLATFORM'. Must be 'ios' or 'android'"
  exit 1
fi

echo "=========================================="
echo "Triggering $PLATFORM Preview Build"
echo "=========================================="

# Trigger build and capture output.
# Disable `set -e` around the build so a non-zero exit doesn't abort the
# script before we get a chance to surface EAS's error output. Without this,
# the redirect below swallows the real failure reason (e.g. expired iOS
# credentials) and CI only shows a bare "Process exit code 1".
set +e
eas build --platform "$PLATFORM" --profile preview --non-interactive --no-wait --json > build_output.json 2>&1
EAS_EXIT=$?
set -e

if [ "$EAS_EXIT" -ne 0 ]; then
  echo "❌ eas build failed for $PLATFORM (exit code $EAS_EXIT). EAS output:"
  cat build_output.json
  exit "$EAS_EXIT"
fi

# Extract JSON array from output
BUILD_ID=$(grep -A 100 '^\[' build_output.json | jq -r '.[0].id')

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "❌ Error: Failed to extract build ID"
  cat build_output.json
  exit 1
fi

echo "✅ $PLATFORM Build ID: $BUILD_ID"
echo "🔗 Build URL: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID"

# Save build ID for later steps (platform-specific file)
echo "$BUILD_ID" > ".deployment/build_id_preview_$PLATFORM.txt"

# Also save to generic file for backwards compatibility (iOS only)
if [ "$PLATFORM" = "ios" ]; then
  echo "$BUILD_ID" > .deployment/build_id.txt
fi

# Export for GitHub Actions (if GITHUB_OUTPUT exists)
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "build_id=$BUILD_ID" >> "$GITHUB_OUTPUT"
  echo "build_url=https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID" >> "$GITHUB_OUTPUT"
fi
