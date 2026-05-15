# EAS / dev-build flow — v0 notes

Thin pointer doc that records the v0 mobile dev-build decision from VER-17 /
VER-20 and indexes the existing automation. **Canonical deployment doc is
[`.deployment/README.md`](../.deployment/README.md)** — read that first for
build profiles, scripts, credentials, App Store submission, and
troubleshooting. This file only adds what the canonical doc doesn't already
cover: the v0 decision context and how the engineering agent fits in.

## v0 decision (from VER-17 triage)

- **Stack**: EAS Build (free tier) + Expo Go.
- **Out of scope**: local iOS Simulator / Android Emulator provisioning in
  the agent sandbox, paid EAS tier.
- **Iteration loop**:
  - JS-only changes → `bun start` + Expo Go on a real device.
  - Native module changes → custom dev client via
    `eas build --profile development` (profile already defined in `eas.json`).
- **Account**: `owner: versemate` in `app.config.js`, EAS projectId
  `3178e762-1329-4504-9541-0f6a489a760b`.
- Re-open the paid-tier question only if free-tier concurrency / build
  minutes actually bottleneck us.

## Existing gitflow automations (already in place)

These are wired up today — the agent does not need to recreate any of this:

- **`expo-preview-build.yml`** — triggered by `workflow_dispatch` *or* by a
  push whose commit-title contains `[preview:ios]`, `[preview:android]`, or
  `[preview:all]`. Runs typecheck + lint + tests, runs
  `.deployment/build-preview.sh`, then auto-submits via
  `.deployment/submit-testflight.sh` (iOS) and
  `.deployment/submit-play-store.sh` (Android). Optional `version_bump`
  input drives `scripts/bump-version.js`.
- **`expo-production-build.yml`** — `workflow_dispatch` only, takes a
  `version_tag` input, runs `.deployment/build-production.sh`. No
  auto-submission to stores — submission stays manual per
  `.deployment/PRODUCTION_SUBMISSION.md`.
- **`maestro-e2e.yml`** — downloads the latest `e2e-test` APK from EAS,
  pushes a JS-only OTA update via `eas update --branch e2e-test`, then runs
  Maestro on Android emulators (Pixel 6 + Nexus 10, API 34). `force-rebuild`
  input only when native code changes.
- **`ci.yml` / `test.yml`** — typecheck, lint, Jest, Chromatic on PRs.
- **`deploy-web.yml`** — Expo web bundle deploy (out of scope here, see
  VER-19 / VER-18 history).

CI auth: `EXPO_TOKEN` is already configured as a GitHub Actions secret. All
EAS workflows above run non-interactively against the `versemate` account
through that secret.

## How the engineering agent uses this

For day-to-day Paperclip work, the agent does **not** need a local
`EXPO_TOKEN`:

- JS/native code changes ship as normal PRs and go through the existing
  `ci.yml` / `test.yml` checks.
- A preview build to TestFlight / Play Store is triggered by adding
  `[preview:ios|android|all]` to a commit-title on the working branch (or
  by `gh workflow run "Expo Preview Build"`), no agent-side credentials
  needed.
- Maestro E2E runs via `gh workflow run "Maestro E2E Tests"`; the workflow
  pulls the existing `e2e-test` APK and OTA-updates it, again using the
  CI `EXPO_TOKEN`.

The only times an agent-local `EXPO_TOKEN` would help are ad-hoc commands
like `eas build:list`, `eas update`, or `eas credentials` from inside the
sandbox. None of those are blocking v0.

### Sandbox EAS auth status (2026-05-15)

`npx --yes eas-cli@latest whoami` from the agent sandbox returns
`Not logged in`. Documenting this as the decision per VER-20's acceptance
criteria — provisioning an `EXPO_TOKEN` into the agent sandbox is tracked
as low-priority follow-up [VER-23](https://github.com/verse-mate/verse-mate-meta)
and is **not blocking** because CI already holds the token. Re-prioritize
VER-23 if/when an agent run needs ad-hoc `eas` invocations the gitflow
doesn't cover.

## Anti-checklist (what we are *not* changing for v0)

- No local iOS Simulator / Android Emulator setup in the agent sandbox.
- No paid EAS subscription.
- No new build profiles — `development`, `e2e-test`, `preview`, `production`
  already cover the spectrum.
- No new CI workflows — existing ones cover preview, production, E2E,
  unit/integration, and web deploy.
