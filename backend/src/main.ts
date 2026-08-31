import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { logger } from './logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors();

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.info(`🚀 Stellar Save Backend is running on http://localhost:${port}`);
}

bootstrap();