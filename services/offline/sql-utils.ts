/**
 * Escape a value for safe inclusion in raw SQL.
 * Used inside execSync-based transactions where parameterized queries
 * are not available. Data comes from our own API so injection risk is minimal,
 * but we still properly escape single quotes and strip NUL bytes (which
 * SQLite silently truncates strings at).
 */
export function escapeSQL(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replaceAll('\0', '').replaceAll("'", "''")}'`;
}
