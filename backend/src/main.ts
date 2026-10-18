import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { config } from './config';
import { logger } from './logger';

async function bootstrap() {
  // Validate configuration on startup (fails fast if misconfigured)
  // The config module validates all environment variables using Zod schema
  logger.info('Validating environment configuration...', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    stellarNetwork: config.stellar.network,
  });

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({
    origin: config.nodeEnv === 'development' ? true : config.cors.allowedOrigins,
  });

  const port = config.port;
  await app.listen(port);

  logger.info(`🚀 Stellar Save Backend is running on http://localhost:${port}`, {
    environment: config.nodeEnv,
    network: config.stellar.network,
  });
}

bootstrap();
