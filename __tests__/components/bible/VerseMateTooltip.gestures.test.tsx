/**
 * VerseMateTooltip: which touches the sheet takes from its scrolling body.
 */
import { render, screen } from '@testing-library/react-native';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
  AnalyticsEvent: new Proxy({}, { get: (_, key) => key }),
}));
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: 'NASB1995' }),
}));
jest.mock('@/hooks/use-device-info', () => ({
  useDeviceInfo: () => ({ isTablet: false, useSplitView: false }),
}));
jest.mock('@/hooks/use-preferred-language', () => ({
  usePreferredLanguage: () => 'en',
}));
jest.mock('@/src/api', () => ({
  useBibleByLine: () => ({ data: undefined, isLoading: false }),
}));
jest.mock('@/components/bible/SignInModal', () => () => null);
jest.mock('@/components/bible/SignUpModal', () => () => null);
jest.mock('@/components/bible/DeleteConfirmationModal', () => ({
  DeleteConfirmationModal: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const touch = { nativeEvent: { touches: [{}], changedTouches: [{}] }, touchHistory: {} };

function renderSheet() {
  render(
    <ThemeProvider>
      <VerseMateTooltip
        source="scroll_to_verse"
        visible
        verseNumber={2}
        highlightGroup={null}
        bookId={40}
        chapterNumber={3}
        bookName="Matthew"
        verseText="Repent, for the kingdom of heaven is at hand."
        onClose={jest.fn()}
        isLoggedIn={false}
      />
    </ThemeProvider>
  );
}

describe('VerseMateTooltip gestures', () => {
  it('leaves a touch on the body to the analysis scroll', () => {
    renderSheet();
    const sheet = screen.getByTestId('verse-insight-sheet');
    expect(sheet.props.onStartShouldSetResponder?.(touch) ?? false).toBe(false);
  });

  it('takes a touch on the header, so dragging it still closes the sheet', () => {
    renderSheet();
    const header = screen.getByTestId('verse-insight-sheet-header');
    expect(header.props.onStartShouldSetResponder(touch)).toBe(true);
  });
});
