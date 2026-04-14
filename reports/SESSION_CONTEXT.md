# Session Context: E2E Authenticated Tests on CI

**Last Updated:** 2026-04-11
**Session Goal:** Make authenticated Maestro E2E tests work on CI Android emulator (GH-240)

---

## What We Did This Session

### Root Cause Investigation
- Ran network diagnostic from inside emulator: TCP+DNS work, but ICMP blocked and TLS/HTTPS fails
- Proved via screenshot that Maestro login flow works perfectly (email typed, password visible with secureTextEntry disabled, login submitted)
- Confirmed "Network request failed" — the emulator cannot make HTTPS calls to api.versemate.org
- Discovered `process.env.APP_ENV` doesn't work at runtime in Expo (only `EXPO_PUBLIC_*` vars are inlined by Metro)
- Confirmed via diagnostic that all seeded AsyncStorage data persists (tokens, cached user, e2e flag)
- Status: INVESTIGATION COMPLETE

### socat TLS Proxy Approach
- Implemented socat TLS-terminating proxy on CI host (port 4000)
- Emulator connects via HTTP to `10.0.2.2:4000` (Android host alias) → socat → HTTPS api.versemate.org
- Added Expo config plugin (`plugins/allow-cleartext-traffic.js`) to allow cleartext HTTP in e2e-test builds
- Connectivity test proved emulator CAN reach 10.0.2.2:4000 (socat logged the connection)
- Status: IN PROGRESS — waiting for force-rebuild run [24278570437](https://github.com/verse-mate/verse-mate-mobile/actions/runs/24278570437)

### setup-authenticated.yaml Rewrite
- Changed from token-seeding approach to real Maestro UI login flow
- clearState:true → fresh seed DB → navigate to login → type credentials → submit
- This gives clean chapter content (from seed DB) AND real authentication
- Status: COMMITTED, pending test

### Code Changes (all on `fix/e2e-auto-login` branch)
- `contexts/AuthContext.tsx` — AsyncStorage e2e_mode flag check, skip API in e2e mode, diagnostic writes
- `components/ui/TextInput.tsx` — `EXPO_PUBLIC_APP_ENV` for secureTextEntry bypass
- `app/e2e-auth.tsx` — `EXPO_PUBLIC_APP_ENV` for route guard
- `eas.json` — Added `EXPO_PUBLIC_APP_ENV`, changed API URL to `http://10.0.2.2:4000` for e2e-test
- `app.config.js` — Cleartext traffic config plugin for e2e-test builds
- `plugins/allow-cleartext-traffic.js` — New Expo config plugin
- `.github/scripts/run-phone-tests.sh` — socat proxy, logcat capture, connectivity tests
- `.github/scripts/seed-auth-tokens.sh` — Added e2e_mode flag to seeded data
- `.github/workflows/maestro-e2e.yml` — Install socat, EXPO_PUBLIC_APP_ENV in OTA step
- `.maestro/shared/setup-authenticated.yaml` — Real login flow via Maestro UI
- `E2E_AUTH_PLAN.md` — Persistent plan document

---

## Current State

### Branches
- `main` — stable, all non-auth tests pass
- `fix/e2e-auto-login` — auth E2E work, 20+ commits of investigation and fixes

### Open PRs
- **PR #255:** fix/e2e-auto-login — E2E auto-login infrastructure

### Pending CI Run
- **Run 24278570437** — force-rebuild with `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` baked into APK
- This is the first run where BOTH conditions are met:
  1. socat proxy running on host (verified working)
  2. APK built with correct API URL pointing to `10.0.2.2:4000`
  3. Cleartext HTTP allowed via config plugin
  4. Emulator→host connectivity proven via nc test

---

## Key Decisions Made

1. **Real login flow over token seeding** — Token seeding worked for data but caused "Error 1" when authenticated mode switched chapter loading to API. Real Maestro UI login with clearState:true gives clean state.
2. **socat TLS proxy over mock server** — socat is one line, uses real API data, no mock maintenance. Only needed because emulator TLS is broken.
3. **10.0.2.2 over localhost+adb reverse** — Android's built-in host alias is more reliable than adb reverse which wasn't working.
4. **Expo config plugin for cleartext** — Only applied in e2e-test builds (APP_ENV check in app.config.js), doesn't affect production.
5. **EXPO_PUBLIC_* prefix required** — Learned that Expo only inlines `EXPO_PUBLIC_*` env vars in runtime JS. Non-prefixed vars only work in app.config.js.

---

## Key Technical Findings

1. **CI emulator TLS is broken** — TCP+DNS work (nc proved it), but React Native's fetch/HTTPS fails with "Network request failed"
2. **OTA updates may not apply code changes** — Multiple runs showed old behavior despite OTA pushes. Force-rebuild is more reliable.
3. **clearState:false preserves broken state** — When authenticated, chapters try API instead of seed DB, causing "Error 1"
4. **secureTextEntry bypass works** — In fresh e2e-test builds, `EXPO_PUBLIC_APP_ENV` IS inlined and passwords are visible
5. **AsyncStorage seeding works** — adb root + sqlite3 writes to RKStorage are reliable (4/4 keys every run)

---

## To Resume

1. Check run [24278570437](https://github.com/verse-mate/verse-mate-mobile/actions/runs/24278570437) results
2. If auth tests PASS:
   - Clean up diagnostic code from AuthContext
   - Run full E2E suite (not just auth folder)
   - Squash commits and create clean PR
3. If auth tests FAIL:
   - Check screenshot — is it still "Network request failed"?
   - If yes: the cleartext plugin might not be working, or socat needs to bind to 0.0.0.0 explicitly
   - Try: `socat TCP-LISTEN:4000,fork,reuseaddr,bind=0.0.0.0 OPENSSL-CONNECT:api.versemate.org:443`
4. Read `E2E_AUTH_PLAN.md` in the repo for full plan context
