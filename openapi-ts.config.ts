import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-axios',
  input: './openapi.json',
  output: {
    format: 'prettier',
    path: './src/api/generated',
  },
  plugins: ['@tanstack/react-query'],
  types: {
    enums: 'javascript',
  },
});
