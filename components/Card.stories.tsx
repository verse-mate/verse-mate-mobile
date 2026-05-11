import type { Meta, StoryObj } from '@storybook/react-native';
import { Text, View } from 'react-native';
import { createCardStyles, type RecipeTheme } from '@/theme/recipes';
import { getColors, radii, spacing, typography } from '@/theme/tokens';

const lightTheme: RecipeTheme = { colors: getColors('light'), typography, spacing, radii };
const darkTheme: RecipeTheme = { colors: getColors('dark'), typography, spacing, radii };

type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardPreviewProps {
  variant: CardVariant;
}

/**
 * CardPreview — renders the Card recipe as paired light + dark blocks so
 * the variant is visible in both themes without needing to toggle.
 */
function CardPreview({ variant }: CardPreviewProps) {
  const lightStyles = createCardStyles(lightTheme);
  const darkStyles = createCardStyles(darkTheme);

  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View style={{ backgroundColor: lightTheme.colors.background, padding: spacing.md }}>
        <Text
          style={{
            ...typography.caption,
            color: lightTheme.colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          LIGHT
        </Text>
        <View style={lightStyles[variant]}>
          <Text style={{ ...typography.body, color: lightTheme.colors.textPrimary }}>
            Card content — variant: {variant}
          </Text>
        </View>
      </View>
      <View style={{ backgroundColor: darkTheme.colors.background, padding: spacing.md }}>
        <Text
          style={{
            ...typography.caption,
            color: darkTheme.colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          DARK
        </Text>
        <View style={darkStyles[variant]}>
          <Text style={{ ...typography.body, color: darkTheme.colors.textPrimary }}>
            Card content — variant: {variant}
          </Text>
        </View>
      </View>
    </View>
  );
}

const meta = {
  title: 'Recipes/Card',
  component: CardPreview,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'elevated', 'outlined'] satisfies CardVariant[],
    },
  },
  args: { variant: 'default' satisfies CardVariant },
} satisfies Meta<typeof CardPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: 'default' } };
export const Elevated: Story = { args: { variant: 'elevated' } };
export const Outlined: Story = { args: { variant: 'outlined' } };
