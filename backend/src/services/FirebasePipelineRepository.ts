import admin from 'firebase-admin';
import { getFirestore } from './firebaseAdmin';
import { getStorage } from './firebaseAdmin';
import { ImageMetadata, ImagePipelineRecord, ProcessedVersion, UploadOptions } from '../types/image';

export class FirebasePipelineRepository {
  private db: admin.firestore.Firestore;
  private collection: admin.firestore.CollectionReference;
  private storageBucket: ReturnType<admin.storage.Storage['bucket']> | null;

  constructor() {
    this.db = getFirestore();
    this.collection = this.db.collection('pipelines');
    
    // Initialize Firebase Storage bucket if Firebase Storage is enabled
    const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
    if (useFirebaseStorage) {
      const storage = getStorage();
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (bucketName) {
        this.storageBucket = storage.bucket(bucketName);
      } else {
        this.storageBucket = null;
      }
    } else {
      this.storageBucket = null;
    }
  }

  // Helper method to generate signed URL for Firebase Storage file
  private async getSignedUrl(filename: string): Promise<string | null> {
    if (!this.storageBucket) {
      return null;
    }
    
    try {
      const file = this.storageBucket.file(`uploads/${filename}`);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
      });
      return signedUrl;
    } catch (error) {
      console.error(`Failed to generate signed URL for ${filename}:`, error);
      return null;
    }
  }

  async saveOriginalImage(userId: string, metadata: ImageMetadata, options: UploadOptions = {}): Promise<void> {
    const docRef = this.collection.doc(metadata.id);

    await docRef.set({
      userId,
      originalName: metadata.originalName,
      filename: metadata.filename,
      mimetype: metadata.mimetype,
      size: metadata.size,
      width: metadata.width || 0,
      height: metadata.height || 0,
      uploadedAt: admin.firestore.Timestamp.fromDate(metadata.uploadedAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tags: options.tags || [],
      description: options.description || '',
      isPublic: options.isPublic ?? false,
      processedVersionCount: 0,
      ...(metadata.url && { url: metadata.url }) // Include URL if available
    });
  }

  async addProcessedVersion(userId: string, imageId: string, version: ProcessedVersion): Promise<void> {
    const docRef = this.collection.doc(imageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Image not found');
    }

    const docUserId = doc.get('userId');
    if (docUserId !== userId) {
      throw new Error('Unauthorized access to image');
    }

    const versionPayload: Record<string, any> = {
      ...version,
      createdAt: admin.firestore.Timestamp.fromDate(version.createdAt)
    };

    Object.keys(versionPayload).forEach(key => {
      if (versionPayload[key] === undefined) {
        delete versionPayload[key];
      }
    });

    await docRef.collection('versions').doc(version.id).set(versionPayload);

    await docRef.update({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedVersionCount: admin.firestore.FieldValue.increment(1)
    });
  }

  async getPipeline(userId: string, imageId: string): Promise<ImageMetadata | null> {
    const docRef = this.collection.doc(imageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data || data.userId !== userId) {
      return null;
    }

    // Get URL from Firestore or construct it if missing (for backward compatibility)
    let imageUrl = data.url;
    if (!imageUrl && data.filename) {
      // Construct URL based on storage type
      const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
      if (useFirebaseStorage) {
        // Use Firebase Storage URL format
        const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
        if (bucketName && process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
          imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(`uploads/${data.filename}`)}?alt=media`;
        } else {
          // For signed URLs, generate them on-demand
          const signedUrl = await this.getSignedUrl(data.filename);
          if (signedUrl) {
            imageUrl = signedUrl;
          } else {
            // Fallback to public URL format if signed URL generation fails
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            imageUrl = `${baseUrl}/api/uploads/${data.filename}`;
          }
        }
      } else {
        // Local filesystem
        const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
        imageUrl = `${baseUrl}/api/uploads/${data.filename}`;
      }
    }

    const baseMetadata: ImageMetadata = {
      id: doc.id,
      originalName: data.originalName,
      filename: data.filename,
      mimetype: data.mimetype,
      size: data.size,
      width: data.width,
      height: data.height,
      uploadedAt: this.toDate(data.uploadedAt),
      processedVersions: [],
      ...(imageUrl && { url: imageUrl }) // Include URL if available
    };

    const versionsSnapshot = await docRef.collection('versions').orderBy('createdAt', 'asc').get();
    const versions: ProcessedVersion[] = await Promise.all(
      versionsSnapshot.docs.map(async (versionDoc: admin.firestore.QueryDocumentSnapshot) => {
        const versionData = versionDoc.data();
        // Get URL from Firestore or construct it if missing (for backward compatibility)
        let versionUrl = versionData.url;
        if (!versionUrl && versionData.filename) {
          // Construct URL based on storage type
          const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
          if (useFirebaseStorage) {
            // Use Firebase Storage URL format
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
            if (bucketName && process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
              versionUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(`uploads/${versionData.filename}`)}?alt=media`;
            } else {
              // For signed URLs, generate them on-demand
              const signedUrl = await this.getSignedUrl(versionData.filename);
              if (signedUrl) {
                versionUrl = signedUrl;
              } else {
                // Fallback to public URL format if signed URL generation fails
                const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                versionUrl = `${baseUrl}/api/uploads/${versionData.filename}`;
              }
            }
          } else {
            // Local filesystem
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            versionUrl = `${baseUrl}/api/uploads/${versionData.filename}`;
          }
        }
        return {
          id: versionDoc.id,
          operation: versionData.operation,
          aiModel: versionData.aiModel,
          parameters: versionData.parameters,
          filename: versionData.filename,
          url: versionUrl || '',
          size: versionData.size || 0,
          createdAt: this.toDate(versionData.createdAt),
          processingTimeMs: versionData.processingTimeMs,
          sourceImageId: versionData.sourceImageId,
          sourceProcessedVersionId: versionData.sourceProcessedVersionId
        };
      })
    );

    baseMetadata.processedVersions = versions;
    return baseMetadata;
  }

  async listPipelines(userId: string): Promise<ImagePipelineRecord[]> {
    try {
      let snapshot: admin.firestore.QuerySnapshot;
      
      // Try with index first (preferred)
      try {
        snapshot = await this.collection
          .where('userId', '==', userId)
          .orderBy('uploadedAt', 'desc')
          .get();
      } catch (indexError: any) {
        // If index is missing, fallback to query without orderBy
        if (indexError?.code === 'failed-precondition' || indexError?.message?.includes('index')) {
          console.warn('⚠️ Firestore index missing, using fallback query (slower). Please create composite index.');
          console.warn('   Collection: pipelines, Fields: userId (Ascending), uploadedAt (Descending)');
          snapshot = await this.collection
            .where('userId', '==', userId)
            .get();
        } else {
          throw indexError;
        }
      }

      const pipelines: ImagePipelineRecord[] = await Promise.all(
        snapshot.docs.map(async (docSnapshot: admin.firestore.QueryDocumentSnapshot) => {
          const data = docSnapshot.data();
          const versionsSnapshot = await docSnapshot.ref.collection('versions').orderBy('createdAt', 'asc').get();
          const versions: ProcessedVersion[] = await Promise.all(
            versionsSnapshot.docs.map(async (versionDoc: admin.firestore.QueryDocumentSnapshot) => {
              const versionData = versionDoc.data();
              // Get URL from Firestore or construct it if missing (for backward compatibility)
              let versionUrl = versionData.url;
              if (!versionUrl && versionData.filename) {
                // Construct URL based on storage type
                const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
                if (useFirebaseStorage) {
                  // Use Firebase Storage URL format
                  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
                  if (bucketName && process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
                    versionUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(`uploads/${versionData.filename}`)}?alt=media`;
                  } else {
                    // For signed URLs, generate them on-demand
                    const signedUrl = await this.getSignedUrl(versionData.filename);
                    if (signedUrl) {
                      versionUrl = signedUrl;
                    } else {
                      // Fallback to public URL format if signed URL generation fails
                      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                      versionUrl = `${baseUrl}/api/uploads/${versionData.filename}`;
                    }
                  }
                } else {
                  // Local filesystem
                  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                  versionUrl = `${baseUrl}/api/uploads/${versionData.filename}`;
                }
              }
              return {
                id: versionDoc.id,
                operation: versionData.operation,
                aiModel: versionData.aiModel,
                parameters: versionData.parameters,
                filename: versionData.filename,
                url: versionUrl || '',
                size: versionData.size || 0,
                createdAt: this.toDate(versionData.createdAt),
                processingTimeMs: versionData.processingTimeMs,
                sourceImageId: versionData.sourceImageId,
                sourceProcessedVersionId: versionData.sourceProcessedVersionId
              };
            })
          );

          // Get URL from Firestore or construct it if missing (for backward compatibility)
          let imageUrl = data.url;
          if (!imageUrl && data.filename) {
            // Construct URL based on storage type
            const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
            if (useFirebaseStorage) {
              // Use Firebase Storage URL format
              const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
              if (bucketName && process.env.USE_FIREBASE_PUBLIC_URLS === 'true') {
                imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(`uploads/${data.filename}`)}?alt=media`;
              } else {
                // For signed URLs, we need to generate them on-demand
                // Fallback to base URL for now (should be handled by storage service)
                const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
                imageUrl = `${baseUrl}/api/uploads/${data.filename}`;
              }
            } else {
              // Local filesystem
              const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
              imageUrl = `${baseUrl}/api/uploads/${data.filename}`;
            }
          }

          return {
            id: docSnapshot.id,
            userId: data.userId,
            originalName: data.originalName,
            filename: data.filename,
            ...(imageUrl && { url: imageUrl }), // Include URL if available
            mimetype: data.mimetype,
            size: data.size,
            width: data.width,
            height: data.height,
            uploadedAt: this.toDate(data.uploadedAt),
            processedVersions: versions,
            tags: data.tags || [],
            description: data.description || '',
            isPublic: data.isPublic ?? false,
            processedVersionCount: data.processedVersionCount || versions.length
          };
        })
      );

      // Sort by uploadedAt descending (in case we used fallback query without orderBy)
      pipelines.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

      return pipelines;
    } catch (error: any) {
      console.error('Error listing pipelines:', error);
      throw error;
    }
  }

  async deletePipeline(userId: string, imageId: string): Promise<void> {
    const docRef = this.collection.doc(imageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return;
    }

    const data = doc.data();
    if (!data || data.userId !== userId) {
      throw new Error('Unauthorized access to image');
    }

    const batch = this.db.batch();
    const versionsSnapshot = await docRef.collection('versions').get();

    versionsSnapshot.docs.forEach((versionDoc: admin.firestore.QueryDocumentSnapshot) => {
      batch.delete(versionDoc.ref);
    });

    batch.delete(docRef);
    await batch.commit();
  }

  async deleteProcessedVersion(userId: string, imageId: string, versionId: string): Promise<void> {
    const docRef = this.collection.doc(imageId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Image not found');
    }

    const data = doc.data();
    if (!data || data.userId !== userId) {
      throw new Error('Unauthorized access to image');
    }

    const versionRef = docRef.collection('versions').doc(versionId);
    const versionDoc = await versionRef.get();

    if (!versionDoc.exists) {
      throw new Error('Processed version not found');
    }

    await versionRef.delete();
  }

  private toDate(value: admin.firestore.Timestamp | Date | string): Date {
    if (!value) {
      return new Date();
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value.toDate();
  }
}

