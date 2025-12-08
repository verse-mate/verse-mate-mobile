# VerseMate Mobile Deployment Documentation

This directory contains comprehensive documentation and scripts for building and deploying VerseMate Mobile to iOS App Store and Google Play Store using Expo Application Services (EAS).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Deployment Scripts](#deployment-scripts)
- [Build Profiles](#build-profiles)
- [Workflows](#workflows)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

1. **EAS CLI Installed**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Environment Variables**
   ```bash
   export EXPO_TOKEN="your-expo-token"
   ```

3. **Credentials Configured** (one-time setup)
   ```bash
   eas credentials
   ```
   See [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md) for detailed instructions.

### Trigger a Build

**Preview Build (Local Testing):**
```bash
# Build iOS preview (default)
bash .deployment/build-preview.sh

# Build Android preview
bash .deployment/build-preview.sh android

# Submit iOS to TestFlight
bash .deployment/submit-testflight.sh <build-id>
```

**Production Build (App Store Release):**
```bash
# Via GitHub Actions (recommended)
# 1. Create version tag: git tag v1.0.0 && git push origin v1.0.0
# 2. Go to GitHub Actions → "Expo Production Build" → Run workflow

# Via Local Script
bash .deployment/build-production.sh ios
bash .deployment/build-production.sh android

# Download for testing
bash .deployment/download-build.sh <build-id>
```

---

## Deployment Scripts

All scripts are located in `.deployment/` directory and are used by both CI/CD and local development.

### `build-preview.sh`

Triggers a preview build on EAS for iOS or Android.

**Purpose**: Internal testing builds (iOS auto-submits to TestFlight, Android available for download)

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"

# iOS (default)
bash .deployment/build-preview.sh

# Android
bash .deployment/build-preview.sh android
```

**What it does:**
- Triggers EAS build with `preview` profile
- Uses `store` distribution for TestFlight compatibility (iOS)
- Captures build ID and saves to `build_id_preview_{platform}.txt`
- Outputs build ID and URL to stdout and `$GITHUB_OUTPUT` (if in CI)

**Output:**
```
==========================================
Triggering ios Preview Build
==========================================
✅ ios Build ID: abc123-def456-ghi789
🔗 Build URL: https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/abc123-def456-ghi789
```

**Profile:** Uses `preview` profile from eas.json:
- Distribution: `store`
- Channel: `preview`
- Environment: `APP_ENV=preview`

### `build-production.sh`

Triggers a production build on EAS for iOS or Android.

**Purpose**: Production-ready builds for App Store / Play Store release

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"

# iOS
bash .deployment/build-production.sh ios

# Android
bash .deployment/build-production.sh android
```

**What it does:**
- Triggers EAS build with `production` profile
- Uses `store` distribution for App Store / Play Store
- Captures build ID and saves to `build_id_production_{platform}.txt`
- Outputs build ID and URL to stdout and `$GITHUB_OUTPUT` (if in CI)

**Profile:** Uses `production` profile from eas.json:
- Distribution: `store`
- Channel: `production`
- Environment: `APP_ENV=production`
- Android: Builds AAB (App Bundle) instead of APK

### `submit-testflight.sh`

Waits for a build to complete and submits it to TestFlight.

**Purpose**: Automated TestFlight submission for preview builds

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"
bash .deployment/submit-testflight.sh <build-id>
```

**What it does:**
1. Polls build status every 30 seconds (max 45 minutes)
2. Waits for build status to be `FINISHED`
3. Automatically submits to TestFlight using EAS credentials
4. Uses credentials from EAS credentials storage (no hardcoded values needed)

**Credentials:**
- Reads from EAS credentials storage automatically
- No need for environment variables or eas.json configuration
- Uses App Store Connect API Key configured via `eas credentials`

**Success Output:**
```
Checking build status for: abc123-def456-ghi789
Build status: FINISHED
Build is ready! Submitting to TestFlight...
Submission successful!
Submission ID: xyz789-uvw456-rst123
```

### `download-build.sh`

Downloads a completed build from EAS for local testing.

**Purpose**: Download production builds for manual testing before App Store submission

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"
bash .deployment/download-build.sh <build-id>
```

**What it does:**
1. Checks build status (must be `FINISHED`)
2. Retrieves artifact download URL
3. Downloads IPA (iOS) or AAB (Android) file
4. Saves as `verse-mate-mobile-{build-id}.{extension}`

**Output:**
```
Checking build status for: abc123-def456-ghi789
Platform: IOS
Status: FINISHED
Downloading build to: verse-mate-mobile-abc123de.ipa
Build downloaded successfully!
File: verse-mate-mobile-abc123de.ipa
Size: 45M

Next steps:
  1. Install on device via Xcode: Window > Devices and Simulators
  2. Or manually submit to App Store: eas submit --platform ios --id abc123-def456-ghi789
```

---

## Build Profiles

VerseMate Mobile uses three build profiles defined in `eas.json`:

### Development Profile

**Purpose**: Local development and debugging

**Characteristics:**
- Development client enabled
- iOS: Simulator builds
- Android: APK builds
- Internal distribution only
- Not for app store submission

**Usage:**
```bash
# Local builds (requires Fastlane for iOS, Android SDK for Android)
eas build --platform ios --profile development --local
eas build --platform android --profile development --local

# Cloud builds
eas build --platform ios --profile development
eas build --platform android --profile development
```

**When to use:**
- Testing on simulators/emulators
- Debugging with development tools
- Rapid iteration during development

### Preview Profile

**Purpose**: Internal testing on physical devices via TestFlight/Google Play

**Characteristics:**
- Store distribution (required for TestFlight)
- Release build configuration
- Automatic TestFlight submission
- Environment: `APP_ENV=preview`
- iOS: IPA for TestFlight
- Android: APK for easy installation

**Usage:**
```bash
# Via deployment scripts (recommended)
bash .deployment/build-preview.sh
bash .deployment/submit-testflight.sh <build-id>

# Via EAS CLI
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

**When to use:**
- Testing on physical devices
- QA and stakeholder testing
- Pre-release validation
- Testing with preview/staging backend (if configured)

**Workflow:**
1. Build triggered (via script or GitHub Actions)
2. Build completes (~6 minutes)
3. Automatically submitted to TestFlight (~2 minutes)
4. Available to testers within ~10 minutes total

### Production Profile

**Purpose**: App Store and Google Play production releases

**Characteristics:**
- Store distribution
- Release build configuration
- Manual submission required (no auto-submit)
- Environment: `APP_ENV=production`
- iOS: IPA for App Store
- Android: AAB (App Bundle) for Play Store
- Requires version tag

**Usage:**
```bash
# Via deployment script
bash .deployment/build-production.sh

# Via GitHub Actions (recommended)
# 1. Create tag: git tag v1.0.0 && git push origin v1.0.0
# 2. Trigger workflow: GitHub Actions → Expo Production Build → Run

# Manual submission after testing
eas submit --platform ios --latest
eas submit --platform android --latest
```

**When to use:**
- Official releases to app stores
- Production environment with production backend
- Publicly available to all users

**Workflow:**
1. Create version tag (e.g., v1.0.0)
2. Trigger production build (via GitHub Actions)
3. Build completes (~15-30 minutes)
4. Download and test build
5. Manually submit to App Store/Play Store
6. Monitor review status
7. Release when approved

---

## Workflows

### Complete Deployment Workflows

#### Preview Build → TestFlight (End-to-End)

**Time**: ~10 minutes total (6 min build + 2 min submit + 2 min processing)

**Local Execution:**
```bash
# 1. Ensure credentials configured (one-time)
eas credentials

# 2. Set environment
export EXPO_TOKEN="your-expo-token"

# 3. Trigger build
bash .deployment/build-preview.sh
# Output: Build ID: abc123-def456-ghi789

# 4. Submit to TestFlight (waits for build to finish)
bash .deployment/submit-testflight.sh abc123-def456-ghi789

# 5. Check TestFlight
# Build appears in App Store Connect → TestFlight within minutes
# URL: https://appstoreconnect.apple.com/apps/6754565256/testflight/ios
```

**GitHub Actions:**
1. Navigate to repository → Actions
2. Select "Expo Preview Build" workflow
3. Click "Run workflow"
4. Select platform: `ios` (or `all`)
5. Click "Run workflow" button
6. Monitor progress in Actions tab
7. Build automatically submits to TestFlight
8. Check TestFlight for new build

#### Production Build → App Store (Manual)

**Time**: ~2-4 days (30 min build + testing + 1-3 days review)

**Step 1: Prepare Release**
```bash
# Update version in app.json
# version: "1.0.0"

# Commit and push
git add app.json
git commit -m "chore: bump version to 1.0.0"
git push origin main
```

**Step 2: Create Tag**
```bash
git tag -a v1.0.0 -m "Version 1.0.0 - Initial Release"
git push origin v1.0.0
```

**Step 3: Trigger Build**
- GitHub Actions → "Expo Production Build" → Run workflow
- Platform: `ios`
- Version tag: `v1.0.0`
- Wait ~30 minutes for build

**Step 4: Test Build**
```bash
# Download build
export EXPO_TOKEN="your-expo-token"
bash .deployment/download-build.sh <build-id>

# Install via Xcode
# Window → Devices and Simulators → select device → drag .ipa file

# Or test via TestFlight first
eas submit --platform ios --id <build-id>
```

**Step 5: Submit to App Store**
```bash
# Via EAS CLI
eas submit --platform ios --latest

# Or via App Store Connect
# 1. Log in to appstoreconnect.apple.com
# 2. Select VerseMate → App Store tab
# 3. Create new version → Select build
# 4. Complete metadata → Submit for Review
```

**Step 6: Monitor & Release**
- Check App Store Connect daily
- Respond to review feedback within 24 hours
- Release when approved (manual or automatic)

See [PRODUCTION_SUBMISSION.md](./PRODUCTION_SUBMISSION.md) for complete details.

---

## Configuration

### EAS Credentials Storage

VerseMate Mobile uses EAS credentials storage for secure credential management.

**What's Stored:**
- App Store Connect API Key (Key ID, Issuer ID, .p8 file)
- iOS Distribution Certificate
- iOS Provisioning Profiles
- (Future: Google Play Service Account JSON)

**Benefits:**
- No credentials in repository
- No hardcoded values in eas.json
- Automatic credential usage for all builds
- Team-friendly - shared across project
- Secure - encrypted on EAS servers

**Setup:**
```bash
# One-time setup
eas credentials

# Follow interactive prompts:
# 1. Select iOS
# 2. Select "App Store Connect API Key"
# 3. Enter Key ID, Issuer ID, .p8 file path
# 4. Credentials stored securely
```

**Verification:**
```bash
# View configured credentials
eas credentials

# Test with build
eas build --platform ios --profile preview
# Should work without any additional configuration
```

See [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md) for detailed setup guide.

### GitHub Secrets

Required secrets for GitHub Actions workflows:

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `EXPO_TOKEN` | EAS CLI authentication | `eas whoami` (after login) |

**iOS-specific secrets** (stored in EAS credentials, not GitHub):
- App Store Connect API Key managed via `eas credentials`
- No additional GitHub secrets needed for iOS builds/submissions

**How to Add Secrets:**
1. Go to repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value
4. Secrets are encrypted and accessible only to workflows

### Build Configuration (eas.json)

**Key Settings:**

```json
{
  "cli": {
    "version": ">= 14.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "store",  // Required for TestFlight
      "channel": "preview",
      "env": {
        "APP_ENV": "preview"  // Accessible in app via process.env
      }
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "android": {
        "buildType": "app-bundle"  // AAB for Play Store
      }
    }
  },
  "submit": {
    "preview": {
      "ios": {
        "ascAppId": "6754565256"  // App Store Connect App ID
      }
    }
  }
}
```

**Important Notes:**
- `distribution: "store"` is required for TestFlight (not "internal")
- `appVersionSource: "remote"` uses app.json version (managed manually)
- Credentials not needed in submit config (uses EAS storage)
- `ascAppId` is the App Store Connect App ID (numeric)

### App Configuration (app.json)

**Critical Settings:**

```json
{
  "expo": {
    "name": "verse-mate-mobile",
    "version": "0.1.0",  // Manually managed
    "ios": {
      "bundleIdentifier": "org.versemate.mobile",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false  // Export compliance
      }
    },
    "android": {
      "package": "org.versemate.mobile"
    }
  }
}
```

**Version Management:**
- Manual version bumping (no automation)
- Update version before creating production tag
- Version must match tag (e.g., version "1.0.0" → tag v1.0.0)

---

## Documentation

### Available Guides

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | This file - overview and workflows |
| [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md) | EAS credentials configuration guide |
| [APP_STORE_METADATA.md](./APP_STORE_METADATA.md) | App Store listing requirements and checklist |
| [PRODUCTION_SUBMISSION.md](./PRODUCTION_SUBMISSION.md) | Production submission procedures |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

### Quick Navigation

**First-Time Setup:**
1. Read [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md)
2. Configure EAS credentials
3. Test with preview build

**Before App Store Submission:**
1. Read [APP_STORE_METADATA.md](./APP_STORE_METADATA.md)
2. Prepare screenshots and metadata
3. Create privacy policy and support pages

**Submitting Production Build:**
1. Read [PRODUCTION_SUBMISSION.md](./PRODUCTION_SUBMISSION.md)
2. Follow iOS or Android submission workflow
3. Monitor review status

**When Things Go Wrong:**
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review build logs in EAS dashboard
3. Check GitHub Actions logs

---

## Troubleshooting

### Quick Diagnostics

**Build Fails Immediately:**
```bash
# Check credentials
eas credentials

# Verify eas.json syntax
cat eas.json | jq .

# Check EAS project
eas whoami
```

**"Invalid Provisioning Profile" Error:**
- Problem: Build used `distribution: "internal"` but TestFlight requires `"store"`
- Solution: Verify eas.json has `"distribution": "store"` for preview/production
- Reference: `.deployment/README.md` line 99

**"Could not find credentials" Error:**
- Problem: EAS credentials not configured
- Solution: Run `eas credentials` and configure App Store Connect API Key
- Guide: [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md)

**Build Succeeds but Submission Fails:**
```bash
# Check build details
eas build:view <build-id>

# Verify ascAppId in eas.json
grep -A 5 "submit" eas.json

# Test submission manually
eas submit --platform ios --id <build-id>
```

**GitHub Actions Workflow Fails:**
- Check EXPO_TOKEN secret is set
- Verify syntax in workflow YAML
- Check build logs for specific error
- Ensure all required secrets configured

For complete troubleshooting guide, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## Best Practices

### Build Management

**Development Builds:**
- Use for local debugging only
- Don't distribute to testers
- Keep on local machine or simulator

**Preview Builds:**
- Test every major feature/fix
- Distribute via TestFlight to internal testers
- Test on physical devices
- Verify functionality before production

**Production Builds:**
- Create from tagged releases only
- Test thoroughly before submission
- Download and validate locally first
- Never auto-submit to app stores
- Monitor closely after release

### Credential Security

**Do:**
- Store credentials in EAS credentials storage
- Use GitHub Secrets for CI/CD tokens
- Rotate credentials periodically (every 12 months)
- Limit access to production credentials

**Don't:**
- Commit credentials to repository
- Share EXPO_TOKEN publicly
- Hardcode credentials in scripts
- Store .p8 files in version control

### Version Control

**Tagging:**
```bash
# Good: Descriptive tag with message
git tag -a v1.0.0 -m "Version 1.0.0 - Feature description"

# Bad: No message
git tag v1.0.0
```

**Version Numbers:**
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Update app.json before tagging
- Keep version consistent across platforms
- Document changes in commit message or changelog

### Testing

**Before Preview Build:**
- [ ] All tests pass locally
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Core features work on simulator

**Before Production Build:**
- [ ] Preview build tested on physical devices
- [ ] All stakeholders approved
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Deep linking tested
- [ ] App Store metadata prepared

---

## Build Quota Management

### EAS Build Free Tier

**Limits:**
- Varies by plan (check https://expo.dev/pricing)
- Shared across all projects in account
- Resets monthly

**Current Strategy:**
- Manual triggers only (no automatic builds on push)
- Conserve quota by building only when needed
- Use local builds for rapid development

**Monitoring:**
```bash
# Check build usage
eas build:list --limit 30

# View account details
eas account:view
```

**When to Upgrade:**
- Approaching quota limit regularly
- Need faster build times
- Require higher concurrency
- Team growth requires more builds

**Paid Tier Benefits:**
- More builds per month
- Faster build queues
- Priority support
- Higher concurrency

### Build Optimization Tips

**Reduce Build Frequency:**
- Test locally before triggering cloud builds
- Batch changes instead of building for each commit
- Use development builds for debugging

**Use Appropriate Profiles:**
- Development: Local testing only
- Preview: Feature testing and QA
- Production: Releases only

**Monitor Build Times:**
- Typical: 15-30 minutes per platform
- Longer builds may indicate issues
- Check build logs for unnecessary steps

---

## Developer Onboarding

### New Developer Checklist

**Prerequisites:**
- [ ] GitHub access to repository
- [ ] Expo account (join VerseMate organization)
- [ ] Node.js 20+ installed
- [ ] Bun package manager installed

**Setup Steps (30 minutes):**

1. **Clone Repository**
   ```bash
   git clone https://github.com/verse-mate/verse-mate-mobile.git
   cd verse-mate-mobile
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   eas login
   ```

4. **Verify Setup**
   ```bash
   eas whoami
   # Should show: versemate
   ```

5. **Read Documentation**
   - [ ] This README
   - [ ] [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md)
   - [ ] Project [CLAUDE.md](../CLAUDE.md)

6. **Test Build (Optional)**
   ```bash
   export EXPO_TOKEN="get-from-team"
   bash .deployment/build-preview.sh
   ```

**Common First-Time Questions:**

Q: How do I trigger a build?
A: Use deployment scripts or GitHub Actions (see [Workflows](#workflows))

Q: Where are the credentials?
A: Stored in EAS credentials storage (run `eas credentials` to view)

Q: How do I submit to TestFlight?
A: `bash .deployment/submit-testflight.sh <build-id>`

Q: What if a build fails?
A: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) and build logs

---

## Support and Resources

### Internal Resources
- **Repository**: https://github.com/verse-mate/verse-mate-mobile
- **EAS Dashboard**: https://expo.dev/accounts/versemate/projects/verse-mate-mobile
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6754565256

### External Documentation
- **EAS Build**: https://docs.expo.dev/build/introduction/
- **EAS Submit**: https://docs.expo.dev/submit/introduction/
- **EAS Credentials**: https://docs.expo.dev/app-signing/managed-credentials/
- **Expo SDK**: https://docs.expo.dev/

### Support Channels
- **Technical Issues**: Create GitHub issue
- **Build Failures**: Check EAS dashboard logs
- **App Store Questions**: See Apple/Google documentation
- **Urgent Issues**: Contact team lead

---

## Changelog

### Recent Updates

**2025-12-08 - Android Support for Preview Builds**
- Updated `build-preview.sh` to support both iOS and Android (via platform argument)
- Updated `expo-preview-build.yml` workflow to use script for Android builds
- Android builds now capture build ID properly for tracking
- Added build summary step to preview workflow

**2025-10-27 - Production Build Scripts Added**
- Added `build-production.sh` for production builds
- Added `download-build.sh` for downloading builds
- Created comprehensive documentation suite
- Documented production submission workflows

**2025-10-27 - Initial Deployment Infrastructure**
- Created `build-preview.sh` script
- Created `submit-testflight.sh` script
- Configured EAS credentials storage
- Completed first successful TestFlight submission

---

## License

See main project LICENSE file for details.
