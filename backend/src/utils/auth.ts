import { Request } from 'express';
import { createError } from '../middleware/errorHandler';

/**
 * Ensure that a Firebase-authenticated user exists on the request
 * and return its UID. Throws a 401 error otherwise.
 */
export const requireUserId = (req: Request): string => {
  if (!req.user?.uid) {
    throw createError('User not authenticated', 401);
  }
  return req.user.uid;
};


