/**
 * TextVisibilityContext Tests
 *
 * Tests for the viewport visibility context used for hybrid tokenization.
 * Tests the context, hook, and isElementVisible utility function.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import {
  isElementVisible,
  TextVisibilityContext,
  useTextVisibility,
  type VisibleYRange,
} from '@/contexts/TextVisibilityContext';

// Test component that uses the hook
function TestConsumer({
  onRender,
}: {
  onRender: (value: { visibleYRange: VisibleYRange | null }) => void;
}) {
  const value = useTextVisibility();
  onRender(value);
  return <Text testID="consumer">Test</Text>;
}

// Type for captured context value
type CapturedValue = { visibleYRange: VisibleYRange | null };

describe('TextVisibilityContext', () => {
  describe('Context and Hook', () => {
    it('should provide default null value when no provider', () => {
      let capturedValue: CapturedValue | undefined;

      render(
        <TestConsumer
          onRender={(value) => {
            capturedValue = value;
          }}
        />
      );

      expect(capturedValue).toBeDefined();
      expect(capturedValue?.visibleYRange).toBeNull();
    });

    it('should provide visible range from provider', () => {
      const testRange: VisibleYRange = { startY: 100, endY: 500 };
      let capturedValue: CapturedValue | undefined;

      render(
        <TextVisibilityContext.Provider value={{ visibleYRange: testRange }}>
          <TestConsumer
            onRender={(value) => {
              capturedValue = value;
            }}
          />
        </TextVisibilityContext.Provider>
      );

      expect(capturedValue?.visibleYRange).toEqual(testRange);
    });

    it('should update when provider value changes', () => {
      const initialRange: VisibleYRange = { startY: 0, endY: 400 };
      const updatedRange: VisibleYRange = { startY: 200, endY: 600 };
      let capturedValue: CapturedValue | undefined;

      const { rerender } = render(
        <TextVisibilityContext.Provider value={{ visibleYRange: initialRange }}>
          <TestConsumer
            onRender={(value) => {
              capturedValue = value;
            }}
          />
        </TextVisibilityContext.Provider>
      );

      expect(capturedValue?.visibleYRange).toEqual(initialRange);

      rerender(
        <TextVisibilityContext.Provider value={{ visibleYRange: updatedRange }}>
          <TestConsumer
            onRender={(value) => {
              capturedValue = value;
            }}
          />
        </TextVisibilityContext.Provider>
      );

      expect(capturedValue?.visibleYRange).toEqual(updatedRange);
    });
  });

  describe('isElementVisible', () => {
    const _defaultBuffer = 200;

    describe('with null visibleRange', () => {
      it('should return true (safe default) when visibleRange is null', () => {
        expect(isElementVisible(100, 50, null)).toBe(true);
        expect(isElementVisible(0, 100, null)).toBe(true);
        expect(isElementVisible(1000, 200, null)).toBe(true);
      });
    });

    describe('with valid visibleRange', () => {
      const visibleRange: VisibleYRange = { startY: 500, endY: 1000 };

      it('should return true for element fully within viewport', () => {
        // Element at Y=600, height=100 is fully within 500-1000
        expect(isElementVisible(600, 100, visibleRange)).toBe(true);
      });

      it('should return true for element partially overlapping viewport top', () => {
        // Element at Y=450, height=100 overlaps with viewport (450-550 overlaps 500-1000)
        expect(isElementVisible(450, 100, visibleRange)).toBe(true);
      });

      it('should return true for element partially overlapping viewport bottom', () => {
        // Element at Y=950, height=100 overlaps with viewport (950-1050 overlaps 500-1000)
        expect(isElementVisible(950, 100, visibleRange)).toBe(true);
      });

      it('should return true for element within buffer zone above viewport', () => {
        // With default buffer=200, viewport extends to 300 (500-200)
        // Element at Y=350, height=50 is within buffered range
        expect(isElementVisible(350, 50, visibleRange)).toBe(true);
      });

      it('should return true for element within buffer zone below viewport', () => {
        // With default buffer=200, viewport extends to 1200 (1000+200)
        // Element at Y=1100, height=50 is within buffered range
        expect(isElementVisible(1100, 50, visibleRange)).toBe(true);
      });

      it('should return false for element completely above buffered viewport', () => {
        // Element at Y=0, height=50 ends at 50, which is below 300 (viewport start - buffer)
        expect(isElementVisible(0, 50, visibleRange)).toBe(false);
      });

      it('should return false for element completely below buffered viewport', () => {
        // Element at Y=1500, height=50 starts at 1500, which is above 1200 (viewport end + buffer)
        expect(isElementVisible(1500, 50, visibleRange)).toBe(false);
      });
    });

    describe('with custom buffer', () => {
      const visibleRange: VisibleYRange = { startY: 500, endY: 1000 };

      it('should use custom buffer when specified', () => {
        // With buffer=0, element at Y=400 (ends at 500) is exactly at viewport edge
        // Should be visible since elementBottom (500) >= viewportTop (500)
        expect(isElementVisible(400, 100, visibleRange, 0)).toBe(true);

        // Element at Y=300, height=100 ends at 400, which is below 500 with buffer=0
        expect(isElementVisible(300, 100, visibleRange, 0)).toBe(false);
      });

      it('should handle large buffer values', () => {
        // With buffer=500, viewport extends from 0 to 1500
        // Element at Y=0 should be visible
        expect(isElementVisible(0, 50, visibleRange, 500)).toBe(true);
        // Element at Y=1450 should be visible
        expect(isElementVisible(1450, 50, visibleRange, 500)).toBe(true);
      });

      it('should handle zero-height elements', () => {
        // Zero-height element at Y=600 (within viewport)
        expect(isElementVisible(600, 0, visibleRange)).toBe(true);
        // Zero-height element at Y=100 (above buffered viewport)
        expect(isElementVisible(100, 0, visibleRange)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle viewport at Y=0', () => {
        const visibleRange: VisibleYRange = { startY: 0, endY: 500 };
        // Element at Y=0 should be visible
        expect(isElementVisible(0, 100, visibleRange)).toBe(true);
        // Element at Y=600 should be visible (within buffer)
        expect(isElementVisible(600, 50, visibleRange)).toBe(true);
        // Element at Y=800 should not be visible
        expect(isElementVisible(800, 50, visibleRange)).toBe(false);
      });

      it('should handle very small viewport', () => {
        const visibleRange: VisibleYRange = { startY: 500, endY: 510 };
        // Even with small viewport, buffer extends visibility
        expect(isElementVisible(300, 50, visibleRange)).toBe(true); // Within buffer above
        expect(isElementVisible(700, 50, visibleRange)).toBe(true); // Within buffer below
        expect(isElementVisible(0, 50, visibleRange)).toBe(false); // Too far above
      });

      it('should handle element spanning entire viewport', () => {
        const visibleRange: VisibleYRange = { startY: 500, endY: 1000 };
        // Large element that spans beyond viewport
        expect(isElementVisible(400, 800, visibleRange)).toBe(true);
      });
    });
  });
});
