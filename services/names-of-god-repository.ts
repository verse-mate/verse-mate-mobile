import type { NameOfGod } from '@/types/names-of-god';

let cache: NameOfGod[] | null = null;

function load(): NameOfGod[] {
  if (cache) return cache;
  // require() for Metro bundler and Jest compatibility
  const data = require('@/assets/names-of-god.json');
  cache = (data.default ?? data) as NameOfGod[];
  return cache;
}

export function getAll(): NameOfGod[] {
  return load();
}

export function clearCache(): void {
  cache = null;
}
