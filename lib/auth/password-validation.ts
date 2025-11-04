/**
 * Password Validation Module
 *
 * Provides password validation logic matching the web version for consistency.
 * Regex patterns copied from ../verse-mate/packages/frontend-base/src/auth/lib.ts
 */

/**
 * Main password validation regex
 * Requires: minimum 8 characters, at least 1 letter, at least 1 number
 */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/**
 * Individual requirement regexes for UI feedback
 */
export const PASSWORD_MIN_LENGTH_REGEX = /^.{8,}$/;
export const PASSWORD_AT_LEAST_ONE_NUMBER = /[\d]/;
export const PASSWORD_AT_LEAST_ONE_LETTER = /[a-zA-Z]/;

/**
 * Password requirement definition for UI display
 */
export interface PasswordRequirement {
  text: string;
  regex: RegExp;
  met: boolean;
}

/**
 * Validate password against main requirements
 * @param password - Password string to validate
 * @returns true if password meets all requirements, false otherwise
 */
export function validatePassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

/**
 * Get password requirements with current status
 * Used for real-time UI feedback showing which requirements are met
 *
 * @param password - Password string to validate
 * @returns Array of requirement objects with met status
 */
export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      text: 'At least 8 characters',
      regex: PASSWORD_MIN_LENGTH_REGEX,
      met: PASSWORD_MIN_LENGTH_REGEX.test(password),
    },
    {
      text: 'At least 1 numeric character',
      regex: PASSWORD_AT_LEAST_ONE_NUMBER,
      met: PASSWORD_AT_LEAST_ONE_NUMBER.test(password),
    },
    {
      text: 'At least 1 letter',
      regex: PASSWORD_AT_LEAST_ONE_LETTER,
      met: PASSWORD_AT_LEAST_ONE_LETTER.test(password),
    },
  ];
}
