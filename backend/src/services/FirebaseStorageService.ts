import admin from 'firebase-admin';
import { getStorage } from './firebaseAdmin';
import { createError } from '../middleware/errorHandler';

export interface StoredFile {
  filename: string;
  path: string;
  url: string;
  size: number;
}

export class FirebaseStorageService {
  private bucket: admin.storage.Bucket;
  private baseUrl: string;

  constructor() {
    const storage = getStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    
    if (!bucketName) {
      throw new Error('FIREBASE_STORAGE_BUCKET environment variable is required');
    }
    
    this.bucket = storage.bucket(bucketName);
    // Firebase Storage public URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
    // We'll use signed URLs for better security, but also support public URLs
    this.baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  }

  async saveFile(buffer: Buffer, originalFilename: string, mimetype: string): Promise<StoredFile> {
    try {
      // Use the provided filename directly (it should already be unique from ImageService)
      // If it doesn't have an extension, add one based on mimetype
      let finalFilename = originalFilename;
      if (!originalFilename.includes('.')) {
        const fileExtension = this.getFileExtension(originalFilename, mimetype);
        finalFilename = `${originalFilename}${fileExtension}`;
      }

      // Upload to Firebase Storage
      const file = this.bucket.file(`uploads/${finalFilename}`);
      
      await file.save(buffer, {
        metadata: {
          contentType: mimetype,
          metadata: {
            originalName: originalFilename,
            uploadedAt: new Date().toISOString()
          }
        },
        public: false // Keep files private, use signed URLs
      });

      // Make file publicly readable (optional - can use signed URLs instead)
      // Uncomment if you want public access:
      // await file.makePublic();

      // Get public URL or generate signed URL
      let url: string;
      if (process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
        // Public URL format
        url = `https://firebasestorage.googleapis.com/v0/b/${this.bucket.name}/o/${encodeURIComponent(`uploads/${finalFilename}`)}?alt=media`;
      } else {
        // Generate signed URL (valid for 1 year)
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
        });
        url = signedUrl;
      }

      const storedFile: StoredFile = {
        filename: finalFilename,
        path: `uploads/${finalFilename}`,
        url: url,
        size: buffer.length
      };

      return storedFile;
    } catch (error) {
      throw createError(`Failed to save file to Firebase Storage: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async getFile(filename: string): Promise<Buffer> {
    try {
      const file = this.bucket.file(`uploads/${filename}`);
      const [exists] = await file.exists();
      
      if (!exists) {
        throw createError(`File not found: ${filename}`, 404);
      }

      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw createError(`File not found: ${filename}`, 404);
      }
      throw createError(`Failed to get file from Firebase Storage: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const file = this.bucket.file(`uploads/${filename}`);
      const [exists] = await file.exists();
      
      if (exists) {
        await file.delete();
      }
    } catch (error) {
      // Don't throw error if file doesn't exist
      console.warn(`Could not delete file ${filename} from Firebase Storage:`, error);
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      const file = this.bucket.file(`uploads/${filename}`);
      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  async getFileStats(filename: string): Promise<{ size: number; createdAt: Date; modifiedAt: Date }> {
    try {
      const file = this.bucket.file(`uploads/${filename}`);
      const [metadata] = await file.getMetadata();
      
      return {
        size: parseInt(metadata.size || '0', 10),
        createdAt: metadata.timeCreated ? new Date(metadata.timeCreated) : new Date(),
        modifiedAt: metadata.updated ? new Date(metadata.updated) : new Date()
      };
    } catch (error) {
      throw createError(`File not found: ${filename}`, 404);
    }
  }

  getFileUrl(filename: string): string {
    if (process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
      return `https://firebasestorage.googleapis.com/v0/b/${this.bucket.name}/o/${encodeURIComponent(`uploads/${filename}`)}?alt=media`;
    }
    // For signed URLs, we need to generate them on-demand
    // This is a fallback - actual URLs should come from saveFile()
    return `${this.baseUrl}/api/uploads/${filename}`;
  }

  private getFileExtension(filename: string, mimetype: string): string {
    // Extract extension from filename
    const extensionFromName = filename.split('.').pop()?.toLowerCase();
    
    // Map mimetypes to extensions
    const mimetypeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };

    // Use mimetype mapping if available, otherwise use filename extension
    const extension = mimetypeMap[mimetype] || (extensionFromName ? `.${extensionFromName}` : '.jpg');
    
    return extension;
  }
}

