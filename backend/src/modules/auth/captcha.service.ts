import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../errors/app-error.js';

interface CaptchaRecord {
  answerHash: string;
  expiresAt: number;
  salt: string;
}

export interface CaptchaChallenge {
  challengeId: string;
  prompt: string;
  expiresAt: string;
}

export interface CaptchaVerificationInput {
  challengeId: string;
  answer: string;
}

export interface CaptchaProvider {
  createChallenge(): CaptchaChallenge;
  verifyChallenge(input: CaptchaVerificationInput): Promise<void>;
}

const challengeStore = new Map<string, CaptchaRecord>();
const operations = ['+', '-'] as const;

const normalizeAnswer = (answer: string) => answer.trim().replace(/\s+/g, '').toLowerCase();

const hashAnswer = (answer: string, salt: string) =>
  createHash('sha256')
    .update(`${salt}:${normalizeAnswer(answer)}`)
    .digest('hex');

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export class ServerCaptchaService implements CaptchaProvider {
  createChallenge(): CaptchaChallenge {
    this.cleanupExpiredChallenges();

    const operation = operations[randomInt(operations.length)];
    const firstNumber = randomInt(3, 18);
    const secondNumber = randomInt(2, 10);
    const [left, right] =
      operation === '-' && firstNumber < secondNumber
        ? [secondNumber, firstNumber]
        : [firstNumber, secondNumber];
    const answer = operation === '+' ? left + right : left - right;
    const challengeId = randomUUID();
    const salt = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + env.CAPTCHA_TTL_MS;

    challengeStore.set(challengeId, {
      answerHash: hashAnswer(String(answer), salt),
      expiresAt,
      salt,
    });

    return {
      challengeId,
      prompt: `What is ${left} ${operation} ${right}?`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async verifyChallenge({ challengeId, answer }: CaptchaVerificationInput): Promise<void> {
    if (!challengeId.trim() || !answer.trim()) {
      throw new AppError('Please complete the security verification.', 400, 'CAPTCHA_REQUIRED');
    }

    const record = challengeStore.get(challengeId);
    challengeStore.delete(challengeId);

    if (!record) {
      throw new AppError(
        'Security verification expired. Please try again.',
        400,
        'CAPTCHA_EXPIRED',
      );
    }

    if (record.expiresAt < Date.now()) {
      logger.info({ challengeId }, 'Expired CAPTCHA challenge rejected');
      throw new AppError(
        'Security verification expired. Please try again.',
        400,
        'CAPTCHA_EXPIRED',
      );
    }

    const submittedHash = hashAnswer(answer, record.salt);
    if (!safeCompare(submittedHash, record.answerHash)) {
      throw new AppError('Please complete the security verification.', 400, 'CAPTCHA_FAILED');
    }
  }

  private cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [challengeId, record] of challengeStore.entries()) {
      if (record.expiresAt < now) challengeStore.delete(challengeId);
    }
  }
}

export const captchaService: CaptchaProvider = new ServerCaptchaService();
