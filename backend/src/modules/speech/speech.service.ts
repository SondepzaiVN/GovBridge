import type { SttInput, SttProvider, SttResult, TtsInput, TtsProvider, TtsResult } from './speech.types.js';

export class SpeechService {
  constructor(
    private readonly ttsProvider: TtsProvider,
    private readonly sttProvider: SttProvider,
  ) {}

  async synthesize(input: TtsInput): Promise<TtsResult> {
    return this.ttsProvider.synthesize(input);
  }

  async transcribe(input: SttInput): Promise<SttResult> {
    return this.sttProvider.transcribe(input);
  }
}
