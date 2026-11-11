import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useRatingPrompt } from '@/hooks/bible/use-rating-prompt';
import { setRatingPromptHold, useRatingPromptBlocker } from '@/lib/rating-prompt/blockers';
import * as controller from '@/lib/rating-prompt/controller';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/lib/rating-prompt/controller', () => ({
  isRatingPromptEnabled: jest.fn(() => true),
  noteChapterOpened: jest.fn(() => Promise.resolve()),
  isFifthDayPending: jest.fn(() => false),
  requestRating: jest.fn(() => Promise.resolve('requested')),
}));

const requestRating = controller.requestRating as jest.Mock;
const isFifthDayPending = controller.isFifthDayPending as jest.Mock;
const noteChapterOpened = controller.noteChapterOpened as jest.Mock;
const appStateListeners: ((state: string) => void)[] = [];

type Chapter = { bookId: number; chapterNumber: number };

function renderPrompt(chapter: Chapter = { bookId: 43, chapterNumber: 3 }) {
  return renderHook(
    ({ bookId, chapterNumber }: Chapter) => useRatingPrompt(bookId, chapterNumber),
    { initialProps: chapter }
  );
}

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

function setAppState(state: 'active' | 'background') {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
  act(() => {
    for (const listener of appStateListeners) listener(state);
  });
}

describe('useRatingPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocused = true;
    appStateListeners.length = 0;
    (AppState.addEventListener as jest.Mock).mockImplementation((_type, listener) => {
      appStateListeners.push(listener);
      return {
        remove: () => appStateListeners.splice(appStateListeners.indexOf(listener), 1),
      };
    });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    requestRating.mockClear();
    noteChapterOpened.mockClear();
    isFifthDayPending.mockReturnValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks when the end comes into view after 60 seconds of reading', () => {
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
    expect(requestRating).toHaveBeenCalledTimes(1);
  });

  it('does not count an end reached while skimming, even when the reader stays', () => {
    const { result } = renderPrompt();
    advance(20_000);
    act(() => result.current.onReaderScroll(true));
    advance(120_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('counts the end reached again after 60 seconds', () => {
    const { result } = renderPrompt();
    advance(20_000);
    act(() => result.current.onReaderScroll(true));
    advance(50_000);
    act(() => result.current.onReaderScroll(false));
    act(() => result.current.onReaderScroll(true));
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('counts only foreground time', () => {
    const { result } = renderPrompt();
    advance(30_000);
    setAppState('background');
    advance(600_000);
    setAppState('active');
    advance(10_000);
    act(() => result.current.onReaderScroll(true));
    advance(5_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('counts a chapter that fits on screen once 60 seconds pass', () => {
    const { result } = renderPrompt();
    act(() => result.current.onChapterFitsScreen(43, 3, true));
    advance(59_000);
    expect(requestRating).not.toHaveBeenCalled();
    advance(5_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('keeps a fit report sent just before the swipe that opens the chapter', () => {
    const { result, rerender } = renderPrompt({ bookId: 19, chapterNumber: 116 });
    act(() => result.current.onChapterFitsScreen(19, 117, true));
    rerender({ bookId: 19, chapterNumber: 117 });
    advance(64_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('forgets a fit once the chapter is measured as longer than the screen', () => {
    const { result } = renderPrompt();
    act(() => result.current.onChapterFitsScreen(43, 3, true));
    act(() => result.current.onChapterFitsScreen(43, 3, false));
    advance(70_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('tracks the end of each pane on its own', () => {
    const { result } = renderPrompt();
    advance(30_000);
    act(() => result.current.onReaderScroll(true, 'insight'));
    advance(90_000);
    act(() => result.current.onReaderScroll(true, 'bible'));
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('lets a hold whose end was lost expire', () => {
    const { result } = renderPrompt();
    advance(70_000);
    setRatingPromptHold('test-lost-end', true);
    act(() => result.current.onReaderScroll(true));
    advance(5_000);
    expect(requestRating).not.toHaveBeenCalled();
    advance(10_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('drops a finished-chapter request when the reader moves to the next chapter', () => {
    const { result, rerender } = renderPrompt();
    advance(70_000);
    setRatingPromptHold('test-swipe', true);
    act(() => result.current.onReaderScroll(true));
    rerender({ bookId: 43, chapterNumber: 4 });
    setRatingPromptHold('test-swipe', false);
    advance(10_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('waits while the reader is still scrolling or swiping', () => {
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    setRatingPromptHold('test-drag', true);
    advance(8_000);
    expect(requestRating).not.toHaveBeenCalled();
    setRatingPromptHold('test-drag', false);
    advance(1_000);
    expect(requestRating).not.toHaveBeenCalled();
    advance(3_000);
    expect(requestRating).toHaveBeenCalledTimes(1);
  });

  it('waits until every open overlay has closed', () => {
    const first = renderHook(({ open }: { open: boolean }) => useRatingPromptBlocker(open), {
      initialProps: { open: true },
    });
    const second = renderHook(({ open }: { open: boolean }) => useRatingPromptBlocker(open), {
      initialProps: { open: true },
    });
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    first.rerender({ open: false });
    advance(10_000);
    expect(requestRating).not.toHaveBeenCalled();
    second.rerender({ open: false });
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('finished_chapter');
  });

  it('does not ask while the chapter screen is covered by another screen', () => {
    mockFocused = false;
    const { result } = renderPrompt();
    advance(70_000);
    act(() => result.current.onReaderScroll(true));
    advance(10_000);
    expect(requestRating).not.toHaveBeenCalled();
  });

  it('counts a reading day on every chapter opened and on returning to the app', () => {
    const { rerender } = renderPrompt();
    rerender({ bookId: 43, chapterNumber: 4 });
    expect(noteChapterOpened).toHaveBeenCalledTimes(2);
    setAppState('background');
    setAppState('active');
    expect(noteChapterOpened).toHaveBeenCalledTimes(3);
  });

  it('asks for the fifth reading day once the chapter is calm', () => {
    isFifthDayPending.mockReturnValue(true);
    renderPrompt();
    advance(3_000);
    expect(requestRating).toHaveBeenCalledWith('fifth_reading_day');
  });

  it('does nothing where the prompt is off', () => {
    (controller.isRatingPromptEnabled as jest.Mock).mockReturnValueOnce(false);
    isFifthDayPending.mockReturnValue(true);
    renderPrompt();
    advance(10_000);
    expect(noteChapterOpened).not.toHaveBeenCalled();
    expect(requestRating).not.toHaveBeenCalled();
  });
});
