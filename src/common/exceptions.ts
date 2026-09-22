import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { t, Locale } from '../i18n/messages';

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    status: number,
    message?: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message ?? errorCode, status);
  }
}

export function err(errorCode: string, status = 400, meta?: Record<string, unknown>): AppException {
  return new AppException(errorCode, status, undefined, meta);
}

const HTTP_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  502: 'FACE_SERVICE_ERROR',
  503: 'FACE_SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const locale = ((req as any).locale ?? (res as any).locals?.locale ?? 'id') as Locale;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'SERVER_ERROR';
    let message: string | undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message !== errorCode ? exception.message : undefined;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const obj = resp as any;
        errorCode = obj.errorCode ?? obj.error_code ?? HTTP_CODE_MAP[status] ?? 'SERVER_ERROR';
        message = typeof obj.message === 'string' ? obj.message : Array.isArray(obj.message) ? obj.message.join('; ') : undefined;
        // class-validator → VALIDATION_ERROR, messages in meta
        if (Array.isArray(obj.message)) {
          errorCode = 'VALIDATION_ERROR';
        }
      }
    } else if (exception instanceof Error) {
      // never leak stack/SQL
      message = undefined;
      errorCode = 'SERVER_ERROR';
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    if (status < 500 && errorCode === 'SERVER_ERROR' && message) {
      // keep explicit low-status messages under a generic code if none set
      errorCode = HTTP_CODE_MAP[status] ?? 'VALIDATION_ERROR';
    }

    const body: Record<string, unknown> = {
      status: 'error',
      error_code: errorCode,
      message: message ?? t(errorCode, locale),
    };

    res.status(status).json(body);
  }
}
