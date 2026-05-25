/**
 * Smoke tests for the onboarding feature previews + slide template.
 *
 * These render the leaf components in isolation (theme is auto-mocked globally)
 * to guard against runtime crashes — e.g. a missing theme token or a bad SVG
 * prop — without needing the PagerView / router / reanimated stack.
 */

import { render } from '@testing-library/react-native';
import {
  InductivePreview,
  LanguagesPreview,
  LevelsPreview,
  LexiconPreview,
  SharePreview,
  TopicsPreview,
  VerseInsightPreview,
  VisualsPreview,
  WelcomePreview,
} from '@/components/onboarding/OnboardingPreviews';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';

describe('OnboardingSlide', () => {
  it('renders eyebrow, title, and body', () => {
    const { getByText } = render(
      <OnboardingSlide eyebrow="ORIGINAL LANGUAGES" title="Greek & Hebrew" body="A description.">
        {null}
      </OnboardingSlide>
    );
    expect(getByText('ORIGINAL LANGUAGES')).toBeTruthy();
    expect(getByText('Greek & Hebrew')).toBeTruthy();
    expect(getByText('A description.')).toBeTruthy();
  });
});

describe('Onboarding previews', () => {
  it('WelcomePreview renders the reader mock', () => {
    expect(render(<WelcomePreview />).getByText('Genesis 1')).toBeTruthy();
  });

  it('VerseInsightPreview renders the insight card', () => {
    expect(render(<VerseInsightPreview />).getByText('Verse Insight')).toBeTruthy();
  });

  it('LevelsPreview renders the explanation levels', () => {
    expect(render(<LevelsPreview />).getByText('By Line')).toBeTruthy();
  });

  it('TopicsPreview renders topic rows', () => {
    expect(render(<TopicsPreview />).getByText('Prophecies')).toBeTruthy();
  });

  it('SharePreview renders share actions', () => {
    expect(render(<SharePreview />).getByText('Share')).toBeTruthy();
  });

  it('LexiconPreview renders the Greek definition card', () => {
    const { getByText } = render(<LexiconPreview />);
    expect(getByText('G2316')).toBeTruthy();
    expect(getByText('θεός')).toBeTruthy();
  });

  it('InductivePreview renders the 9-step list', () => {
    expect(render(<InductivePreview />).getByText('9 inductive steps')).toBeTruthy();
  });

  it('VisualsPreview renders the video card', () => {
    expect(render(<VisualsPreview />).getByText('Book Overview')).toBeTruthy();
  });

  it('LanguagesPreview renders language chips', () => {
    expect(render(<LanguagesPreview />).getByText('English')).toBeTruthy();
  });
});
