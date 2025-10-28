# Production Submission Guide

This guide documents the manual production submission process for VerseMate Mobile to the App Store (iOS) and Google Play Store (Android).

---

## Overview

Production builds are triggered via GitHub Actions but **require manual submission** to app stores. This ensures full control over what reaches end users and allows for final testing before public release.

**Process Flow:**
1. Create version tag (e.g., v1.0.0)
2. Trigger production build via GitHub Actions
3. Wait for build to complete (15-30 minutes)
4. Download and test production build
5. Manually submit to app store
6. Monitor review status
7. Release when approved

---

## Prerequisites

Before submitting production builds:

- [ ] All app store metadata completed (see APP_STORE_METADATA.md)
- [ ] Privacy policy published and accessible
- [ ] Support URL published and accessible
- [ ] Screenshots and graphics prepared
- [ ] App tested thoroughly on physical devices
- [ ] Version number updated in app.json
- [ ] Changelog/release notes prepared
- [ ] EXPO_TOKEN configured in GitHub Secrets
- [ ] All iOS credentials configured in EAS credentials storage

---

## iOS Production Submission

### Step 1: Create Version Tag

Production builds are triggered from git tags.

```bash
# Ensure you're on the main branch with latest changes
git checkout main
git pull origin main

# Update version in app.json (e.g., "version": "1.0.0")
# Commit the version change
git add app.json
git commit -m "chore: bump version to 1.0.0"
git push origin main

# Create and push version tag
git tag -a v1.0.0 -m "Version 1.0.0 - Initial production release

Release notes:
- Bible reading interface with page-based navigation
- AI-powered verse explanations
- Dark mode support
- Deep linking support
"

git push origin v1.0.0
```

### Step 2: Trigger Production Build via GitHub Actions

1. Navigate to GitHub repository: https://github.com/verse-mate/verse-mate-mobile
2. Go to **Actions** tab
3. Select **"Expo Production Build"** workflow from the left sidebar
4. Click **"Run workflow"** button (top right)
5. Fill in workflow inputs:
   - **Platform**: Select `ios` (or `all` for both platforms)
   - **Version tag**: Enter `v1.0.0` (must match the tag you created)
6. Click **"Run workflow"** button to confirm

### Step 3: Monitor Build Progress

**In GitHub Actions:**
- Watch the workflow run in the Actions tab
- All pre-build checks must pass (type check, lint, test)
- Build will be triggered on EAS

**In EAS Dashboard:**
- Navigate to https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds
- Find your iOS production build
- Build typically takes 15-30 minutes
- Monitor for any errors or warnings

**Command Line Alternative:**
```bash
# List recent builds
eas build:list --platform ios --limit 5

# Watch specific build
eas build:view <build-id>
```

### Step 4: Test Production Build

**Option A: Install via TestFlight (Recommended)**
```bash
# Submit build to TestFlight for internal testing
eas submit --platform ios --latest

# Or submit specific build
eas submit --platform ios --id <build-id>
```

Then:
1. Open TestFlight app on iOS device
2. Install the build
3. Test all core functionality
4. Verify environment variables (APP_ENV should be "production")
5. Test deep linking
6. Verify app icon and launch screen

**Option B: Download and Install via Xcode**
```bash
# Download build
bash .deployment/download-build.sh <build-id>

# Install via Xcode:
# 1. Open Xcode
# 2. Window > Devices and Simulators
# 3. Select your connected device
# 4. Drag and drop the .ipa file to install
```

### Step 5: Submit to App Store Connect

Once testing is complete and build is verified:

**Method 1: EAS CLI (Recommended)**
```bash
# Submit latest production build
eas submit --platform ios --latest

# Or submit specific build
eas submit --platform ios --id <build-id>
```

The submission will:
- Use credentials from EAS credentials storage
- Upload to App Store Connect
- Make build available for release

**Method 2: App Store Connect Web Interface**
1. Log in to https://appstoreconnect.apple.com
2. Select **"My Apps"**
3. Select **"VerseMate"**
4. Go to **"App Store"** tab (not TestFlight)
5. Click **"+"** to create a new version
6. Enter version number (must match app.json)
7. Select the build that was uploaded
8. Click **"Save"**

### Step 6: Complete Version Information

In App Store Connect, for the new version:

1. **What's New in This Version**
   - Maximum 4000 characters
   - Describe new features, improvements, and bug fixes
   - Use bullet points for readability
   - Example:
   ```
   Initial release of VerseMate - your AI-powered Bible study companion.

   FEATURES:
   • Read the complete Bible with intuitive page-based navigation
   • Get AI-powered explanations for any verse or passage
   • Beautiful dark mode for comfortable reading
   • Deep linking support for sharing specific verses
   • Swipe gestures for smooth navigation

   We're excited to help you explore the Bible in a new way!
   ```

2. **Promotional Text** (Optional)
   - Can be updated without new app review
   - Use for announcements or highlights

3. **Screenshots and App Preview**
   - Verify all screenshots are uploaded correctly
   - Check preview video if added

4. **App Information**
   - Verify all fields are complete
   - Check privacy policy URL
   - Check support URL

### Step 7: Submit for Review

1. **Review App Information**
   - Double-check all metadata
   - Verify pricing and availability
   - Check age rating

2. **Answer Submission Questions**

   **Export Compliance:**
   - Question: "Does your app use encryption?"
   - Answer: "No" (already configured in app.json with ITSAppUsesNonExemptEncryption: false)

   **Content Rights:**
   - Question: "Do you have the rights to use all content?"
   - Answer: "Yes"

   **Advertising Identifier (IDFA):**
   - Question: "Does this app use the Advertising Identifier (IDFA)?"
   - Answer: Usually "No" unless you use ad networks

3. **Add Review Notes** (Optional but Recommended)
   ```
   Review Notes:
   - This app provides Bible reading and AI-powered study features
   - No authentication required - app is fully functional without login
   - AI explanations are generated via [API provider name]
   - All Bible content is public domain (or specify license)
   - Deep linking example: versemate://bible/genesis/1/1
   ```

4. **Submit for Review**
   - Click **"Add for Review"** button
   - Review the summary page
   - Click **"Submit to App Review"** button

### Step 8: Monitor Review Status

**Review Timeline:**
- Typical: 24-48 hours
- Can be up to 5-7 days during peak times
- Can be expedited in emergency (use sparingly)

**Status Checks:**
1. **App Store Connect Dashboard**
   - Log in to https://appstoreconnect.apple.com
   - Select VerseMate
   - Check status: "Waiting for Review" → "In Review" → "Pending Developer Release" or "Ready for Sale"

2. **Email Notifications**
   - Apple sends email updates on status changes
   - Check for:
     - "Your app status is In Review"
     - "Your app status is Pending Developer Release" (approved)
     - "Your app status is Rejected" (requires action)

3. **Resolution Center**
   - Check for messages from App Review team
   - Respond quickly to any questions (usually within 24 hours)

### Step 9: Release to Production

**If Auto-Release Enabled:**
- App automatically goes live after approval
- No additional action needed

**If Manual Release Enabled (Recommended for first release):**
1. Log in to App Store Connect
2. Select VerseMate
3. Status should show "Pending Developer Release"
4. Click **"Release This Version"** button
5. App goes live within a few hours

**Phased Release (Optional):**
- Release to small percentage of users first (7% day 1, increases over 7 days)
- Monitor for issues before full rollout
- Can pause or stop phased release if problems found

---

## Android Production Submission

**Note:** Google Play Console submission is currently deferred until Play Developer account is reactivated. This section documents the process for future use.

### Step 1: Create Version Tag

Same as iOS (see above) - use the same version tag for both platforms.

### Step 2: Trigger Production Build via GitHub Actions

1. Navigate to GitHub repository Actions tab
2. Select "Expo Production Build" workflow
3. Click "Run workflow"
4. Fill in workflow inputs:
   - **Platform**: Select `android` (or `all` for both platforms)
   - **Version tag**: Enter `v1.0.0`
5. Click "Run workflow" to confirm

### Step 3: Monitor Build Progress

**In GitHub Actions:**
- Watch workflow run in Actions tab
- Pre-build checks must pass

**In EAS Dashboard:**
- Navigate to https://expo.dev/accounts/versemate/projects/verse-mate-mobile/builds
- Find Android production build
- Build produces AAB (Android App Bundle) file
- Typically takes 15-30 minutes

### Step 4: Test Production Build

**Option A: Internal App Sharing (Google Play)**
```bash
# Submit to Internal App Sharing for quick testing
eas submit --platform android --latest --track internal
```

**Option B: Download AAB File**
```bash
# Download build
bash .deployment/download-build.sh <build-id>

# Test via bundletool:
# 1. Install bundletool: https://github.com/google/bundletool
# 2. Generate APKs from AAB
# 3. Install on device
```

### Step 5: Submit to Google Play Console

**Method 1: EAS CLI**
```bash
# Submit to production track
eas submit --platform android --latest

# Or submit specific build
eas submit --platform android --id <build-id>
```

**Method 2: Google Play Console Web Interface**
1. Log in to https://play.google.com/console
2. Select VerseMate app
3. Navigate to **"Release" → "Production"**
4. Click **"Create new release"**
5. Upload AAB file (or select from library if already uploaded)
6. Enter release notes
7. Review release details
8. Click **"Review release"**

### Step 6: Complete Release Information

1. **Release Name**: Version number (e.g., "1.0.0")

2. **Release Notes**
   - Maximum 500 characters per language
   - Use clear, concise bullet points
   - Example:
   ```
   Initial release of VerseMate!

   • Bible reading with page-based navigation
   • AI-powered verse explanations
   • Dark mode support
   • Share verses easily
   • Fast and offline-capable
   ```

3. **App Content**
   - Verify content rating
   - Check data safety information
   - Confirm target audience

### Step 7: Submit for Review

1. **Review Release**
   - Check all information is correct
   - Verify AAB uploaded successfully
   - Review rollout settings

2. **Rollout Options**
   - **Full Rollout**: Available to all users immediately
   - **Staged Rollout**: Gradual release (10%, 20%, 50%, 100%)
   - Recommendation: Start with staged rollout (10-20%)

3. **Submit**
   - Click **"Start rollout to Production"** button
   - Confirm submission

### Step 8: Monitor Review Status

**Review Timeline:**
- Can be a few hours to a few days
- Usually faster than iOS

**Status Checks:**
1. **Play Console Dashboard**
   - Check release status
   - Statuses: "Under review" → "Approved" → "Available"

2. **Email Notifications**
   - Google sends updates via email
   - Check for approval or rejection notices

3. **Policy Issues**
   - Monitor for policy violation notices
   - Address quickly if flagged

### Step 9: Monitor Rollout

**Staged Rollout:**
- Monitor crash reports and ANRs
- Check user reviews and ratings
- Increase rollout percentage gradually:
  - Day 1-2: 10%
  - Day 3-4: 20%
  - Day 5-6: 50%
  - Day 7+: 100%

**Full Rollout:**
- If staged rollout is successful
- Or if confident in stability
- Click "Increase rollout" → "100%"

---

## Rollback Procedures

### iOS: Removing a Version

If critical bug is discovered after release:

**Option 1: Remove from Sale**
1. Log in to App Store Connect
2. Select VerseMate
3. Click "Remove from Sale"
4. App is no longer available for download
5. Existing users keep their version

**Option 2: Submit Emergency Fix**
1. Fix the critical bug
2. Increment version (e.g., 1.0.0 → 1.0.1)
3. Submit as expedited review
4. Include reason for expedition in review notes

**Option 3: Replace Build (Before Approval)**
- If still "Waiting for Review" or "In Review"
- Can reject the binary and upload new one
- Resets review queue position

### Android: Halting a Rollout

**Pause Rollout:**
1. Log in to Play Console
2. Navigate to Production release
3. Click "Pause rollout"
4. No new users receive the update
5. Already updated users are unaffected

**Halt Rollout and Rollback:**
1. Pause the rollout
2. Click "Halt rollout"
3. Previous version becomes active again
4. New downloads get previous version
5. Updated users keep current version (can't force downgrade)

**Submit Fix:**
1. Fix the issue
2. Increment version (e.g., 1.0.0 → 1.0.1)
3. Create new production release
4. Users will update to fixed version

---

## Post-Submission Checklist

After submitting to app stores:

- [ ] Confirmation email received from Apple/Google
- [ ] Build visible in app store backend
- [ ] Review status being monitored
- [ ] Team notified of submission
- [ ] Support channels ready for user feedback
- [ ] Analytics/monitoring tools configured
- [ ] Crash reporting enabled
- [ ] Release announcement prepared (blog, social media, etc.)
- [ ] Internal stakeholders informed of timeline

---

## Troubleshooting

### Common iOS Rejection Reasons

**1. Crashes or Bugs**
- **Solution**: Test thoroughly before submission
- **Fix**: Address bug, submit new build

**2. Broken Links**
- **Cause**: Privacy policy or support URL not accessible
- **Solution**: Verify all URLs work without authentication

**3. Incomplete Information**
- **Cause**: Missing screenshots, description, or metadata
- **Solution**: Complete all required fields in App Store Connect

**4. Guideline Violation**
- **Cause**: Content, functionality, or design violates guidelines
- **Solution**: Review App Store Review Guidelines, make necessary changes

**5. Misleading Metadata**
- **Cause**: Description or screenshots don't match app functionality
- **Solution**: Ensure all marketing materials accurately represent the app

**6. Export Compliance**
- **Cause**: Incorrect encryption declaration
- **Solution**: Verify ITSAppUsesNonExemptEncryption setting in app.json

### Common Android Rejection Reasons

**1. Policy Violations**
- **Solution**: Review Google Play policies, make corrections

**2. Crashes or ANRs**
- **Solution**: Test on multiple devices, fix stability issues

**3. Data Safety Issues**
- **Cause**: Data safety declaration doesn't match app behavior
- **Solution**: Accurately declare data collection and usage

**4. Inappropriate Content**
- **Solution**: Ensure content meets Google Play standards

**5. Broken Functionality**
- **Solution**: Test all features thoroughly

### If Rejected

1. **Read the Rejection Notice Carefully**
   - Apple/Google provides specific reasons
   - May include screenshots or reproduction steps

2. **Address All Issues**
   - Fix bugs or policy violations
   - Update metadata if needed
   - Test fixes thoroughly

3. **Respond to Review Team (if applicable)**
   - Use Resolution Center (iOS) or email (Android)
   - Provide clarification if rejection seems incorrect
   - Be professional and concise

4. **Resubmit**
   - For minor metadata changes: Update and resubmit
   - For code changes: Create new build, increment version, resubmit
   - Include notes explaining what was fixed

---

## Manual Submission Commands Reference

### iOS

```bash
# Submit latest build to TestFlight
eas submit --platform ios --latest

# Submit specific build
eas submit --platform ios --id <build-id>

# Submit to App Store (after TestFlight testing)
# Note: Same command, but build must be selected in App Store Connect first
eas submit --platform ios --latest

# Check submission status
eas submit:list --platform ios --limit 5
```

### Android

```bash
# Submit to internal testing
eas submit --platform android --latest --track internal

# Submit to production
eas submit --platform android --latest --track production

# Submit to beta track
eas submit --platform android --latest --track beta

# Check submission status
eas submit:list --platform android --limit 5
```

---

## Best Practices

### Before Submission
1. **Test Thoroughly**
   - Test on multiple physical devices
   - Test all core features
   - Test edge cases and error handling
   - Verify deep linking and navigation

2. **Review Metadata**
   - Proofread all text
   - Verify all URLs are accessible
   - Check screenshots are current
   - Ensure accurate feature descriptions

3. **Version Control**
   - Tag release in git
   - Document what's in the release
   - Keep changelog updated

### During Review
1. **Monitor Actively**
   - Check status daily
   - Respond to questions quickly
   - Be available for follow-ups

2. **Be Patient**
   - Reviews take time
   - Don't rush or pressure review teams
   - Use expedited review only for true emergencies

### After Approval
1. **Monitor Closely**
   - Watch crash reports
   - Monitor user reviews
   - Track analytics

2. **Support Users**
   - Respond to reviews
   - Address bug reports
   - Update documentation

3. **Iterate Quickly**
   - Fix critical bugs immediately
   - Plan next release
   - Gather user feedback

---

## Resources

### Apple
- [App Store Connect](https://appstoreconnect.apple.com)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Review Status](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/check-the-status-of-your-app)

### Google
- [Google Play Console](https://play.google.com/console)
- [Release App on Google Play](https://support.google.com/googleplay/android-developer/answer/9859751)
- [Developer Policy Center](https://play.google.com/about/developer-content-policy/)

### Tools
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [Google Play Developer API](https://developers.google.com/android-publisher)
