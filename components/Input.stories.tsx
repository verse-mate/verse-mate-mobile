import type { Meta, StoryObj } from '@storybook/react-native';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { createInputStyles, type RecipeTheme } from '@/theme/recipes';
import { getColors, radii, spacing, typography } from '@/theme/tokens';

const lightTheme: RecipeTheme = { colors: getColors('light'), typography, spacing, radii };
const darkTheme: RecipeTheme = { colors: getColors('dark'), typography, spacing, radii };

type InputVariant = 'default' | 'error' | 'disabled';

interface InputPreviewProps {
  variant: InputVariant;
  placeholder?: string;
}

function InputPreview({ variant, placeholder = 'Enter a verse reference...' }: InputPreviewProps) {
  const [light, setLight] = useState('');
  const [dark, setDark] = useState('');
  const lightStyles = createInputStyles(lightTheme);
  const darkStyles = createInputStyles(darkTheme);

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
          LIGHT — {variant}
        </Text>
        <TextInput
          style={lightStyles[variant]}
          value={light}
          onChangeText={setLight}
          placeholder={placeholder}
          placeholderTextColor={lightTheme.colors.textTertiary}
          editable={variant !== 'disabled'}
        />
      </View>
      <View style={{ backgroundColor: darkTheme.colors.background, padding: spacing.md }}>
        <Text
          style={{
            ...typography.caption,
            color: darkTheme.colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          DARK — {variant}
        </Text>
        <TextInput
          style={darkStyles[variant]}
          value={dark}
          onChangeText={setDark}
          placeholder={placeholder}
          placeholderTextColor={darkTheme.colors.textTertiary}
          editable={variant !== 'disabled'}
        />
      </View>
    </View>
  );
}

const meta = {
  title: 'Recipes/Input',
  component: InputPreview,
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'error', 'disabled'] satisfies InputVariant[],
    },
    placeholder: { control: { type: 'text' } },
  },
  args: { variant: 'default' satisfies InputVariant, placeholder: 'Enter a verse reference...' },
} satisfies Meta<typeof InputPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: 'default' } };
export const ErrorState: Story = { args: { variant: 'error', placeholder: 'Invalid reference' } };
export const Disabled: Story = { args: { variant: 'disabled', placeholder: 'Locked field' } };
