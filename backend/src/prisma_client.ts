import { PrismaClient } from '@prisma/client';

// Centralized Prisma client for the backend.
export const prisma = new PrismaClient();
