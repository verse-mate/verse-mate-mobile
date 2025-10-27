#!/bin/bash

# Download script for EAS builds
# Downloads a completed build from EAS to local machine for testing
# Used for production builds before manual submission

set -e

BUILD_ID=$1

if [ -z "$BUILD_ID" ]; then
  echo "Usage: bash .deployment/download-build.sh <build-id>"
  echo "Example: bash .deployment/download-build.sh abc123-def456-ghi789"
  exit 1
fi

# Check for EXPO_TOKEN
if [ -z "$EXPO_TOKEN" ]; then
  echo "Error: EXPO_TOKEN environment variable is required"
  exit 1
fi

echo "Checking build status for: $BUILD_ID"

# Get build information
BUILD_INFO=$(eas build:view "$BUILD_ID" --json 2>/dev/null | grep -A 100 '^{')

if [ -z "$BUILD_INFO" ]; then
  echo "Error: Could not retrieve build information"
  exit 1
fi

# Extract build status and artifact URL
STATUS=$(echo "$BUILD_INFO" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
PLATFORM=$(echo "$BUILD_INFO" | grep -o '"platform":"[^"]*"' | head -1 | cut -d'"' -f4)
ARTIFACT_URL=$(echo "$BUILD_INFO" | grep -o '"buildUrl":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "Platform: $PLATFORM"
echo "Status: $STATUS"

if [ "$STATUS" != "FINISHED" ]; then
  echo "Error: Build is not finished yet (current status: $STATUS)"
  echo "Please wait for the build to complete before downloading"
  exit 1
fi

if [ -z "$ARTIFACT_URL" ]; then
  echo "Error: Could not find artifact URL for build"
  exit 1
fi

# Determine file extension based on platform
if [ "$PLATFORM" = "IOS" ]; then
  FILE_EXT="ipa"
else
  FILE_EXT="aab"
fi

# Download the build
OUTPUT_FILE="verse-mate-mobile-${BUILD_ID:0:8}.${FILE_EXT}"
echo "Downloading build to: $OUTPUT_FILE"

curl -L -o "$OUTPUT_FILE" "$ARTIFACT_URL"

echo ""
echo "Build downloaded successfully!"
echo "File: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "Next steps:"
if [ "$PLATFORM" = "IOS" ]; then
  echo "  1. Install on device via Xcode: Window > Devices and Simulators"
  echo "  2. Or manually submit to App Store: eas submit --platform ios --id $BUILD_ID"
else
  echo "  1. Test via Google Play Internal App Sharing"
  echo "  2. Or manually submit to Play Store: eas submit --platform android --id $BUILD_ID"
fi
