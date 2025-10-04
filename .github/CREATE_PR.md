# Create Pull Request Instructions

This document contains instructions for creating the testing infrastructure PR.

## Quick PR Creation

### Option 1: GitHub CLI (Recommended)

```bash
gh auth login  # First time only

gh pr create \
  --title "feat: Complete testing infrastructure setup (Tasks 1-5)" \
  --body-file .github/PR_BODY.md \
  --base main
```

### Option 2: GitHub Web UI

1. Visit: https://github.com/verse-mate/verse-mate-mobile/compare/main...feat/testing-infrastructure-spec
2. Click "Create pull request"
3. Use the title and body from `.github/PR_BODY.md`

### Option 3: Direct URL

Open this URL in your browser:
```
https://github.com/verse-mate/verse-mate-mobile/compare/main...feat/testing-infrastructure-spec?expand=1
```

## PR Details

**Title:**
```
feat: Complete testing infrastructure setup (Tasks 1-5)
```

**Body:** (See `.github/PR_BODY.md` for full content)

**Branch:**
- Base: `main`
- Compare: `feat/testing-infrastructure-spec`

**Labels to Add:**
- `enhancement`
- `testing`
- `infrastructure`
- `documentation`

**Reviewers:**
- Request review from team members

## After PR Creation

### Step 1: Verify Workflow Runs

Check the Actions tab to ensure all jobs execute:
- ✅ Jest Unit & Integration Tests
- ✅ Chromatic Visual Regression
- ✅ Test Results Summary

### Step 2: Review Status Checks

Status checks should appear at the bottom of the PR:
- All required checks must pass before merge is allowed
- Coverage comment should be posted

### Step 3: Configure Secrets (if not already done)

1. Go to repository **Settings → Secrets and variables → Actions**
2. Add `CHROMATIC_PROJECT_TOKEN`:
   - Get token from https://www.chromatic.com/
   - Create/select VerseMate project
   - Copy project token
   - Add as repository secret

3. (Optional) Add `CODECOV_TOKEN`:
   - Get token from https://codecov.io/
   - Add repository
   - Copy upload token
   - Add as repository secret

### Step 4: Configure Branch Protection

After first workflow run, configure branch protection:

1. Go to **Settings → Branches → Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require conversation resolution
4. Add required status checks:
   - `Jest Unit & Integration Tests`
   - `Test Results Summary`

See `.github/BRANCH_PROTECTION_SETUP.md` for complete instructions.

### Step 5: Review PR

1. Review all changed files
2. Check that CI/CD workflow runs successfully
3. Verify coverage report is posted
4. Ensure Chromatic build completes

### Step 6: Merge

Once approved and all checks pass:
1. Squash and merge (recommended) or merge commit
2. Delete the feature branch
3. Verify `main` branch is healthy after merge

## Testing the Workflow

### Expected Results:

1. **Type Check** - Should pass ✅
2. **Lint** - Should pass ✅
3. **Jest Tests** - Should pass (48/48) ✅
4. **Coverage Report** - Posted as PR comment
5. **Chromatic** - Build uploaded (may have visual changes)
6. **Test Summary** - Should pass ✅

### If Workflow Fails:

Check the Actions tab for error logs:

**Common Issues:**

1. **Type Check Failure**:
   ```bash
   npm run type-check  # Fix locally
   ```

2. **Lint Failure**:
   ```bash
   npm run lint:fix  # Auto-fix
   ```

3. **Test Failure**:
   ```bash
   npm test  # Run locally
   ```

4. **Chromatic Missing Token**:
   - Add `CHROMATIC_PROJECT_TOKEN` secret (see Step 3 above)

## Post-Merge Actions

After PR is merged to `main`:

1. **Delete Feature Branch**:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feat/testing-infrastructure-spec
   ```

2. **Verify Main Branch**:
   - Check Actions tab for `main` branch workflow
   - Ensure all tests pass on `main`

3. **Update Local Environment**:
   ```bash
   git pull origin main
   npm install  # Install any new dependencies
   ```

4. **Next Steps**:
   - Begin implementing app features
   - Write tests following patterns in ai-testing-standards.md
   - Aim for 80% coverage target

## Troubleshooting

### PR Creation Fails

- Ensure you have push permissions
- Check that branch exists on remote
- Verify GitHub authentication

### Workflow Doesn't Run

- Ensure `.github/workflows/test.yml` is committed
- Check workflow syntax (YAML format)
- Verify workflow triggers (pull_request to main)

### Status Checks Don't Appear

- Wait for first workflow run to complete
- Refresh PR page
- Check Actions tab for workflow execution

## Support

For issues:
- Check workflow logs in Actions tab
- See `.github/BRANCH_PROTECTION_SETUP.md`
- Review ai-testing-standards.md for test patterns
