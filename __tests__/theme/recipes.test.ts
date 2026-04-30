/**
 * Recipe StyleSheet Tests
 *
 * One assertion per recipe × variant verifying the returned StyleSheet
 * resolves expected token values. Both light and dark themes exercised.
 *
 * Traces to: TEST-016 .. TEST-025 in specs/feat-design-system-foundation/tests.md
 */

import {
  createButtonStyles,
  createCardStyles,
  createInputStyles,
  createTextStyles,
  type RecipeTheme,
} from '@/theme/recipes';
import { getColors, radii, spacing, typography } from '@/theme/tokens';

const lightTheme: RecipeTheme = {
  colors: getColors('light'),
  typography,
  spacing,
  radii,
};

const darkTheme: RecipeTheme = {
  colors: getColors('dark'),
  typography,
  spacing,
  radii,
};

describe('createButtonStyles', () => {
  describe('light theme', () => {
    const styles = createButtonStyles(lightTheme);

    it('base button uses spacing + radii from tokens', () => {
      expect(styles.button.paddingVertical).toBe(spacing.md);
      expect(styles.button.paddingHorizontal).toBe(spacing.xxl);
      expect(styles.button.borderRadius).toBe(radii.md);
    });

    it('primary uses info background', () => {
      expect(styles.primary.backgroundColor).toBe(lightTheme.colors.info);
    });

    it('secondary uses gray700 background', () => {
      expect(styles.secondary.backgroundColor).toBe(lightTheme.colors.gray700);
    });

    it('outline uses transparent bg + info border', () => {
      expect(styles.outline.backgroundColor).toBe('transparent');
      expect(styles.outline.borderColor).toBe(lightTheme.colors.info);
    });

    it('outlineGold uses transparent bg + gold border', () => {
      expect(styles.outlineGold.backgroundColor).toBe('transparent');
      expect(styles.outlineGold.borderColor).toBe(lightTheme.colors.gold);
    });

    it('auth uses gold background and radii.md', () => {
      expect(styles.auth.backgroundColor).toBe(lightTheme.colors.gold);
      expect(styles.auth.borderRadius).toBe(radii.md);
    });

    it('buttonDisabled uses gray300', () => {
      expect(styles.buttonDisabled.backgroundColor).toBe(lightTheme.colors.gray300);
    });

    it('fullWidth modifier is 100% width', () => {
      expect(styles.fullWidth.width).toBe('100%');
    });

    it('text uses typography.body.fontSize', () => {
      expect(styles.text.fontSize).toBe(typography.body.fontSize);
      expect(styles.text.fontWeight).toBe('600');
    });

    it('text-color variants resolve to expected colors', () => {
      expect(styles.primaryText.color).toBe(lightTheme.colors.white);
      expect(styles.secondaryText.color).toBe(lightTheme.colors.white);
      expect(styles.outlineText.color).toBe(lightTheme.colors.info);
      expect(styles.outlineGoldText.color).toBe(lightTheme.colors.gold);
      expect(styles.authText.color).toBe(lightTheme.colors.background);
      expect(styles.textDisabled.color).toBe(lightTheme.colors.gray500);
    });
  });

  describe('dark theme', () => {
    const styles = createButtonStyles(darkTheme);

    it('primary resolves to dark info value, not light', () => {
      expect(styles.primary.backgroundColor).toBe(darkTheme.colors.info);
      expect(styles.primary.backgroundColor).not.toBe(lightTheme.colors.info);
    });

    it('auth uses dark gold + radii.md', () => {
      expect(styles.auth.backgroundColor).toBe(darkTheme.colors.gold);
      expect(styles.auth.borderRadius).toBe(radii.md);
    });

    it('authText uses dark background color (black on gold)', () => {
      expect(styles.authText.color).toBe(darkTheme.colors.background);
    });
  });
});

describe('createCardStyles', () => {
  const lightStyles = createCardStyles(lightTheme);
  const darkStyles = createCardStyles(darkTheme);

  it('default uses background color + radii.lg', () => {
    expect(lightStyles.default.backgroundColor).toBe(lightTheme.colors.background);
    expect(lightStyles.default.borderRadius).toBe(radii.lg);
  });

  it('elevated uses backgroundElevated + shadow + elevation', () => {
    expect(lightStyles.elevated.backgroundColor).toBe(lightTheme.colors.backgroundElevated);
    expect(lightStyles.elevated.borderRadius).toBe(radii.lg);
    expect(lightStyles.elevated.shadowColor).toBe(lightTheme.colors.shadow);
    expect(lightStyles.elevated.elevation).toBeGreaterThan(0);
  });

  it('outlined uses border + border color', () => {
    expect(lightStyles.outlined.borderWidth).toBeGreaterThanOrEqual(1);
    expect(lightStyles.outlined.borderColor).toBe(lightTheme.colors.border);
    expect(lightStyles.outlined.borderRadius).toBe(radii.lg);
  });

  it('dark theme resolves to dark backgrounds, not light', () => {
    expect(darkStyles.default.backgroundColor).toBe(darkTheme.colors.background);
    expect(darkStyles.elevated.backgroundColor).toBe(darkTheme.colors.backgroundElevated);
    expect(darkStyles.default.backgroundColor).not.toBe(lightTheme.colors.background);
  });
});

describe('createInputStyles', () => {
  const lightStyles = createInputStyles(lightTheme);
  const darkStyles = createInputStyles(darkTheme);

  it('default uses border color + radii.md + body font size', () => {
    expect(lightStyles.default.borderColor).toBe(lightTheme.colors.border);
    expect(lightStyles.default.borderRadius).toBe(radii.md);
    expect(lightStyles.default.fontSize).toBe(typography.body.fontSize);
    expect(lightStyles.default.color).toBe(lightTheme.colors.textPrimary);
  });

  it('error uses error border color', () => {
    expect(lightStyles.error.borderColor).toBe(lightTheme.colors.error);
  });

  it('disabled uses gray100 background and textDisabled color', () => {
    expect(lightStyles.disabled.backgroundColor).toBe(lightTheme.colors.gray100);
    expect(lightStyles.disabled.color).toBe(lightTheme.colors.textDisabled);
  });

  it('dark theme resolves to dark error color, not light', () => {
    expect(darkStyles.error.borderColor).toBe(darkTheme.colors.error);
    expect(darkStyles.error.borderColor).not.toBe(lightTheme.colors.error);
  });
});

describe('createTextStyles', () => {
  const lightStyles = createTextStyles(lightTheme);
  const darkStyles = createTextStyles(darkTheme);

  it('exposes all 10 typography variant keys', () => {
    expect(Object.keys(lightStyles).sort()).toEqual(
      [
        'body',
        'bodyLarge',
        'bodySmall',
        'caption',
        'displayLarge',
        'displayMedium',
        'heading1',
        'heading2',
        'heading3',
        'overline',
      ].sort()
    );
  });

  it('each variant has fontSize matching the typography token', () => {
    (Object.keys(typography) as (keyof typeof typography)[]).forEach((variant) => {
      expect(lightStyles[variant].fontSize).toBe(typography[variant].fontSize);
    });
  });

  it('default text color is theme.textPrimary in both modes', () => {
    expect(lightStyles.body.color).toBe(lightTheme.colors.textPrimary);
    expect(darkStyles.body.color).toBe(darkTheme.colors.textPrimary);
    expect(lightStyles.body.color).not.toBe(darkStyles.body.color);
  });
});
