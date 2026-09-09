export interface LoginRequestBody {
  email: string;
  password: string;
  rememberMe?: boolean | undefined;
  captchaChallengeId: string;
  captchaAnswer: string;
}

export interface ForgotPasswordRequestBody {
  identifier: string;
  captchaChallengeId: string;
  captchaAnswer: string;
}

export interface ResetPasswordRequestBody {
  token: string;
  newPassword: string;
}
