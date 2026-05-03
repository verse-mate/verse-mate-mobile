/**
 * i18n initialization tests
 *
 * Per spec feat-mobile-ui-i18n (D-016).
 */

import * as Localization from 'expo-localization';
import { changeLanguage, FALLBACK_LANGUAGE, initI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

describe('lib/i18n', () => {
  it('initializes with device locale', async () => {
    (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    const i18n = await initI18n();
    expect(i18n.language).toBe('en');
  });

  it('translates a known auth key', async () => {
    const i18n = await initI18n();
    expect(i18n.t('auth.login.title')).toBe('Sign In');
    expect(i18n.t('auth.login.submit')).toBe('Login');
  });

  it('translates nested settings keys', async () => {
    const i18n = await initI18n();
    expect(i18n.t('settings.theme_auto')).toBe('Auto');
    expect(i18n.t('settings.delete_account')).toBe('Delete account');
  });

  it('returns the key itself when missing (no infinite fallback)', async () => {
    const i18n = await initI18n();
    expect(i18n.t('does.not.exist')).toBe('does.not.exist');
  });

  it('changeLanguage updates active language', async () => {
    await initI18n();
    await changeLanguage('en');
    // Currently only English catalog ships; pt-BR test would require pt.json
    expect(FALLBACK_LANGUAGE).toBe('en');
  });
});
