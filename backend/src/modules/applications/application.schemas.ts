import { z } from 'zod';

export const submitApplicationSchema = z.object({
  serviceId: z.string().trim().min(1).max(100),
  submittedAt: z.string().datetime({ offset: true }).optional(),
  data: z.record(z.string().max(10_000)).refine(
    (data) => Object.keys(data).length <= 200,
    'Hồ sơ có quá nhiều trường dữ liệu.',
  ),
}).strict();

export const applicationIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(100),
});
