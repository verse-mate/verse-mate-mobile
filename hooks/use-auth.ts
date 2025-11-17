/**
 * useAuth Hook
 *
 * Simple hook to check if user is authenticated by checking for access token.
 * Returns user object with ID if authenticated, null otherwise.
 */

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth/token-storage';

interface User {
  id: string;
}

interface UseAuthReturn {
  /** User object if authenticated, null otherwise */
  user: User | null;
  /** Loading state while checking authentication */
  isLoading: boolean;
}

/**
 * Check if user is authenticated
 *
 * This is a simple implementation that checks for token presence.
 * For a full implementation, you might want to validate the token
 * and fetch user details from the API.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          // TODO: Decode JWT to get user ID, or fetch from API
          // For now, we just set a placeholder
          setUser({ id: 'current-user-id' });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  return {
    user,
    isLoading,
  };
}
