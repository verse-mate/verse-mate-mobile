// Mock import.meta and winter runtime globals for Expo
global.__ExpoImportMetaRegistry = new Map();
global.import = {
  meta: {
    url: '',
    resolve: (specifier) => specifier,
  },
};

// Mock structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
