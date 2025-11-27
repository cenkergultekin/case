import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createError } from '../middleware/errorHandler';

export interface StoredFile {
  filename: string;
  path: string;
  url: string;
  size: number;
}

export class FileStorageService {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalFilename: string, mimetype: string): Promise<StoredFile> {
    try {
      await this.ensureUploadDir();
      
      // Use the provided filename directly (it should already be unique from ImageService)
      // If it doesn't have an extension, add one based on mimetype
      let finalFilename = originalFilename;
      if (!originalFilename.includes('.')) {
        const fileExtension = this.getFileExtension(originalFilename, mimetype);
        finalFilename = `${originalFilename}${fileExtension}`;
      }
      
      const filePath = join(this.uploadDir, finalFilename);

      await fs.writeFile(filePath, buffer);

      const storedFile: StoredFile = {
        filename: finalFilename,
        path: filePath,
        url: `${this.baseUrl}/api/uploads/${finalFilename}`,
        size: buffer.length
      };

      return storedFile;
    } catch (error) {
      throw createError(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  async getFile(filename: string): Promise<Buffer> {
    try {
      const filePath = join(this.uploadDir, filename);
      return await fs.readFile(filePath);
    } catch (error) {
      throw createError(`File not found: ${filename}`, 404);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const filePath = join(this.uploadDir, filename);
      await fs.unlink(filePath);
    } catch (error) {
      // Don't throw error if file doesn't exist
      console.warn(`Could not delete file ${filename}:`, error);
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      const filePath = join(this.uploadDir, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(filename: string): Promise<{ size: number; createdAt: Date; modifiedAt: Date }> {
    try {
      const filePath = join(this.uploadDir, filename);
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    } catch (error) {
      throw createError(`File not found: ${filename}`, 404);
    }
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

  getUploadDir(): string {
    return this.uploadDir;
  }

  getFileUrl(filename: string): string {
    return `${this.baseUrl}/api/uploads/${filename}`;
  }

  /**
   * List all files in upload directory
   */
  async listFiles(): Promise<Array<{ filename: string; size: number; createdAt: Date; mimetype: string }>> {
    try {
      await this.ensureUploadDir();
      const files = await fs.readdir(this.uploadDir);
      
      const fileList = await Promise.all(
        files.map(async (filename) => {
          try {
            const stats = await this.getFileStats(filename);
            // Determine mimetype from extension
            const ext = filename.split('.').pop()?.toLowerCase();
            const mimetypeMap: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'webp': 'image/webp',
              'gif': 'image/gif'
            };
            
            return {
              filename,
              size: stats.size,
              createdAt: stats.createdAt,
              mimetype: ext ? (mimetypeMap[ext] || 'image/jpeg') : 'image/jpeg'
            };
          } catch (error) {
            return null;
          }
        })
      );
      
      // Filter out nulls and return
      return fileList.filter(f => f !== null) as Array<{ filename: string; size: number; createdAt: Date; mimetype: string }>;
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }
}
