import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createVnptChatRouter } from '../src/integrations/vnpt/vnpt-chat.routes.js';

const createTestApp = (fetchImpl: typeof fetch, token = 'assistant-token') => {
  const app = express();
  app.use(express.json());
  app.use('/api', createVnptChatRouter({
    url: 'https://assistant-stream.vnpt.vn/v1/conversation',
    token,
    botId: 'e0ae8190-769a-11f1-a4d2-f99c9477e903',
    senderId: 'team.25@vnptai.io',
    referer: 'https://livechat.vnpt.vn/',
    timeoutMs: 30_000,
    fetchImpl,
  }));
  return app;
};

describe('POST /api/vnpt-chat', () => {
  it('sends the requested VNPT payload and proxies the SSE stream unchanged', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response(
        new TextEncoder().encode('data: {"text":"Xin chào"}\n\ndata: [DONE]\n\n'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      );
    });

    const response = await request(createTestApp(fetchImpl))
      .post('/api/vnpt-chat')
      .send({
        text: 'Cần giấy tờ gì?',
        sessionId: 'session_12345678',
      })
      .expect(200);

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer assistant-token');
    expect(headers.get('Referer')).toBe('https://livechat.vnpt.vn/');
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      bot_id: 'e0ae8190-769a-11f1-a4d2-f99c9477e903',
      input_channel: 'livechat',
      metadata: {},
      sender_id: 'team.25@vnptai.io',
      session_id: 'session_12345678',
      settings: { enable_chunk_stream: 1 },
      stream: '1',
      text: 'Cần giấy tờ gì?',
      tts_model: 'news',
      tts_region: 'female_north',
      user_auth_level: 2,
    });
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toBe('data: {"text":"Xin chào"}\n\ndata: [DONE]\n\n');
  });

  it('rejects invalid input without calling VNPT', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await request(createTestApp(fetchImpl))
      .post('/api/vnpt-chat')
      .send({ text: '', sessionId: 'short' })
      .expect(400);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns a configuration error when the bearer token is missing', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await request(createTestApp(fetchImpl, ' '))
      .post('/api/vnpt-chat')
      .send({ text: 'Xin chào', sessionId: 'session_12345678' })
      .expect(503);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
