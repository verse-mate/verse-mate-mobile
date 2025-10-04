# Branch Protection Setup Guide

This document explains how to configure branch protection rules for the VerseMate mobile repository to ensure all tests pass before merging to `main`.

## Required GitHub Repository Settings

### 1. Enable Branch Protection for `main`

Navigate to: **Settings → Branches → Branch protection rules → Add rule**

**Branch name pattern**: `main`

### 2. Configure Protection Rules

Enable the following settings:

#### ✅ Require a pull request before merging
- **Required approvals**: 1 (recommended)
- **Dismiss stale pull request approvals when new commits are pushed**: ✓
- **Require review from Code Owners**: ✓ (if CODEOWNERS file exists)

#### ✅ Require status checks to pass before merging
- **Require branches to be up to date before merging**: ✓

**Required status checks** (must pass):
- `Jest Unit & Integration Tests`
- `Chromatic Visual Regression` (optional - can be made required later)
- `Test Results Summary`

#### ✅ Require conversation resolution before merging
- Ensures all PR comments are addressed before merging

#### ✅ Do not allow bypassing the above settings
- Prevents administrators from bypassing these rules (recommended for team projects)

### 3. Required GitHub Secrets

Configure the following secrets in: **Settings → Secrets and variables → Actions**

#### Repository Secrets:

1. **`CHROMATIC_PROJECT_TOKEN`**
   - Go to https://www.chromatic.com/
   - Create/select your project
   - Copy the project token
   - Add as repository secret

2. **`CODECOV_TOKEN`** (optional)
   - Go to https://codecov.io/
   - Add your repository
   - Copy the upload token
   - Add as repository secret

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions and doesn't need to be configured.

### 4. Configure Status Check Requirements

Once the first PR runs successfully, GitHub will show the available status checks. Add these as required:

1. Go to: **Settings → Branches → main → Edit**
2. Scroll to: **Require status checks to pass before merging**
3. Search for and add:
   - `Jest Unit & Integration Tests`
   - `Test Results Summary`
4. Optionally add:
   - `Chromatic Visual Regression` (can be made required once baseline is stable)

## Workflow Behavior

### On Pull Request to `main`:

1. **Type Checking** (`npm run type-check`)
   - Validates TypeScript types
   - Fails on type errors

2. **Linting** (`npm run lint`)
   - Runs Biome and ESLint
   - Fails on lint errors

3. **Jest Tests** (`npm run test:ci`)
   - Runs all unit and integration tests
   - Generates coverage report
   - **Blocks merge if tests fail** ❌

4. **Coverage Reporting**
   - Uploads to Codecov (if token configured)
   - Posts coverage comment on PR
   - **Warning if below 60%** (currently non-blocking during setup)

5. **Chromatic Visual Tests** (`npm run chromatic`)
   - Uploads Storybook to Chromatic
   - Compares visual snapshots
   - **Currently non-blocking** (can be made blocking later)

6. **Test Results Summary**
   - Aggregates all test results
   - **Blocks merge if Jest tests failed** ❌

### On Push to `main` (after merge):

- Runs same test suite to verify main branch health
- Updates Chromatic baseline snapshots
- Updates coverage reports

## Testing the Setup

### Step 1: Create a Test PR

1. Create a new branch: `git checkout -b test/ci-validation`
2. Make a small change (e.g., update README)
3. Commit and push
4. Create PR to `main`

### Step 2: Verify Workflow Runs

Check that all jobs execute:
- ✅ Jest Unit & Integration Tests
- ✅ Chromatic Visual Regression
- ✅ Test Results Summary

### Step 3: Verify Status Checks

In the PR:
- Status checks should appear at the bottom
- All required checks must pass before "Merge" button is enabled
- If any fail, "Merge" button should be disabled

### Step 4: Test Failure Scenarios

Create test branches to verify blocking behavior:

**Test failing Jest tests:**
```bash
git checkout -b test/failing-tests
# Break a test intentionally
npm test
git commit -am "test: intentionally failing test"
git push
# Create PR - should be blocked from merging
```

**Test coverage threshold:**
```bash
git checkout -b test/low-coverage
# Remove test files to drop coverage
git commit -am "test: low coverage scenario"
git push
# Create PR - should show coverage warning
```

## Troubleshooting

### Status Checks Not Appearing

1. Ensure workflow file is in `.github/workflows/test.yml`
2. Ensure workflow is committed to the branch
3. First PR may need to run once before checks appear in settings
4. Check Actions tab for workflow run status

### Workflow Failing

**Check job logs in Actions tab:**

1. **Type Check Failures**:
   - Fix TypeScript errors locally: `npm run type-check`

2. **Lint Failures**:
   - Fix linting errors: `npm run lint:fix`

3. **Test Failures**:
   - Run tests locally: `npm test`
   - Fix failing tests

4. **Coverage Issues**:
   - Check `coverage/coverage-summary.json`
   - Currently non-blocking during setup phase

5. **Chromatic Failures**:
   - Verify `CHROMATIC_PROJECT_TOKEN` secret is set
   - Check Chromatic dashboard for details
   - Currently non-blocking (`exitZeroOnChanges: true`)

### Merge Still Allowed Despite Failures

1. Verify branch protection is enabled for `main`
2. Check "Require status checks to pass" is enabled
3. Ensure status checks are added to required list
4. Check "Do not allow bypassing" is enabled

## Future Enhancements

### Phase 1: Current Setup
- ✅ Jest tests (blocking)
- ✅ Coverage reporting (warning only)
- ✅ Chromatic (non-blocking)

### Phase 2: Strict Enforcement (when app is more mature)
- Make coverage threshold blocking (60% minimum)
- Make Chromatic blocking (visual regressions must be approved)
- Add Maestro E2E tests to CI (when Cloud available)

### Phase 3: Advanced CI/CD
- Performance benchmarking
- Bundle size tracking
- Automated dependency updates
- Automated releases

## Manual Setup Steps (Required)

**These steps must be completed manually via GitHub UI:**

1. ✅ Set up branch protection rules for `main`
2. ✅ Add required status checks
3. ✅ Configure `CHROMATIC_PROJECT_TOKEN` secret
4. ⚠️ (Optional) Configure `CODECOV_TOKEN` secret
5. ✅ Test with a sample PR

## Verification Checklist

- [ ] Branch protection enabled for `main`
- [ ] Required status checks configured
- [ ] Chromatic project token added
- [ ] Test PR created and checks ran successfully
- [ ] Failing test PR blocked from merging
- [ ] Coverage comment appears on PR
- [ ] Visual regression baseline published to Chromatic

## Support

For issues with:
- **GitHub Actions**: Check workflow logs in Actions tab
- **Chromatic**: Visit https://www.chromatic.com/docs
- **Coverage Reporting**: Check lcov-reporter-action documentation
- **Branch Protection**: See GitHub docs on branch protection rules

---

**Note**: Branch protection and secrets configuration must be completed by repository administrators with appropriate permissions.
