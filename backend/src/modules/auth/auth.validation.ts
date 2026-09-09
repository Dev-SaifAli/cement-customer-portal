import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  captchaChallengeId: z.string(),
  captchaAnswer: z.string(),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.');

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'Email address or mobile number is required.')
  .max(254)
  .refine(
    (value) => z.email().safeParse(value).success || /^\+9665\d{8}$/.test(value),
    'Enter a valid email address or mobile number in +9665XXXXXXXX format.',
  );

export const forgotPasswordSchema = z.object({
  identifier: identifierSchema,
  captchaChallengeId: z.string(),
  captchaAnswer: z.string(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(512),
  newPassword: passwordSchema,
});
