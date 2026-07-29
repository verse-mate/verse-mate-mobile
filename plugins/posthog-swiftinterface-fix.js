/**
 * Expo config plugin: stop Xcode verifying PostHog's emitted Swift module interface.
 *
 * ## The failure
 *
 * iOS build #100 (2026-07-29) died in `fastlane` with:
 *
 *     SwiftVerifyEmittedModuleInterface … Verifying emitted module interface PostHog.swiftinterface
 *     error: underlying Objective-C module 'PostHog' not found
 *     error: failed to verify module interface of 'PostHog' due to the errors above;
 *            the textual interface may be broken by project issues or a compiler bug
 *
 * PostHog is compiled with `-enable-library-evolution`, which makes Xcode emit a textual
 * `.swiftinterface` and then re-typecheck it in isolation. That re-typecheck cannot see PostHog's own
 * Objective-C pieces — it ships three private pods (`phlibwebp`, `PHPLCrashReporter`,
 * `PostHogObjCExceptionSupport`) whose headers are not visible from the interface — so verification
 * fails even though the library itself compiled fine.
 *
 * Confirmed from the build log that this is not our code: `VMText` appears 40 times with zero errors,
 * and the only two distinct errors in 25,719 lines are the PostHog pair above. The PostHog version was
 * byte-identical to the build that passed hours earlier (`posthog-react-native@4.14.2`,
 * `posthog-react-native-session-replay@1.2.3`), and the lockfile diff between the two builds was empty —
 * so the trigger is the toolchain (SDK `iPhoneOS26.0.sdk`, i.e. Xcode 26), not a dependency change.
 *
 * ## Why disabling verification is the right fix rather than a workaround
 *
 * `SWIFT_VERIFY_EMITTED_MODULE_INTERFACE` is a *self-check* on the generated interface. Turning it off
 * does not change the compiled binary, the module, or anything that ships — it only stops Xcode
 * re-parsing a file it just wrote. The interface matters for ABI-stable distribution of a prebuilt
 * framework; PostHog is built from source in this app, so nothing consumes it.
 *
 * Scoped to PostHog by target name on purpose. A project-wide flip would also silence the check for our
 * OWN Swift module (`VMText`), where a broken interface would be a real signal worth failing on.
 *
 * ## Why a custom plugin
 *
 * `expo-build-properties` covers pod modular headers and `useFrameworks`, but not arbitrary Xcode build
 * settings, so there is no declarative route. This injects into the Podfile's EXISTING `post_install`
 * hook at prebuild — see the note on ANCHOR for why appending a second one breaks the build.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/** Marker so re-running prebuild cannot inject twice. */
const MARKER = '# posthog-swiftinterface-fix';

/**
 * The line Expo's generated Podfile uses to open its own post_install hook.
 *
 * Injecting INTO this block is the whole point. The first version of this plugin APPENDED a second
 * `post_install do |installer|` at file scope, which broke the build — `post_install` is a setter, so
 * the second declaration replaced Expo's and wiped `react_native_post_install(...)`, essential React
 * Native configuration. Expo reported it as `UNKNOWN_ERROR: See logs of the Install pods build phase`,
 * and generating the Podfile locally (`npx expo prebuild --platform ios --no-install`, which needs Linux
 * or macOS — it silently skips on Windows) showed two `post_install` blocks, at lines 52 and 67.
 */
const ANCHOR = '  post_install do |installer|';

const INJECTION = `
    ${MARKER}
    # Disable Swift module-interface verification for PostHog only. PostHog compiles with
    # -enable-library-evolution, so Xcode emits a textual .swiftinterface and re-typechecks it in
    # isolation; that re-typecheck cannot see PostHog's private Objective-C pods (phlibwebp,
    # PHPLCrashReporter, PostHogObjCExceptionSupport) and fails with "underlying Objective-C module
    # 'PostHog' not found" even though the library compiled fine. The setting is a self-check on a file
    # Xcode just wrote — disabling it changes nothing that ships.
    #
    # Scoped to PostHog by name: a project-wide flip would also silence the check for our own VMText
    # module, where a broken interface would be a real signal.
    # Matches every PostHog pod, not just the one named in the error. posthog-react-native pulls in the
    # native PostHog pod AND posthog-react-native-session-replay, which depends on PostHog too -- so
    # a second Swift pod can hit the identical interface-verification failure and fail the build again.
    # Still not project-wide: our own VMText module keeps the check, where a broken interface is a real
    # signal.
    installer.pods_project.targets.each do |target|
      next unless target.name.downcase.include?('posthog')
      target.build_configurations.each do |build_config|
        build_config.build_settings['SWIFT_VERIFY_EMITTED_MODULE_INTERFACE'] = 'NO'
      end
    end
`;

module.exports = function posthogSwiftinterfaceFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');

      // Idempotent: prebuild runs repeatedly on EAS and locally.
      if (contents.includes(MARKER)) return cfg;

      // Fail loudly rather than silently shipping a build without the fix. A missing anchor means the
      // Expo template changed, and a silent no-op here would resurface as the same opaque pod failure.
      if (!contents.includes(ANCHOR)) {
        throw new Error(
          `[posthog-swiftinterface-fix] could not find "${ANCHOR}" in the generated Podfile. ` +
            'The Expo template has changed; update the anchor rather than appending a second ' +
            'post_install block, which replaces Expo\'s and breaks pod install.'
        );
      }

      fs.writeFileSync(podfile, contents.replace(ANCHOR, ANCHOR + INJECTION), 'utf8');
      return cfg;
    },
  ]);
};
