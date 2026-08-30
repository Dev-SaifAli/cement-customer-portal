import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    const errors = toFieldErrors(error);
    response.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors,
        details: error.issues,
      },
    });
    return;
  }

  const appError =
    error instanceof AppError
      ? error
      : isPayloadTooLargeError(error)
        ? new AppError('Uploaded data is too large.', 413, 'PAYLOAD_TOO_LARGE')
      : request.originalUrl.startsWith('/api/v1/registrations')
        ? new AppError(
            'Registration service is temporarily unavailable.',
            503,
            'REGISTRATION_SERVICE_UNAVAILABLE',
          )
        : new AppError('The service is temporarily unavailable.', 503, 'SERVICE_UNAVAILABLE');
  logger.error({ err: error }, appError.message);
  const validationErrors =
    appError.code === 'VALIDATION_ERROR' && isValidationErrorMap(appError.details)
      ? appError.details
      : undefined;
  response.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    ...(validationErrors ? { errors: validationErrors } : {}),
    error: {
      code: appError.code,
      message: appError.message,
      ...(validationErrors ? { errors: validationErrors } : {}),
    },
  });
};

function toFieldErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'request';
    errors[key] = issue.message;
    return errors;
  }, {});
}

function isValidationErrorMap(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function isPayloadTooLargeError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}
