import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { ImageService } from '../services/ImageService';
import { validateImageUpload } from '../validators/imageValidator';

const router = Router();
const imageService = new ImageService();

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

// Upload single image
router.post('/upload', 
  upload.single('image'),
  validateImageUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw createError('No image file provided', 400);
    }

    const result = await imageService.processUpload(req.file, req.body);
    
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

    const results = await imageService.processMultipleUploads(files, req.body);
    
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
    const { page = 1, limit = 20, aiModel, minProcessingTime, maxProcessingTime } = req.query;
    const processedImages = await imageService.listProcessedImages({
      page: Number(page),
      limit: Number(limit),
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
    const { imageId } = req.params;
    const { operation, parameters, sourceProcessedVersionId } = req.body;

    if (!operation) {
      throw createError('Processing operation is required', 400);
    }

    const result = await imageService.processWithFalAI(imageId, operation, parameters, sourceProcessedVersionId);
    
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
    const { imageId } = req.params;
    const image = await imageService.getImage(imageId);
    
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
    const { page = 1, limit = 10, filter } = req.query;
    const images = await imageService.listImages({
      page: Number(page),
      limit: Number(limit),
      filter: filter as string
    });
    
    res.status(200).json({
      success: true,
      data: images
    });
  })
);

// Delete image
router.delete('/:imageId',
  asyncHandler(async (req: Request, res: Response) => {
    const { imageId } = req.params;
    await imageService.deleteImage(imageId);
    
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  })
);

export { router as imageRoutes };
