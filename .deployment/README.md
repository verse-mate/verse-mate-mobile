# Deployment Scripts

This directory contains bash scripts used for building and deploying the VerseMate Mobile app. These scripts are used by both CI/CD (GitHub Actions) and local development to ensure consistency.

## Scripts

### `build-preview.sh`
Triggers an iOS preview build on EAS and captures the build ID.

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"
bash .deployment/build-preview.sh
```

**Output:**
- Prints build ID to stdout
- Saves build ID to `.deployment/build_id.txt`
- Exports `build_id` to `$GITHUB_OUTPUT` (if running in GitHub Actions)

### `submit-testflight.sh`
Waits for a build to complete and submits it to TestFlight.

**Usage:**
```bash
export EXPO_TOKEN="your-expo-token"
bash .deployment/submit-testflight.sh <build-id>
```

**What it does:**
1. Polls build status every 30 seconds (max 45 minutes)
2. Submits to TestFlight when build status is FINISHED
3. Uses credentials stored in EAS credentials storage (configured via `eas credentials`)

## Configuration

### EAS Credentials Storage

Apple App Store Connect credentials are stored securely in EAS credentials storage. To configure:

```bash
eas credentials
```

Follow the interactive prompts to set up your App Store Connect API Key. See [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md) for detailed instructions.

**Benefits:**
- No hardcoded values in `eas.json`
- No sensitive data in repository
- Simpler CI/CD - only needs `EXPO_TOKEN`
- Centralized management - update credentials in one place
- Automatic credential usage for all builds and submissions

### Build Profiles

The scripts rely on build configuration in `eas.json`:

- **preview**: Store distribution profile for TestFlight submission
- **production**: Store distribution profile for App Store release

## CI/CD Integration

GitHub Actions workflows use these scripts:

```yaml
- name: Build iOS Preview
  id: ios_build
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
  run: bash .deployment/build-preview.sh

- name: Submit to TestFlight
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
  run: bash .deployment/submit-testflight.sh "${{ steps.ios_build.outputs.build_id }}"
```

## Local Testing

To test the deployment flow locally:

```bash
# Ensure you've configured EAS credentials (one-time setup)
eas credentials

# Set environment variables
export EXPO_TOKEN="your-expo-token"

# Build
bash .deployment/build-preview.sh

# Submit (using build ID from previous command or provide it directly)
bash .deployment/submit-testflight.sh <build-id>
```

## Troubleshooting

### "Invalid Provisioning Profile" error
This means the build was created with `"distribution": "internal"` (Ad Hoc profile) but TestFlight requires `"distribution": "store"`. Make sure `eas.json` has `"distribution": "store"` for the profile you're building.

### "UNKNOWN" build status
The script extracts JSON from `eas build:view --json` output which includes human-readable text before the JSON. If you see "UNKNOWN" status, check that `grep -A 100 '^{'` is correctly extracting the JSON object.

### "Could not find credentials" error
Make sure you've configured EAS credentials storage by running `eas credentials` and following the setup guide in [SETUP_CREDENTIALS.md](./SETUP_CREDENTIALS.md). Credentials must be set up once per project.
