import { z } from 'zod';

export const customerLoginSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});
