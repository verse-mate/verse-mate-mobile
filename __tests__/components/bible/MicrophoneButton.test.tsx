import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { MicrophoneButton } from '@/components/bible/MicrophoneButton';

describe('MicrophoneButton', () => {
  it('should render idle state correctly', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<MicrophoneButton isListening={false} onPress={onPress} />);

    const button = getByTestId('mic-button');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityLabel).toBe('Start voice input');
  });

  it('should render recording state correctly', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<MicrophoneButton isListening={true} onPress={onPress} />);

    const button = getByTestId('mic-button');
    expect(button.props.accessibilityLabel).toBe('Stop voice input');
  });

  it('should render with hasError prop', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <MicrophoneButton isListening={false} hasError={true} onPress={onPress} />
    );

    const button = getByTestId('mic-button');
    expect(button).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<MicrophoneButton isListening={false} onPress={onPress} />);

    fireEvent.press(getByTestId('mic-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
