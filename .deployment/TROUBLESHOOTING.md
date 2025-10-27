# Troubleshooting Guide

This guide covers common issues encountered during builds, submissions, and deployments of VerseMate Mobile.

---

## Table of Contents

- [Build Issues](#build-issues)
- [Submission Issues](#submission-issues)
- [Credential Issues](#credential-issues)
- [GitHub Actions Issues](#github-actions-issues)
- [Environment Issues](#environment-issues)
- [App Store Review Issues](#app-store-review-issues)
- [General Debugging](#general-debugging)

---

## Build Issues

### Build Fails Immediately After Starting

**Symptoms:**
- Build fails within first few minutes
- Error in "Validate configuration" or "Setup" phase

**Common Causes & Solutions:**

1. **Invalid eas.json syntax**
   ```bash
   # Validate JSON syntax
   cat eas.json | jq .

   # If error, fix JSON formatting
   # Common issues: missing commas, trailing commas, wrong quotes
   ```

2. **Missing required fields in eas.json**
   ```bash
   # Check that all profiles have required fields
   # Required: distribution, ios/android configuration

   # Example fix:
   {
     "build": {
       "preview": {
         "distribution": "store",  // Required
         "ios": { ... }            // Required
       }
     }
   }
   ```

3. **Incompatible EAS CLI version**
   ```bash
   # Check current version
   eas --version

   # Update to latest
   npm install -g eas-cli@latest

   # Verify minimum version in eas.json
   "cli": {
     "version": ">= 14.0.0"
   }
   ```

### Build Fails During "Install dependencies" Phase

**Symptoms:**
- Error installing npm/yarn packages
- Dependency resolution conflicts

**Solutions:**

1. **Clear lock file and reinstall**
   ```bash
   # Locally test
   rm bun.lock
   bun install

   # If works, commit new lock file
   git add bun.lock
   git commit -m "fix: update dependencies lockfile"
   ```

2. **Check package.json for incompatibilities**
   ```bash
   # Verify all package versions are compatible
   # Check for missing peer dependencies
   bun install --verbose
   ```

3. **Use specific Node version**
   ```json
   // In eas.json
   {
     "build": {
       "preview": {
         "node": "20.0.0"  // Specify exact Node version
       }
     }
   }
   ```

### Build Fails During "Run gradlew" (Android)

**Symptoms:**
- Android build fails during Gradle phase
- Java/Kotlin compilation errors

**Solutions:**

1. **Gradle memory issues**
   ```json
   // In eas.json
   {
     "build": {
       "production": {
         "android": {
           "gradleCommand": ":app:bundleRelease",
           "withoutCredentials": false,
           "env": {
             "GRADLE_OPTS": "-Xmx4096m"
           }
         }
       }
     }
   }
   ```

2. **Check android/build.gradle versions**
   - Verify Android Gradle Plugin version matches Expo SDK
   - Check compileSdkVersion compatibility
   - Review dependency versions

3. **Clean Gradle cache (local testing)**
   ```bash
   cd android
   ./gradlew clean
   ./gradlew --stop
   cd ..
   ```

### Build Fails During "Compile iOS app" (iOS)

**Symptoms:**
- iOS build fails during Xcode compilation
- Swift/Objective-C errors

**Solutions:**

1. **Pod installation issues**
   ```bash
   # Local testing
   cd ios
   pod repo update
   pod install
   cd ..
   ```

2. **Check Podfile.lock compatibility**
   - Verify all pods compatible with iOS version
   - Check for conflicts with Expo SDK

3. **Xcode version issues**
   - EAS uses specific Xcode version
   - Check EAS build logs for Xcode version
   - May need to update dependencies for newer Xcode

### Build Fingerprint Mismatch

**Symptoms:**
- Warning about fingerprint changes
- Unexpected credential requests

**Cause:**
- Project configuration changed significantly
- Native dependencies added/removed
- Bundle identifier changed

**Solutions:**

1. **Review changes**
   ```bash
   # Check what changed
   git diff HEAD~1 app.json
   git diff HEAD~1 package.json
   ```

2. **Regenerate credentials if needed**
   ```bash
   eas credentials
   # Select platform → regenerate if necessary
   ```

3. **Accept fingerprint change**
   - If intentional, proceed with build
   - Fingerprint will update automatically

---

## Submission Issues

### "Invalid Provisioning Profile" Error

**Symptoms:**
```
Error: Cannot submit build to TestFlight
Build was created with internal distribution profile
```

**Cause:**
- Build profile uses `distribution: "internal"` instead of `"store"`

**Solution:**
```json
// In eas.json - FIX
{
  "build": {
    "preview": {
      "distribution": "store",  // NOT "internal"
      "ios": { ... }
    }
  }
}
```

**Why:**
- TestFlight requires App Store distribution profile
- Ad-hoc (internal) builds cannot be uploaded to TestFlight
- Must rebuild with correct distribution

### "Could Not Find Credentials" Error

**Symptoms:**
```
Error: Could not find App Store Connect API credentials
```

**Cause:**
- EAS credentials not configured
- Credentials expired or revoked

**Solution:**

1. **Configure credentials**
   ```bash
   eas credentials
   # Select iOS → App Store Connect API Key → Set up new key
   ```

2. **Verify credentials exist**
   ```bash
   eas credentials
   # Check that API Key is configured
   ```

3. **Test credentials**
   ```bash
   # Try building to verify credentials work
   eas build --platform ios --profile preview
   ```

See [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md) for detailed setup.

### "Invalid ascAppId" Error

**Symptoms:**
```
Error: Invalid ascAppId
App not found in App Store Connect
```

**Cause:**
- ascAppId in eas.json is wrong
- App not registered in App Store Connect
- Using wrong Apple Developer account

**Solution:**

1. **Verify ascAppId**
   - Log in to App Store Connect
   - Navigate to your app
   - Check URL: `appstoreconnect.apple.com/apps/{ascAppId}/`
   - Update eas.json with correct ID

2. **Update eas.json**
   ```json
   {
     "submit": {
       "preview": {
         "ios": {
           "ascAppId": "6754565256"  // Must match App Store Connect
         }
       }
     }
   }
   ```

### Submission Stuck in "Processing"

**Symptoms:**
- `eas submit` never completes
- No error but no success

**Solutions:**

1. **Check EAS dashboard**
   - Visit https://expo.dev/accounts/versemate/projects/verse-mate-mobile/submissions
   - Check actual submission status

2. **Wait longer**
   - Some submissions take 10-15 minutes
   - App Store Connect processing can be slow

3. **Check App Store Connect**
   - Log in to App Store Connect
   - Check if build appeared in TestFlight
   - May show as "Processing" there too

4. **Cancel and retry**
   ```bash
   # Cancel stuck submission (Ctrl+C)
   # Try again
   eas submit --platform ios --id <build-id>
   ```

### "Build Not Eligible for Submission"

**Symptoms:**
```
Error: Build is not eligible for submission
```

**Causes:**
- Build status is not "FINISHED"
- Build failed or was canceled
- Build expired (> 30 days old on free tier)

**Solutions:**

1. **Check build status**
   ```bash
   eas build:view <build-id>
   # Status must be "FINISHED"
   ```

2. **Create new build if needed**
   ```bash
   eas build --platform ios --profile preview
   ```

---

## Credential Issues

### App Store Connect API Key Invalid

**Symptoms:**
```
Error: Invalid App Store Connect API Key
Authentication failed
```

**Causes:**
- API Key revoked in App Store Connect
- Wrong Key ID or Issuer ID
- API Key expired (if set expiration)
- Wrong .p8 file contents

**Solutions:**

1. **Verify API Key exists**
   - Log in to App Store Connect
   - Users and Access → Integrations → App Store Connect API
   - Check that your key exists and is active

2. **Reconfigure EAS credentials**
   ```bash
   eas credentials
   # iOS → App Store Connect API Key → Set up new key
   # Enter correct Key ID, Issuer ID, and .p8 file path
   ```

3. **Create new API Key (if revoked)**
   - App Store Connect → Create new key
   - Download .p8 file (only available once!)
   - Update EAS credentials with new key

### Distribution Certificate Expired

**Symptoms:**
```
Error: Distribution certificate expired
```

**Cause:**
- iOS distribution certificates expire after 1 year

**Solution:**

1. **Generate new certificate via EAS**
   ```bash
   eas credentials
   # iOS → Distribution Certificate → Remove old → Create new
   ```

2. **EAS handles it automatically**
   - For managed credentials, EAS will auto-generate new cert
   - May need to rebuild app with new certificate

### Provisioning Profile Mismatch

**Symptoms:**
```
Error: Provisioning profile does not match bundle identifier
```

**Cause:**
- Bundle ID changed but provisioning profile wasn't updated
- Using wrong provisioning profile

**Solution:**

1. **Regenerate provisioning profile**
   ```bash
   eas credentials
   # iOS → Provisioning Profile → Remove → Create new
   ```

2. **Verify bundle ID**
   ```bash
   # Check app.json
   grep bundleIdentifier app.json
   # Should be: "org.versemate.mobile"
   ```

---

## GitHub Actions Issues

### "EXPO_TOKEN is required" Error

**Symptoms:**
```
Error: EXPO_TOKEN environment variable is required
```

**Cause:**
- EXPO_TOKEN secret not configured in GitHub

**Solution:**

1. **Add GitHub Secret**
   - Repository → Settings → Secrets and variables → Actions
   - New repository secret → Name: `EXPO_TOKEN`, Value: your token

2. **Get EXPO_TOKEN**
   ```bash
   # Login to EAS
   eas login

   # Get token (shown after login or):
   eas whoami
   # Token format: username + auth token
   ```

### Workflow Fails on "Run type checking"

**Symptoms:**
- TypeScript errors in GitHub Actions
- Passes locally but fails in CI

**Solutions:**

1. **Ensure types are committed**
   ```bash
   # Check .gitignore doesn't exclude types
   # Commit any missing type definitions
   ```

2. **Run type check locally**
   ```bash
   bun tsc --noEmit
   # Fix any errors that appear
   ```

3. **Check tsconfig.json**
   - Ensure configuration is correct
   - Verify all paths are correct for CI environment

### Workflow Fails on "Run tests"

**Symptoms:**
- Tests pass locally but fail in GitHub Actions

**Solutions:**

1. **Check Node version**
   ```yaml
   # In workflow file, ensure correct Node version
   - name: Setup Node.js
     uses: actions/setup-node@v4
     with:
       node-version: '20'  # Must match local version
   ```

2. **Verify npm (not bun) is used for tests**
   ```yaml
   # Correct (per CLAUDE.md):
   - name: Run tests
     run: npm test

   # Wrong:
   - name: Run tests
     run: bun test  # Don't use bun for tests
   ```

3. **Check test setup files are committed**
   ```bash
   git ls-files | grep -E "test-setup|jest-env-setup"
   ```

### Build Script Not Found

**Symptoms:**
```
Error: bash: .deployment/build-preview.sh: No such file or directory
```

**Causes:**
- Script not checked into repository
- Script not executable
- Wrong path in workflow

**Solutions:**

1. **Verify script exists**
   ```bash
   ls -la .deployment/*.sh
   ```

2. **Check script is executable**
   ```bash
   chmod +x .deployment/*.sh
   git add .deployment/*.sh
   git commit -m "fix: make scripts executable"
   ```

3. **Check workflow path**
   ```yaml
   # Correct:
   run: bash .deployment/build-preview.sh

   # Wrong:
   run: bash deployment/build-preview.sh  # Missing dot
   ```

### Build Succeeds but Submission Step Skipped

**Symptoms:**
- Build completes successfully
- Submission step doesn't run
- No errors shown

**Cause:**
- Conditional logic in workflow not met

**Solution:**

Check conditional in workflow:
```yaml
# This step only runs if platform is 'ios' or 'all'
- name: Submit to TestFlight
  if: ${{ github.event.inputs.platform == 'all' || github.event.inputs.platform == 'ios' }}
  run: ...
```

Ensure you selected correct platform when triggering workflow.

---

## Environment Issues

### Wrong Environment Variables in Build

**Symptoms:**
- App uses preview settings in production build
- Or vice versa

**Cause:**
- ENV variables not configured correctly in eas.json

**Solution:**

1. **Check eas.json env section**
   ```json
   {
     "build": {
       "preview": {
         "env": {
           "APP_ENV": "preview"  // Must be set
         }
       },
       "production": {
         "env": {
           "APP_ENV": "production"  // Must be set
         }
       }
     }
   }
   ```

2. **Verify in app code**
   ```typescript
   // In app code
   console.log('APP_ENV:', process.env.APP_ENV);
   // Should log "preview" or "production"
   ```

3. **Test different environments**
   - Build with each profile
   - Verify environment is correct in each build

### API Endpoint Configuration Issues

**Symptoms:**
- App connects to wrong backend
- 404 or connection errors

**Solution:**

1. **Set environment-specific endpoints**
   ```json
   // In eas.json
   {
     "build": {
       "preview": {
         "env": {
           "API_URL": "https://api-staging.versemate.org"
         }
       },
       "production": {
         "env": {
           "API_URL": "https://api.versemate.org"
         }
       }
     }
   }
   ```

2. **Access in app**
   ```typescript
   import Constants from 'expo-constants';
   const apiUrl = Constants.expoConfig?.extra?.apiUrl;
   ```

---

## App Store Review Issues

### App Rejected for Crashes

**Cause:**
- App crashes on reviewer's device
- Specific iOS version issue
- Edge case not tested

**Solutions:**

1. **Get crash logs from App Store Connect**
   - App Store Connect → TestFlight → Crashes
   - Download crash logs
   - Symbolicate and fix

2. **Test on multiple devices/iOS versions**
   - Test on oldest supported iOS version
   - Test on newest iOS version
   - Test on different device types (iPhone, iPad)

3. **Fix and resubmit**
   - Fix crash
   - Increment version (e.g., 1.0.0 → 1.0.1)
   - Create new build
   - Resubmit with notes about fix

### App Rejected for Broken Links

**Cause:**
- Privacy policy URL not accessible
- Support URL returns 404
- Links in app don't work

**Solutions:**

1. **Verify all URLs**
   ```bash
   # Test each URL in browser
   curl -I https://versemate.org/privacy
   curl -I https://versemate.org/support
   ```

2. **Ensure no authentication required**
   - Privacy policy must be public
   - Support pages must be accessible without login

3. **Test deep links**
   ```bash
   # Test app deep links
   xcrun simctl openurl booted versemate://bible/genesis/1/1
   ```

### App Rejected for Guideline Violation

**Cause:**
- Content policy violation
- Design guideline violation
- Functionality issue

**Solutions:**

1. **Read rejection carefully**
   - App Store Connect → Resolution Center
   - Review team provides specific guideline number
   - Read that specific guideline

2. **Address the issue**
   - Make necessary code changes
   - Update metadata if needed
   - Provide clarification if misunderstanding

3. **Respond via Resolution Center**
   - Explain changes made
   - Or provide clarification
   - Be polite and professional

4. **Resubmit**
   - If code changes: New build, new version
   - If metadata only: Update and resubmit

### App Rejected for Missing Information

**Cause:**
- Incomplete metadata
- Missing screenshots
- No privacy policy

**Solutions:**

1. **Complete all required fields**
   - Check APP_STORE_METADATA.md for full checklist
   - Upload all required screenshots
   - Add privacy policy URL

2. **Verify with checklist**
   ```markdown
   - [ ] App name
   - [ ] Description
   - [ ] Keywords
   - [ ] Screenshots (all required sizes)
   - [ ] Privacy policy URL
   - [ ] Support URL
   - [ ] Age rating
   - [ ] Export compliance
   ```

---

## General Debugging

### Check Build Logs

**EAS Dashboard:**
1. Visit https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds
2. Click on specific build
3. View full logs
4. Download logs for detailed analysis

**Command Line:**
```bash
# View build
eas build:view <build-id>

# List recent builds
eas build:list --platform ios --limit 10

# View specific build logs (if completed)
# Logs are in EAS dashboard
```

### Check Submission Logs

**EAS Dashboard:**
1. Visit https://expo.dev/accounts/versemate/projects/verse-mate-mobile/submissions
2. Click on specific submission
3. View submission details and errors

**Command Line:**
```bash
# List submissions
eas submit:list --platform ios --limit 10

# View specific submission
# Use EAS dashboard for details
```

### Enable Verbose Logging

```bash
# For builds
eas build --platform ios --profile preview --verbose

# For submissions
eas submit --platform ios --latest --verbose
```

### Common Log Errors to Look For

**Build Logs:**
- `Error: Command failed:` - Check command that failed
- `ENOENT:` - Missing file or directory
- `Permission denied` - File permissions issue
- `Timeout` - Network or resource issue

**Submission Logs:**
- `Authentication failed` - Credential issue
- `Invalid binary` - Build not compatible
- `Missing required field` - Metadata incomplete

### Test Locally First

Before triggering cloud build:

```bash
# Type check
bun tsc --noEmit

# Lint
bun run lint

# Test
npm test

# Format check
bun run format

# Try local build (if possible)
eas build --platform ios --profile development --local
```

### Reset and Start Fresh

If nothing works:

```bash
# Clean local environment
rm -rf node_modules bun.lock
bun install

# Clear EAS cache (create new build)
eas build --platform ios --profile preview --clear-cache

# Regenerate credentials (if needed)
eas credentials
# Remove all credentials → Reconfigure from scratch
```

---

## Getting Help

### Before Asking for Help

Collect this information:

1. **Build/Submission ID**
   ```bash
   # From output or EAS dashboard
   Build ID: abc123-def456-ghi789
   ```

2. **Error Message**
   - Full error from logs
   - Screenshot if applicable

3. **What You've Tried**
   - List troubleshooting steps already attempted
   - Any changes made

4. **Environment Details**
   ```bash
   eas --version
   node --version
   bun --version
   cat eas.json
   ```

### Where to Get Help

1. **Check Documentation First**
   - This troubleshooting guide
   - [README.md](./README.md)
   - [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md)
   - [PRODUCTION_SUBMISSION.md](./PRODUCTION_SUBMISSION.md)

2. **EAS Documentation**
   - https://docs.expo.dev/build/introduction/
   - https://docs.expo.dev/submit/introduction/
   - https://docs.expo.dev/build-reference/troubleshooting/

3. **Expo Forums**
   - https://forums.expo.dev/
   - Search for similar issues first

4. **GitHub Issues**
   - Create issue in repository
   - Include all information from "Before Asking for Help"

5. **Team Support**
   - Contact team lead for urgent issues
   - Share EAS dashboard build link

---

## Preventing Future Issues

### Best Practices

1. **Test Locally Before Cloud Build**
   - Run type check, lint, tests
   - Verify builds locally if possible
   - Saves build quota and time

2. **Use Version Control**
   - Commit working configurations
   - Tag releases properly
   - Document changes in commits

3. **Monitor Regularly**
   - Check EAS build quota monthly
   - Review credential expiration dates
   - Keep dependencies updated

4. **Document Issues**
   - When you encounter an issue, document the solution
   - Update this troubleshooting guide
   - Share knowledge with team

5. **Incremental Changes**
   - Don't change multiple things at once
   - Test each change separately
   - Easier to identify what broke

### Maintenance Schedule

**Monthly:**
- [ ] Check build quota usage
- [ ] Review EAS dashboard for issues
- [ ] Update dependencies if needed

**Quarterly:**
- [ ] Review and update credentials
- [ ] Test full deployment pipeline
- [ ] Update documentation

**Yearly:**
- [ ] Rotate App Store Connect API Key
- [ ] Review and update app store metadata
- [ ] Audit all processes

---

## Quick Reference

### Diagnostic Commands

```bash
# Check EAS auth
eas whoami

# Check credentials
eas credentials

# List recent builds
eas build:list --limit 10

# View specific build
eas build:view <build-id>

# List submissions
eas submit:list --limit 10

# Check project configuration
eas config

# Validate eas.json
cat eas.json | jq .
```

### Emergency Rollback

```bash
# iOS: Remove from sale
# App Store Connect → Remove from Sale

# Android: Halt rollout
# Play Console → Production → Pause/Halt rollout

# Submit fix
# 1. Fix issue
# 2. Increment version
# 3. Build and submit new version
```

### Support Contacts

- **EAS Support**: https://expo.dev/support
- **App Store Connect**: https://developer.apple.com/contact/
- **Google Play Console**: https://support.google.com/googleplay/android-developer/
- **Team Lead**: [Contact information]
