# VerseMate Mobile

VerseMate Mobile is a React Native application for Bible reading with AI-powered explanations. This app helps users study the Bible with summaries, line-by-line explanations, and detailed analysis.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) - Fast JavaScript runtime and package manager
- [Node.js](https://nodejs.org/) (LTS version)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator (macOS) or Android Studio (for Android development)

### Installation

1. Install dependencies with Bun:

   ```bash
   bun install
   ```

2. Start the development server:

   ```bash
   bun start
   # or
   bun run start
   ```

### Platform-Specific Development

The development server provides options to run on different platforms:

- **iOS Simulator**: `bun run ios`
- **Android Emulator**: `bun run android`
- **Web Browser**: `bun run web`
- **Expo Go**: Scan QR code with Expo Go app

You can start developing by editing files in the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun start` | Start the Expo development server |
| `bun run ios` | Start on iOS simulator |
| `bun run android` | Start on Android emulator |
| `bun run web` | Start on web browser |
| `bun run format` | Format code with Biome.js |
| `bun run lint` | Run linting (Biome + ESLint) |
| `bun run lint:fix` | Fix linting issues automatically |
| `bun run type-check` | Run TypeScript type checking |
| `bun run test` | Run tests with Bun |

## Development Workflow

### Code Quality

This project uses a comprehensive code quality setup:

- **Biome.js**: Fast formatting and core linting
- **ESLint**: React Native specific rules and platform support
- **TypeScript**: Static type checking
- **Husky**: Git hooks for pre-commit/pre-push validation
- **lint-staged**: Run linters on staged files only

### Pre-commit Hooks

The project automatically runs the following checks before commits:

1. **Biome.js**: Formats and checks code style
2. **ESLint**: Validates React Native best practices

### Pre-push Hooks

Before pushing to remote:

1. **TypeScript**: Validates all type definitions

### Testing

Tests are run with Bun's built-in test runner:

```bash
bun test
```

Test files should be placed in:
- `__tests__/` directory
- Files ending with `.test.ts` or `.test.tsx`

## Troubleshooting

### Common Issues

1. **Dependency conflicts**: Clear cache with `bun install --force`
2. **TypeScript errors**: Run `bun run type-check` to see detailed errors
3. **Linting issues**: Run `bun run lint:fix` to auto-fix issues
4. **Git hooks failing**: Check pre-commit output and fix linting/formatting

### Emergency Skip

To skip git hooks in emergencies:

```bash
git commit --no-verify -m "emergency commit"
git push --no-verify
```

**Note**: Only use `--no-verify` for critical fixes and ensure issues are resolved in follow-up commits.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and ensure all quality checks pass
3. Commit changes (pre-commit hooks will run automatically)
4. Push branch (pre-push hooks will run TypeScript check)
5. Create pull request

The CI pipeline will run all quality checks on pull requests.
