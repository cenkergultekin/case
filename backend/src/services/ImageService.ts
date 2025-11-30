import { randomUUID } from 'crypto';
import { imageSize } from 'image-size';
import { FalAIService } from './FalAIService';
import { FileStorageService } from './FileStorageService';
import { FirebaseStorageService } from './FirebaseStorageService';
import { FirebasePipelineRepository } from './FirebasePipelineRepository';
import { PromptService } from './PromptService';
import { createError } from '../middleware/errorHandler';
import {
  ImageMetadata,
  ImagePipelineRecord,
  ListOptions,
  ProcessedImagesListOptions,
  ProcessedVersion,
  UploadOptions
} from '../types/image';

export class ImageService {
  private falAIService: FalAIService;
  private storageService: FileStorageService | FirebaseStorageService;
  private pipelineRepository: FirebasePipelineRepository;
  private promptService: PromptService;

  constructor() {
    this.falAIService = new FalAIService();
    
    // Use Firebase Storage if enabled, otherwise use local filesystem
    const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
    if (useFirebaseStorage) {
      try {
        this.storageService = new FirebaseStorageService();
      } catch (error) {
        console.warn('Failed to initialize Firebase Storage, falling back to local storage:', error);
        this.storageService = new FileStorageService();
      }
    } else {
      this.storageService = new FileStorageService();
    }
    
    this.pipelineRepository = new FirebasePipelineRepository();
    this.promptService = new PromptService();
  }

  async processUpload(userId: string, file: Express.Multer.File, options: UploadOptions = {}): Promise<ImageMetadata> {
    try {
      const imageId = randomUUID();
      const filename = `${imageId}_${file.originalname}`;

      const storedFile = await this.storageService.saveFile(file.buffer, filename, file.mimetype);
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

      await this.pipelineRepository.saveOriginalImage(userId, metadata, options);
      return metadata;
    } catch (error) {
      throw createError(`Failed to process upload: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async processMultipleUploads(userId: string, files: Express.Multer.File[], options: UploadOptions = {}): Promise<ImageMetadata[]> {
    const results: ImageMetadata[] = [];

    for (const file of files) {
      try {
        const result = await this.processUpload(userId, file, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process file ${file.originalname}:`, error);
      }
    }

    return results;
  }

  async processWithFalAI(
    userId: string,
    imageId: string,
    operation: string,
    parameters: Record<string, any> = {},
    sourceProcessedVersionId?: string,
    angles?: number[],
    customPrompt?: string
  ): Promise<ProcessedVersion> {
    const image = await this.pipelineRepository.getPipeline(userId, imageId);
    if (!image) {
      throw createError('Image not found', 404);
    }

    const startTime = Date.now();

    try {
      let imageData: Buffer;
      let sourceFilename: string;

      if (sourceProcessedVersionId) {
        // Find the selected processed version
        let processedVersion = image.processedVersions?.find(pv => pv.id === sourceProcessedVersionId);
        if (!processedVersion) {
          throw createError(`Processed version not found: ${sourceProcessedVersionId}`, 404);
        }
        
        // Support nested sources: if the selected version has its own source, we can use it
        // But for now, we use the selected version's file directly
        // The selected version already contains the result of processing from its source
        imageData = await this.storageService.getFile(processedVersion.filename);
        sourceFilename = processedVersion.filename;
      } else {
        imageData = await this.storageService.getFile(image.filename);
        sourceFilename = image.filename;
      }

      // Generate prompt from angles if provided, otherwise use existing prompt in parameters
      let finalParameters = { ...parameters };
      let processedAngle: number | undefined = undefined;
      
      if (angles && angles.length > 0) {
        // Process each angle - for now, process first angle (batch processing can be handled separately)
        const angle = angles[0];
        processedAngle = angle;
        const finalPrompt = this.promptService.generateFinalPrompt(angle, customPrompt);
        finalParameters = {
          ...parameters,
          prompt: finalPrompt,
          angle: angle // Store angle in parameters for easy retrieval
        };
      } else if (customPrompt && customPrompt.trim()) {
        // If only custom prompt provided without angles, use it directly
        // This happens when user wants to edit without changing angle
        finalParameters = {
          ...parameters,
          prompt: customPrompt.trim()
        };
      } else {
        // No angles and no custom prompt - this should not happen but log it
        console.warn(`⚠️ No angles and no custom prompt provided!`);
      }

      const processedResult = await this.falAIService.processImage(imageData, operation, finalParameters);
      const processingTimeMs = Date.now() - startTime;
      const aiModel = this.extractAIModel(operation);

      const processedId = randomUUID();
      const smartFilename = this.generateSmartFilename(
        image.originalName,
        aiModel,
        operation,
        parameters,
        sourceProcessedVersionId ? sourceFilename : undefined
      );

      const processedFilename = `${processedId}_${smartFilename}.jpg`;
      const storedProcessed = await this.storageService.saveFile(
        processedResult.data,
        processedFilename,
        'image/jpeg'
      );

      const processedVersion: ProcessedVersion = {
        id: processedId,
        operation,
        aiModel,
        parameters: finalParameters, // Use finalParameters which includes angle
        filename: storedProcessed.filename,
        url: storedProcessed.url,
        size: storedProcessed.size,
        createdAt: new Date(),
        processingTimeMs,
        sourceImageId: imageId,
        sourceProcessedVersionId: sourceProcessedVersionId || undefined
      };

      await this.pipelineRepository.addProcessedVersion(userId, imageId, processedVersion);
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
      case 'flux-multi-angles':
        return 'flux-2-lora-multi-angles';
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
    let baseName = originalName.replace(/\.[^/.]+$/, '');

    if (sourceFilename) {
      const match = sourceFilename.match(/_[^_]+_(.+)$/);
      if (match && match[1]) {
        baseName = match[1].replace(/\.[^/.]+$/, '');
      }
    }

    baseName = baseName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    baseName = baseName.replace(/\s+/g, '-');
    if (baseName.length > 50) {
      baseName = baseName.substring(0, 50);
    }

    const parts: string[] = [];
    if (baseName && baseName.trim().length > 0) {
      parts.push(baseName);
    }

    const modelDisplayName = aiModel.replace(/-/g, '_');
    if (modelDisplayName && modelDisplayName.trim().length > 0) {
      parts.push(modelDisplayName);
    } else {
      const operationName = operation.split('-')[0] || 'processed';
      parts.push(operationName);
    }

    if (parameters.prompt) {
      const prompt = parameters.prompt.toLowerCase();
      const angleMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
      if (angleMatch && angleMatch[1]) {
        const angle = parseInt(angleMatch[1], 10);
        const normalizedAngle = this.normalizeAngle(angle);
        parts.push(`${normalizedAngle}deg`);
      } else {
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

    return parts.join('_');
  }

  private normalizeAngle(angle: number): number {
    angle = angle % 360;
    if (angle < 0) angle += 360;

    const commonAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    return commonAngles.reduce((prev, curr) =>
      Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev
    );
  }

  async getImage(userId: string, imageId: string): Promise<ImageMetadata | null> {
    return this.pipelineRepository.getPipeline(userId, imageId);
  }

  async listImages(userId: string, options: ListOptions): Promise<{ images: ImageMetadata[], total: number, page: number, totalPages: number }> {
    try {
      const pipelines = await this.pipelineRepository.listPipelines(userId);
      const filtered = this.applyImageFilter(pipelines, options.filter);
      const page = Math.max(1, options.page);
      const limit = Math.max(1, options.limit);

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const startIndex = (page - 1) * limit;
      const images = filtered.slice(startIndex, startIndex + limit);

      return {
        images,
        total,
        page,
        totalPages
      };
    } catch (error: any) {
      console.error('Error in listImages:', error);
      // Re-throw with more context
      if (error.message?.includes('index')) {
        throw createError('Firestore index required. Please create composite index: pipelines collection, fields: userId (Ascending), uploadedAt (Descending)', 500);
      }
      throw createError(`Failed to list images: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async listProcessedImages(userId: string, options: ProcessedImagesListOptions) {
    const pipelines = await this.pipelineRepository.listPipelines(userId);
    const allVersions = pipelines.flatMap((pipeline) => {
      const versions = pipeline.processedVersions || [];
      return versions.map(version => ({
        ...version,
        sourceImageId: pipeline.id
      }));
    });

    let filtered = allVersions;
    if (options.aiModel) {
      filtered = filtered.filter(version => version.aiModel === options.aiModel);
    }
    if (typeof options.minProcessingTime === 'number') {
      const minProcessingTime = options.minProcessingTime;
      filtered = filtered.filter(version => version.processingTimeMs >= minProcessingTime);
    }
    if (typeof options.maxProcessingTime === 'number') {
      const maxProcessingTime = options.maxProcessingTime;
      filtered = filtered.filter(version => version.processingTimeMs <= maxProcessingTime);
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const processedImages = filtered.slice(startIndex, startIndex + limit);

    return {
      processedImages,
      total,
      page,
      totalPages
    };
  }

  async deleteImage(userId: string, imageId: string): Promise<void> {
    const pipeline = await this.pipelineRepository.getPipeline(userId, imageId);
    if (!pipeline) {
      throw createError('Image not found', 404);
    }

    try {
      await this.storageService.deleteFile(pipeline.filename);
      if (pipeline.processedVersions) {
        for (const version of pipeline.processedVersions) {
          await this.storageService.deleteFile(version.filename);
        }
      }

      await this.pipelineRepository.deletePipeline(userId, imageId);
    } catch (error) {
      throw createError(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async deleteProcessedVersion(userId: string, imageId: string, versionId: string): Promise<void> {
    const pipeline = await this.pipelineRepository.getPipeline(userId, imageId);
    if (!pipeline) {
      throw createError('Image not found', 404);
    }

    // Find the version to delete
    const version = pipeline.processedVersions?.find(v => v.id === versionId);
    if (!version) {
      throw createError('Processed version not found', 404);
    }

    try {
      // Delete the file from storage
      await this.storageService.deleteFile(version.filename);
      
      // Delete the version from database
      await this.pipelineRepository.deleteProcessedVersion(userId, imageId, versionId);
    } catch (error) {
      throw createError(`Failed to delete processed version: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  private applyImageFilter(images: ImagePipelineRecord[], filter?: string) {
    if (!filter) {
      return images;
    }
    const lowerFilter = filter.toLowerCase();
    return images.filter(img =>
      img.originalName.toLowerCase().includes(lowerFilter) ||
      img.mimetype.toLowerCase().includes(lowerFilter)
    );
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number, height: number }> {
    try {
      const result = imageSize(buffer);
      const width = result.width || 0;
      const height = result.height || 0;
      if (!width || !height) {
        return { width: 0, height: 0 };
      }
      return { width, height };
    } catch (error) {
      console.error('Failed to read image dimensions:', error);
      return { width: 0, height: 0 };
    }
  }
}
