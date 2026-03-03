#!/bin/bash
set -e

adb install app.apk

# Warm launch: trigger EAS Update download
adb shell monkey -p org.versemate.app -c android.intent.category.LAUNCHER 1
sleep 15
adb shell am force-stop org.versemate.app
echo "Warm launch complete - update pre-downloaded"

# Force landscape orientation for split-view tests
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
echo "Tablet emulator set to landscape orientation"

TEST_FOLDER="$1"

# Split-view tests are currently disabled on CI — the Nexus 10 emulator's
# onboarding flow doesn't render reliably (clearState + EAS Update + landscape
# rotation timing). Run locally: maestro test .maestro/split-view/
# TODO: Re-enable once tablet emulator setup is stabilized
echo "Split-view tests temporarily disabled on CI (see run-tablet-tests.sh)"
echo "Run locally: maestro test .maestro/split-view/"
