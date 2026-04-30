import type { Meta, StoryObj } from '@storybook/react-native';
import { Button } from './Button';

/**
 * Button Stories
 * Demonstrates all Button component variants and states for VerseMate.
 *
 * Theme: stories render under the real ThemeProvider — toggle theme in the
 * Storybook app shell (or settings screen on device) to see dark mode.
 */
const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    onPress: { action: 'pressed' },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'outlineGold', 'auth'],
    },
    disabled: { control: { type: 'boolean' } },
    fullWidth: { control: { type: 'boolean' } },
  },
  args: {
    title: 'Read Verse',
    disabled: false,
    fullWidth: false,
    variant: 'primary',
    onPress: () => {},
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { title: 'Read Verse', variant: 'primary' },
};

export const Secondary: Story = {
  args: { title: 'Cancel', variant: 'secondary' },
};

export const Outline: Story = {
  args: { title: 'Learn More', variant: 'outline' },
};

export const OutlineGold: Story = {
  args: { title: 'Request Explanation', variant: 'outlineGold' },
};

export const Auth: Story = {
  args: { title: 'Sign in with Email', variant: 'auth' },
};

export const Disabled: Story = {
  args: { title: 'Read Verse', variant: 'primary', disabled: true },
};

export const FullWidth: Story = {
  args: { title: 'Continue', variant: 'primary', fullWidth: true },
};

export const LongText: Story = {
  args: { title: 'Request AI Explanation in Multiple Languages', variant: 'primary' },
};
