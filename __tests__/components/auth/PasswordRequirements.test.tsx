import { render } from '@testing-library/react-native';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';

describe('PasswordRequirements Component', () => {
  it('renders all password requirements', () => {
    const { getByText } = render(<PasswordRequirements password="" />);

    expect(getByText('At least 8 characters')).toBeTruthy();
    expect(getByText('At least 1 numeric character')).toBeTruthy();
    expect(getByText('At least 1 letter')).toBeTruthy();
  });

  it('shows unmet requirements for empty password', () => {
    const { getByTestId } = render(<PasswordRequirements password="" />);

    // All requirements should be unmet (neutral state)
    expect(getByTestId('requirement-0-unmet')).toBeTruthy();
    expect(getByTestId('requirement-1-unmet')).toBeTruthy();
    expect(getByTestId('requirement-2-unmet')).toBeTruthy();
  });

  it('updates requirements in real-time as password meets criteria', () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <PasswordRequirements password="abc" />
    );

    // Password "abc" only meets letter requirement
    expect(queryByTestId('requirement-0-unmet')).toBeTruthy(); // length not met
    expect(queryByTestId('requirement-1-unmet')).toBeTruthy(); // number not met
    expect(getByTestId('requirement-2-met')).toBeTruthy(); // letter met

    // Update to password that meets all requirements
    rerender(<PasswordRequirements password="abcdefgh1" />);

    expect(getByTestId('requirement-0-met')).toBeTruthy(); // length met
    expect(getByTestId('requirement-1-met')).toBeTruthy(); // number met
    expect(getByTestId('requirement-2-met')).toBeTruthy(); // letter met
  });

  it('shows partial completion for password with some requirements met', () => {
    const { getByTestId, queryByTestId } = render(<PasswordRequirements password="12345678" />);

    // Password "12345678" meets length and number, but not letter
    expect(getByTestId('requirement-0-met')).toBeTruthy(); // length met
    expect(getByTestId('requirement-1-met')).toBeTruthy(); // number met
    expect(queryByTestId('requirement-2-unmet')).toBeTruthy(); // letter not met
  });
});
