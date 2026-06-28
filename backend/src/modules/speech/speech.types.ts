export interface TtsInput {
  text: string;
  speed: number;
  voice: string;
  domain: string;
}

export interface TtsResult {
  provider: 'mock' | 'vnpt';
  audioUrl: string | null;
  useBrowserFallback: boolean;
}

export interface TtsProvider {
  readonly name: 'mock' | 'vnpt';
  synthesize(input: TtsInput): Promise<TtsResult>;
}
