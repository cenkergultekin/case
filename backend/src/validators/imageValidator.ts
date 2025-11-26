import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createError } from '../middleware/errorHandler';

const uploadSchema = Joi.object({
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  description: Joi.string().max(500).optional(),
  isPublic: Joi.boolean().optional()
});

const processSchema = Joi.object({
  operation: Joi.string().valid(
    'enhance',
    'remove-background',
    'upscale',
    'style-transfer',
    'generate-variation'
  ).required(),
  parameters: Joi.object({
    scale_factor: Joi.number().min(1).max(4).optional(),
    strength: Joi.number().min(0).max(1).optional(),
    prompt: Joi.string().max(1000).optional(),
    style: Joi.string().max(100).optional()
  }).optional()
});

export const validateImageUpload = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = uploadSchema.validate(req.body);
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    throw createError(`Validation error: ${message}`, 400);
  }

  // Validate file
  if (!req.file) {
    throw createError('Image file is required', 400);
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (req.file.size > maxSize) {
    throw createError('File size exceeds 10MB limit', 400);
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    throw createError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed', 400);
  }

  next();
};

export const validateImageProcess = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = processSchema.validate(req.body);
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    throw createError(`Validation error: ${message}`, 400);
  }

  next();
};

export const validateImageId = (req: Request, res: Response, next: NextFunction): void => {
  const { imageId } = req.params;
  
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(imageId)) {
    throw createError('Invalid image ID format', 400);
  }

  next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (page < 1) {
    throw createError('Page must be greater than 0', 400);
  }

  if (limit < 1 || limit > 100) {
    throw createError('Limit must be between 1 and 100', 400);
  }

  // Add validated values to request
  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
};
