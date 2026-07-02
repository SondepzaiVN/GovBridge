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

export interface SttInput {
  file: Express.Multer.File;
  clientSession?: string;
}

export interface SttResult {
  provider: 'mock' | 'vnpt';
  transcript: string;
  confidence: number | null;
  audioDuration: number | null;
}

export interface SttProvider {
  readonly name: 'mock' | 'vnpt';
  transcribe(input: SttInput): Promise<SttResult>;
}
