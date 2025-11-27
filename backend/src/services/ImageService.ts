import { randomUUID } from 'crypto';
import { FalAIService } from './FalAIService';
import { FileStorageService } from './FileStorageService';
import { createError } from '../middleware/errorHandler';

export interface ImageMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
  processedVersions?: ProcessedVersion[];
}

export interface ProcessedVersion {
  id: string;
  operation: string;
  aiModel: string; // e.g., 'flux', 'seedream', 'nano-banana'
  parameters: Record<string, any>;
  filename: string;
  url: string;
  createdAt: Date;
  processingTimeMs: number;
  sourceImageId?: string; // For tracking which image was used as source
  sourceProcessedVersionId?: string; // For tracking which processed version was used as source
}

export interface UploadOptions {
  tags?: string[];
  description?: string;
  isPublic?: boolean;
}

export interface ListOptions {
  page: number;
  limit: number;
  filter?: string;
}

export class ImageService {
  private falAIService: FalAIService;
  private storageService: FileStorageService;
  private imageStore: Map<string, ImageMetadata> = new Map();

  constructor() {
    this.falAIService = new FalAIService();
    this.storageService = new FileStorageService();
    // Server başlatıldığında mevcut dosyaları yükle
    this.loadExistingImages();
  }

  /**
   * Server restart sonrası mevcut dosyaları imageStore'a yükle
   */
  private async loadExistingImages() {
    try {
      const files = await this.storageService.listFiles();
      
      for (const file of files) {
        try {
          // Skip .gitkeep and other non-image files
          if (file.filename.startsWith('.') || file.filename.endsWith('.glb')) {
            continue;
          }
          
          let imageId: string;
          let originalName: string;
          
          // Yeni format: {uuid}_{originalName}
          const firstUnderscore = file.filename.indexOf('_');
          
          if (firstUnderscore !== -1) {
            // Yeni format: underscore var
            imageId = file.filename.substring(0, firstUnderscore);
            originalName = file.filename.substring(firstUnderscore + 1);
          } else {
            // Eski format: {uuid}.ext (underscore yok)
            // Extension'ı çıkar ve UUID'yi al
            const lastDot = file.filename.lastIndexOf('.');
            if (lastDot === -1) {
              continue;
            }
            
            imageId = file.filename.substring(0, lastDot);
            originalName = file.filename; // Full filename as originalName
          }
          
          // UUID validation (basic check)
          if (imageId.length < 32 || !imageId.includes('-')) {
            continue;
          }
          
          // Eğer zaten yüklüyse skip et
          if (this.imageStore.has(imageId)) {
            continue;
          }
          
          // Metadata oluştur
          const metadata: ImageMetadata = {
            id: imageId,
            originalName: originalName,
            filename: file.filename,
            mimetype: file.mimetype || 'image/jpeg',
            size: file.size,
            width: 0, // Dimensions unknown after restart
            height: 0,
            uploadedAt: new Date(file.createdAt),
            processedVersions: []
          };
          
          this.imageStore.set(imageId, metadata);
          
        } catch (error) {
          // Silently skip files that can't be loaded
          continue;
        }
      }
      
    } catch (error) {
      // Silently fail - images will be loaded on demand
    }
  }

  async processUpload(file: Express.Multer.File, options: UploadOptions = {}): Promise<ImageMetadata> {
    try {
      const imageId = randomUUID();
      const filename = `${imageId}_${file.originalname}`;

      // Store file
      const storedFile = await this.storageService.saveFile(file.buffer, filename, file.mimetype);

      // Get image dimensions (basic implementation)
      const dimensions = await this.getImageDimensions(file.buffer);

      const metadata: ImageMetadata = {
        id: imageId,
        originalName: file.originalname,
        filename: storedFile.filename,
        mimetype: file.mimetype,
        size: file.size,
        width: dimensions.width,
        height: dimensions.height,
        uploadedAt: new Date(),
        processedVersions: []
      };

      // Store metadata
      this.imageStore.set(imageId, metadata);

      return metadata;
    } catch (error) {
      throw createError(`Failed to process upload: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async processMultipleUploads(files: Express.Multer.File[], options: UploadOptions = {}): Promise<ImageMetadata[]> {
    const results: ImageMetadata[] = [];
    
    for (const file of files) {
      try {
        const result = await this.processUpload(file, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process file ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  async processWithFalAI(imageId: string, operation: string, parameters: Record<string, any> = {}, sourceProcessedVersionId?: string): Promise<ProcessedVersion> {
    const image = this.imageStore.get(imageId);
    if (!image) {
      throw createError('Image not found', 404);
    }

    const startTime = Date.now();

    try {
      let imageData: Buffer;
      let sourceFilename: string;

      // If sourceProcessedVersionId is provided, use processed image as source
      if (sourceProcessedVersionId) {
        const processedVersion = image.processedVersions?.find(pv => pv.id === sourceProcessedVersionId);
        if (!processedVersion) {
          throw createError('Processed version not found', 404);
        }
        imageData = await this.storageService.getFile(processedVersion.filename);
        sourceFilename = processedVersion.filename;
      } else {
        // Use original image
        imageData = await this.storageService.getFile(image.filename);
        sourceFilename = image.filename;
      }
      
      // Process with fal.ai
      // Use base64 for all operations (including upscale) since localhost URLs aren't accessible from fal.ai
      const processedResult = await this.falAIService.processImage(imageData, operation, parameters);
      
      const endTime = Date.now();
      const processingTimeMs = endTime - startTime;

      // Extract AI model from operation
      const aiModel = this.extractAIModel(operation);
      
      // Generate smart filename
      const processedId = randomUUID();
      const smartFilename = this.generateSmartFilename(
        image.originalName,
        aiModel,
        operation,
        parameters,
        sourceProcessedVersionId ? sourceFilename : undefined
      );
      
      // Determine file extension
      const fileExtension = '.jpg';
      const processedFilename = `${processedId}_${smartFilename}${fileExtension}`;
      
      // Determine MIME type
      const mimeType = 'image/jpeg';
      
      const storedProcessed = await this.storageService.saveFile(
        processedResult.data,
        processedFilename,
        mimeType
      );

      const processedVersion: ProcessedVersion = {
        id: processedId,
        operation,
        aiModel,
        parameters,
        filename: storedProcessed.filename,
        url: storedProcessed.url,
        createdAt: new Date(),
        processingTimeMs,
        sourceImageId: imageId,
        sourceProcessedVersionId: sourceProcessedVersionId || undefined
      };

      // Update image metadata
      if (!image.processedVersions) {
        image.processedVersions = [];
      }
      image.processedVersions.push(processedVersion);
      this.imageStore.set(imageId, image);

      return processedVersion;
    } catch (error) {
      throw createError(`Failed to process image with fal.ai: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  private extractAIModel(operation: string): string {
    switch (operation) {
      case 'flux-pro-kontext':
        return 'flux';
      case 'seedream-edit':
        return 'seedream';
      case 'nano-banana-edit':
        return 'nano-banana';
      case 'topaz-upscale':
        return 'topaz';
      default:
        return operation.split('-')[0] || 'unknown';
    }
  }

  private generateSmartFilename(
    originalName: string,
    aiModel: string,
    operation: string,
    parameters: Record<string, any>,
    sourceFilename?: string
  ): string {
    // Get base name from original filename (remove extension and UUID prefix if exists)
    let baseName = originalName.replace(/\.[^/.]+$/, ""); // Remove extension
    
    // If sourceFilename is provided (processed version), try to extract original name from it
    if (sourceFilename) {
      // Try to extract original name from processed filename pattern
      const match = sourceFilename.match(/_[^_]+_(.+)$/);
      if (match && match[1]) {
        baseName = match[1].replace(/\.[^/.]+$/, "");
      }
    }
    
    // Clean base name: remove special characters, keep only alphanumeric, spaces, hyphens, underscores
    baseName = baseName.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
    // Replace spaces with hyphens
    baseName = baseName.replace(/\s+/g, "-");
    // Limit length
    if (baseName.length > 50) {
      baseName = baseName.substring(0, 50);
    }
    
    // Build filename parts
    const parts: string[] = [];
    
    // Add base name if available
    if (baseName && baseName.trim().length > 0) {
      parts.push(baseName);
    }
    
    // Always add AI model name (required)
    const modelDisplayName = aiModel.replace(/-/g, "_");
    if (modelDisplayName && modelDisplayName.trim().length > 0) {
      parts.push(modelDisplayName);
    } else {
      // Fallback: use operation name if model name is empty
      const operationName = operation.split('-')[0] || 'processed';
      parts.push(operationName);
    }
    
    // Extract angle from prompt if available
    if (parameters.prompt) {
      const prompt = parameters.prompt.toLowerCase();
      
      // Try to extract numeric angle first
      const angleMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
      if (angleMatch && angleMatch[1]) {
        const angle = parseInt(angleMatch[1]);
        // Normalize to common angles
        const normalizedAngle = this.normalizeAngle(angle);
        parts.push(`${normalizedAngle}deg`);
      } else {
        // Try to match common angle descriptions from prompt
        const angleMap: Record<string, string> = {
          'front view': '0deg',
          'side profile': '90deg',
          'back view': '180deg',
          'three-quarter view': '45deg',
          'rear three-quarter': '135deg'
        };
        for (const [key, value] of Object.entries(angleMap)) {
          if (prompt.includes(key)) {
            parts.push(value);
            break;
          }
        }
      }
    }
    
    // Add operation type if it's upscale
    if (operation === 'topaz-upscale') {
      parts.push('upscaled');
    }
    
    return parts.join("_");
  }

  private normalizeAngle(angle: number): number {
    // Normalize angle to 0-360 range
    angle = angle % 360;
    if (angle < 0) angle += 360;
    
    // Snap to nearest common angle (0, 45, 90, 135, 180, 225, 270, 315)
    const commonAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    return commonAngles.reduce((prev, curr) => 
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev
    );
  }

  async getImage(imageId: string): Promise<ImageMetadata | null> {
    return this.imageStore.get(imageId) || null;
  }

  async listImages(options: ListOptions): Promise<{ images: ImageMetadata[], total: number, page: number, totalPages: number }> {
    const allImages = Array.from(this.imageStore.values());
    
    // Apply filter if provided
    let filteredImages = allImages;
    if (options.filter) {
      const filterLower = options.filter.toLowerCase();
      filteredImages = allImages.filter(img => 
        img.originalName.toLowerCase().includes(filterLower) ||
        img.mimetype.toLowerCase().includes(filterLower)
      );
    }

    // Sort by upload date (newest first)
    filteredImages.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    // Pagination
    const total = filteredImages.length;
    const totalPages = Math.ceil(total / options.limit);
    const startIndex = (options.page - 1) * options.limit;
    const endIndex = startIndex + options.limit;
    const images = filteredImages.slice(startIndex, endIndex);

    return {
      images,
      total,
      page: options.page,
      totalPages
    };
  }

  async deleteImage(imageId: string): Promise<void> {
    const image = this.imageStore.get(imageId);
    if (!image) {
      throw createError('Image not found', 404);
    }

    try {
      // Delete original file
      await this.storageService.deleteFile(image.filename);

      // Delete processed versions
      if (image.processedVersions) {
        for (const version of image.processedVersions) {
          await this.storageService.deleteFile(version.filename);
        }
      }

      // Remove from store
      this.imageStore.delete(imageId);
    } catch (error) {
      throw createError(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number, height: number }> {
    // Basic implementation - in production, use a library like 'sharp' or 'jimp'
    // For now, return default dimensions
    return { width: 0, height: 0 };
  }
}
