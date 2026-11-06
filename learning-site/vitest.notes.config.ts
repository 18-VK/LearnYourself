import { defineConfig } from 'vitest/config';
import { noteFidelityTests } from './vitest.config';

/** `npm run test:notes`: see noteFidelityTests in vitest.config.ts. */
export default defineConfig({
  test: {
    include: noteFidelityTests,
    environment: 'node',
  },
});
