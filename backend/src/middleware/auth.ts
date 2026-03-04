import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const env = getEnv();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);

  if (token !== env.API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  (req as AuthenticatedRequest).userId = env.SINGLE_USER_ID;
  next();
}
