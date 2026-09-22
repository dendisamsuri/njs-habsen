import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { resolveLocale } from './i18n/messages';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // helmet default 'no-referrer' hides our origin from cross-site assets (OSM tiles return 403 without it).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use((req: any, _res: any, next: any) => {
    req.locale = resolveLocale(req.headers['accept-language']);
    next();
  });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api/v1', { exclude: ['ui', 'ui/(.*)', 'health', 'uploads', 'uploads/(.*)'] });
  app.setViewEngine('ejs');
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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
