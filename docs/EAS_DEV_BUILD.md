# EAS / dev-build flow (v0)

Operational reference for how VerseMate Mobile is built and iterated on for v0.
Decision background: [VER-17](https://github.com/verse-mate/verse-mate-meta) /
VER-20 — use EAS Build free tier + Expo Go, no local iOS sim / Android emulator
provisioning.

## Account

- Expo organization (`owner` in `app.config.js`): **versemate**
- EAS project id (`extra.eas.projectId`): `3178e762-1329-4504-9541-0f6a489a760b`
- Tier: **free**. Paid tier is not requested. Re-open the cost question only if
  free-tier concurrency / build minutes become a real bottleneck.

## Day-to-day iteration: Expo Go

For JS-only changes (most product work), use Expo Go on a real device — no
build needed.

```bash
bun start            # start the Metro dev server
# scan the QR code with Expo Go on iOS/Android
```

When to stay in Expo Go:

- UI / screen / hook / route changes
- API integration changes (no new native SDKs)
- Theme / locale / copy

## Native module changes: custom dev client via EAS

When you add or upgrade a native module (anything that touches `ios/` /
`android/` projects, new `expo-*` modules with native code, new permissions,
etc.) Expo Go can't load it. Build a custom dev client on EAS:

```bash
# install latest eas-cli on demand (no devDependency required)
npx --yes eas-cli@latest build --profile development --platform ios
npx --yes eas-cli@latest build --profile development --platform android
```

The `development` profile is already defined in `eas.json` with
`developmentClient: true` and `distribution: internal`. After the build
finishes, install the resulting `.ipa` / `.apk` on a real device (or
TestFlight internal group) and keep using `bun start` for JS reloads against
that dev client.

Other useful profiles already wired in `eas.json`:

- `e2e-test` — APK + iOS build for Maestro E2E.
- `preview` — store-distribution preview channel (autoIncrement).
- `production` — store-distribution production channel.

## Authentication

`eas-cli` needs to be authenticated to the `versemate` account.

Interactive (human laptop): `npx eas-cli login`. Browser flow.

Non-interactive (engineering agent sandbox, CI): set `EXPO_TOKEN` to a
personal access token generated at https://expo.dev/settings/access-tokens
under the versemate account. With that env var present, `eas` commands run
without an interactive login.

Verify with:

```bash
EXPO_TOKEN=... npx --yes eas-cli@latest whoami
# expected: versemate
```

### Current sandbox status (2026-05-15)

`npx eas-cli whoami` from the engineering agent sandbox currently returns
`Not logged in`. EAS credentials have not been provisioned into the agent
environment yet. Provisioning an `EXPO_TOKEN` for the agent is a CEO action
(same pattern as the `verse-mate-agent` GitHub PAT). Until that token is
present, mobile-side EAS builds must be triggered from a developer laptop
that has run `eas login`.

This is **not blocking v0 product work**: Expo Go covers JS iteration, and
the existing native binaries on the App Store / Play Store cover any
"need a real native build" scenario for the moment.

## Anti-checklist (what we are *not* doing for v0)

- No local iOS Simulator / Android Emulator setup in the agent sandbox.
- No paid EAS subscription.
- No EAS Submit automation in CI yet — store submissions stay manual.
- No EAS Update channel rollout policy beyond the channels already declared
  in `eas.json`.
