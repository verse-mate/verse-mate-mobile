/**
 * A chapter-picker jump must replace the page on screen, not just the header.
 *
 * Reported from the App Store build (iPad, also reproducible on a phone): "new app sometimes
 * doesn't transition to book after selection in search", with a screenshot of the header reading
 * Amos 1 over Matthew 2, and "swiping left/right fixes".
 *
 * Mechanism: a jump to a chapter the pager has never resolved re-bases its index space — the
 * chapter map is rewritten so the target sits at index 0. The mounted page list was a memo keyed on
 * `index`, so when the pager was ALREADY at index 0 (nothing swiped since it mounted or since the
 * previous jump) the memo returned the old pages, and the re-render the re-base forced drew them
 * again. A swipe moves `index`, which recomputes the memo — hence "swiping fixes".
 *
 * "Sometimes", because the screen remounts the pager whenever the target chapter is not cached
 * yet (it shows its loading skeleton first), and a remount seeds the right chapter. Only a jump to
 * a chapter already in the query cache keeps this pager instance and reaches the re-base.
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GestureChapterPager } from '@/components/bible/GestureChapterPager';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

type Nav = { seq: number; bookId: number; chapterNumber: number } | null;

const renderPage = (bookId: number, chapterNumber: number) => (
  <Text testID={`page-${bookId}-${chapterNumber}`}>{`${bookId}:${chapterNumber}`}</Text>
);

function pager(externalNav: Nav, route: { bookId: number; chapterNumber: number }) {
  return (
    <GestureChapterPager
      bookId={route.bookId}
      chapterNumber={route.chapterNumber}
      seedBookId={40}
      seedChapterNumber={2}
      bookName=""
      booksMetadata={mockTestamentBooks}
      externalNav={externalNav}
      onChapterChange={jest.fn()}
      renderChapterPage={renderPage}
    />
  );
}

describe('GestureChapterPager external jumps', () => {
  it('shows the picked chapter when the pager has not been swiped since it mounted', () => {
    const { rerender } = render(pager(null, { bookId: 40, chapterNumber: 2 }));
    expect(screen.getByTestId('page-40-2')).toBeTruthy();

    rerender(pager({ seq: 1, bookId: 30, chapterNumber: 1 }, { bookId: 30, chapterNumber: 1 }));

    expect(screen.getByTestId('page-30-1')).toBeTruthy();
    expect(screen.queryByTestId('page-40-2')).toBeNull();
  });

  it('follows two picks in a row with no swipe between them', () => {
    const { rerender } = render(pager(null, { bookId: 40, chapterNumber: 2 }));
    rerender(pager({ seq: 1, bookId: 30, chapterNumber: 1 }, { bookId: 30, chapterNumber: 1 }));
    rerender(pager({ seq: 2, bookId: 40, chapterNumber: 25 }, { bookId: 40, chapterNumber: 25 }));

    expect(screen.getByTestId('page-40-25')).toBeTruthy();
    expect(screen.queryByTestId('page-30-1')).toBeNull();
  });

  it('mounts the new neighbours, so a swipe from the picked chapter has a page to land on', () => {
    const { rerender } = render(pager(null, { bookId: 40, chapterNumber: 2 }));
    rerender(pager({ seq: 1, bookId: 30, chapterNumber: 2 }, { bookId: 30, chapterNumber: 2 }));

    expect(screen.getByTestId('page-30-1')).toBeTruthy();
    expect(screen.getByTestId('page-30-3')).toBeTruthy();
    expect(screen.queryByTestId('page-40-1')).toBeNull();
    expect(screen.queryByTestId('page-40-3')).toBeNull();
  });
});
