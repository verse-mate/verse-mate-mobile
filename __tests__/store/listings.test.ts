import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const STORE_DIR = path.join(ROOT, 'store');
const APP_STORE_DIR = path.join(STORE_DIR, 'app-store');
const PLAY_DIR = path.join(STORE_DIR, 'google-play');
const SHIPPED_LANGUAGES = ['en', 'pt'];
const APP_NAME = 'VerseMate';

const { LISTING_LANGUAGES } = require(path.join(STORE_DIR, 'locales.js')) as {
  LISTING_LANGUAGES: Record<string, { appStore: string[]; play: string[] }>;
};

type AppStoreEntry = {
  title?: string;
  subtitle?: string;
  keywords?: string[];
  promoText?: string;
  description?: string;
  marketingUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
};

type Approval = { approver?: string; signedOff?: string; fingerprint?: string };

const APP_STORE_LIMITS: [keyof AppStoreEntry, number][] = [
  ['title', 30],
  ['subtitle', 30],
  ['promoText', 170],
  ['description', 4000],
  ['marketingUrl', 255],
  ['supportUrl', 255],
  ['privacyPolicyUrl', 255],
];
const KEYWORDS_LIMIT = 100;
const PLAY_LIMITS: [string, number][] = [
  ['title.txt', 30],
  ['short_description.txt', 80],
  ['full_description.txt', 4000],
];
const LISTING_URLS = {
  marketingUrl: 'https://versemate.org/',
  supportUrl: 'https://versemate.org/support/',
  privacyPolicyUrl: 'https://versemate.org/privacy/',
};

const codePoints = (text: string) => [...text].length;
const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

const languagesWithAppStoreCopy = () =>
  fs
    .readdirSync(APP_STORE_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'));

const playFolders = () =>
  fs.existsSync(PLAY_DIR)
    ? fs
        .readdirSync(PLAY_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => entry.name)
    : [];

const languageOfPlayFolder = (folder: string) =>
  Object.keys(LISTING_LANGUAGES).find((language) =>
    LISTING_LANGUAGES[language].play.includes(folder)
  );

const readAppStore = (language: string): AppStoreEntry | undefined => {
  const file = path.join(APP_STORE_DIR, `${language}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
};

const readPlay = (folder: string, file: string): string | undefined => {
  const full = path.join(PLAY_DIR, folder, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : undefined;
};

const approvals = (): Record<string, Approval> =>
  JSON.parse(fs.readFileSync(path.join(STORE_DIR, 'approvals.json'), 'utf8'));

function copyFingerprint(language: string): string {
  const hash = createHash('sha256');
  hash.update(`app-store/${language}.json\n`);
  hash.update(fs.readFileSync(path.join(APP_STORE_DIR, `${language}.json`), 'utf8'));
  const primaryPlay = LISTING_LANGUAGES[language].play[0];
  for (const [file] of PLAY_LIMITS) {
    hash.update(`\ngoogle-play/${primaryPlay}/${file}\n`);
    hash.update(readPlay(primaryPlay, file) ?? '');
  }
  return hash.digest('hex');
}

describe('store listings', () => {
  it('ships every shipped language on both stores, and nothing else', () => {
    const problems: string[] = [];
    const withCopy = new Set([
      ...languagesWithAppStoreCopy(),
      ...playFolders().map((folder) => languageOfPlayFolder(folder) ?? folder),
    ]);
    for (const language of SHIPPED_LANGUAGES) {
      if (!readAppStore(language)) problems.push(`${language}: App Store entry missing`);
      for (const folder of LISTING_LANGUAGES[language]?.play ?? []) {
        if (!fs.existsSync(path.join(PLAY_DIR, folder))) {
          problems.push(`${language}: Play folder ${folder} missing`);
        }
      }
    }
    for (const language of withCopy) {
      if (!LISTING_LANGUAGES[language]) problems.push(`${language}: no locales declared`);
    }
    expect(problems).toEqual([]);
  });

  it('keeps every App Store field present and within its limit', () => {
    const problems: string[] = [];
    for (const language of languagesWithAppStoreCopy()) {
      const entry = readAppStore(language) as AppStoreEntry;
      for (const [field, limit] of APP_STORE_LIMITS) {
        const value = entry[field];
        if (typeof value !== 'string' || value.trim() === '') {
          problems.push(`${language} App Store ${field}: missing`);
        } else if (codePoints(value) > limit) {
          problems.push(`${language} App Store ${field}: ${codePoints(value)} > ${limit}`);
        }
      }
      const keywords = entry.keywords ?? [];
      const joined = keywords.join(',');
      if (keywords.length === 0) problems.push(`${language} App Store keywords: missing`);
      if (codePoints(joined) > KEYWORDS_LIMIT) {
        problems.push(`${language} App Store keywords: ${codePoints(joined)} > ${KEYWORDS_LIMIT}`);
      }
      for (const [field, url] of Object.entries(LISTING_URLS)) {
        if (entry[field as keyof AppStoreEntry] !== url) {
          problems.push(`${language} App Store ${field}: expected ${url}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps every Play field present and within its limit', () => {
    const problems: string[] = [];
    for (const folder of playFolders()) {
      for (const [file, limit] of PLAY_LIMITS) {
        const value = readPlay(folder, file);
        const field = path.basename(file, '.txt');
        if (value === undefined || value.trim() === '') {
          problems.push(`${folder} Play ${field}: missing`);
        } else if (codePoints(value) > limit) {
          problems.push(`${folder} Play ${field}: ${codePoints(value)} > ${limit}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('names the app VerseMate everywhere', () => {
    const problems: string[] = [];
    for (const language of languagesWithAppStoreCopy()) {
      const title = readAppStore(language)?.title;
      if (title !== APP_NAME) problems.push(`${language} App Store title: "${title}"`);
    }
    for (const folder of playFolders()) {
      const title = readPlay(folder, 'title.txt');
      if (title !== APP_NAME) problems.push(`${folder} Play title: "${title}"`);
    }
    expect(problems).toEqual([]);
  });

  it('wastes no App Store keyword', () => {
    const problems: string[] = [];
    for (const language of languagesWithAppStoreCopy()) {
      const entry = readAppStore(language) as AppStoreEntry;
      const indexed = new Set([...words(entry.title ?? ''), ...words(entry.subtitle ?? '')]);
      const seen = new Set<string>();
      for (const word of (entry.keywords ?? []).flatMap(words)) {
        if (word === 'versemate') problems.push(`${language} App Store keywords: "versemate"`);
        else if (indexed.has(word)) {
          problems.push(`${language} App Store keywords: "${word}" is in the name or subtitle`);
        } else if (seen.has(word)) problems.push(`${language} App Store keywords: "${word}" twice`);
        seen.add(word);
      }
    }
    expect(problems).toEqual([]);
  });

  it('carries the English searches in the indexed fields', () => {
    const entry = readAppStore('en') as AppStoreEntry;
    const indexed = [
      entry.subtitle ?? '',
      (entry.keywords ?? []).join(' '),
      readPlay('en-US', 'short_description.txt') ?? '',
    ]
      .join(' ')
      .toLocaleLowerCase();
    const missing = [['bible'], ['study'], ['explanation', 'explained'], ['verse by verse']].filter(
      (alternatives) => !alternatives.some((term) => indexed.includes(term))
    );
    expect(missing).toEqual([]);
  });

  it('links each regional Play storefront to its shared text', () => {
    const problems: string[] = [];
    for (const language of languagesWithAppStoreCopy()) {
      const [primary, ...regional] = LISTING_LANGUAGES[language]?.play ?? [];
      for (const folder of regional) {
        const full = path.join(PLAY_DIR, folder);
        if (!fs.existsSync(full) || !fs.lstatSync(full).isSymbolicLink()) {
          problems.push(`${folder}: not a link to ${primary}`);
        } else if (fs.readlinkSync(full) !== primary) {
          problems.push(`${folder}: links to ${fs.readlinkSync(full)}, not ${primary}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has the approved text for every language, and an approval only where there is copy', () => {
    const problems: string[] = [];
    const recorded = approvals();
    const withCopy = languagesWithAppStoreCopy();
    for (const language of withCopy) {
      const approval = recorded[language];
      if (!approval?.approver) {
        problems.push(`${language}: no approver recorded`);
        continue;
      }
      if (!approval.signedOff || !/^\d{4}-\d{2}-\d{2}$/.test(approval.signedOff)) {
        problems.push(`${language}: no sign-off date from ${approval.approver}`);
      }
      const current = copyFingerprint(language);
      if (approval.fingerprint !== current) {
        problems.push(
          `${language}: copy differs from the text ${approval.approver} approved (now ${current})`
        );
      }
    }
    for (const language of Object.keys(recorded)) {
      if (!withCopy.includes(language)) problems.push(`${language}: approval without copy`);
    }
    expect(problems).toEqual([]);
  });
});
