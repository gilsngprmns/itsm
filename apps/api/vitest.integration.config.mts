import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['integration-tests/**/*.integration.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
})
