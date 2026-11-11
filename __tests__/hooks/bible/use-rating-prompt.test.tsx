import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useRatingPrompt } from '@/hooks/bible/use-rating-prompt';
import { useRatingPromptBlocker } from '@/lib/rating-prompt/blockers';
import * as controller from '@/lib/rating-prompt/controller';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@/lib/rating-prompt/controller', () => ({
  noteChapterOpened: jest.fn(() => Promise.resolve()),
  isFifthDayPending: jest.fn(() => false),
  requestRating: jest.fn(() => Promise.resolve('requested')),
}));

const requestRating = controller.requestRating as jest.Mock;
const isFifthDayPending = controller.isFifthDayPending as jest.Mock;

function renderPrompt(chapter = { bookId: 43, chapterNumber: 3 }) {
  return renderHook(
    ({ bookId, chapterNumber }: { bookId: number; chapterNumber: number }) =>
      useRatingPrompt(bookId, chapterNumber),
    {
      initialProps: chapter,
    }
  );
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe('useRatingPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    requestRating.mockClear();
    isFifthDayPending.mockReturnValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks after the end of a chapter is reached past 60 seconds', () => {
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
    expect(requestRating).toHaveBeenCalledTimes(1);
  });

  it('does not ask when the end is reached before 60 seconds and the chapter is left', () => {
    const { result, rerender } = renderPrompt();
    advance(20_000);
    act(() => result.current.onReaderScroll(true));
    rerender({ bookId: 43, chapterNumber: 4 });
    advance(70_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('waits while an overlay is open and asks once it closes', () => {
    const overlay = renderHook(({ open }: { open: boolean }) => useRatingPromptBlocker(open), {
      initialProps: { open: true },
    });
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    advance(10_000);
    expect(requestRating).not.toHaveBeenCalled();
    overlay.rerender({ open: false });
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('waits while the reader keeps scrolling', () => {
    const { result } = renderPrompt();
    advance(70_000);
    for (let i = 0; i < 10; i++) {
      act(() => result.current.onReaderScroll(true));
      advance(500);
    }
    expect(requestRating).not.toHaveBeenCalled();
    advance(3_000);
    expect(requestRating).toHaveBeenCalledTimes(1);
  });

  it('drops a finished-chapter request when the reader swipes to the next chapter', () => {
    const { result, rerender } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    rerender({ bookId: 43, chapterNumber: 4 });
    advance(10_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('asks for the fifth reading day once the chapter is calm', () => {
    isFifthDayPending.mockReturnValue(true);
    renderPrompt();
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('fifth_reading_day');
  });
});
