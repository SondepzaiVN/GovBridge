import { z } from 'zod';

export const assistantMessageSchema = z.object({
  sessionId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  message: z.string().trim().min(1).max(4_000),
  currentRoute: z.string().trim().max(300).default('/'),
  formValues: z.record(z.string().max(10_000)).default({}),
  currentSection: z.string().trim().max(100).optional(),
  recentOcrFacts: z.record(z.string().max(2_000)).default({}),
}).strict();

export const assistantSessionParamsSchema = z.object({
  sessionId: z.string().trim().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});
