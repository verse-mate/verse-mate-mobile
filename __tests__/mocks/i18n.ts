/**
 * A `t` that actually interpolates.
 *
 * A mock that returns the fallback verbatim renders `Only here: {{adds}}`, so a
 * test asserting on the interpolated value fails for a reason that has nothing
 * to do with the component — and, worse, one asserting on the label alone
 * passes while the value is missing from the screen. Doing the substitution
 * keeps both directions honest without pulling in real i18next.
 */
export function translateFallback(
  key: string,
  fallback?: string,
  vars?: Record<string, unknown>
): string {
  const template = fallback ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

export const useTranslationMock = () => ({ t: translateFallback });
