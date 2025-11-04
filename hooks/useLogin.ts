/**
 * useLogin Hook
 *
 * Provides login mutation integrated with auth context.
 * Wraps generated React Query mutation for login endpoint.
 *
 * @see Task Group 4.5: Create useLogin.ts
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { postAuthLoginMutation } from '@/src/api/generated/@tanstack/react-query.gen';

/**
 * Login hook that integrates with auth context
 *
 * @returns Mutation result with login method and state (loading, error)
 *
 * @example
 * ```tsx
 * const { mutate: login, isPending, error } = useLogin();
 *
 * const handleLogin = () => {
 *   login({
 *     email: 'john@example.com',
 *     password: 'password123'
 *   });
 * };
 * ```
 */
export function useLogin() {
  const { login: authLogin } = useAuth();

  return useMutation({
    ...postAuthLoginMutation(),
    onSuccess: async (_data, variables) => {
      // Call auth context's login method to update state
      await authLogin(variables.body?.email, variables.body?.password);
    },
  });
}
