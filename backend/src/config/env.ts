import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JSON_BODY_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(25).default(8),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  DATA_DIR: z.string().optional(),
  ASSISTANT_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  OCR_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  TTS_PROVIDER: z.enum(['mock', 'vnpt']).default('mock'),
  VNPT_SMARTBOT_URL: z.string().url().default('https://smartbot.vnpt.vn/api/v1'),
  VNPT_SMARTBOT_ACCESS_TOKEN: z.string().default(''),
  VNPT_SMARTBOT_TOKEN_ID: z.string().default(''),
  VNPT_SMARTBOT_TOKEN_KEY: z.string().default(''),
  VNPT_SMARTBOT_BOT_ID: z.string().default(''),
  VNPT_EKYC_URL: z.string().url().default('https://api.idg.vnpt.vn'),
  VNPT_EKYC_ACCESS_TOKEN: z.string().default(''),
  VNPT_EKYC_TOKEN_ID: z.string().default(''),
  VNPT_EKYC_TOKEN_KEY: z.string().default(''),
  VNPT_MAC_ADDRESS: z.string().default('GOV_BRIDGE_BACKEND'),
  VNPT_TTS_URL: z.string().url().default('https://api.idg.vnpt.vn/tts-service/v2/grpc'),
  VNPT_TTS_ACCESS_TOKEN: z.string().default(''),
  VNPT_TTS_TOKEN_ID: z.string().default(''),
  VNPT_TTS_TOKEN_KEY: z.string().default(''),
  VNPT_STT_URL: z.string().url().default('wss://stt.vnpt.vn/ws/asr'),
  VNPT_STT_ACCESS_TOKEN: z.string().default(''),
  VNPT_STT_TOKEN_ID: z.string().default(''),
  VNPT_STT_TOKEN_KEY: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => issue.path.join('.') + ': ' + issue.message)
    .join(', ');
  throw new Error('Invalid backend environment: ' + issues);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  DATA_DIR: path.resolve(parsed.data.DATA_DIR ?? path.join(backendRoot, 'src/storage/data')),
} as const;
