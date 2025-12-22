#!/bin/bash
set -e

# Read build ID (from argument or file)
if [ -n "$1" ]; then
  BUILD_ID="$1"
elif [ -f ".deployment/build_id_preview_android.txt" ]; then
  BUILD_ID=$(cat .deployment/build_id_preview_android.txt)
else
  echo "❌ Error: No build ID provided"
  echo "Usage: $0 <build-id>"
  echo "   or: Create .deployment/build_id_preview_android.txt with the build ID"
  exit 1
fi

echo "=========================================="
echo "Submitting Android Build to Play Store (Internal/Closed)"
echo "=========================================="
echo "Build ID: $BUILD_ID"
echo ""
echo "Waiting for build to complete..."
echo ""

# Wait for build to finish (max 45 minutes = 90 checks x 30 seconds)
for i in {1..90}; do
  sleep 30
  eas build:view $BUILD_ID --json > build_status_android.json 2>&1 || true

  # Extract JSON object from output (eas build:view --json includes human-readable output before JSON)
  STATUS=$(grep -A 100 '^{' build_status_android.json | jq -r '.status' 2>/dev/null || echo "UNKNOWN")
  echo "[$i/90] Build status: $STATUS"

  if [ "$STATUS" = "FINISHED" ] || [ "$STATUS" = "finished" ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "Submitting to Play Store..."

    # The 'preview' profile in eas.json handles the track (internal vs closed)
    eas submit --platform android --id $BUILD_ID --profile preview --non-interactive
    echo ""
    echo "✅ Submitted to Play Store!"
    exit 0
  elif [ "$STATUS" = "ERRORED" ] || [ "$STATUS" = "errored" ] || [ "$STATUS" = "CANCELED" ] || [ "$STATUS" = "canceled" ]; then
    echo ""
    echo "❌ Build failed with status: $STATUS"
    exit 1
  fi
done

echo ""
echo "⏱️  Build timeout after 45 minutes"
echo "Check build status at: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/$BUILD_ID"
exit 1
