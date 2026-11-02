/**
 * Jest resolver: Reanimated's, on top of React Native's.
 *
 * Reanimated 4.7 and Worklets 0.13 ship jest resolvers that send a few of their modules
 * (Reanimated's `initializers`, Worklets' platform checks) to the JS builds instead of the .native
 * ones jest-expo's ios platform would pick; without them Reanimated's native initializer runs under
 * jest and throws ("setCSSEventHandler is not available in JSReanimated"). Reanimated's resolver
 * ends in jest's default resolver, which would drop React Native's preset resolver (it lets
 * react-native subpaths resolve and be mocked), so that one is slotted in as the default.
 */
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (req, opts) =>
      reactNativeResolver(req, { ...opts, defaultResolver: options.defaultResolver }),
  });
