import { AppError } from '../../errors/app-error.js';
import { captchaService } from './captcha.service.js';
import type { ForgotPasswordRequestBody, LoginRequestBody } from './auth.types.js';

const genericForgotPasswordMessage =
  'If an account exists for this email, password reset instructions will be sent.';

export class AuthService {
  async createCaptchaChallenge() {
    return {
      success: true,
      captcha: captchaService.createChallenge(),
    };
  }

  async login(payload: LoginRequestBody) {
    await captchaService.verifyChallenge({
      challengeId: payload.captchaChallengeId,
      answer: payload.captchaAnswer,
    });

    throw new AppError('Authentication service is not connected yet.', 501, 'AUTH_NOT_CONFIGURED');
  }

  async forgotPassword(payload: ForgotPasswordRequestBody) {
    await captchaService.verifyChallenge({
      challengeId: payload.captchaChallengeId,
      answer: payload.captchaAnswer,
    });
    void payload;

    return {
      success: true,
      message: genericForgotPasswordMessage,
    };
  }
}

export const authService = new AuthService();
