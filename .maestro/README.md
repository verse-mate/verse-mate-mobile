# Maestro E2E Test Flows

This directory contains end-to-end test flows for the VerseMate mobile application using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

- Maestro CLI installed (v2.0.3+)
  ```bash
  curl -Ls "https://get.maestro.mobile.dev" | bash
  ```

- iOS Simulator or Android Emulator running
- VerseMate app built and installed on the simulator/emulator

## Available Flows

### Critical Flows

#### `bible-reading-flow.yaml`
Tests the core Bible reading user journey:
1. Launch app
2. View daily verse on home screen
3. Navigate to verse details
4. Read full verse content
5. Verify verse metadata

**Tags**: `critical`, `bible`, `reading`

#### `ai-explanation-flow.yaml`
Tests the AI-powered verse explanation feature:
1. Launch app and view a verse
2. Request AI explanation
3. Wait for AI response
4. Read explanation
5. Test translation (optional)

**Tags**: `critical`, `ai`, `explanation`

## Running Flows

### Run All Flows
```bash
npm run maestro:test
```

### Run Specific Flow
```bash
maestro test .maestro/bible-reading-flow.yaml
```

### Run on Specific Device

**iOS:**
```bash
npm run maestro:test:ios
# or
maestro test .maestro/bible-reading-flow.yaml --device "iPhone 15"
```

**Android:**
```bash
npm run maestro:test:android
# or
maestro test .maestro/bible-reading-flow.yaml --device emulator-5554
```

### Interactive Mode (Maestro Studio)
```bash
npm run maestro:studio
```

## Important Notes

### Current Status

⚠️ **Flows are ready but require app implementation to execute successfully.**

These Maestro flows are written based on the planned VerseMate app architecture and UI design. They will work once the following components are implemented:

**Required for `bible-reading-flow.yaml`:**
- [ ] Home screen with daily verse card (testID: `daily-verse-card`)
- [ ] Verse detail screen
- [ ] Verse text display (testID: `verse-text`)
- [ ] Verse reference (testID: `verse-reference`)
- [ ] Translation badge (testID: `translation-badge`)
- [ ] Back button navigation (testID: `back-button`)

**Required for `ai-explanation-flow.yaml`:**
- [ ] Verse detail screen
- [ ] "Get AI Explanation" button (testID: `ai-explanation-button`)
- [ ] Loading state for AI generation
- [ ] AI explanation content display (testID: `ai-explanation-content`)
- [ ] Translation language selector (testID: `translation-language-select`) - optional
- [ ] Share button (testID: `share-explanation-button`) - optional

### Running Tests Before Implementation

To validate flow syntax without a running app, you can:

1. **Check YAML syntax:**
   ```bash
   # Use any YAML validator
   yamllint .maestro/bible-reading-flow.yaml
   ```

2. **Review flow structure:**
   Open the flow files in your editor and verify the logic matches the intended user journey.

3. **Use Maestro Studio:**
   ```bash
   maestro studio
   ```
   This will help you design and refine flows interactively once the app is ready.

## Element Identification Strategy

All flows use `testID` attributes for reliable element selection. When implementing components, ensure you add `testID` props:

```tsx
// Example: Button component
<TouchableOpacity testID="ai-explanation-button">
  <Text>Get AI Explanation</Text>
</TouchableOpacity>

// Example: View component
<View testID="daily-verse-card">
  <Text testID="verse-reference">John 3:16</Text>
  <Text testID="verse-text">For God so loved the world...</Text>
</View>
```

## Flow Conventions

- **Naming**: `[feature-name]-flow.yaml`
- **testID naming**: `kebab-case` (e.g., `daily-verse-card`, `ai-explanation-button`)
- **Tags**: Use `critical` for must-pass flows, feature tags for organization
- **Comments**: Every step should have a descriptive comment explaining user intent
- **State**: Always use `clearState: true` in `launchApp` for consistency

## Accessibility Testing

All flows include accessibility assertions using `traits`:
- `button` - Interactive buttons
- `text` - Text content
- `header` - Headings/titles

Example:
```yaml
- assertVisible:
    id: "verse-text"
    traits: ["text"]
```

## Debugging Tips

### Element Not Found
```bash
# View app hierarchy to find correct element IDs
maestro hierarchy
```

### Flow Execution Issues
```bash
# Run with debug output
maestro test flow.yaml --debug-output ./debug
```

### Interactive Development
```bash
# Use Maestro Studio to test interactions
maestro studio
```

## Future Enhancements

Once the app is implemented and flows are passing:

1. **Add More Flows:**
   - Verse search
   - Memorization features
   - Settings configuration
   - Offline mode

2. **CI/CD Integration:**
   - Run flows on every PR
   - Block merge if critical flows fail
   - Generate execution recordings

3. **Performance Testing:**
   - Measure load times
   - Test with slow network conditions

## Documentation

For more details on writing Maestro flows, see:
- **AI Testing Standards**: `@.agent-os/specs/2025-10-03-testing-infrastructure/sub-specs/ai-testing-standards.md`
- **Official Docs**: https://maestro.mobile.dev/

## Contributing

When adding new flows:
1. Follow the naming convention: `[feature-name]-flow.yaml`
2. Add descriptive comments for each step
3. Tag appropriately (`critical`, feature tags)
4. Use `testID` for element selection
5. Include accessibility assertions
6. Test on both iOS and Android when possible
