/**
 * ShareButton — chapter share copy
 *
 * Locks down the i18n wiring per spec feat-humanize-share (TASK-002).
 * Press → Share.share called with the humanized body + URL + title from
 * `sharing.chapter.*` keys, no "Check out" lead.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { ShareButton } from '@/components/bible/ShareButton';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Error: 'error' },
}));

jest.mock('@/utils/sharing/generate-chapter-share-url', () => ({
  generateChapterShareUrl: jest.fn(
    (bookId: number, chapterNumber: number) =>
      `https://app.versemate.org/bible/${bookId}/${chapterNumber}`
  ),
}));

jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { CHAPTER_SHARED: 'CHAPTER_SHARED' },
  analytics: { track: jest.fn() },
}));

const renderShareButton = () =>
  render(
    <ThemeProvider>
      <ShareButton bookId={43} chapterNumber={3} bookName="John" />
    </ThemeProvider>
  );

describe('ShareButton — chapter copy (feat-humanize-share)', () => {
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: null });
  });

  afterEach(() => {
    shareSpy.mockRestore();
    Platform.OS = 'ios';
  });

  it('native: calls Share.share with humanized body + url + title', async () => {
    Platform.OS = 'ios';
    renderShareButton();

    fireEvent.press(screen.getByTestId('share-button'));

    await new Promise((r) => setTimeout(r, 0));
    expect(shareSpy).toHaveBeenCalledTimes(1);

    const arg = shareSpy.mock.calls[0][0] as { title?: string; message: string; url?: string };
    expect(arg.title).toBe('John 3');
    expect(arg.url).toBe('https://app.versemate.org/bible/43/3');
    expect(arg.message).toContain('John 3');
    expect(arg.message).toContain('https://app.versemate.org/bible/43/3');
    expect(arg.message).not.toMatch(/^Check out/i);
  });
});
