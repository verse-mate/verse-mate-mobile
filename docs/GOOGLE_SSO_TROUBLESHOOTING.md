# Google SSO Troubleshooting Guide

This guide helps diagnose and fix Google Sign-In issues on Android and iOS.

## Quick Diagnosis

Run the diagnostic script to check your configuration:

```bash
bun run diagnose:google-sso
```

## Common Issue: "Developer Error" on Android

This is the **#1 most common issue** and is almost always caused by missing or incorrect SHA-1 fingerprint configuration in Google Cloud Console.

### Solution Steps

#### 1. Get Your SHA-1 Fingerprint

**For Development Builds (local testing):**

```bash
# macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Windows
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Look for the line that says `SHA1: XX:XX:XX:...` and copy that value.

**For EAS Builds (preview/production):**

```bash
eas credentials
```

- Select Android
- Select your build profile (preview/production)
- View keystore info
- Copy the SHA-1 fingerprint

#### 2. Add SHA-1 to Google Cloud Console

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your **Android** OAuth 2.0 Client ID (not the web client ID)
3. If you don't have one, click "Create Credentials" → "OAuth client ID" → "Android"
4. Add the SHA-1 fingerprint you copied
5. Verify the package name matches: `org.versemate.app`
6. Click Save

⚠️ **Important:** You need to add SHA-1 fingerprints for BOTH:
- Debug keystore (for development builds)
- Production keystore (for EAS builds)

#### 3. Wait 5-10 Minutes

Google Cloud Console changes can take a few minutes to propagate. Wait at least 5-10 minutes before testing again.

## Debugging with Enhanced Logs

The codebase now includes enhanced logging. When you run the app, check your console for messages prefixed with `[Google Sign-In]`:

```
[Google Sign-In] Configuring with: { webClientId: '94126503648-...', ... }
[Google Sign-In] Configuration successful
[Google Sign-In] Error details: { code: 12501, message: '...', ... }
```

### How to View Logs

**Metro Bundler Console:**
- Enhanced logs show in your terminal where you ran `npx expo start`

**Android Device Logs:**
```bash
# Filter for Google-related logs
adb logcat | grep -i google

# Filter for all app logs
adb logcat | grep org.versemate.app
```

**iOS Device Logs:**
```bash
# Use Xcode Console
# Or in terminal:
xcrun simctl spawn booted log stream --predicate 'process == "VerseMate"'
```

## Configuration Checklist

### Environment Variables (.env)

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com  # iOS only
```

### EAS Build Configuration (eas.json)

Make sure your build profiles include Google client IDs:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "...",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "..."
      }
    }
  }
}
```

### Google Cloud Console Requirements

You need **3 OAuth Client IDs**:

1. **Web application** (for backend)
   - Used as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - No restrictions needed

2. **Android** (for Android app)
   - Package name: `org.versemate.app`
   - SHA-1 fingerprints: Add BOTH debug and production
   - This is what validates your app!

3. **iOS** (for iOS app) - Optional
   - Bundle ID: `org.versemate.app`
   - Used as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

### OAuth Consent Screen

- **Scopes**: At minimum, need email and profile scopes
- **Publishing Status**:
  - "Testing": Only whitelisted test users can sign in
  - "In Production": Anyone can sign in
- **Test Users**: If in Testing mode, add your Google account as a test user

## Testing Strategy

### 1. Development Build (Recommended)

```bash
# Build development version
eas build --profile development --platform android --local

# Or build in cloud
eas build --profile development --platform android

# Install on device
adb install build-xxx.apk

# Run with dev client
npx expo start --dev-client
```

### 2. Check Logs

Watch the Metro console and device logs for `[Google Sign-In]` messages.

### 3. Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `12501` | User cancelled or developer error | Check SHA-1 fingerprints |
| `10` | Developer error | SHA-1 not configured or wrong package name |
| `7` | Network error | Check internet connection |
| `-5` | Invalid account | Account not in test users (if in Testing mode) |

## Platform-Specific Notes

### Android

- **Cannot test in Expo Go** - requires development build or standalone build
- **SHA-1 fingerprints are REQUIRED** - most common issue
- **Package name must match** Google Cloud Console configuration
- Debug and production keystores have different SHA-1 values

### iOS

- **Cannot test in Expo Go** - requires development build or standalone build
- **iOS Client ID is optional** - can use web client ID only
- **Bundle ID must match** Google Cloud Console configuration
- May require additional setup in Xcode for URL schemes

## Still Having Issues?

### 1. Double-check Configuration

Run the diagnostic script:
```bash
bun run diagnose:google-sso
```

### 2. Verify OAuth Client ID Type

Make sure you're using the **Web application** client ID for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, not the Android or iOS client ID.

### 3. Check Package Name

Verify your `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "org.versemate.app"  // Must match Google Cloud Console
    }
  }
}
```

### 4. Rebuild After Config Changes

If you changed environment variables or OAuth settings:
```bash
# Clear cache
rm -rf node_modules/.cache

# Rebuild
eas build --profile development --platform android --clear-cache
```

### 5. Check Backend Logs

If sign-in succeeds but backend authentication fails, check your backend logs. The backend needs to validate the ID token with the same web client ID.

## Resources

- [Google Sign-In for Android Setup](https://developers.google.com/identity/sign-in/android/start-integrating)
- [React Native Google Sign-In Docs](https://github.com/react-native-google-signin/google-signin)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## Getting Help

If you're still stuck after following this guide:

1. Run `bun run diagnose:google-sso` and save the output
2. Collect device logs using `adb logcat` (Android) or Xcode Console (iOS)
3. Note the exact error message you're seeing
4. Check if the error happens immediately or after Google account selection
5. Verify your Google Cloud Console configuration matches this guide

Common red flags:
- ❌ No SHA-1 fingerprints in Android OAuth client
- ❌ Package name mismatch
- ❌ Using wrong client ID type
- ❌ OAuth Consent Screen not configured
- ❌ Testing mode but user not whitelisted
