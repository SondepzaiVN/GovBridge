import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '../src/common/errors/app-error.js';
import { VnptOcrProvider } from '../src/integrations/vnpt/vnpt-ocr.provider.js';
import { VnptSmartReaderProvider } from '../src/integrations/vnpt/vnpt-smart-reader.provider.js';
import { VnptSttProvider } from '../src/integrations/vnpt/vnpt-stt.provider.js';
import { VnptTtsProvider } from '../src/integrations/vnpt/vnpt-tts.provider.js';

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const asJson = (init: RequestInit | undefined): Record<string, unknown> =>
  JSON.parse(String(init?.body)) as Record<string, unknown>;

const headersOf = (init: RequestInit | undefined): Headers => new Headers(init?.headers);

const multerFile = (buffer: Buffer, mimetype: string, originalname: string): Express.Multer.File => ({
  fieldname: 'file',
  originalname,
  encoding: '7bit',
  mimetype,
  size: buffer.length,
  buffer,
  destination: '',
  filename: originalname,
  path: '',
  stream: undefined as never,
});

describe('VNPT OCR provider contract', () => {
  it('uploads the image, calls OCR with required headers/payload and maps fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn(async (_input, _init) => {
      if (fetchMock.mock.calls.length === 1) {
        return jsonResponse({ object: { hash: 'front-hash' } });
      }
      return jsonResponse({
        object: {
          id: '012345678901',
          name: 'Nguyen Van An',
          birth_day: '01/02/2000',
          gender: 'Nam',
          origin_location: 'Ha Noi',
          recent_location: 'Ha Noi',
          issue_date: '03/04/2020',
          issue_place: 'Cuc CSQLHC',
        },
      });
    }) as typeof fetch);
    const provider = new VnptOcrProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-ocr-access',
      tokenId: 'token-id',
      tokenKey: 'secret-token-key',
      macAddress: 'mac',
    });

    const result = await provider.extractCccd({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      filename: 'cccd.jpg',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://vnpt.example/file-service/v1/addFile');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Authorization')).toBe('secret-ocr-access');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Token-id')).toBe('token-id');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Token-key')).toBe('secret-token-key');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://vnpt.example/ai/v1/web/ocr/id');
    expect(asJson(fetchMock.mock.calls[1]?.[1])).toEqual(expect.objectContaining({
      img_front: 'front-hash',
      type: -1,
      validate_postcode: false,
      crop_param: '0.0,0.0',
      token: 'token-id',
    }));
    expect(result).toEqual(expect.objectContaining({
      id: '012345678901',
      hoTen: 'NGUYEN VAN AN',
      ngaySinh: '2000-02-01',
      ngayCap: '2020-04-03',
    }));
  });

  it('maps HTTP, network and empty upload responses without exposing credentials', async () => {
    const httpFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ message: 'bad request' }, 500),
    );
    const httpProvider = new VnptOcrProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-ocr-access',
      tokenId: 'token-id',
      tokenKey: 'secret-token-key',
      macAddress: 'mac',
    });
    await expect(httpProvider.extractCccd({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      filename: 'cccd.jpg',
    })).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: expect.not.stringContaining('secret-ocr-access'),
    });
    httpFetch.mockRestore();

    const emptyFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ object: {} }));
    const emptyProvider = new VnptOcrProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-ocr-access',
      tokenId: 'token-id',
      tokenKey: 'secret-token-key',
      macAddress: 'mac',
    });
    await expect(emptyProvider.extractCccd({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      filename: 'cccd.jpg',
    })).rejects.toMatchObject({
      message: expect.not.stringContaining('secret-token-key'),
    });
    emptyFetch.mockRestore();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const networkProvider = new VnptOcrProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-ocr-access',
      tokenId: 'token-id',
      tokenKey: 'secret-token-key',
      macAddress: 'mac',
    });
    await expect(networkProvider.extractCccd({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      mimetype: 'image/jpeg',
      filename: 'cccd.jpg',
    })).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: expect.not.stringContaining('offline'),
    });
  });
});

describe('VNPT SmartReader provider contract', () => {
  it('uploads a document, scans it with required headers/payload and maps text/warnings', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return jsonResponse({ object: { hash: 'document-hash' } });
      }
      return jsonResponse({
        object: {
          lines: [{ text: 'Mẫu CT01' }, { text: 'Nội dung đề nghị' }],
          warning_messages: ['mờ nhẹ'],
          num_of_pages: 2,
        },
      });
    }) as typeof fetch);
    const provider = new VnptSmartReaderProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-reader-access',
      tokenId: 'reader-token-id',
      tokenKey: 'secret-reader-key',
      macAddress: 'mac',
      timeoutMs: 1_000,
    });

    const result = await provider.read({
      buffer: Buffer.from('%PDF'),
      mimetype: 'application/pdf',
      filename: 'ct01.pdf',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://vnpt.example/file-service/v1/addFile');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Authorization')).toBe('secret-reader-access');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Token-id')).toBe('reader-token-id');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://vnpt.example/rpa-service/aidigdoc/v1/ocr/scan-table');
    expect(asJson(fetchMock.mock.calls[1]?.[1])).toEqual(expect.objectContaining({
      file_hash: 'document-hash',
      token: 'reader-token-id',
      file_type: 'pdf',
      details: false,
    }));
    expect(result).toEqual({
      text: 'Mẫu CT01\nNội dung đề nghị',
      warnings: ['mờ nhẹ'],
      pageCount: 2,
      provider: 'vnpt-smartreader',
    });
  });

  it('maps HTTP, network and empty text responses without exposing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ object: { hash: 'hash' } }))
      .mockResolvedValueOnce(jsonResponse({ error: 'server down' }, 503));
    const provider = new VnptSmartReaderProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-reader-access',
      tokenId: 'reader-token-id',
      tokenKey: 'secret-reader-key',
      macAddress: 'mac',
      timeoutMs: 1_000,
    });
    await expect(provider.read({
      buffer: Buffer.from('%PDF'),
      mimetype: 'application/pdf',
      filename: 'ct01.pdf',
    })).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: expect.not.stringContaining('secret-reader-access'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ object: { hash: 'hash' } }))
      .mockResolvedValueOnce(jsonResponse({ object: { lines: [] } }));
    const emptyProvider = new VnptSmartReaderProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-reader-access',
      tokenId: 'reader-token-id',
      tokenKey: 'secret-reader-key',
      macAddress: 'mac',
      timeoutMs: 1_000,
    });
    await expect(emptyProvider.read({
      buffer: Buffer.from('%PDF'),
      mimetype: 'application/pdf',
      filename: 'ct01.pdf',
    })).rejects.toMatchObject({
      message: expect.not.stringContaining('secret-reader-key'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network secret-reader-access'));
    const networkProvider = new VnptSmartReaderProvider({
      baseUrl: 'https://vnpt.example',
      accessToken: 'secret-reader-access',
      tokenId: 'reader-token-id',
      tokenKey: 'secret-reader-key',
      macAddress: 'mac',
      timeoutMs: 1_000,
    });
    await expect(networkProvider.read({
      buffer: Buffer.from('%PDF'),
      mimetype: 'application/pdf',
      filename: 'ct01.pdf',
    })).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('VNPT TTS provider contract', () => {
  it('posts the expected headers and payload and maps the audio URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      object: { playlist: [{ audio_link: 'https://cdn.example/audio.wav' }] },
    }));
    const provider = new VnptTtsProvider({
      url: 'https://vnpt.example/tts',
      accessToken: 'Bearer secret-tts-access',
      tokenId: 'tts-token-id',
      tokenKey: 'secret-tts-key',
    });

    await expect(provider.synthesize({
      text: 'Xin chào',
      speed: 1.1,
      voice: 'female_south',
      domain: 'general',
    })).resolves.toEqual({
      provider: 'vnpt',
      audioUrl: 'https://cdn.example/audio.wav',
      useBrowserFallback: false,
    });

    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Authorization')).toBe('Bearer secret-tts-access');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('token-id')).toBe('tts-token-id');
    expect(asJson(fetchMock.mock.calls[0]?.[1])).toEqual({
      text: 'Xin chào',
      speed: '1.1',
      region: 'female_south',
      domain: 'general',
    });
  });

  it('maps HTTP, network and missing audio URL responses without exposing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 500));
    const provider = new VnptTtsProvider({
      url: 'https://vnpt.example/tts',
      accessToken: 'secret-tts-access',
      tokenId: 'tts-token-id',
      tokenKey: 'secret-tts-key',
    });
    const input = { text: 'Xin chào', speed: 1, voice: 'female_south', domain: 'general' };
    await expect(provider.synthesize(input)).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: expect.not.stringContaining('secret-tts-access'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ object: { playlist: [] } }));
    const emptyProvider = new VnptTtsProvider({
      url: 'https://vnpt.example/tts',
      accessToken: 'secret-tts-access',
      tokenId: 'tts-token-id',
      tokenKey: 'secret-tts-key',
    });
    await expect(emptyProvider.synthesize(input)).rejects.toMatchObject({
      message: expect.not.stringContaining('secret-tts-key'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const networkProvider = new VnptTtsProvider({
      url: 'https://vnpt.example/tts',
      accessToken: 'secret-tts-access',
      tokenId: 'tts-token-id',
      tokenKey: 'secret-tts-key',
    });
    await expect(networkProvider.synthesize(input)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('VNPT STT provider contract', () => {
  it('posts multipart audio with required headers and maps the transcript', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      object: {
        status: 'OK',
        audio_duration: 1.5,
        results: [{ alternatives: [{ transcript: 'Xin chào', confidence: 0.91 }] }],
      },
    }));
    const provider = new VnptSttProvider({
      url: 'https://vnpt.example/stt',
      accessToken: 'Bearer secret-stt-access',
      tokenId: 'stt-token-id',
      tokenKey: 'secret-stt-key',
      timeoutMs: 1_000,
    });

    await expect(provider.transcribe({
      file: multerFile(Buffer.from('audio'), 'audio/mpeg', 'recording.mp3'),
      clientSession: 'client-session',
    })).resolves.toEqual({
      provider: 'vnpt',
      transcript: 'Xin chào',
      confidence: 0.91,
      audioDuration: 1.5,
    });

    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Authorization')).toBe('Bearer secret-stt-access');
    expect(headersOf(fetchMock.mock.calls[0]?.[1]).get('Token-id')).toBe('stt-token-id');
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get('clientSession')).toBe('client-session');
    expect(form.get('maxAlternatives')).toBe('1');
    expect(form.get('customConfiguration')).toBe(JSON.stringify({ convert_format: 'mp3' }));
  });

  it('maps HTTP, network and empty transcript responses without exposing credentials', async () => {
    const input = {
      file: multerFile(Buffer.from('audio'), 'audio/wav', 'recording.wav'),
      clientSession: 'client-session',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 500));
    const provider = new VnptSttProvider({
      url: 'https://vnpt.example/stt',
      accessToken: 'secret-stt-access',
      tokenId: 'stt-token-id',
      tokenKey: 'secret-stt-key',
      timeoutMs: 1_000,
    });
    await expect(provider.transcribe(input)).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: expect.not.stringContaining('secret-stt-access'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      object: { status: 'OK', results: [{ alternatives: [{ transcript: '' }] }] },
    }));
    const emptyProvider = new VnptSttProvider({
      url: 'https://vnpt.example/stt',
      accessToken: 'secret-stt-access',
      tokenId: 'stt-token-id',
      tokenKey: 'secret-stt-key',
      timeoutMs: 1_000,
    });
    await expect(emptyProvider.transcribe(input)).rejects.toMatchObject({
      message: expect.not.stringContaining('secret-stt-key'),
    });
    vi.restoreAllMocks();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    const networkProvider = new VnptSttProvider({
      url: 'https://vnpt.example/stt',
      accessToken: 'secret-stt-access',
      tokenId: 'stt-token-id',
      tokenKey: 'secret-stt-key',
      timeoutMs: 1_000,
    });
    await expect(networkProvider.transcribe(input)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
