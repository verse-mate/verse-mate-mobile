/**
 * StudyPanel Component Tests
 *
 * Smoke tests for the inductive-study renderer. Covers:
 *   - empty / loading states
 *   - collapse-by-default behavior
 *   - Expand All / Collapse All toggle
 *   - per-card toggling
 *   - Copy button invokes the clipboard with the serialized payload
 *
 * The `@versemate/studies` package is mocked so tests stay deterministic and
 * don't depend on shipped chapter content evolving over time.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { StudyPanel } from '@/components/bible/StudyPanel';
import { ThemeProvider } from '@/contexts/ThemeContext';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));
// Render markdown children as plain Text so body strings show up in queries.
jest.mock('react-native-markdown-display', () => {
  // biome-ignore lint/correctness/noUnusedVariables: required inside factory
  const React = require('react');
  const { Text } = require('react-native');
  return function MockMarkdown({ children }: { children: string }) {
    return React.createElement(Text, null, children);
  };
});

const mockGetStudyFor = jest.fn();
jest.mock('@versemate/studies', () => ({
  getStudyFor: (...args: unknown[]) => mockGetStudyFor(...args),
}));

import * as Clipboard from 'expo-clipboard';

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

const minimalStudy = {
  bookName: 'James',
  title: 'James 1',
  subtitle: 'Testing your faith',
  themeOneLine: 'Faith stands firm under trial.',
  steps: [
    {
      number: 1,
      kind: 'prose' as const,
      title: 'Begin with prayer',
      summary: 'Ask the Author before you read.',
      body: 'Open the chapter prayerfully.',
    },
    {
      number: 2,
      kind: 'qa' as const,
      title: 'Ask who, what, when, where',
      summary: 'Find the 5 Ws.',
      items: [
        { tag: 'WHO', q: 'Who wrote this?', a: 'James, a servant of God.' },
        { q: 'When was it written?', a: 'Early — pre-AD 50.' },
      ],
    },
  ],
  interpretation: {
    intro: 'Reading the movements in order',
    movements: [
      {
        number: 1,
        range: '1:1-12',
        title: 'Trials produce maturity',
        body: 'When trials come, count it joy.',
      },
    ],
  },
  application: {
    intro: 'One question per movement.',
    questions: [{ range: '1:1-12', question: 'What trial are you facing today?' }],
  },
};

describe('StudyPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state before the chapter resolves', () => {
    // Never resolve so loading state stays visible
    mockGetStudyFor.mockReturnValue(new Promise(() => {}));

    renderWithTheme(<StudyPanel bookId={59} chapter={1} />);

    expect(screen.getByTestId('study-panel-loading')).toBeTruthy();
  });

  it('shows empty state when no study is available', async () => {
    mockGetStudyFor.mockResolvedValue(null);

    renderWithTheme(<StudyPanel bookId={59} chapter={99} />);

    await waitFor(() => expect(screen.getByTestId('study-panel-empty')).toBeTruthy());
  });

  it('renders title + theme line and starts collapsed', async () => {
    mockGetStudyFor.mockResolvedValue(minimalStudy);

    renderWithTheme(<StudyPanel bookId={59} chapter={1} />);

    await waitFor(() => expect(screen.getByTestId('study-panel-title')).toBeTruthy());

    expect(screen.getByTestId('study-panel-theme')).toBeTruthy();
    // Step 1 card exists (collapsed)
    expect(screen.getByTestId('study-panel-step-1')).toBeTruthy();
    // Body text from the prose step should NOT be visible while collapsed
    expect(screen.queryByText('Open the chapter prayerfully.')).toBeNull();
  });

  it('Expand All reveals all card bodies; Collapse All hides them again', async () => {
    mockGetStudyFor.mockResolvedValue(minimalStudy);

    renderWithTheme(<StudyPanel bookId={59} chapter={1} />);

    await waitFor(() => expect(screen.getByTestId('study-panel-toggle-all')).toBeTruthy());

    fireEvent.press(screen.getByTestId('study-panel-toggle-all'));
    // Movement body becomes visible
    expect(screen.getByText('When trials come, count it joy.')).toBeTruthy();
    // Application question visible
    expect(screen.getByText('What trial are you facing today?')).toBeTruthy();

    fireEvent.press(screen.getByTestId('study-panel-toggle-all'));
    // Body re-hidden
    expect(screen.queryByText('When trials come, count it joy.')).toBeNull();
  });

  it('toggling an individual step card overrides bulk state', async () => {
    mockGetStudyFor.mockResolvedValue(minimalStudy);

    renderWithTheme(<StudyPanel bookId={59} chapter={1} />);

    await waitFor(() => expect(screen.getByTestId('study-panel-step-1-toggle')).toBeTruthy());

    fireEvent.press(screen.getByTestId('study-panel-step-1-toggle'));
    // Step 2 is still collapsed
    expect(screen.queryByText(/James, a servant of God\./)).toBeNull();
  });

  it('Copy button writes the serialized payload to the clipboard', async () => {
    mockGetStudyFor.mockResolvedValue(minimalStudy);

    renderWithTheme(<StudyPanel bookId={59} chapter={1} />);

    await waitFor(() => expect(screen.getByTestId('study-panel-copy')).toBeTruthy());

    fireEvent.press(screen.getByTestId('study-panel-copy'));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1));
    const payload = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0] as string;
    expect(payload).toContain('Inductive Study of James 1');
    expect(payload).toContain('Theme: Faith stands firm under trial.');
    expect(payload).toContain('OBSERVATION — 9 INDUCTIVE STEPS');
    expect(payload).toContain('INTERPRETATION');
    expect(payload).toContain('APPLICATION');
  });
});
