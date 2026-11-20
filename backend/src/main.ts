import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { config } from './config';
import { logger } from './logger';
import {
  ShutdownCoordinator,
  registerSignalHandlers,
} from './graceful_shutdown';

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
  app.enableCors();

  const port = config.port;
  await app.listen(port);

  // Register graceful shutdown resources with the coordinator.
  // Resources are resolved lazily/optionally so missing providers do not
  // break startup; the coordinator tolerates undefined resources.
  const coordinator = new ShutdownCoordinator();

  try {
    const httpServer = app.getHttpServer();
    if (httpServer) {
      coordinator.registerHttpServer(httpServer);
    }
  } catch (err) {
    logger.warn('HTTP server not available for shutdown registration', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const wsGateway = app.get('WebSocketGateway', { strict: false });
    if (wsGateway) {
      coordinator.registerWebSocketGateway(wsGateway);
    }
  } catch {
    // WebSocket gateway is optional; ignore when not registered.
  }

  try {
    const redis = app.get('RedisService', { strict: false });
    if (redis) {
      coordinator.registerRedis(redis);
    }
  } catch {
    // Redis is optional; ignore when not registered.
  }

  try {
    const prisma = app.get('PrismaService', { strict: false });
    if (prisma) {
      coordinator.registerPrisma(prisma);
    }
  } catch {
    // Prisma is optional; ignore when not registered.
  }

  try {
    const workers = app.get('WorkersService', { strict: false });
    if (workers) {
      coordinator.registerWorkers(workers);
    }
  } catch {
    // Workers are optional; ignore when not registered.
  }

  registerSignalHandlers(coordinator);

  logger.info(`🚀 Stellar Save Backend is running on http://localhost:${port}`, {
    environment: config.nodeEnv,
    network: config.stellar.network,
  });
}

bootstrap().catch(async (error) => {
  logger.error('Failed to bootstrap application', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Attempt a clean shutdown so partially-initialized resources are released.
  try {
    const coordinator = new ShutdownCoordinator();
    await coordinator.shutdown('bootstrap-failure');
  } catch (shutdownError) {
    logger.error('Clean shutdown after bootstrap failure also failed', {
      error:
        shutdownError instanceof Error
          ? shutdownError.message
          : String(shutdownError),
    });
  }

  process.exitCode = 1;
});