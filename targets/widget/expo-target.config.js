/**
 * @bacons/apple-targets config for the Verse-of-the-Day WidgetKit extension
 * (GH-265). Generated into a native target by `expo prebuild`.
 *
 * The App Group must match the main app (app.config.js ios.entitlements) so
 * the widget can read the user's preferred Bible version written by the JS app.
 *
 * NOTE: authored without a local Apple toolchain — verify on a machine with
 * Xcode (`expo prebuild -p ios` then open the workspace).
 */
module.exports = {
  type: "widget",
  name: "VerseOfTheDay",
  entitlements: {
    "com.apple.security.application-groups": ["group.org.versemate.app"],
  },
};
