import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { FalAIService } from '../services/FalAIService';

const router = Router();
const falAIService = new FalAIService();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'Backend service is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  res.status(200).json({
    success: true,
    data: healthCheck
  });
}));

router.get('/fal', asyncHandler(async (req: Request, res: Response) => {
  const falConnection = await falAIService.testConnection();
  
  const apiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY;
  
  res.status(200).json({
    success: true,
    data: {
      falAIConnected: falConnection,
      hasApiKey: !!apiKey,
      apiKeyType: process.env.FAL_KEY ? 'FAL_KEY' : process.env.FAL_SUBSCRIBER_KEY ? 'FAL_SUBSCRIBER_KEY' : 'none',
      message: falConnection ? 'Fal.ai connection successful' : 'Fal.ai connection failed'
    }
  });
}));

export { router as healthRoutes };
