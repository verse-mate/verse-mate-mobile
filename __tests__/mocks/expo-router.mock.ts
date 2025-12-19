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
