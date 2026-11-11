export const LOCAL_API_URL = 'http://localhost:4000';

export function resolveApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL || LOCAL_API_URL;
}
