const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export interface CaptchaChallenge {
  challengeId: string;
  prompt: string;
  expiresAt: string;
}

interface CaptchaChallengeResponse {
  success: boolean;
  captcha: CaptchaChallenge;
}

export const fetchCaptchaChallenge = async (): Promise<CaptchaChallenge> => {
  const response = await fetch(`${apiBaseUrl}/auth/captcha`);

  if (!response.ok) {
    throw new Error('Unable to load security verification.');
  }

  const data = (await response.json()) as CaptchaChallengeResponse;
  return data.captcha;
};
