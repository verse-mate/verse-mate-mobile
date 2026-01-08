/**
 * Google SSO Diagnostic Script
 *
 * Helps troubleshoot Google Sign-In configuration issues.
 * Run with: bun run scripts/diagnose-google-sso.ts
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function heading(title: string) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(title, colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
}

function checkMark(passed: boolean) {
  return passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
}

async function diagnoseGoogleSSO() {
  log('\n🔍 Google SSO Configuration Diagnostics\n', colors.bright);

  // 1. Check .env file
  heading('1. Environment Variables');
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log(`${checkMark(false)} .env file not found`, colors.red);
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const webClientId = envContent.match(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=(.+)/)?.[1]?.trim();
  const iosClientId = envContent.match(/EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=(.+)/)?.[1]?.trim();

  log(
    `${checkMark(Boolean(webClientId))} EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: ${webClientId || 'NOT SET'}`,
    webClientId ? colors.green : colors.red
  );
  log(
    `${checkMark(Boolean(iosClientId))} EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: ${iosClientId || 'NOT SET'}`,
    iosClientId ? colors.green : colors.yellow
  );

  // 2. Check app.json
  heading('2. App Configuration');
  const appJsonPath = path.join(process.cwd(), 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  const packageName = appJson.expo.android?.package;

  log(
    `${checkMark(Boolean(packageName))} Android Package: ${packageName}`,
    packageName ? colors.green : colors.red
  );

  // 3. Check for google-services.json (optional but helpful)
  heading('3. Google Services Configuration');
  const googleServicesPath = path.join(process.cwd(), 'android', 'app', 'google-services.json');
  const hasGoogleServices = fs.existsSync(googleServicesPath);

  log(
    `${checkMark(hasGoogleServices)} google-services.json: ${hasGoogleServices ? 'Found' : 'Not found (optional)'}`,
    hasGoogleServices ? colors.green : colors.yellow
  );

  // 4. Get SHA-1 fingerprints
  heading('4. SHA Fingerprints (Required for Android)');

  try {
    // Debug keystore (development)
    log('\n📱 Debug Keystore (Development Builds):', colors.bright);
    const debugKeystorePath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.android',
      'debug.keystore'
    );

    if (fs.existsSync(debugKeystorePath)) {
      log(`   Location: ${debugKeystorePath}`, colors.cyan);
      try {
        const debugSha1 = execSync(
          `keytool -list -v -keystore "${debugKeystorePath}" -alias androiddebugkey -storepass android -keypass android`,
          { encoding: 'utf-8' }
        );
        const sha1Match = debugSha1.match(/SHA1: ([A-F0-9:]+)/);
        const sha256Match = debugSha1.match(/SHA256: ([A-F0-9:]+)/);

        if (sha1Match) {
          log(`   SHA-1: ${sha1Match[1]}`, colors.green);
        }
        if (sha256Match) {
          log(`   SHA-256: ${sha256Match[1]}`, colors.green);
        }
      } catch (_err) {
        log(`   ${checkMark(false)} Failed to read keystore`, colors.red);
      }
    } else {
      log(`   ${checkMark(false)} Debug keystore not found`, colors.yellow);
    }

    // Production keystore (if configured)
    log('\n🏭 Production Keystore (Release Builds):', colors.bright);
    log('   Check your EAS credentials or upload keystore', colors.yellow);
    log('   Run: eas credentials', colors.cyan);
  } catch (_err) {
    log(`${checkMark(false)} keytool not found in PATH`, colors.red);
    log('   Install Java JDK to get keytool', colors.yellow);
  }

  // 5. Check @react-native-google-signin/google-signin installation
  heading('5. Google Sign-In Package');
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const googleSignInVersion =
    packageJson.dependencies?.['@react-native-google-signin/google-signin'];

  log(
    `${checkMark(Boolean(googleSignInVersion))} @react-native-google-signin/google-signin: ${googleSignInVersion || 'NOT INSTALLED'}`,
    googleSignInVersion ? colors.green : colors.red
  );

  // 6. Configuration checklist
  heading('6. Google Cloud Console Checklist');
  log("\n📋 Make sure you've completed these steps in Google Cloud Console:", colors.bright);
  log('   https://console.cloud.google.com/apis/credentials\n');
  log('   1. Create OAuth 2.0 Client ID (Web application)', colors.cyan);
  log(`      - Use this as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, colors.cyan);
  log('');
  log('   2. Create OAuth 2.0 Client ID (Android)', colors.cyan);
  log(`      - Package name: ${packageName}`, colors.yellow);
  log('      - Add SHA-1 fingerprint from debug keystore (see above)', colors.yellow);
  log('      - Add SHA-1 fingerprint from production keystore (EAS)', colors.yellow);
  log('');
  log('   3. Create OAuth 2.0 Client ID (iOS) - Optional', colors.cyan);
  log('      - Bundle ID: org.versemate.app', colors.yellow);
  log('');
  log('   4. OAuth Consent Screen', colors.cyan);
  log('      - Set to "Testing" or "Published"', colors.yellow);
  log('      - Add test users if in Testing mode', colors.yellow);

  // 7. Common errors
  heading('7. Common "Developer Error" Causes');
  log('\n❌ If you see "Developer Error", check:', colors.bright);
  log('   • SHA-1 fingerprint NOT added to Android OAuth Client', colors.yellow);
  log('   • Wrong package name in Android OAuth Client', colors.yellow);
  log('   • OAuth Consent Screen not configured', colors.yellow);
  log('   • Using wrong CLIENT_ID (web vs android)', colors.yellow);
  log('   • App not in testing users (if OAuth in Testing mode)', colors.yellow);

  // 8. How to get EAS build SHA-1
  heading('8. Get SHA-1 from EAS Build');
  log('\nFor production/preview builds via EAS:', colors.bright);
  log('   1. Run: eas credentials', colors.cyan);
  log('   2. Select Android → Production/Preview', colors.cyan);
  log('   3. View keystore info to get SHA-1', colors.cyan);
  log('   4. Add that SHA-1 to Google Cloud Console', colors.cyan);

  // 9. Testing recommendations
  heading('9. Testing Recommendations');
  log('\n🧪 To test Google SSO:', colors.bright);
  log(
    '   1. Build development build: eas build --profile development --platform android',
    colors.cyan
  );
  log('   2. Install on device/emulator', colors.cyan);
  log('   3. Run: npx expo start --dev-client', colors.cyan);
  log('   4. Check Metro logs for [Google Sign-In] messages', colors.cyan);
  log('   5. Use: adb logcat | grep -i google (for Android logs)', colors.cyan);

  log('\n✅ Done!\n', colors.green);
}

// Run diagnostics
diagnoseGoogleSSO().catch(console.error);
