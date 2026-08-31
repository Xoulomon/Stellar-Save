// Lightweight rate-limiting middleware scaffold
import { Request, Response, NextFunction } from 'express';

// TODO: Implement per-docs/api-rate-limiting.md policy
export default function rateLimit(req: Request, res: Response, next: NextFunction) {
  // Placeholder: allow all requests for now
  // Intended: use Redis or in-memory store to track counts and enforce limits
  next();
}
