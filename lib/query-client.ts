import NetInfo from '@react-native-community/netinfo';
import { MutationCache, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { onMutationError, onQueryError } from '@/lib/analytics/react-query-error-tracking';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onQueryError }),
  mutationCache: new MutationCache({ onError: onMutationError }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 0,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected === true);
  })
);
