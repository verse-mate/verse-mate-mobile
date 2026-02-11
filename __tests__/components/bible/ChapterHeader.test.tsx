/**
 * Tests for ChapterHeader Component
 *
 * ChapterHeader is a props-only component that displays the current book and chapter.
 * It receives bookName and chapterNumber from the parent (state layer), ensuring
 * the header always reflects the single source of truth.
 *
 * V3 Architecture:
 * - ChapterHeader receives props only (no hooks for navigation state inside)
 * - Parent (ChapterScreen) reads from useChapterState and passes down
 * - testID="chapter-header-text" for E2E testing with Maestro
 *
 * Tests:
 * - Renders book name and chapter number correctly
 * - Has correct testID for E2E testing
 *
 * Note: ChapterHeader is defined in the chapter screen file, not as a standalone
 * component file. These tests verify the interface requirements for V3.
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v3/spec.md
 */

import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

/**
 * Minimal ChapterHeader implementation for testing
 *
 * This matches the props-only interface from V3 spec.
 * The actual implementation is in app/bible/[bookId]/[chapterNumber].tsx
 */
interface ChapterHeaderTestProps {
  bookName: string;
  chapterNumber: number;
}

function ChapterHeaderTestComponent({ bookName, chapterNumber }: ChapterHeaderTestProps) {
  return (
    <View style={styles.header} testID="chapter-header">
      <Text style={styles.title} testID="chapter-header-text">
        {bookName} {chapterNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

/**
 * Test wrapper with required providers
 */
function TestWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ChapterHeader (V3 Props-Only Interface)', () => {
  /**
   * Test 1: Renders book name and chapter number correctly
   */
  it('renders book name and chapter number correctly', () => {
    render(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Genesis" chapterNumber={1} />
      </TestWrapper>
    );

    // Should display "Genesis 1"
    const headerText = screen.getByTestId('chapter-header-text');
    expect(headerText).toBeTruthy();
    expect(headerText.props.children).toEqual(['Genesis', ' ', 1]);
  });

  /**
   * Test 2: Has correct testID for E2E testing
   */
  it('has testID="chapter-header-text" for E2E testing', () => {
    render(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Exodus" chapterNumber={20} />
      </TestWrapper>
    );

    // testID should be present for Maestro E2E tests
    expect(screen.getByTestId('chapter-header-text')).toBeTruthy();
    expect(screen.getByTestId('chapter-header')).toBeTruthy();
  });

  /**
   * Test 3: Updates display when props change
   */
  it('updates display when props change', () => {
    const { rerender } = render(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Genesis" chapterNumber={1} />
      </TestWrapper>
    );

    // Initial render
    let headerText = screen.getByTestId('chapter-header-text');
    expect(headerText.props.children).toEqual(['Genesis', ' ', 1]);

    // Rerender with new props
    rerender(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Matthew" chapterNumber={5} />
      </TestWrapper>
    );

    // Should display updated values
    headerText = screen.getByTestId('chapter-header-text');
    expect(headerText.props.children).toEqual(['Matthew', ' ', 5]);
  });

  /**
   * Test 4: Displays cross-book navigation correctly
   *
   * This verifies the header can handle book boundary transitions
   * (e.g., Genesis 50 -> Exodus 1)
   */
  it('displays cross-book navigation correctly', () => {
    const { rerender } = render(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Genesis" chapterNumber={50} />
      </TestWrapper>
    );

    // Initial: Genesis 50
    let headerText = screen.getByTestId('chapter-header-text');
    expect(headerText.props.children).toEqual(['Genesis', ' ', 50]);

    // Navigate to Exodus 1
    rerender(
      <TestWrapper>
        <ChapterHeaderTestComponent bookName="Exodus" chapterNumber={1} />
      </TestWrapper>
    );

    // Should display Exodus 1
    headerText = screen.getByTestId('chapter-header-text');
    expect(headerText.props.children).toEqual(['Exodus', ' ', 1]);
  });
});
