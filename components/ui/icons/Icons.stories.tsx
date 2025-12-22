import type { Meta, StoryObj } from '@storybook/react-native';
import { ScrollView, Text, View } from 'react-native';
import * as Icons from './index';

/**
 * Icon Gallery
 * Displays all available SVG icons in the components/ui/icons directory.
 */
const IconGallery = ({ color, size }: { color: string; size: number }) => (
  <ScrollView
    contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16 }}
  >
    {Object.entries(Icons).map(([name, Icon]) => (
      <View key={name} style={{ alignItems: 'center', width: 100, marginBottom: 16 }}>
        <Icon color={color} width={size} height={size} />
        <Text style={{ marginTop: 8, fontSize: 10, textAlign: 'center' }}>{name}</Text>
      </View>
    ))}
  </ScrollView>
);

const meta = {
  title: 'Components/Icons',
  component: IconGallery,
  argTypes: {
    color: { control: 'color' },
    size: { control: { type: 'number', min: 16, max: 64, step: 4 } },
  },
  args: {
    color: '#1C1B1F',
    size: 24,
  },
} satisfies Meta<typeof IconGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};
