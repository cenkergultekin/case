import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { ImageService } from '../services/ImageService';
import { validateImageUpload } from '../validators/imageValidator';
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth';

const router = Router();
const imageService = new ImageService();

const requireUserId = (req: Request) => {
  if (!req.user?.uid) {
    throw createError('User not authenticated', 401);
  }
  return req.user.uid;
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  }
});

router.use(firebaseAuthMiddleware);

// Upload single image
router.post('/upload',
  upload.single('image'),
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
  upload.array('images', 5),
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
