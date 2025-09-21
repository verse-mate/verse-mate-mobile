# GitHub Actions Specification

This is the GitHub Actions workflow specification for the spec detailed in @.agent-os/specs/2025-09-21-project-dev-setup/spec.md

> Created: 2025-09-21
> Version: 1.0.0

## Workflow Overview

### CI/CD Pipeline Goals
- **Quality Gate**: Prevent merging of code that fails linting, type checking, or tests
- **Fast Feedback**: Provide quick validation results to developers
- **Consistency**: Ensure same validation environment as local development
- **Reliability**: Stable, reproducible builds across all pull requests

## Workflow Configuration

### Primary Workflow: .github/workflows/ci.yml

#### Trigger Events
```yaml
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
  workflow_dispatch: # Manual trigger for debugging
```

#### Job: Quality Checks
- **Runner**: ubuntu-latest (fastest and most cost-effective)
- **Runtime**: Bun latest (for fast dependency installation and testing)
- **Cache Strategy**: Bun cache for faster dependency installation

#### Step-by-Step Workflow

1. **Checkout Code**
   - Action: actions/checkout@v4
   - Deep clone: false (shallow clone for speed)
   - Fetch depth: 1 (minimal history needed)

2. **Setup Bun**
   - Action: oven-sh/setup-bun@v1
   - Version: latest
   - Cache: Bun dependencies for faster subsequent runs

3. **Install Dependencies**
   - Command: bun install --frozen-lockfile
   - Rationale: frozen lockfile for reproducible, faster installs in CI environment

4. **Type Checking**
   - Command: bun tsc --noEmit
   - Purpose: Validate TypeScript compilation without output files
   - Fail Fast: Stop pipeline if TypeScript errors detected

5. **Biome Format and Lint Check**
   - Command: bun biome ci
   - Purpose: Fast formatting validation and core linting rules
   - Output: Detailed report of any formatting or core linting issues

6. **ESLint React Native Check**
   - Command: bun eslint .
   - Purpose: React Native/Expo specific linting rules
   - Output: Platform-specific rule violations and React Native best practices

7. **Run Tests**
   - Command: bun test
   - Environment: CI=true (enables CI-optimized test reporting)
   - Coverage: Basic coverage reporting included

### Conditional Jobs

#### Security Scanning (Future Enhancement)
- **Trigger**: On main branch pushes only
- **Tools**: bun audit for dependency vulnerabilities
- **Action**: Fail build on high/critical vulnerabilities

#### Performance Monitoring (Future Enhancement)
- **Bundle Size Analysis**: Track and report bundle size changes
- **Trigger**: On pull requests that modify source code
- **Threshold**: Fail if bundle size increases by >10%

## Error Handling and Reporting

### Failure Scenarios
1. **TypeScript Errors**: Clear error messages with file locations and error descriptions
2. **Biome Failures**: Detailed Biome.js output showing formatting and core linting violations
3. **ESLint Failures**: React Native/Expo specific rule violations with suggested fixes
4. **Test Failures**: Bun test output with failing test descriptions and stack traces
5. **Dependency Issues**: bun install failures with specific package resolution errors

### Success Criteria
- All TypeScript files compile without errors
- All files pass Biome.js formatting and core linting checks
- All files pass ESLint React Native/Expo specific rules
- All Bun tests pass with no test failures
- No high-severity dependency vulnerabilities detected

### Notification Strategy
- **Pull Request Comments**: Automated bot comments with failure details
- **Status Checks**: GitHub status checks prevent merging failed builds
- **Email Notifications**: Team notifications for main branch failures

## Performance Optimization

### Caching Strategy
```yaml
- name: Cache Bun dependencies
  uses: actions/cache@v3
  with:
    path: ~/.bun
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
    restore-keys: |
      ${{ runner.os }}-bun-
```

### Parallel Job Execution
- **Matrix Strategy**: Test across multiple Bun versions if needed
- **Job Dependencies**: Optimize job order for fastest feedback
- **Resource Allocation**: Balance speed vs. cost for GitHub Actions minutes

### Build Time Targets
- **Total Pipeline Time**: < 5 minutes for standard pull requests
- **Cache Hit Ratio**: > 90% for dependency installation
- **Test Execution**: < 2 minutes for current test suite

## Security Considerations

### Secrets Management
- **No Secrets Required**: Current workflow uses only public actions and commands
- **Token Permissions**: Minimal required permissions for GitHub token
- **Dependency Security**: Regular updates of GitHub Actions versions

### Access Control
- **Branch Protection**: Require status checks before merging
- **Required Reviews**: Maintain code review requirements alongside automated checks
- **Admin Override**: Allow repository admins to bypass checks for emergency fixes

## Monitoring and Maintenance

### Workflow Health Metrics
- **Success Rate**: Track percentage of successful builds over time
- **Average Duration**: Monitor build time trends
- **Failure Patterns**: Identify common failure causes for process improvement

### Regular Maintenance Tasks
- **Monthly**: Update GitHub Actions to latest versions
- **Quarterly**: Review and optimize workflow performance
- **As Needed**: Adjust thresholds and add new quality checks based on team needs