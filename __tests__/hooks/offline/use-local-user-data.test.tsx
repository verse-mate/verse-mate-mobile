import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useLocalAllNotes } from '../../../hooks/offline/use-local-user-data';
import * as sqliteManager from '../../../services/offline/sqlite-manager';

// Mock sqlite-manager
jest.mock('../../../services/offline/sqlite-manager', () => ({
  getLocalAllNotes: jest.fn(),
  initDatabase: jest.fn().mockResolvedValue({}),
}));

describe('useLocalAllNotes', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('fetches all local notes', async () => {
    const mockNotes = [{ note_id: '1', content: 'Note 1' }];
    (sqliteManager.getLocalAllNotes as jest.Mock).mockResolvedValue(mockNotes);

    const { result } = renderHook(() => useLocalAllNotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockNotes);
    expect(sqliteManager.getLocalAllNotes).toHaveBeenCalled();
  });

  it('handles error in fetching notes', async () => {
    (sqliteManager.getLocalAllNotes as jest.Mock).mockRejectedValue(new Error('DB Error'));

    const { result } = renderHook(() => useLocalAllNotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });
});
