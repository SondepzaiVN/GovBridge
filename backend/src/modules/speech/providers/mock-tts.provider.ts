import type { TtsInput, TtsProvider, TtsResult } from '../speech.types.js';

export class MockTtsProvider implements TtsProvider {
  readonly name = 'mock' as const;

  async synthesize(_input: TtsInput): Promise<TtsResult> {
    return { provider: this.name, audioUrl: null, useBrowserFallback: true };
  }
}
