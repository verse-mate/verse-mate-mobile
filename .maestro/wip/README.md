# Work in Progress (WIP) Maestro Flows

This directory contains E2E test flows for features that are not yet fully implemented in the app.

## Flows in this directory

### ai-explanation-flow.yaml
Tests AI-powered verse explanation feature. Currently expects old app structure with daily verse cards.
**Status**: Feature partially implemented, needs flow updates to match current chapter-based navigation.

### deep-linking-flow.yaml
Tests deep link navigation to specific chapters (versemate://bible/book/chapter URLs).
**Status**: Needs verification - test was taking too long to complete, may need URL scheme configuration or flow optimization.

### navigation-modal-flow.yaml
Tests book and chapter selection through navigation modal.
**Status**: Navigation modal UI not yet implemented (missing `navigation-button` testID).

### offline-mode-flow.yaml
Tests offline functionality and error handling.
**Status**: Uses Android ADB commands for airplane mode simulation. Needs iOS-compatible implementation or device-agnostic approach.

## Moving flows back to main directory

When a feature is fully implemented:
1. Update the flow to match current app structure
2. Test the flow to ensure it passes
3. Move it back to `.maestro/` directory
4. Update this README

## Running WIP flows

To test WIP flows during development:
```bash
maestro test .maestro/wip/
```

To run only implemented flows (for CI/CD):
```bash
maestro test .maestro/*.yaml
```
