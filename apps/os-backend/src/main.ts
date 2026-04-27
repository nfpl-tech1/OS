import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded app images as static files
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Parse cookies — required for httpOnly session cookie
  app.use(cookieParser());

  // Validate all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allow os-frontend to send cookies
  const configuredCorsOrigins = parseCsv(process.env.CORS_ORIGINS);
  const corsOrigins = configuredCorsOrigins.length
    ? configuredCorsOrigins
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? '0.0.0.0';
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;

  await app.listen(port, host);
  console.log(`OS Backend running on ${publicBaseUrl} (bound to ${host}:${port})`);
}

bootstrap();
