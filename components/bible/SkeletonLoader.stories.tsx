import type { Meta, StoryFn, StoryObj } from '@storybook/react-native';
import { StyleSheet, View } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

/**
 * SkeletonLoader Stories
 *
 * Demonstrates the SkeletonLoader component used as a loading placeholder
 * for Bible reading content. Shows shimmer animation at 60fps.
 *
 * The skeleton provides visual feedback while chapter content is loading,
 * maintaining layout stability and user engagement.
 */
const meta = {
  title: 'Bible/SkeletonLoader',
  component: SkeletonLoader,
  decorators: [
    (Story: StoryFn) => (
      <View style={styles.decorator}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof SkeletonLoader>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default skeleton state
 * Shows the standard loading skeleton with shimmer animation
 */
export const Default: Story = {};

/**
 * Mobile viewport (375px width)
 * Shows how the skeleton adapts to mobile screen sizes
 */
export const MobileView: Story = {
  decorators: [
    (Story: StoryFn) => (
      <View style={styles.mobileDecorator}>
        <Story />
      </View>
    ),
  ],
};

/**
 * Tablet viewport (768px width)
 * Shows how the skeleton adapts to tablet screen sizes
 */
export const TabletView: Story = {
  decorators: [
    (Story: StoryFn) => (
      <View style={styles.tabletDecorator}>
        <Story />
      </View>
    ),
  ],
};

/**
 * Multiple skeletons stacked
 * Demonstrates how multiple skeletons can be used together
 */
export const MultipleSkeletons: Story = {
  decorators: [
    (Story: StoryFn) => (
      <View style={styles.decorator}>
        <Story />
        <View style={styles.spacer} />
        <Story />
        <View style={styles.spacer} />
        <Story />
      </View>
    ),
  ],
};

const styles = StyleSheet.create({
  decorator: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  mobileDecorator: {
    width: 375,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  tabletDecorator: {
    width: 768,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  spacer: {
    height: 24,
  },
});
