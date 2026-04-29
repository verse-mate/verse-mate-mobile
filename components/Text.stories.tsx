import type { Meta, StoryObj } from '@storybook/react-native';
import { Text as RNText, View } from 'react-native';
import { createTextStyles, type RecipeTheme } from '@/theme/recipes';
import { getColors, radii, spacing, typography } from '@/theme/tokens';

const lightTheme: RecipeTheme = { colors: getColors('light'), typography, spacing, radii };
const darkTheme: RecipeTheme = { colors: getColors('dark'), typography, spacing, radii };

type TextVariant =
  | 'displayLarge'
  | 'displayMedium'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'overline';

const ALL_VARIANTS: TextVariant[] = [
  'displayLarge',
  'displayMedium',
  'heading1',
  'heading2',
  'heading3',
  'bodyLarge',
  'body',
  'bodySmall',
  'caption',
  'overline',
];

const SAMPLE_TEXT: Record<TextVariant, string> = {
  displayLarge: 'In the beginning',
  displayMedium: 'Genesis 1:1',
  heading1: 'The Creation Account',
  heading2: 'Day One — Light',
  heading3: 'Verse Notes',
  bodyLarge: 'In the beginning, God created the heavens and the earth.',
  body: 'And the earth was without form, and void; and darkness was upon the face of the deep.',
  bodySmall: 'Cross-reference: 2 Peter 3:5',
  caption: '12 of 31',
  overline: 'CHAPTER ONE',
};

interface TextPreviewProps {
  variant: TextVariant;
}

function TextPreview({ variant }: TextPreviewProps) {
  const lightStyles = createTextStyles(lightTheme);
  const darkStyles = createTextStyles(darkTheme);

  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View style={{ backgroundColor: lightTheme.colors.background, padding: spacing.md }}>
        <RNText style={lightStyles[variant]}>{SAMPLE_TEXT[variant]}</RNText>
      </View>
      <View style={{ backgroundColor: darkTheme.colors.background, padding: spacing.md }}>
        <RNText style={darkStyles[variant]}>{SAMPLE_TEXT[variant]}</RNText>
      </View>
    </View>
  );
}

function TextScale() {
  const lightStyles = createTextStyles(lightTheme);
  const darkStyles = createTextStyles(darkTheme);

  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View
        style={{
          backgroundColor: lightTheme.colors.background,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        {ALL_VARIANTS.map((v) => (
          <RNText key={`light-${v}`} style={lightStyles[v]}>
            {v} — {SAMPLE_TEXT[v]}
          </RNText>
        ))}
      </View>
      <View
        style={{
          backgroundColor: darkTheme.colors.background,
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        {ALL_VARIANTS.map((v) => (
          <RNText key={`dark-${v}`} style={darkStyles[v]}>
            {v} — {SAMPLE_TEXT[v]}
          </RNText>
        ))}
      </View>
    </View>
  );
}

const meta = {
  title: 'Recipes/Text',
  component: TextPreview,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ALL_VARIANTS,
    },
  },
  args: { variant: 'body' satisfies TextVariant },
} satisfies Meta<typeof TextPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DisplayLarge: Story = { args: { variant: 'displayLarge' } };
export const DisplayMedium: Story = { args: { variant: 'displayMedium' } };
export const Heading1: Story = { args: { variant: 'heading1' } };
export const Heading2: Story = { args: { variant: 'heading2' } };
export const Heading3: Story = { args: { variant: 'heading3' } };
export const BodyLarge: Story = { args: { variant: 'bodyLarge' } };
export const Body: Story = { args: { variant: 'body' } };
export const BodySmall: Story = { args: { variant: 'bodySmall' } };
export const Caption: Story = { args: { variant: 'caption' } };
export const Overline: Story = { args: { variant: 'overline' } };

/**
 * Shows the entire scale in one view — useful for visual proofreading
 * against design references.
 */
export const FullScale: StoryObj<typeof TextScale> = {
  render: () => <TextScale />,
};
