#!/bin/bash
set -e

echo "=========================================="
echo "Triggering iOS Preview Build"
echo "=========================================="

# Trigger build and capture output
eas build --platform ios --profile preview --non-interactive --no-wait --json > build_output.json 2>&1

# Extract JSON array from output
BUILD_ID=$(grep -A 100 '^\[' build_output.json | jq -r '.[0].id')

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "❌ Error: Failed to extract build ID"
  cat build_output.json
  exit 1
fi

echo "✅ iOS Build ID: $BUILD_ID"
echo "🔗 Build URL: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID"

# Export for other scripts to use
echo "$BUILD_ID" > .deployment/build_id.txt

# Export for GitHub Actions (if GITHUB_OUTPUT exists)
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "build_id=$BUILD_ID" >> $GITHUB_OUTPUT
fi
