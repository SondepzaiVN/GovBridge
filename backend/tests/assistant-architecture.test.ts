import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { KnowledgeProviderRequest } from '../src/modules/assistant/knowledge.types.js';
import type { OrchestratorProvider } from '../src/modules/assistant/orchestrator.types.js';
import { MockKnowledgeProvider } from '../src/modules/assistant/providers/mock-knowledge.provider.js';
import { QUERY_PROCEDURE_KNOWLEDGE_TOOL } from '../src/modules/assistant/tools/query-procedure-knowledge.tool.js';
import { MockOcrProvider } from '../src/modules/identity/providers/mock-ocr.provider.js';
import { MockTtsProvider } from '../src/modules/speech/providers/mock-tts.provider.js';

let dataDirectory: string;

const createTestApp = (
  knowledgeProvider: MockKnowledgeProvider,
  orchestratorProvider?: OrchestratorProvider,
) => createApp({
  dataDirectory,
  ocrProvider: new MockOcrProvider(),
  ttsProvider: new MockTtsProvider(),
  knowledgeProvider,
  ...(orchestratorProvider ? { orchestratorProvider } : {}),
});

const seedCanonicalSession = async (sessionId: string): Promise<void> => {
  const now = new Date().toISOString();
  await writeFile(
    path.join(dataDirectory, 'assistant-sessions.json'),
    JSON.stringify({
      schemaVersion: 1,
      sessions: [{
        id: sessionId,
        currentRoute: '/ho-khau',
        messages: [],
        state: {
          formSnapshot: { hoTen: 'Nguyễn Văn An' },
          candidateCases: [{
            id: 'candidate_not_confirmed',
            confidence: 0.99,
            reason: 'Chỉ là đề xuất của model.',
          }],
          recentFacts: [],
          confirmedCase: {
            id: 'lap_ho_moi',
            procedureId: 'ho-khau',
          },
        },
        createdAt: now,
        updatedAt: now,
      }],
    }),
  );
};

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'gov-bridge-assistant-test-'));
  await copyFile(path.resolve('src/storage/data/procedures.json'), path.join(dataDirectory, 'procedures.json'));
  await writeFile(path.join(dataDirectory, 'applications.json'), JSON.stringify({ schemaVersion: 1, applications: [] }));
  await writeFile(path.join(dataDirectory, 'assistant-sessions.json'), JSON.stringify({ schemaVersion: 1, sessions: [] }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (dataDirectory.startsWith(os.tmpdir())) await rm(dataDirectory, { recursive: true, force: true });
});

describe('assistant orchestration boundaries', () => {
  it('routes knowledge questions through KnowledgeProvider without creating UI actions', async () => {
    const knowledge = new MockKnowledgeProvider(() => ({
      answer: 'Bạn cần tờ khai và giấy tờ chứng minh chỗ ở hợp pháp. [Nguồn 1]',
      references: [],
      quickReplies: ['Hỏi về cách nộp'],
      provider: 'mock-knowledge',
      status: 'success',
    }));

    const response = await request(createTestApp(knowledge))
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(knowledge.requests).toHaveLength(1);
    expect(knowledge.requests[0]?.query).toEqual(expect.objectContaining({
      knowledgeType: 'documents',
      procedureHint: {
        id: 'ho-khau',
        name: 'Đăng ký thường trú',
      },
    }));
    expect(response.body.data.response.message).toContain('[Nguồn 1]');
    expect(response.body.data.actions).toEqual([]);
    expect(knowledge.requests[0]).not.toHaveProperty('actions');
  });

  it('does not call KnowledgeProvider when the user only supplies a form value', async () => {
    const knowledge = new MockKnowledgeProvider();
    const response = await request(createTestApp(knowledge))
      .post('/api/v1/assistant/messages')
      .send({
        message: 'hoTen: Nguyễn Thị Lan',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(knowledge.requests).toEqual([]);
    expect(response.body.data.actions).toEqual([
      expect.objectContaining({
        type: 'REQUEST_CONFIRM_FILL',
        fields: { hoTen: 'Nguyễn Thị Lan' },
      }),
    ]);
  });

  it('prepares stable opaque knowledge identities per assistant session', async () => {
    const knowledge = new MockKnowledgeProvider();
    const app = createTestApp(knowledge);
    const first = await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);
    await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        sessionId: first.body.data.sessionId,
        message: 'Lệ phí bao nhiêu?',
        currentRoute: '/ho-khau',
      })
      .expect(200);
    await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú mất bao lâu?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(knowledge.requests[0]?.identity).toEqual(knowledge.requests[1]?.identity);
    expect(knowledge.requests[2]?.identity).not.toEqual(knowledge.requests[0]?.identity);
    expect(knowledge.requests[0]?.identity.senderId).not.toContain(first.body.data.sessionId);
    expect(knowledge.requests[0]?.identity.sessionId).not.toContain(first.body.data.sessionId);
    expect(knowledge.requests[0]?.identity.senderId).toMatch(/^sender_[0-9a-f-]{36}$/);
    expect(knowledge.requests[0]?.identity.sessionId).toMatch(/^knowledge_[0-9a-f-]{36}$/);

    await request(app)
      .delete(`/api/v1/assistant/sessions/${first.body.data.sessionId}`)
      .expect(200);
    await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        sessionId: first.body.data.sessionId,
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);
    expect(knowledge.requests[3]?.identity).not.toEqual(knowledge.requests[0]?.identity);
  });

  it('validates model tool arguments against repository before the provider privacy boundary', async () => {
    const knowledge = new MockKnowledgeProvider();
    const orchestrator: OrchestratorProvider = {
      name: 'tool-call-test',
      async orchestrate(orchestratorRequest) {
        if (orchestratorRequest.knowledge) {
          return {
            kind: 'final',
            result: {
              response: { intent: 'CHAT', message: orchestratorRequest.knowledge.result.answer },
              actions: [],
            },
          };
        }
        return {
          kind: 'tool_call',
          toolCall: {
            name: QUERY_PROCEDURE_KNOWLEDGE_TOOL,
            arguments: {
              question: 'Đăng ký thường trú cần gì cho CCCD 012345678901, gọi 0901234567?',
              knowledgeType: 'documents',
              procedureHint: { id: 'fake-id', name: 'Thủ tục do model bịa' },
              selectedCaseHint: 'case chưa xác nhận',
              fieldContext: { fieldId: 'hoTen', fieldLabel: 'Nhãn do model bịa' },
              locality: 'Đà Nẵng',
            },
          },
        };
      },
    };

    await request(createTestApp(knowledge, orchestrator))
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú cần gì cho CCCD 012345678901, gọi 0901234567?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(knowledge.requests[0]?.query).toEqual(expect.objectContaining({
      question: 'Đăng ký thường trú cần gì cho CCCD 012345678901, gọi 0901234567?',
      procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
      selectedCaseHint: null,
      fieldContext: null,
      locality: null,
    }));
    expect(knowledge.requests[0]?.privacy.knownPii).toEqual([]);
  });

  it('MockKnowledgeProvider runs offline without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const knowledge = new MockKnowledgeProvider();
    const requestValue: KnowledgeProviderRequest = {
      identity: {
        senderId: 'sender_offline',
        sessionId: 'knowledge_offline',
      },
      query: {
        question: 'Cần giấy tờ gì?',
        knowledgeType: 'documents',
        procedureHint: null,
        selectedCaseHint: null,
        fieldContext: null,
        locality: null,
      },
      currentStep: null,
      currentSection: null,
      privacy: { knownPii: [] },
    };

    const result = await knowledge.query(requestValue);

    expect(result.status).toBe('success');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not invent an answer when KnowledgeProvider reports no source', async () => {
    const knowledge = new MockKnowledgeProvider(() => ({
      answer: 'Không tìm thấy đủ nguồn.',
      references: [],
      quickReplies: [],
      provider: 'mock-knowledge',
      status: 'no_source',
    }));
    const app = createTestApp(knowledge);
    const response = await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(response.body.data.response.message).toBe(
      'Mình chưa tìm thấy đủ nguồn để trả lời chắc chắn câu hỏi này.',
    );
    expect(response.body.data.actions).toEqual([]);

    const cleared = await request(app)
      .delete(`/api/v1/assistant/sessions/${response.body.data.sessionId}`)
      .expect(200);
    expect(cleared.body.data.deleted).toBe(true);
  });

  it('keeps the assistant session when KnowledgeProvider fails', async () => {
    const knowledge = new MockKnowledgeProvider(() => {
      throw new Error('offline');
    });
    const app = createTestApp(knowledge);
    const response = await request(app)
      .post('/api/v1/assistant/messages')
      .send({
        message: 'Đăng ký thường trú cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(response.body.data.response.message).toContain('chưa sẵn sàng');
    expect(response.body.data.actions).toEqual([]);
    const cleared = await request(app)
      .delete(`/api/v1/assistant/sessions/${response.body.data.sessionId}`)
      .expect(200);
    expect(cleared.body.data.deleted).toBe(true);
  });

  it('passes only a repository-backed confirmed case to KnowledgeProvider', async () => {
    const sessionId = 'canonical_case_session';
    await seedCanonicalSession(sessionId);
    const knowledge = new MockKnowledgeProvider();
    const orchestrator: OrchestratorProvider = {
      name: 'canonical-case-test',
      async orchestrate(orchestratorRequest) {
        if (orchestratorRequest.knowledge) {
          return {
            kind: 'final',
            result: {
              response: { intent: 'CHAT', message: orchestratorRequest.knowledge.result.answer },
              actions: [],
            },
          };
        }
        return {
          kind: 'tool_call',
          toolCall: {
            name: QUERY_PROCEDURE_KNOWLEDGE_TOOL,
            arguments: {
              question: 'Model thay câu hỏi',
              knowledgeType: 'documents',
              procedureHint: { id: 'ho-khau', name: 'Đăng ký thường trú' },
              selectedCaseHint: 'case do model bịa',
              fieldContext: null,
              locality: null,
            },
          },
        };
      },
    };

    await request(createTestApp(knowledge, orchestrator))
      .post('/api/v1/assistant/messages')
      .send({
        sessionId,
        message: 'Cần giấy tờ gì?',
        currentRoute: '/ho-khau',
      })
      .expect(200);

    expect(knowledge.requests[0]?.query.selectedCaseHint).toBe(
      'Đăng ký thường trú lập hộ mới',
    );
    const store = JSON.parse(
      await readFile(path.join(dataDirectory, 'assistant-sessions.json'), 'utf8'),
    ) as { sessions: Array<{ state?: { confirmedCase?: { id: string } } }> };
    expect(store.sessions[0]?.state?.confirmedCase?.id).toBe('lap_ho_moi');
  });

  it('does not lose existing session/form state when structural validation fails', async () => {
    const sessionId = 'validation_state_session';
    await seedCanonicalSession(sessionId);
    const knowledge = new MockKnowledgeProvider();
    const orchestrator: OrchestratorProvider = {
      name: 'invalid-arguments-test',
      async orchestrate() {
        return {
          kind: 'tool_call',
          toolCall: {
            name: QUERY_PROCEDURE_KNOWLEDGE_TOOL,
            arguments: {
              question: 'Cần giấy tờ gì?',
              knowledgeType: 'documents',
              procedureHint: null,
              selectedCaseHint: null,
              fieldContext: null,
              locality: null,
              unexpected: 'must be rejected',
            },
          },
        };
      },
    };

    const response = await request(createTestApp(knowledge, orchestrator))
      .post('/api/v1/assistant/messages')
      .send({
        sessionId,
        message: 'Cần giấy tờ gì?',
        currentRoute: '/ho-khau',
        formValues: { hoTen: 'Giá trị mới chưa được lưu' },
      })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_KNOWLEDGE_QUERY');
    expect(knowledge.requests).toEqual([]);
    const store = JSON.parse(
      await readFile(path.join(dataDirectory, 'assistant-sessions.json'), 'utf8'),
    ) as {
      sessions: Array<{
        state?: {
          formSnapshot?: Record<string, string>;
          confirmedCase?: { id: string };
        };
      }>;
    };
    expect(store.sessions[0]?.state?.formSnapshot).toEqual({ hoTen: 'Nguyễn Văn An' });
    expect(store.sessions[0]?.state?.confirmedCase?.id).toBe('lap_ho_moi');
  });
});
