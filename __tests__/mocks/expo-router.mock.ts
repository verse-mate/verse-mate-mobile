/**
 * Default mock configuration for expo-router
 *
 * Usage in test files:
 * ```typescript
 * jest.mock('expo-router', () => require('../../mocks/expo-router.mock').default);
 * ```
 *
 * Then customize in beforeEach:
 * ```typescript
 * import { useLocalSearchParams } from 'expo-router';
 * beforeEach(() => {
 *   (useLocalSearchParams as jest.Mock).mockReturnValue({ bookId: '1', chapterNumber: '1' });
 * });
 * ```
 */

const expoRouterMock = {
  /**
   * Real `useFocusEffect` needs a navigator; under test the screen is always
   * the focused one, so run the effect like a plain useEffect. Components that
   * publish state on focus (the reading progress bar reporting its height to
   * the audio dock) depend on this firing.
   */
  useFocusEffect: jest.fn((effect: () => undefined | (() => void)) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: this mock stands in for a hook
    require('react').useEffect(effect, [effect]);
  }),
  useNavigation: jest.fn(() => ({
    setOptions: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  })),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  },
  Link: 'Link',
  Stack: {
    Screen: 'Screen',
  },
};

export default expoRouterMock;
