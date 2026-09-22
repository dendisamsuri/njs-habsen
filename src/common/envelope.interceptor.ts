import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { t, Locale } from '../i18n/messages';

export interface Envelope<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  error_code?: string;
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();
    const locale: Locale = req.locale ?? 'id';

    // HEAD probe — no body
    if (req.method === 'HEAD') {
      return next.handle().pipe(map(() => undefined));
    }

    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) {
          return { status: 'success', message: t('SUCCESS', locale) };
        }
        if (typeof body === 'object' && body !== null && 'status' in body && 'data' in (body as any)) {
          return body;
        }
        const envelope: Envelope<any> = {
          status: 'success',
          message: t('SUCCESS', locale),
          data: body as any,
        };
        res.locals = res.locals ?? {};
        return envelope;
      }),
    );
  }
}
