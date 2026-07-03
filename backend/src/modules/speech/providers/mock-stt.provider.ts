import type { SttInput, SttProvider, SttResult } from '../speech.types.js';

export class MockSttProvider implements SttProvider {
  readonly name = 'mock' as const;

  async transcribe(_input: SttInput): Promise<SttResult> {
    return {
      provider: this.name,
      transcript: 'Xin chào',
      confidence: null,
      audioDuration: null,
    };
  }
}
