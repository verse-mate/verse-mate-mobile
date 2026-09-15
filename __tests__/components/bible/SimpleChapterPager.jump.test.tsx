/**
 * An external jump must actually move the pager.
 *
 * Reported as "sometimes I'm seeing sticking of pages after searching where the
 * title moves but not the content. I can fix by scrolling left then right again
 * and it then resets to the right page content."
 *
 * Mechanism: pages are keyed by chapter identity, so a jump from the book
 * selector replaces EVERY key at once. iOS's UIPageViewController keeps
 * presenting the view controller it already holds, and the recenter cannot
 * dislodge it because `setPageWithoutAnimation(1)` is a no-op when the pager
 * already believes it is at 1 — which is true for any jump between two
 * chapters that both have a previous. Joel 3 -> Revelation 14 is exactly that
 * shape, and is the jump in the bug report's screenshot.
 *
 * A swipe is the opposite case: it changes one key at the far edge, index 1 is
 * reused correctly, and the remount must NOT happen or the swipe timing work
 * (virtual position, dispatch queue, programmatic guard) is thrown away on
 * every step.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SimpleChapterPager } from '@/components/bible/SimpleChapterPager';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

/** How many times the native pager has been constructed. */
let mockMountCount = 0;
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | undefined;
let mockOnPageScrollStateChanged:
  | ((event: { nativeEvent: { pageScrollState: string } }) => void)
  | undefined;

jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(
    ({ children, testID, onPageSelected, onPageScrollStateChanged }: any, ref: any) => {
      mockOnPageSelected = onPageSelected;
      mockOnPageScrollStateChanged = onPageScrollStateChanged;
      // A mount is what a `key` change forces, and what re-presents the
      // children on the native side.
      React.useEffect(() => {
        mockMountCount += 1;
      }, []);

      React.useImperativeHandle(ref, () => ({
        setPage: jest.fn(),
        // Deliberately inert, mirroring the real no-op when the pager is
        // already at the requested index — the behaviour the fix works around.
        setPageWithoutAnimation: jest.fn(),
      }));

      return (
        <View testID={testID || 'pager-view'}>
          {React.Children.map(children, (child: any, index: number) => (
            <View key={`page-${index}`} testID={`pager-page-${index}`}>
              {child}
            </View>
          ))}
        </View>
      );
    }
  );
  MockPagerView.displayName = 'PagerView';
  return { __esModule: true, default: MockPagerView };
});

function TestWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

const renderPage = (bookId: number, chapter: number) => {
  const { Text } = require('react-native');
  return <Text testID={`chapter-content-${bookId}-${chapter}`}>{`${bookId}:${chapter}`}</Text>;
};

function renderPager(bookId: number, chapterNumber: number) {
  return render(
    <TestWrapper>
      <SimpleChapterPager
        bookId={bookId}
        chapterNumber={chapterNumber}
        bookName="x"
        booksMetadata={mockTestamentBooks}
        onChapterChange={jest.fn()}
        renderChapterPage={renderPage}
      />
    </TestWrapper>
  );
}

const JOEL = 29;
const REVELATION = 66;

describe('SimpleChapterPager — external navigation', () => {
  beforeEach(() => {
    mockMountCount = 0;
    mockOnPageSelected = undefined;
    mockOnPageScrollStateChanged = undefined;
  });

  it('re-presents the new chapter after a jump, not the old one', () => {
    const view = renderPager(JOEL, 3);
    expect(screen.getByTestId(`chapter-content-${JOEL}-3`)).toBeTruthy();

    // The book selector jumps to Revelation 14 — no swipe involved.
    view.rerender(
      <TestWrapper>
        <SimpleChapterPager
          bookId={REVELATION}
          chapterNumber={14}
          bookName="x"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={renderPage}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId(`chapter-content-${REVELATION}-14`)).toBeTruthy();
    expect(screen.queryByTestId(`chapter-content-${JOEL}-3`)).toBeNull();
  });

  it('remounts the native pager on a jump — both chapters having a previous', () => {
    // The case setPageWithoutAnimation cannot fix: target index is 1 before
    // and after, so the seek is a no-op and only a remount re-presents.
    renderPager(JOEL, 3);
    const afterFirstRender = mockMountCount;

    const view = renderPager(JOEL, 3);
    view.rerender(
      <TestWrapper>
        <SimpleChapterPager
          bookId={REVELATION}
          chapterNumber={14}
          bookName="x"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={renderPage}
        />
      </TestWrapper>
    );

    // One mount for the initial render, one more for the jump.
    expect(mockMountCount).toBeGreaterThan(afterFirstRender + 1);
  });

  it('does NOT remount for a chapter reached by swiping', () => {
    // A swipe changes one key at the far edge; index 1 is reused correctly and
    // remounting would discard the pager's virtual position mid-gesture.
    const view = renderPager(JOEL, 2);
    const mountsAfterInitial = mockMountCount;

    // Settle a swipe onto the next page, then let the resulting chapter commit.
    mockOnPageSelected?.({ nativeEvent: { position: 2 } });
    mockOnPageScrollStateChanged?.({ nativeEvent: { pageScrollState: 'idle' } });

    view.rerender(
      <TestWrapper>
        <SimpleChapterPager
          bookId={JOEL}
          chapterNumber={3}
          bookName="x"
          booksMetadata={mockTestamentBooks}
          onChapterChange={jest.fn()}
          renderChapterPage={renderPage}
        />
      </TestWrapper>
    );

    expect(mockMountCount).toBe(mountsAfterInitial);
  });
});
