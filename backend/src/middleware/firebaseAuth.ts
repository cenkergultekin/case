import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../services/firebaseAdmin';
import { createError } from './errorHandler';

export const firebaseAuthMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('Authorization token missing', 401));
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || undefined
    };

    next();
  } catch (error) {
    next(createError('Invalid or expired authentication token', 401));
  }
};

