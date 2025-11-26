'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { imageAPI, getImageUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

interface UploadedImage {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  url?: string;
}

interface ImageUploadProps {
  onUploadComplete?: (images: UploadedImage[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
}

export function ImageUpload({ 
  onUploadComplete, 
  multiple = false, 
  maxFiles = 5,
  className 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    setError(null);

    try {
      let result;
      
      if (multiple && acceptedFiles.length > 1) {
        // Upload multiple files
        result = await imageAPI.uploadMultipleImages(acceptedFiles);
      } else {
        // Upload single file
        result = await imageAPI.uploadImage(acceptedFiles[0]);
      }

      const newImages = Array.isArray(result.data) ? result.data : [result.data];
      setUploadedImages(prev => [...prev, ...newImages]);
      onUploadComplete?.(newImages);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [multiple, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    },
    multiple,
    maxFiles: multiple ? maxFiles : 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <div className={className}>
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Upload Images</h2>
              <p className="text-white/80">Start by uploading your images</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div
            {...getRootProps()}
            className={`
              border-3 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
                : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50/50'
              }
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-6">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                isDragActive ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-white'
              }`}>
                {uploading ? (
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                ) : (
                  <Upload className={`h-10 w-10 transition-colors ${
                    isDragActive ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                )}
              </div>
              
              <div>
                <p className="text-xl font-bold text-gray-900 mb-2">
                  {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
                </p>
                <p className="text-gray-500 mb-4">
                  {multiple 
                    ? `Up to ${maxFiles} images supported`
                    : 'Single image upload'
                  }
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  <ImageIcon className="h-3 w-3" />
                  <span>JPG, PNG, WebP, GIF • Max 10MB</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700">
              <div className="w-2 h-2 bg-rose-500 rounded-full" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {uploadedImages.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Uploaded Files
                </h3>
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                  {uploadedImages.length} files
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {uploadedImages.map((image) => {
                  const imageUrl = image.url || getImageUrl(image.filename);
                  return (
                    <div key={image.id} className="group relative aspect-square rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-white border border-gray-100">
                      <img
                        src={imageUrl}
                        alt={image.originalName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-50">
                        <ImageIcon className="h-10 w-10 text-gray-300" />
                      </div>
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-start justify-end p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(image.id);
                          }}
                          className="h-8 w-8 rounded-full bg-white/90 text-gray-500 hover:text-rose-600 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-3 border-t border-white/20">
                        <p className="text-gray-900 text-xs font-bold truncate">
                          {image.originalName}
                        </p>
                        <p className="text-gray-500 text-[10px] font-medium">
                          {formatFileSize(image.size)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
