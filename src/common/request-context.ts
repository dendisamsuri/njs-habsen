import { Global, Injectable, Module, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { resolveLocale, Locale } from '../i18n/messages';

export interface RequestContext {
  locale: Locale;
  companyId?: number;
  user?: {
    id: number;
    email: string;
    role: string;
    companyId: number | null;
    jwtVersion: number;
    langPref: string;
  };
}

export const REQUEST_CONTEXT = Symbol('REQUEST_CONTEXT');

@Injectable()
export class RequestContextService {
  constructor(
    @Inject(REQUEST_CONTEXT) private readonly als: AsyncLocalStorage<RequestContext>,
  ) {}

  get store(): RequestContext | undefined {
    return this.als.getStore();
  }

  get locale(): Locale {
    return this.als.getStore()?.locale ?? 'id';
  }

  get companyId(): number | undefined {
    return this.als.getStore()?.companyId;
  }

  run<T>(ctx: RequestContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly rcs: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const accept = req.headers['accept-language'];
    const userLang = (req as any).user?.langPref;
    const locale = resolveLocale(typeof accept === 'string' ? accept : undefined, userLang);
    const ctx: RequestContext = { locale };
    this.rcs.run(ctx, () => next());
  }
}

@Global()
@Module({
  providers: [
    RequestContextService,
    {
      provide: REQUEST_CONTEXT,
      useValue: new AsyncLocalStorage<RequestContext>(),
    },
  ],
  exports: [RequestContextService, REQUEST_CONTEXT],
})
export class RequestContextModule {}
