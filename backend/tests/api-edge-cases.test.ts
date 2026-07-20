import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalServiceError } from '../src/common/errors/app-error.js';
import { createApp } from '../src/app.js';
import type { IdentityOcrProvider } from '../src/modules/identity/identity.types.js';
import { MockKnowledgeProvider } from '../src/modules/assistant/providers/mock-knowledge.provider.js';
import { MockOcrProvider } from '../src/modules/identity/providers/mock-ocr.provider.js';
import { MockOrchestratorProvider } from '../src/modules/assistant/providers/mock-orchestrator.provider.js';
import { MockSttProvider } from '../src/modules/speech/providers/mock-stt.provider.js';
import { MockTtsProvider } from '../src/modules/speech/providers/mock-tts.provider.js';
import { buildAssistantTools } from '../src/modules/assistant/tools/index.js';
import type { SttProvider, TtsProvider } from '../src/modules/speech/speech.types.js';

let dataDirectory: string;

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0x00]);
const webp = Buffer.from('RIFFxxxxWEBP', 'ascii');

const createTestApp = (overrides: Partial<Parameters<typeof createApp>[0]> = {}) => createApp({
  dataDirectory,
  ocrProvider: new MockOcrProvider(),
  ttsProvider: new MockTtsProvider(),
  sttProvider: new MockSttProvider(),
  orchestratorProvider: new MockOrchestratorProvider(buildAssistantTools()),
  knowledgeProvider: new MockKnowledgeProvider(),
  ...overrides,
});

const validCccdApplication = {
  serviceId: 'cccd',
  submittedAt: '2026-01-01T00:00:00.000Z',
  data: {
    hoTen: 'Nguyễn Văn An',
    ngaySinh: '2000-01-01',
    gioiTinh: 'Nam',
    queQuan: 'Hà Nội',
    thuongTru: 'Hà Nội',
    lyDoCap: 'het_han',
    sdt: '0901234567',
  },
};

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'gov-bridge-api-edge-'));
  await copyFile(path.resolve('src/storage/data/procedures.json'), path.join(dataDirectory, 'procedures.json'));
  await writeFile(path.join(dataDirectory, 'applications.json'), JSON.stringify({ schemaVersion: 1, applications: [] }));
  await writeFile(path.join(dataDirectory, 'assistant-sessions.json'), JSON.stringify({ schemaVersion: 1, sessions: [] }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (dataDirectory.startsWith(os.tmpdir())) await rm(dataDirectory, { recursive: true, force: true });
});

describe('API route validation and security basics', () => {
  it('returns consistent 404 and request id envelopes for unknown endpoints', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/missing-route')
      .set('x-request-id', 'edge-request-id')
      .expect(404);

    expect(response.headers['x-request-id']).toBe('edge-request-id');
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Không tồn tại endpoint GET /api/v1/missing-route.',
      },
      requestId: 'edge-request-id',
    });
  });

  it('rejects invalid procedure query params and returns unknown ids as 404', async () => {
    const invalidQuery = await request(createTestApp())
      .get('/api/v1/procedures?includeFields=yes')
      .expect(400);
    expect(invalidQuery.body.error.code).toBe('INVALID_REQUEST');
    expect(invalidQuery.body.error.details).toEqual([
      expect.objectContaining({ field: 'includeFields' }),
    ]);

    const unknown = await request(createTestApp())
      .get('/api/v1/procedures/khong-ton-tai')
      .expect(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });

  it('filters procedure lists by category/search and includes fields only when requested', async () => {
    const summaries = await request(createTestApp())
      .get('/api/v1/procedures?category=Cư%20trú&search=thường%20trú')
      .expect(200);

    expect(summaries.body.data.length).toBeGreaterThan(0);
    expect(summaries.body.data.every((item: { category: string; fields?: unknown }) =>
      item.category === 'Cư trú' && item.fields === undefined,
    )).toBe(true);
    expect(summaries.body.data[0]).toEqual(expect.objectContaining({
      fieldCount: expect.any(Number),
      stepCount: expect.any(Number),
    }));

    const withFields = await request(createTestApp())
      .get('/api/v1/procedures?category=Cư%20trú&search=thường%20trú&includeFields=true')
      .expect(200);

    expect(withFields.body.data[0].fields).toEqual(expect.any(Array));
  });
});

describe('Application validation edge cases', () => {
  it('rejects unknown service ids and malformed submittedAt before persistence', async () => {
    const unknownService = await request(createTestApp())
      .post('/api/v1/applications')
      .send({ ...validCccdApplication, serviceId: 'khong-ton-tai' })
      .expect(404);
    expect(unknownService.body.error.code).toBe('NOT_FOUND');

    const badSubmittedAt = await request(createTestApp())
      .post('/api/v1/applications')
      .send({ ...validCccdApplication, submittedAt: '2026-01-01' })
      .expect(400);
    expect(badSubmittedAt.body.error.code).toBe('INVALID_REQUEST');
  });

  it.each([
    ['unknown field', { unknownField: 'x' }, 'UNKNOWN_FIELD'],
    ['invalid phone', { sdt: '12345' }, 'PHONE'],
    ['invalid date', { ngaySinh: '2026-02-31' }, 'DATE'],
    ['future birth date', { ngaySinh: '2999-01-01' }, 'FUTURE_DATE'],
    ['invalid select', { gioiTinh: 'Khác' }, 'OPTION'],
    ['invalid CCCD', { cccdCu: 'abc' }, 'CCCD'],
  ])('rejects application data with %s', async (_caseName, patch, expectedCode) => {
    const response = await request(createTestApp())
      .post('/api/v1/applications')
      .send({
        ...validCccdApplication,
        data: { ...validCccdApplication.data, ...patch },
      })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: expectedCode })]),
    );
  });

  it('returns 404 for an unknown application id', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/applications/HS-NOT-FOUND')
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Upload and speech API edge cases', () => {
  it('validates CCCD OCR uploads and calls the configured provider for valid images', async () => {
    const provider: IdentityOcrProvider = {
      name: 'mock',
      extractCccd: vi.fn(async (image) => ({
        id: '012345678901',
        hoTen: image.filename,
        ngaySinh: '2000-01-01',
        gioiTinh: 'Nam',
        queQuan: 'Hà Nội',
        thuongTru: 'Hà Nội',
        ngayCap: '2020-01-01',
        noiCap: 'Cục Cảnh sát QLHC về TTXH',
      })),
    };

    const missing = await request(createTestApp({ ocrProvider: provider }))
      .post('/api/v1/identity/cccd/ocr')
      .expect(400);
    expect(missing.body.error.code).toBe('FILE_REQUIRED');

    const wrongMime = await request(createTestApp({ ocrProvider: provider }))
      .post('/api/v1/identity/cccd/ocr')
      .attach('file', Buffer.from('not image'), { filename: 'note.txt', contentType: 'text/plain' })
      .expect(415);
    expect(wrongMime.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const wrongBytes = await request(createTestApp({ ocrProvider: provider }))
      .post('/api/v1/identity/cccd/ocr')
      .attach('file', Buffer.from('not image'), { filename: 'fake.png', contentType: 'image/png' })
      .expect(415);
    expect(wrongBytes.body.error.code).toBe('UNSUPPORTED_IMAGE');

    await request(createTestApp({ ocrProvider: provider }))
      .post('/api/v1/identity/cccd/ocr')
      .attach('file', webp, { filename: 'cccd.webp', contentType: 'image/webp' })
      .expect(200);

    expect(provider.extractCccd).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'cccd.webp',
      mimetype: 'image/webp',
      buffer: webp,
    }));
  });

  it('handles TTS happy path, TTS validation and STT missing/provider errors', async () => {
    const ttsProvider: TtsProvider = {
      name: 'mock',
      synthesize: vi.fn(async (input) => ({
        provider: 'mock',
        audioUrl: 'data:audio/wav;base64,AAAA',
        useBrowserFallback: input.speed === 1.2,
      })),
    };
    const sttProvider: SttProvider = {
      name: 'mock',
      transcribe: vi.fn(async () => {
        throw new ExternalServiceError('STT provider unavailable');
      }),
    };
    const app = createTestApp({ ttsProvider, sttProvider });

    const tts = await request(app)
      .post('/api/v1/speech/tts')
      .send({ text: 'Xin chào' })
      .expect(200);
    expect(tts.body.data).toEqual({
      provider: 'mock',
      audioUrl: 'data:audio/wav;base64,AAAA',
      useBrowserFallback: true,
    });
    expect(ttsProvider.synthesize).toHaveBeenCalledWith({
      text: 'Xin chào',
      speed: 1.2,
      voice: 'female_south',
      domain: 'general',
    });

    const invalidTts = await request(app)
      .post('/api/v1/speech/tts')
      .send({ text: '', speed: 3 })
      .expect(400);
    expect(invalidTts.body.error.code).toBe('INVALID_REQUEST');

    const missingAudio = await request(app).post('/api/v1/speech/stt').expect(422);
    expect(missingAudio.body.error.details).toEqual([
      expect.objectContaining({ field: 'audioFile', code: 'REQUIRED' }),
    ]);

    const providerError = await request(app)
      .post('/api/v1/speech/stt')
      .attach('audioFile', Buffer.from('RIFF....WAVEfmt '), {
        filename: 'recording.wav',
        contentType: 'audio/wav',
      })
      .expect(502);
    expect(providerError.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
  });
});
