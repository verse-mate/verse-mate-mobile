/**
 * Device Detection Utilities Tests
 *
 * Tests for device detection utilities used for split view layout decisions.
 */

import { Dimensions, Platform } from 'react-native';
import {
  BREAKPOINTS,
  calculatePanelWidths,
  DEFAULT_SPLIT_RATIO,
  getDeviceInfo,
  shouldUseSplitView,
} from '@/utils/device-detection';

// Mock Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('device-detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceInfo', () => {
    it('should detect portrait phone correctly', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 390, height: 844 });

      const info = getDeviceInfo();

      expect(info.isLandscape).toBe(false);
      expect(info.isTablet).toBe(false);
      expect(info.screenWidth).toBe(390);
      expect(info.screenHeight).toBe(844);
      expect(info.smallerDimension).toBe(390);
      expect(info.largerDimension).toBe(844);
    });

    it('should detect landscape phone correctly', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 844, height: 390 });

      const info = getDeviceInfo();

      expect(info.isLandscape).toBe(true);
      expect(info.isTablet).toBe(false);
    });

    it('should detect iPad correctly on iOS', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
      (Platform as any).OS = 'ios';

      const info = getDeviceInfo();

      expect(info.isTablet).toBe(true);
      expect(info.isLandscape).toBe(true);
    });

    it('should detect portrait iPad correctly', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 768, height: 1024 });
      (Platform as any).OS = 'ios';

      const info = getDeviceInfo();

      expect(info.isTablet).toBe(true);
      expect(info.isLandscape).toBe(false);
    });

    it('should detect Android tablet correctly', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 800, height: 600 });
      (Platform as any).OS = 'android';

      const info = getDeviceInfo();

      expect(info.isTablet).toBe(true);
    });

    it('should detect Android phone correctly', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 360, height: 800 });
      (Platform as any).OS = 'android';

      const info = getDeviceInfo();

      expect(info.isTablet).toBe(false);
    });
  });

  describe('shouldUseSplitView', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('should return false for portrait phone', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 390, height: 844 });

      expect(shouldUseSplitView()).toBe(false);
    });

    it('should return false for portrait tablet', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 768, height: 1024 });

      expect(shouldUseSplitView()).toBe(false);
    });

    it('should return false for landscape phone (narrow)', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 844, height: 390 });

      expect(shouldUseSplitView()).toBe(false);
    });

    it('should return true for landscape tablet (wide enough)', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 768 });

      expect(shouldUseSplitView()).toBe(true);
    });

    it('should return true for large phone in landscape (wide enough)', () => {
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 428 });

      expect(shouldUseSplitView()).toBe(true);
    });

    it('should use SPLIT_VIEW_MIN_WIDTH breakpoint', () => {
      // Just under the threshold
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 1023, height: 500 });
      expect(shouldUseSplitView()).toBe(false);

      // At the threshold
      (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 500 });
      expect(shouldUseSplitView()).toBe(true);
    });
  });

  describe('calculatePanelWidths', () => {
    it('should calculate widths based on default split ratio', () => {
      const { leftWidth, rightWidth } = calculatePanelWidths(1000, DEFAULT_SPLIT_RATIO);

      expect(leftWidth + rightWidth).toBeLessThanOrEqual(1000);
      expect(leftWidth).toBeCloseTo(536, 0);
      expect(rightWidth).toBeCloseTo(464, 0);
    });

    it('should calculate equal widths with 0.5 ratio', () => {
      const { leftWidth, rightWidth } = calculatePanelWidths(1000, 0.5);

      expect(leftWidth).toBe(500);
      expect(rightWidth).toBe(500);
    });

    it('should enforce minimum panel widths', () => {
      // Try to make left panel very narrow (10%)
      const { leftWidth } = calculatePanelWidths(1000, 0.1);

      expect(leftWidth).toBeGreaterThanOrEqual(BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH);
    });

    it('should clamp ratio to valid range (0.3-0.7)', () => {
      // Ratio too low (0.1) should clamp to 0.3
      const narrowLeft = calculatePanelWidths(1000, 0.1);
      expect(narrowLeft.leftWidth).toBeGreaterThanOrEqual(BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH);

      // Ratio too high (0.9) should clamp to 0.7
      const wideLeft = calculatePanelWidths(1000, 0.9);
      expect(wideLeft.rightWidth).toBeGreaterThanOrEqual(BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH);
    });

    it('should enforce maximum panel widths on very wide screens', () => {
      const { leftWidth, rightWidth } = calculatePanelWidths(2000, 0.5);

      expect(leftWidth).toBeLessThanOrEqual(BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH);
      expect(rightWidth).toBeLessThanOrEqual(BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH);
    });

    it('should handle small total widths', () => {
      const { leftWidth, rightWidth } = calculatePanelWidths(640, 0.5);

      // Both should fit within 640px
      expect(leftWidth + rightWidth).toBeLessThanOrEqual(640);
      // Right panel has higher minimum (400px), so left adjusts
      expect(leftWidth).toBe(240);
      expect(rightWidth).toBe(400);
    });
  });

  describe('BREAKPOINTS', () => {
    it('should have valid breakpoint values', () => {
      expect(BREAKPOINTS.TABLET_MIN_WIDTH).toBe(600);
      expect(BREAKPOINTS.IPAD_MIN_WIDTH).toBe(768);
      expect(BREAKPOINTS.SPLIT_VIEW_MIN_WIDTH).toBe(1024);
      expect(BREAKPOINTS.SPLIT_VIEW_COMFORTABLE_WIDTH).toBe(1024);
      expect(BREAKPOINTS.SPLIT_VIEW_MIN_PANEL_WIDTH).toBe(320);
      expect(BREAKPOINTS.SPLIT_VIEW_MIN_LEFT_PANEL_WIDTH).toBe(320);
      expect(BREAKPOINTS.SPLIT_VIEW_MIN_RIGHT_PANEL_WIDTH).toBe(400);
      expect(BREAKPOINTS.SPLIT_VIEW_MAX_PANEL_WIDTH).toBe(700);
    });
  });

  describe('DEFAULT_SPLIT_RATIO', () => {
    it('should be based on Figma design proportions', () => {
      // From Figma: 640px left / (640px + 554px) total = 0.536
      expect(DEFAULT_SPLIT_RATIO).toBeCloseTo(0.536, 2);
    });
  });
});
