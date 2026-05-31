import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform } from 'react-native';
import { UpgradePromptScreen } from '@/src/screens/UpgradePromptScreen';
import { checkVersionPolicy } from '@/src/services/versionPolicy';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundElevated: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      gold: '#b09a6d',
      white: '#fff',
    },
    spacing: { sm: 8, md: 12, lg: 16, xl: 20 },
    typography: {
      heading2: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
      body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
  AnalyticsEvent: {
    VERSION_POLICY_FETCHED: 'version_policy_fetched',
    UPGRADE_PROMPT_SHOWN: 'upgrade_prompt_shown',
    UPGRADE_PROMPT_CTA_TAPPED: 'upgrade_prompt_cta_tapped',
    UPGRADE_PROMPT_DISMISSED: 'upgrade_prompt_dismissed',
  },
}));

jest.mock('@/src/services/versionPolicy');

const mockCheckVersionPolicy = checkVersionPolicy as jest.MockedFunction<typeof checkVersionPolicy>;

// `Platform.OS` gets re-defined in each platform-specific test. Snapshot the
// original value once so we can restore it between tests.
const ORIGINAL_PLATFORM_OS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    value: ORIGINAL_PLATFORM_OS,
    configurable: true,
  });
});

// ─── T7: UpgradePromptScreen component ───────────────────────────────────────

describe('UpgradePromptScreen', () => {
  it('renders title, body, and both buttons', () => {
    render(<UpgradePromptScreen currentVersion="1.5.0" minVersion="2.0.0" onDismiss={jest.fn()} />);

    expect(screen.getByTestId('upgrade-prompt-title')).toBeTruthy();
    expect(screen.getByTestId('upgrade-prompt-body')).toBeTruthy();
    expect(screen.getByTestId('upgrade-prompt-update-now')).toBeTruthy();
    expect(screen.getByTestId('upgrade-prompt-maybe-later')).toBeTruthy();
  });

  it('"Update Now" opens Play Store URL on Android', () => {
    // `Platform.OS` is a plain value (not a getter) under jest-expo, so
    // `jest.spyOn(Platform, 'OS', 'get')` errors with "Property `OS` does
    // not have access type get". Re-define it directly; afterEach restores
    // the original snapshot.
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    render(<UpgradePromptScreen currentVersion="1.5.0" minVersion="2.0.0" onDismiss={jest.fn()} />);

    fireEvent.press(screen.getByTestId('upgrade-prompt-update-now'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=org.versemate.app'
    );
  });

  it('"Update Now" opens App Store URL on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

    render(<UpgradePromptScreen currentVersion="1.5.0" minVersion="2.0.0" onDismiss={jest.fn()} />);

    fireEvent.press(screen.getByTestId('upgrade-prompt-update-now'));

    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^https:\/\/apps\.apple\.com\//);
  });

  it('"Maybe Later" calls onDismiss', () => {
    const onDismiss = jest.fn();

    render(<UpgradePromptScreen currentVersion="1.5.0" minVersion="2.0.0" onDismiss={onDismiss} />);

    fireEvent.press(screen.getByTestId('upgrade-prompt-maybe-later'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has correct a11y labels', () => {
    render(<UpgradePromptScreen currentVersion="1.5.0" minVersion="2.0.0" onDismiss={jest.fn()} />);

    expect(screen.getByLabelText('Update Now')).toBeTruthy();
    expect(screen.getByLabelText('Maybe Later, skip upgrade')).toBeTruthy();
  });
});

// ─── T8: startup integration — overlay shown/hidden based on mustUpgrade ─────

function VersionGate() {
  const [upgradeState, setUpgradeState] = useState<{
    mustUpgrade: boolean;
    currentVersion: string;
    minVersion: string;
    dismissed: boolean;
  }>({ mustUpgrade: false, currentVersion: '', minVersion: '', dismissed: false });
  const [checked, setChecked] = useState(false);

  const runCheck = async () => {
    const result = await checkVersionPolicy('1.5.0');
    setUpgradeState({
      mustUpgrade: result.mustUpgrade,
      currentVersion: '1.5.0',
      minVersion: result.minVersion,
      dismissed: false,
    });
    setChecked(true);
  };

  if (!checked) {
    runCheck();
    return null;
  }

  return upgradeState.mustUpgrade && !upgradeState.dismissed ? (
    <UpgradePromptScreen
      currentVersion={upgradeState.currentVersion}
      minVersion={upgradeState.minVersion}
      onDismiss={() => setUpgradeState((prev) => ({ ...prev, dismissed: true }))}
    />
  ) : null;
}

describe('T8 startup integration', () => {
  it('shows upgrade prompt when mustUpgrade is true', async () => {
    mockCheckVersionPolicy.mockResolvedValueOnce({
      mustUpgrade: true,
      minVersion: '2.0.0',
      version: '2.0.0',
      releaseNotes: '',
    });

    render(<VersionGate />);

    await waitFor(() => {
      expect(screen.getByTestId('upgrade-prompt-overlay')).toBeTruthy();
    });
  });

  it('does not show upgrade prompt when mustUpgrade is false', async () => {
    mockCheckVersionPolicy.mockResolvedValueOnce({
      mustUpgrade: false,
      minVersion: '1.0.0',
      version: '2.0.0',
      releaseNotes: '',
    });

    render(<VersionGate />);

    await waitFor(() => {
      expect(screen.queryByTestId('upgrade-prompt-overlay')).toBeNull();
    });
  });

  it('hides upgrade prompt after "Maybe Later" is pressed', async () => {
    mockCheckVersionPolicy.mockResolvedValueOnce({
      mustUpgrade: true,
      minVersion: '2.0.0',
      version: '2.0.0',
      releaseNotes: '',
    });

    render(<VersionGate />);

    await waitFor(() => {
      expect(screen.getByTestId('upgrade-prompt-overlay')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('upgrade-prompt-maybe-later'));

    await waitFor(() => {
      expect(screen.queryByTestId('upgrade-prompt-overlay')).toBeNull();
    });
  });
});
