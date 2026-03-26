/**
 * Tests for PagerView web shim
 *
 * Verifies the ScrollView-based PagerView replacement provides
 * the same API surface as react-native-pager-view.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { createRef } from 'react';
import { Text, View } from 'react-native';

// Import the web implementation directly
import PagerViewWeb from '@/components/common/PagerView.web';

// Mock useWindowDimensions to return a consistent width
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

function renderPages(
  props: Partial<React.ComponentProps<typeof PagerViewWeb>> = {},
  ref?: React.Ref<any>
) {
  return render(
    <PagerViewWeb ref={ref} testID="pager" style={{ flex: 1 }} {...props}>
      <View testID="page-0">
        <Text>Page 0</Text>
      </View>
      <View testID="page-1">
        <Text>Page 1</Text>
      </View>
      <View testID="page-2">
        <Text>Page 2</Text>
      </View>
    </PagerViewWeb>
  );
}

describe('PagerView.web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders all children wrapped in width-sized Views', () => {
    renderPages();

    expect(screen.getByText('Page 0')).toBeTruthy();
    expect(screen.getByText('Page 1')).toBeTruthy();
    expect(screen.getByText('Page 2')).toBeTruthy();
  });

  it('renders a horizontal ScrollView with pagingEnabled', () => {
    renderPages();

    const scrollView = screen.getByTestId('pager');
    expect(scrollView).toBeTruthy();
    expect(scrollView.props.horizontal).toBe(true);
    expect(scrollView.props.pagingEnabled).toBe(true);
    expect(scrollView.props.showsHorizontalScrollIndicator).toBe(false);
  });

  it('fires onPageScroll with position and offset during scroll', () => {
    const onPageScroll = jest.fn();
    renderPages({ onPageScroll });

    const scrollView = screen.getByTestId('pager');

    // Simulate scrolling halfway between page 0 and page 1
    fireEvent.scroll(scrollView, {
      nativeEvent: { contentOffset: { x: 195 } },
    });

    expect(onPageScroll).toHaveBeenCalledWith({
      nativeEvent: { position: 0, offset: 0.5 },
    });
  });

  it('fires onPageSelected when scroll settles on a new page', () => {
    const onPageSelected = jest.fn();
    renderPages({ onPageSelected });

    const scrollView = screen.getByTestId('pager');

    // Scroll to page 1 (x = 390)
    fireEvent.scroll(scrollView, {
      nativeEvent: { contentOffset: { x: 390 } },
    });

    // Debounce fires after 150ms
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(onPageSelected).toHaveBeenCalledWith({
      nativeEvent: { position: 1 },
    });
  });

  it('does not fire onPageSelected when staying on same page', () => {
    const onPageSelected = jest.fn();
    renderPages({ onPageSelected });

    const scrollView = screen.getByTestId('pager');

    // Scroll slightly but settle back on page 0
    fireEvent.scroll(scrollView, {
      nativeEvent: { contentOffset: { x: 10 } },
    });

    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Round(10/390) = 0 = same as current page, no event
    expect(onPageSelected).not.toHaveBeenCalled();
  });

  it('fires onPageScrollStateChanged on drag start and idle', () => {
    const onPageScrollStateChanged = jest.fn();
    renderPages({ onPageScrollStateChanged });

    const scrollView = screen.getByTestId('pager');

    // Simulate drag start
    fireEvent(scrollView, 'scrollBeginDrag');

    expect(onPageScrollStateChanged).toHaveBeenCalledWith({
      nativeEvent: { pageScrollState: 'dragging' },
    });

    // Simulate scroll ending
    fireEvent.scroll(scrollView, {
      nativeEvent: { contentOffset: { x: 390 } },
    });

    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(onPageScrollStateChanged).toHaveBeenCalledWith({
      nativeEvent: { pageScrollState: 'idle' },
    });
  });

  it('exposes setPage and setPageWithoutAnimation via ref', () => {
    const ref = createRef<any>();
    renderPages({}, ref);

    expect(ref.current).toBeTruthy();
    expect(typeof ref.current.setPage).toBe('function');
    expect(typeof ref.current.setPageWithoutAnimation).toBe('function');
  });

  it('debounces rapid scroll events', () => {
    const onPageSelected = jest.fn();
    renderPages({ onPageSelected });

    const scrollView = screen.getByTestId('pager');

    // Rapid scroll events (simulating drag)
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 100 } } });
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 200 } } });
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 300 } } });
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { x: 390 } } });

    // Only one debounced callback
    act(() => {
      jest.advanceTimersByTime(150);
    });

    expect(onPageSelected).toHaveBeenCalledTimes(1);
    expect(onPageSelected).toHaveBeenCalledWith({
      nativeEvent: { position: 1 },
    });
  });
});
