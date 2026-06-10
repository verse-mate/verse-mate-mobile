const config = {
  name: 'VerseMate',
  slug: 'verse-mate-mobile',
  owner: 'versemate',
  version: '1.3.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'versemate',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    icon: './assets/images/ios-icon.png',
    bundleIdentifier: 'org.versemate.app',
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
    ],
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
        widgets: [
          {
            name: 'VerseOfTheDay',
            label: 'Verse of the Day',
            description: "Today's Bible verse from VerseMate",
            minWidth: '180dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            resizeMode: 'horizontal|vertical',
            updatePeriodMillis: 86400000, // ~daily; OS-throttled periodic refresh
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

module.exports = {
  expo: {
    ...config,
    plugins: [
      ...config.plugins,
      // Allow cleartext HTTP in e2e-test builds (socat TLS proxy on localhost:4000)
      ...(isE2E ? [require('./plugins/allow-cleartext-traffic')] : []),
    ],
    updates: {
      ...config.updates,
      ...(isE2E && { fallbackToCacheTimeout: 10000 }),
    },
  },
};
