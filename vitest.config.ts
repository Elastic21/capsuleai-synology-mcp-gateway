import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@cybergogne/common': fileURLToPath(new URL('./packages/common/src/index.ts', import.meta.url)),
      '@cybergogne/schemas': fileURLToPath(new URL('./packages/schemas/src/index.ts', import.meta.url)),
      '@cybergogne/registry': fileURLToPath(new URL('./packages/registry/src/index.ts', import.meta.url)),
      '@cybergogne/scope-resolver': fileURLToPath(new URL('./packages/scope-resolver/src/index.ts', import.meta.url)),
      '@cybergogne/confluence': fileURLToPath(new URL('./packages/confluence/src/index.ts', import.meta.url)),
      '@cybergogne/diff-engine': fileURLToPath(new URL('./packages/diff-engine/src/index.ts', import.meta.url)),
      '@cybergogne/proposals': fileURLToPath(new URL('./packages/proposals/src/index.ts', import.meta.url)),
      '@cybergogne/approvals': fileURLToPath(new URL('./packages/approvals/src/index.ts', import.meta.url)),
      '@cybergogne/publishing': fileURLToPath(new URL('./packages/publishing/src/index.ts', import.meta.url)),
      '@cybergogne/audit': fileURLToPath(new URL('./packages/audit/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts'],
    root: repoRoot,
  },
});
