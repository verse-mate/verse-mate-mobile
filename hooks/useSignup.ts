/**
 * useSignup Hook
 *
 * Provides signup mutation integrated with auth context.
 * Wraps generated React Query mutation for signup endpoint.
 *
 * @see Task Group 4.4: Create useSignup.ts
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { postAuthSignupMutation } from '@/src/api/generated/@tanstack/react-query.gen';

/**
 * Signup hook that integrates with auth context
 *
 * @returns Mutation result with signup method and state (loading, error)
 *
 * @example
 * ```tsx
 * const { mutate: signup, isPending, error } = useSignup();
 *
 * const handleSignup = () => {
 *   signup({
 *     firstName: 'John',
 *     lastName: 'Doe',
 *     email: 'john@example.com',
 *     password: 'password123'
 *   });
 * };
 * ```
 */
export function useSignup() {
  const { signup: authSignup } = useAuth();

  return useMutation({
    ...postAuthSignupMutation(),
    onSuccess: async (_data, variables) => {
      // Call auth context's signup method to update state
      await authSignup(
        variables.body?.firstName,
        variables.body?.lastName,
        variables.body?.email,
        variables.body?.password
      );
    },
  });
}
