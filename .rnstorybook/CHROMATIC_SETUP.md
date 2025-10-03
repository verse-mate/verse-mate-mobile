# Chromatic Setup Instructions

Chromatic is configured but requires a project token to publish visual snapshots.

## Setup Steps

1. **Create Chromatic Account** (if not already done):
   - Visit https://www.chromatic.com/
   - Sign up with your GitHub account
   - Free tier includes 5,000 snapshots/month

2. **Create New Project**:
   - Click "Add Project"
   - Select the `verse-mate-mobile` repository
   - Copy the project token provided

3. **Set Project Token**:
   - Add to your environment:
     ```bash
     export CHROMATIC_PROJECT_TOKEN=<your-token>
     ```
   - Or create `.env` file:
     ```
     CHROMATIC_PROJECT_TOKEN=<your-token>
     ```

4. **Publish Baseline**:
   ```bash
   npm run chromatic
   ```

## CI/CD Integration

Add the token as a GitHub secret:
1. Go to repository Settings → Secrets and variables → Actions
2. Add new secret: `CHROMATIC_PROJECT_TOKEN`
3. The GitHub Actions workflow will use this automatically

## Usage

- **Publish snapshots**: `npm run chromatic`
- **Auto-accept changes**: `npm run chromatic -- --auto-accept-changes`
- **Exit with zero on changes**: `npm run chromatic -- --exit-zero-on-changes`

## Notes

- Chromatic will be triggered automatically on PRs via GitHub Actions
- Visual changes require manual approval in the Chromatic UI
- First run establishes the baseline snapshots
