import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';

const solvePrompt = (prompt: string) => {
  const match = /What is (?<left>\d+) (?<operation>[+-]) (?<right>\d+)\?/.exec(prompt);
  if (!match?.groups) throw new Error(`Unexpected CAPTCHA prompt: ${prompt}`);

  const left = Number(match.groups.left);
  const right = Number(match.groups.right);
  return String(match.groups.operation === '+' ? left + right : left - right);
};

const getCaptcha = async () => {
  const response = await request(createApp()).get('/api/v1/auth/captcha');
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body.captcha as {
    challengeId: string;
    prompt: string;
    expiresAt: string;
  };
};

describe('GET /api/v1/auth/captcha', () => {
  it('creates a server-side CAPTCHA challenge without exposing the answer', async () => {
    const captcha = await getCaptcha();

    expect(captcha.challengeId).toEqual(expect.any(String));
    expect(captcha.prompt).toMatch(/^What is \d+ [+-] \d+\?$/);
    expect(Date.parse(captcha.expiresAt)).toBeGreaterThan(Date.now());
    expect(captcha).not.toHaveProperty('answer');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_LOGIN_RATE_LIMIT_MAX', '10');
  });

  it('requires a CAPTCHA answer', async () => {
    const response = await request(createApp()).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password',
      captchaChallengeId: '',
      captchaAnswer: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CAPTCHA_REQUIRED');
  });

  it('rejects expired or unknown CAPTCHA challenges', async () => {
    const response = await request(createApp()).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password',
      captchaChallengeId: 'missing-challenge',
      captchaAnswer: '12',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CAPTCHA_EXPIRED');
  });

  it('verifies CAPTCHA before reaching the not-yet-connected credential service', async () => {
    const captcha = await getCaptcha();

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'password',
        captchaChallengeId: captcha.challengeId,
        captchaAnswer: solvePrompt(captcha.prompt),
      });

    expect(response.status).toBe(501);
    expect(response.body.error.code).toBe('AUTH_NOT_CONFIGURED');
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX', '10');
  });

  it('returns a generic response after CAPTCHA verification', async () => {
    const captcha = await getCaptcha();

    const response = await request(createApp())
      .post('/api/v1/auth/forgot-password')
      .send({
        email: 'person@example.com',
        captchaChallengeId: captcha.challengeId,
        captchaAnswer: solvePrompt(captcha.prompt),
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'If an account exists for this email, password reset instructions will be sent.',
    });
  });

  it('does not process the request when CAPTCHA verification fails', async () => {
    const captcha = await getCaptcha();

    const response = await request(createApp()).post('/api/v1/auth/forgot-password').send({
      email: 'person@example.com',
      captchaChallengeId: captcha.challengeId,
      captchaAnswer: 'wrong',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CAPTCHA_FAILED');
  });
});
