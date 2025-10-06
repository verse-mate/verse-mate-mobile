import type { Meta, StoryObj } from '@storybook/react-native';
import { VerseCard } from './VerseCard';

/**
 * VerseCard Stories
 * Demonstrates Bible verse display variations for VerseMate
 */
const meta = {
  title: 'Components/VerseCard',
  component: VerseCard,
  argTypes: {
    highlighted: {
      control: { type: 'boolean' },
    },
  },
  args: {
    book: 'John',
    chapter: 3,
    verse: 16,
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    highlighted: false,
  },
} satisfies Meta<typeof VerseCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default verse card
 * Standard display for Bible verses
 */
export const Default: Story = {};

/**
 * Highlighted verse
 * Used when user has bookmarked or selected the verse
 */
export const Highlighted: Story = {
  args: {
    highlighted: true,
  },
};

/**
 * Short verse
 * Example with brief text content
 */
export const ShortVerse: Story = {
  args: {
    book: 'Psalm',
    chapter: 117,
    verse: 1,
    text: 'Praise the Lord, all you nations; extol him, all you peoples.',
  },
};

/**
 * Long verse
 * Example with extensive text content
 */
export const LongVerse: Story = {
  args: {
    book: 'Esther',
    chapter: 8,
    verse: 9,
    text: 'At once the royal secretaries were summoned on the twenty-third day of the third month, the month of Sivan. They wrote out all the orders to the Jews, and to the satraps, governors and nobles of the 127 provinces stretching from India to Cush. These orders were written in the script of each province and the language of each people and also to the Jews in their own script and language.',
  },
};

/**
 * Different book - Psalms
 * Popular verse from Psalms
 */
export const Psalm23: Story = {
  args: {
    book: 'Psalm',
    chapter: 23,
    verse: 1,
    text: 'The Lord is my shepherd, I lack nothing.',
  },
};

/**
 * Different book - Genesis
 * Creation verse
 */
export const Genesis: Story = {
  args: {
    book: 'Genesis',
    chapter: 1,
    verse: 1,
    text: 'In the beginning God created the heavens and the earth.',
    highlighted: true,
  },
};
