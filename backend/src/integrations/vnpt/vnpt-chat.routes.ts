import { Router } from 'express';
import { z } from 'zod';

export interface VnptChatRouteOptions {
  url: string;
  token: string;
  botId: string;
  senderId: string;
  referer: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

const vnptChatBodySchema = z.object({
  text: z.string().trim().min(1).max(6_000),
  sessionId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/u),
}).strict();

const bearerToken = (value: string): string => {
  let token = value.trim();
  while (/^Bearer(?:\s+|$)/iu.test(token)) {
    token = token.replace(/^Bearer(?:\s+|$)/iu, '').trim();
  }
  return token ? `Bearer ${token}` : '';
};

export const createVnptChatRouter = (options: VnptChatRouteOptions): Router => {
  const router = Router();
  const fetchImpl = options.fetchImpl ?? fetch;

  router.post('/vnpt-chat', async (request, response) => {
    const parsed = vnptChatBodySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Invalid request',
        detail: parsed.error.flatten(),
      });
      return;
    }

    const authorization = bearerToken(options.token);
    if (!authorization) {
      response.status(503).json({
        error: 'VNPT API is not configured',
        detail: 'Thiếu VNPT_ASSISTANT_TOKEN.',
      });
      return;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), options.timeoutMs);
    response.on('close', () => {
      if (!response.writableEnded) abortController.abort();
    });

    try {
      const vnptResponse = await fetchImpl(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
          Referer: options.referer,
        },
        body: JSON.stringify({
          bot_id: options.botId,
          input_channel: 'livechat',
          metadata: {},
          sender_id: options.senderId,
          session_id: parsed.data.sessionId,
          settings: {
            enable_chunk_stream: 1,
          },
          stream: '1',
          text: parsed.data.text,
          tts_model: 'news',
          tts_region: 'female_north',
          user_auth_level: 2,
        }),
        signal: abortController.signal,
      });

      if (!vnptResponse.ok || !vnptResponse.body) {
        const detail = (await vnptResponse.text()).slice(0, 4_000);
        response.status(vnptResponse.status || 502).json({
          error: 'VNPT API error',
          detail,
        });
        return;
      }

      response.status(200);
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();

      const reader = vnptResponse.body.getReader();
      try {
        while (!response.destroyed) {
          const { done, value } = await reader.read();
          if (done) break;
          response.write(value);
        }
      } finally {
        reader.releaseLock();
      }
      response.end();
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      response.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'VNPT API timeout' : 'Internal server error',
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  return router;
};
