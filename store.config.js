const fs = require('node:fs');
const path = require('node:path');
const { LISTING_LANGUAGES } = require('./store/locales');

const APP_STORE_DIR = path.join(__dirname, 'store', 'app-store');

function readAppStoreInfo() {
  const info = {};
  for (const file of fs.readdirSync(APP_STORE_DIR).sort()) {
    if (!file.endsWith('.json')) continue;
    const language = path.basename(file, '.json');
    const locales = LISTING_LANGUAGES[language]?.appStore;
    if (!locales)
      throw new Error(`store/app-store/${file}: no App Store locales for "${language}"`);
    const entry = JSON.parse(fs.readFileSync(path.join(APP_STORE_DIR, file), 'utf8'));
    for (const locale of locales) info[locale] = entry;
  }
  return info;
}

module.exports = {
  configVersion: 0,
  apple: { info: readAppStoreInfo() },
};
