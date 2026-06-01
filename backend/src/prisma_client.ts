import { PrismaClient } from '@prisma/client';
import { config } from './config';

// Centralized Prisma client for the backend.
// Uses DATABASE_URL from config which supports both direct URL and Secrets Manager components
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});
