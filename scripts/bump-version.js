/* eslint-env node */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the bump type from arguments (patch, minor, major)
const bumpType = process.argv[2] || 'patch';

// Valid bump types
const VALID_BUMPS = ['patch', 'minor', 'major'];

if (!VALID_BUMPS.includes(bumpType)) {
  console.error(`Invalid bump type: ${bumpType}. Must be one of: ${VALID_BUMPS.join(', ')}`);
  process.exit(1);
}

// Paths
// eslint-disable-next-line no-undef
const appJsonPath = path.resolve(__dirname, '../app.json');
// eslint-disable-next-line no-undef
const packageJsonPath = path.resolve(__dirname, '../package.json');

// Read files
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Helper to bump semantic version string
function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3) throw new Error(`Invalid version format: ${version}`);

  let [major, minor, patch] = parts;

  switch (type) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

// Bump versions
const currentVersion = appJson.expo.version;
const newVersion = bumpVersion(currentVersion, bumpType);

console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

// Update objects
appJson.expo.version = newVersion;
packageJson.version = newVersion;

// Write files back
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Optional: Git commit and tag if requested via env var
if (process.env.COMMIT_BUMP === 'true') {
  try {
    console.log('Committing and tagging version bump...');
    execSync(`git add app.json package.json`);
    execSync(`git commit -m "chore: bump version to ${newVersion}"`);
    execSync(`git tag v${newVersion}`);
    console.log('Git operations successful.');
  } catch (error) {
    console.error('Failed to perform git operations:', error.message);
    process.exit(1);
  }
}

console.log(newVersion);
