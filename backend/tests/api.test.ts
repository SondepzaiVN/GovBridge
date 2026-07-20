import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MockOcrProvider } from '../src/modules/identity/providers/mock-ocr.provider.js';
import { MockTtsProvider } from '../src/modules/speech/providers/mock-tts.provider.js';
import { MockSttProvider } from '../src/modules/speech/providers/mock-stt.provider.js';
import type { OrchestratorProvider } from '../src/modules/assistant/orchestrator.types.js';
import type { IntentNormalizerProvider } from '../src/modules/assistant/intent-normalizer.types.js';
import { MockKnowledgeProvider } from '../src/modules/assistant/providers/mock-knowledge.provider.js';
import { MockOrchestratorProvider } from '../src/modules/assistant/providers/mock-orchestrator.provider.js';
import { buildAssistantTools } from '../src/modules/assistant/tools/index.js';

let dataDirectory: string;

const createTestApp = () => createApp({
  dataDirectory,
  ocrProvider: new MockOcrProvider(),
  ttsProvider: new MockTtsProvider(),
  sttProvider: new MockSttProvider(),
  orchestratorProvider: new MockOrchestratorProvider(buildAssistantTools()),
  knowledgeProvider: new MockKnowledgeProvider(),
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
    expect(response.body.data.providers.knowledge).toBe('mock-knowledge');
  });

  it('returns the multi-step procedure definition', async () => {
    const response = await request(createTestApp())
      .get('/api/v1/procedures/lien-thong-khai-sinh')
      .expect(200);
    expect(response.body.data.fields.length).toBeGreaterThanOrEqual(26);
    expect(response.body.data.fields.some((field: { id: string }) => field.id === 'ltks_tinhKhaiSinh')).toBe(true);
    expect(response.body.data.fields.some((field: { id: string }) => field.id === 'ltks_phuongDangKyThuongTru')).toBe(true);
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

  it('stores interrupted assistant replies from the client as normal history', async () => {
    const interruptedReply = 'Cau tra loi bi ngat van la context.';
    const newUserMessage = 'toi muon hoi tiep';
    const finalReply = 'Da nhan cau moi.';
    let capturedHistory: Array<{ role: string; content: string }> = [];
    const intentNormalizerProvider: IntentNormalizerProvider = {
      name: 'interrupted-history-normalizer',
      async normalize() {
        return {
          intent: 'CHITCHAT',
          confidence: 0.99,
          reason: 'test',
          targetTool: 'chat',
          clarificationQuestion: null,
          procedureHint: null,
          fieldHints: [],
          secondaryIntents: [],
          safetyFlags: [],
        };
      },
    };
    const orchestratorProvider: OrchestratorProvider = {
      name: 'interrupted-history-capture',
      async orchestrate(request) {
        capturedHistory = request.history.map((message) => ({
          role: message.role,
          content: message.content,
        }));
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: finalReply,
            },
            actions: [],
          },
        };
      },
    };

    await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      sttProvider: new MockSttProvider(),
      orchestratorProvider,
      intentNormalizerProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      sessionId: 'client_interrupt_session',
      message: newUserMessage,
      currentRoute: '/',
      clientInterruptedAssistantMessages: [{
        content: interruptedReply,
        createdAt: '2026-07-20T00:00:00.000Z',
      }],
    }).expect(200);

    expect(capturedHistory).toContainEqual({
      role: 'assistant',
      content: interruptedReply,
    });
    const store = JSON.parse(
      await readFile(path.join(dataDirectory, 'assistant-sessions.json'), 'utf8'),
    ) as {
      sessions: Array<{
        id: string;
        messages: Array<{ role: string; content: string }>;
      }>;
    };
    const messages = store.sessions.find((session) => session.id === 'client_interrupt_session')?.messages ?? [];
    const contents = messages.map((message) => message.content);
    expect(contents).toEqual(expect.arrayContaining([
      interruptedReply,
      newUserMessage,
      finalReply,
    ]));
    expect(contents.indexOf(interruptedReply)).toBeLessThan(contents.indexOf(newUserMessage));
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

  it('transcribes uploaded speech through the configured STT provider', async () => {
    const response = await request(createTestApp())
      .post('/api/v1/speech/stt')
      .field('clientSession', 'test-client-session')
      .attach('audioFile', Buffer.from('RIFF....WAVEfmt '), {
        filename: 'recording.wav',
        contentType: 'audio/wav',
      })
      .expect(200);

    expect(response.body.data.provider).toBe('mock');
    expect(response.body.data.transcript).toBeTruthy();
  });

  it('validates orchestrator facts in backend and requests confirmation before filling', async () => {
    const orchestratorProvider: OrchestratorProvider = {
      name: 'structured-test',
      async orchestrate() {
        return {
          kind: 'final',
          result: {
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
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
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

  it('recovers explicit personal form values when the orchestrator omits facts', async () => {
    const orchestratorProvider: OrchestratorProvider = {
      name: 'missing-facts-test',
      async orchestrate() {
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Toi da ghi nhan ban ten la Dang Lam Son.',
            },
            actions: [],
            understanding: {
              facts: [],
              caseSuggestion: null,
              followUpQuestion: 'Vui long cung cap them cac thong tin con thieu.',
              fieldExplanation: null,
            },
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'dien bieu mau giup toi, toi ten dang lam son',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt' },
    }).expect(200);

    expect(response.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { hoTen: 'Dang Lam Son' },
      }),
    ]);
    expect(response.body.data.response.data.fields).toEqual({ hoTen: 'Dang Lam Son' });
  });

  it('does not include the connector word when extracting a name on temporary residence form', async () => {
    const orchestratorProvider: OrchestratorProvider = {
      name: 'temporary-residence-name-test',
      async orchestrate() {
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Toi da ghi nhan ban ten la Lam Son.',
            },
            actions: [],
            understanding: {
              facts: [],
              caseSuggestion: null,
              followUpQuestion: null,
              fieldExplanation: null,
            },
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'xin chao toi ten la lam son',
      currentRoute: '/dang-ky-tam-tru',
      visibleFieldIds: ['fullName'],
    }).expect(200);

    expect(response.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { fullName: 'Lam Son' },
      }),
    ]);
    expect(response.body.data.response.data.fields).toEqual({ fullName: 'Lam Son' });
  });

  it('turns explicit residence updates and follow-up confirmation into fill-confirm UI', async () => {
    let calls = 0;
    const orchestratorProvider: OrchestratorProvider = {
      name: 'pending-fill-test',
      async orchestrate() {
        calls += 1;
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Toi da ghi nhan thong tin dia ban.',
            },
            actions: [],
            understanding: {
              facts: [],
              caseSuggestion: null,
              followUpQuestion: 'Ban co muon cap nhat vao bieu mau khong?',
              fieldExplanation: null,
            },
          },
        };
      },
    };

    const app = createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    });

    const first = await request(app).post('/api/v1/assistant/messages').send({
      message: 'toi song o thanh pho can tho, phuong tan an',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt' },
      visibleFieldIds: ['tinhThanhDN', 'xaPhuongDN'],
    }).expect(200);

    expect(first.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: {
          tinhThanhDN: 'cantho',
          xaPhuongDN: 'phuong tan an',
        },
      }),
    ]);

    const second = await request(app).post('/api/v1/assistant/messages').send({
      sessionId: first.body.data.sessionId,
      message: 'cap nhat thong tin',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt' },
    }).expect(200);

    expect(calls).toBe(1);
    expect(second.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: {
          tinhThanhDN: 'cantho',
          xaPhuongDN: 'phuong tan an',
        },
      }),
    ]);
  });

  it('does not treat "co" inside "co quan" as pending-fill confirmation', async () => {
    let callCount = 0;
    const orchestratorProvider: OrchestratorProvider = {
      name: 'pending-confirm-word-boundary-test',
      async orchestrate() {
        callCount += 1;
        if (callCount === 1) {
          return {
            kind: 'final',
            result: {
              response: {
                intent: 'CHAT',
                message: 'Mình đã ghi nhận phường cơ quan thực hiện.',
              },
              actions: [],
              understanding: {
                facts: [{
                  fieldHint: 'xaPhuongCQ',
                  value: 'Phường Tân An',
                  confidence: 0.99,
                  source: 'chat',
                }],
                caseSuggestion: null,
                followUpQuestion: null,
                fieldExplanation: null,
                navigationRoute: null,
                highlightElementId: null,
                nextStepRequested: false,
              },
            },
          };
        }

        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Mình sẽ đổi cơ quan thực hiện theo tỉnh/thành phố mới.',
            },
            actions: [],
            understanding: {
              facts: [],
              caseSuggestion: null,
              followUpQuestion: null,
              fieldExplanation: null,
              navigationRoute: null,
              highlightElementId: null,
              nextStepRequested: false,
            },
          },
        };
      },
    };

    const app = createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    });

    const first = await request(app).post('/api/v1/assistant/messages').send({
      message: 'co quan thuc hien cua toi la phuong tan an',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt' },
      visibleFieldIds: ['tinhThanhCQ', 'xaPhuongCQ'],
    }).expect(200);

    expect(first.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { xaPhuongCQ: 'Phường Tân An' },
      }),
    ]);

    const second = await request(app).post('/api/v1/assistant/messages').send({
      sessionId: first.body.data.sessionId,
      message: 'doi co quan thuc hien cua toi la thanh pho ha noi',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt', tinhThanhCQ: 'cantho', xaPhuongCQ: '31147' },
      visibleFieldIds: ['tinhThanhCQ', 'xaPhuongCQ'],
    }).expect(200);

    expect(callCount).toBe(2);
    expect(second.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { tinhThanhCQ: 'hanoi' },
      }),
    ]);
    expect(second.body.data.actions[0].fields).not.toHaveProperty('xaPhuongCQ');
  });

  it('canonicalizes visible frontend fields before marking them as important', async () => {
    let importantVisibleFields: unknown = null;
    const orchestratorProvider: OrchestratorProvider = {
      name: 'visible-fields-test',
      async orchestrate(orchestratorRequest) {
        importantVisibleFields = orchestratorRequest.context.formContext.importantVisibleFields;
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Mình đã nhận ngữ cảnh biểu mẫu.',
            },
            actions: [],
          },
        };
      },
    };

    await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'Tôi muốn cập nhật thông tin cá nhân.',
      currentRoute: '/ho-khau',
      formValues: { hoTen: 'Nguyễn Thị Lan' },
      visibleFieldIds: ['hoTen', 'cccd', 'fieldKhongTonTai'],
    }).expect(200);

    expect(importantVisibleFields).toEqual([
      {
        id: 'hoTen',
        label: 'Họ tên',
        type: 'text',
        required: true,
        isEmpty: false,
        priority: 'high',
      },
      {
        id: 'cccd',
        label: 'Số ĐDCN (CCCD)',
        type: 'text',
        required: true,
        isEmpty: true,
        priority: 'high',
      },
    ]);
  });

  it('includes compact options for visible small select and radio fields', async () => {
    let importantVisibleFields: any[] = [];
    const orchestratorProvider: OrchestratorProvider = {
      name: 'visible-field-options-test',
      async orchestrate(orchestratorRequest) {
        importantVisibleFields = orchestratorRequest.context.formContext.importantVisibleFields as any[];
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Minh da nhan danh sach lua chon dang hien thi.',
            },
            actions: [],
          },
        };
      },
    };

    await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'Muc truong hop nay co nhung lua chon nao?',
      currentRoute: '/ho-khau',
      visibleFieldIds: ['truongHop', 'loaiDKTT'],
    }).expect(200);

    const caseField = importantVisibleFields.find((field) => field.id === 'truongHop');
    const registrationModeField = importantVisibleFields.find((field) => field.id === 'loaiDKTT');

    expect(caseField?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'ca_ho' }),
      expect.objectContaining({ value: 'lan_dau' }),
      expect.objectContaining({ value: 'nhan_khau' }),
    ]));
    expect(registrationModeField?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'lap_ho_moi' }),
      expect.objectContaining({ value: 'vao_ho_co' }),
    ]));
  });

  it('passes compact page context for residence attachment cases to the assistant runtime', async () => {
    let pageContext: any = null;
    const orchestratorProvider: OrchestratorProvider = {
      name: 'page-context-test',
      async orchestrate(orchestratorRequest) {
        pageContext = orchestratorRequest.context.formContext.pageContext;
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Minh da nhan ngu canh muc ho so dinh kem.',
            },
            actions: [],
          },
        };
      },
    };

    await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'Toi nen chon truong hop ho so nao?',
      currentRoute: '/ho-khau',
      formValues: { thuTuc: 'dktt', truongHop: 'nhan_khau', loaiDKTT: 'vao_ho_co' },
      pageContext: {
        pageId: 'dang-ky-thuong-tru',
        currentSection: 'ho-so-dinh-kem',
        sections: [{ id: 'ho-so-dinh-kem', title: 'Truong hop va ho so dinh kem', isOpen: true }],
        submissionChecklist: [{
          id: 'legalResponsibility',
          label: 'Toi xin chiu trach nhiem truoc phap luat ve loi khai tren',
          required: true,
          completed: false,
          reminder: 'Tick o cam ket chiu trach nhiem truoc phap luat truoc khi nop ho so.',
        }],
        residenceRegistration: {
          procedureCase: 'nhan_khau',
          registrationMode: 'vao_ho_co',
          isOverseasDossier: false,
          openUploadCaseId: 'non-owned-consent',
          uploadCases: [{
            id: 'non-owned-consent',
            title: 'Dang ky thuong tru tai cho o hop phap khong thuoc quyen so huu cua minh',
            isVisible: true,
            isOpen: true,
            selectionHint: 'Chon khi can su dong y cua chu ho hoac chu so huu cho o.',
            requirements: [{
              id: 'householder-consent',
              name: 'Van ban dong y cua chu ho va chu so huu cho o hop phap',
              required: true,
              selected: true,
              hasFile: true,
              fileCount: 1,
              canUseSpecializedData: false,
              useSpecializedData: false,
              guidance: 'Can co chu ky hoac xac nhan dien tu.',
            }],
          }],
        },
      },
    }).expect(200);

    expect(pageContext).toEqual(expect.objectContaining({
      pageId: 'dang-ky-thuong-tru',
      currentSection: 'ho-so-dinh-kem',
      submissionChecklist: [
        expect.objectContaining({
          id: 'legalResponsibility',
          required: true,
          completed: false,
        }),
      ],
      residenceRegistration: expect.objectContaining({
        procedureCase: 'nhan_khau',
        registrationMode: 'vao_ho_co',
        openUploadCaseId: 'non-owned-consent',
        uploadCases: [
          expect.objectContaining({
            id: 'non-owned-consent',
            isOpen: true,
            requirements: [
              expect.objectContaining({
                id: 'householder-consent',
                required: true,
                selected: true,
                hasFile: true,
                fileCount: 1,
              }),
            ],
          }),
        ],
      }),
    }));
  });

  it('passes recent document review context to the assistant runtime', async () => {
    let recentDocumentReviews: unknown = null;
    const orchestratorProvider: OrchestratorProvider = {
      name: 'document-review-context-test',
      async orchestrate(orchestratorRequest) {
        recentDocumentReviews = orchestratorRequest.context.formContext.recentDocumentReviews;
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Mình đã nhận kết quả rà soát hồ sơ vừa tải lên.',
            },
            actions: [],
          },
        };
      },
    };

    await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'Tôi cần sửa gì?',
      currentRoute: '/dang-ky-tam-tru',
      recentDocumentReviews: [{
        label: 'Tờ khai CT01',
        fileName: 'ct01.pdf',
        documentType: 'ct01',
        status: 'invalid',
        flag: 'red',
        text: 'Thiếu chữ ký của người đề nghị. Nội dung rất dài'.repeat(30),
        warnings: ['Ảnh trang 2 hơi mờ'],
        readerProvider: 'vnpt-smart-reader',
        reviewerProvider: 'openai-document-reviewer',
        checkedAt: '2026-07-14T09:00:00.000Z',
      }],
    }).expect(200);

    expect(recentDocumentReviews).toEqual([expect.objectContaining({
      label: 'Tờ khai CT01',
      fileName: 'ct01.pdf',
      documentType: 'ct01',
      status: 'invalid',
      flag: 'red',
      warnings: ['Ảnh trang 2 hơi mờ'],
      readerProvider: 'vnpt-smart-reader',
      reviewerProvider: 'openai-document-reviewer',
    })]);
    expect((recentDocumentReviews as Array<{ text: string }>)[0]?.text.length).toBeLessThanOrEqual(800);
  });

  it('lets housing life-situation questions reach the orchestrator even when normalized as unclear', async () => {
    let orchestratorCalled = false;
    const intentNormalizerProvider: IntentNormalizerProvider = {
      name: 'unclear-housing-test',
      async normalize() {
        return {
          intent: 'UNCLEAR',
          confidence: 0.9,
          reason: 'Tình huống đời sống chưa nêu đúng tên thủ tục.',
          targetTool: null,
          clarificationQuestion: 'Bạn muốn hỏi thủ tục nào liên quan đến việc mua nhà?',
          procedureHint: null,
          fieldHints: [],
          secondaryIntents: [],
          safetyFlags: [],
        };
      },
    };
    const orchestratorProvider: OrchestratorProvider = {
      name: 'housing-life-situation-test',
      async orchestrate() {
        orchestratorCalled = true;
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Nếu bạn mới mua nhà và muốn ở ổn định tại đó, thủ tục thường cần xem trước là đăng ký thường trú.',
            },
            actions: [],
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      intentNormalizerProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'tôi mới mua nhà tôi cần phải làm gì',
      currentRoute: '/',
    }).expect(200);

    expect(orchestratorCalled).toBe(true);
    expect(response.body.data.response.intent).toBe('CHAT');
    expect(response.body.data.response.message).toContain('đăng ký thường trú');
  });

  it('resolves select values with options to their canonical option value', async () => {
    const orchestratorProvider: OrchestratorProvider = {
      name: 'select-normalization-test',
      async orchestrate() {
        return {
          kind: 'final',
          result: {
            response: {
              intent: 'CHAT',
              message: 'Mình đã nhận thông tin nơi cư trú.',
            },
            actions: [],
            understanding: {
              facts: [
                {
                  fieldHint: 'hoTen',
                  value: 'Thành phố Cần Thơ',
                  confidence: 0.99,
                  source: 'chat',
                },
                {
                  fieldHint: 'tinhThanhDN',
                  value: 'Thành phố Cần Thơ',
                  confidence: 0.99,
                  source: 'chat',
                },
                {
                  fieldHint: 'xaPhuongDN',
                  value: 'Phường Ninh Kiều',
                  confidence: 0.99,
                  source: 'chat',
                },
              ],
              caseSuggestion: null,
              followUpQuestion: null,
              fieldExplanation: null,
              navigationRoute: null,
              highlightElementId: null,
              nextStepRequested: false,
            },
          },
        };
      },
    };

    const response = await request(createApp({
      dataDirectory,
      ocrProvider: new MockOcrProvider(),
      ttsProvider: new MockTtsProvider(),
      orchestratorProvider,
      knowledgeProvider: new MockKnowledgeProvider(),
    })).post('/api/v1/assistant/messages').send({
      message: 'Tôi sống ở thành phố Cần Thơ, phường Ninh Kiều.',
      currentRoute: '/ho-khau',
      visibleFieldIds: ['tinhThanhDN', 'xaPhuongDN'],
    }).expect(200);

    // tinhThanhDN has 'Thành phố Cần Thơ' as an option label → resolves to 'cantho'
    // hoTen must reject administrative-unit values even if the model emits a bad fact.
    // xaPhuongDN is administrative, so unmatched labels are kept for frontend dynamic-option reconciliation.
    expect(response.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: {
          tinhThanhDN: 'cantho',
          xaPhuongDN: 'Ph\u01b0\u1eddng Ninh Ki\u1ec1u',
        },
      }),
    ]);
  });
});
