/**
 * ChapterContentTabs Storybook Stories
 *
 * Visual documentation for the content tabs component.
 * Shows different states: active tabs, disabled state, and interactions.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import type { ContentTabType } from '@/types/bible';
import { ChapterContentTabs } from './ChapterContentTabs';

const meta = {
  title: 'Bible/ChapterContentTabs',
  component: ChapterContentTabs,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    activeTab: {
      control: 'select',
      options: ['summary', 'byline', 'detailed'],
      description: 'Currently active reading mode tab',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether tabs are disabled',
    },
    onTabChange: {
      action: 'tab changed',
      description: 'Callback when tab is changed',
    },
  },
} satisfies Meta<typeof ChapterContentTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state with Summary tab active
 */
export const Default: Story = {
  args: {
    activeTab: 'summary',
    disabled: false,
    onTabChange: () => {},
  },
};

/**
 * By Line tab active
 */
export const ByLineActive: Story = {
  args: {
    activeTab: 'byline',
    disabled: false,
    onTabChange: () => {},
  },
};

/**
 * Detailed tab active
 */
export const DetailedActive: Story = {
  args: {
    activeTab: 'detailed',
    disabled: false,
    onTabChange: () => {},
  },
};

/**
 * Disabled state (tabs cannot be clicked)
 */
export const Disabled: Story = {
  args: {
    activeTab: 'summary',
    disabled: true,
    onTabChange: () => {},
  },
};

/**
 * Interactive demo with state management
 * Shows how tabs work when clicked
 */
export const Interactive: Story = {
  args: {
    activeTab: 'summary',
    onTabChange: () => {},
  },
  render: (args) => {
    const [activeTab, setActiveTab] = useState<ContentTabType>(args.activeTab);

    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <ChapterContentTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    );
  },
};
