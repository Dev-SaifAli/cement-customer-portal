export interface LoginRequestBody {
  email: string;
  password: string;
  rememberMe?: boolean | undefined;
  captchaChallengeId: string;
  captchaAnswer: string;
}

export interface ForgotPasswordRequestBody {
  email: string;
  captchaChallengeId: string;
  captchaAnswer: string;
}
