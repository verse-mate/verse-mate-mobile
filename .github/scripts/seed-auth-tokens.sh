#!/bin/bash
# Seed authentication tokens into the Android emulator's AsyncStorage
# for Maestro E2E tests. This avoids typing passwords into secure fields
# (known Maestro limitation on Android: mobile-dev-inc/maestro#1061).
#
# Usage: bash .github/scripts/seed-auth-tokens.sh
# Requires: E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars
# Must run AFTER the app has been launched at least once (so AsyncStorage DB exists)

set -e

if [ -z "$E2E_TEST_EMAIL" ] || [ -z "$E2E_TEST_PASSWORD" ]; then
  echo "Skipping auth token seeding (E2E_TEST_EMAIL or E2E_TEST_PASSWORD not set)"
  exit 0
fi

echo "Fetching auth tokens from API..."
LOGIN_RESPONSE=$(curl -s --max-time 30 -X POST https://api.versemate.org/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${E2E_TEST_EMAIL}\",\"password\":\"${E2E_TEST_PASSWORD}\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "" ]; then
  echo "ERROR: Failed to get access token. Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "Got tokens successfully."

# React Native AsyncStorage on Android uses SQLite at:
# /data/data/<package>/databases/RKStorage
# Table: catalystLocalStorage (key TEXT, value TEXT)
PACKAGE="org.versemate.app"
DB_PATH="/data/data/${PACKAGE}/databases/RKStorage"

# On CI emulators (Google APIs), use adb root for direct file access
# (run-as doesn't work on non-debuggable release builds)
adb root 2>/dev/null || true
sleep 2

# Check if DB exists — if not, create it with the correct table
DB_EXISTS=$(adb shell "test -f ${DB_PATH} && echo yes || echo no" | tr -d '\r')
if [ "$DB_EXISTS" = "no" ]; then
  echo "AsyncStorage DB doesn't exist yet, creating it..."
  adb shell "mkdir -p /data/data/${PACKAGE}/databases" 2>/dev/null || true
  adb shell "sqlite3 ${DB_PATH} 'CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL);'"
  # Fix ownership so the app can read the DB
  adb shell "chown -R $(adb shell stat -c '%u:%g' /data/data/${PACKAGE}/) /data/data/${PACKAGE}/databases/" 2>/dev/null || true
fi

# Write SQL to a temp file to avoid shell quoting issues with JWT tokens
echo "Writing tokens to AsyncStorage..."
cat > /tmp/seed_tokens.sql << SQLEOF
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_access_token', '${ACCESS_TOKEN}');
INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_refresh_token', '${REFRESH_TOKEN}');
SQLEOF

adb push /tmp/seed_tokens.sql /data/local/tmp/seed_tokens.sql
adb shell "sqlite3 ${DB_PATH} < /data/local/tmp/seed_tokens.sql"
# Force WAL checkpoint so data is visible to all readers (app uses separate connection)
adb shell "sqlite3 ${DB_PATH} 'PRAGMA wal_checkpoint(TRUNCATE);'"
adb shell "rm /data/local/tmp/seed_tokens.sql"
rm -f /tmp/seed_tokens.sql

# Verify tokens were stored
STORED=$(adb shell "sqlite3 ${DB_PATH} \"SELECT key FROM catalystLocalStorage WHERE key = 'versemate_access_token' OR key = 'versemate_refresh_token';\"" | tr -d '\r')
echo "Stored keys: $STORED"

# Count stored auth keys
KEY_COUNT=$(adb shell "sqlite3 ${DB_PATH} \"SELECT COUNT(*) FROM catalystLocalStorage WHERE key IN ('versemate_access_token', 'versemate_refresh_token');\"" | tr -d '\r')
echo "Auth keys found: $KEY_COUNT (expected 2)"

if [ "$KEY_COUNT" = "2" ]; then
  echo "Auth tokens seeded successfully!"
else
  echo "WARNING: Expected 2 auth keys, got $KEY_COUNT. Debug:"
  adb shell "sqlite3 ${DB_PATH} \"SELECT key, length(value) FROM catalystLocalStorage WHERE key LIKE 'versemate%';\""
  # Try individual inserts as fallback
  echo "Retrying individual inserts..."
  adb shell "sqlite3 ${DB_PATH} \"INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_access_token', '${ACCESS_TOKEN}');\""
  adb shell "sqlite3 ${DB_PATH} \"INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_refresh_token', '${REFRESH_TOKEN}');\""
  KEY_COUNT=$(adb shell "sqlite3 ${DB_PATH} \"SELECT COUNT(*) FROM catalystLocalStorage WHERE key IN ('versemate_access_token', 'versemate_refresh_token');\"" | tr -d '\r')
  echo "After retry: $KEY_COUNT auth keys"
fi
