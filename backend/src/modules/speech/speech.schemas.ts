import { z } from 'zod';

export const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
  speed: z.coerce.number().min(0.5).max(2).default(1),
  voice: z.string().trim().min(1).max(100).default('female_south'),
  domain: z.string().trim().min(1).max(100).default('general'),
}).strict();
