import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-axios',
  input: './swagger.json',
  output: {
    format: 'prettier',
    path: './src/api/generated',
  },
  types: {
    enums: 'javascript',
  },
});
