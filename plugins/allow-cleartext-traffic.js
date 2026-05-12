/**
 * Expo config plugin to allow cleartext HTTP traffic on Android.
 * Only used in e2e-test builds where the app connects to localhost:4000
 * via socat TLS proxy (adb reverse) instead of directly to HTTPS API.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function allowCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
