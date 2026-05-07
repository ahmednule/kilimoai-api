import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/index.js';

export interface AuthRequest extends Request {
  userId?: string;
  user?: JWTPayload;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  try {
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    req.userId = decoded.userId;
    req.user = decoded;
  } catch (error) {
    console.error('Invalid token:', error);
  }

  next();
};
