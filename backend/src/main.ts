import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { config } from './config';
import { logger } from './logger';
import { requestId } from './middleware/requestId';
import { errorMiddleware } from './middleware/errorMiddleware';
import { notFoundMiddleware } from './middleware/notFoundMiddleware';

async function bootstrap() {
  // Validate configuration on startup (fails fast if misconfigured)
  // The config module validates all environment variables using Zod schema
  logger.info('Validating environment configuration...', {
    nodeEnv: config.nodeEnv,
    port: config.port,
    stellarNetwork: config.stellar.network,
  });

  const app = await NestFactory.create(AppModule);

  // Request-ID propagation: assign/propagate a request id for every request
  // so it can be included in logs and error responses.
  app.use(requestId);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors();

  // Consolidated error handling middleware (mounted after routes are resolved).
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  const port = config.port;
  await app.listen(port);

  logger.info(`🚀 Stellar Save Backend is running on http://localhost:${port}`, {
    environment: config.nodeEnv,
    network: config.stellar.network,
  });
}

bootstrap();