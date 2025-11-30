export interface ProcessedVersion {
  id: string;
  operation: string;
  aiModel: string;
  parameters: Record<string, any>;
  filename: string;
  url: string;
  size: number;
  createdAt: Date;
  processingTimeMs: number;
  sourceImageId?: string;
  sourceProcessedVersionId?: string;
}

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
  url?: string; // URL from storage service (Firebase Storage or local)
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

export interface ProcessedImagesListOptions {
  page: number;
  limit: number;
  aiModel?: string;
  minProcessingTime?: number;
  maxProcessingTime?: number;
}

export interface ImagePipelineRecord extends ImageMetadata {
  userId: string;
  tags?: string[];
  description?: string;
  isPublic?: boolean;
  processedVersionCount?: number;
}

