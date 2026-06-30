import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MockOcrProvider } from '../src/modules/identity/providers/mock-ocr.provider.js';
import { MockTtsProvider } from '../src/modules/speech/providers/mock-tts.provider.js';
import type { AssistantProvider } from '../src/modules/assistant/assistant.types.js';

let dataDirectory: string;

const createTestApp = () => createApp({
  dataDirectory,
  ocrProvider: new MockOcrProvider(),
  ttsProvider: new MockTtsProvider(),
});

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'gov-bridge-test-'));
  await copyFile(path.resolve('src/storage/data/procedures.json'), path.join(dataDirectory, 'procedures.json'));
  await writeFile(path.join(dataDirectory, 'applications.json'), JSON.stringify({ schemaVersion: 1, applications: [] }));
  await writeFile(path.join(dataDirectory, 'assistant-sessions.json'), JSON.stringify({ schemaVersion: 1, sessions: [] }));
});

afterEach(async () => {
  if (dataDirectory.startsWith(os.tmpdir())) await rm(dataDirectory, { recursive: true, force: true });
});

describe('Gov Bridge API', () => {
  it('returns health and provider information', async () => {
    const response = await request(createTestApp()).get('/api/v1/health').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.storage).toBe('json-file');
  });

  it('returns the multi-step procedure definition', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/procedures/lien-thong-khai-sinh')
      .expect(200);
    expect(response.body.data.fields).toHaveLength(10);
    expect(response.body.data.fields.some((field: { step?: number }) => field.step === 3)).toBe(true);
  });

  it('rejects an incomplete final application', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/applications')
      .send({ serviceId: 'lien-thong-khai-sinh', data: { ltks_tenTre: 'Nguyễn Văn An' } })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('stores a valid multi-step application only at final submission', async () => {
    const payload = {
      serviceId: 'lien-thong-khai-sinh',
      submittedAt: new Date().toISOString(),
      data: {
        ltks_tenTre: 'Nguyễn Văn An',
        ltks_ngaySinhTre: '2024-01-01',
        ltks_noiSinhTre: 'Bệnh viện A',
        ltks_cccdCha: '012345678901',
        ltks_hoTenCha: 'Nguyễn Văn Bình',
        ltks_cccdMe: '012345678902',
        ltks_hoTenMe: 'Trần Thị Hoa',
        ltks_diaChiThuongTru: 'Hà Nội',
        ltks_nhanBHYT: 'UBND phường',
        ltks_ghiChu: '',
      },
    };
    const submitted = await request(createTestApp())
      .post('/api/applications')
      .send(payload)
      .expect(201);
    expect(submitted.body.data.id).toMatch(/^HS-/);

    const fetched = await request(createTestApp())
      .get('/api/v1/applications/' + submitted.body.data.id)
      .expect(200);
    expect(fetched.body.data.data.ltks_tenTre).toBe('Nguyễn Văn An');
  });

  it('keeps assistant history under a client session id', async () => {
    const app = createTestApp();
    const first = await request(app).post('/api/v1/assistant/messages').send({
      message: 'Liên thông khai sinh cần giấy tờ gì?',
      currentRoute: '/lien-thong-khai-sinh/buoc-2',
    }).expect(200);
    expect(first.body.data.sessionId).toBeTruthy();
    expect(first.body.data.response.intent).toBe('CHAT');

    const second = await request(app).post('/api/v1/assistant/messages').send({
      sessionId: first.body.data.sessionId,
      message: 'bước tiếp theo',
      currentRoute: '/lien-thong-khai-sinh/buoc-2',
      formValues: {
        ltks_cccdCha: '012345678901',
        ltks_hoTenCha: 'Nguyễn Văn Bình',
        ltks_cccdMe: '012345678902',
        ltks_hoTenMe: 'Trần Thị Hoa',
      },
    }).expect(200);
    expect(second.body.data.actions[0].type).toBe('NEXT_STEP');
  });

  it('asks for confirmation before mock autofill changes the form', async () => {
    const response = await request(createTestApp()).post('/api/v1/assistant/messages').send({
      message: 'hoTen: Nguyễn Thị Lan',
      currentRoute: '/ho-khau',
    }).expect(200);

    expect(response.body.data.actions[0]).toEqual(expect.objectContaining({
      type: 'REQUEST_CONFIRM_FILL',
      fields: { hoTen: 'Nguyễn Thị Lan' },
    }));
  });

  it('validates VNPT facts in backend and requests confirmation before filling', async () => {
    const assistantProvider: AssistantProvider = {
      name: 'structured-test',
      async sendMessage() {
        return {
          response: {
            intent: 'CHAT',
            message: 'Mình đã nhận được thông tin bạn cung cấp.',
          },
          actions: [],
          understanding: {
            facts: [
              {
                fieldHint: 'hoTen',
                value: 'Nguyễn Thị Lan',
                confidence: 0.98,
                source: 'chat',
              },
              {
                fieldHint: 'sdtCoQuan',
                value: '0901234567',
                confidence: 0.99,
                source: 'chat',
              },
              {
                fieldHint: 'fieldKhongTonTai',
                value: 'không hợp lệ',
                confidence: 0.99,
                source: 'inference',
              },
              {
                fieldHint: 'gioiTinh',
                value: 'Nữ',
                confidence: 0.99,
                source: 'inference',
              },
            ],
            caseSuggestion: {
              id: 'vao_ho_da_co',
              confidence: 0.75,
              reason: 'Người dùng nói muốn nhập khẩu về nhà chồng.',
            },
            followUpQuestion: null,
            fieldExplanation: null,
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      assistantProvider,
    })).post('/api/v1/assistant/messages').send({
      message: 'Tôi tên Nguyễn Thị Lan',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt' },
    }).expect(200);

    expect(response.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { hoTen: 'Nguyễn Thị Lan' },
        fieldLabels: { hoTen: 'Họ tên' },
      }),
    ]);
  });
});
