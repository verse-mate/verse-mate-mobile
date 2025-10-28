#!/bin/bash

# Build script for production builds
# This script triggers a production build on EAS and captures the build ID
# Used by both CI/CD (GitHub Actions) and local development

set -e

# Get platform from argument (default: ios)
PLATFORM="${1:-ios}"

# Validate platform
if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ]; then
  echo "Error: Invalid platform '$PLATFORM'. Must be 'ios' or 'android'"
  exit 1
fi

# Check for EXPO_TOKEN
if [ -z "$EXPO_TOKEN" ]; then
  echo "Error: EXPO_TOKEN environment variable is required"
  exit 1
fi

echo "=========================================="
echo "Triggering $PLATFORM Production Build"
echo "=========================================="

# Trigger production build and capture output
eas build --platform "$PLATFORM" --profile production --non-interactive --no-wait --json > build_output.json 2>&1

# Extract JSON array from output (same as preview script)
BUILD_ID=$(grep -A 100 '^\[' build_output.json | jq -r '.[0].id')

if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
  echo "❌ Error: Failed to extract build ID"
  cat build_output.json
  exit 1
fi

echo "✅ $PLATFORM Build ID: $BUILD_ID"
echo "🔗 Build URL: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID"

# Save build ID for later steps
echo "$BUILD_ID" > ".deployment/build_id_production_$PLATFORM.txt"

# Export for GitHub Actions
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "build_id=$BUILD_ID" >> "$GITHUB_OUTPUT"
  echo "build_url=https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID" >> "$GITHUB_OUTPUT"
fi
