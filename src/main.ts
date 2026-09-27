import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { resolveLocale } from './i18n/messages';

function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error('CORS_ORIGINS has no usable origin');
  for (const origin of list) {
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
      throw new Error(`CORS_ORIGINS entry is not an http(s) origin: ${origin}`);
    }
  }
  return list;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(
    helmet({
      // 'unsafe-inline' is unavoidable while the admin EJS pages carry inline script blocks.
      // What CSP buys here: no third-party script origin, no framing, no base-tag hijack.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
          'font-src': ["'self'", 'data:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          // Rewrites the dev server's own http:// URLs, so it only belongs in production.
          'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // helmet's default 'no-referrer' hides our origin from cross-site assets (OSM tiles return 403 without it).
      crossOriginResourcePolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '10mb' });
  app.use((req: any, _res: any, next: any) => {
    req.locale = resolveLocale(req.headers['accept-language']);
    next();
  });
  app.enableCors({ origin: corsOrigins(), credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api/v1', { exclude: ['ui', 'ui/(.*)', 'health'] });
  app.setViewEngine('ejs');
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  // One proxy hop (cloudflared) and the app binds loopback only, so req.ip is the real client.
  app.set('trust proxy', 1);
  app.useStaticAssets(join(process.cwd(), 'views', 'vendor'), { prefix: '/vendor/' });
  // uploads/ is deliberately not served statically — attendance selfies, face masters and
  // leave attachments are PII. Every read goes through a controller that checks the requester.

  // HEAD probe tolerance — Flutter signal meter hits bare host every 15s
  const server = app.getHttpServer();
  server.on('request', (req: any, res: any) => {
    if (req.method === 'HEAD' && req.url === '/') {
      res.statusCode = 200;
      res.end();
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Listening on :${port}`);
}
void bootstrap();
