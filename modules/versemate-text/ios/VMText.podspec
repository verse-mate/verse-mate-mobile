Pod::Spec.new do |s|
  s.name           = 'VMText'
  s.version        = '1.0.0'
  s.summary        = 'Native text view rendering one string with decorated character ranges.'
  s.description    = <<-DESC
    Renders a whole paragraph as ONE native text view carrying attribute ranges, instead of one
    React `Text` per styled run. Reports taps, selection and line geometry back by character offset
    so the JS side never needs a node per word.

    The Android counterpart lives in ../android; `expo-module.config.json` has declared this Apple
    module since before it existed, so until now iOS silently fell back to the React renderer.
  DESC
  s.author         = 'VerseMate'
  s.homepage       = 'https://versemate.org'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Matches the Expo module template: build as a Swift module against the pods' header paths.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
