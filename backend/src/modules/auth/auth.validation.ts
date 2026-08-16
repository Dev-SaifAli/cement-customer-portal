import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  captchaChallengeId: z.string(),
  captchaAnswer: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
  captchaChallengeId: z.string(),
  captchaAnswer: z.string(),
});
