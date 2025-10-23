# Raw Idea: Native Page-Based Swipe Navigation

## User Description

Implement native page-based swipe navigation for chapter navigation in the VerseMate mobile app.

Context from user: "option D looks perfect and more native"

This refers to implementing page-based navigation (like ViewPager) instead of the current ScrollView + GestureDetector approach, which is causing native crashes.

## Current Issue

- The app crashes when users swipe to navigate between Bible chapters
- Current implementation: GestureDetector wrapping a ScrollView
- The Pan gesture conflicts with scroll gestures, causing native-level crashes
- ErrorBoundary cannot catch these crashes as they're native, not JavaScript errors

## Proposed Solution

- Implement page-based navigation similar to React Native's ViewPager
- Native swipe gestures for chapter navigation (left/right)
- Smooth page transitions with proper gesture handling
- No conflicts with vertical scrolling within each chapter

## Date Initiated

2025-10-23
