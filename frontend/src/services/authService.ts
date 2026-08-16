const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export type AuthErrorCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'CAPTCHA_EXPIRED'
  | 'CAPTCHA_FAILED'
  | 'CAPTCHA_REQUIRED'
  | 'CAPTCHA_UNAVAILABLE'
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR';

interface ApiErrorBody {
  error?: {
    code?: AuthErrorCode;
    message?: string;
  };
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const postAuth = async <TResponse>(path: string, body: unknown): Promise<TResponse> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError(
      'Unable to connect. Please check your network and try again.',
      'NETWORK_ERROR',
    );
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new AuthApiError(
      data.error?.message ?? 'The request could not be completed.',
      data.error?.code ?? 'NETWORK_ERROR',
      response.status,
    );
  }

  return data as TResponse;
};

export const login = (payload: {
  email: string;
  password: string;
  rememberMe: boolean;
  captchaChallengeId: string;
  captchaAnswer: string;
}) => postAuth('/auth/login', payload);

export const requestPasswordReset = (payload: {
  email: string;
  captchaChallengeId: string;
  captchaAnswer: string;
}) => postAuth<{ success: boolean; message: string }>('/auth/forgot-password', payload);
