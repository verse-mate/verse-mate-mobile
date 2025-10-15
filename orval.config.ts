import { defineConfig } from 'orval';

export default defineConfig({
  versemate: {
    input: {
      target: './openapi.json',
      validation: false,
    },
    output: {
      mode: 'tags-split',
      target: './src/api/generated/endpoints.ts',
      schemas: './src/api/generated/models',
      client: 'react-query',
      mock: false,
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/api/generated/client.ts',
          name: 'customAxiosInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'bun run format',
    },
  },
});
