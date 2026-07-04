import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      ASSISTANT_PROVIDER: 'mock',
      ORCHESTRATOR_PROVIDER: 'mock',
      KNOWLEDGE_PROVIDER: 'mock',
      OCR_PROVIDER: 'mock',
      TTS_PROVIDER: 'mock',
      STT_PROVIDER: 'mock',
    },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
  },
});
