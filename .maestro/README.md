# Maestro E2E Testing

This directory contains end-to-end tests for VerseMate using [Maestro](https://maestro.mobile.dev/).

## Running Tests

### iOS (✅ Supported)
```bash
# Run all tests on iOS
maestro test .maestro

# Run specific test
maestro test .maestro/swipe-navigation-basic.yaml

# Run in Maestro Studio for interactive debugging
maestro studio
```

### Android (⚠️ Limited Support)

**Current Limitation**: Maestro does not currently support Android API 35. If you're using an Android emulator with API 35, Maestro tests will fail with a gRPC connection error.

**Error you might see**:
```
io.grpc.StatusRuntimeException: UNAVAILABLE: io exception
Caused by: Connection refused: localhost/[0:0:0:0:0:0:0:1]:7001
```

**Root Cause**: Maestro's gRPC server component doesn't install/run on Android API 35 (Android 16 Developer Preview).

**Workarounds**:

1. **Use iOS for E2E testing** (recommended for now)
   - All Maestro tests work perfectly on iOS
   - iOS Simulator is the primary platform for E2E testing

2. **Create Android emulator with API 34 or lower**
   ```bash
   # List available system images
   $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list | grep system-images

   # Install API 34 system image
   $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a"

   # Create new AVD with API 34
   avdmanager create avd -n Pixel_API_34 -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_6

   # Run tests on API 34 emulator
   maestro test .maestro
   ```

3. **Wait for Maestro to add API 35 support**
   - Track progress on [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
   - API 35 (Android 16) is still in Developer Preview

## Test Files

- `bible-reading-flow.yaml` - Critical path for Bible reading
- `chapter-navigation-flow.yaml` - Chapter navigation tests
- `swipe-navigation-*.yaml` - Comprehensive swipe gesture tests
- `skeleton-flash-*.yaml` - Loading skeleton tests
- `by-line-*.yaml` - Line-by-line content tests
- `wip/` - Work-in-progress tests not yet enabled

## Troubleshooting

### Maestro Version
Ensure you have the latest version:
```bash
maestro --version  # Should be 2.0.8 or higher
curl -Ls "https://get.maestro.mobile.dev" | bash  # Upgrade if needed
```

### Android Connectivity Issues
1. Check Android emulator is running: `adb devices`
2. Check Android API level: `adb shell getprop ro.build.version.sdk`
3. If API 35, see workarounds above

### Test Syntax Errors
- Maestro 2.x uses simplified scroll syntax: use `scroll` or `scrollUp` instead of `scroll: { direction: DOWN }`
- Always check [Maestro documentation](https://maestro.mobile.dev/api-reference/commands) for latest syntax

## CI/CD Integration

For continuous integration, use iOS as the primary E2E testing platform until Android API 35 support is added to Maestro.

## Recent Changes

- **2025-11-03**: Fixed scroll command syntax for Maestro 2.x compatibility
- **2025-11-03**: Documented Android API 35 limitation
- **2025-11-03**: Upgraded Maestro to 2.0.8
