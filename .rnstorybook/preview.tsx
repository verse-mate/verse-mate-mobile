import type { Preview } from '@storybook/react-native';
import { View } from 'react-native';

export const decorators = [
  (Story: any) => (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#F3F4F6' }}>
      <Story />
    </View>
  ),
];

export const parameters: Preview['parameters'] = {
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#F3F4F6' },
      { name: 'dark', value: '#1F2937' },
      { name: 'white', value: '#FFFFFF' },
    ],
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

export default {
  decorators,
  parameters,
};
