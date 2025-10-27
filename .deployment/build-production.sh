#!/bin/bash

# Build script for iOS production builds
# This script triggers an iOS production build on EAS and captures the build ID
# Used by both CI/CD (GitHub Actions) and local development

set -e

# Check for EXPO_TOKEN
if [ -z "$EXPO_TOKEN" ]; then
  echo "Error: EXPO_TOKEN environment variable is required"
  exit 1
fi

echo "Starting iOS production build..."

# Trigger production build and capture output
BUILD_OUTPUT=$(eas build --platform ios --profile production --non-interactive --no-wait --json)

# Extract build ID from JSON output
BUILD_ID=$(echo "$BUILD_OUTPUT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUILD_ID" ]; then
  echo "Error: Failed to extract build ID from EAS output"
  echo "Raw output: $BUILD_OUTPUT"
  exit 1
fi

echo "Build started successfully!"
echo "Build ID: $BUILD_ID"
echo "View build: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID"

# Save build ID for later steps
echo "$BUILD_ID" > .deployment/build_id_production.txt

# Export for GitHub Actions
if [ -n "$GITHUB_OUTPUT" ]; then
  echo "build_id=$BUILD_ID" >> "$GITHUB_OUTPUT"
fi

# Output build ID to stdout for script consumers
echo "$BUILD_ID"
