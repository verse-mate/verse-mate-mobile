const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .db files to be bundled as binary assets (e.g. the offline seed database)
config.resolver.assetExts.push('db');

// Web-only stub for `react-native-web-webview`.
// `react-native-youtube-iframe`'s web entry imports it, but we don't depend on
// that package (deprecated). The mobile path uses `react-native-webview`
// directly; the web build just needs to compile. See metro-stubs/ for the
// no-op component the stub points at.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-web-webview') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'metro-stubs/react-native-web-webview.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
