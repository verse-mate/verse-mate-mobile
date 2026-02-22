import { escapeSQL } from '../sql-utils';

describe('sqlite-manager escapeSQL', () => {
  it('escapes single quotes correctly', () => {
    expect(escapeSQL("O'Reilly")).toBe("'O''Reilly'");
    expect(escapeSQL("User's Data")).toBe("'User''s Data'");
    expect(escapeSQL("'")).toBe("''''");
  });

  it('handles null and undefined', () => {
    expect(escapeSQL(null)).toBe('NULL');
    expect(escapeSQL(undefined)).toBe('NULL');
  });

  it('handles numbers', () => {
    expect(escapeSQL(123)).toBe('123');
    expect(escapeSQL(0)).toBe('0');
    expect(escapeSQL(-45.67)).toBe('-45.67');
  });

  it('handles empty strings', () => {
    expect(escapeSQL('')).toBe("''");
  });

  it('handles strings without quotes', () => {
    expect(escapeSQL('Hello World')).toBe("'Hello World'");
  });

  it('handles complex strings', () => {
    const input = "Robert'); DROP TABLE Students;--";
    expect(escapeSQL(input)).toBe("'Robert''); DROP TABLE Students;--'");
  });
});
