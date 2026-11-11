const PRODUCTION_API_HOST = 'api.versemate.org';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

function requestedPlatforms(args) {
  return args.flatMap((arg, index) => {
    if (arg === '--platform' || arg === '-p') return [args[index + 1]];
    if (arg.startsWith('--platform=')) return [arg.slice('--platform='.length)];
    return [];
  });
}

function exportsNativeBundle(args) {
  if (!args.includes('export')) return false;
  const platforms = requestedPlatforms(args);
  return platforms.length === 0 || platforms.some((platform) => platform !== 'web');
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isPublicHttpsUrl(url) {
  if (!url || !url.startsWith('https://')) return false;
  const host = hostnameOf(url);
  return Boolean(host) && !LOOPBACK_HOSTS.has(host);
}

function checkApiUrl({ argv, env }) {
  const apiUrl = env.EXPO_PUBLIC_API_URL;
  const args = argv.slice(2);

  if (exportsNativeBundle(args) && !isPublicHttpsUrl(apiUrl)) {
    return {
      error:
        `EXPO_PUBLIC_API_URL is ${apiUrl ? `"${apiUrl}"` : 'not set'}, and this export bundles for a ` +
        'native platform that installed apps can receive as an update. Set EXPO_PUBLIC_API_URL to the ' +
        "API those apps must call (for example with eas update --environment production), or pass --platform web for a local web export.",
    };
  }

  const isLocalRun = !env.APP_ENV && !env.CI;
  if (isLocalRun && hostnameOf(apiUrl) === PRODUCTION_API_HOST) {
    return {
      warning:
        `EXPO_PUBLIC_API_URL is ${apiUrl}: this local build talks to the production API. ` +
        'Set EXPO_PUBLIC_API_URL=http://localhost:4000 in .env to use a local backend.',
    };
  }

  return {};
}

module.exports = { checkApiUrl };
