const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow .db files to be bundled as binary assets (e.g. the offline seed database)
config.resolver.assetExts.push('db');

module.exports = config;
