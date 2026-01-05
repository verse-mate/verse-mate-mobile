import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/auth/token-storage';

export function useDeleteAccount() {
  const { logout } = useAuth();
  const router = useRouter();
  const posthog = usePostHog();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async (password?: string) => {
    setError(null);
    setIsDeleting(true);

    try {
      // Track deletion initiated
      posthog?.capture('DELETION_INITIATED', {
        has_password: !!password,
      });

      // Get access token for authentication
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // Call API to delete account
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.versemate.org';
      const response = await fetch(`${baseUrl}/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: password ? JSON.stringify({ password }) : undefined,
      });

      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401 || errorData.error === 'UNAUTHORIZED') {
          setError('The password you entered is incorrect.');
          posthog?.capture('DELETION_FAILED', {
            error_type: 'invalid_password',
          });
        } else if (response.status === 429 || errorData.error === 'TOO_MANY_REQUESTS') {
          setError('Too many attempts. Please try again later.');
          posthog?.capture('DELETION_FAILED', {
            error_type: 'rate_limit',
          });
        } else if (
          errorData.error === 'PASSWORD_REQUIRED' ||
          errorData.error === 'VALIDATION_ERROR'
        ) {
          setError('Password is required to delete your account.');
          posthog?.capture('DELETION_FAILED', {
            error_type: 'password_required',
          });
        } else {
          setError('An unexpected error occurred. Please try again.');
          posthog?.capture('DELETION_FAILED', {
            error_type: 'unknown',
          });
        }

        setIsDeleting(false);
        return false;
      }

      // Deletion successful
      posthog?.capture('DELETION_COMPLETED');

      // Clear local data and logout
      await logout();

      // Navigate to auth screen
      router.replace('/auth/login');

      setIsDeleting(false);
      return true;
    } catch (err) {
      console.error('Delete account error:', err);
      setError('An unexpected error occurred. Please try again.');

      posthog?.capture('DELETION_FAILED', {
        error_type: 'network',
      });

      setIsDeleting(false);
      return false;
    }
  };

  const clearError = () => setError(null);

  return {
    deleteAccount,
    isDeleting,
    error,
    clearError,
  };
}
