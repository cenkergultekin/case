import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { ImageService } from '../services/ImageService';
import { PromptAssistantService } from '../services/PromptAssistantService';
import { validateImageUpload } from '../validators/imageValidator';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth';
import { imageUpload } from '../middleware/upload';
import { requireUserId } from '../utils/auth';

const router = Router();
const imageService = new ImageService();
const promptAssistantService = new PromptAssistantService();

router.use(firebaseAuthMiddleware);

// Upload single image
router.post('/upload',
  imageUpload.single('image'),
  validateImageUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw createError('No image file provided', 400);
    }

    const userId = requireUserId(req);
    const result = await imageService.processUpload(userId, req.file, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });
  })
);

// Upload multiple images
router.post('/upload-multiple',
  imageUpload.array('images', 5),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw createError('No image files provided', 400);
    }

    const userId = requireUserId(req);
    const results = await imageService.processMultipleUploads(userId, files, req.body);
    
    res.status(201).json({
      success: true,
      message: `${files.length} images uploaded successfully`,
      data: results
    });
  })
);

// List processed images (spesifik route'lar önce gelmeli)
router.get('/processed',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { page = 1, limit = 20, aiModel, minProcessingTime, maxProcessingTime } = req.query;
    const processedImages = await imageService.listProcessedImages(userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      aiModel: aiModel as string,
      minProcessingTime: minProcessingTime ? Number(minProcessingTime) : undefined,
      maxProcessingTime: maxProcessingTime ? Number(maxProcessingTime) : undefined
    });
    
    res.status(200).json({
      success: true,
      data: processedImages
    });
  })
);

// Process image with fal.ai (spesifik route, :imageId'den önce gelmeli)
router.post('/process/:imageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { imageId } = req.params;
    const { operation, parameters, sourceProcessedVersionId, angles, customPrompt } = req.body;

    if (!operation) {
      throw createError('Processing operation is required', 400);
    }

    const result = await imageService.processWithFalAI(userId, imageId, operation, parameters, sourceProcessedVersionId, angles, customPrompt);
    
    res.status(200).json({
      success: true,
      message: 'Image processed successfully',
      data: result
    });
  })
);

// Smart prompt assistant
router.post('/:imageId/prompt-assistant',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { imageId } = req.params;
    const { sourceProcessedVersionId, angles, userNotes } = req.body;

    if (!sourceProcessedVersionId) {
      throw createError('Kaynak alınacak işlenmiş görsel ID\'si gereklidir', 400);
    }

    const normalizedAngles = Array.isArray(angles)
      ? angles
          .map((angle: unknown) => Number(angle))
          .filter((angle: number) => Number.isFinite(angle))
      : undefined;

    const assistantResponse = await promptAssistantService.generatePrompt(
      userId,
      imageId,
      sourceProcessedVersionId,
      {
        targetAngles: normalizedAngles,
        userNotes: typeof userNotes === 'string' ? userNotes : undefined
      }
    );

    res.status(200).json({
      success: true,
      data: assistantResponse
    });
  })
);

// Get image by ID (genel route, en sonda)
router.get('/:imageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { imageId } = req.params;
    const image = await imageService.getImage(userId, imageId);
    
    if (!image) {
      throw createError('Image not found', 404);
    }

    res.status(200).json({
      success: true,
      data: image
    });
  })
);

// List user images (genel route, en sonda)
router.get('/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { page = 1, limit = 10, filter } = req.query;
    const images = await imageService.listImages(userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      filter: filter as string
    });
    
    res.status(200).json({
      success: true,
      data: images
    });
  })
);

// Delete processed version (must come before delete image route)
router.delete('/:imageId/versions/:versionId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { imageId, versionId } = req.params;
    await imageService.deleteProcessedVersion(userId, imageId, versionId);
    
    res.status(200).json({
      success: true,
      message: 'Processed version deleted successfully'
    });
  })
);

// Delete image
router.delete('/:imageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { imageId } = req.params;
    await imageService.deleteImage(userId, imageId);
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  })
);

export { router as imageRoutes };
