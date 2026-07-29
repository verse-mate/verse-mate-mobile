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
 * settings, so there is no declarative route. This appends a `post_install` hook to the Podfile at
 * prebuild, which is the same mechanism a bare project would use.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/** Marker so re-running prebuild cannot append the hook twice. */
const MARKER = '# posthog-swiftinterface-fix';

const HOOK = `
${MARKER}
# Disable Swift module-interface verification for PostHog only. See
# plugins/posthog-swiftinterface-fix.js for the build log this fixes. Not project-wide: a broken
# interface in our own VMText module is a signal we want to keep failing on.
post_install do |installer|
  installer.pods_project.targets.each do |target|
    next unless target.name == 'PostHog'
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_VERIFY_EMITTED_MODULE_INTERFACE'] = 'NO'
    end
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

      fs.writeFileSync(podfile, `${contents}\n${HOOK}`, 'utf8');
      return cfg;
    },
  ]);
};
