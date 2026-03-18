/**
 * PagerView web shim
 *
 * Replaces react-native-pager-view with a horizontal ScrollView + CSS scroll-snap.
 * Provides the same API surface used by SimpleChapterPager, SimpleTopicPager, and onboarding:
 * - Props: initialPage, onPageSelected, onPageScroll, onPageScrollStateChanged, testID
 * - Ref methods: setPage(index), setPageWithoutAnimation(index)
 *
 * Page change detection uses a debounced scroll handler (150ms) for cross-browser reliability,
 * since onMomentumScrollEnd (scrollend event) isn't available in all browsers.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ScrollView,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

interface PagerViewProps {
  style?: StyleProp<ViewStyle>;
  initialPage?: number;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScroll?: (event: { nativeEvent: { position: number; offset: number } }) => void;
  onPageScrollStateChanged?: (event: { nativeEvent: { pageScrollState: string } }) => void;
  testID?: string;
  offscreenPageLimit?: number;
  children: React.ReactNode;
}

const SCROLL_END_DEBOUNCE_MS = 150;

const PagerViewWeb = forwardRef<any, PagerViewProps>(function PagerViewWeb(
  {
    style,
    initialPage = 0,
    onPageSelected,
    onPageScroll,
    onPageScrollStateChanged,
    testID,
    children,
  },
  ref
) {
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const currentPageRef = useRef(initialPage);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const childArray = React.Children.toArray(children);

  // Set initial scroll position after mount
  useEffect(() => {
    if (!initialScrollDone.current && width > 0 && initialPage > 0) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: initialPage * width, animated: false });
      });
    }
  }, [initialPage, width]);

  useImperativeHandle(
    ref,
    () => ({
      setPage: (index: number) => {
        currentPageRef.current = index;
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
      },
      setPageWithoutAnimation: (index: number) => {
        currentPageRef.current = index;
        scrollRef.current?.scrollTo({ x: index * width, animated: false });
      },
    }),
    [width]
  );

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      if (width <= 0) return;

      const page = Math.floor(offsetX / width);
      const offset = (offsetX - page * width) / width;
      onPageScroll?.({ nativeEvent: { position: page, offset } });

      // Debounce-based scroll-end detection
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }
      scrollEndTimer.current = setTimeout(() => {
        const finalPage = Math.round(offsetX / width);
        if (finalPage !== currentPageRef.current) {
          currentPageRef.current = finalPage;
          onPageSelected?.({ nativeEvent: { position: finalPage } });
        }
        onPageScrollStateChanged?.({ nativeEvent: { pageScrollState: 'idle' } });
      }, SCROLL_END_DEBOUNCE_MS);
    },
    [width, onPageScroll, onPageSelected, onPageScrollStateChanged]
  );

  const handleScrollBeginDrag = useCallback(() => {
    onPageScrollStateChanged?.({ nativeEvent: { pageScrollState: 'dragging' } });
  }, [onPageScrollStateChanged]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={style}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      testID={testID}
    >
      {childArray.map((child, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Pages are positional, index is stable
        <View key={index} style={{ width }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
});

export default PagerViewWeb;
