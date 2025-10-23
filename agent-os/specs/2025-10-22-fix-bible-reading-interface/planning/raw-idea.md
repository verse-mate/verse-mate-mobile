# Raw Idea: Fix Bible Reading Interface

## Feature Description
Enhancement to existing functionality that was wrongly implemented.

## Current Problem
The app currently has tabs (Summary, By Line, Detailed) that show different reading modes, but these are mixed with AI explanations. According to the UI design, there should be a toggle in the top header that switches between:
- Bible content (the actual scripture text)
- Explanations (AI-generated explanations)

The tabs (Summary, By Line, Detailed) should apply to the selected content type (either Bible text OR explanations).

## Screenshots Provided
- Image 1: Bible reading view showing Genesis 1 with verse text
- Image 2: Same chapter showing "Detailed" tab with AI explanation in Portuguese

## Goal
Fix the implementation to properly separate:
1. Content type toggle (Bible vs Explanations) - should be in header
2. Reading mode tabs (Summary, By Line, Detailed) - should apply to whichever content type is selected

## Expected Behavior
- User sees a header toggle to switch between "Bible" and "Explanations"
- When "Bible" is selected, the tabs (Summary, By Line, Detailed) show different views of the scripture text
- When "Explanations" is selected, the tabs (Summary, By Line, Detailed) show different views of AI-generated explanations
- The current mixing of content types within tabs should be eliminated
