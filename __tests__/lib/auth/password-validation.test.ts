/**
 * Password Validation Tests
 *
 * Focused tests for password validation logic.
 * Tests critical behaviors: regex validation and requirement status.
 */

import {
  getPasswordRequirements,
  PASSWORD_AT_LEAST_ONE_LETTER,
  PASSWORD_AT_LEAST_ONE_NUMBER,
  PASSWORD_MIN_LENGTH_REGEX,
  PASSWORD_REGEX,
  validatePassword,
} from '@/lib/auth/password-validation';

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('Test1234')).toBe(true);
      expect(validatePassword('abc12345')).toBe(true);
      expect(validatePassword('12345abc')).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      expect(validatePassword('password')).toBe(false);
      expect(validatePassword('abcdefgh')).toBe(false);
    });

    it('should reject passwords without letters', () => {
      expect(validatePassword('12345678')).toBe(false);
      expect(validatePassword('123456789')).toBe(false);
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(validatePassword('abc123')).toBe(false);
      expect(validatePassword('test1')).toBe(false);
      expect(validatePassword('a1')).toBe(false);
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return all requirements met for valid password', () => {
      const requirements = getPasswordRequirements('password123');

      expect(requirements).toHaveLength(3);
      expect(requirements[0].text).toBe('At least 8 characters');
      expect(requirements[0].met).toBe(true);
      expect(requirements[1].text).toBe('At least 1 numeric character');
      expect(requirements[1].met).toBe(true);
      expect(requirements[2].text).toBe('At least 1 letter');
      expect(requirements[2].met).toBe(true);
    });

    it('should show unmet requirements for short password', () => {
      const requirements = getPasswordRequirements('abc1');

      expect(requirements[0].met).toBe(false); // Length requirement
      expect(requirements[1].met).toBe(true); // Has number
      expect(requirements[2].met).toBe(true); // Has letter
    });

    it('should show unmet requirements for password without numbers', () => {
      const requirements = getPasswordRequirements('abcdefgh');

      expect(requirements[0].met).toBe(true); // Length requirement
      expect(requirements[1].met).toBe(false); // No numbers
      expect(requirements[2].met).toBe(true); // Has letters
    });

    it('should show unmet requirements for password without letters', () => {
      const requirements = getPasswordRequirements('12345678');

      expect(requirements[0].met).toBe(true); // Length requirement
      expect(requirements[1].met).toBe(true); // Has numbers
      expect(requirements[2].met).toBe(false); // No letters
    });
  });

  describe('Password Regex Constants', () => {
    it('should have correct PASSWORD_REGEX pattern', () => {
      // Verify regex matches web version exactly
      expect(PASSWORD_REGEX.toString()).toBe('/^(?=.*[A-Za-z])(?=.*\\d).{8,}$/');
    });

    it('should have correct PASSWORD_MIN_LENGTH_REGEX pattern', () => {
      expect(PASSWORD_MIN_LENGTH_REGEX.toString()).toBe('/^.{8,}$/');
    });

    it('should have correct PASSWORD_AT_LEAST_ONE_NUMBER pattern', () => {
      expect(PASSWORD_AT_LEAST_ONE_NUMBER.toString()).toBe('/[\\d]/');
    });

    it('should have correct PASSWORD_AT_LEAST_ONE_LETTER pattern', () => {
      expect(PASSWORD_AT_LEAST_ONE_LETTER.toString()).toBe('/[a-zA-Z]/');
    });
  });
});
