import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  JSON_BODY_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(25).default(8),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  DATA_DIR: z.string().optional(),
  ASSISTANT_PROVIDER: z.enum(['mock', 'vnpt', 'openai']).default('mock'),
  ORCHESTRATOR_PROVIDER: z.enum(['mock', 'openai']).optional(),
  KNOWLEDGE_PROVIDER: z.enum(['mock', 'vnpt']).optional(),
  OCR_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  TTS_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  STT_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  VNPT_AGENTIC_URL: z.string().url().optional(),
  VNPT_AGENTIC_ACCESS_TOKEN: z.string().optional(),
  VNPT_AGENTIC_TOKEN_ID: z.string().optional(),
  VNPT_AGENTIC_TOKEN_KEY: z.string().optional(),
  VNPT_AGENTIC_BOT_ID: z.string().optional(),
  VNPT_AGENTIC_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  VNPT_ASSISTANT_TOKEN: z.string().optional(),
  VNPT_ASSISTANT_BOT_ID: z.string().default('e0ae8190-769a-11f1-a4d2-f99c9477e903'),
  VNPT_ASSISTANT_SENDER_ID: z.string().default('team.25@vnptai.io'),
  VNPT_ASSISTANT_REFERER: z.string().url().default('https://livechat.vnpt.vn/'),
  VNPT_SMARTBOT_URL: z.string().url().default('https://assistant-stream.vnpt.vn/v1/conversation'),
  VNPT_SMARTBOT_ACCESS_TOKEN: z.string().default(''),
  VNPT_SMARTBOT_TOKEN_ID: z.string().default(''),
  VNPT_SMARTBOT_TOKEN_KEY: z.string().default(''),
  VNPT_SMARTBOT_BOT_ID: z.string().default(''),
  VNPT_EKYC_URL: z.string().url().default('https://api.idg.vnpt.vn'),
  VNPT_EKYC_AUTH_URL: z.string().url().default('https://api.idg.vnpt.vn/auth/oauth/token'),
  VNPT_EKYC_ACCESS_TOKEN: z.string().default(''),
  VNPT_EKYC_CLIENT_ID: z.string().default(''),
  VNPT_EKYC_CLIENT_SECRET: z.string().default(''),
  VNPT_EKYC_TOKEN_ID: z.string().default(''),
  VNPT_EKYC_TOKEN_KEY: z.string().default(''),
  VNPT_MAC_ADDRESS: z.string().default('GOV_BRIDGE_BACKEND'),
  VNPT_SMARTREADER_URL: z.string().url().default('https://api.idg.vnpt.vn'),
  VNPT_SMARTREADER_ACCESS_TOKEN: z.string().default(''),
  VNPT_SMARTREADER_TOKEN_ID: z.string().default(''),
  VNPT_SMARTREADER_TOKEN_KEY: z.string().default(''),
  VNPT_SMARTREADER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(45_000),
  DOCUMENT_RULES_DIR: z.string().optional(),
  VNPT_TTS_URL: z.string().url().default('https://api.idg.vnpt.vn/tts-service/v2/grpc'),
  VNPT_TTS_ACCESS_TOKEN: z.string().default(''),
  VNPT_TTS_TOKEN_ID: z.string().default(''),
  VNPT_TTS_TOKEN_KEY: z.string().default(''),
  VNPT_STT_URL: z.string().url().default('https://api.idg.vnpt.vn/stt-service/v1/grpc/standard'),
  VNPT_STT_ACCESS_TOKEN: z.string().default(''),
  VNPT_STT_TOKEN_ID: z.string().default(''),
  VNPT_STT_TOKEN_KEY: z.string().default(''),
  VNPT_STT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => issue.path.join('.') + ': ' + issue.message)
    .join(', ');
  throw new Error('Invalid backend environment: ' + issues);
}

const orchestratorProvider = parsed.data.ORCHESTRATOR_PROVIDER
  ?? (parsed.data.ASSISTANT_PROVIDER === 'openai' ? 'openai' : 'mock');
const knowledgeProvider = parsed.data.KNOWLEDGE_PROVIDER
  ?? (parsed.data.ASSISTANT_PROVIDER === 'vnpt' ? 'vnpt' : 'mock');
const preferNewVnptSetting = (
  newValue: string | undefined,
  legacyValue: string,
): string => newValue?.trim() || legacyValue;

if (orchestratorProvider === 'openai' && !parsed.data.OPENAI_API_KEY.trim()) {
  throw new Error('Invalid backend environment: OPENAI_API_KEY is required when ORCHESTRATOR_PROVIDER=openai.');
}

export const env = {
  ...parsed.data,
  ORCHESTRATOR_PROVIDER: orchestratorProvider,
  KNOWLEDGE_PROVIDER: knowledgeProvider,
  VNPT_AGENTIC_URL: preferNewVnptSetting(
    parsed.data.VNPT_AGENTIC_URL,
    parsed.data.VNPT_SMARTBOT_URL,
  ),
  VNPT_AGENTIC_ACCESS_TOKEN: preferNewVnptSetting(
    parsed.data.VNPT_AGENTIC_ACCESS_TOKEN,
    parsed.data.VNPT_SMARTBOT_ACCESS_TOKEN,
  ),
  VNPT_ASSISTANT_TOKEN: preferNewVnptSetting(
    parsed.data.VNPT_ASSISTANT_TOKEN,
    preferNewVnptSetting(
      parsed.data.VNPT_AGENTIC_ACCESS_TOKEN,
      parsed.data.VNPT_SMARTBOT_ACCESS_TOKEN,
    ),
  ),
  VNPT_AGENTIC_TOKEN_ID: preferNewVnptSetting(
    parsed.data.VNPT_AGENTIC_TOKEN_ID,
    parsed.data.VNPT_SMARTBOT_TOKEN_ID,
  ),
  VNPT_AGENTIC_TOKEN_KEY: preferNewVnptSetting(
    parsed.data.VNPT_AGENTIC_TOKEN_KEY,
    parsed.data.VNPT_SMARTBOT_TOKEN_KEY,
  ),
  VNPT_AGENTIC_BOT_ID: preferNewVnptSetting(
    parsed.data.VNPT_AGENTIC_BOT_ID,
    parsed.data.VNPT_SMARTBOT_BOT_ID,
  ),
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  DATA_DIR: path.resolve(parsed.data.DATA_DIR ?? path.join(backendRoot, 'src/storage/data')),
  DOCUMENT_RULES_DIR: path.resolve(parsed.data.DOCUMENT_RULES_DIR ?? path.join(backendRoot, 'src/storage/rules')),
} as const;
