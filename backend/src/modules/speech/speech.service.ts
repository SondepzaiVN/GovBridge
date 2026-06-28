import type { TtsInput, TtsProvider, TtsResult } from './speech.types.js';

export class SpeechService {
  constructor(private readonly provider: TtsProvider) {}
  async synthesize(input: TtsInput): Promise<TtsResult> {
    return this.provider.synthesize(input);
  }
}
