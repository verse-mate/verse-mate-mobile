# E2E Authenticated Tests — Plan & Status

**Last Updated:** 2026-04-09
**Branch:** `fix/e2e-auto-login`
**Goal:** Make authenticated Maestro E2E tests green on CI. Core product features are behind login, so this is blocking real E2E coverage.

---

## Current Status: socat TLS proxy approach — adb reverse not reaching app

### What's been proven:
1. **Emulator TCP+DNS work** (nc to api.versemate.org:443 succeeds) — but TLS/HTTPS from React Native fails
2. **Maestro login flow works perfectly** — credentials typed, password visible (secureTextEntry disabled), login submitted
3. **socat TLS proxy works on host** — `curl http://localhost:4000/openapi/json` verified in CI
4. **cleartext HTTP plugin works** — `usesCleartextTraffic=true` set via Expo config plugin for e2e-test builds
5. **adb reverse is configured** — but the app still gets "Network request failed"

### Next step:
Verify `adb reverse` is actually working from within the emulator. Add `adb reverse --list` before tests and test connectivity from emulator shell: `adb shell curl http://localhost:4000/healthcheck`. If adb reverse isn't working, try `10.0.2.2:4000` (emulator host alias) instead.

---

## What's Working

- Token seeding via `adb sqlite3` — access token + cached user profile stored every run (refresh tokens eliminated per D-005)
- `secureTextEntry` fix — passwords can be typed in e2e-test builds (Maestro issue #1061 workaround)
- 30+ **unauthenticated** tests pass reliably (Bible reading, navigation, swipe, search, topics, unauthenticated bookmarks/highlights/notes)
- Infrastructure for auth: `.maestro/shared/setup-authenticated.yaml`, `.github/scripts/seed-auth-tokens.sh`, `AuthContext` e2e-test fallback

## What's Failing

- **All authenticated tests fail**. Screenshot from failed run shows:
  - "Error 1" where the book name should be
  - "Chapter not found" in the content area
  - Hamburger menu visible (so the app IS loaded)
  - But chapter content failed to fetch → error state
- Tests fail because downstream assertions (`verse-text-1`, `bookmark-toggle-1-1`, etc.) can't find elements that depend on chapter content being loaded

## Suspected Root Cause

The CI GitHub Actions Android emulator **probably** cannot reach `api.versemate.org` from inside the app. Evidence:
- Host machine CAN reach the API (token seeding via curl works)
- App inside emulator cannot load chapter content, even though the app has a bundled seed DB for offline reading
- Unauthenticated tests pass because `clearState: true` gives them a fresh state that doesn't hit the broken code path
- Authenticated tests use `clearState: false` to preserve tokens, which also preserves state that leads into API calls

**BUT we haven't proven this definitively.** The next phase fixes that.

---

## The Plan

### Phase 1: Definitive Diagnosis (30 min) — **CURRENT PHASE**

**Goal:** Prove or disprove the network limitation with one CI run.

**Action:** Add a diagnostic step to `.github/scripts/run-phone-tests.sh` that runs inside the emulator:

1. `adb shell ping -c 3 -W 5 8.8.8.8` — can emulator reach internet at all?
2. `adb shell getprop net.dns1` / `net.dns2` — is DNS configured?
3. `adb shell ping -c 3 -W 5 api.versemate.org` — can DNS resolve + reach the API host?
4. `adb shell curl -v --max-time 10 https://api.versemate.org/openapi/json` — can the app make HTTPS requests?

Output goes to the workflow summary so we have clear evidence.

**Decision point based on result:**

| Result | Next Step |
|---|---|
| ✅ All 4 checks pass | Network works → Phase 2A: fix the actual app bug |
| ❌ ANY check fails | Network broken → Phase 2B: mock API server + `adb reverse` |

### Phase 2A: IF network works — Fix the app bug

- The problem is in the app, not the infrastructure
- Debug `restoreSession()` flow with logcat (fix the timed-out logcat capture step first)
- Possibly a race condition, a chapter state issue, or cached user state issue
- Should be a small, targeted fix once we know what's broken

### Phase 2B: IF network fails — Mock API server + `adb reverse`

The industry-standard approach (used by Shopify, Microsoft, Expensify, Detox community):

1. **Create `scripts/e2e-mock-server.ts`** — lightweight Bun + Hono server (~200 lines):
   - `POST /auth/login` → returns deterministic test tokens
   - `GET /auth/session` → returns test user profile
   - `GET /bookmarks`, `POST /bookmarks`, `DELETE /bookmarks/:id` → in-memory CRUD
   - Same for `/highlights` and `/notes`
   - Logs all requests (visible in CI output)

2. **Update `.github/scripts/run-phone-tests.sh`**:
   ```bash
   # Start mock server on host
   bun scripts/e2e-mock-server.ts &
   MOCK_PID=$!
   # Expose host localhost to emulator
   adb reverse tcp:4000 tcp:4000
   # Run tests
   maestro test ...
   # Cleanup
   kill $MOCK_PID
   ```

3. **Override API URL in e2e-test build**:
   - Option A (cleaner): New EAS build profile `e2e-test-mock` with `EXPO_PUBLIC_API_URL=http://localhost:4000`
   - Option B (faster): Runtime switch in `src/api/generated/client.gen.ts` when `APP_ENV === 'e2e-test'`

### Phase 3: Simplify to MVP (1 hour)

- Keep only ONE auth test: `auth-login-flow.yaml` (verifies menu shows "logout")
- Temporarily disable the CRUD tests by renaming to `.yaml.disabled`
- Get ONE passing auth test before expanding scope

### Phase 4: Expand Incrementally

- Re-enable CRUD tests one at a time
- Each test gets its own mock data fixture
- Target: all auth tests green, reliable, <10 min total runtime

---

## How Other Teams Solve This

| Team / Tool | Approach |
|---|---|
| **Shopify, Airbnb** | Dedicated test/staging API accessible from CI |
| **Microsoft, Expensify** | `adb reverse` + mock API server on host |
| **Detox community** | Mock API server on host with port forwarding |
| **Maestro official docs** | Real test accounts against accessible test env |
| **React Native MSW** | Only works for unit tests, NOT E2E on device |

---

## Key Files

- `.maestro/shared/setup-authenticated.yaml` — Cold launch + wait for chapter selector
- `.maestro/auth/auth-login-flow.yaml` — Verify authenticated state via menu
- `.maestro/bookmarks/bookmark-authenticated-flow.yaml` — Full CRUD test
- `.maestro/notes/notes-authenticated-flow.yaml` — Full CRUD test
- `.maestro/highlights/highlights-authenticated-flow.yaml` — Full CRUD test
- `.github/scripts/run-phone-tests.sh` — CI runner with token seeding logic
- `.github/scripts/seed-auth-tokens.sh` — Fetches tokens from API on host, writes to emulator AsyncStorage
- `.github/workflows/maestro-e2e.yml` — GitHub Actions workflow
- `contexts/AuthContext.tsx` — `restoreSession()` with e2e-test fallback to cached user
- `components/ui/TextInput.tsx` — `secureTextEntry` disabled in e2e-test builds

## Things We've Already Tried (Don't Repeat)

- ❌ Toggle password visibility before `inputText` — Maestro bug #1061 affects the hidden input regardless
- ❌ Deep link auth bypass (`versemate://e2e-auth`) — custom schemes don't work in release APK
- ❌ Host-side API call + deep link — same deep link issue
- ❌ Build-time `EXPO_PUBLIC_E2E_AUTO_LOGIN_*` credentials — Metro inlines env vars, worked but brittle
- ✅ `adb sqlite3` token seeding — works but app still hits API after launch
- ✅ Cached user fallback on any error in e2e-test builds — works but chapter loader still broken
