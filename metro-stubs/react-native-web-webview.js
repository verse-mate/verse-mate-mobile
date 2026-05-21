// Web stub for `react-native-web-webview`.
//
// `react-native-youtube-iframe`'s web bundle (WebView.web.js) imports
// `react-native-web-webview`, which we don't depend on (it's an old, mostly
// unmaintained package). We only target the web build for previews — the real
// YouTube playback path is mobile (iOS/Android) where react-native-webview
// is wired up. Stubbing here makes `bun run web` / `expo export -p web` build
// without pulling in that package; the YouTube card in the Visuals tab just
// renders as a no-op on web.
const React = require('react');

const WebView = React.forwardRef(function StubWebView(_props, _ref) {
  return null;
});

module.exports = WebView;
module.exports.WebView = WebView;
module.exports.default = WebView;
