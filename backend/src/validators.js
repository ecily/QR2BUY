import { z } from 'zod';

export const updateSchema = z.object({
  text: z.string().trim().min(1).max(80),
  url:  z.string().url().max(2048)
});
