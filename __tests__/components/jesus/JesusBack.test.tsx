/**
 * Back in the Jesus section walks the TREE, not the history.
 *
 * Operator: "back from the boy in the temple should take you back to the
 * questions category, and then from there back to the Jesus feature. If
 * however you searched for that specific entry … back should take you directly
 * to the Jesus feature."
 */
import { renderHook } from '@testing-library/react-native';
import { useJesusBack } from '@/components/jesus/JesusChrome';

const mockDispatch = jest.fn();
let mockState: { index: number; routes: { name: string }[] } | undefined;
let mockParams: { from?: string } = {};

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn() },
  useNavigation: () => ({ getState: () => mockState, dispatch: mockDispatch }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/components/bible/BibleNavigationModal', () => ({ BibleNavigationModal: () => null }));
jest.mock('@/components/bible/HamburgerMenu', () => ({ HamburgerMenu: () => null }));

const { router } = jest.requireMock('expo-router');

function stack(...names: string[]) {
  return { index: names.length - 1, routes: names.map((name) => ({ name })) };
}

/** How many screens the back press popped. */
function popped() {
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  return mockDispatch.mock.calls[0][0].payload.count;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('useJesusBack', () => {
  it('event reached through a category goes back to that category', () => {
    mockState = stack('index', 'browse/[type]', 'event/[slug]');
    renderHook(() => useJesusBack()).result.current();
    expect(popped()).toBe(1);
  });

  it('skips events opened from events — related hops do not stack up', () => {
    mockState = stack('index', 'browse/[type]', 'event/[slug]', 'event/[slug]', 'event/[slug]');
    renderHook(() => useJesusBack()).result.current();
    expect(popped()).toBe(3); // straight back to the category
  });

  it('a SEARCHED event goes straight to the hub, wherever the search was run', () => {
    mockParams = { from: 'search' };
    mockState = stack('index', 'browse/[type]', 'theme/[slug]', 'event/[slug]');
    renderHook(() => useJesusBack()).result.current();
    expect(popped()).toBe(3); // to index
  });

  it('a category goes back one page', () => {
    mockState = stack('index', 'browse/[type]');
    renderHook(() => useJesusBack()).result.current();
    expect(popped()).toBe(1);
  });

  it('the hub leaves the section', () => {
    mockState = stack('index');
    renderHook(() => useJesusBack()).result.current();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});
