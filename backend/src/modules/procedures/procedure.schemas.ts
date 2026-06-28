import { z } from 'zod';

export const procedureIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(100),
});

export const procedureListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  includeFields: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});
