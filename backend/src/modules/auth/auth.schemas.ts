import { z } from 'zod';

export const loginSchema = z.object({
  role: z.enum(['nguoi-dan', 'can-bo', 'admin']),
  username: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(200),
}).strict();

export const registerCitizenSchema = z.object({
  username: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(2).max(200),
  citizenId: z.string().trim().regex(/^(?:\d{9}|\d{12})$/).optional(),
}).strict();
