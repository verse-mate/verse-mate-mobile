# Setting Up EAS Credentials for App Store Submission

This guide explains how to configure App Store Connect credentials in EAS so they're stored securely and don't need to be in eas.json or environment variables.

## Step 1: Run the Credentials Command

```bash
eas credentials
```

## Step 2: Navigate the Interactive Menu

When prompted, select the following options:

### 1. Select Platform
```
? Select platform
❯ iOS
  Android
```
**Choose:** `iOS`

### 2. What do you want to do?
```
? What do you want to do?
❯ App Store Connect API Key: Manage your API Key
  Distribution Certificate: Manage your Distribution Certificate
  Provisioning Profile: Manage your Provisioning Profile
  Push Notification: Manage your Push Notification Key
```
**Choose:** `App Store Connect API Key: Manage your API Key`

### 3. Manage API Key
```
? App Store Connect API Key
❯ Set up a new App Store Connect API Key
  Remove App Store Connect API Key
```
**Choose:** `Set up a new App Store Connect API Key`

### 4. Provide API Key Details

You'll be prompted for:

#### Key ID
```
? App Store Connect API Key ID:
```
**Enter:** `S8SSJ2M45Q`

#### Issuer ID
```
? App Store Connect API Issuer ID:
```
**Enter:** `d899a93f-fd2e-4782-a4b5-3d6e707df447`

#### Key File Path
```
? Path to App Store Connect API Key:
```
**Enter:** `/Users/augustochaves/Downloads/AuthKey_S8SSJ2M45Q.p8`

Alternatively, you can paste the key content directly when prompted.

## Step 3: Verify Credentials Are Set

After completion, you should see:
```
✔ App Store Connect API Key configured
```

## Step 4: Test Submission (Optional)

To verify the credentials work, you can test with an existing finished build:

```bash
eas submit --platform ios --id <build-id>
```

It should now read the credentials from EAS storage automatically without needing any configuration in eas.json or environment variables!

## What This Does

- **Securely stores** your App Store Connect API Key on EAS servers
- **Encrypts** the credentials
- **Automatically uses** these credentials for all iOS submissions
- **No need** for eas.json submit configuration
- **No need** for GitHub Secrets (except EXPO_TOKEN)

## Benefits

1. **No hardcoded values** in eas.json
2. **No sensitive data** in repository
3. **Simpler CI/CD** - just needs EXPO_TOKEN
4. **Centralized management** - update credentials in one place (EAS dashboard or CLI)
5. **Team-friendly** - all team members with access to the EAS project can submit

## Notes

- These credentials are associated with your **EAS project** (`@versemate/verse-mate-mobile`)
- They apply to **all builds** for the bundle identifier `org.versemate.mobile`
- You can view/manage credentials anytime by running `eas credentials` again
- Credentials are also viewable in the EAS web dashboard
