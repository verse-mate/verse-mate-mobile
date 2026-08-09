const fs = require('node:fs');

// GH-281: only wire the FCM config when google-services.json is actually
// present, so an Android prebuild/build doesn't fail before push credentials
// are provisioned (the file is gitignored, added via EAS credentials). Until
// then push simply stays dormant on Android; iOS and the build are unaffected.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const hasGoogleServices = fs.existsSync(googleServicesFile);

const config = {
  name: 'VerseMate',
  slug: 'verse-mate-mobile',
  owner: 'versemate',
  version: '1.5.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'versemate',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    icon: './assets/images/ios-icon.png',
    bundleIdentifier: 'org.versemate.app',
    // GH-281: explicit Apple Developer team so iOS builds (incl. the
    // Verse-of-the-Day widget extension signing) resolve credentials
    // non-interactively. Team: VerseMate (Company/Organization).
    appleTeamId: 'U9SRD4VJPX',
    supportsTablet: true,
    associatedDomains: ['applinks:app.versemate.org'],
    // App Group shared between the app and the Verse-of-the-Day widget
    // extension (GH-265). The app writes the user's preferred Bible version
    // here; the widget reads it. The widget target declares the same group
    // in targets/widget/expo-target.config.js.
    entitlements: {
      'com.apple.security.application-groups': ['group.org.versemate.app'],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription:
        'Allow VerseMate to access your photo library to set a profile picture.',
      // TASK-017 / br-audio-011: keep audio playing when the app is
      // backgrounded so explanations don't cut off when the screen
      // locks or the user switches apps.
      UIBackgroundModes: ['audio'],
      // iOS visuals rotation: by default Expo's `orientation: 'default'`
      // ships UISupportedInterfaceOrientations as portrait-only on iPhone.
      // expo-screen-orientation's `unlockAsync()` can't override the
      // Info.plist superset at runtime, so the Visuals tab couldn't
      // rotate to landscape even though VisualsPanel called unlockAsync
      // on mount. Declaring all four orientations here lets the runtime
      // calls take effect; non-Visuals screens stay portrait because
      // nothing else calls unlockAsync.
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            'com.googleusercontent.apps.94126503648-htsubrfo04f7ef34ig58lsiscj9kbmo6',
          ],
        },
      ],
    },
  },
  android: {
    package: 'org.versemate.app',
    allowBackup: false,
    // TASK-017: FOREGROUND_SERVICE + media notification permissions
    // for background audio (br-audio-011). WAKE_LOCK keeps audio
    // playing when the screen is off.
    permissions: [
      'RECEIVE_BOOT_COMPLETED',
      'RECORD_AUDIO',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'WAKE_LOCK',
      // GH-281: Android 13+ runtime notification permission for push.
      'POST_NOTIFICATIONS',
    ],
    // GH-281: FCM V1 service config for Expo push. Only wired when the file is
    // present (see top of file) so Android builds don't fail before push
    // credentials are provisioned. Uploaded via EAS credentials; gitignored.
    ...(hasGoogleServices ? { googleServicesFile } : {}),
    blockedPermissions: ['android.permission.ACTIVITY_RECOGNITION'],
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    statusBar: {
      translucent: true,
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'app.versemate.org',
            pathPrefix: '/bible',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'app.versemate.org',
            pathPrefix: '/topic',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'app.versemate.org',
            pathPrefix: '/names-of-god',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // GH-281: push notifications. The plugin adds the iOS push entitlement
    // (aps-environment) and Android POST_NOTIFICATIONS wiring at prebuild.
    [
      'expo-notifications',
      {
        icon: './assets/images/android-icon.png',
        color: '#E6F4FE',
        defaultChannel: 'default',
      },
    ],
    // GoogleSignin v16 pulls in AppCheckCore, a Swift pod that depends on
    // GoogleUtilities and RecaptchaInterop. Those pods don't define Clang
    // modules, so CocoaPods can't integrate them as static libraries and
    // `pod install` fails ("cannot yet be integrated as static libraries").
    // Force modular headers for just those two pods (the targeted fix
    // CocoaPods itself recommends) instead of flipping use_modular_headers!
    // globally, which would risk breaking other pods.
    // iOS build #100 and #101 both died verifying PostHog's emitted Swift module interface against
    // iPhoneOS26.0.sdk ("underlying Objective-C module 'PostHog' not found"). Same PostHog version and an
    // empty lockfile diff versus the build that passed hours earlier, and our own VMText module appears
    // 40 times in the log with zero errors — so this is a toolchain/pod interaction, not our code.
    // The plugin disables that self-check for the PostHog target only.
    './plugins/posthog-swiftinterface-fix.js',
    [
      'expo-build-properties',
      {
        ios: {
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
          ],
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Allow Verse Mate to determine sunrise and sunset times for automatic theme switching.',
      },
    ],
    'expo-apple-authentication',
    '@react-native-google-signin/google-signin',
    'expo-font',
    'expo-localization',
    'expo-web-browser',
    'expo-sqlite',
    'expo-audio',
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Allow Verse Mate to use the microphone for voice-to-text input.',
        speechRecognitionPermission:
          'Allow Verse Mate to use speech recognition for voice-to-text input.',
      },
    ],
    // Verse-of-the-Day widget (GH-265).
    // iOS: @bacons/apple-targets generates the WidgetKit extension from
    // targets/widget/ during prebuild. Android: react-native-android-widget
    // registers the AppWidgetProvider + the JS-rendered widget.
    '@bacons/apple-targets',
    [
      'react-native-android-widget',
      {
        // The design (panel 2B) draws two Android compositions: 4×2 verse-only
        // and 4×4 verse + "Why it matters". They ship as two providers rather
        // than one resizable widget because the widget's own size is NOT
        // discoverable at render time: in portrait the library reports
        // OPTION_APPWIDGET_MAX_HEIGHT, which is the provider's max resize bound,
        // not the current height — a 4×2 and a 4×4 both report 358dp on the
        // Pixel launcher (verified on an API 35 emulator). The widget *name* is
        // reliable, so the task handler keys the composition off that instead.
        // Vertical resize is disabled so each provider keeps the height its
        // composition was drawn for (the design requires text to clamp, never
        // overflow).
        widgets: [
          {
            name: 'VerseOfTheDay',
            label: 'Verse of the Day',
            description: "Today's Bible verse from VerseMate",
            minWidth: '180dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: 'horizontal',
            updatePeriodMillis: 86400000, // ~daily; OS-throttled periodic refresh
          },
          {
            name: 'VerseOfTheDayNote',
            label: 'Verse of the Day (with note)',
            description: "Today's verse plus why it matters",
            minWidth: '180dp',
            minHeight: '250dp',
            targetCellWidth: 4,
            targetCellHeight: 4,
            resizeMode: 'horizontal',
            updatePeriodMillis: 86400000,
          },
        ],
      },
    ],
  ],
  assetBundlePatterns: ['assets/data/**'],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '3178e762-1329-4504-9541-0f6a489a760b',
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/3178e762-1329-4504-9541-0f6a489a760b',
  },
};

const isE2E = process.env.APP_ENV === 'e2e-test';

// The iOS Verse-of-the-Day widget (GH-265) is generated by @bacons/apple-targets
// during prebuild as the org.versemate.app.widget target, which needs its own
// EAS signing credentials. Until those are provisioned (issue #347), non-
// interactive iOS builds fail on that target. Setting EXPO_EXCLUDE_IOS_WIDGET=1
// (done in the preview/production env in eas.json) drops the iOS widget target
// and its App Group entitlement so the build signs with the main-app
// credentials alone. This is iOS-only: the Android widget
// (react-native-android-widget) is a separate plugin and is unaffected.
// Remove the env flag to bring the iOS widget back once #347 is resolved.
const excludeIosWidget = process.env.EXPO_EXCLUDE_IOS_WIDGET === '1';

// Drop the App Group entitlement when the widget is excluded — without the
// widget there is no reader, and keeping it would still require the App Groups
// capability on the main app's provisioning profile.
const iosConfig = excludeIosWidget
  ? Object.fromEntries(Object.entries(config.ios).filter(([key]) => key !== 'entitlements'))
  : config.ios;

const basePlugins = excludeIosWidget
  ? config.plugins.filter((plugin) => plugin !== '@bacons/apple-targets')
  : config.plugins;

module.exports = {
  expo: {
    ...config,
    ios: iosConfig,
    plugins: [
      ...basePlugins,
      // Allow cleartext HTTP in e2e-test builds (socat TLS proxy on localhost:4000)
      ...(isE2E ? [require('./plugins/allow-cleartext-traffic')] : []),
    ],
    updates: {
      ...config.updates,
      ...(isE2E && { fallbackToCacheTimeout: 10000 }),
    },
  },
};
