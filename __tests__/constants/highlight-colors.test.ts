/**
 * Tests for highlight-colors constants
 *
 * Tests for highlight color definitions and theme-aware utility function.
 *
 * @see Task 7.3: Add highlight color dark variants
 */

import {
  DEFAULT_HIGHLIGHT_COLOR,
  getHighlightColor,
  HIGHLIGHT_COLOR_ORDER,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLORS_DARK,
  type HighlightColor,
} from '@/constants/highlight-colors';

describe('highlight-colors constants', () => {
  describe('HIGHLIGHT_COLORS', () => {
    it('should define all 9 highlight colors for light mode', () => {
      const expectedColors: HighlightColor[] = [
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        'orange',
        'red',
        'teal',
        'brown',
      ];

      expectedColors.forEach((color) => {
        expect(HIGHLIGHT_COLORS[color]).toBeDefined();
        expect(typeof HIGHLIGHT_COLORS[color]).toBe('string');
        expect(HIGHLIGHT_COLORS[color]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have correct light mode color values', () => {
      expect(HIGHLIGHT_COLORS.yellow).toBe('#FFEB3B');
      expect(HIGHLIGHT_COLORS.green).toBe('#4CAF50');
      expect(HIGHLIGHT_COLORS.blue).toBe('#2196F3');
      expect(HIGHLIGHT_COLORS.pink).toBe('#E91E63');
      expect(HIGHLIGHT_COLORS.purple).toBe('#9C27B0');
      expect(HIGHLIGHT_COLORS.orange).toBe('#FF9800');
      expect(HIGHLIGHT_COLORS.red).toBe('#F44336');
      expect(HIGHLIGHT_COLORS.teal).toBe('#009688');
      expect(HIGHLIGHT_COLORS.brown).toBe('#795548');
    });
  });

  describe('HIGHLIGHT_COLORS_DARK', () => {
    it('should define all 9 highlight colors for dark mode', () => {
      const expectedColors: HighlightColor[] = [
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        'orange',
        'red',
        'teal',
        'brown',
      ];

      expectedColors.forEach((color) => {
        expect(HIGHLIGHT_COLORS_DARK[color]).toBeDefined();
        expect(typeof HIGHLIGHT_COLORS_DARK[color]).toBe('string');
        expect(HIGHLIGHT_COLORS_DARK[color]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have correct dark mode color values (brighter variants)', () => {
      expect(HIGHLIGHT_COLORS_DARK.yellow).toBe('#FFF176');
      expect(HIGHLIGHT_COLORS_DARK.green).toBe('#81C784');
      expect(HIGHLIGHT_COLORS_DARK.blue).toBe('#64B5F6');
      expect(HIGHLIGHT_COLORS_DARK.pink).toBe('#F48FB1');
      expect(HIGHLIGHT_COLORS_DARK.purple).toBe('#BA68C8');
      expect(HIGHLIGHT_COLORS_DARK.orange).toBe('#FFB74D');
      expect(HIGHLIGHT_COLORS_DARK.red).toBe('#EF5350');
      expect(HIGHLIGHT_COLORS_DARK.teal).toBe('#4DB6AC');
      expect(HIGHLIGHT_COLORS_DARK.brown).toBe('#A1887F');
    });

    it('should have different colors than light mode for better dark background visibility', () => {
      const colors: HighlightColor[] = [
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        'orange',
        'red',
        'teal',
        'brown',
      ];

      colors.forEach((color) => {
        expect(HIGHLIGHT_COLORS_DARK[color]).not.toBe(HIGHLIGHT_COLORS[color]);
      });
    });
  });

  describe('getHighlightColor', () => {
    it('should return light mode color when mode is light', () => {
      expect(getHighlightColor('yellow', 'light')).toBe('#FFEB3B');
      expect(getHighlightColor('green', 'light')).toBe('#4CAF50');
      expect(getHighlightColor('blue', 'light')).toBe('#2196F3');
      expect(getHighlightColor('pink', 'light')).toBe('#E91E63');
      expect(getHighlightColor('purple', 'light')).toBe('#9C27B0');
    });

    it('should return dark mode color when mode is dark', () => {
      expect(getHighlightColor('yellow', 'dark')).toBe('#FFF176');
      expect(getHighlightColor('green', 'dark')).toBe('#81C784');
      expect(getHighlightColor('blue', 'dark')).toBe('#64B5F6');
      expect(getHighlightColor('pink', 'dark')).toBe('#F48FB1');
      expect(getHighlightColor('purple', 'dark')).toBe('#BA68C8');
    });

    it('should work for all 9 colors in both modes', () => {
      const colors: HighlightColor[] = [
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        'orange',
        'red',
        'teal',
        'brown',
      ];

      colors.forEach((color) => {
        expect(getHighlightColor(color, 'light')).toBe(HIGHLIGHT_COLORS[color]);
        expect(getHighlightColor(color, 'dark')).toBe(HIGHLIGHT_COLORS_DARK[color]);
      });
    });
  });

  describe('HIGHLIGHT_COLOR_ORDER', () => {
    it('should contain all 9 colors in correct order', () => {
      expect(HIGHLIGHT_COLOR_ORDER).toEqual([
        'yellow',
        'green',
        'blue',
        'pink',
        'purple',
        'orange',
        'red',
        'teal',
        'brown',
      ]);
    });

    it('should have length of 9', () => {
      expect(HIGHLIGHT_COLOR_ORDER).toHaveLength(9);
    });
  });

  describe('DEFAULT_HIGHLIGHT_COLOR', () => {
    it('should be yellow', () => {
      expect(DEFAULT_HIGHLIGHT_COLOR).toBe('yellow');
    });

    it('should be a valid highlight color', () => {
      expect(HIGHLIGHT_COLORS[DEFAULT_HIGHLIGHT_COLOR]).toBeDefined();
      expect(HIGHLIGHT_COLORS_DARK[DEFAULT_HIGHLIGHT_COLOR]).toBeDefined();
    });
  });
});
