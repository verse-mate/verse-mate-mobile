#!/bin/bash
# Seed authentication tokens into the Android emulator's AsyncStorage
# for Maestro E2E tests. This avoids typing passwords into secure fields
# (known Maestro limitation on Android: mobile-dev-inc/maestro#1061).
#
# Usage: bash .github/scripts/seed-auth-tokens.sh
# Requires: E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars

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

echo "Got tokens. Seeding into emulator AsyncStorage..."

# React Native AsyncStorage on Android uses SQLite at:
# /data/data/<package>/databases/RKStorage
# Table: catalystLocalStorage (key TEXT, value TEXT)
PACKAGE="org.versemate.app"
DB_PATH="/data/data/${PACKAGE}/databases/RKStorage"

# Ensure the database and table exist (app must have been launched at least once)
adb shell "sqlite3 ${DB_PATH} \"CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL);\""

# Insert or replace the auth tokens
adb shell "sqlite3 ${DB_PATH} \"INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_access_token', '${ACCESS_TOKEN}');\""
adb shell "sqlite3 ${DB_PATH} \"INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('versemate_refresh_token', '${REFRESH_TOKEN}');\""

# Verify
STORED=$(adb shell "sqlite3 ${DB_PATH} \"SELECT key FROM catalystLocalStorage WHERE key LIKE 'versemate_%';\"")
echo "Stored keys: $STORED"
echo "Auth tokens seeded successfully!"
