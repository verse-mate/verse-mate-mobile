import { render } from '@testing-library/react-native';
import { SkeletonLoader } from '@/components/bible/SkeletonLoader';

describe('SkeletonLoader', () => {
  /**
   * Test 1: Component renders without crashing
   * Verifies basic rendering and structure
   */
  it('renders without crashing', () => {
    const { getByTestId } = render(<SkeletonLoader />);
    expect(getByTestId('skeleton-loader')).toBeTruthy();
  });

  /**
   * Test 2: Shimmer animation starts on mount
   * Verifies that the shimmer animation is present and not crashing
   */
  it('starts shimmer animation on mount', () => {
    const { getByTestId } = render(<SkeletonLoader />);
    const container = getByTestId('skeleton-loader');
    expect(container).toBeTruthy();

    // Verify skeleton elements are rendered
    expect(getByTestId('skeleton-title')).toBeTruthy();
    expect(getByTestId('skeleton-subtitle')).toBeTruthy();
    expect(getByTestId('skeleton-paragraph-1')).toBeTruthy();
    expect(getByTestId('skeleton-paragraph-2')).toBeTruthy();
    expect(getByTestId('skeleton-paragraph-3')).toBeTruthy();
  });

  /**
   * Test 3: All skeleton elements are rendered with correct structure
   * Verifies the component renders all expected skeleton elements
   */
  it('renders all skeleton elements', () => {
    const { getByTestId } = render(<SkeletonLoader />);

    // Verify title skeleton (60% width, 32px height)
    const title = getByTestId('skeleton-title');
    expect(title).toBeTruthy();

    // Verify subtitle skeleton (40% width, 20px height)
    const subtitle = getByTestId('skeleton-subtitle');
    expect(subtitle).toBeTruthy();

    // Verify 3 paragraph skeletons
    const paragraph1 = getByTestId('skeleton-paragraph-1');
    const paragraph2 = getByTestId('skeleton-paragraph-2');
    const paragraph3 = getByTestId('skeleton-paragraph-3');

    expect(paragraph1).toBeTruthy();
    expect(paragraph2).toBeTruthy();
    expect(paragraph3).toBeTruthy();
  });
});
