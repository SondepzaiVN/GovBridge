import { z } from 'zod';

const citizenNameSchema = z.string()
  .trim()
  .min(2)
  .max(200)
  .regex(/^[\p{L} ]+$/u, 'Họ tên chỉ được gồm chữ cái và khoảng trắng.');

export const loginSchema = z.object({
  role: z.enum(['nguoi-dan', 'can-bo', 'admin']),
  username: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(200),
}).strict();

export const registerCitizenSchema = z.object({
  password: z.string().min(8).max(200),
  name: citizenNameSchema,
  citizenId: z.string().trim().regex(/^(?:\d{9}|\d{12})$/),
}).strict();
