# Product Roadmap

1. [x] **Development Environment Setup** - Configure Expo project with React Native, TypeScript, Expo Router, and establish project structure with proper linting, formatting, and git hooks `M`

2. [x] **Testing Infrastructure** - Implement comprehensive testing setup with Jest, React Native Testing Library, MSW for API mocking, and Maestro for E2E testing `M`

3. [x] **Visual Reference Tooling** - Build Playwright-based automation system to capture web app screenshots and metadata for maintaining design consistency between web and mobile `M`

4. [x] **Bible Reading Discovery Phase** - Use Visual Reference Tooling to capture and analyze web app Bible reading experience, document navigation patterns, extract design system, and validate implementation assumptions `M`

5. [x] **API Integration & Data Layer** - Generate React Query hooks from Swagger spec using openapi-react-query-codegen, create MSW handlers for Bible API endpoints, implement AsyncStorage for reading position persistence, and write comprehensive API integration tests `L`

6. [ ] **Navigation Components** - Implement testament selection UI with dropdown-based book navigation, chapter selection interface, search/filter functionality, Expo Router navigation structure (/bible/[bookId]/[chapter]), and deep linking support `L`

7. [ ] **Chapter Reading Interface** - Build chapter display component with inline verse numbers, subtitle integration, validated typography and color system from web app, loading states, error handling, and reading position persistence `L`

8. [ ] **Mobile-Specific Navigation** - Add swipe gestures for chapter navigation, floating navigation controls, cross-book navigation logic, haptic feedback for interactions, and reading preferences (font size, theme) `M`

9. [ ] **AI Explanation Integration** - Connect to VerseMate AI services for chapter summaries, verse-by-verse explanations with cultural context, and implement smart content loading with caching for optimal performance `L`

10. [ ] **Multilingual Explanation Translations** - Integrate AI-powered translation service for explanations, allowing users to read explanations in their preferred language while studying the original biblical text `L`

11. [ ] **Interactive Q&A System** - Implement real-time AI chat interface for asking questions about passages, verses, or theological concepts, with context-aware responses based on current reading position `XL`

12. [ ] **Offline Download System** - Enable users to download complete books or testaments with pre-generated AI explanations, implement offline reading mode with full functionality, and add chapter search within downloaded content `XL`

> Notes
> - Items 1-5 completed as of October 2025
> - Bible Reading Interface (items 6-8) currently in development
> - Each item represents end-to-end functional and testable features
> - Testing is integrated into each feature, not a separate phase
> - Roadmap ordered by technical dependencies and user value delivery
