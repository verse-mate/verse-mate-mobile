import type { Meta, StoryObj } from '@storybook/react-native';
import { Button } from './Button';

/**
 * Button Stories
 * Demonstrates all Button component variants and states for VerseMate
 */
const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    onPress: { action: 'pressed' },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
  args: {
    title: 'Read Verse',
    disabled: false,
    variant: 'primary',
    onPress: () => {},
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Primary button variant
 * Used for primary actions like "Read Verse" or "Get Explanation"
 */
export const Primary: Story = {
  args: {
    title: 'Read Verse',
    variant: 'primary',
  },
};

/**
 * Secondary button variant
 * Used for secondary actions
 */
export const Secondary: Story = {
  args: {
    title: 'Cancel',
    variant: 'secondary',
  },
};

/**
 * Outline button variant
 * Used for tertiary actions
 */
export const Outline: Story = {
  args: {
    title: 'Learn More',
    variant: 'outline',
  },
};

/**
 * Disabled state
 * Shows how button appears when action is unavailable
 */
export const Disabled: Story = {
  args: {
    title: 'Read Verse',
    variant: 'primary',
    disabled: true,
  },
};

/**
 * Long text handling
 * Demonstrates button with longer text content
 */
export const LongText: Story = {
  args: {
    title: 'Request AI Explanation in Multiple Languages',
    variant: 'primary',
  },
};
