import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';
import { BibleExplanationsPanel } from '@/components/bible/BibleExplanationsPanel';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { resetCachedLanguage } from '@/hooks/use-preferred-language';
import { useBibleByLine, useBibleSummary } from '@/src/api';

jest.mock('@/src/api', () => ({
  useBibleSummary: jest.fn(() => ({ data: null, isLoading: false, isPending: false })),
  useBibleByLine: jest.fn(() => ({ data: null, isLoading: false, isPending: false })),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: null, isAuthenticated: false, isLoading: false })),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: jest.fn(({ children }) => children),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@/components/bible/StudyPanel', () => ({ StudyPanel: () => null }));
jest.mock('@/components/bible/AudioInlineEntry', () => ({ AudioInlineEntry: () => null }));
jest.mock('@/components/bible/ShareButton', () => ({ ShareButton: () => null }));

const mockUseBibleSummary = useBibleSummary as jest.MockedFunction<typeof useBibleSummary>;
const mockUseBibleByLine = useBibleByLine as jest.MockedFunction<typeof useBibleByLine>;

describe('BibleExplanationsPanel language', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetCachedLanguage();
    await AsyncStorage.clear();
  });

  it('asks for explanations in the language a signed-out reader picked', async () => {
    await AsyncStorage.setItem('@versemate:preferred_language', 'pt-BR');

    render(
      <ThemeProvider>
        <BibleExplanationsPanel
          bookId={1}
          chapterNumber={1}
          bookName="Genesis"
          activeTab="summary"
          onTabChange={jest.fn()}
        />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(mockUseBibleSummary).toHaveBeenLastCalledWith(
        1,
        1,
        expect.anything(),
        expect.objectContaining({ language: 'pt-BR' })
      );
    });
    expect(mockUseBibleByLine).toHaveBeenLastCalledWith(
      1,
      1,
      expect.anything(),
      expect.objectContaining({ language: 'pt-BR' })
    );
  });
});
