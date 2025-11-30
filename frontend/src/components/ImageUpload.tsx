'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { imageAPI, getImageUrl, normalizeImageUrl } from '@/lib/api';
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
  maxFiles = 1,
  className 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    setError(null);

    try {
      // Always upload single file
      const result = await imageAPI.uploadImage(acceptedFiles[0]);

      const newImages = Array.isArray(result.data) ? result.data : [result.data];
      setUploadedImages(prev => [...prev, ...newImages]);
      onUploadComplete?.(newImages);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  }, [multiple, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    multiple: false,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  return (
    <div className={className}>
      <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden">
        <div className="bg-gradient-primary p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5"></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 glass-dark rounded-xl flex items-center justify-center shadow-button">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Görsel Yükle</h2>
              <p className="text-white/90 text-sm font-medium">Görsellerinizi yükleyerek başlayın</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-smooth
              ${isDragActive 
                ? 'border-primary glass-subtle shadow-card' 
                : 'border-white/30 glass-subtle hover:border-primary/50 hover:glass hover:shadow-card'
              }
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-5">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-smooth shadow-button ${
                isDragActive ? 'glass text-primary' : 'glass-subtle'
              }`}>
                {uploading ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <Upload className={`h-8 w-8 transition-smooth ${
                    isDragActive ? 'text-primary' : 'text-gray-400'
                  }`} />
                )}
              </div>
              
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {isDragActive ? 'Görselleri buraya bırakın' : 'Görselleri buraya sürükleyip bırakın'}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Tek görsel yükleme
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg glass-subtle border border-white/30 text-xs text-gray-700 font-medium shadow-minimal">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>JPG, PNG • Max 10MB</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-red-700">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {uploadedImages.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Yüklenen Dosyalar
                </h3>
                <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-semibold">
                  {uploadedImages.length} dosya
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {uploadedImages.map((image) => {
                  const imageUrl = normalizeImageUrl(image.url, image.filename);
                  return (
                    <div key={image.id} className="group relative aspect-square rounded-xl overflow-hidden hover-lift bg-white border border-gray-200">
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
                      
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-smooth flex items-start justify-end p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(image.id);
                          }}
                          className="h-8 w-8 rounded-lg bg-white text-gray-500 hover:text-red-600 hover:bg-white shadow-card opacity-0 group-hover:opacity-100 transition-smooth"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-2.5 border-t border-gray-100">
                        <p className="text-gray-900 text-xs font-semibold truncate">
                          {image.originalName}
                        </p>
                        <p className="text-gray-500 text-[10px]">
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
