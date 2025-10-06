# Spec Summary (Lite)

Implement a comprehensive Bible reading interface for the VerseMate mobile app that allows users to navigate through testaments, books, and chapters with an intuitive, mobile-optimized experience. The interface will provide hierarchical navigation (Testament → Book → Chapter), verse-by-verse text display with proper formatting, and gesture-based navigation with swipe controls for seamless chapter transitions.

## Implementation Approach

**⚠️ CRITICAL: Discovery-First Development**

Before implementing any features, use Visual Reference Tooling to capture and analyze the web app (https://app.versemate.org). This spec contains assumptions that must be validated against the real implementation.

**Discovery Phase**:
1. Capture web app Bible reading journeys to understand real navigation patterns
2. Extract actual design system (colors, typography, spacing) from computed styles
3. Validate all architectural assumptions below against real web app implementation
4. Document findings and plan mobile-specific adaptations

## Key Technical Highlights (ASSUMPTIONS - VALIDATE FIRST)

- **Enhanced Cross-Book Navigation**: Seamless transitions between books (Genesis→Exodus, Malachi→Matthew) - **VALIDATE if web app has this**
- **Dual Navigation System**: Both gesture-based swiping AND floating button controls - **VALIDATE web app patterns, plan mobile enhancements**
- **Complete Chapter Display**: Full chapter content without pagination - **VALIDATE web app display pattern**
- **Testament Filter with Global Search**: Toggle-based testament filtering with universal search - **VALIDATE navigation UI pattern**
- **Mobile-First Design**: React Native implementation maintaining web app design consistency - **EXTRACT real values via Visual Reference Tooling**
- **Smart Loading & Error Handling**: Skeleton screens and retry functionality - **VALIDATE web app loading/error patterns**
- **Visual Reference Tooling**: AI-powered screenshot capture to discover web app patterns and extract design system