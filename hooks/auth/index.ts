/**
 * Auth Hooks Index
 *
 * Re-exports all authentication-related hooks.
 */

export type { UseAppleSignInReturn } from './useAppleSignIn';
export { isAppleSignInEnabled, useAppleSignIn } from './useAppleSignIn';
export type { UseGoogleSignInReturn } from './useGoogleSignIn';
export { isGoogleSignInConfigured, useGoogleSignIn } from './useGoogleSignIn';
export type { UseSSOLoginReturn } from './useSSOLogin';
export { useSSOLogin } from './useSSOLogin';
