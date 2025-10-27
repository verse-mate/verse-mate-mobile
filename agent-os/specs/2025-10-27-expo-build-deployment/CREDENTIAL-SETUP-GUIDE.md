# EAS iOS Credential Setup Guide

## Overview

Before automated builds can run via scripts or GitHub Actions, iOS credentials must be configured in EAS. This is a one-time setup process that requires interactive authentication with your Apple Account.

## Prerequisites

Before starting, ensure you have:
- ✅ Apple Developer Program membership (verified in Task 5.1)
- ✅ App registered in App Store Connect (completed in Task 5.2)
- ✅ App Store Connect API Key created (completed in Task 7.1)
- ✅ Apple Account: chaves.augusto@gmail.com
- ✅ Apple Team ID: 8F77Q5NNB7
- ✅ Bundle Identifier: org.versemate.mobile

## Option 1: First Interactive Build (Recommended)

This approach sets up credentials as part of your first build.

### Step 1: Trigger Interactive Build

```bash
eas build --platform ios --profile preview
```

### Step 2: Answer Authentication Prompts

You will see prompts similar to:

**Prompt 1: Apple Account Login**
```
Do you want to log in to your Apple account?
> Yes
```

**Prompt 2: Enter Apple ID**
```
Apple ID:
> chaves.augusto@gmail.com
```

**Prompt 3: Enter Apple ID Password**
```
Password:
> [Enter your Apple Account password]
```

**Prompt 4: Two-Factor Authentication (if enabled)**
```
Enter the verification code sent to your device:
> [Enter 6-digit code]
```

### Step 3: Credential Generation

EAS will automatically:
1. Connect to App Store Connect via API
2. Generate a distribution certificate
3. Generate a provisioning profile
4. Store credentials securely on EAS servers
5. Start building your app

You'll see output like:
```
✔ Generated distribution certificate
✔ Generated provisioning profile
Building your app...
```

### Step 4: Wait for Build Completion

- **Expected time:** 15-30 minutes
- **Monitor progress:** Watch the terminal or EAS dashboard
- **Build URL:** https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds/

### Step 5: Verify Credentials

After build completes, verify credentials are stored:

```bash
eas credentials --platform ios
```

You should see:
- Distribution Certificate: Present
- Provisioning Profile: Present

## Option 2: Configure Credentials Before Building (Alternative)

This approach configures credentials separately from building.

### Step 1: Start Credential Configuration

```bash
eas credentials --platform ios
```

### Step 2: Navigate Credential Menu

**Select build profile:**
```
? Which build profile do you want to configure?
> preview
```

**Select action:**
```
? What do you want to do?
> Set up distribution certificate
```

### Step 3: Generate Certificate

**Choose generation method:**
```
? How would you like to generate your distribution certificate?
> Let EAS generate the certificate
```

**Authenticate with Apple:**
```
Apple ID: chaves.augusto@gmail.com
Password: [your password]
Two-factor code: [6-digit code]
```

### Step 4: Set Up Provisioning Profile

Return to the credentials menu and:
```
? What do you want to do?
> Set up provisioning profile
```

**Choose generation method:**
```
? How would you like to generate your provisioning profile?
> Let EAS generate the profile
```

### Step 5: Test Build

Now test that credentials work with non-interactive build:

```bash
.deployment/build-preview.sh
```

Should complete successfully and output build ID.

## What Gets Stored in EAS

After credential setup, EAS stores:

### Distribution Certificate
- **Type:** Apple Distribution Certificate
- **Purpose:** Signs iOS apps for App Store distribution
- **Expiration:** 1 year from creation
- **Renewal:** Automatic via EAS (or manual if needed)

### Provisioning Profile
- **Type:** App Store Distribution Profile
- **Purpose:** Authorizes app to run on devices
- **Bundle ID:** org.versemate.mobile
- **Expiration:** 1 year from creation
- **Renewal:** Automatic via EAS (or manual if needed)

### Push Notification Keys (if applicable)
- **Type:** APNs Key
- **Purpose:** Send push notifications
- **Status:** Not required for initial builds

## Security Considerations

### Where Credentials Are Stored
- **EAS Servers:** Credentials stored encrypted on Expo's secure servers
- **Not in Repository:** Credentials NEVER stored in your git repository
- **Team Access:** Accessible to all team members with project access
- **GitHub Secrets:** Separate from build credentials (used for submissions)

### Credential Validation
EAS validates credentials with Apple:
- Certificate is valid and not expired
- Provisioning profile matches bundle identifier
- Team ID matches your Apple Developer account
- Profile includes correct capabilities

## Troubleshooting

### Issue: "Apple ID or password is incorrect"

**Solution:**
- Verify you're using correct Apple ID: chaves.augusto@gmail.com
- Ensure password is up to date
- Check for any Apple Account security alerts
- Try logging into https://appleid.apple.com to verify account

### Issue: "Two-factor authentication code invalid"

**Solution:**
- Request new code from Apple
- Enter code immediately (expires after 60 seconds)
- Ensure code is from correct trusted device
- Check for any SMS/notification delays

### Issue: "Team not found or access denied"

**Solution:**
- Verify Apple Developer Program membership is active
- Confirm Team ID: 8F77Q5NNB7
- Ensure Apple Account has Admin or App Manager role
- Check App Store Connect user permissions

### Issue: "Bundle identifier mismatch"

**Solution:**
- Verify bundle ID in app.json: org.versemate.mobile
- Ensure bundle ID is registered in App Store Connect
- Check that bundle ID matches app registration from Task 5.2

### Issue: "Certificate generation failed"

**Solution:**
- Check if you have existing certificates in Apple Developer portal
- May need to revoke old certificates (limit of 2 distribution certificates)
- Use EAS credential reset: `eas credentials --reset`
- Contact EAS support if persistent issues

## After Credential Setup

### What Works Now

Once credentials are configured, you can:

✅ **Run automated builds:**
```bash
.deployment/build-preview.sh
```

✅ **Use GitHub Actions workflows:**
- Manual trigger preview builds
- Builds run non-interactively with stored credentials

✅ **Submit to TestFlight:**
```bash
.deployment/submit-testflight.sh <build-id>
```

✅ **Build from CI/CD:**
- GitHub Actions can build without manual intervention
- Credentials accessed securely from EAS

### Regular Maintenance

**Certificate Renewal:**
- Distribution certificates expire after 1 year
- EAS will notify you before expiration
- Renewal process is similar to initial setup
- Set calendar reminder for: **2026-10-27**

**Provisioning Profile Updates:**
- Profiles regenerated automatically when:
  - Certificate is renewed
  - App capabilities change
  - New devices added (for development profiles)

## Verification Checklist

After completing credential setup, verify:

- [ ] Distribution certificate exists in EAS
- [ ] Provisioning profile exists in EAS
- [ ] Non-interactive build succeeds: `.deployment/build-preview.sh`
- [ ] Build ID captured successfully
- [ ] Build appears in EAS dashboard
- [ ] Credentials validated by Apple

## Next Steps

After successful credential setup:

1. **Complete Task Group 12:**
   - Run `.deployment/build-preview.sh` to trigger build
   - Monitor build progress in EAS dashboard
   - Use `.deployment/submit-testflight.sh <build-id>` to submit
   - Test app installation from TestFlight

2. **Validate GitHub Actions:**
   - Push changes to GitHub
   - Manually trigger "Expo Preview Build" workflow
   - Verify build succeeds with stored credentials

3. **Test Production Profile:**
   - Credentials apply to all profiles (development, preview, production)
   - Production builds will use same certificate and profile

## Support Resources

- **EAS Credentials Documentation:** https://docs.expo.dev/app-signing/managed-credentials/
- **Apple Developer Portal:** https://developer.apple.com/account/
- **App Store Connect:** https://appstoreconnect.apple.com/
- **EAS Dashboard:** https://expo.dev/accounts/versemate/projects/verse-mate-mobile/
- **EAS Support:** https://expo.dev/support

## Summary

**Time Required:** 10-15 minutes for credential setup + 15-30 minutes for first build

**Frequency:** One-time setup (renewable annually)

**Difficulty:** Low (mostly automated by EAS)

**Prerequisites:** Apple Developer account and App Store Connect access

**Result:** Fully automated build and deployment pipeline

---

**Ready to proceed?** Choose Option 1 (recommended) and run:
```bash
eas build --platform ios --profile preview
```
