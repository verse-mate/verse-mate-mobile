#!/bin/bash
# Seed authentication tokens into the Android emulator's AsyncStorage.
# Called from run-phone-tests.sh after warmup (app has been launched once,
# AsyncStorage DB exists). Uses clearState:false to preserve tokens.
#
# Requires: E2E_TEST_EMAIL, E2E_TEST_PASSWORD env vars

set -e

if [ -z "$E2E_TEST_EMAIL" ] || [ -z "$E2E_TEST_PASSWORD" ]; then
  echo "Skipping auth token seeding (credentials not set)"
  exit 0
fi

echo "Fetching auth tokens from API..."
LOGIN_RESPONSE=$(curl -s --max-time 30 -X POST https://api.versemate.org/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_TEST_EMAIL}\",\"password\":\"${E2E_TEST_PASSWORD}\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "ERROR: Failed to get access token"
  exit 1
fi

echo "Got tokens. Writing to emulator AsyncStorage..."

PACKAGE="org.versemate.app"
DB_PATH="/data/data/${PACKAGE}/databases/RKStorage"

adb root 2>/dev/null || true
sleep 2

# Also fetch the user session (needed for offline restoreSession fallback)
echo "Fetching user session..."
USER_SESSION=$(curl -s --max-time 30 -X GET https://api.versemate.org/auth/session \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

# Write tokens + cached user via temp SQL file (avoids shell quoting issues)
cat > /tmp/seed_tokens.sql << SQLEOF
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_access_token', '${ACCESS_TOKEN}');
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_refresh_token', '${REFRESH_TOKEN}');
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_cached_user', '${USER_SESSION}');
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_e2e_mode', 'true');
SQLEOF

adb push /tmp/seed_tokens.sql /data/local/tmp/seed_tokens.sql
adb shell "sqlite3 ${DB_PATH} < /data/local/tmp/seed_tokens.sql"
adb shell "sqlite3 ${DB_PATH} 'PRAGMA wal_checkpoint(TRUNCATE);'"
adb shell "rm /data/local/tmp/seed_tokens.sql"
rm -f /tmp/seed_tokens.sql

# Verify
KEY_COUNT=$(adb shell "sqlite3 ${DB_PATH} \"SELECT COUNT(*) FROM catalystLocalStorage WHERE key IN ('versemate_access_token', 'versemate_refresh_token', 'versemate_cached_user', 'versemate_e2e_mode');\"" | tr -d '\r')
echo "Auth keys stored: $KEY_COUNT/4"

# Force-stop app so next launch triggers restoreSession with fresh tokens
adb shell am force-stop ${PACKAGE}
echo "Auth tokens seeded. App stopped for clean relaunch."
