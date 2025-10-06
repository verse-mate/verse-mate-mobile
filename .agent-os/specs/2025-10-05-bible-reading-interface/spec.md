# Spec Requirements Document

> Spec: Bible Reading Interface
> Created: 2025-09-27
> Status: Planning

## Overview

Implement a comprehensive Bible reading interface for the VerseMate mobile app that allows users to navigate through testaments, books, and chapters with an intuitive, mobile-optimized experience. This feature will provide the core Bible reading functionality with verse-by-verse display and smooth navigation, serving as the foundation for future AI-powered features.

## User Stories

### Testament and Book Selection

As a Bible reader, I want to toggle between Old Testament and New Testament as a filter and navigate hierarchically to specific books, so that I can quickly find the section of the Bible I want to study.

Users can access a hierarchical navigation system starting with testament toggle filter (Old/New Testament), followed by book selection within each testament. The interface displays recently read books at the top for quick access, and includes a global search functionality to find any chapter across both testaments.

### Chapter Reading Experience

As a Bible student, I want to read full chapters with inline verse numbers and complete chapter content displayed at once, so that I can study the entire chapter without pagination interruptions.

The reading interface displays the complete chapter text with inline verse numbers (superscript format), subtitle sections for context, and floating navigation controls for previous/next chapter. The entire chapter content is loaded and displayed without pagination or infinite scroll.

### Mobile-Optimized Navigation

As a mobile user, I want gesture-based navigation, floating controls, and customizable reading preferences, so that I can read comfortably on my mobile device with personalized settings.

The interface supports left/right swipe gestures for chapter navigation, floating arrow buttons for previous/next chapter, and reading preferences (font size, theme) based on the existing webapp implementation.

## Spec Scope

1. **Testament Toggle Filter** - Toggle-based filter between Old Testament and New Testament with clear visual distinction
2. **Hierarchical Book Navigation** - Book list within selected testament with global search across all chapters and recent books prioritization
3. **Complete Chapter Display** - Full chapter text with inline verse numbers, subtitles, and mobile-optimized typography (no pagination)
4. **Dual Navigation System** - Swipe gestures AND floating arrow buttons for previous/next chapter with cross-book navigation (Genesis to Malachi, Matthew to Revelation)
5. **Reading Preferences** - Font size, theme customization, and reading position persistence (per verse or scroll position)
6. **Global Chapter Search** - Text search functionality to find any chapter across both Old and New Testament
7. **Loading States** - Skeleton screen loading while fetching chapters and book data
8. **Error Handling** - Error messages with retry functionality for network failures and invalid chapters
9. **Deep Linking** - URL structure `/bible/[bookId]/[chapter]` for direct chapter access

## Out of Scope

- AI explanation integration (will be addressed in separate spec)
- User authentication/login system (will be addressed in separate spec)
- Text highlighting and annotation features
- Multiple Bible version support
- Offline download functionality
- Social sharing features
- Reading plans and bookmarks

## Expected Deliverable

1. Users can navigate from app launch to reading any Bible chapter within 3 taps/swipes
2. Chapter text displays with proper verse formatting and readable typography on all mobile screen sizes
3. Swipe navigation between chapters works smoothly with visual feedback and maintains reading position

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-27-bible-reading-interface/tasks.md
- Technical Specification: @.agent-os/specs/2025-09-27-bible-reading-interface/sub-specs/technical-spec.md