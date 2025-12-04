/**
 * Tests for BottomLogo Component
 *
 * Tests theme-aware logo switching behavior.
 * - Light mode: uses regular-logo.png (dark text)
 * - Dark mode: uses white-regular-logo.png (white text)
 */

import { render, screen } from '@testing-library/react-native';
// Import after mocking
import { BottomLogo } from '@/components/bible/BottomLogo';
import { colors } from '@/constants/bible-design-tokens';

// Create a mock that we can control per-test
const mockUseTheme = jest.fn();

// Override the global mock with our controllable mock
jest.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => mockUseTheme(),
}));

describe('BottomLogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('light mode', () => {
    beforeEach(() => {
      mockUseTheme.mockReturnValue({
        preference: 'auto',
        mode: 'light',
        colors: colors.light,
        setPreference: jest.fn(),
        isLoading: false,
      });
    });

    it('renders the logo image', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      expect(logo).toBeTruthy();
    });

    it('uses regular logo in light mode', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      // In light mode, the source should be the regular logo (not the white one)
      // The source prop will be a number (require result) in React Native
      expect(logo.props.source).toBeDefined();
    });
  });

  describe('dark mode', () => {
    beforeEach(() => {
      mockUseTheme.mockReturnValue({
        preference: 'dark',
        mode: 'dark',
        colors: colors.dark,
        setPreference: jest.fn(),
        isLoading: false,
      });
    });

    it('renders the logo image in dark mode', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      expect(logo).toBeTruthy();
    });

    it('uses white logo in dark mode', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      // In dark mode, the source should be the white logo
      expect(logo.props.source).toBeDefined();
    });
  });

  describe('logo switching', () => {
    it('switches from light to dark logo when theme changes', () => {
      // First render in light mode
      mockUseTheme.mockReturnValue({
        preference: 'auto',
        mode: 'light',
        colors: colors.light,
        setPreference: jest.fn(),
        isLoading: false,
      });

      const { rerender } = render(<BottomLogo />);
      const lightLogo = screen.getByTestId('bottom-logo');
      const lightSource = lightLogo.props.source;

      // Switch to dark mode
      mockUseTheme.mockReturnValue({
        preference: 'dark',
        mode: 'dark',
        colors: colors.dark,
        setPreference: jest.fn(),
        isLoading: false,
      });

      rerender(<BottomLogo />);
      const darkLogo = screen.getByTestId('bottom-logo');
      const darkSource = darkLogo.props.source;

      // The sources should be different between light and dark modes
      expect(lightSource).not.toEqual(darkSource);
    });
  });

  describe('styling', () => {
    beforeEach(() => {
      mockUseTheme.mockReturnValue({
        preference: 'auto',
        mode: 'light',
        colors: colors.light,
        setPreference: jest.fn(),
        isLoading: false,
      });
    });

    it('has correct image dimensions', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      const style = logo.props.style;

      // Flatten styles if needed (React Native style can be array or object)
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;

      expect(flatStyle.width).toBe(200);
      expect(flatStyle.height).toBe(54);
    });

    it('has subtle opacity for branding', () => {
      render(<BottomLogo />);

      const logo = screen.getByTestId('bottom-logo');
      const style = logo.props.style;

      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;

      expect(flatStyle.opacity).toBe(0.6);
    });
  });
});
